/*******************************************************************************
 * This file is part of No BS Role Reacts, a role-assigning Discord bot.
 * Copyright (C) 2020 Mimickal (Mia Moretti).
 *
 * No BS Role Reacts is free software under the GNU Affero General Public
 * License v3.0. See LICENSE or <https://www.gnu.org/licenses/agpl-3.0.en.html>
 * for more information.
 ******************************************************************************/
const config = require('./config/env');

const COMMON_CONFIG = {
	client: 'sqlite3',
	useNullAsDefault: true,
};

module.exports = {
	development: {
		...COMMON_CONFIG,
		connection: {
			filename: config.database_file,
		},
		// Helps us catch hanging transactions in dev by locking up the database
		// if we forget to commit anything.
		pool: {
			min: 1,
			max: 1,
		},
	},

	testing: {
		...COMMON_CONFIG,
		connection: {
			filename: ':memory:',
		},
	},

	prod: {
		...COMMON_CONFIG,
		connection: {
			filename: config.database_file,
		},
	},
};
