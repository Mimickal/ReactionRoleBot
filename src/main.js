/*******************************************************************************
 * This file is part of No BS Role Reacts, a role-assigning Discord bot.
 * Copyright (C) 2020 Mimickal (Mia Moretti).
 *
 * No BS Role Reacts is free software under the GNU Affero General Public
 * License v3.0. See LICENSE or <https://www.gnu.org/licenses/agpl-3.0.en.html>
 * for more information.
 ******************************************************************************/
const fs = require('fs');

const Discord = require('discord.js');

const events = require('./events');
const logger = require('./logger');

const CONFIG = JSON.parse(fs.readFileSync(
	process.argv[2] || '/etc/discord/ReactionRoleBot/config.json'
));
const PACKAGE = require('../package.json');

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

