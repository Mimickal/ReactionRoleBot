module.exports = {
	development: {
		client: 'sqlite3',
		useNullAsDefault: true,
		connection: {
			filename: './dev.sqlite3'
		}
	},

	testing: {
		client: 'sqlite3',
		useNullAsDefault: true,
		connection: {
			filename: ':memory:'
		}
	},

	prod: {
		client: 'sqlite3',
		useNullAsDefault: true,
		connection: {
			filename: '/srv/discord/rolebot.sqlite3'
		}
	}
};

