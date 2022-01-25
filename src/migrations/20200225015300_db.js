/*******************************************************************************
 * This file is part of No BS Role Reacts, a role-assigning Discord bot.
 * Copyright (C) 2020 Mimickal (Mia Moretti).
 *
 * No BS Role Reacts is free software under the GNU Affero General Public
 * License v3.0. See LICENSE or <https://www.gnu.org/licenses/agpl-3.0.en.html>
 * for more information.
 ******************************************************************************/
const DISCORD_ID_MAX = 19;
const REACTS = 'reacts';

/**
 * Create a table mapping a reaction emoji to a role on a message in a guild.
 *
 * Using a composite primary key of message_id and emoji_id doubles as a thing
 * that prevents multiple database entries for the same react.
 */
exports.up = function(knex) {
	return knex.schema.createTable(REACTS, table => {
		table.string('guild_id',   DISCORD_ID_MAX);
		table.string('message_id', DISCORD_ID_MAX);
		table.string('emoji_id',   DISCORD_ID_MAX);
		table.string('role_id',    DISCORD_ID_MAX);

		table.primary(['message_id', 'emoji_id']);
	});
};

exports.down = function(knex) {
	return knex.schema.dropTable(REACTS);
};

