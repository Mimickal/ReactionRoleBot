/*******************************************************************************
 * This file is part of No BS Role Reacts, a role-assigning Discord bot.
 * Copyright (C) 2020 Mimickal (Mia Moretti).
 *
 * No BS Role Reacts is free software under the GNU Affero General Public
 * License v3.0. See LICENSE or <https://www.gnu.org/licenses/agpl-3.0.en.html>
 * for more information.
 ******************************************************************************/
const { Emoji } = require('discord.js');
const { GlobalLogger } = require('@mimickal/discord-logging');

const logger = GlobalLogger.logger;

/**
 * Most IDs are between 17 and 19 characters, but I have seen some patterns
 * matching to 20 for custom emoji IDs, so let's just future-proof this and
 * match up to 22. If this bot is still being used by the time we need to update
 * that, well, cool.
 */
const DISCORD_ID_PATTERN = RegExp('^\\d{17,22}$');

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
	return !isDiscordId(thing) && (isEmojiStr(thing) || thing instanceof Emoji);
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
	return str?.match?.(/^\p{Emoji}+/u);
}

module.exports = {
	emojiToKey,
	entries,
	ephemEdit,
	ephemReply,
	isDiscordId,
	isEmojiStr,
};

