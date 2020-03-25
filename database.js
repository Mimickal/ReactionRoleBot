const knexfile = require('./knexfile');
const knex = require('knex')(knexfile[process.env.NODE_ENV || 'development']);
const lodash = require('lodash/object');

const REACTS = 'reacts';
const DISCORD_ID_LENGTH = {
	MIN: 17,
	MAX: 19
};

/**
 * Adds an emoji->role mapping for the given message. If the emoji is already
 * mapped to a role on this message, that mapping is replaced.
 *
 * This is essentially an upsert, but "upsert" is a stupid word, so "add" it is.
 */
function addRoleReact(args) {
	// TODO sanity check values
	let fields = lodash.pick(args, ['message_id', 'emoji_id', 'role_id']);

	return knex(REACTS)
		.insert(fields)
		.catch(err => {
			if (err.message.includes('UNIQUE constraint failed')) {
				return knex(REACTS)
					.where(lodash.pick(fields, ['message_id', 'emoji_id']))
					.update({ role_id: fields.role_id });
			} else {
				throw err;
			}
		});
}

/**
 * Removes an emoji->role mapping for the given message.
 */
function removeRoleReact(args) {
	// TODO sanity check values
	let fields = lodash.pick(args, ['message_id', 'emoji_id']);

	return knex(REACTS).where(fields).del();
}

module.exports = {
	DISCORD_ID_LENGTH,
	REACTS,
	addRoleReact,
	removeRoleReact
};

