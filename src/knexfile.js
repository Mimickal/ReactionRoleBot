/*******************************************************************************
 * This file is part of No BS Role Reacts, a role-assigning Discord bot.
 * Copyright (C) 2020 Mimickal (Mia Moretti).
 *
 * No BS Role Reacts is free software under the GNU Affero General Public
 * License v3.0. See LICENSE or <https://www.gnu.org/licenses/agpl-3.0.en.html>
 * for more information.
 ******************************************************************************/
const path = require('path');

const config = require('./config');

module.exports = {
	development: {
		client: 'sqlite3',
		useNullAsDefault: true,
		connection: {
			filename: config.database_file || path.join(__dirname, '..', 'dev.sqlite3'),
		},
		// Helps us catch hanging transactions in dev by locking up the database
		// if we forget to commit anything.
		pool: {
			min: 1,
			max: 1,
		},
	},

	testing: {
		client: 'sqlite3',
		useNullAsDefault: true,
		connection: {
			filename: ':memory:'
		}
	},

	prod: {
		client: 'sqlite3',
		useNullAsDefault: true,
		connection: {
			filename: config.database_file || '/srv/discord/rolebot.sqlite3',
		}
	}
};

