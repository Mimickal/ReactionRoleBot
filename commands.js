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

// Some notes for this file:
//
// - Always call message.fetch().
//     This ensures Discord.js' caches (e.g. for reactions) are populated and up
//     to date before doing anything.
//
// - Always fail safe.
//     If any part of an operation fails, every action taken during that
//     operation should be rolled back.
//
// - UI updates should come last.
//     Updating what the user sees (e.g. sending message, adding a reaction)
//     should always be done after other actions. Discord's client already shows
//     a spinner while the bot is active, so we only need to confirm success or
//     failure.
//     The only exception to this is committing an active database transaction.

const {
	ApplicationCommandType,
	Options,
	SlashCommandRegistry,
} = require('discord-command-registry');
const SELECTED_MESSAGE_CACHE = require('memory-cache');

const database = require('./database');
const info = require('./package.json');
const logger = require('./logger');
const { emojiToKey } = require('./util');

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
	.addCommand(command => command
		.setName('role')
		.setDescription('Manage react roles')
		.addSubcommand(subcommand => subcommand
			.setName('add')
			.setDescription('Add a new react-role to the selected message')
			.setHandler(cmdRoleAdd)
			.addStringOption(option => option
				.setName('emoji')
				.setDescription('The emoji to map the role to')
				.setRequired(true)
			)
			.addRoleOption(option => option
				.setName('role')
				.setDescription('The role to map the emoji to')
				.setRequired(true)
			)
		)
		.addSubcommand(subcommand => subcommand
			.setName('remove')
			.setDescription('Remove a react-role from the selected message')
			.setHandler(cmdRoleRemove)
			.addStringOption(option => option
				.setName('emoji')
				.setDescription('The emoji mapping to remove')
				.setRequired(true)
			)
		)
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

/**
 * Map an emoji reaction with a role on the currently selected message.
 */
async function cmdRoleAdd(interaction) {
	const emoji   = Options.getEmoji(interaction, 'emoji', true);
	const role    = interaction.options.getRole('role', true);
	let   message = SELECTED_MESSAGE_CACHE.get(interaction.user.id);

	if (!message) {
		return interaction.reply({
			content: 'No message selected! Select a message first.',
			ephemeral: true,
		});
	}

	if (!emoji) {
		return interaction.reply({
			content: 'Not a valid emoji!',
			ephemeral: true,
		});
	}

	message = await message.fetch();

	// Prevent someone from modifying a server from outside the server.
	if (interaction.guild !== message.guild || interaction.guild !== role.guild) {
		// TODO use unindent
		return interaction.reply({
			content:
				'Message and Role need to be in the same Server ' +
				'this command was issued from',
			ephemeral: true,
		});
	}

	// Try to add this mapping to the database.
	const db_data = {
		guild_id: interaction.guild.id,
		message_id: message.id,
		emoji_id: emojiToKey(emoji),
		role_id: role.id,
	};
	try {
		await database.addRoleReact(db_data);
	} catch (err) {
		logger.error(`Database failed to create ${JSON.stringify(db_data)}`, err);
		return interaction.reply({
			content: 'Something went wrong',
			ephemeral: true,
		});
	}

	// Try to add the emoji to the selected message. If this fails, also remove
	// the created mapping from the database so this fails safe.
	try {
		await message.react(emoji);
	} catch (err) {
		logger.warn(`Could not add emoji ${emoji} to message ${message.url}`, err);
		// FIXME use a transaction for this. This involves database work so
		// maybe hold off until we have fully replace message commands with
		// slash commands.
		await database.removeRoleReact(db_data);
		return interaction.reply({
			content:
				'I could not react to your selected message. Do I have the ' +
				'right permissions?',
			ephemeral: true,
		});
	}

	return interaction.reply({
		content: `Mapped ${emoji} to ${role} on message ${message.url}`,
		ephemeral: true,
	});
}

/**
 * Removes an emoji mapping from the currently selected message.
 */
async function cmdRoleRemove(interaction) {
	const emoji   = Options.getEmoji(interaction, 'emoji', true);
	let   message = SELECTED_MESSAGE_CACHE.get(interaction.user.id);

	if (!message) {
		return interaction.reply({
			content: 'No message selected! Select a message first.',
			ephemeral: true,
		});
	}

	if (!emoji) {
		return interaction.reply({
			content: 'Not a valid emoji!',
			ephemeral: true,
		});
	}

	message = await message.fetch();

	try {
		const emoji_id = emojiToKey(emoji);

		// Intentionally NOT removing this role from users who currently have it
		// FIXME need a transaction here too
		await database.removeRoleReact({
			message_id: message.id,
			emoji_id: emoji_id,
		});
		await message.reactions.cache.get(emoji_id).remove();
	} catch (err) {
		logger.error(`Could not remove emoji ${emoji} from message ${message.url}`, err);
		return interaction.reply({
			content: 'I could not remove the react. Do I have the right permissions?',
			ephemeral: true,
		});
	}

	return interaction.reply({
		content: `Removed ${emoji} from message ${message.url}`,
		ephemeral: true,
	});
}

module.exports = REGISTRY;

