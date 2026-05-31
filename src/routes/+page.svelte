<script lang="ts">
	import { tick } from 'svelte';

	type Message = {
		id: string;
		role: 'user' | 'assistant';
		content: string;
		timestamp: string;
	};

	let conversationId = $state<string | null>(null);
	let messages = $state<Message[]>([]);
	let input = $state('');
	let loading = $state(false);
	let error = $state<string | null>(null);

	let messagesEl = $state<HTMLDivElement | null>(null);

	async function scrollToBottom() {
		await tick();
		messagesEl?.scrollTo({ top: messagesEl.scrollHeight, behavior: 'smooth' });
	}

	async function sendMessage() {
		const text = input.trim();
		if (!text || loading) return;

		input = '';
		error = null;
		loading = true;

		// Optimistically add the user message
		const tempId = crypto.randomUUID();
		messages = [
			...messages,
			{ id: tempId, role: 'user', content: text, timestamp: new Date().toISOString() }
		];
		await scrollToBottom();

		try {
			const res = await fetch('/api/chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ message: text, conversationId })
			});

			if (!res.ok) {
				const err = await res.json().catch(() => ({ message: res.statusText }));
				throw new Error(err.message ?? 'Request failed');
			}

			const data = await res.json();

			// Replace the temp user message with the confirmed one, then add assistant
			conversationId = data.conversationId;
			messages = [
				...messages.filter((m) => m.id !== tempId),
				data.userMessage,
				data.assistantMessage
			];
		} catch (e: unknown) {
			// Remove the optimistic message on failure
			messages = messages.filter((m) => m.id !== tempId);
			error = e instanceof Error ? e.message : 'Something went wrong';
		} finally {
			loading = false;
			await scrollToBottom();
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			sendMessage();
		}
	}

	function formatTime(iso: string) {
		return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}

	function escapeHtml(value: string) {
		return value
			.replaceAll('&', '&amp;')
			.replaceAll('<', '&lt;')
			.replaceAll('>', '&gt;')
			.replaceAll('"', '&quot;')
			.replaceAll("'", '&#39;');
	}

	function renderInlineMarkdown(value: string) {
		return escapeHtml(value)
			.replace(/`([^`]+)`/g, '<code>$1</code>')
			.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
			.replace(/\*([^*]+)\*/g, '<em>$1</em>')
			.replace(
				/\[([^\]]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\)/g,
				'<a href="$2" target="_blank" rel="noreferrer">$1</a>'
			);
	}

	function renderMarkdown(value: string) {
		const lines = value.replace(/\r\n/g, '\n').split('\n');
		const html: string[] = [];
		let paragraph: string[] = [];
		let listItems: string[] = [];
		let orderedList = false;
		let inCodeBlock = false;
		let codeLines: string[] = [];

		function flushParagraph() {
			if (!paragraph.length) return;
			html.push(`<p>${paragraph.map(renderInlineMarkdown).join('<br>')}</p>`);
			paragraph = [];
		}

		function flushList() {
			if (!listItems.length) return;
			html.push(
				`<${orderedList ? 'ol' : 'ul'}>${listItems.join('')}</${orderedList ? 'ol' : 'ul'}>`
			);
			listItems = [];
		}

		for (const line of lines) {
			const trimmed = line.trim();

			if (trimmed.startsWith('```')) {
				flushParagraph();
				flushList();

				if (inCodeBlock) {
					html.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
					codeLines = [];
					inCodeBlock = false;
				} else {
					inCodeBlock = true;
				}
				continue;
			}

			if (inCodeBlock) {
				codeLines.push(line);
				continue;
			}

			if (!trimmed) {
				flushParagraph();
				flushList();
				continue;
			}

			const heading = trimmed.match(/^(#{1,3})\s+(.+)$/);
			if (heading) {
				flushParagraph();
				flushList();
				const level = heading[1].length + 2;
				html.push(`<h${level}>${renderInlineMarkdown(heading[2])}</h${level}>`);
				continue;
			}

			const unordered = trimmed.match(/^[-*]\s+(.+)$/);
			const ordered = trimmed.match(/^\d+\.\s+(.+)$/);
			if (unordered || ordered) {
				flushParagraph();
				const isOrdered = Boolean(ordered);
				if (listItems.length && orderedList !== isOrdered) flushList();
				orderedList = isOrdered;
				listItems.push(`<li>${renderInlineMarkdown((ordered ?? unordered)?.[1] ?? '')}</li>`);
				continue;
			}

			const quote = trimmed.match(/^>\s?(.+)$/);
			if (quote) {
				flushParagraph();
				flushList();
				html.push(`<blockquote>${renderInlineMarkdown(quote[1])}</blockquote>`);
				continue;
			}

			paragraph.push(line);
		}

		flushParagraph();
		flushList();

		if (inCodeBlock && codeLines.length) {
			html.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
		}

		return html.join('');
	}
