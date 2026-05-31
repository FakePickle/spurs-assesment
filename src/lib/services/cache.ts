import Redis from 'ioredis';
import { env } from '$env/dynamic/private';

const TTL_SECONDS = 30 * 60;

let _redis: Redis | null = null;

function getRedis(): Redis | null {
	if (!env.REDIS_URL) return null;
	if (!_redis) {
		_redis = new Redis(env.REDIS_URL, {
			lazyConnect: true,
			maxRetriesPerRequest: 1,
			connectTimeout: 3000
		});
		_redis.on('error', (err) => console.warn('[redis] connection error:', err.message));
	}
	return _redis;
}

function cacheKey(sessionId: string) {
	return `history:${sessionId}`;
}

export async function getCachedHistory(sessionId: string): Promise<unknown[] | null> {
	try {
		const r = getRedis();
		if (!r) return null;
		const raw = await r.get(cacheKey(sessionId));
		if (!raw) return null;
		return JSON.parse(raw) as unknown[];
	} catch {
		return null;
	}
}

export async function setCachedHistory(sessionId: string, history: unknown[]): Promise<void> {
	try {
		const r = getRedis();
		if (!r) return;
		await r.set(cacheKey(sessionId), JSON.stringify(history), 'EX', TTL_SECONDS);
	} catch {
		// cache write failures are non-fatal
	}
}

export async function invalidateCache(sessionId: string): Promise<void> {
	try {
		const r = getRedis();
		if (!r) return;
		await r.del(cacheKey(sessionId));
	} catch {
		// cache invalidation failures are non-fatal
	}
}
