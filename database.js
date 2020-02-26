const knexfile = require('./knexfile');
const knex = require('knex')(knexfile[process.env.NODE_ENV || 'development']);

const REACTS = 'reacts';
const DISCORD_ID_LENGTH = 18;

function addRoleReact(args) {
	return knex(REACTS).insert(args);
}

function updateRoleReact(args) {

}

function upsertRoleReact(args) {
	return storeRoleReact(args).catch(err => {
		if (err.message.includes('UNIQUE constraint failed')) {
			//return ...;
		} else {
			throw err;
		}
	});
}

module.exports = {
	DISCORD_ID_LENGTH,
	REACTS
};

