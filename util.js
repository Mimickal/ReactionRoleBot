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

/**
 * Converts an emoji to a string we can use as a key (e.g. in a database).
 *
 * - Custom emojis (animated or otherwise) return their Discord ID.
 * - Built-in emojis are already strings, and so we return them as-is.
 * - Non-emoji strings are considered an error and will throw accordingly.
 */
function emojiToKey(emoji) {
	if (emoji?.id) {
		return emoji.id;
	} else if (emoji?.match(/^\p{Extended_Pictographic}$/u)) {
		return emoji;
	} else {
		throw Error(`Not an emoji key: ${emoji}`);
	}
}

module.exports = {
	emojiToKey,
};

