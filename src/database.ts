/*******************************************************************************
 * This file is part of No BS Role Reacts, a role-assigning Discord bot.
 * Copyright (C) 2020 Mimickal (Mia Moretti).
 *
 * No BS Role Reacts is free software under the GNU Affero General Public
 * License v3.0. See LICENSE or <https://www.gnu.org/licenses/agpl-3.0.en.html>
 * for more information.
 ******************************************************************************/
const knexfile = require('./knexfile');
import setupKnex, { Knex } from 'knex';
const knex = setupKnex(knexfile[process.env.NODE_ENV || 'development']);

import lodash from 'lodash';
import { GlobalLogger, stringify } from '@mimickal/discord-logging';
import MultiMap from 'multimap';

import { isDiscordId, isEmojiStr } from './util';
import { Snowflake } from 'discord.js';

const logger = GlobalLogger.logger;

enum Table {
	Meta = 'meta',
	Mutex = 'mutex',
	Perms = 'perms',
	Reacts = 'reacts',
}

enum Assert {
	DiscordId,
	Emoji,
}


/** Asserts the value is a valid Discord ID. {@link key} modifies the error message.*/
function assertDiscordId(value: unknown, key?: string): asserts value is string {
	if (!isDiscordId(value)) {
		throw new Error(`${key ? key + ' ' : ''}Invalid Discord ID: ${value}`);
	}
}

/** Asserts the value is a valid emoji key. {@link key} modifies the error message. */
function assertEmojiKey(value: unknown, key?: string): asserts value is string {
	if (!isDiscordId(value) && !isEmojiStr(value)) {
		throw new Error(`${key ? key + ' ' : ''}Invalid Emoji key: ${value}`);
	}
}

/** Asserts all the fields of {@link args} are present and the right type. */
function assertFields<T extends Record<string, any>>(
	args: T,
	asserts: Record<keyof T, Assert>,
): asserts args is T {
	Object.keys(asserts).forEach((key) => {
		const value = args[key];
		const type = asserts[key];

		switch (type) {
			case Assert.DiscordId: assertDiscordId(value, key); break;
			case Assert.Emoji: assertEmojiKey(value, key); break;
			default: throw new Error(`Unrecognized assert: ${type}`);
		}
	});
}

/**
 * Constrain an object's values to a type at runtime.
 * Logs a warning for extra arguments.
 */
function pickFields<T extends object, U extends keyof T>(
	args: T, keys: U[]
): Pick<T, U> {
	const args_we_need = lodash.pick(args, keys);

	if (!lodash.isEqual(args, args_we_need)) {
		const extras = lodash.omit(args, keys);
		logger.warn(`Extra database query arguments: ${stringify(extras)}`);
	}

	return args_we_need;
}

/**
 * Helper asserting database arguments look the way we want them to.
 *
 * SQLite3 has pretty lax enforcement of its constraints, so we need to do a
 * little extra work to ensure we're not putting garbage in the database.
 *
 * Also, since we want to constrain arguments everywhere we would assert on
 * them, just do the argument selection here too.
 */
function pickAndAssertFields<
	T extends Record<string, any>,
	U extends keyof T,
>(
	args: T,
	asserts: Record<keyof T, Assert>,
): Pick<T, U> {
	assertFields(args, asserts);
	return pickFields(args, Object.keys(asserts) as U[]);
}

/**
 * A pass-through for knex.transaction(...) that suppresses errors we have
 * already handled.
 *
 * Knex always returns a rejected promise from a rolled back transaction, and
 * rolls back transactions when errors are thrown from the transaction
 * block. This means even if we catch and handle an error within the
 * transaction, it will still be thrown when we roll back the transaction.
 *
 * Our workaround hack is to rethrow our handled errors wrapped in
 * {@link HandledError}, so that the transaction still rolls back without us
 * needing to handle the error a second time.
 */
