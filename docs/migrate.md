# Migrating your instance to 2.x

This guide is for people who were running their own 1.x instance of the bot.

This bot now runs Discord.js v13, which requires Node.js 16.6.0. On some
platforms (older distros, cloud hosting, etc...) this may be problematic.
Something like https://github.com/nvm-sh/nvm can make the transition easier.

1. Get the updated bot code (either `git pull origin master` if you cloned with
   git (which you should) or download `master` as a zip).
1. Make a copy of your old database
   - **Running as a service**: probably `/srv/discord/rolebot.sqlite3`
   - **Running in dev-mode**: `dev.sqlite3`
1. Replace bot token file with a `config.json` file that looks like this:
   ```json
   {
     "token": "<your token here>",
     "app_id": "<your bot application ID here>"
   }
   ```
   - **Running as a service**: Replace `/etc/discord/ReactionRoleBot/token`
     with `/etc/discord/ReactionRoleBot/config.json`
   - **Running in dev-mode**: Some local token file
1. Install updated dependencies: `npm ci`
1. Register slash commands: `npm run register path/to/your/config.json`
1. Update your database: `npm run knex migrate:latest`
1. Start the bot
   - **Running as a service**: update `reactionrolebot.service` ([see reference
   implementation](../resources/reactionrolebot.service)). Restart service
   `systemctl restart reactionrolebot.service`.
   - **Running in dev-mode**: `npm start path/to/your/config.json`
