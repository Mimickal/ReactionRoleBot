/*******************************************************************************
 * This file is part of No BS Role Reacts, a role-assigning Discord bot.
 * Copyright (C) 2020 Mimickal (Mia Moretti).
 *
 * No BS Role Reacts is free software under the GNU Affero General Public
 * License v3.0. See LICENSE or <https://www.gnu.org/licenses/agpl-3.0.en.html>
 * for more information.
 ******************************************************************************/
const META = 'meta';

/**
 * Creates a table for counting how many total assignments there have been.
 */
exports.up = function(knex) {
	return knex.schema.createTable(META, table => {
		table.integer('assignments');
	}).then(() => {
		// There will only ever be one row in this table so we make it here.
		return knex(META).insert({ assignments: 0 });
	});
};

exports.down = function(knex) {
	return knex.schema.dropTable(META);
};