export async function transaction<T>(
	trxScope: (trx: Knex.Transaction) => Promise<T> | void
): Promise<T | undefined> {
	try {
		return await knex.transaction(trxScope);
	} catch (err) {
		if (err instanceof HandledError) {
			logger.debug('Suppressing handled error within transaction');
		} else {
			throw new Error(
				'Rethrowing unhandled error within transaction',
				{ cause: err },
			);
		}
	}
}

/**
 * Wraps an {@link Error} to abort a transaction without the exception
 * bubbling up. See {@link transaction}.
 */
export class HandledError extends Error {
	constructor(cause: Error) {
		super('Wrapped to abort transaction', { cause });
	}
}

/** Type-safe way to optionally start a query with a transaction. */
function maybeTrx<
	TRecord extends {},
	TResult extends {} = TRecord[],
>(
	table: Table,
	trx?: Knex.Transaction<TRecord, TResult>,
): Knex.QueryBuilder<TRecord, TResult> {
	return trx
		? trx<TRecord, TResult>(table)
		: knex<TRecord, TResult>(table);
}

interface RoleReact {
	guild_id: Snowflake;
	message_id: Snowflake;
	emoji_id: string;
	role_id: Snowflake;
}

interface Meta {
	assignments: number;
}

interface MetaStats {
	assignments: number;
	guilds: number;
	mappings: number;
}

interface Permission {
	guild_id: Snowflake;
	role_id: Snowflake;
}

interface MutexRole {
	guild_id: Snowflake;
	role_id_1: Snowflake;
	role_id_2: Snowflake;
}

/**
 * Adds an emoji->role mapping for the given message. If the emoji is already
 * mapped to a role on this message, that mapping is replaced.
 *
 * This is essentially an upsert, but "upsert" is a stupid word, so "add" it is.
 */
export async function addRoleReact(
	args: RoleReact,
	trx?: Knex.Transaction,
): Promise<void> {
	const fields = pickAndAssertFields(args, {
		guild_id:   Assert.DiscordId,
		message_id: Assert.DiscordId,
		emoji_id:   Assert.Emoji,
		role_id:    Assert.DiscordId,
	});

	try {
		await maybeTrx<RoleReact>(Table.Reacts, trx).insert(fields);
	} catch (err) {
		if ((err as Error).message.includes('UNIQUE constraint failed')) {
			await maybeTrx<RoleReact>(Table.Reacts)
				.where(lodash.pick(fields, ['message_id', 'emoji_id', 'role_id']))
				.update({ role_id: fields.role_id });
		} else {
			throw new Error('Rethrowing', { cause: err });
		}
	}
}

/**
 * Removes an emoji->role mapping for the given message.
 * At least one of emoji_id or role_id must be provided. Mappings will be
 * removed based on the data provided (e.g. if an emoji is provided, all
 * mappings for that emoji are removed).
 */
export async function removeRoleReact(
	args: Pick<RoleReact, 'message_id'> & Partial<RoleReact>,
	trx?: Knex.Transaction
): Promise<number> {
	const fields: Partial<RoleReact> = {};

	assertDiscordId(args.message_id);
	fields.message_id = args.message_id;

	if (!args.emoji_id && !args.role_id) {
		throw new Error('Need one of emoji_id or role_id');
	}

	if (args.emoji_id) {
		assertEmojiKey(args.emoji_id);
		fields.emoji_id = args.emoji_id;
	}

	if (args.role_id) {
		assertDiscordId(args.role_id);
		fields.role_id = args.role_id;
	}

	return await maybeTrx<RoleReact>(Table.Reacts, trx)
		.where(fields)
		.del();
}

/** Removes all emoji->role mappings for the given message. */
export async function removeAllRoleReacts(
	message_id: Snowflake,
	trx?: Knex.Transaction,
): Promise<number> {
	assertDiscordId(message_id);

	return await maybeTrx<RoleReact>(Table.Reacts, trx)
		.where('message_id', message_id)
		.del();
}

