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

