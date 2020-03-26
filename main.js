const fs = require('fs');

const Discord = require('discord.js');

const cache = require('./cache');
const db = require('./database');
const events = require('./events');

// Everything operates on IDs, so we can safely rely on partials.
const client = new Discord.Client({
	partials: [
		Discord.Constants.PartialTypes.MESSAGE,
		Discord.Constants.PartialTypes.CHANNEL,
		Discord.Constants.PartialTypes.REACTION
	]
});
const token_file = process.argv[2] || '/etc/discord/ReactionRoleBot/token';
const token = fs.readFileSync(token_file).toString().trim();


client.on('ready', () => console.log(`Logged in as ${client.user.tag}`));
client.on('message', onMessage);
client.on('messageReactionAdd', onReactionAdd);
client.on('messageReactionRemove', onReactionRemove);
// TODO on join check we have all the permissions we need
// TODO can we PM the person who invited the bot?


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
		case 'role-remove': return removeReactRole(msg, msgParts); break;
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
	// TODO handle giving channel ID as a mention
	let channelId = parts.shift();
	let messageId = parts.shift();

	client.channels.fetch(channelId)
		.then(channel => channel.messages.fetch(messageId))
		.then(message => {
			cache.selectMessage(msg.author.id, message);

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
	// TODO handle error this function throws
	let userId = msg.author.id;

	cache.addEmojiRole(userId, emoji, role)
		.then(() => cache.getSelectedMessage(userId))
		.then(selectedMessage => selectedMessage.react(emoji))
		.then(reaction => msg.reply(
			`mapped ${emoji} to <@&${role}> on message \`${reaction.message.id}\``
		))
		.catch(logError);
}

/**
 * Removes an emoji reaction role association from the currently selected
 * message.
 */
function removeReactRole(msg, parts) {
	// TODO handle custom emojis
	// TODO handle invalid emoji
	// TODO handle missing emoji
	let emoji = parts.shift();
	let userId = msg.author.id;

	cache.getSelectedMessage(userId)
		.then(selectedMessage => selectedMessage.cache.get(emoji).remove()
			.then(() => cache.removeEmojiRole(userId, emoji))
			.then(() => msg.reply(
				`removed ${emoji} role from message \`${selectedMessage.id}\``
			))
		)
		.catch(logError);
}

/**
 * Event handler for when a reaction is added to a message.
 * Checks if the message has any reaction roles configured, assigning a role to
 * the user who added the reaction, if applicable. Ignores reacts added by this
 * bot, of course.
 *
 * Message must be in discord.js' cache for this event to fire!
 */
function onReactionAdd(reaction, user) {
	if (user === client.user) {
		return;
	}

	cache.getReactRole(reaction.message.id, reaction.emoji.name)
		.then(roleId => {
			if (!roleId) {
				return;
			}

			// TODO ensure reaction.message is a TextChannel and not a DM or something.
			//      Need to do this so we can access guild on the message
			return reaction.message.guild.members.fetch(user.id)
				.then(member => member.roles.add(roleId, 'Role bot assignment'))
				.then(() => console.log(`added role ${roleId} to ${user}`));
		})
		.catch(logError);
}

/**
 * Event handler for when a reaction is removed from a message.
 * Checks if the message has any reaction roles configured, removing a role from
 * the user who removed their reaction, if applicable. Ignored reacts removed by
 * this bot, of course.
 *
 * Message must be in discord.js' cache for this event to fire!
 */
function onReactionRemove(reaction, user) {
	if (user === client.user) {
		return;
	}

	cache.getReactRole(reaction.message.id, reaction.emoji.name)
		.then(roleId => {
			if (!roleId) {
				return;
			}

			// TODO same as onReactionAdd, ensure this is a TextChannel
			return reaction.message.guild.members.fetch(user.id)
				.then(member => member.roles.remove(roleId, 'Role bot removal'))
				.then(() => console.log(`removed role ${roleId} from ${user}`))
		})
		.catch(logError);
}

function extractRoleId(str) {
	// I'm aware Discord.MessageMentions.ROLES_PATTERN exists, but that has the
	// global flag set, which screws up matching groups, for whatever reason.
	return str.match(/<@&(\d{17,19})>/)[1];
}

function logError(err) {
	// Single function to make error redirection easier in the future.
	// TODO handle when we don't have permission to add roles or reactions
	console.error(err);
}

// vvv  MICHELLES STUFF  vvv

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
