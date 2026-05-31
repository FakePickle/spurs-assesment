import { supabaseAdmin } from '$lib/server/supabase';

export type MessageRow = {
	id: string;
	role: 'user' | 'assistant';
	content: string;
	created_at: string;
};

export async function getOrCreateConversation(sessionId: string): Promise<string> {
	const { data } = await supabaseAdmin
		.from('conversations')
		.select('id')
		.eq('id', sessionId)
		.maybeSingle();

	if (data) return data.id;

	const { data: created, error } = await supabaseAdmin
		.from('conversations')
		.insert({ id: sessionId, metadata: {} })
		.select('id')
		.single();

	if (error) throw new Error('Failed to create conversation: ' + error.message);
	return created.id;
}

export async function saveMessage(
	conversationId: string,
	role: 'user' | 'assistant',
	content: string
): Promise<MessageRow> {
	const { data, error } = await supabaseAdmin
		.from('messages')
		.insert({ conversation_id: conversationId, role, content })
		.select('id, role, content, created_at')
		.single();

	if (error) throw new Error('Failed to save message: ' + error.message);
	return data as MessageRow;
}

export async function getHistory(
	conversationId: string
): Promise<{ role: string; content: string }[]> {
	const { data, error } = await supabaseAdmin
		.from('messages')
		.select('role, content')
		.eq('conversation_id', conversationId)
		.order('created_at', { ascending: true })
		.limit(10);

	if (error) throw new Error('Failed to load history: ' + error.message);
	return data ?? [];
}

export async function getMessages(conversationId: string): Promise<MessageRow[]> {
	const { data, error } = await supabaseAdmin
		.from('messages')
		.select('id, role, content, created_at')
		.eq('conversation_id', conversationId)
		.order('created_at', { ascending: true })
		.limit(10);

	if (error) throw new Error('Failed to load messages: ' + error.message);
	return (data ?? []) as MessageRow[];
}
