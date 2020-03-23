const fs = require('fs');

const Discord = require('discord.js');
const db = require('./database');
const events = require('./events');

const client = new Discord.Client();
const token_file = process.argv[2] || '/etc/discord/ReactionRoleBot/token';
const token = fs.readFileSync(token_file).toString().trim();

let selectedMessage;

client.on('ready', () => console.log(`Logged in as ${client.user.tag}`));
client.on('message', onMessage);

client.login(token).catch(err => {
	logError(err);
	process.exit(1);
});

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
		default: logError('Unrecognized command ' + cmd);
	}
}

function selectMessage(msg, parts) {
	// TODO handle these missing
	// TODO handle these not being an ID
	// TODO handle these not being a VALID ID
	let channelId = parts.shift();
	let messageId = parts.shift();

	client.channels.fetch(channelId)
		.then(channel => channel.messages.fetch(messageId))
		.then(message => {
			// TODO cache this better
			selectedMessage = message;

			return msg.reply(
				`selected message with ID \`${message.id}\` ` +
				`in channel <#${channelId}>. Link: ${message.url}`
			);
		})
		.catch(logError);
}

function logError(err) {
	console.error(err);
}
