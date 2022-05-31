/*******************************************************************************
 * This file is part of No BS Role Reacts, a role-assigning Discord bot.
 * Copyright (C) 2020 Mimickal (Mia Moretti).
 *
 * No BS Role Reacts is free software under the GNU Affero General Public
 * License v3.0. See LICENSE or <https://www.gnu.org/licenses/agpl-3.0.en.html>
 * for more information.
 ******************************************************************************/
const lodash = require('lodash');
const Perms = require('discord.js').Permissions.FLAGS;

const commands = require('./commands');
const config = require('./config');
const database = require('./database');
const UserMutex = require('./mutex');
const logger = require('./logger');
const {
	detail,
	emojiToKey,
	stringify,
	unindent,
} = require('./util');

/**
 * Allows us to "lock" a user to prevent multiple events from trying to update
 * their roles at the same time.
 *
 * Any event that modifies a user should acquire a lock on that user first.
 * The corresponding `GUILD_MEMBER_UPDATE` event will release the lock. If that
 * event doesn't fire for some reason, `UserMutex` has a fallback timer to
 * release the lock anyway.
 *
 * Discord API request promises resolve when Discord *acknowledges* them, **not**
 * when it *applies* them. Because of this, Discord.js does not update its
 * internal user role cache until it receives the corresponding
 * `GUILD_MEMBER_UPDATE` event.
 */
const USER_MUTEX = new UserMutex();

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
 * Event handler for when a guild member is updated.
 * Releases the mutex lock on the user, since this event is fired once a user's
 * roles are fully updated.
 *
 * See docs for: {@link USER_MUTEX}
 */
async function onGuildMemberUpdate(old_member, new_member) {
	USER_MUTEX.unlock(new_member);
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
 * Checks if the message has any reaction roles configured for the given emoji.
 * If so, adds that role (or roles) to the user who added the reaction.
 * Removes any reaction that doesn't correspond to a role.
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

	const role_ids = await database.getRoleReacts({
		message_id: reaction.message.id,
		emoji_id: emojiToKey(reaction.emoji),
	});

	// Someone added an emoji that isn't mapped to a role
	if (role_ids.length === 0) {
		return reaction.remove();
	}

	const member = await reaction.message.guild.members.fetch(react_user.id);

	// Remove mutually exclusive roles from user
	// FIXME this database call should optionally take an array
	const mutex_roles = lodash.flatMap(
		await Promise.all(role_ids.map(role_id => database.getMutexRoles({
			guild_id: reaction.message.guild.id,
			role_id: role_id,
		})))
	);
	await USER_MUTEX.lock(member); // See USER_MUTEX comment
	try {
		await member.roles.remove(mutex_roles, 'Role bot removal (mutex)');
		await member.roles.add(role_ids, 'Role bot assignment');
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
	await database.incrementAssignCounter(role_ids.length);

	logger.info(`Added Roles ${stringify(role_ids)} to ${stringify(react_user)}`);
}

/**
 * Event handler for when a reaction is removed from a message.
 * Checks if the message has any reaction roles configured for the given emoji.
 * If so, removes that role (or roles) from the user whose reaction was removed.
 * Also re-adds the bot's reaction if it is removed while a react-role is active.
 *
 * NOTE:
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

	// TODO Maybe be a little smarter about how we remove roles when multiple
	// emojis map to that role. Currently we remove the roll when a single emoji
	// mapped to it is removed. Maybe we should wait until all emojis mapped to
	// it are removed?

	const emoji = reaction.emoji;

	const role_ids = await database.getRoleReacts({
		message_id: reaction.message.id,
		emoji_id: emojiToKey(emoji),
	});

	// Ignore reactions on non-role-react posts
	if (role_ids.length === 0) {
		return;
	}

	if (react_user === react_user.client.user) {
		logger.info(`Replacing removed bot reaction ${stringify(emoji)}`);
		return reaction.message.react(emoji);
	}

	await USER_MUTEX.lock(react_user); // see USER_MUTEX comment
	try {
		const member = await reaction.message.guild.members.fetch(react_user.id);

		// onGuildMemberUpdate won't fire if we don't actually change roles
		if (!role_ids.some(role_id => member.roles.cache.has(role_id))) {
			USER_MUTEX.unlock(react_user);
			return;
		}

		await member.roles.remove(role_ids, 'Role bot removal');
		logger.info(`Removed Roles ${stringify(role_ids)} from ${stringify(react_user)}`);
	} catch (err) {
		logger.error(
			`Failed to remove Roles ${stringify(role_ids)} from ${stringify(react_user)}`,
			err
		);
	}
}

/**
 * Event handler for when the bot is logged in.
 *
 * Logs the bot user we logged in as.
 */
async function onReady(client) {
	logger.info(`Logged in as ${client.user.tag} (${client.user.id})`);

	if (config.enable_precache) {
		logger.warn(unindent(`
			Precaching is VERY hard on Discord's API and will cause the bot to
			get rate limited, unless the bot is only in very few servers. Use
			with caution.
		`));
		await precache(client);
	}
}

/**
 * Pre-caches messages we have react role mappings on. This can prevent an issue
 * where the bot sometimes fails to pick up reacts when it first restarts.
 *
 * WARNING: This function is *very* hard on Discord's API, and will cause the
 * bot to get rate limited if it's in too many servers. This really shouldn't be
 * used.
 */
async function precache(client) {
	logger.info('Precaching messages...');

	// Despite message IDs being unique, we can only fetch a message by ID
	// through a channel object, so we need to iterate over all channels and
	// search each one for the messages we expect.
	let numCached = 0;
	await Promise.all(client.guilds.cache.map(async guild => {
		const guild_message_ids = await database.getRoleReactMessages(guild.id);
		let errors = {}; // Allows us to aggregate and report errors

		await Promise.all(guild.channels.cache.map(async channel => {
			await Promise.all(guild_message_ids.map(async id => {
				try {
					if (await channel.messages?.fetch(id)) {
						numCached++;
					}
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

	logger.info(`Finished pre-cache (${numCached} messages)`);
}

module.exports = {
	onGuildJoin,
	onGuildLeave,
	onGuildMemberUpdate,
	onInteraction,
	onMessageBulkDelete,
	onMessageDelete,
	onReactionAdd,
	onReactionRemove,
	onReady,
};

