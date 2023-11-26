/*******************************************************************************
 * This file is part of No BS Role Reacts, a role-assigning Discord bot.
 * Copyright (C) 2020 Mimickal (Mia Moretti).
 *
 * No BS Role Reacts is free software under the GNU Affero General Public
 * License v3.0. See LICENSE or <https://www.gnu.org/licenses/agpl-3.0.en.html>
 * for more information.
 ******************************************************************************/
import * as Discord from 'discord.js';
import { createLogger, GlobalLogger, startupMsg, unindent } from '@mimickal/discord-logging';
import { existsSync } from 'fs';

import { Config, Package } from './config';

// Need to set logger before loading modules that use it.
const logger = createLogger({ filename: Config.log_file });
GlobalLogger.setGlobalLogger(logger);

import * as events from './events';

// Starting the bot without a database file will cause any query to throw
// an error, and indicates a mistake in the user's setup.
// Just save people the trouble and exit immediately.
if (!existsSync(Config.database_file) && logger) {
	logger.error(unindent(`
		Cannot find database ${Config.database_file}.
		If this is your first time running the bot, you may need to run
		the knex migration. If you already ran the migration and this path
		isn't what you expect, you may need to add "database_file" to your config file.
	`));
	process.exit(1);
}

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
			name: `Version ${Package.version}`,
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


logger.info(startupMsg(Package.version, Config));

client.login(Config.token).catch(err => {
	logger.error('Failed to log in!', err);
	process.exit(1);
});
