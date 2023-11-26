/*******************************************************************************
 * This file is part of No BS Role Reacts, a role-assigning Discord bot.
 * Copyright (C) 2020 Mimickal (Mia Moretti).
 *
 * No BS Role Reacts is free software under the GNU Affero General Public
 * License v3.0. See LICENSE or <https://www.gnu.org/licenses/agpl-3.0.en.html>
 * for more information.
 ******************************************************************************/

// Keep this in sync with the export of env.js.
// Use type instead of interface to satisfy Record<string, unknown>.
// https://github.com/microsoft/TypeScript/issues/15300
type EnvConfig = {
	app_id: string;
	database_file: string;
	enable_precache: boolean;
	guild_id?: string;
	log_file: string;
	token: string;
}

// Keep this in sync with package.json
interface PackConfig {
	description: string;
	homepage: string;
	version: string;
}

// Knex cannot load config from TypeScript, so we leave the environment config
// as JavaScript and add type information in this file.
export const Config: EnvConfig = require('./env');

// Add some type information to the fields we care about from package.json
const PACKAGE_JSON = require('../../package.json');
export const Package: PackConfig = {
	description: PACKAGE_JSON.description,
	homepage: PACKAGE_JSON.homepage,
	version: PACKAGE_JSON.version,
};
