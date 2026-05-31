# Spur Assignment - AI Chat

A full-stack AI chat app built with SvelteKit, Supabase, and Google Gemini. The app stores conversations in Supabase, sends chat history to Gemini for context, and renders assistant replies with Markdown support in a dark chat UI.

## Tech Stack

- SvelteKit 2 and Svelte 5
- TypeScript
- Tailwind CSS
- Supabase PostgreSQL
- Google Generative AI SDK
- Gemini model: `gemini-2.5-flash`

## Features

- Chat UI with optimistic user messages
- Persistent conversations and messages in Supabase
- Server-side Gemini integration through SvelteKit API routes
- Markdown rendering for assistant replies
- Dark theme
- Basic cleanup for model responses that accidentally include planning or draft text

## Project Structure

```txt
src/
  lib/
    server/
      gemma.ts        # Google Generative AI model setup
      supabase.ts     # Supabase admin client
  routes/
    +page.svelte      # Chat UI
    api/
      chat/
        +server.ts    # POST /api/chat
      conversations/
        +server.ts    # POST /api/conversations
        [id]/
          messages/
            +server.ts # GET /api/conversations/:id/messages
```

## Environment Variables

Create a `.env.local` file in the project root:

```env
PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

GOOGLE_AI_API_KEY=your-google-ai-api-key
GEMINI_MODEL=gemini-2.5-flash
```

`SUPABASE_SERVICE_ROLE_KEY` is used only on the server. Do not expose it in browser code.

## Database Schema

Create these tables in Supabase:

```sql
create table conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  timestamp timestamptz not null default now()
);
```

## Running Locally

Install dependencies:

```sh
npm install
```

Start the development server:

```sh
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Available Scripts

```sh
npm run dev      # Start local development server
npm run build    # Build production app
npm run preview  # Preview production build
npm run check    # Run Svelte type checks
npm run lint     # Run Prettier check and ESLint
npm run format   # Format project files
```

## API Overview

`POST /api/chat`

Request:

```json
{
	"message": "Hello",
	"conversationId": "optional-existing-conversation-id"
}
```

Response:

```json
{
	"conversationId": "uuid",
	"userMessage": {
		"id": "uuid",
		"role": "user",
		"content": "Hello",
		"timestamp": "2026-05-31T..."
	},
	"assistantMessage": {
		"id": "uuid",
		"role": "assistant",
		"content": "Hi! How can I help you today?",
		"timestamp": "2026-05-31T..."
	}
}
```

`GET /api/conversations/:id/messages`

Returns all messages for a conversation ordered by timestamp.

## Notes

- Conversation state currently lives in the browser while the page is open. Messages are persisted in Supabase, and the API for loading them exists, but the UI does not yet restore the last conversation after refresh.
- Responses are returned all at once. Streaming would be a good next improvement.
- The current Gemini wrapper is still named `gemma.ts` from the earlier model setup; it now uses `GEMINI_MODEL`.
