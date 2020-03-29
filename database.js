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
const knexfile = require('./knexfile');
const knex = require('knex')(knexfile[process.env.NODE_ENV || 'development']);
const lodash = require('lodash/object');

const REACTS = 'reacts';
const DISCORD_ID_LENGTH = {
	MIN: 17,
	MAX: 19
};

/**
 * Adds an emoji->role mapping for the given message. If the emoji is already
 * mapped to a role on this message, that mapping is replaced.
 *
 * This is essentially an upsert, but "upsert" is a stupid word, so "add" it is.
 */
function addRoleReact(args) {
	// TODO sanity check values
	let fields = lodash.pick(args, [
		'guild_id', 'message_id', 'emoji_id', 'role_id'
	]);

	return knex(REACTS)
		.insert(fields)
		.catch(err => {
			if (err.message.includes('UNIQUE constraint failed')) {
				return knex(REACTS)
					.where(lodash.pick(fields, ['message_id', 'emoji_id']))
					.update({ role_id: fields.role_id });
			} else {
				throw err;
			}
		});
}

/**
 * Removes an emoji->role mapping for the given message.
 */
function removeRoleReact(args) {
	// TODO sanity check values
	let fields = lodash.pick(args, ['message_id', 'emoji_id']);

	return knex(REACTS).where(fields).del();
}

/**
 * Returns the role for the given emoji on the given message, or null if there
 * is no role associated with the emoji on the message.
 */
function getRoleReact(args) {
	// TODO sanity check values
	let fields = lodash.pick(args, ['message_id', 'emoji_id']);

	return knex(REACTS)
		.first('role_id')
		.where(fields)
		.then(result => result ? result.role_id : null);
}

/**
 * Returns the emoji->role mapping for the given message as a Map object, or
 * null if the given message has no react roles set up.
 */
function getRoleReactMap(message_id) {
	return knex(REACTS)
		.select(['emoji_id', 'role_id'])
		.where('message_id', message_id)
		.then(pairArray => {
			let mapping = pairArray.reduce(
				(map, pair) => map.set(pair.emoji_id, pair.role_id),
				new Map()
			);

			return mapping.size > 0 ? mapping : null;
		});
}

/**
 * Deletes all the data stored for the given guild.
 */
function clearGuildInfo(guild_id) {
	return knex(REACTS).where('guild_id', guild_id).del();
}

module.exports = {
	DISCORD_ID_LENGTH,
	REACTS,
	addRoleReact,
	removeRoleReact,
	getRoleReact,
	getRoleReactMap,
	clearGuildInfo
};

