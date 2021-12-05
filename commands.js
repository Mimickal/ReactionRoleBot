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
const { SlashCommandRegistry } = require('discord-command-registry');

const database = require('./database');
const info = require('./package.json');

const REGISTRY = new SlashCommandRegistry()
	.addCommand(command => command
		.setName('info')
		.setDescription(
			'Prints description, version, and link to source code for the bot'
		)
		.setHandler(cmdInfo)
	)
;

/**
 * Replies with info about this bot, including a link to the source code to be
 * compliant with the AGPLv3 this bot is licensed under.
 */
async function cmdInfo(interaction) {
	const stats = await database.getMetaStats();
	await interaction.reply(
		`${info.description}\n`                                +
		`**Running version:** ${info.version}\n`               +
		`**Source code:** ${info.homepage}\n\n`                +
		'```Stats For Nerds:\n'                                +
		`  - Servers bot is active in: ${stats.guilds}\n`      +
		`  - Reaction role mappings:   ${stats.roles}\n`       +
		`  - Total role assignments:   ${stats.assignments}\n` +
		'```'
	);
}

module.exports = REGISTRY;

