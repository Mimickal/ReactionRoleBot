/*******************************************************************************
 * This file is part of No BS Role Reacts, a role-assigning Discord bot.
 * Copyright (C) 2020 Mimickal (Mia Moretti).
 *
 * No BS Role Reacts is free software under the GNU Affero General Public
 * License v3.0. See LICENSE or <https://www.gnu.org/licenses/agpl-3.0.en.html>
 * for more information.
 ******************************************************************************/
const knexfile = require('./knexfile');
const knex = require('knex')(knexfile[process.env.NODE_ENV || 'development']);
const lodash = require('lodash');
const MultiMap = require('multimap');

const logger = require('./logger');
const {
	isDiscordId,
	isEmojiStr,
	stringify,
} = require('./util');

const META = 'meta';
const MUTEX = 'mutex';
const PERMS = 'perms';
const REACTS = 'reacts';

// Poor man's enum
const DISCORD_ASSERT = 1;
const EMOJI_ASSERT = 2;

/**
 * Helper asserting database arguments look the way we want them to.
 *
 * SQLite3 has pretty lax enforcement of its constraints, so we need to do a
 * little extra work to ensure we're not putting garbage in the database.
 *
 * Also, since we want to constrain arguments everywhere we would assert on
 * them, just do the argument selection here too.
 */
function _pickAndAssertFields(args, asserts) {
	lodash.toPairs(asserts).forEach(([ key, type ]) => {
		const value = args[key];
		if (type === DISCORD_ASSERT && !isDiscordId(value)) {
			throw Error(`${key} invalid Discord ID: ${value}`);
		}
		if (type === EMOJI_ASSERT && !isDiscordId(value) && !isEmojiStr(value)) {
			throw Error(`${key} invalid Emoji key: ${value}`);
		}
	});

	const args_we_need = lodash.pick(args, lodash.keys(asserts));

	// Extra arguments shouldn't happen in normal operation, but since we pick a
	// subset of arguments anyway, just warn about them.
	if (!lodash.isEqual(args, args_we_need)) {
		const extras = lodash.omit(args, lodash.keys(asserts));
		logger.warn(`Extra database query arguments: ${stringify(extras)}`);
	}

	return args_we_need;
}

/**
 * Simple assert to ensure value is a valid Discord ID.
 */
function _assertDiscordId(value) {
	if (!isDiscordId(value)) {
		throw Error(`Invalid Discord ID: ${value}`);
	}
}

/**
 * Simple assert to ensure value is a valid Emoji string or Discord ID.
 */
function _assertEmojiKey(value) {
	if (!isDiscordId(value) && !isEmojiStr(value)) {
		throw Error(`Invalid Emoji key: ${value}`);
	}
}

/**
 * A pass-through for knex.transaction(...) that suppresses errors we have
 * already handled.
 *
 * Knex always returns a rejected promist from a rolled back transaction, and
 * rolls back transactions when Errors are thrown from the transaction
 * block.
 *
 * We don't have a great way to differentiate between database Errors and
 * Discord Errors based on their prototype. The only way is to wrap each method
 * in their own try-catch, so that makes Knex' catch-all rejection behavior
 * problematic. This is our solution.
 */
function transaction(func) {
	return knex.transaction(func).catch(err => {
		if (!err.handled) throw err;
		logger.debug('Suppressing handled error within transaction');
	});
}

/**
 * Marks an Error as "handled" then rethrows it.
 * See {@link transaction} for why this is needed.
 */
 function rethrowHandled(err) {
	if (err instanceof Error) {
		err.handled = true;
	}
	throw err;
}

/**
 * Adds an emoji->role mapping for the given message. If the emoji is already
 * mapped to a role on this message, that mapping is replaced.
 *
 * This is essentially an upsert, but "upsert" is a stupid word, so "add" it is.
 */
