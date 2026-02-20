import { GoogleGenerativeAI } from '@google/generative-ai';
import { pipeline } from '@xenova/transformers';
import dotenv from 'dotenv';
import { AIPersona } from './ai_personas.js';

dotenv.config();

// --- Gemini (used for AI turn generation and similarity checks) ---
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
// User requested specific model version
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

// --- Flan-T5 Base (used for Yes/No question answering) ---
// Base is significantly better than Small at following Yes/No instructions
let _qaModel: any = null;
const getQaModel = async () => {
    if (!_qaModel) {
        console.log('[AI] Loading Flan-T5 Base for QA...');
        _qaModel = await pipeline('text2text-generation', 'Xenova/flan-t5-base');
        console.log('[AI] Flan-T5 Base loaded.');
    }
    return _qaModel;
};

export const initAI = async () => {
    console.log('AI Service initialized with Gemini + Flan-T5 Base.');
    // Pre-warm QA model so first game turn is fast
    getQaModel().catch(e => console.error('[AI] Failed to pre-warm QA model:', e));
};

/**
 * Uses Flan-T5 Base locally to check if a guess matches the secret identity.
 * An optional `context` (Wikipedia fullText) is included in the prompt so the
 * model can handle partial names, nicknames, or alternate spellings.
 */
export const checkSimilarity = async (
    guess: string,
    groundTruth: string,
    context?: string
): Promise<number> => {
    try {
        const qa = await getQaModel();
        const contextClause = context
            ? `\nContext about the answer: ${context.slice(0, 500)}`
            : '';
        const prompt =
            `Answer with only Yes or No.${contextClause}\n` +
            `Question: Does "${guess}" refer to the same person or thing as "${groundTruth}"? ` +
            `Ignore spelling differences and consider nicknames or alternate names. Yes or No? Answer: `;
        const output = await qa(prompt, { max_new_tokens: 5 });
        const answer = (output[0]?.generated_text || '').trim().toLowerCase();
        return answer.startsWith('yes') ? 1.0 : 0.0;
    } catch (e) {
        console.error('Error in checkSimilarity:', e);
        return 0;
    }
};

/**
 * Uses Flan-T5 Base locally to answer a Yes/No game question based on the
 * target's Wikipedia article text. The `context` should be the `fullText`
 * field from WikiItem which contains up to 4 000 chars of article content.
 */
export const answerQuestion = async (question: string, context: string): Promise<string> => {
    try {
        const qa = await getQaModel();
        // Use up to 4 000 chars — the model's effective context window.
        // Flan-T5 text2text format: instruction + rich context + question.
        const prompt = `Answer with only Yes or No.\nContext: ${context.slice(0, 4_000)}\nQuestion: ${question}?. Yes or No?. Answer: `;
        const output = await qa(prompt, { max_new_tokens: 5 });
        const answer = (output[0]?.generated_text || '').trim().toLowerCase();
        return answer.startsWith('yes') ? 'Yes' : 'No';
    } catch (error) {
        console.error('Error in answerQuestion (Flan-T5):', error);
        return 'No';
    }
};

export const generateAITurn = async (persona: AIPersona, category: string, history: string[]): Promise<{ action: 'QUESTION' | 'GUESS', content: string }> => {
    try {
        const prompt = `
        ${persona.systemPrompt}
        
        Current Game Context:
        We are playing "Who/What Am I?". You must guess your own secret identity by asking YES/NO questions.
        Category: ${category} — your secret identity is something from this category. Ask questions relevant to this category only.
        
        Your Q&A history so far:
        ${history.length > 0 ? history.join('\n') : 'No questions asked yet.'}
        
        Based on the history above, ask a smart YES/NO question to narrow down your identity, or make a GUESS if you are confident.
        Do NOT repeat questions already asked.
        
        Output Format (JSON ONLY, no markdown):
        {
            "action": "QUESTION" or "GUESS",
            "content": "your question or guess here"
        }
        `;
        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: 'application/json' }
        });

        
        const text = result.response.text();

        // Clean markdown code blocks if present
        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const action = JSON.parse(jsonStr);
        
        return {
            action: action.action === 'GUESS' ? 'GUESS' : 'QUESTION',
            content: action.content
        };
    } catch (e) {
        console.error('Error generating AI turn:', e);
        // Fallback
        return { action: 'QUESTION', content: 'Is it a person?' };
    }
};
