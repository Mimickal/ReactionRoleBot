/*******************************************************************************
 * This file is part of ReactionRoleBot, a role-assigning Discord bot.
 * Copyright (C) 2020 Mimickal (Mia Moretti).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, version 3.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 ******************************************************************************/
const Perms = require('discord.js').Permissions.FLAGS;

const commands = require('./commands');
const database = require('./database');
const logger = require('./logger');
const {
	detail,
	emojiToKey,
	stringify,
	unindent,
} = require('./util');

const REQUIRED_PERMISSIONS = Object.freeze({
	[Perms.ADD_REACTIONS]:        'Add Reactions',
	[Perms.MANAGE_MESSAGES]:      'Manage Messages',
	[Perms.MANAGE_ROLES]:         'Manage Roles',
	[Perms.READ_MESSAGE_HISTORY]: 'Read Message History',
	[Perms.USE_EXTERNAL_EMOJIS]:  'Use External Emojis',
	[Perms.VIEW_CHANNEL]:         'Read Text Channels & See Voice Channels',
});

/**
 * Event handler for when the bot joins a new guild.
 * DMs the guild owner with some basic instructions, including any missing
 * required permissions.
 */
async function onGuildJoin(guild) {
	logger.info(`Joined ${stringify(guild)}`);

	let text = unindent(`
		Hi there! My role needs to be ordered above any role you want me to
		assign. You are getting this message because you are the server owner,
		but anybody with Administrator permissions or an allowed role can
		configure me.
	`);

	// This bot probably shouldn't be given the admin permission, but if we have
	// it then the other ones don't matter.
	// These permissions can also be inherited from the server's @everyone
	// permissions.
	const client_member = await guild.members.fetch(guild.client.user);
	const missing_perms = Object.entries(REQUIRED_PERMISSIONS)
		.filter(([ perm, name ]) => !client_member.permissions.has(perm, true))
		.map(([ perm, name ]) => name);

	if (missing_perms.length > 0) {
		text += '\n\n';
		text += unindent(`
			Also, I am missing the following permissions. Without them, I
			probably won't work right:
		`);
		text += '\n';
		text += missing_perms.map(name => `- ${name}`).join('\n');

		logger.info(`${stringify(guild)} missing permissions: ${missing_perms}`);
	}

	const guild_owner = await guild.fetchOwner();
	const owner_dm = await guild_owner.createDM();
	return owner_dm.send(text);
}

/**
 * Event handler for when the bot leaves (or is kicked from) a guild.
 * Deletes all data associated with that guild.
 */
async function onGuildLeave(guild) {
	try {
		await database.clearGuildInfo(guild.id)
		logger.info(`Left ${stringify(guild)}, deleted all related data`);
	} catch (err) {
		logger.error(`Left ${stringify(guild)} but failed to delete data!`, err);
	}
}

/**
 * Event handler for receiving some kind of interaction.
 * Logs the interaction and passes it on to the command handler.
 */
async function onInteraction(interaction) {
	logger.info(`Received ${detail(interaction)}`);

	try {
		await commands.execute(interaction);
	} catch (err) {
		logger.error(`${detail(interaction)} error fell through:`, err);
	}
}

/**
 * Event handler for when messages are deleted in bulk.
 * Removes any react roles configured for the deleted messages.
 */
async function onMessageBulkDelete(messages) {
	for (const message of messages.values()) {
		console.log(message.id);
		onMessageDelete(message);
	}
}

/**
 * Event handler for when a message is deleted.
 * Removes any react-roles configured for the deleted message.
 */
async function onMessageDelete(message) {
	try {
		const removed = await database.removeAllRoleReacts(message.id);
		if (removed) {
			logger.info(`Deleted ${stringify(message)}, removed ${removed} mappings`);
		}
	} catch (err) {
		logger.error(`Deleted ${stringify(message)} but failed to clear records`, err);
	}
}

/**
 * Event handler for when a reaction is added to a message.
 * Checks if the message has any reaction roles configured. If so, adds that
 * role to the user who added the reaction. Removes any reaction that doesn't
 * correspond to a role.
 */
