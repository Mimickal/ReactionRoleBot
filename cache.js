// The live cache of selected messages for each user.
const selectedMessages = new Map();

// The map of message IDs to emoji -> role associations.
// TODO eventually this will be replaced with a database.
// TODO smarter caching here with discord.js' own caching scheme?
const messageEmojiRoleMap = new Map();

// TODO we need a way to handle custom emojis too

/**
 * Selects a message to use for each subsequent command the user enters.
 */
function selectMessage(user_id, message) {
	selectedMessages.set(user_id, message);

	if (!messageEmojiRoleMap.has(message.id)) {
		messageEmojiRoleMap.set(message.id, new Map());
	}

	// TODO clear selected cache after some time
}

/**
 * Add an emoji-role association to the message the user has selected.
 * If the emoji was already associated with another role on this message, the
 * original mapping will be overwritten.
 *
 * Throws an exception if the user has no message selected.
 */
function addEmojiRole(user_id, emoji_id, role_id) {
	let mapping = getMapping(user_id);
	mapping.set(emoji_id, role_id);
}

/**
 * Remove an emoji-role association from the message the user has selected.
 *
 * Throws an exception:
 *   - If the user has no message selected.
 *   - If the message did not have a mapping for the given emoji.
 */
function removeEmojiRole(user_id, emoji_id) {
	let mapping = getMapping(user_id);

	if (!mapping.has(emoji_id)) {
		throw new Exception(`No role mapping found for emoji ${emoji_id}!`);
	}

	mapping.delete(emoji_id);
}

/**
 * Gets the message the given user currently has selected, or null if the user
 * has no message selected.
 */
function getSelectedMessage(user_id) {
	return selectedMessages.get(user_id);
}

/**
 * Returns the role mapped to the given emoji on the given message, or null if
 * there's no role associated with it (or if the message is unknown).
 */
function getReactRole(message_id, emoji_id) {
	if (!messageEmojiRoleMap.has(message_id)) {
		return;
	}

	let mapping = messageEmojiRoleMap.get(message_id);
	return mapping.get(emoji_id);
}

// HELPERS

// Gets the emoji role map for the message selected by the given user
function getMapping(user_id) {
	let message = selectedMessages.get(user_id);
	if (!message) {
		throw new Exception('No message selected!');
	}

	return messageEmojiRoleMap.get(message.id);
}

module.exports = {
	selectMessage,
	addEmojiRole,
	removeEmojiRole,
	getSelectedMessage,
	getReactRole
};
