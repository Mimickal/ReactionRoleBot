## Overview
A Discord bot that can assign roles based on message reactions.
[You can invite my live instance of the bot to your server with this link](
https://discord.com/oauth2/authorize?client_id=692585944934514738&scope=bot&permissions=335881280
)

## Why this bot?
Several other popular role-react bots exist, but many of them have some annoying
catch. Some have uptime issues, some lock basic functionality behind premium pay
walls, and some come with way too many other features that add bloat, requiring
convoluted web APIs for configuration. In most cases the source code also isn't
available, so we can't do anything about it.

This bot attempts to address these issues. It _only_ does role reacts, and is
configured by typing to it in a Discord channel. Every feature of this bot is
completely free to use, and always will be. It's also open source, so you can
modify it to better suit your needs, or just download it and host your own
instance. Basically, there's no bullshit.

# Usage
You can interact with the bot by mentioning it (denoted here as `@bot`). The bot
will currently only respond to users with the "Administrator" permissions.

The role automatically created for the bot needs to be ordered above any role
you want the bot to be able to assign. That role also needs to have access to
the channel with your role-react post, and have have following permissions:
* **Add Reactions** - To add the initial react to the post
* **Manage Messages** - To remove all reacts from a post
* **Manage roles** - To assign roles to users
* **Read Message History** - To see posts in the channel before it joined
* **Use External Emojis** - To use your custom emojis in role reacts
* **Read Text Channels & See Voice Channels** - To see the role-react post
Note that these permissions may be inherited from your `@everyone` settings.

You write the post people can react to for their roles. The bot will not attempt
to write its own posts for this. You can then tell the bot to select that post,
and tell it which roles to map to which emoji reactions on that post.

**Selecting a post** - The bot tracks this on a per-user basis, so multiple users can
interact with the bot at the same time.
```
# Command:
@bot select <channel> <message_id>
@bot select <channel_id> <message_id>
@bot select <message_link>  # Not yet supported!

# Examples:
@bot select #role-assginment 123456789123456789
@bot select 123456789123456789 1234556789123456789
@bot select https://discordapp.com/channels/123456789123456789/123456789123456789/123456789123456789
```

**Adding a role to the post** - The bot will add its own reaction to the selected
post with the given emoji.
```
# Command:
@bot role-add <emoji> <role>
@bot role-add <emoji> <role_id>

# Examples:
@bot role-add 🦊 @test-role
@bot role-add 🦊 1234556789123456789
```

**Removing a react-role from a post** - The bot will remove all reactions of
this emoji from the selected post, without removing the associated role from any
user who reacted to the post.
```
# Command
@bot role-remove <emoji>

# Examples:
@bot role-remove 🦊
```

**Removing all react-roles from a post** - The bot will remove all reactions
from the selected post, without removing any of the associated roles from the
members who reacted to it. This is mostly useful to work around a limitation
with Discord's API, since it treats admins removing reacts the same was as users
removing reacts.
```
# Command
@bot role-remove-all
```

**Adding roles that can configure the bot** - By default, the bot will only
listen to users who have the administrator permission. This command allows you
to add additional roles that are allowed to configure the bot.
```
# Command
@bot perm-add <role|role_id>
```

**Removing roles that can configure the bot** - Removes a role from being
allowed to configure the bot. The bot will always listen to users with the
administrator permissions. This cannot currently be disabled.
```
# Command
@bot perm-remove <role|role_id>
```

**Add mutually exclusive roles** - Makes two roles mutually exclusive. If a user
tried to add two roles that are mutually exclusive, the bot will automatically
remove the first one they had.
```
# Command
@bot mutex-add <role1|role1_id> <role2|role2_id>
```

**Remove mutually exclusive roles** - Removes the mutually exclusive constraint
from two roles.
```
# Command
@bot mutex-remove <role1|role1_id> <role2|role2_id>
```

**Printing command usage info** - If you'd rather the bot tell you how to use
it, instead of looking at this page, you can use this command.
```
# Command
@bot help
```

You can also print the bot's description, version number, and link to the source
code. This command is available to all users.
```
@bot info
```

## Rate Limits
If the bot is taking a few moments to respond to reactions, it is likely hitting
Discord's strict rate limit. This happens most often with mutually exclusive
roles, since the bot needs to make several requests to make them work. The bot
is registering the actions. Give it a few seconds to catch up.

## Hosting your own instance
This bot is built on [discord.js](https://discord.js.org/#/) v13, so you'll need
Node.js 16.6.0 (or newer) installed. You will also need your own Discord bot
account.

If you're upgrading from an older Discord.js v12 version of the bot, the Node.js
16.6.0 requirement might be problematic. you might consider using something like
https://github.com/nvm-sh/nvm to make the transition easier.

The `resources` directory has a service file that can be used with Linux distros
with systemd. If you're installing this on some other operating system, you're
on your own.

### Running as a service
The provided service file expects to find the bot code at
`/srv/discord/ReactionRoleBot/`, and will want to create the sqlite database at
`/srv/discord/rolebot.sqlite`. The easiest way to do this is to create a
`/srv/discord` directory, and `chown` it so it belongs to the user running the
bot.

The following will prepare the bot to run. Run this from `/srv/discord`:
```
git clone https://github.com/Mimickal/ReactionRoleBot.git
cd ReactionRoleBot
npm install
NODE_ENV=prod npm run knex migrate:latest
```

Create a file `/etc/discord/ReactionRoleBot/config.json` and paste in the
following (obviously fill in the blanks with your bot's info):
```json
{
  "token": "<your token here>",
  "app_id": "<your bot application ID here>"
}
```

Install `reactionrolebot.service` into `/etc/systemd/system/`.

Now you should be able to run `systemctl restart reactionrolebot.service` to
start your bot.

### Running locally (in dev-mode)
Run this wherever you want:
```
git clone https://github.com/Mimickal/ReactionRoleBot.git
cd ReactionRoleBot
npm install
npm run knex migrate:latest
```

Create a file containing your bot token in plain text.

Run this to start the bot: `node main.js path/to/your/config`
