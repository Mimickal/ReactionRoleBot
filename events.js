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
const database = require('./database');
const logger = require('./logger');
const { stringify } = require('./util');

/**
 * Event handler for when the bot leaves (or is kicked from) a guild.
 * Deletes all data associated with that guild.
 */
async function onGuildLeave(guild) {
	try {
		await database.clearGuildInfo(guild.id)
		logger.info(`Left ${stringify(guild)}, deleted all related data`);
	} catch (err) {
		logger.error(`Left ${stringify(guild)} but failed to delete data!`, err);
	}
}

/**
 * Event handler for when the bot is logged in.
 * Just prints the bot user we logged in as.
 */
function onReady(client) {
	logger.info(`Logged in as ${client.user.tag} (${client.user.id})`);
}

module.exports = {
	onGuildLeave,
	onReady,
};

