/*******************************************************************************
 * This file is part of No BS Role Reacts, a role-assigning Discord bot.
 * Copyright (C) 2020 Mimickal (Mia Moretti).
 *
 * No BS Role Reacts is free software under the GNU Affero General Public
 * License v3.0. See LICENSE or <https://www.gnu.org/licenses/agpl-3.0.en.html>
 * for more information.
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

import {
	getEmoji,
	Handler,
	SlashCommandRegistry,
	WithGuild,
} from 'discord-command-registry';
import {
	ApplicationCommandType,
	bold,
	ChannelType,
	ChatInputCommandInteraction,
	codeBlock,
	CommandInteraction,
	ContextMenuCommandInteraction,
	Message,
	PermissionFlagsBits,
	Role,
	roleMention,
	Snowflake,
} from 'discord.js';
import {
	GlobalLogger,
	asLines,
	stringify,
	unindent,
} from '@mimickal/discord-logging';
import Multimap from 'multimap';
import NodeCache from 'node-cache';

import { Package } from './config';
import * as database from './database';
import { emojiToKey, entries, ephemEdit, ephemReply } from './util';

const logger = GlobalLogger.logger;

const ONE_HOUR_IN_SECONDS = 60*60;
const CACHE_SETTINGS: NodeCache.Options = {
	stdTTL: ONE_HOUR_IN_SECONDS,
	checkperiod: ONE_HOUR_IN_SECONDS,
	useClones: false,
}
const SELECTED_MESSAGE_CACHE = new NodeCache(CACHE_SETTINGS);
const CLONE_MESSAGE_CACHE = new NodeCache(CACHE_SETTINGS);

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
		.setHandler(requireAuth(cmdSelect))
	)
	.addContextMenuCommand(command => command
		.setName('select-copy-target')
		.setType(ApplicationCommandType.Message)
		.setHandler(requireAuth(cmdSelectCopy))
	)
	.addCommand(command => command
		.setName('select-message-mobile')
		.setDescription('Workaround for selecting messages on mobile')
		.setHandler(requireAuth(cmdSelectMobile))
		.addStringOption(option => option
			.setName('message-url')
			.setDescription('The URL for the message to select')
			.setRequired(true)
		)
	)
	.addCommand(command => command
		.setName('selected')
		.setDescription('Shows currently selected message')
		.setHandler(requireAuth(cmdSelected))
	)
	.addCommand(command => command
		.setName('copy')
		.setDescription('Copy react-role mappings to another message')
		.addSubcommand(subcommand => subcommand
			.setName('select-target-mobile')
			.setDescription('Workaround for selecting copy target message on mobile')
			.setHandler(requireAuth(cmdSelectCopyMobile))
			.addStringOption(option => option
				.setName('message-url')
				.setDescription('The URL for the clone target message to select')
				.setRequired(true)
			)
		)
		.addSubcommand(subcommand => subcommand
			.setName('selected-target')
			.setDescription('Shows currently selected copy target message')
			.setHandler(requireAuth(cmdSelectedCopy))
		)
		.addSubcommand(subcommand => subcommand
			.setName('execute')
			.setDescription(
				'Copy role-react mappings from selected message to target message'
			)
			.setHandler(requireAuth(cmdCopyMappings))
		)
	)
	.addCommand(command => command
		.setName('role')
		.setDescription('Manage react roles')
		.addSubcommand(subcommand => subcommand
			.setName('add')
			.setDescription('Add a new react-role to the selected message')
			.setHandler(requireAuth(cmdRoleAdd))
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
			.setHandler(requireAuth(cmdRoleRemove))
			.addStringOption(option => option
				.setName('emoji')
				.setDescription('The emoji mapping to remove')
				.setRequired(false)
			)
			.addRoleOption(option => option
				.setName('role')
				.setDescription('The role mapping to remove')
				.setRequired(false)
			)
		)
		.addSubcommand(subcommand => subcommand
			.setName('remove-all')
			.setDescription('Remove ALL react-roles from the selected message')
			.setHandler(requireAuth(cmdRoleRemoveAll))
		)
	)
	.addCommand(command => command
		.setName('permission')
		.setDescription('Manage who is allowed to configure the bot')
		.addSubcommand(subcommand => subcommand
			.setName('add')
			.setDescription('Add a role that can configure the bot')
			.setHandler(requireAuth(cmdPermAdd))
			.addRoleOption(option => option
				.setName('role')
				.setDescription('The role that will be able to configure the bot')
				.setRequired(true)
			)
		)
		.addSubcommand(subcommand => subcommand
			.setName('remove')
			.setDescription('Remove a role that can configure the bot')
			.setHandler(requireAuth(cmdPermRemove))
			.addRoleOption(option => option
				.setName('role')
				.setDescription(
					'The role that will no longer be able to configure the bot'
				)
				.setRequired(true)
			)
		)
	)
	.addCommand(command => command
		.setName('mutex')
		.setDescription('Manage mutually exclusive react roles')
		.addSubcommand(subcommand => subcommand
			.setName('add')
			.setDescription('Make two react roles mutually exclusive for this server')
			.setHandler(requireAuth(cmdMutexAdd))
			.addRoleOption(option => option
				.setName('role1')
				.setDescription('The first mutually exclusive role')
				.setRequired(true)
			)
			.addRoleOption(option => option
				.setName('role2')
				.setDescription('The second mutually exclusive role')
				.setRequired(true)
			)
		)
		.addSubcommand(subcommand => subcommand
			.setName('remove')
			.setDescription(
				'Remove the mutually exclusive restriction on two react roles'
			)
			.setHandler(requireAuth(cmdMutexRemove))
			.addRoleOption(option => option
				.setName('role1')
				.setDescription('The first mutually exclusive role')
				.setRequired(true)
			)
			.addRoleOption(option => option
				.setName('role2')
				.setDescription('The second mutually exclusive role')
				.setRequired(true)
			)
		)
	)
	.addCommand(command => command
		.setName('reset-everything')
		.setDescription('Deletes ALL configuration for this server')
		.setHandler(requireAuth(cmdReset))
	);

/**
 * Middleware for command handlers that ensures the user initiating an
 * interaction has permission to do so, and short-circuits if they don't.
 *
 * Using this requires the handler accepts {@link WithGuild} interactions.
 */
