/*******************************************************************************
 * This file is part of ReactionRoleBot, a role-assigning Discord bot.
 * Copyright (C) 2020 Mimickal (Mia Moretti).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, version 3.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 ******************************************************************************/
const Winston = require('winston');

const LOG_FILE_NAME = 'output.log';
const IS_PROD = process.env.NODE_ENV === 'prod';


const logger = Winston.createLogger();

const logFormat = Winston.format.combine(
	Winston.format.timestamp(),
	Winston.format.printf( ({ level, message, timestamp, stack, ...extra }) => {
		// Winston appends the error message to the log message by default, even
		// when stack traces are enabled, so we need to manually unappend it.
		// https://github.com/winstonjs/winston/issues/1660?ts=4#issuecomment-569413211
		if (stack) {
			const err = extra[Symbol.for('splat')][0];
			message = message.replace(` ${err.message}`, '') + `\n${stack}`;
		}
		return `${timestamp} [${level}]: ${message}`;
	}),
);

logger.add(new Winston.transports.File({
	filename: LOG_FILE_NAME,
	format: logFormat,
	level: IS_PROD ? 'info' : 'debug',
}));
logger.add(new Winston.transports.Console({
	format: Winston.format.combine(
		Winston.format.colorize(),
		logFormat,
	),
	level: IS_PROD ? 'error' : 'debug',
}));


// Rolling our own unhandled exception and Promise rejection handlers, because
// Winston's built-in ones kind of suck.
function errStr(err) {
	return err instanceof Error ? err.stack : err;
}
process.on('uncaughtExceptionMonitor', err => logger.error(errStr(err)));
process.on('unhandledRejection',
	err => logger.error(`Unhandled Promise rejection: ${errStr(err)}`));


module.exports = logger;