function addRoleReact(args, trx) {
	const fields = _pickAndAssertFields(args, {
		guild_id:   DISCORD_ASSERT,
		message_id: DISCORD_ASSERT,
		emoji_id:   EMOJI_ASSERT,
		role_id:    DISCORD_ASSERT,
	});

	return (trx ? trx(REACTS) : knex(REACTS))
		.insert(fields)
		.catch(err => {
			if (err.message.includes('UNIQUE constraint failed')) {
				return (trx ? trx(REACTS) : knex(REACTS))
					.where(lodash.pick(fields, ['message_id', 'emoji_id']))
					.update({ role_id: fields.role_id });
			} else {
				throw err;
			}
		});
}

/**
 * Removes an emoji->role mapping for the given message.
 * At least one of emoji_id or role_id must be provided. Mappings will be
 * removed based on the data provided (e.g. if an emoji is provided, all
 * mappings for that emoji are removed).
 */
function removeRoleReact(args, trx) {
	const fields = {};

	const message_id = args.message_id;
	const emoji_id   = args.emoji_id;
	const role_id    = args.role_id;

	_assertDiscordId(message_id);
	fields.message_id = message_id;

	if (!emoji_id && !role_id) {
		throw new Error('Need one of emoji_id or role_id');
	}

	if (emoji_id) {
		_assertEmojiKey(emoji_id);
		fields.emoji_id = emoji_id;
	}

	if (role_id) {
		_assertDiscordId(role_id);
		fields.role_id = role_id;
	}

	return (trx ? trx(REACTS) : knex(REACTS)).where(fields).del();
}

/**
 * Removes all emoji->role mappings for the given message.
 */
function removeAllRoleReacts(message_id, trx) {
	_assertDiscordId(message_id);
	return (trx ? trx(REACTS) : knex(REACTS)).where('message_id', message_id).del();
}

/**
 * Returns the role for the given emoji on the given message, or null if there
 * is no role associated with the emoji on the message.
 */
function getRoleReact(args) {
	const fields = _pickAndAssertFields(args, {
		message_id: DISCORD_ASSERT,
		emoji_id:   EMOJI_ASSERT,
	});

	return knex(REACTS)
		.first('role_id')
		.where(fields)
		.then(result => result ? result.role_id : null);
}

/**
 * Returns the emoji->role mapping for the given message as a MultiMap.
 */
function getRoleReactMap(message_id, trx) {
	_assertDiscordId(message_id);
	return (trx ? trx(REACTS) : knex(REACTS))
		.select(['emoji_id', 'role_id'])
		.where('message_id', message_id)
		.then(rows => new MultiMap(
			rows.map(({emoji_id, role_id}) => [emoji_id, role_id])
		));
}

/**
 * Returns whether the given message has any role react mappings on it.
 */
function isRoleReactMessage(message_id) {
	_assertDiscordId(message_id);
	return knex(REACTS)
		.select('message_id')
		.where('message_id', message_id)
		.first()
		.then(result => !!result);
}

function getRoleReactMessages(guild_id) {
	_assertDiscordId(guild_id);
	return knex(REACTS)
		.distinct('message_id')
		.where('guild_id', guild_id)
		.then(rows => rows.map(row => row.message_id));
}

/**
 * Deletes all the data stored for the given guild.
 */
function clearGuildInfo(guild_id) {
	_assertDiscordId(guild_id);
	return Promise.all([REACTS, PERMS, MUTEX].map(table =>
		knex(table).where('guild_id', guild_id).del()
	));
}

/**
 * Increments the meta table's role assignment counter.
 */
function incrementAssignCounter(num) {
	return knex(META).increment('assignments', num ?? 1);
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
	const fields = _pickAndAssertFields(args, {
		guild_id: DISCORD_ASSERT,
		role_id:  DISCORD_ASSERT,
	});

	return knex(PERMS).insert(fields);
}

/**
 * Removes a role from being allowed to configure this bot for the given guild.
 */
function removeAllowedRole(args) {
	const fields = _pickAndAssertFields(args, {
		guild_id: DISCORD_ASSERT,
		role_id:  DISCORD_ASSERT,
	});

	return knex(PERMS).where(fields).del();
}

