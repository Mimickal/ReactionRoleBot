/*******************************************************************************
 * This file is part of No BS Role Reacts, a role-assigning Discord bot.
 * Copyright (C) 2020 Mimickal (Mia Moretti).
 *
 * No BS Role Reacts is free software under the GNU Affero General Public
 * License v3.0. See LICENSE or <https://www.gnu.org/licenses/agpl-3.0.en.html>
 * for more information.
 ******************************************************************************/
const REACTS = 'reacts';
const EMOJI_ID = 'emoji_id';

/**
 * Animated emojis did not exist when this bot was first written. When Discord
 * added them, the bot did not recognize their format, so it dumped the entire
 * "toString" value to the database.
 *
 * That logic has since been fixed. This migration correspondingly fixes any
 * broken animated emoji entries already in the database.
 */
exports.up = function(knex) {
	console.warn(
		'Warning: this is a one-way migration. Animated emoji names cannot ' +
		'be restored and will remain as IDs'
	);

	return knex(REACTS)
		.select(EMOJI_ID)
		.where(EMOJI_ID, 'like', '<a:%')
		.then(rows => Promise.all(
			rows.map(row => knex(REACTS)
				.where({  [EMOJI_ID]: row[EMOJI_ID] })
				.update({ [EMOJI_ID]: row[EMOJI_ID].match(/<a?:.+:(\d{17,21})>/)[1] })
			)
		));
};

exports.down = function(knex) {
	console.error('Cannot restore original animated emoji names');
};

