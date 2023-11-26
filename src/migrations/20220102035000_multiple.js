/*******************************************************************************
 * This file is part of No BS Role Reacts, a role-assigning Discord bot.
 * Copyright (C) 2020 Mimickal (Mia Moretti).
 *
 * No BS Role Reacts is free software under the GNU Affero General Public
 * License v3.0. See LICENSE or <https://www.gnu.org/licenses/agpl-3.0.en.html>
 * for more information.
 ******************************************************************************/
const REACTS = 'reacts';
const REACTS_TMP = `${REACTS}_tmp`;

const OLD_ID_MAX = 19;
const NEW_ID_MAX = 22;

/**
 * - Update the reacts table to use role_id in the primary key, so that we can
 *   support one emoji mapped to multiple roles.
 * - Increase Discord ID lengths from 19 to 22. SQLite3 doesn't enforce varchar
 *   length, so we don't NEED to do this, but we need to remake the table to
 *   modify the primary key anyway, so why not...
 *
 * SQLite3 does not support many alter table commands, so we need to create a
 * new table, copy everything over, delete the old table, then rename the new
 * table back to the original name.
 * https://www.sqlitetutorial.net/sqlite-alter-table/
 *
 * SQLite3 does not automatically reclaim the disk space consumed by the
 * duplicate table. We need the VACUUM command for this, but VACUUM also cannot
 * be used in a transaction. Knex runs all migrations in a transaction by
 * default, so we will need to disable this functionality and use our own in
 * order to VACUUM at the end.
 */
exports.config = { transaction: false };

exports.up = async function(knex) {
	await knex.transaction(async trx => {
		await trx.schema.createTable(REACTS_TMP, table => {
			table.string('guild_id',   NEW_ID_MAX);
			table.string('message_id', NEW_ID_MAX);
			table.string('emoji_id',   NEW_ID_MAX);
			table.string('role_id',    NEW_ID_MAX);

			table.primary(['message_id', 'emoji_id', 'role_id']);
		});
		await trx.insert(trx.select().from(REACTS)).into(REACTS_TMP);
		await trx.schema.dropTable(REACTS);
		await trx.schema.renameTable(REACTS_TMP, REACTS);
	});
	await knex.raw('VACUUM');
};

exports.down = async function(knex) {
	console.warn(`
		Rolling back ${REACTS} primary key change. This will delete instances
		where multiple rows have the same message_id and emoji_id values, but
		have different role_id values.
	`);

	await knex.transaction(async trx => {
		// Print and delete rows with now-duplicate primary keys.
		// SQLite3 doesn't support returning so we need this workaround.
		const ambiguous_query = trx
			.from(REACTS)
			.leftJoin(`${REACTS} as self`, join => join
				.on(   `${REACTS}.message_id`,  '=', 'self.message_id')
				.andOn(`${REACTS}.emoji_id`,    '=', 'self.emoji_id')
				.andOn(`${REACTS}.role_id`,    '!=', 'self.role_id')
			)
			.whereNotNull('self.ROWID')

		const to_delete = await ambiguous_query
			.clone()
			.distinct(`${REACTS}.role_id`)
			.select([
				`${REACTS}.guild_id`,
				`${REACTS}.message_id`,
				`${REACTS}.emoji_id`,
				`${REACTS}.role_id`,
			]);
		if (to_delete.length > 0) {
			console.warn('\nDeleting the following:');
			console.warn(to_delete.map(JSON.stringify));
		}

		await trx
			.delete()
			.from(REACTS)
			.whereIn(`${REACTS}.ROWID`, ambiguous_query
				.clone()
				.distinct(`${REACTS}.ROWID`)
			);

		// Now we can remake the table
		await trx.schema.createTable(REACTS_TMP, table => {
			table.string('guild_id',   OLD_ID_MAX);
			table.string('message_id', OLD_ID_MAX);
			table.string('emoji_id',   OLD_ID_MAX);
			table.string('role_id',    OLD_ID_MAX);

			table.primary(['message_id', 'emoji_id']);
		});
		await trx.insert(trx.select().from(REACTS)).into(REACTS_TMP);
		await trx.schema.dropTable(REACTS);
		await trx.schema.renameTable(REACTS_TMP, REACTS);
	});
	await knex.raw('VACUUM');
};