/** Returns the roles as an Array for the given emoji on the given message. */
export async function getRoleReacts(
	args: Pick<RoleReact, 'message_id' | 'emoji_id'>
): Promise<Snowflake[]> {
	const fields = pickAndAssertFields(args, {
		message_id: Assert.DiscordId,
		emoji_id:   Assert.Emoji,
	});

	const rows = await knex<RoleReact>(Table.Reacts)
		.select('role_id')
		.where(fields);
	return rows.map(row => row.role_id);
}

/** Returns the emoji->role mapping for the given message as a MultiMap. */
export async function getRoleReactMap(
	message_id: Snowflake,
	trx?: Knex.Transaction,
): Promise<MultiMap<string, Snowflake>> {
	assertDiscordId(message_id);

	const rows = await maybeTrx<RoleReact>(Table.Reacts, trx)
		.select('emoji_id', 'role_id')
		.where('message_id', message_id);

	return new MultiMap(
		rows.map( ({ emoji_id, role_id }) => [emoji_id, role_id] )
	);
}

/** Returns whether the given message has any role react mappings on it. */
export async function isRoleReactMessage(message_id: Snowflake): Promise<boolean> {
	assertDiscordId(message_id);

	const row = await knex<RoleReact>(Table.Reacts)
		.select('message_id')
		.where('message_id', message_id)
		.first();
	return !!row;
}

/**
 * Returns a list of IDs of messages with role react mappings on them
 * for the given guild.
 */
export async function getRoleReactMessages(guild_id: Snowflake): Promise<Snowflake[]> {
	assertDiscordId(guild_id);

	const rows = await knex<RoleReact>(Table.Reacts)
		.distinct('message_id')
		.where('guild_id', guild_id);
	return rows.map(row => row.message_id);
}

/** Deletes all the data stored for the given guild. */
export async function clearGuildInfo(guild_id: Snowflake): Promise<void> {
	assertDiscordId(guild_id);

	await Promise.all(
		[Table.Reacts, Table.Perms, Table.Mutex].map(table => (
			knex<{ guild_id: Snowflake }>(table)
				.where('guild_id', guild_id)
				.del()
		))
	);
}

/** Increments the meta table's role assignment counter. */
export async function incrementAssignCounter(num?: number): Promise<void> {
	await knex<Meta>(Table.Meta)
		.increment('assignments', num ?? 1);
}

/**
 * Returns the following object of meta stats about the bot:
 *   - guilds: <number of guilds the bot is active in>
 *   - roles: <number of react-roles set up on the bot>
 *   - assignments: <number of times a role has been assigned>
 */
export async function getMetaStats(): Promise<MetaStats> {
	const guilds = ((await knex<RoleReact>(Table.Reacts)
		.countDistinct('guild_id', { as: 'guilds' })
		.first())
		?.guilds ?? 0) as number;

	const mappings = ((await knex<RoleReact>(Table.Reacts)
		.count('*', { as: 'mappings' })
		.first())
		?.mappings ?? 0) as number;

	const assignments = (await knex<Meta>(Table.Meta)
		.select('assignments')
		.first())
		?.assignments ?? 0;

	return {
		assignments,
		guilds,
		mappings,
	};
}

/** Adds a new role that's allowed to configure this bot for the given guild. */
export async function addAllowedRole(args: Permission): Promise<void> {
	const fields = pickAndAssertFields(args, {
		guild_id: Assert.DiscordId,
		role_id:  Assert.DiscordId,
	});

	await knex<Permission>(Table.Perms).insert(fields);
}

/**
 * Removes a role from being allowed to configure this bot for the given guild.
 */
export async function removeAllowedRole(args: Permission): Promise<number> {
	const fields = pickAndAssertFields(args, {
		guild_id: Assert.DiscordId,
		role_id:  Assert.DiscordId,
	});

	return knex<Permission>(Table.Perms)
		.where(fields)
		.del();
}

/**
 * Returns the list of roles that can configure this bot for the given guild.
 */
export async function getAllowedRoles(guild_id: Snowflake): Promise<Snowflake[]> {
	assertDiscordId(guild_id);

	const rows = await knex<Permission>(Table.Perms)
		.select('role_id')
		.where('guild_id', guild_id);
	return rows.map(row => row.role_id);
}

