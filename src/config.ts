/*******************************************************************************
 * This file is part of No BS Role Reacts, a role-assigning Discord bot.
 * Copyright (C) 2020 Mimickal (Mia Moretti).
 *
 * No BS Role Reacts is free software under the GNU Affero General Public
 * License v3.0. See LICENSE or <https://www.gnu.org/licenses/agpl-3.0.en.html>
 * for more information.
 ******************************************************************************/
import { readFileSync } from 'fs';
import { join } from 'path';

import { Snowflake } from 'discord.js';
import minimist from 'minimist';

///////////////////////////////
// Environment configuration
///////////////////////////////

// https://github.com/microsoft/TypeScript/issues/15300
type EnvConfig = {
	app: Snowflake;
	token: string;
	database_file?: string;
	enable_precache?: boolean;
	guild?: Snowflake;
	log_file?: string;
}

const REQUIRED_KEYS: Array<keyof EnvConfig> = ['app', 'token'];
const OPTIONAL_KEYS: Array<keyof EnvConfig> = [
	'database_file', 'enable_precache', 'guild', 'log_file'
];
const ALL_KEYS = [...REQUIRED_KEYS, ...OPTIONAL_KEYS];

const CONFIG_TEMPLATE: Pick<EnvConfig, 'app'|'token'> = {
	app: '<Your Discord bot application ID>',
	token: '<Your Discord bot token>',
};

// This looks pretty jank, but really all we're doing here is trying to have
// sensible default config file locations.
// This isn't perfect, but it covers most use cases, including default dev and prod.
// Also, this is copy+pasted in knexfile.js
const DEFAULT_CONFIG_LOCATION = process.env.NODE_ENV === 'prod'
	? '/etc/discord/ReactionRoleBot/config.json'
	: join(__dirname, '..', 'dev-config.json');
const argv = minimist(process.argv.slice(2));
const conf_override = argv._.find(arg => arg.endsWith('json'));
let location = conf_override || DEFAULT_CONFIG_LOCATION;

// Load config from file, creating a new template config file if not found.
let loadedConfig: EnvConfig;
try {
	loadedConfig = JSON.parse(readFileSync(location).toString());
} catch (err) {
	console.error(`Failed to read config file at ${location}`);
	if ((err as Error).message.includes('no such file or directory')) {
		console.error(
			'You can create the file there, or pass it in as a command ' +
			'line argument.\n' +
			'Example: npm run <command> <path/to/your/config.json>\n\n' +
			'If this if your first time running the bot, your config file ' +
			'must be a JSON file containing at least these fields:\n' +
			JSON.stringify(CONFIG_TEMPLATE, null, 2) + '\n\n'
		);
	}
	console.error("Here's the full error:");
	console.error(err);
	process.exit(1);
}

// Verify we have all required keys, and warn for extra keys.
REQUIRED_KEYS.forEach(key => {
	if (loadedConfig[key] == null)
		throw new Error(`Missing required config key "${key}"`);
});
const extraKeys = Object.keys(loadedConfig).filter(key => (
	!ALL_KEYS.includes(key as keyof EnvConfig)
));
if (extraKeys.length > 0)
	console.warn('Extra config keys given:', extraKeys);

export const Config: EnvConfig = Object.seal(loadedConfig);

///////////////////////////////
// package.json configuration
///////////////////////////////

// Add some type information to the fields we care about from package.json
interface PackConfig {
	description: string;
	homepage: string;
	version: string;
}

const PACKAGE_JSON = require('../package.json');

export const Package: PackConfig = Object.seal({
	description: PACKAGE_JSON.description,
	homepage: PACKAGE_JSON.homepage,
	version: PACKAGE_JSON.version,
});
