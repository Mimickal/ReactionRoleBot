/*******************************************************************************
 * This file is part of No BS Role Reacts, a role-assigning Discord bot.
 * Copyright (C) 2020 Mimickal (Mia Moretti).
 *
 * No BS Role Reacts is free software under the GNU Affero General Public
 * License v3.0. See LICENSE or <https://www.gnu.org/licenses/agpl-3.0.en.html>
 * for more information.
 ******************************************************************************/
const {
	Emoji,
	Guild,
	Interaction,
	Message,
	MessageReaction,
	Role,
	User,
} = require('discord.js');

const logger = require('./logger');

/**
 * Most IDs are between 17 and 19 characters, but I have seen some patterns
 * matching to 20 for custom emoji IDs, so let's just future-proof this and
 * match up to 22. If this bot is still being used by the time we need to update
 * that, well, cool.
 */
const DISCORD_ID_PATTERN = RegExp('^\\d{17,22}$');

/**
 * Joins the given array of strings using newlines.
 */
function asLines(lines) {
	if (!Array.isArray(lines)) {
		lines = [lines];
	}
	return lines.join('\n');
}

/**
 * Like stringify, but provides more detail. Falls back on stringify.
 */
function detail(thing) {
	if (thing instanceof Interaction) {
		const int = thing;
		return `${stringify(int.guild)} ${stringify(int.user)} ${stringify(int)}`;
	}
	else if (thing instanceof MessageReaction) {
		const reaction = thing;
		return `${stringify(reaction)} on ${stringify(reaction.message)}`;
	}
	else {
		// Fall back on standard strings
		return stringify(thing);
	}
}

/**
 * Converts an emoji to a string we can use as a key (e.g. in a database).
 *
 * - Custom emojis (animated or otherwise) return their Discord ID.
 * - Built-in emojis are already strings, and so we return them as-is.
 * - Non-emoji strings are considered an error and will throw accordingly.
 */
function emojiToKey(emoji) {
	if (!_isEmoji(emoji)) {
		throw Error(`Not an emoji key: ${emoji}`);
	}
	return emoji?.id ?? emoji?.name ?? emoji;
}

/**
 * Flattens a MultiMap<emoji_key, role_id> to an array of emoji-role pairs.
 */
 function entries(mmap) {
	return Array.from(mmap.keys()).reduce((arr, emoji_key) => {
		arr.push(...mmap.get(emoji_key).map(role_id => [emoji_key, role_id]));
		return arr;
	}, new Array());
}

/**
 * Same as {@link ephemReply}, but to edit an existing ephemeral response.
 */
function ephemEdit(interaction, content) {
	logger.info(`Edit to ${detail(interaction)}: "${content}"`);
	return interaction.editReply({
		content: content,
		ephemeral: true,
	});
}

/**
 * Shortcut for sending an ephemeral reply to an interaction, since we do it so
 * much.
 */
function ephemReply(interaction, content) {
	logger.info(`Reply to ${detail(interaction)}: "${content}"`);
	return interaction.reply({
		content: content,
		ephemeral: true,
	});
}

/**
 * Handles both custom Discord.js Emojis and standard unicode emojis.
 */
function _isEmoji(thing) {
	return isEmojiStr(thing) || thing instanceof Emoji;
}

/**
 * Matches Discord IDs.
 */
function isDiscordId(str) {
	return str?.match?.(DISCORD_ID_PATTERN);
}

/**
 * Matches built-in unicode emoji literals.
 */
function isEmojiStr(str) {
	return str?.match?.(/^\p{Extended_Pictographic}$/u);
}

/**
 * Given a Discord.js object, returns a logger-friendly string describing it in
 * better detail.
 *
 * This purposely only outputs IDs to limit the amount of user data logged.
 */
// TODO stolen from Zerda. Maybe pull this out to a module with the logger?
function stringify(thing) {
	if (!thing) {
		return '[undefined]';
	}
	else if (_isEmoji(thing)) {
		const emoji = thing;
		return `Emoji ${emojiToKey(emoji)}`;
	}
	else if (thing instanceof Guild) {
		const guild = thing;
		return `Guild ${guild.id}`;
	}
	else if (thing instanceof Interaction) {
		const interaction = thing;
		const cmd_str = Array.of(
			interaction.commandName,
			interaction.options.getSubcommandGroup(false),
			interaction.options.getSubcommand(false),
		).filter(x => x).join(' ');
		return `Interaction "${cmd_str}"`;
	}
	else if (thing instanceof Message) {
		const message = thing;
		return `Message ${message.url}`;
	}
	else if (thing instanceof MessageReaction) {
		const reaction = thing;
		return `Reaction ${emojiToKey(reaction.emoji)}`;
	}
	else if (thing instanceof Role) {
		const role = thing;
		return `Role ${role.id}`;
	}
	else if (thing instanceof User) {
		const user = thing;
		return `User ${user.id}`;
	}
	else if (typeof thing === 'string' || thing instanceof String) {
		return thing;
	}
	else {
		return JSON.stringify(thing);
	}
}

/**
 * Allows us to treat multi-line template strings as a single continuous line.
 */
function unindent(str) {
	return str
		.replace(/^\s*/, '')
		.replace(/\n\t*/g, ' ');
}

module.exports = {
	asLines,
	detail,
	emojiToKey,
	entries,
	ephemEdit,
	ephemReply,
	isDiscordId,
	isEmojiStr,
	stringify,
	unindent,
};

