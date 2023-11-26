/*******************************************************************************
 * This file is part of No BS Role Reacts, a role-assigning Discord bot.
 * Copyright (C) 2020 Mimickal (Mia Moretti).
 *
 * No BS Role Reacts is free software under the GNU Affero General Public
 * License v3.0. See LICENSE or <https://www.gnu.org/licenses/agpl-3.0.en.html>
 * for more information.
 ******************************************************************************/
const fs = require('fs');
const minimist = require('minimist');
const path = require('path');

const REQUIRED_KEYS = ['app', 'token'];
const OPTIONAL_KEYS = ['database_file', 'enable_precache', 'guild', 'log_file'];
const ALL_KEYS = [...REQUIRED_KEYS, ...OPTIONAL_KEYS];

const PROJECT_ROOT = fs.realpathSync(path.join(__dirname, '..', '..'));

const CONFIG_TEMPLATE = {
	app: '<Your Discord bot application ID>',
	token: '<Your Discord bot token>',
};

// Parse and handle CLI arguments
const cliArgs = minimist(process.argv.slice(2), {
	string: ['app', 'guild'],
});

if (cliArgs.help) {
	console.log('No BS Role Reacts Usage:\n\n' +
		'\t--config  Use this JSON config file instead of the default.\n' +
		'\t--help    Show this help text and exit.\n' +
		'\t--version Show bot version and exit.\n'
	);
	process.exit(0);
}

if (cliArgs.version) {
	const package = require('../../package.json');
	console.log(package.version);
	process.exit(0);
}

/**
 * Path to the config file.
 *
 * Relative paths are resolved relative to the project root.
 * We do this for consistency between the bot and Knex, since Knex overrides cwd.
 *
 * For legacy support, handle config file passed as a positional argument.
 */
let confFile =
	cliArgs.config                              ??
	cliArgs._.find(arg => arg.endsWith('json')) ??
	(process.env.NODE_ENV === 'prod'
		? '/etc/discord/ReactionRoleBot/config.json'
		: path.join(__dirname, '..', 'dev-config.json')
	);
if (!path.isAbsolute(confFile)) {
	confFile = path.resolve(PROJECT_ROOT, confFile);
}

/**
 * Config loaded from file.
 */
let loadedConfig = {};
try {
	loadedConfig = JSON.parse(fs.readFileSync(confFile).toString())
} catch (err) {
	// Output a config file template and exit if file is not found.
	console.error(`Failed to read config file at ${confFile}`);
	if (err.message.includes('no such file or directory')) {
		console.error(
			'You can create the file there, or pass it in as a command ' +
			'line argument (I recommend passing it in).\n' +
			'Example: npm run <command> -- --config <path/to/your/config.json>\n\n' +
			'If this if your first time running the bot, your config file ' +
			'must be a JSON file containing at least these fields:\n' +
			JSON.stringify(CONFIG_TEMPLATE, null, 2) + '\n\n'
		);
	} else {
		console.error(err);
	}
	process.exit(1);
}

// Verify we have all required keys, and warn for extra keys.
REQUIRED_KEYS.forEach(key => {
	if (loadedConfig[key] == null) {
		throw new Error(`Missing required config key "${key}"`);
	}
});
const extraKeys = Object.keys(loadedConfig)
	.filter(key => !ALL_KEYS.includes(key));
if (extraKeys.length > 0) {
	console.warn('Extra config keys given:', extraKeys);
}

/**
 * Path to the database file.
 *
 * Relative paths are resolved relative to the project root.
 * We do this for consistency between the bot and Knex, since Knex overrides cwd.
 */
let databaseFile =
	loadedConfig.database_file ??
	(process.env.NODE_ENV === 'prod'
		? '/srv/discord/rolebot.sqlite3'
		: path.join(PROJECT_ROOT, 'dev.sqlite3')
	);
if (!path.isAbsolute(databaseFile)) {
	confFile = path.resolve(PROJECT_ROOT, databaseFile);
}

/**
 * Path to the log file.
 *
 * Relative paths are resolved relative to the project root.
 * We do this for consistency between the bot and Knex, since Knex overrides cwd.
 *
 * For legacy support, this defaults to output.log in the project root.
 */
let logFile =
	loadedConfig.log_file ??
	path.join(PROJECT_ROOT, 'output.log');
if (!path.isAbsolute(logFile)) {
	logFile = path.resolve(PROJECT_ROOT, logFile);
}

module.exports = Object.freeze({
	app_id:          loadedConfig.app,
	database_file:   databaseFile,
	enable_precache: loadedConfig.enable_precache,
	guild_id:        loadedConfig.guild,
	log_file:        logFile,
	token:           loadedConfig.token,
});
