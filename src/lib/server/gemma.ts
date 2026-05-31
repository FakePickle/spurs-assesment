import { GoogleGenerativeAI } from '@google/generative-ai';
import { GOOGLE_AI_API_KEY, GEMINI_MODEL } from '$env/static/private';

const genAI = new GoogleGenerativeAI(GOOGLE_AI_API_KEY);
const DEFAULT_MODEL = 'gemini-2.0-flash';
const SUPPORTED_MODELS = new Set(['gemini-2.0-flash', 'gemini-2.5-flash']);

function resolveModelName(): string {
	const configured = GEMINI_MODEL?.trim();
	if (!configured) return DEFAULT_MODEL;
	if (SUPPORTED_MODELS.has(configured)) return configured;
	console.warn(`Unsupported GEMINI_MODEL "${configured}". Falling back to ${DEFAULT_MODEL}.`);
	return DEFAULT_MODEL;
}

export function getModel(systemInstruction: string) {
	return genAI.getGenerativeModel({
		model: resolveModelName(),
		systemInstruction,
		generationConfig: { temperature: 0.3 }
	});
}

export type ChatMessage = {
	role: 'user' | 'model';
	parts: { text: string }[];
};
