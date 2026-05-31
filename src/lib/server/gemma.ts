import { GoogleGenerativeAI } from '@google/generative-ai';
import { GOOGLE_AI_API_KEY, GEMINI_MODEL } from '$env/static/private';

const genAI = new GoogleGenerativeAI(GOOGLE_AI_API_KEY);
const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
const SUPPORTED_GEMINI_MODELS = new Set(['gemini-2.5-flash']);

const systemInstruction = [
	'You are a helpful conversational assistant.',
	'Reply with only the final answer that should be shown to the user.',
	'Keep replies direct and natural.',
	'Do not include labels, hidden notes, analysis, constraints, goals, alternatives, or drafts.'
].join(' ');

function getGemmaModelName() {
	const configuredModel = GEMINI_MODEL?.trim();

	if (!configuredModel) return DEFAULT_GEMINI_MODEL;
	if (SUPPORTED_GEMINI_MODELS.has(configuredModel)) return configuredModel;

	console.warn(
		`Unsupported GEMINI_MODEL "${configuredModel}". Falling back to ${DEFAULT_GEMINI_MODEL}.`
	);
	return DEFAULT_GEMINI_MODEL;
}

export function getModel() {
	return genAI.getGenerativeModel({
		model: getGemmaModelName(),
		systemInstruction,
		generationConfig: {
			temperature: 0.3
		}
	});
}

export type ChatMessage = {
	role: 'user' | 'model';
	parts: { text: string }[];
};
