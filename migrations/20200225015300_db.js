const db = require('../database');

exports.up = function(knex) {
	return knex.schema.createTable(db.REACTS, table => {
		table.string('guild_id',   db.DISCORD_ID_LENGTH);
		table.string('channel_id', db.DISCORD_ID_LENGTH);
		table.string('message_id', db.DISCORD_ID_LENGTH).primary();
		table.string('role_id',    db.DISCORD_ID_LENGTH);
		table.string('emoji_id',   db.DISCORD_ID_LENGTH);
	});
};

exports.down = function(knex) {
	return knex.schema.dropTable(db.REACTS);
};