async function onReactionAdd(reaction, react_user) {
	logger.debug(`Added ${detail(reaction)}`);

	// Ignore our own reactions
	if (react_user === react_user.client.user) {
		return;
	}

	// Ignore reactions on non-role-react posts
	if (!await database.isRoleReactMessage(reaction.message.id)) {
		return;
	}

	const role_id = await database.getRoleReact({
		message_id: reaction.message.id,
		emoji_id: emojiToKey(reaction.emoji),
	});

	// Someone added an emoji that isn't mapped to a role
	if (!role_id) {
		return reaction.remove();
	}

	const member = await reaction.message.guild.members.fetch(react_user.id);

	// Remove mutually exclusive roles from user
	const mutex_roles = await database.getMutexRoles({
		guild_id: reaction.message.guild.id,
		role_id: role_id,
	});
	try {
		// Do assignment in one request so we don't hit rate limit so quickly.
		let new_roles = member.roles.cache.clone();
		const removed = mutex_roles
			.map(mutex_id => new_roles.delete(mutex_id))
			.find(was_deleted => was_deleted);
		new_roles = Array.from(new_roles.keys());
		new_roles.push(role_id);
		await member.roles.set(new_roles, `Role bot assignment${removed && ' (mutex)'}`);
	} catch (err) {
		logger.warn(`Failed to update roles on ${stringify(react_user)}`, err);
	}

	// Remove associated mutually exclusive emoji reactions
	const mutex_emojis = await database.getMutexEmojis(mutex_roles);
	for await (const emoji of mutex_emojis) {
		const mutex_reaction = reaction.message.reactions.resolve(emoji);
		if (mutex_reaction) {
			mutex_reaction.users.remove(react_user);
		}
	}

	// Track assignment number for fun
	await database.incrementAssignCounter();

	logger.info(`Added Role ${role_id} to ${detail(react_user)}`);
}

/**
 * Event handler for when a reaction is removed from a message.
 * Checks if the message has any reaction roles configured. If so, removes that
 * role from the user whose reaction was removed. Also re-adds the bot's
 * reaction if it is removed while a react-role is active.
 *
 * This is only fired when a single reaction is removed, either by clicking on
 * an emoji or through the message's "reactions" context menu. It is NOT fired
 * when a bot removes all reactions (Discord uses a seprate event for that).
 *
 * The user this handler receives is the user whose reaction was removed.
 * Discord does not tell us who actually removed that user's reaction. We can't
 * tell when an admin removes a reaction instead of the user themselves, so this
 * handler will always just remove the role from the user.
 */
async function onReactionRemove(reaction, react_user) {
	logger.debug(`Removed ${detail(reaction)}`);

	// TODO How do we handle two emojis mapped to the same role?
	// Do we only remove the role if the user doesn't have any of the mapped
	// reactions? Or do we remove when any of the emojis are un-reacted?

	const emoji = reaction.emoji;

	const role_id = await database.getRoleReact({
		message_id: reaction.message.id,
		emoji_id: emojiToKey(emoji),
	});

	// Ignore reactions on non-role-react posts
	if (!role_id) {
		return;
	}

	if (react_user === react_user.client.user) {
		logger.info(`Replacing removed bot reaction ${stringify(emoji)}`);
		return reaction.message.react(emoji);
	}

	try {
		const member = await reaction.message.guild.members.fetch(react_user.id);
		await member.roles.remove(role_id, 'Role bot removal');
		logger.info(`Removed Role ${role_id} from ${stringify(react_user)}`);
	} catch (err) {
		logger.error(
			`Failed to remove Role ${role_id} from ${stringify(react_user)}`,
			err
		);
	}
}

/**
 * Event handler for when the bot is logged in.
 *
 * Logs the bot user we logged in as.
 *
 * Pre-caches messages we have react role mappings on. This prevents an issue
 * where the bot sometimes fails to pick up reacts when it first restarts.
 */
async function onReady(client) {
	logger.info(`Logged in as ${client.user.tag} (${client.user.id})`);
	logger.info('Precaching messages...');

	// Despite message IDs being unique, we can only fetch a message by ID
	// through a channel object, so we need to iterate over all channels and
	// search each one for the messages we expect.
	await Promise.all(client.guilds.cache.map(async guild => {
		const guild_message_ids = await database.getRoleReactMessages(guild.id);
		let errors = {}; // Allows us to aggregate and report errors

		await Promise.all(guild.channels.cache.map(async channel => {
			await Promise.all(guild_message_ids.map(async id => {
				try {
					await channel.messages?.fetch(id);
				} catch (err) {
					if (err.message.includes('Unknown Message')) {
						return; // Expected when message isn't in this channel
					} else {
						errors[err.message] ??= 0;
						errors[err.message]++;
					}
				}
			}));
		}));

		Object.entries(errors)
			.filter(([msg, count]) => count)
			.forEach(([msg, count]) => {
				logger.warn(`Pre-cache ${stringify(guild)} - ${msg} x${count}`)
			});
	}));

	logger.info('Finished pre-cache');
}

module.exports = {
	onGuildJoin,
	onGuildLeave,
	onInteraction,
	onMessageBulkDelete,
	onMessageDelete,
	onReactionAdd,
	onReactionRemove,
	onReady,
};

