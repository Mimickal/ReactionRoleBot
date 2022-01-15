/*******************************************************************************
 * This file is part of No BS Role Reacts, a role-assigning Discord bot.
 * Copyright (C) 2020 Mimickal (Mia Moretti).
 *
 * No BS Role Reacts is free software under the GNU Affero General Public
 * License v3.0. See LICENSE or <https://www.gnu.org/licenses/agpl-3.0.en.html>
 * for more information.
 ******************************************************************************/
const DISCORD_ID_MAX = 19;
const MUTEX = 'mutex';

/**
 * Creates a table mapping two roles as mutually exclusive for a guild.
 */
exports.up = function(knex) {
	return knex.schema.createTable(MUTEX, table => {
		table.string('guild_id',  DISCORD_ID_MAX);
		table.string('role_id_1', DISCORD_ID_MAX);
		table.string('role_id_2', DISCORD_ID_MAX);

		table.primary(['guild_id', 'role_id_1', 'role_id_2']);
	});
};

exports.down = function(knex) {
	return knex.schema.dropTable(MUTEX);
};

