const knexfile = require('./knexfile');
const knex = require('knex')(knexfile[process.env.NODE_ENV || 'development']);

const REACTS = 'reacts';
const DISCORD_ID_LENGTH = 18;

module.exports = {
	DISCORD_ID_LENGTH,
	REACTS
};

