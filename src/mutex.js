const { Mutex } = require('async-mutex');

const logger = require('./logger');
const { stringify } = require('./util');

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
 */
class UserMutex {
	#mutexes = new Map();

	// TODO this needs a timeout
	async lock(user) {
		const key = user.id;
		if (!this.#mutexes.has(key)) {
			this.#mutexes.set(key, new ReferenceCountMutex());
		}
		const mutex = this.#mutexes.get(key);
		logger.debug(`Locking ${stringify(user)} (refs: ${mutex.ref_count})`);
		return await mutex.acquire();
	}

	unlock(user) {
		const key = user.id;
		if (!this.#mutexes.has(key)) {
			return;
		}
		const mutex = this.#mutexes.get(key);
		logger.debug(`Unlocking ${stringify(user)} (refs: ${mutex.ref_count})`);
		mutex.release();

		// Clean up locks once nothing else is using them
		if (mutex.ref_count === 0) {
			this.#mutexes.delete(key);
		}
	}
}

module.exports = UserMutex;