function requireAuth<T extends CommandInteraction>(
	handler: Handler<WithGuild<T>>
): Handler<T> {
	return async function(interaction: T): Promise<unknown> {
		if (!interaction.inCachedGuild()) {
			return ephemReply(interaction, 'This command only works in a guild!');
		}

		const member = await interaction.member.fetch(); // Ensures cache

		if (member.permissions.has(PermissionFlagsBits.Administrator)) {
			return handler(interaction);
		}

		const allowedRoles = await database.getAllowedRoles(interaction.guild.id);
		if (allowedRoles.some(role => member.roles.cache.has(role))) {
			return handler(interaction);
		}

		return ephemReply(interaction, "You don't have permission to use that!");
	};
}

/**
 * Replies with info about this bot, including a link to the source code to be
 * compliant with the AGPLv3 this bot is licensed under.
 */
async function cmdInfo(interaction: ChatInputCommandInteraction): Promise<void> {
	const stats = await database.getMetaStats();
	await interaction.reply(asLines([
		Package.description,
		`${bold('Running version:')} ${Package.version}`,
		`${bold('Source code:')} ${Package.homepage}`,
		'',
		codeBlock(asLines([
			'Stats For Nerds:',
			`  - Servers bot is active in: ${stats.guilds}`,
			`  - Reaction role mappings:   ${stats.mappings}`,
			`  - Total role assignments:   ${stats.assignments}`,
		])),
	]));
}

/**
 * Saves a user's selected message for subsequent actions.
 */
async function cmdSelect(
	interaction: WithGuild<ContextMenuCommandInteraction>
): Promise<void> {
	const message = _selectCommon(interaction, SELECTED_MESSAGE_CACHE);
	await ephemReply(interaction, `Selected message: ${message.url}`);
}

/**
 * Saves a user's selected clone target message for subsequent clone.
 */
async function cmdSelectCopy(
	interaction: WithGuild<ContextMenuCommandInteraction>
): Promise<void> {
	const message = _selectCommon(interaction, CLONE_MESSAGE_CACHE);
	await ephemReply(interaction, `Selected copy target: ${message.url}`);
}

// Common logic between cmdSelect and cmdSelectClone
function _selectCommon(
	interaction: WithGuild<ContextMenuCommandInteraction>,
	cache: NodeCache,
): Message<boolean> {
	const user    = interaction.user;
	const message = interaction.options.getMessage('message', true);

	// Always clear selected message first, just to be safe and consistent.
	cache.del(user.id);
	cache.set<Message<boolean>>(user.id, message);

	return message;
}

