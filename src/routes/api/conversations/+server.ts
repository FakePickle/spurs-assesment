import { json, error } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase';
import type { RequestHandler } from './$types';

// POST /api/conversations — create a new conversation
export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json().catch(() => ({}));
	const metadata = body.metadata ?? {};

	const { data, error: err } = await supabaseAdmin
		.from('conversations')
		.insert({ metadata })
		.select('id, created_at, metadata')
		.single();

	if (err) error(500, err.message);

	return json(data, { status: 201 });
};
