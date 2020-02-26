const fs = require('fs');

const Discord = require('discord.js');
const db = require('./database');
const events = require('./events');

const client = new Discord.Client();
const token_file = process.argv[2] || '/etc/discord/ReactionRoleBot/token';
const token = fs.readFileSync(token_file);

client.on('ready', () => console.log(`Logged in as ${client.user.tag}`));

client.login(token).catch(err => {
	console.error(err);
	process.exitCode = 1;
});

