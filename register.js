/*******************************************************************************
 * This file is part of ReactionRoleBot, a role-assigning Discord bot.
 * Copyright (C) 2020 Mimickal (Mia Moretti).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, version 3.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 ******************************************************************************/
const fs = require('fs');
const path = require('path');

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

const config = JSON.parse(fs.readFileSync(process.argv[2]));

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