/**
 * Creates a mutually exclusive rule for two roles in the given guild.
 * role_id_1 and role_id_2 are interchangable, so if there's already a record
 * for roleA and roleB, attempting to add a record for roleB and roleA will
 * throw a unique constraint violation exception.
 */
export async function addMutexRole(args: MutexRole) {
	const fields = pickAndAssertFields(args, {
		guild_id:  Assert.DiscordId,
		role_id_1: Assert.DiscordId,
		role_id_2: Assert.DiscordId,
	});

	// Need to try role 1 and role 2 in reverse order too
	const flipped = lodash.pick<MutexRole>(args, ['guild_id']);
	flipped.role_id_1 = fields.role_id_2;
	flipped.role_id_2 = fields.role_id_1;

	const row = await knex<MutexRole>(Table.Mutex)
		.first()
		.where(fields);

	// If record exists, insert it again to cause a unique constraint exception.
	// If not, try to insert the fields in reverse order
	// (which will also cause a unique constraint if it exists).
	const toInsert = row ? fields : flipped;
	await knex<MutexRole>(Table.Mutex).insert(toInsert);
}

/**
 * Removes the mutually exclusive rule for the two roles in the given guild.
 * role_id_1 and role_id_2 are interchangable here the same way they are in
 * addMutexRole.
 */
export async function removeMutexRole(args: MutexRole) {
	const fields = pickAndAssertFields(args, {
		guild_id:  Assert.DiscordId,
		role_id_1: Assert.DiscordId,
		role_id_2: Assert.DiscordId,
	});
	const flipped = lodash.pick<MutexRole>(fields, ['guild_id']);
	flipped.role_id_1 = fields.role_id_2;
	flipped.role_id_2 = fields.role_id_1;

	// We can just try to delete with roles in both orders.
	const [count1, count2] = await Promise.all([
		knex<MutexRole>(Table.Mutex).where(fields).del(),
		knex<MutexRole>(Table.Mutex).where(flipped).del(),
	]);
	return (count1 || 0) + (count2 || 0);
}

/**
 * Returns the list of roles that are mutually exclusive with the given role,
 * for the given guild. If no roles are mutually exclusive, an empty array is
 * returned.
 */
export async function getMutexRoles(
	args: Pick<MutexRole, 'guild_id'> & { role_id: Snowflake },
	trx?: Knex.Transaction,
): Promise<Snowflake[]> {
	// FIXME role_id should be unique so we don't need guild_id, yeah?
	// We should be able to just take a role or array of roles
	const fields = pickAndAssertFields(args, {
		guild_id: Assert.DiscordId,
		role_id:  Assert.DiscordId,
	});

	// Roles could be added in either order, so fetch with both orders and
	// combine the results.
	const builder = maybeTrx<MutexRole>(Table.Mutex, trx);
	const [rows1, rows2] = await Promise.all([
		builder.select('role_id_1').where({
			guild_id:  fields.guild_id,
			role_id_2: fields.role_id,
		}),
		builder.select('role_id_2').where({
			guild_id:  fields.guild_id,
			role_id_1: fields.role_id,
		}),
	]);
	return [
		...rows1.map(row => row.role_id_1),
		...rows2.map(row => row.role_id_2),
	];
}

/**
 * Takes a list of roles and returns the list of emojis associated with them.
 * This is mostly so we can remove reacts in bulk.
 * TODO: It might make sense to return this as key-value pairs in the future,
 * instead of just an array.
 */
export async function getMutexEmojis(roles: Snowflake[]): Promise<string[]> {
	if (!Array.isArray(roles)) {
		throw Error('roles must be an Array of Discord IDs');
	}
	roles.forEach(role => assertDiscordId(role));

	const rows = await knex<RoleReact>(Table.Reacts)
		.select('emoji_id')
		.whereIn('role_id', roles);
	return rows.map(row => row.emoji_id);
}
