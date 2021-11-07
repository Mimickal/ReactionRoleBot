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

const META = 'meta';
const MUTEX = 'mutex';
const PERMS = 'perms';
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
 * Removes all emoji->role mappings for the given message.
 */
function removeAllRoleReacts(message_id) {
	return knex(REACTS).where('message_id', message_id).del();
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
	return Promise.all([REACTS, PERMS, MUTEX].map(table =>
		knex(table).where('guild_id', guild_id).del()
	));
}

/**
 * Increments the meta table's role assignment counter.
 */
function incrementAssignCounter(num) {
	return knex(META).increment('assignments', num || 1);
}

/**
 * Returns the following object of meta stats about the bot:
 *   - guilds: <number of guilds the bot is active in>
 *   - roles: <number of react-roles set up on the bot>
 *   - assignments: <number of times a role has been assigned>
 */
function getMetaStats() {
	return Promise.all([
		knex(REACTS).countDistinct('guild_id as count').first(),
		knex(REACTS).count().first(),
		knex(META).select('assignments').first()
	]).then(([res1, res2, res3]) => {
		return {
			guilds: res1['count'],
			roles: res2['count(*)'],
			assignments: res3.assignments
		};
	});
}

/**
 * Adds a new role that's allowed to configure this bot for the given guild.
 */
function addAllowedRole(args) {
	// TODO sanity check values
	let fields = lodash.pick(args, ['guild_id', 'role_id']);

	return knex(PERMS).insert(fields);
}

/**
 * Removes a role from being allowed to configure this bot for the given guild.
 */
function removeAllowedRole(args) {
	// TODO sanity check values
	let fields = lodash.pick(args, ['guild_id', 'role_id']);

	return knex(PERMS).where(fields).del();
}

/**
 * Returns the list of roles that can configure this bot for the given guild.
 */
function getAllowedRoles(guild_id) {
	return knex(PERMS)
		.select('role_id')
		.where({ guild_id: guild_id })
		.then(roleArray => roleArray.map(elem => elem.role_id));
}

/**
 * Creates a mutually exclusive rule for a role on the given guild and message.
 */
function addMutexRole(args) {
	// TODO sanity check values
	let fields = lodash.pick(args, ['guild_id', 'message_id', 'role_id']);

	return knex(MUTEX).insert(fields);
}

/**
 * Removes a mutex rule for a role on the given guild and message.
 */
function removeMutexRole(args) {
	// TODO sanity check values
	let fields = lodash.pick(args, ['guild_id', 'message_id', 'role_id']);

	return knex(MUTEX).where(fields).del()
}

/**
 * Returns the list of roles that are mutually exclusive for the given guild and message.
 * If no roles are mutually exclusive, an empty array is returned.
 */
function getMutexRoles(args) {
	// TODO sanity check values
	let fields = lodash.pick(args, ['guild_id', 'message_id'])

	// Roles could be added in either order, so fetch with both orders and
	// combine the results.
	return knex(MUTEX).select('role_id')
	.where({
		guild_id: fields.guild_id,
		message_id: fields.message_id
	})
	.then(result => [
		...result.map(row => row.role_id),
	]);
}

/**
 * Takes a list of roles and returns the list of emojis associated with them.
 * This is mostly so we can remove reacts in bulk.
 * XXX: It might make sense to return this as key-value pairs in the future,
 * instead of just an array.
 */
function getMutexEmojis(roles) {
	return knex(REACTS)
		.select('emoji_id')
		.whereIn('role_id', roles)
		.then(res => res.map(elem => elem.emoji_id));
}

module.exports = {
	DISCORD_ID_LENGTH,
	META,
	MUTEX,
	PERMS,
	REACTS,
	addRoleReact,
	removeRoleReact,
	removeAllRoleReacts,
	getRoleReact,
	getRoleReactMap,
	clearGuildInfo,
	incrementAssignCounter,
	getMetaStats,
	addAllowedRole,
	removeAllowedRole,
	getAllowedRoles,
	addMutexRole,
	removeMutexRole,
	getMutexRoles,
	getMutexEmojis
};

