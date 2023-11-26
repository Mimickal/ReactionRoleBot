/*******************************************************************************
 * This file is part of No BS Role Reacts, a role-assigning Discord bot.
 * Copyright (C) 2020 Mimickal (Mia Moretti).
 *
 * No BS Role Reacts is free software under the GNU Affero General Public
 * License v3.0. See LICENSE or <https://www.gnu.org/licenses/agpl-3.0.en.html>
 * for more information.
 ******************************************************************************/
import { CommandInteraction, Emoji } from 'discord.js';
import { GlobalLogger, detail } from '@mimickal/discord-logging';
import Multimap from 'multimap';

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
export function emojiToKey(emoji: Emoji | string): string {
	if (!isEmoji(emoji)) {
		throw Error(`Not an emoji key: ${emoji}`);
	}
	return (emoji as Emoji)?.id
		?? (emoji as Emoji)?.name
		?? emoji as string;
}

/** Flattens a MultiMap<emoji_key, role_id> to an array of emoji-role pairs. */
export function entries<K, V>(mmap: Multimap<K, V>): [K, V][] {
	return Array
		.from(mmap.keys())
		.reduce((arr, emoji_key) => {
			const role_ids = mmap.get(emoji_key);
			arr.push(...role_ids.map<[K, V]>(role_id => [emoji_key, role_id]));
			return arr;
		}, new Array<[K, V]>());
}

/**
 * Same as {@link ephemReply}, but to edit an existing ephemeral response.
 *
 * Note that this won't change a non-ephemeral message into an ephemeral one.
 */
export function ephemEdit(interaction: CommandInteraction, content: string) {
	logger.info(`Edit to ${detail(interaction)}: "${content}"`);
	return interaction.editReply({
		content: content,
	});
}

/**
 * Shortcut for sending an ephemeral reply to an interaction, since we do it so
 * much.
 */
export function ephemReply(interaction: CommandInteraction, content: string) {
	logger.info(`Reply to ${detail(interaction)}: "${content}"`);
	return interaction.reply({
		content: content,
		ephemeral: true,
	});
}

/**
 * Stringify an error, recursing through possibly-nested causes.
 */
export function errToStr(error: Error): string {
	let str = error.stack || '';
	let cause = error.cause as Error;
	while (cause) {
		str += `\n[cause]: ${cause.stack}`;
		cause = cause.cause as Error;
	}
	return str || error.toString();
}

/** Matches Discord IDs. */
export function isDiscordId(value: any): value is string {
	return !!value?.match?.(DISCORD_ID_PATTERN);
}

/** Matches built-in unicode emoji literals. */
export function isEmojiStr(value: any): value is string {
	return !!value?.match?.(/^\p{Emoji}+/u);
}

/** Handles both custom Discord.js Emojis and standard unicode emojis. */
function isEmoji(value: any): value is string | Emoji {
	return !isDiscordId(value) && (isEmojiStr(value) || value instanceof Emoji);
}