/**
 * An alternative way to select messages using slash commands instead of context
 * menus, since Discord mobile does not currently support context menus.
 */
async function cmdSelectMobile(
	interaction: WithGuild<ChatInputCommandInteraction>
): Promise<void> {
	const url = await _selectCloneCommon(interaction, SELECTED_MESSAGE_CACHE);
	if (url) {
		await ephemReply(interaction, `Selected message: ${url}`);
	}
}

/**
 * An alternative way to select clone target messages using slash commands
 * instead of context menus.
 */
async function cmdSelectCopyMobile(
	interaction: WithGuild<ChatInputCommandInteraction>
): Promise<void> {
	const url = await _selectCloneCommon(interaction, CLONE_MESSAGE_CACHE);
	if (url) {
		await ephemReply(interaction, `Selected copy target: ${url}`);
	}
}

// Common logic between cmdSelectMobile and cmdSelectCloneMobile
async function _selectCloneCommon(
	interaction: WithGuild<ChatInputCommandInteraction>,
	cache: NodeCache,
): Promise<string | undefined> {
	async function reportInvalid(err?: Error): Promise<void> {
		logger.warn('Failed to select message by URL', err);
		await ephemReply(interaction, 'Invalid message link!');
	}

	const url = interaction.options.getString('message-url', true);
	const match = url.match(/^https:\/\/discord\.com\/channels\/\d+\/(\d+)\/(\d+)$/);

	if (!match) {
		reportInvalid();
		return;
	}

	const channel_id = match[1];
	const message_id = match[2];

	let message;
	try {
		const channel = await interaction.guild!.channels.fetch(channel_id);
		if (!channel || channel.type !== ChannelType.GuildText) {
			throw new Error('Not a text channel!');
		}

		message = await channel?.messages.fetch(message_id);
	} catch (err) {
		reportInvalid(err as Error);
		return;
	}

	cache.del(interaction.user.id);
	cache.set(interaction.user.id, message);

	return url;
}

/**
 * Shows a user their currently selected message.
 */
async function cmdSelected(
	interaction: WithGuild<ChatInputCommandInteraction>
): Promise<void> {
	// TODO would be nice if the cache tracked its own type. This isn't safe.
	const message = SELECTED_MESSAGE_CACHE.get<Message>(interaction.user.id);
	await ephemReply(interaction, message
		? `Currently selected: ${message.url}`
		: 'No message currently selected'
	);
}

/**
 * Shows a user their currently selected copy target message.
 */
async function cmdSelectedCopy(
	interaction: WithGuild<ChatInputCommandInteraction>
): Promise<void> {
	// TODO would be nice if the cache tracked its own type. This isn't safe.
	const message = CLONE_MESSAGE_CACHE.get<Message>(interaction.user.id);
	await ephemReply(interaction, message
		? `Current copy target: ${message.url}`
		: 'No copy target message currently selected'
	);
}

/**
 * Map an emoji reaction with a role on the currently selected message.
 */
