/*******************************************************************************
 * This file is part of No BS Role Reacts, a role-assigning Discord bot.
 * Copyright (C) 2020 Mimickal (Mia Moretti).
 *
 * No BS Role Reacts is free software under the GNU Affero General Public
 * License v3.0. See LICENSE or <https://www.gnu.org/licenses/agpl-3.0.en.html>
 * for more information.
 ******************************************************************************/
const path = require('path');
const Winston = require('winston');

const config = require('./config');

const LOG_FILE_NAME = config.log_file || path.join(__dirname, '..', 'output.log');
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
