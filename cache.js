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
const database = require('./database');

// The live cache of selected messages for each user.
const selectedMessages = new Map();

// TODO we need a way to handle custom emojis too

/**
 * Selects a message to use for each subsequent command the user enters.
 */
function selectMessage(user_id, message) {
	selectedMessages.set(user_id, message);
	// TODO clear selected cache after some time
}

/**
 * Gets the message the given user currently has selected, or null if the user
 * has no message selected.
 */
async function getSelectedMessage(user_id) {
	let message = selectedMessages.get(user_id);
	if (!message) {
		throw new Error('No message selected!');
	}
	return message;
}

/**
 * Clears the selected message for the given user.
 */
function clearSelectedMessage(user_id) {
	selectedMessages.delete(user_id);
}

/**
 * Add an emoji-role association to the message the user has selected.
 * If the emoji was already associated with another role on this message, the
 * original mapping will be overwritten.
 *
 * Throws an exception if the user has no message selected.
 */
async function addEmojiRole(user_id, emoji_id, role_id) {
	let message = await getSelectedMessage(user_id);

	return database.addRoleReact({
		guild_id: message.guild.id,
		message_id: message.id,
		emoji_id: emoji_id,
		role_id: role_id
	});
}

/**
 * Remove an emoji-role association from the message the user has selected.
 *
 * Throws an exception:
 *   - If the user has no message selected.
 *   - If the message did not have a mapping for the given emoji.
 */
async function removeEmojiRole(user_id, emoji_id) {
	let message = await getSelectedMessage(user_id);

	let args = {
		message_id: message.id,
		emoji_id: emoji_id
	};

	let role_id = await database.getRoleReact(args);
	if (role_id) {
		database.removeRoleReact(args);
	} else {
		throw new Error(`No role mapping found for emoji ${emoji_id}!`);
	}
}

/**
 * Gets the role mapped to the given emoji on the given message, or null if
 * there's no role associated with it (or if the message is unknown).
 */
function getReactRole(message_id, emoji_id) {
	return database.getRoleReact({
		message_id: message_id,
		emoji_id: emoji_id
	});
}

module.exports = {
	selectMessage,
	getSelectedMessage,
	clearSelectedMessage,
	addEmojiRole,
	removeEmojiRole,
	getReactRole
};