async function cmdRoleAdd(
	interaction: WithGuild<ChatInputCommandInteraction>
): Promise<void> {
	const emoji = getEmoji(interaction, 'emoji', true);
	const role  = interaction.options.getRole('role', true);

	const cached_message = SELECTED_MESSAGE_CACHE.get<Message>(interaction.user.id);
	if (!cached_message) {
		await ephemReply(interaction, 'No message selected! Select a message first.');
		return
	}

	if (!emoji) {
		await ephemReply(interaction, 'Not a valid emoji!');
		return
	}

	const message = await cached_message.fetch();

	// Prevent someone from modifying a server from outside the server.
	if (interaction.guild.id !== message.guild?.id ||
		interaction.guild.id !== (role as Role)?.guild.id
	) {
		await ephemReply(interaction, unindent(`
			Message and Role need to be in the same Server this command
			was issued from!
		`));
		return;
	}

	await database.transaction(async trx => {
		const emoji_key = emojiToKey(emoji);

		const mapping = await database.getRoleReactMap(message.id, trx);
		const mutex_roles = await database.getMutexRoles({
			guild_id: interaction.guild.id,
			role_id: role.id,
		}, trx);
		if (mutex_roles.find(mrole_id => mapping.has(emoji_key, mrole_id))) {
			const conflicting = mutex_roles.filter(
				mrole_id => mapping.has(emoji_key, mrole_id)
			);
			await ephemReply(interaction, unindent(`
				Cannot add emoji-role mapping because it conflicts with mutually
				exclusive roles mapped to this emoji! Conflicting roles:
				${conflicting.map(mrole_id => roleMention(mrole_id)).join(', ')}
			`));
			return;
		}

		const db_data = {
			guild_id: interaction.guild.id,
			message_id: message.id,
			emoji_id: emoji_key,
			role_id: role.id,
		};

		try {
			await database.addRoleReact(db_data, trx);
		} catch (err) {
			logger.error(`Database failed to create ${stringify(db_data)}`, err);
			await ephemReply(interaction, 'Something went wrong. Try again?');
			throw new database.HandledError(err as Error);
		}

		try {
			await message.react(emoji);
		} catch (err) {
			logger.warn(`Could not add ${stringify(emoji)} to ${stringify(message)}`, err);
			await ephemReply(interaction,
				'I could not react to your selected message. Do I have the right permissions?'
			);
			throw new database.HandledError(err as Error);
		}

		let response = `Mapped ${emoji} to ${role} on ${stringify(message)}`;
		const also_mapped = entries(mapping)
			.filter(([eid, rid]) => eid !== emoji_key && rid === role.id)
			.map(([eid, _]) => message.reactions.resolve(eid)?.emoji);
		if (also_mapped.length > 0) {
			response += `\nNote: also mapped to ${also_mapped.join(' ')}`;
		}
		return ephemReply(interaction, response);
	});
}

/**
 * Removes an emoji mapping from the currently selected message.
 */
async function cmdRoleRemove(
	interaction: WithGuild<ChatInputCommandInteraction>
): Promise<void> {
	const emoji = getEmoji(interaction, 'emoji', false);
	const role  = interaction.options.getRole('role', false);

	const cached_message = SELECTED_MESSAGE_CACHE.get<Message>(interaction.user.id);
	if (!cached_message) {
		await ephemReply(interaction, 'No message selected! Select a message first.');
		return;
	}

	if (!emoji && !role) {
		await ephemReply(interaction, 'You must specify an emoji or a role (or both)!');
		return;
	}

	const message = await cached_message.fetch();

	await database.transaction(async trx => {
		// Need to reply to keep the interaction token alive while we delete
		await ephemReply(interaction, 'Removing, this may take a moment...');

		let map_before: Multimap<string, Snowflake>;
		const db_data = {
			message_id: message.id,
			emoji_id:   emoji ? emojiToKey(emoji) : undefined,
			role_id:    role?.id,
		};
		try {
			map_before = await database.getRoleReactMap(message.id, trx);
			// Intentionally NOT removing roles from users who currently have them
			await database.removeRoleReact(db_data, trx);
		} catch (err) {
			logger.error(`Database failed to remove mappings ${stringify(db_data)}`, err);
			await ephemEdit(interaction, 'Something went wrong. Try again?');
			throw new database.HandledError(err as Error);
		}

		let map_after: Multimap<string, Snowflake>;
		try {
			map_after = await database.getRoleReactMap(message.id, trx);
			await Promise.all(message.reactions.cache
				.filter((_, msg_emoji) => !map_after.has(msg_emoji))
				.map(react => react.remove()));
		} catch (err) {
			logger.error(`Could not remove reacts from ${stringify(message)}`, err);
			await ephemEdit(interaction,
				'I could not remove the react(s). Do I have the right permissions?'
			);
			throw new database.HandledError(err as Error);
		}

		entries(map_after).forEach(
			([emoji_key, role_id]) => map_before.delete(emoji_key, role_id)
		);
		const removed_pairs = entries(map_before);

		return ephemEdit(interaction, removed_pairs.length === 0
			? 'Selected message has no mappings for the given emoji and/or role!'
			: `Removed mappings:\n${
				removed_pairs.map(([emoji_id, role_id]) => {
					const emoji_str = interaction.client.emojis.resolve(emoji_id) ?? emoji_id;
					return `${emoji_str} -> ${roleMention(role_id)}`
				}).join('\n')
			}\nFrom ${stringify(message)}`
		);
	});
}

