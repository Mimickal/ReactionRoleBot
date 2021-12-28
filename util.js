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
const {
	Guild,
	Interaction,
	Role,
	User,
} = require('discord.js');

const logger = require('./logger');

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
	if (emoji?.id) {
		return emoji.id;
	} else if (emoji?.match(/^\p{Extended_Pictographic}$/u)) {
		return emoji;
	} else {
		throw Error(`Not an emoji key: ${emoji}`);
	}
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
 * Given a Discord.js object, returns a logger-friendly string describing it in
 * better detail.
 *
 * This purposely only outputs IDs to limit the amount of user data logged.
 */
// TODO stolen from Zerda. Maybe pull this out to a module with the logger?
function stringify(thing) {
	let str;

	if (!thing) {
		return '[undefined]';
	}
	else if (typeof thing === 'string' || thing instanceof String) {
		return thing;
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
	else if (thing instanceof Role) {
		const role = thing;
		return `Role ${role.id}`;
	}
	else if (thing instanceof User) {
		const user = thing;
		return `User ${user.id}`;
	}
	else {
		throw Error(`Unsupported type ${typeof(thing)}`);
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
	ephemReply,
	stringify,
	unindent,
};

