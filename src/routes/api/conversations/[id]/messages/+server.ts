import { json, error } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase';
import type { RequestHandler } from './$types';

// GET /api/conversations/[id]/messages — fetch all messages in a conversation
export const GET: RequestHandler = async ({ params }) => {
	const { id } = params;

	const { data: conversation, error: convErr } = await supabaseAdmin
		.from('conversations')
		.select('id')
		.eq('id', id)
		.single();

	if (convErr || !conversation) error(404, 'Conversation not found');

	const { data, error: err } = await supabaseAdmin
		.from('messages')
		.select('id, role, content, timestamp')
		.eq('conversation_id', id)
		.order('timestamp', { ascending: true });

	if (err) error(500, err.message);

	return json(data);
};
