const { Mutex } = require('async-mutex');

const logger = require('./logger');
const { stringify } = require('./util');

// TODO consider parameterizing this if we ever pull this out to a library.
const TIMEOUT = 5000;

/**
 * A Mutex that knows how many things are waiting to acquire it.
 *
 * NOTE: Mutex::release is not actually deprecated. See:
 * https://github.com/DirtyHairy/async-mutex/issues/50#issuecomment-1007785141
 */
class ReferenceCountMutex extends Mutex {
	ref_count = 0;

	async acquire() {
		this.ref_count++;
		return await super.acquire();
	}

	release() {
		this.ref_count--;
		super.release();
	}
}

/**
 * A map of mutexes that can lock Discord GuildMembers, preventing race
 * conditions when modifying users across multiple events.
 *
 * Uses reference counting to clean up mutexes.
 *
 * An internal timer is used to automatically unlock a user after a few seconds.
 * Callers should still always explicitly unlock users whenever possible.
 */
class UserMutex {
	#mutexes = new Map();
	#lock_timers = new Map();

	async lock(user) {
		const key = user.id;
		if (!this.#mutexes.has(key)) {
			this.#mutexes.set(key, new ReferenceCountMutex());
		}
		const mutex = this.#mutexes.get(key);

		logger.debug(`Locking ${stringify(user)} (refs: ${mutex.ref_count}) (${caller(3)})`);
		await mutex.acquire();

		// Piggyback off the mutex lock so only one timer is active at a time.
		this.#lock_timers.set(key,
			setTimeout(() => this.#_unlock(user, true), TIMEOUT)
		);
	}

	unlock(user) {
		this.#_unlock(user);
	}

	// Disallow external callers from setting timed_out
	#_unlock(user, timed_out=false) {
		const key = user.id;

		// Clearing timers is idempotent, so always do this first
		clearTimeout(this.#lock_timers.get(key));
		this.#lock_timers.delete(key);

		// Make unlock idempotent too
		if (!this.#mutexes.has(key)) {
			logger.debug(`Extraneous unlock on ${stringify(user)} (${caller(4)})`);
			return;
		}
		const mutex = this.#mutexes.get(key);

		// Falling back on a timeout for unlock is not inherently an error, but
		// it can sometimes be prevented with a programming change up the chain.
		const log_msg = `Unlocking ${stringify(user)} (refs: ${mutex.ref_count})`;
		if (timed_out) {
			logger.warn(`${log_msg} after timeout`);
		} else {
			logger.debug(`${log_msg} (${caller(4)})`);
		}

		mutex.release();

		// Clean up locks once nothing else is using them
		if (mutex.ref_count === 0) {
			this.#mutexes.delete(key);
		}
	}
}

// Get the calling function's name
function caller(depth) {
	const call_line = new Error().stack.split('\n').slice(depth, depth + 1).pop();
	const match = call_line.match(/\s*at ([\w.]+)/);
	return match[1];
}

module.exports = UserMutex;
