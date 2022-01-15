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

const events = require('./src/events');
const logger = require('./src/logger');

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
client.on(Events.GUILD_CREATE, events.onGuildJoin);
client.on(Events.GUILD_DELETE, events.onGuildLeave);
client.on(Events.INTERACTION_CREATE, events.onInteraction);
client.on(Events.MESSAGE_BULK_DELETE, events.onMessageBulkDelete);
client.on(Events.MESSAGE_DELETE, events.onMessageDelete);
client.on(Events.MESSAGE_REACTION_ADD, events.onReactionAdd);
client.on(Events.MESSAGE_REACTION_REMOVE, events.onReactionRemove);


client.login(CONFIG.token).catch(err => {
	logger.error('Failed to log in!', err);
	process.exit(1);
});

