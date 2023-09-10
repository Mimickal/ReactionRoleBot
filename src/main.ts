/*******************************************************************************
 * This file is part of No BS Role Reacts, a role-assigning Discord bot.
 * Copyright (C) 2020 Mimickal (Mia Moretti).
 *
 * No BS Role Reacts is free software under the GNU Affero General Public
 * License v3.0. See LICENSE or <https://www.gnu.org/licenses/agpl-3.0.en.html>
 * for more information.
 ******************************************************************************/
import * as Discord from 'discord.js';
import { createLogger, GlobalLogger, startupMsg } from '@mimickal/discord-logging';

const config = require('./config');

// Need to set logger before loading modules that use it.
const logger = createLogger({ filename: config.log_file });
GlobalLogger.setGlobalLogger(logger);

import * as events from './events';

const PACKAGE = require('../package.json');

// Everything operates on IDs, so we can safely rely on partials.
// This allows reaction events to fire for uncached messages.
const client = new Discord.Client({
	intents: [
		Discord.GatewayIntentBits.Guilds,
		Discord.GatewayIntentBits.GuildEmojisAndStickers,
		Discord.GatewayIntentBits.GuildMembers,
		Discord.GatewayIntentBits.GuildMessages,
		Discord.GatewayIntentBits.GuildMessageReactions,
	],
	partials: [
		// https://discordjs.guide/popular-topics/reactions.html#listening-for-reactions-on-old-messages
		Discord.Partials.GuildMember,
		Discord.Partials.Message,
		Discord.Partials.Channel,
		Discord.Partials.Reaction,
		Discord.Partials.User,
	],
	presence: {
		activities: [{
			name: `Version ${PACKAGE.version}`,
			type: Discord.ActivityType.Playing,
		}],
	},
});

client.on(Discord.Events.ClientReady, events.onReady);
client.on(Discord.Events.GuildCreate, events.onGuildJoin);
client.on(Discord.Events.GuildDelete, events.onGuildLeave);
client.on(Discord.Events.GuildMemberUpdate, events.onGuildMemberUpdate);
client.on(Discord.Events.InteractionCreate, events.onInteraction);
client.on(Discord.Events.MessageBulkDelete, events.onMessageBulkDelete);
client.on(Discord.Events.MessageDelete, events.onMessageDelete);
client.on(Discord.Events.MessageReactionAdd, events.onReactionAdd);
client.on(Discord.Events.MessageReactionRemove, events.onReactionRemove);


logger.info(startupMsg(PACKAGE.version, config));

client.login(config.token).catch(err => {
	logger.error('Failed to log in!', err);
	process.exit(1);
});
