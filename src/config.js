/*******************************************************************************
 * This file is part of No BS Role Reacts, a role-assigning Discord bot.
 * Copyright (C) 2020 Mimickal (Mia Moretti).
 *
 * No BS Role Reacts is free software under the GNU Affero General Public
 * License v3.0. See LICENSE or <https://www.gnu.org/licenses/agpl-3.0.en.html>
 * for more information.
 ******************************************************************************/
const fs = require('fs');

const CONFIG_TEMPLATE = {
	app_id: '<Your Discord bot application ID>',
	token: '<Your Discord bot token>',
};
const DEFAULT_CONFIG_LOCATION = '/etc/discord/ReactionRoleBot/config.json';

let location = process.argv[2] || DEFAULT_CONFIG_LOCATION;
let config;
try {
	config = JSON.parse(fs.readFileSync(location));
} catch (err) {
	console.error(`Failed to read config file at ${location}`);
	if (err.message.includes('no such file or directory')) {
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

// Enumerate the values here so intellisense (and maintainers) knows what's available.
module.exports = Object.seal({
	app_id:          config.app_id,
	enable_precache: config.enable_precache,
	guild_id:        config.guild_id,
	token:           config.token,
});

