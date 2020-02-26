const fs = require('fs');

const wu = require('wu');
const Discord = require('discord.js');
const db = require('./database');
const events = require('./events');

const client = new Discord.Client();
const token_file = process.argv[2] || '/etc/discord/ReactionRoleBot/token';
const token = fs.readFileSync(token_file);

const CMD_PREFIX = 'rb!';

let admin_roles = [];

client.on('ready', () => console.log(`Logged in as ${client.user.tag}`));
client.on('message', onMessage);
client.on('raw', packet => {
	let type = packet['t'];
	let data = packet['d'];

	switch (type) {
		case 'MESSAGE_REACTION_ADD': onAddReaction(data); break;
		case 'MESSAGE_REACTION_REMOVE': onRemoveReaction(data); break;

	}
})

function logIssue(thing) {
	// Single function to make error redirection easier in the future.
	console.error(thing);
}

client.login(token).catch(err => {
	console.error(err);
	process.exitCode = 1;
});

function onMessage(message) {
	if (message.type !== 'DEFAULT') {
		return;
	}

	if (message.content.startsWith(CMD_PREFIX)) {
		delegateCommand(message);
	}
}

function delegateCommand(message) {
	let sender = message.member;
	if (!isAdmin(sender) || sender.user.bot) {
		return;
	}

	let input = stripCmdPrefix(message.content);
	let args = input.split(/\s+/).filter(val => {return val.length});

	let cmd = args.shift();

	switch (cmd) {
		case 'add-role-toggle': cmdAddRoleToggle(message, args); break;
	}
}

function isAdmin(member) {
	return wu(member.roles.values())
		.find(role => admin_roles.includes(role.id));
}

function stripCmdPrefix(text) {
	return text.substring(CMD_PREFIX.length);
}

async function cmdAddRoleToggle(message, args) {
	if (args.length !== 3) {
		message.channel.send(
`Command mark-message was invoked with ${args.length} arguments while it should have exactly 3.
\`add-role-toggle <message_id> <emoji> <role_id>\``)
		return;
	}

	let target_msg_id = args.shift();
	let emoji_name    = emojiIdFromStr(args.shift());
	let role_id       = args.shift();

	message.channel.messages.fetch(target_msg_id)
		.then(async target_msg => {
			console.log(emoji_name);
			await target_msg.react(emoji_name);
		}).catch(async err => {
			if (err instanceof Discord.DiscordAPIError &&
				err.message === 'Missing Access') {

				logIssue(
					`No permission to read ${channel.id} (#${channel.name})`
				);
				return;
			} else if (err instanceof Discord.DiscordAPIError) {
				await message.channel.send(`Error: ${err.message}.`);
				return;
			}
		}
	);

}

async function onAddReaction(reaction) {
	if (reaction.me) {
		return;
	}
	console.log(emojiIdFromEmoji(reaction.emoji), reaction.user_id);
}

async function onRemoveReaction(reaction) {
	if (reaction.me) {
		return;
	}
	console.log(emojiIdFromEmoji(reaction.emoji), reaction.user_id);
}

function emojiIdFromStr(emoji_name) {
	// This is so custom server emojis work. They are encoded in messages as
	// example: <:flagtg:681985787864416286>.
	// 681985787864416286 should be used in the react request though.
	let sanitized_emoji = emoji_name.match(/<:.+:(.+)>/);

	if (sanitized_emoji) return sanitized_emoji[1];

	console.log(sanitized_emoji);

	return emoji_name;
}

function emojiIdFromEmoji(emoji) {
	return emoji.id || emoji.name;
}