/**
 * Removes all emoji mappings from the currently selected message.
 * This remains a separate function to avoid accidentally nuking a message.
 */
async function cmdRoleRemoveAll(
	interaction: WithGuild<ChatInputCommandInteraction>
): Promise<void> {
	const cached_message = SELECTED_MESSAGE_CACHE.get<Message>(interaction.user.id);

	if (!cached_message) {
		await ephemReply(interaction, 'No message selected! Select a message first.');
		return;
	}

	const message = await cached_message.fetch();

	await database.transaction(async trx => {
		let removed;
		try {
			removed = await database.removeAllRoleReacts(message.id, trx);
			await message.reactions.removeAll();
		} catch (err) {
			logger.error(`Could not remove all reacts from ${stringify(message)}`, err);
			await ephemReply(interaction,
				'I could not remove the reacts. Do I have the right permissions?'
			);
			throw new database.HandledError(err as Error);
		}

		await ephemReply(interaction,
			removed
				? `Removed all react roles from ${stringify(message)}`
				: `Selected message does not have any role reactions! ${message.url}`
		);
	});
}

/**
 * Adds a role that can configure this bot's settings for a guild.
 */
async function cmdPermAdd(
	interaction: WithGuild<ChatInputCommandInteraction>
): Promise<void> {
	const role = interaction.options.getRole('role', true);

	if (interaction.guild.id !== (role as Role)?.guild.id) {
		await ephemReply(interaction, 'Role must belong to this guild!');
		return;
	}

	try {
		await database.addAllowedRole({
			guild_id: interaction.guild.id,
			role_id: role.id,
		});
	} catch (err) {
		if ((err as Error).message.includes('UNIQUE constraint failed')) {
			await ephemReply(interaction, `${role} can already configure me!`);
		} else {
			logger.error(`Could not add permission for ${stringify(role)}`, err);
			await ephemReply(interaction, 'Something went wrong. Try again?');
		}
		return;
	}

	await ephemReply(interaction, `${role} can now configure me`);
}

/**
 * Removes a role from being able to configure this bot's settings for a guild.
 * A role can remove itself, which is dumb, but whatever.
 */
async function cmdPermRemove(
	interaction: WithGuild<ChatInputCommandInteraction>
): Promise<void> {
	const role = interaction.options.getRole('role', true);

	if (interaction.guild.id !== (role as Role)?.guild.id) {
		await ephemReply(interaction, 'Role must belong to this guild!');
		return;
	}

	let removed;
	try {
		removed = await database.removeAllowedRole({
			guild_id: interaction.guild.id,
			role_id: role.id,
		});
	} catch (err) {
		logger.error(`Could not remove permission for ${stringify(role)}`, err);
		await ephemReply(interaction, 'Something went wrong. Try again?');
		return;
	}

	await ephemReply(interaction,
		`${role} ${
			removed === 1 ? 'is no longer' : 'was already not'
		} allowed to configure me`
	);
}

/**
 * Make two roles mutually exclusive for a guild.
 * This is for the whole guild, not just a single message.
 */
async function cmdMutexAdd(
	interaction: WithGuild<ChatInputCommandInteraction>
): Promise<void> {
	const role1 = interaction.options.getRole('role1', true);
	const role2 = interaction.options.getRole('role2', true);

	if (interaction.guild.id !== (role1 as Role)?.guild.id ||
		interaction.guild.id !== (role2 as Role)?.guild.id
	) {
		await ephemReply(interaction, 'Roles must belong to this guild!');
		return;
	}

	if (role1 === role2) {
		await ephemReply(interaction,
			'Cannot make a role mutually exclusive with itself!'
		);
		return;
	}

	try {
		await database.addMutexRole({
			guild_id: interaction.guild.id,
			role_id_1: role1.id,
			role_id_2: role2.id,
		});
	} catch (err) {
		if ((err as Error).message.includes('UNIQUE constraint failed')) {
			await ephemReply(interaction,
				`Roles ${role1} and ${role2} are already mutually exclusive!`
			);
		} else {
			logger.error(unindent(`
				Could not make ${stringify(role1)} and ${stringify(role2)}
				mutually exclusive
			`), err);
			await ephemReply(interaction, 'Something went wrong. Try again?');
		}
		return;
	}

	await ephemReply(interaction,
		`Roles ${role1} and ${role2} are now mutually exclusive in this server`
	);
}

