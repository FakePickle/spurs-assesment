import { json, error } from '@sveltejs/kit';
import { getOrCreateConversation, getMessages } from '$lib/services/db';
import { getCachedHistory, setCachedHistory } from '$lib/services/cache';
import type { RequestHandler } from './$types';

// GET /api/history?sessionId=
// Response: { messages: MessageRow[] }
export const GET: RequestHandler = async ({ url }) => {
	const sessionId = url.searchParams.get('sessionId');

	if (!sessionId?.trim()) {
		error(400, 'sessionId query parameter is required');
	}

	// Redis first, fall back to DB
	try {
		const cached = await getCachedHistory(sessionId);
		if (cached) {
			return json({ messages: cached });
		}
	} catch {
		// cache miss — continue to DB
	}

	let messages;
	try {
		const conversationId = await getOrCreateConversation(sessionId);
		messages = await getMessages(conversationId);
	} catch (e: unknown) {
		error(500, e instanceof Error ? e.message : 'Database error');
	}

	await setCachedHistory(sessionId, messages).catch(() => {});

	return json({ messages });
};
