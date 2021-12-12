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
const {
	ApplicationCommandType,
	SlashCommandRegistry,
} = require('discord-command-registry');
const SELECTED_MESSAGE_CACHE = require('memory-cache');

const database = require('./database');
const info = require('./package.json');

const ONE_HOUR_IN_MS = 60*60*1000;

const REGISTRY = new SlashCommandRegistry()
	.addCommand(command => command
		.setName('info')
		.setDescription(
			'Prints description, version, and link to source code for the bot'
		)
		.setHandler(cmdInfo)
	)
	.addContextMenuCommand(command => command
		.setName('select-message')
		.setType(ApplicationCommandType.Message)
		.setHandler(cmdSelect)
	)
	.addCommand(command => command
		.setName('selected')
		.setDescription('Shows currently selected message')
		.setHandler(cmdSelected)
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

/**
 * Saves a user's selected message for subsequent actions.
 */
async function cmdSelect(interaction) {
	const user    = interaction.user;
	const message = interaction.options.getMessage('message', true);

	// Always clear selected message first, just to be safe and consistent.
	SELECTED_MESSAGE_CACHE.del(user.id);
	SELECTED_MESSAGE_CACHE.put(user.id, message, ONE_HOUR_IN_MS);

	return interaction.reply({
		content: `Selected message: ${message.url}`,
		ephemeral: true,
	});
}

/**
 * Shows a user their currently selected message.
 */
async function cmdSelected(interaction) {
	const message = SELECTED_MESSAGE_CACHE.get(interaction.user.id);
	return interaction.reply({
		content: message
			? `Currently selected: ${message.url}`
			: 'No message currently selected',
		ephemeral: true,
	});
}

module.exports = REGISTRY;