/**
 * Removes the mutually exclusive restriction for two roles in a guild.
 */
async function cmdMutexRemove(
	interaction: WithGuild<ChatInputCommandInteraction>
): Promise<void> {
	const role1 = interaction.options.getRole('role1', true);
	const role2 = interaction.options.getRole('role2', true);

	if (interaction.guild.id !== (role1 as Role)?.guild.id ||
		interaction.guild.id !== (role2 as Role)?.guild.id
	) {
		await ephemReply(interaction, 'Roles must belong to this guild!');
		return;
	}

	let removed;
	try {
		removed = await database.removeMutexRole({
			guild_id: interaction.guild.id,
			role_id_1: role1.id,
			role_id_2: role2.id,
		});
	} catch (err) {
		logger.error(
			`Could not remove mutex for ${stringify(role1)} and ${stringify(role2)}`,
			err
		);
		await ephemReply(interaction, 'Something went wrong. Try again?');
		return
	}

	await ephemReply(interaction,
		`Roles ${role1} and ${role2} ${
			removed === 1 ? 'are no longer' : 'were already not'
		} mutually exclusive`
	);
}

/**
 * Removes all data for a guild. This includes role react mappings, allowed
 * configuration roles, and mutually exclusive constraints on roles.
 */
async function cmdReset(
	interaction: WithGuild<ChatInputCommandInteraction>
): Promise<void> {
	try {
		await database.clearGuildInfo(interaction.guild.id);
	} catch (err) {
		logger.error(`Failed to clear data for ${stringify(interaction.guild)}`, err);
		await ephemReply(interaction, 'Something went wrong. Try again?');
		return;
	}

	await ephemReply(interaction, 'Deleted all configuration for this guild!');
}

/**
 * Copies role-react mappings from the selected message to the copy target
 * message. This requires both a message and a copy target to be selected.
 */
async function cmdCopyMappings(
	interaction: WithGuild<ChatInputCommandInteraction>
): Promise<void> {
	const cached_msg_from = SELECTED_MESSAGE_CACHE.get<Message<boolean>>(interaction.user.id);
	const cached_msg_copy = CLONE_MESSAGE_CACHE.get<Message<boolean>>(interaction.user.id);

	if (!cached_msg_from) {
		await ephemReply(interaction,
			'No message selected! Select a message first.'
		);
		return;
	}

	if (!cached_msg_copy) {
		await ephemReply(interaction,
			'No copy target selected! Select a copy target message first.'
		);
		return;
	}

	if (cached_msg_from.id === cached_msg_copy.id) {
		await ephemReply(interaction, 'Cannot copy a message to itself!');
		return;
	}

	const msg_from = await cached_msg_from.fetch();
	const msg_copy = await cached_msg_copy.fetch();

	// Prevent modifying a server from outside a server
	const guild = interaction.guild;
	if (guild !== msg_from.guild || guild !== msg_copy.guild) {
		await ephemReply(interaction, unindent(`
			Source and target messages need to be in the same Server this
			command was issued from!
		`));
		return;
	}

	// Need to reply to keep the interaction token alive while we copy
	await ephemReply(interaction, 'Copying, this may take a moment...');

	await database.transaction(async trx => {
		const mapping = await database.getRoleReactMap(msg_from.id, trx);
		for await (const [emoji_id, role_id] of entries(mapping)) {
			try {
				await database.addRoleReact({
					guild_id:   guild.id,
					message_id: msg_copy.id,
					emoji_id:   emoji_id,
					role_id:    role_id,
				}, trx);
			} catch (err) {
				logger.error('Failed to copy roles', err);
				await ephemEdit(interaction, 'Something went wrong. Try again?');
				throw new database.HandledError(err as Error);
			}

			try {
				await msg_copy.react(emoji_id);
			} catch (err) {
				logger.warn(`Cannot copy roles to ${msg_copy.url}`);
				await ephemEdit(interaction, unindent(`
					Could not add reacts to the target message. Do I have the
					right permissions?
				`));
				throw new database.HandledError(err as Error);
			}
		}

		return ephemEdit(interaction, mapping.size === 0
			? 'Selected message has no mappings!'
			: 'Copied react-role mappings.\n' +
				`Source: ${msg_from.url}\n` +
				`Target: ${msg_copy.url}\n` +
				'You can delete the original message now.'
		);
	});
}

export default REGISTRY;
