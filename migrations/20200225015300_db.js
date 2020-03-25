const db = require('../database');

// TODO we will need to store guild IDs and such later.
exports.up = function(knex) {
	return knex.schema.createTable(db.REACTS, table => {
		table.string('message_id', db.DISCORD_ID_LENGTH.MAX);
		// TODO Might need to change this for custom emojis
		table.string('emoji_id',   db.DISCORD_ID_LENGTH.MAX);
		table.string('role_id',    db.DISCORD_ID_LENGTH.MAX);

		table.primary(['message_id', 'emoji_id']);
	});
};

exports.down = function(knex) {
	return knex.schema.dropTable(db.REACTS);
};

