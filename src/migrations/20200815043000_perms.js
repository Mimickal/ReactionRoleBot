/*******************************************************************************
 * This file is part of No BS Role Reacts, a role-assigning Discord bot.
 * Copyright (C) 2020 Mimickal (Mia Moretti).
 *
 * No BS Role Reacts is free software under the GNU Affero General Public
 * License v3.0. See LICENSE or <https://www.gnu.org/licenses/agpl-3.0.en.html>
 * for more information.
 ******************************************************************************/
const DISCORD_ID_MAX = 19;
const PERMS = 'perms';

/**
 * Creates a table that maps a role to a guild, so that role can be allowed to
 * configure the bot in the guild.
 */
exports.up = function(knex) {
	return knex.schema.createTable(PERMS, table => {
		table.string('guild_id', DISCORD_ID_MAX);
		table.string('role_id',  DISCORD_ID_MAX);

		table.primary(['guild_id', 'role_id']);
	});
};

exports.down = function(knex) {
	return knex.schema.dropTable(PERMS);
};

