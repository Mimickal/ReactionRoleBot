# Migrating your instance to 3.x

This guide is for people who were running their own 2.x instance of the bot.

This bot now runs Discord.js v14, which requires Node.js 16.11.0 or later.
Something like [`nvm`](https://github.com/nvm-sh/nvm) can make the transition
easier.

This bot is also now written in TypeScript and runs natively using `ts-node`.
We do not transpile down to JavaScript! For hosting the bot, the only thing this
should affect is the install size (2.0 was ~64 MB, 3.0 is ~114 MB).

1. Get the updated bot code. Either:
    - `git pull origin master` if you cloned with git (which you should).
    - Download the `master` branch from GitHub as a zip file, and extract it.
1. In your `config.json`:
    - Rename `app_id` to `app`.
    - Rename `guild_id` to `guild` (if you have it).
1. Install updated dependencies: `npm ci`.
1. You may need / want to update your `reactionrolebot.service` definition.
    - Added instructions on how to run as a user service.
    - Changed `WantedBy` to be `default.target` instead of `multi-user.target`.
    - Removed `User` field in favor of running as a user service.
1. Restart the bot.
    - **Running as a service**: `systemctl restart reactionrolebot.service`
    - **Running in dev-mode**: `npm start --config path/to/your/config.json`
