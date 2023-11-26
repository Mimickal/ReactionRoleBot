# Information storage disclosure

## Database

No BS Role Reacts stores the following in its database:

- The ID of servers it joins.
- The ID of messages with role-react mappings.
- The ID of roles used in role-react mappings.
- The ID of custom emojis used in role-react mappings.
- The IDs of mutually exclusive roles in a server.

This is the bare minimum information required for the bot to function.
When you kick No BS Role Reacts from your server, it completely wipes every
database entry associated with your server

## Logging

No BS Role Reacts logs the following data:

- The ID of servers it joins.
- The ID of servers it leaves.
- The ID of users roles are assigned and unassigned to, along with the ID of the role.
- The content of commands issued (server ID, command name, amd issuing user).
- Messages No BS Role Reacts sends in response to commands.
- The ID of messages that are reacted to, along with the emoji.

These logs are stores securely, privately, and used solely for troubleshooting.
Unlike the database, when you kick No BS Role Reacts from your server, log
messages are **not** deleted. If you would like to have your information scrubbed
from the logs, [see below](#requesting-your-information-or-deleting-it).

## Why log this stuff?

In the past, I tried logging only actual errors ([See the commit history of this bot](https://github.com/Mimickal/ReactionRoleBot)).
I found out the hard way that this is not enough information to help people
troubleshoot issues, especially when the bot is in many servers,
most of which are private.

Having this additional information allows me to ask someone "What's your server
ID?" instead of asking 20+ questions, or worse, needing to join their server and
dig through their settings.

## Requesting your information (or deleting it)

Logs and database entries for users and servers can be made available (or
deleted) upon request. [Join the support server](https://discord.gg/7UBT8SK) to
file your request.
