const db = require('../database');

exports.up = function(knex) {
	return knex.schema.createTable(db.REACTS, table => {
		table.string('guild_id',   db.DISCORD_ID_LENGTH);
		table.string('channel_id', db.DISCORD_ID_LENGTH);
		table.string('message_id', db.DISCORD_ID_LENGTH);
		table.string('role_id',    db.DISCORD_ID_LENGTH);
		table.string('emoji_id',   db.DISCORD_ID_LENGTH);

		table.primary(['message_id', 'role_id', 'emoji_id']);
	});
};

exports.down = function(knex) {
	return knex.schema.dropTable(db.REACTS);
};

