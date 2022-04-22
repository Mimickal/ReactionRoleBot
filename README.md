# Overview

<a href="LICENSE.md"><img align="right" alt="AGPL-3.0 Logo"
src="https://www.gnu.org/graphics/agplv3-155x51.png">
</a>

A Discord bot that can assign roles based on message reactions.<br/>
[You can invite my live instance of the bot to your server with this link](
https://discord.com/oauth2/authorize?client_id=692585944934514738&scope=bot&permissions=335881280
).

# Why this bot?
Several other popular role-react bots exist, but many of them have some annoying
catch. Some have uptime issues, some lock basic functionality behind premium pay
walls, and some come with way too many other features that add bloat, requiring
convoluted web APIs for configuration. In most cases the source code also isn't
available, so we can't do anything about it.

This bot attempts to address these issues. It _only_ does role reacts, and is
configured using slash commands. Every feature of this bot is completely free to
use, and always will be. It's also open source, so you can modify it to better
suit your needs, or just download it and host your own instance.

Basically, there's no bullshit.

# Usage
You can interact with the bot using slash commands.

The bot will always respond to users with the "Administrator" permission.
Additional roles can be whitelisted to modify the bot config for your guild.

You write the post people can react to for their roles. The bot will not attempt
to write its own posts for this (but will add its own emojis).

## Permissions
The role automatically created for the bot needs to be ordered above any role
you want the bot to be able to assign. That role also needs to have access to
the channel with your role-react post, and have have following permissions:
* **Add Reactions** - To add the initial react to the post
* **Manage Messages** - To remove all reacts from a post
* **Manage roles** - To assign roles to users
* **Read Message History** - To see posts in the channel before it joined
* **Use External Emojis** - To use your custom emojis in role reacts
* **Read Text Channels & See Voice Channels** - To see the role-react post

**Note:** These permissions may be inherited from your `@everyone` settings.

## Selecting a Message
You need to select a message to add react roles to it. Right click on a message
and use Discord's fancy context menu to select it. This is tracked per-user, so
multiple users can interact with the bot at the same time.

Due to current Discord limitations, context menus are not available on mobile
devices (sorry). See below for an alternative.

![](docs/select.png)

## Selecting a Message on Mobile
If you are on mobile, you might not have access to context menus. Don't worry,
there's a workaround for you. Long-press the message, select
"Copy Message Link", then use `/select-message-mobile` with the message URL
instead.

| This is the Message       | Long press and Share      | Tap Copy                  |
|---------------------------|---------------------------|---------------------------|
|![](docs/mobileselect1.png)|![](docs/mobileselect2.png)|![](docs/mobileselect3.png)|

![](docs/mobileselect4.png)

## Adding a Role to the Message
Use the `/role add` slash command to add a role to the message.

![](docs/roleadd.png)

You can also remove a role from the message using `/role remove`, or remove
all roles from the message using `/role remove-all`. This will remove all
reactions from the post, but **will not** unassign any roles.

## Making Two Roles Mutually Exclusive
Use the `/mutex add` slash command to make two (or more) roles mutually
exclusive. If a user tries to add two roles that are mutually exclusive, the bot
will automatically remove the first one they had. You can have multiple mutually
exclusive groups.

This setting is **server-wide**. If roles A, B, and C are all mutually
exclusive, when a user with roles B and C tries to assign role A, the bot will
automatically remove roles B and C from them **even if those roles were not
assigned by the bot in the first place**.

Due to current Discord limitations, you can only add two roles per-command, so
you'll need to run the command several times to make more than two roles
mutually exclusive (once again, sorry).

![](docs/mutexadd.png)

Use `/mutex remove` to remove to mutually exclusive restriction on two roles.

## Adding Roles That Can Configure The Bot
By default, the bot will only listen to users who have the "Administrator"
permission. You can use `/permission add` to add additional roles that are
allowed to configure the bot in your guild.

![](docs/permadd.png)

Use `/permission remove` to disallow a role from configuring the bot.<br/>
**Note:** A user can remove their own permission to configure the bot if they
are not an administrator!

## Delete All Configuration In Server
You can use `/reset-everything` to remove *all* configuration the bot has for
the guild the command was sent from. The bot does this automatically when it is
kicked from a guild.

This does not clear any server-side logs for the guild.

## Printing Bot Info
You can use `/info` to print the bot's description, version number, link to the
source code, and some fun stats. This command is available to all users and
posts **non-ephemeral** replies (i.e. visible to everybody).

![](docs/info.png)

## Rate Limits
If the bot is taking a few moments to respond to reactions, it is likely hitting
Discord's strict rate limit. This happens most often with mutually exclusive
roles, since the bot needs to make several requests to make them work. The bot
is registering the actions. Give it a few seconds to catch up.

## @everyone
Discord implements `@everyone` as a role under the hood. This means you can set
up react roles for `@everyone` like you would for any other role. It's silly, it
won't do anything, but you *could* do it...

## Hosting your own instance
[See the guide here](docs/hosting.md).

If you are upgrading from version 1.x, [see the migration guide](
docs/migrate.md).

## License
Copyright 2020 [Mimickal](https://github.com/Mimickal)

This code is licensed under the
[AGPL-3.0](https://www.gnu.org/licenses/agpl-3.0-standalone.html) license.

Basically, any modifications to this code must be made open source.