</script>

<div class="flex h-screen flex-col bg-black text-zinc-100">
	<!-- Header -->
	<header class="border-b border-zinc-800 bg-black px-4 py-3">
		<div class="mx-auto flex max-w-3xl items-center gap-3">
			<div class="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100">
				<svg class="h-5 w-5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-4 4v-4z"
					/>
				</svg>
			</div>
			<div>
				<h1 class="text-sm font-semibold text-zinc-100">Gemini Chat</h1>
				{#if conversationId}
					<p class="font-mono text-xs text-zinc-500">{conversationId}</p>
				{:else}
					<p class="text-xs text-zinc-500">New conversation</p>
				{/if}
			</div>
		</div>
	</header>

	<!-- Messages -->
	<div bind:this={messagesEl} class="flex-1 overflow-y-auto px-4 py-6">
		<div class="mx-auto max-w-3xl space-y-4">
			{#if messages.length === 0}
				<div class="flex flex-col items-center justify-center py-20 text-center">
					<div
						class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-zinc-900 ring-1 ring-zinc-800"
					>
						<svg
							class="h-8 w-8 text-zinc-300"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
							/>
						</svg>
					</div>
					<h2 class="text-lg font-medium text-zinc-200">Start a conversation</h2>
					<p class="mt-1 text-sm text-zinc-500">Ask Gemini anything below.</p>
				</div>
			{/if}

			{#each messages as message (message.id)}
				<div class="flex {message.role === 'user' ? 'justify-end' : 'justify-start'}">
					{#if message.role === 'assistant'}
						<div
							class="mt-1 mr-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-900 ring-1 ring-zinc-700"
						>
							<svg
								class="h-4 w-4 text-zinc-200"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15M14.25 3.104c.251.023.501.05.75.082M19.8 15a2.25 2.25 0 01-2.025 2.244M5 14.5a2.25 2.25 0 002.025 2.244m0 0a24.375 24.375 0 005.95 0m-5.95 0L5 19m9.75-2.256L19.8 19"
								/>
							</svg>
						</div>
					{/if}

					<div class="max-w-[75%]">
						<div
							class="rounded-2xl px-4 py-2.5 text-sm leading-relaxed {message.role === 'user'
								? 'rounded-tr-sm bg-zinc-100 whitespace-pre-wrap text-black'
								: 'rounded-tl-sm bg-zinc-950 text-zinc-100 shadow-sm ring-1 ring-zinc-800'}"
						>
							{#if message.role === 'assistant'}
								<div class="markdown">
									<!-- eslint-disable-next-line svelte/no-at-html-tags -- renderMarkdown escapes text before adding safe Markdown tags. -->
									{@html renderMarkdown(message.content)}
								</div>
							{:else}
								{message.content}
							{/if}
						</div>
						<p
							class="mt-1 text-xs text-zinc-500 {message.role === 'user'
								? 'text-right'
								: 'text-left'}"
						>
							{formatTime(message.timestamp)}
						</p>
					</div>
				</div>
			{/each}

			{#if loading}
				<div class="flex justify-start">
					<div
						class="mt-1 mr-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-900 ring-1 ring-zinc-700"
					>
						<svg class="h-4 w-4 animate-spin text-zinc-200" fill="none" viewBox="0 0 24 24">
							<circle
								class="opacity-25"
								cx="12"
								cy="12"
								r="10"
								stroke="currentColor"
								stroke-width="4"
							></circle>
							<path
								class="opacity-75"
								fill="currentColor"
								d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
							></path>
						</svg>
					</div>
					<div
						class="rounded-2xl rounded-tl-sm bg-zinc-950 px-4 py-3 shadow-sm ring-1 ring-zinc-800"
					>
						<span class="flex gap-1">
							<span class="h-2 w-2 animate-bounce rounded-full bg-zinc-500 [animation-delay:0ms]"
							></span>
							<span class="h-2 w-2 animate-bounce rounded-full bg-zinc-500 [animation-delay:150ms]"
							></span>
							<span class="h-2 w-2 animate-bounce rounded-full bg-zinc-500 [animation-delay:300ms]"
							></span>
						</span>
					</div>
				</div>
			{/if}

			{#if error}
				<div class="flex justify-center">
					<div
						class="flex items-center gap-2 rounded-lg bg-red-950 px-4 py-2 text-sm text-red-200 ring-1 ring-red-800"
					>
						<svg class="h-4 w-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
							<path
								fill-rule="evenodd"
								d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
								clip-rule="evenodd"
							/>
						</svg>
						{error}
					</div>
				</div>
			{/if}
		</div>
	</div>

	<!-- Input -->
	<div class="border-t border-zinc-800 bg-black px-4 py-4">
		<div class="mx-auto max-w-3xl">
			<div class="flex items-end gap-3">
				<textarea
					bind:value={input}
					onkeydown={handleKeydown}
					placeholder="Message Gemini... (Enter to send, Shift+Enter for newline)"
					rows="1"
					disabled={loading}
					class="field-sizing-content max-h-36 min-h-10 flex-1 resize-none rounded-xl border-zinc-700 bg-zinc-950 py-2.5 pr-3 text-sm text-zinc-100 placeholder-zinc-500 focus:border-zinc-400 focus:ring-zinc-400 disabled:bg-zinc-900 disabled:text-zinc-500"
				></textarea>
				<button
					onclick={sendMessage}
					disabled={loading || !input.trim()}
					class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-black transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
					aria-label="Send"
				>
					<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
						/>
					</svg>
				</button>
			</div>
		</div>
	</div>
</div>

<style>
	:global(body) {
		background: #000;
	}

	.markdown {
		overflow-wrap: anywhere;
	}

	.markdown :global(p) {
		margin: 0;
	}

	.markdown :global(p + p),
	.markdown :global(p + ul),
	.markdown :global(p + ol),
	.markdown :global(ul + p),
	.markdown :global(ol + p),
	.markdown :global(pre + p),
	.markdown :global(blockquote + p) {
		margin-top: 0.75rem;
	}

	.markdown :global(h3),
	.markdown :global(h4),
	.markdown :global(h5) {
		margin: 0.75rem 0 0.35rem;
		font-weight: 700;
		color: #fafafa;
	}

	.markdown :global(h3:first-child),
	.markdown :global(h4:first-child),
	.markdown :global(h5:first-child) {
		margin-top: 0;
	}

	.markdown :global(ul),
	.markdown :global(ol) {
		margin: 0.5rem 0 0;
		padding-left: 1.25rem;
	}

	.markdown :global(ul) {
		list-style: disc;
	}

	.markdown :global(ol) {
		list-style: decimal;
	}

	.markdown :global(li + li) {
		margin-top: 0.25rem;
	}

	.markdown :global(code) {
		border-radius: 0.35rem;
		background: #18181b;
		padding: 0.1rem 0.3rem;
		font-size: 0.85em;
		color: #f4f4f5;
	}

	.markdown :global(pre) {
		margin: 0.75rem 0 0;
		overflow-x: auto;
		border-radius: 0.5rem;
		background: #09090b;
		padding: 0.85rem;
		box-shadow: inset 0 0 0 1px #27272a;
	}

	.markdown :global(pre code) {
		background: transparent;
		padding: 0;
	}

	.markdown :global(blockquote) {
		margin: 0.75rem 0 0;
		border-left: 3px solid #52525b;
		padding-left: 0.75rem;
		color: #d4d4d8;
	}

	.markdown :global(a) {
		color: #e4e4e7;
		text-decoration: underline;
		text-underline-offset: 3px;
	}
</style>
