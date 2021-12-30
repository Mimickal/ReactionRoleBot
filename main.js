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
const fs = require('fs');

const Discord = require('discord.js');

const cache = require('./cache');
const database = require('./database');
const events = require('./events');
const logger = require('./logger');
const { unindent } = require('./util');

const CONFIG = JSON.parse(fs.readFileSync(
	process.argv[2] || '/etc/discord/ReactionRoleBot/config.json'
));
const PACKAGE = require('./package.json');

// Everything operates on IDs, so we can safely rely on partials.
// This allows reaction events to fire for uncached messages.
const client = new Discord.Client({
	intents: [
		Discord.Intents.FLAGS.GUILDS,
		Discord.Intents.FLAGS.GUILD_MEMBERS,
		Discord.Intents.FLAGS.GUILD_EMOJIS_AND_STICKERS,
		Discord.Intents.FLAGS.GUILD_MESSAGES,
		Discord.Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
	],
	partials: [
		Discord.Constants.PartialTypes.MESSAGE,
		Discord.Constants.PartialTypes.CHANNEL,
		Discord.Constants.PartialTypes.REACTION
	],
	presence: {
		activities: [{
			name: `Version ${PACKAGE.version}`,
			type: Discord.Constants.ActivityTypes.PLAYING,
		}],
	},
});

const Events = Discord.Constants.Events;
client.on(Events.CLIENT_READY, events.onReady);
client.on(Events.GUILD_CREATE, onGuildJoin);
client.on(Events.GUILD_DELETE, events.onGuildLeave);
client.on(Events.INTERACTION_CREATE, events.onInteraction);
client.on(Events.MESSAGE_REACTION_ADD, onReactionAdd);
client.on(Events.MESSAGE_REACTION_REMOVE, events.onReactionRemove);


client.login(CONFIG.token).catch(err => {
	logger.error('Failed to log in!', err);
	process.exit(1);
});

/**
 * Event handler for when the bot joins a new guild.
 */
function onGuildJoin(guild) {
	let info = unindent(`Hi there! My role needs to be ordered above any
		role you would like me to assign. You're getting this message
		because you are the server owner, but anybody with Administrator
		permissions or an allowed role can configure me.`);

	guild.members.fetch(client.user.id)
		.then(clientMember => {
			const Perms = Discord.Permissions.FLAGS;
			const requiredPermMap = {
				[Perms.ADD_REACTIONS]: 'Add Reactions',
				[Perms.MANAGE_MESSAGES]: 'Manage Messages',
				[Perms.MANAGE_ROLES]: 'Manage Roles',
				[Perms.READ_MESSAGE_HISTORY]: 'Read Message History',
				[Perms.USE_EXTERNAL_EMOJIS]: 'Use External Emojis',
				[Perms.VIEW_CHANNEL]: 'Read Text Channels & See Voice Channels'
			};

			// This bot probably shouldn't be given the admin permission, but if
			// we have it then the other ones don't matter.
			// Also, these permissions can also be inherited from the server's
			// @everyone permissions.
			let missingPermNames = Object.entries(requiredPermMap)
				.filter(([perm, name]) => !clientMember.hasPermission(
					parseInt(perm),
					{ checkAdmin: true }
				))
				.map(([perm, name]) => name);

			if (missingPermNames.length > 0) {
				info += '\n\n' + unindent(`Also, I am missing the following
					permissions. Without them, I probably won't work right:`) +
					'\n' + missingPermNames.join('\n');
			}

			return guild.members.fetch(guild.ownerID);
		})
		.then(owner => owner.createDM())
		.then(dmChannel => dmChannel.send(info))
		.catch(logError);
}



/**
 * Event handler for when a reaction is added to a message.
 * Checks if the message has any reaction roles configured, assigning a role to
 * the user who added the reaction, if applicable. Ignores reacts added by this
 * bot, of course. If a user attempts to assign a role that is mutually
 * exclusive with a role they already have, they will lose that first role, and
 * their reaction to the message for that role will be removed.
 */
function onReactionAdd(reaction, user) {
	if (user === client.user) {
		return;
	}

	let emoji = emojiIdFromEmoji(reaction.emoji);

	cache.getReactRole(reaction.message.id, emoji)
		.then(roleId => {
			if (!roleId) {
				return;
			}

			// TODO if ever there was a time for async-await, this is it.
			// TODO Also this seems to hit Discord's rate limit almost
			// immediately because of each mutex react removal being its own
			// request. Might need to look into .set
			return Promise.all([
				reaction.message.guild.members.fetch(user.id),
				database.getMutexRoles({
					guild_id: reaction.message.guild.id,
					role_id:  roleId
				})
			])
			.then(([member, mutexRoles]) =>
				member.roles.remove(mutexRoles, 'Role bot removal (mutex)')
				.then(() => member.roles.add(roleId, 'Role bot assignment'))
				.then(() => database.getMutexEmojis(mutexRoles))
				.then(mutexEmojis =>
					asyncForEach(mutexEmojis, function(emoji) {
						let mesRec = reaction.message.reactions.resolve(emoji);
						if (mesRec) return mesRec.users.remove(user);
					})
				)
			)
			.then(() => database.incrementAssignCounter())
			.then(() => logger.info(`added role ${roleId} to ${user}`));
		})
		.catch(logError);
}

/**
 * Takes an array of items and a function that may return a promise, then runs
 * the promise function for each item in the array, in sequence. Returns a
 * promise that resolves once every element has been processed.
 * Does not return the results because we don't need them.
 */
async function asyncForEach(arr, promiseFunc) {
	for await (let elem of arr) {
		promiseFunc(elem);
	}
}

/**
 * Built-in emojis are identified by name. Custom emojis are identified by ID.
 * This function handles that nuance for us.
 */
function emojiIdFromEmoji(emoji) {
	return emoji.id || emoji.name;
}

/**
 * Single function to make error redirection easier in the future.
 * Maybe some day we'll do something more intelligent with errors.
 */
function logError(err) {
	logger.error(err);
}