/**
 * Returns the list of roles that can configure this bot for the given guild.
 */
function getAllowedRoles(guild_id) {
	_assertDiscordId(guild_id);
	return knex(PERMS)
		.select('role_id')
		.where({ guild_id: guild_id })
		.then(roleArray => roleArray.map(elem => elem.role_id));
}

/**
 * Creates a mutually exclusive rule for two roles in the given guild.
 * role_id_1 and role_id_2 are interchangable, so if there's already a record
 * for roleA and roleB, attempting to add a record for roleB and roleA will
 * throw a unique constraint violation exception.
 */
function addMutexRole(args) {
	const fields = _pickAndAssertFields(args, {
		guild_id:  DISCORD_ASSERT,
		role_id_1: DISCORD_ASSERT,
		role_id_2: DISCORD_ASSERT,
	});

	// Need to try role 1 and role 2 in reverse order too
	let flipped = lodash.pick(args, ['guild_id']);
	flipped.role_id_1 = fields.role_id_2;
	flipped.role_id_2 = fields.role_id_1;

	return knex(MUTEX)
		.first()
		.where(fields)
		.then(record => {
			// If record exists, insert it again to cause a unique constraint
			// exception. If not, try to insert the fields in reverse order
			// (which will also cause a unique constraint if it exists).
			let version = record ? fields : flipped;
			return knex(MUTEX).insert(version);
		});
}

/**
 * Removes the mutually exclusive rule for the two roles in the given guild.
 * role_id_1 and role_id_2 are interchangable here the same way they are in
 * addMutexRole.
 */
function removeMutexRole(args) {
	const fields = _pickAndAssertFields(args, {
		guild_id:  DISCORD_ASSERT,
		role_id_1: DISCORD_ASSERT,
		role_id_2: DISCORD_ASSERT,
	});
	const flipped = lodash.pick(fields, ['guild_id']);
	flipped.role_id_1 = fields.role_id_2;
	flipped.role_id_2 = fields.role_id_1;

	// We can just try to delete with roles in both orders.
	return Promise.all([
		knex(MUTEX).where(fields).del(),
		knex(MUTEX).where(flipped).del()
	]).then(([count1, count2]) => ((count1 ?? 0) + (count2 ?? 0)));
}

/**
 * Returns the list of roles that are mutually exclusive with the given role,
 * for the given guild. If no roles are mutually exclusive, an empty array is
 * returned.
 */
function getMutexRoles(args, trx) {
	const fields = _pickAndAssertFields(args, {
		guild_id: DISCORD_ASSERT,
		role_id:  DISCORD_ASSERT,
	});

	// Roles could be added in either order, so fetch with both orders and
	// combine the results.
	const builder = trx ? trx : knex;
	return Promise.all([
		builder(MUTEX).select('role_id_1').where({
			guild_id:  fields.guild_id,
			role_id_2: fields.role_id
		}),
		builder(MUTEX).select('role_id_2').where({
			guild_id:  fields.guild_id,
			role_id_1: fields.role_id
		})
	]).then(([res1, res2]) => [
		...res1.map(row => row.role_id_1),
		...res2.map(row => row.role_id_2)
	]);
}

/**
 * Takes a list of roles and returns the list of emojis associated with them.
 * This is mostly so we can remove reacts in bulk.
 * XXX: It might make sense to return this as key-value pairs in the future,
 * instead of just an array.
 */
function getMutexEmojis(roles) {
	if (!Array.isArray(roles)) {
		throw Error('roles must be an Array of Discord IDs');
	}
	roles.forEach(_assertDiscordId);

	return knex(REACTS)
		.select('emoji_id')
		.whereIn('role_id', roles)
		.then(res => res.map(elem => elem.emoji_id));
}

module.exports = {
	transaction,
	rethrowHandled,
	addRoleReact,
	removeRoleReact,
	removeAllRoleReacts,
	getRoleReact,
	getRoleReactMap,
	isRoleReactMessage,
	getRoleReactMessages,
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

