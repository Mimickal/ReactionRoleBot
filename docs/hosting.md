# Hosting your own instance

This bot is built on [discord.js](https://discord.js.org/#/) v13, so you'll need
Node.js 16.6.0 (or newer) installed. You will also need your own Discord bot
account. If your platform does not have Node.js 16.6.0, consider using something
like https://github.com/nvm-sh/nvm.

This guide assumes you're hosting on a Linux distro with `systemd`. The bot will
work on other platforms, but you're on your own figuring that out.

## Running as a user (in dev-mode)
Quick and easy. Also (mostly) platform-independent!

Create a file `config.json` and paste in the following (obviously fill in the
blanks with your bot's info):
```json
{
  "token": "<your token here>",
  "app_id": "<your bot application ID here>"
}
```

Install dependencies, register Discord slash commands, and set up the database
for your bot:
```
git clone https://github.com/Mimickal/ReactionRoleBot.git
cd ReactionRoleBot
npm ci
npm run register path/to/your/config.json
npm run knex migrate:latest
```

Start the bot:
```
npm start path/to/your/config.json
```

## Running as a service
A little more effort to set up, but better for long-term use.

The provided service file expects to find the bot code at
`/srv/discord/ReactionRoleBot/`, and will want to create the sqlite database at
`/srv/discord/rolebot.sqlite`. The easiest way to do this is to create a
`/srv/discord` directory, and `chown` it so it belongs to the user running the
bot.

Create a file `/etc/discord/ReactionRoleBot/config.json` and paste in the
following (obviously fill in the blanks with your bot's info):
```json
{
  "token": "<your token here>",
  "app_id": "<your bot application ID here>"
}
```

The following will prepare the bot to run by installing dependencies,
registering slash commands for your Discord bot account, and setting up the
bot's database. Run this from `/srv/discord`:
```
git clone https://github.com/Mimickal/ReactionRoleBot.git
cd ReactionRoleBot
npm ci
npm run register /etc/discord/ReactionRoleBot/config.json
NODE_ENV=prod npm run knex migrate:latest
```

Add your user to `reactionrolebot.service`, then install it into
`/etc/systemd/system/` (just copy the file into that directory). This service
file depends on the above directories, so if you want to change them, you'll
also need to edit those fields. If you are using `nvm`, you may need to tweak
the service file a bit (see comments in provided service file).

Now you should be able to run `systemctl restart reactionrolebot.service` to
start your bot.
