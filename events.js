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
const commands = require('./commands');
const database = require('./database');
const logger = require('./logger');
const {
	detail,
	emojiToKey,
	stringify,
} = require('./util');

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
 * Just logs the bot user we logged in as.
 */
function onReady(client) {
	logger.info(`Logged in as ${client.user.tag} (${client.user.id})`);
}

module.exports = {
	onGuildLeave,
	onInteraction,
	onReactionRemove,
	onReady,
};

