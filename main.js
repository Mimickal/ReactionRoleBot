const fs = require('fs');

const Discord = require('discord.js');
const db = require('./database');
const events = require('./events');

const client = new Discord.Client();
const token_file = process.argv[2] || '/etc/discord/ReactionRoleBot/token';
const token = fs.readFileSync(token_file).toString().trim();

// TODO this should all be database-driven
// TODO potentially have our own caching layer for emoji->role mapping
// TODO bonus points if it makes use of discord.js' own caching scheme
let selectedMessage;
let mapping = new Map();

client.on('ready', () => console.log(`Logged in as ${client.user.tag}`));
client.on('message', onMessage);

client.login(token).catch(err => {
	logError(err);
	process.exit(1);
});

/**
 * Event handler for getting a new message.
 * Parses and delegates any role bot command.
 */
function onMessage(msg) {
	// TODO warn for ambiguity on multiple mentions
	if (!msg.mentions.has(client.user)) {
		return;
	}

	let msgParts = msg.content.split(/\s+/);
	msgParts.shift(); // Pop off mention
	let cmd = msgParts.shift();

	switch (cmd) {
		case 'select': return selectMessage(msg, msgParts); break;
		case 'role-add': return setupReactRole(msg, msgParts); break;
		default: logError('Unrecognized command ' + cmd);
	}
}

/**
 * Selects a message to associate with any subsequent role commands.
 */
function selectMessage(msg, parts) {
	// TODO handle these missing
	// TODO handle these not being an ID
	// TODO handle these not being a VALID ID
	let channelId = parts.shift();
	let messageId = parts.shift();

	client.channels.fetch(channelId)
		.then(channel => channel.messages.fetch(messageId))
		.then(message => {
			// TODO pull this out to helper?
			// TODO cache this better
			selectedMessage = message;

			if (!mapping.has(messageId)) {
				mapping.set(messageId, new Map());
			}

			return msg.reply(
				`selected message with ID \`${message.id}\` ` +
				`in channel <#${channelId}>. Link: ${message.url}`
			);
		})
		.catch(logError);
}

/**
 * Associate an emoji reaction with a role for the currently selected message.
 */
function setupReactRole(msg, parts) {
	// TODO handle custom emojis
	// TODO handle invalid emoji
	let emoji = parts.shift();

	// TODO handle raw ID in addition to mention
	// TODO handle invalid ID
	// TODO handle missing ID
	let role = extractRoleId(parts.shift());

	// TODO warn when no message is selected
	// TODO warn when using custom emojis
	mapping.get(selectedMessage.id).set(emoji, role);

	// TODO add reaction to message

	msg.reply(
		`mapped ${emoji} to <@&${role}> on message \`${selectedMessage.id}\``
	).catch(logError);
}

function extractRoleId(str) {
	// I'm aware Discord.MessageMentions.ROLES_PATTERN exists, but that has the
	// global flag set, which screws up matching groups, for whatever reason.
	return str.match(/<@&(\d{17,19})>/)[1];
}

function logError(err) {
	console.error(err);
}
