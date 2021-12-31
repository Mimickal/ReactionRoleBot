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
		// https://discordjs.guide/popular-topics/reactions.html#listening-for-reactions-on-old-messages
		Discord.Constants.PartialTypes.MESSAGE,
		Discord.Constants.PartialTypes.CHANNEL,
		Discord.Constants.PartialTypes.REACTION,
		Discord.Constants.PartialTypes.USER,
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
client.on(Events.MESSAGE_REACTION_ADD, events.onReactionAdd);
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
 * Single function to make error redirection easier in the future.
 * Maybe some day we'll do something more intelligent with errors.
 */
function logError(err) {
	logger.error(err);
}

