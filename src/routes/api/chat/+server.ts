import { json, error } from '@sveltejs/kit';
import { getOrCreateConversation, saveMessage, getHistory } from '$lib/services/db';
import { getCachedHistory, setCachedHistory, invalidateCache } from '$lib/services/cache';
import { generateReply } from '$lib/services/llm';
import type { RequestHandler } from './$types';

const MAX_INPUT_CHARS = 2000;

// POST /api/chat
// Body: { message: string, sessionId: string }
// Response: { sessionId, userMessage, assistantMessage }
export const POST: RequestHandler = async ({ request }) => {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		error(400, 'Invalid JSON body');
	}

	const { message, sessionId } = body as { message?: unknown; sessionId?: unknown };

	if (!message || typeof message !== 'string' || !message.trim()) {
		error(400, 'message is required and must be a non-empty string');
	}
	if (!sessionId || typeof sessionId !== 'string') {
		error(400, 'sessionId is required');
	}

	const userText = message.trim().slice(0, MAX_INPUT_CHARS);

	let conversationId: string;
	try {
		conversationId = await getOrCreateConversation(sessionId);
	} catch (e: unknown) {
		error(500, e instanceof Error ? e.message : 'Database error');
	}

	// Load history — Redis first, fall back to DB
	let history: { role: string; content: string }[];
	try {
		const cached = await getCachedHistory(sessionId);
		if (cached) {
			history = cached as { role: string; content: string }[];
		} else {
			history = await getHistory(conversationId);
			await setCachedHistory(sessionId, history);
		}
	} catch {
		history = [];
	}

	// Generate AI reply
	let assistantText: string;
	try {
		assistantText = await generateReply(history, userText);
	} catch (e: unknown) {
		error(502, e instanceof Error ? e.message : 'AI service error');
	}

	// Persist both messages
	let userMsg, assistantMsg;
	try {
		userMsg = await saveMessage(conversationId, 'user', userText);
		assistantMsg = await saveMessage(conversationId, 'assistant', assistantText);
	} catch (e: unknown) {
		error(500, e instanceof Error ? e.message : 'Failed to save messages');
	}

	// Invalidate cache so next request gets fresh history from DB
	await invalidateCache(sessionId);

	return json({ sessionId, userMessage: userMsg, assistantMessage: assistantMsg });
};
