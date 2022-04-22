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
const logger = require('./logger');
const registry = require('./commands');

const WHAT_AM_I = `
Registers slash commands with Discord's API. This only needs to be done once
after commands are updated. Updating commands globally can take some time to
propagate! For testing, use guild-specific commands (set guild_id in config).
`;

if (!process.argv[2]) {
	console.log(`Usage: ${
		process.argv.slice(0, 2).map(x => path.basename(x)).join(' ')
	} <your-config.json>\n${WHAT_AM_I}`);
	process.exit();
}

let output = 'Registering commmands ';
if (config.guild_id) {
	output += `in guild ${config.guild_id}`;
} else {
	output += 'GLOBALLY';
}
output += ` for application ${config.app_id}...`;
logger.info(output);

registry.registerCommands({
	application_id: config.app_id,
	guild: config.guild_id,
	token: config.token,
})
	.then(got_back => logger.info(`Successfully registered commands! Got data: ${
		JSON.stringify(got_back)
	}`))
	.catch(err => logger.error(`Error registering commands:`, err));

