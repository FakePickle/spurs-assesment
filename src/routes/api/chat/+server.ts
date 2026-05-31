import { json, error } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase';
import { getModel } from '$lib/server/gemma';
import type { RequestHandler } from './$types';

// POST /api/chat
// Body: { message: string, conversationId?: string }
// Response: { conversationId: string, message: { id, role, content, timestamp } }
export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json().catch(() => null);
	if (!body?.message?.trim()) error(400, 'message is required');

	const userText: string = body.message.trim();
	let conversationId: string = body.conversationId ?? '';

	// Create a new conversation if one wasn't provided
	if (!conversationId) {
		const { data, error: err } = await supabaseAdmin
			.from('conversations')
			.insert({ metadata: {} })
			.select('id')
			.single();
		if (err) error(500, 'Failed to create conversation: ' + err.message);
		conversationId = data.id;
	} else {
		// Verify the conversation exists
		const { data, error: err } = await supabaseAdmin
			.from('conversations')
			.select('id')
			.eq('id', conversationId)
			.single();
		if (err || !data) error(404, 'Conversation not found');
	}

	// Fetch prior messages to build chat history
	const { data: history, error: histErr } = await supabaseAdmin
		.from('messages')
		.select('role, content')
		.eq('conversation_id', conversationId)
		.order('timestamp', { ascending: true });

	if (histErr) error(500, 'Failed to load history: ' + histErr.message);

	// Save the user's message
	const { data: userMsg, error: userErr } = await supabaseAdmin
		.from('messages')
		.insert({ conversation_id: conversationId, role: 'user', content: userText })
		.select('id, role, content, timestamp')
		.single();

	if (userErr) error(500, 'Failed to save user message: ' + userErr.message);

	// Build the Gemma chat history (prior messages only, not the current one)
	const chatHistory = (history ?? []).map((msg) => ({
		role: msg.role === 'assistant' ? 'model' : 'user',
		parts: [{ text: msg.content }]
	}));

	// Call Gemma
	let assistantText: string;
	try {
		const model = getModel();
		const chat = model.startChat({ history: chatHistory });
		const result = await chat.sendMessage(userText);
		console.log('Gemma result:', result);
		assistantText = result.response.text();
		console.log('Gemma response:', assistantText);
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : String(e);
		error(502, 'Gemma API error: ' + msg);
	}

	// Save the assistant's response
	const { data: assistantMsg, error: assistantErr } = await supabaseAdmin
		.from('messages')
		.insert({ conversation_id: conversationId, role: 'assistant', content: assistantText })
		.select('id, role, content, timestamp')
		.single();

	if (assistantErr) error(500, 'Failed to save assistant message: ' + assistantErr.message);

	return json({
		conversationId,
		userMessage: userMsg,
		assistantMessage: assistantMsg
	});
};
