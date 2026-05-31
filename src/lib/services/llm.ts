import { getModel } from '$lib/server/gemma';

const MAX_INPUT_CHARS = 2000;

const SYSTEM_PROMPT = `You are a friendly and knowledgeable customer support agent for Sparq Store, a modern e-commerce store. Answer questions clearly and concisely. Stay on topic and only help with store-related questions.

STORE KNOWLEDGE:

Shipping:
- Standard shipping: 5–7 business days
- Express shipping: 2 business days
- Free standard shipping on orders over $50
- We ship to: United States (US), United Kingdom (UK), Canada (CA), and Australia (AU)

Returns & Refunds:
- 30-day return window from delivery date
- Items must be unused and in original packaging
- Refunds are processed within 5–7 business days after we receive the return

Support Hours:
- Monday to Friday, 9 AM – 6 PM EST
- Outside these hours, leave a message and we'll respond next business day

If a customer asks about something outside this knowledge base, let them know you can pass the query to a human agent during support hours.`;

export async function generateReply(
	history: { role: string; content: string }[],
	userMessage: string
): Promise<string> {
	const text = userMessage.slice(0, MAX_INPUT_CHARS);

	const chatHistory = history.map((msg) => ({
		role: msg.role === 'assistant' ? 'model' : 'user',
		parts: [{ text: msg.content }]
	}));

	try {
		const model = getModel(SYSTEM_PROMPT);
		const chat = model.startChat({ history: chatHistory });
		const result = await chat.sendMessage(text);
		return result.response.text();
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : String(e);

		if (msg.includes('API_KEY') || msg.includes('401')) {
			throw new Error('AI service authentication failed. Please contact support.');
		}
		if (msg.includes('429') || msg.toLowerCase().includes('rate limit')) {
			throw new Error('The AI service is temporarily busy. Please try again in a moment.');
		}
		if (msg.includes('timeout') || msg.includes('ETIMEDOUT')) {
			throw new Error('The AI service timed out. Please try again.');
		}

		throw new Error('The AI service is currently unavailable. Please try again later.');
	}
}
