import { GoogleGenerativeAI } from '@google/generative-ai';
import { pipeline } from '@huggingface/transformers';
import dotenv from 'dotenv';
import { AIPersona } from './ai_personas.js';

dotenv.config();

// --- Gemini (used for AI turn generation) ---
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

// ---------------------------------------------------------------------------
// Qwen2.5-0.5B-Instruct (local ONNX, used for Yes/No QA and guess checking)
// ---------------------------------------------------------------------------
// Uses @huggingface/transformers v3 which supports the `dtype` option to
// select a specific ONNX quantization file (model_q4f16.onnx here).
// The pipeline accepts chat-message arrays and applies the tokenizer's built-in
// chat template automatically, so no hand-crafted prompt strings are needed.
let _qaModel: any = null;

const getQaModel = async () => {
    if (!_qaModel) {
        console.log('[AI] Loading onnx-community/Qwen2.5-0.5B-Instruct (q4f16)...');
        _qaModel = await pipeline(
            'text-generation',
            'onnx-community/Qwen2.5-0.5B-Instruct',
            { dtype: 'q4f16' }  // selects model_q4f16.onnx
        );
        console.log('[AI] Qwen2.5-0.5B-Instruct loaded.');
    }
    return _qaModel;
};

/**
 * Extracts a Yes/No answer from the model's reply text.
 * Causal models can include filler words before the answer, so we scan the
 * beginning of the response rather than rely on a strict startsWith check.
 */
const extractYesNo = (raw: string): 'Yes' | 'No' => {
    const lower = raw.toLowerCase().trim();
    const head = lower.slice(0, 20);
    if (head.includes('yes')) return 'Yes';
    if (head.includes('no')) return 'No';
    // Broader scan as fallback
    if (lower.includes('yes')) return 'Yes';
    return 'No';
};

export const initAI = async () => {
    console.log('AI Service initialized with Gemini (AI turns) + Qwen2.5-0.5B-Instruct (QA).');
    // Pre-warm QA model so the first game turn is fast
    getQaModel().catch(e => console.error('[AI] Failed to pre-warm QA model:', e));
};

/**
 * Uses Qwen2.5-0.5B-Instruct locally to check if a player's guess matches the
 * secret identity title. Optionally includes Wikipedia `fullText` context so
 * the model can recognise nicknames, partial names, and alternate spellings.
 */
export const checkSimilarity = async (
    guess: string,
    groundTruth: string,
    context?: string
): Promise<number> => {
    try {
        const qa = await getQaModel();
        const contextPart = context
            ? `Context: ${context.slice(0, 500)}\n\n`
            : '';
        const userMessage =
            `${contextPart}` +
            `Does "${guess}" refer to the same person or thing as "${groundTruth}"? ` +
            `Ignore spelling differences and consider nicknames or alternate names. ` +
            `Answer with only Yes or No.`;

        const messages = [
            {
                role: 'system',
                content:
                    `You are a helpful assistant. Answer with only Yes or No. ` +
                    `Current date and time: ${new Date().toUTCString()}.`,
            },
            { role: 'user', content: userMessage },
        ];

        const output = await qa(messages, { max_new_tokens: 10 });
        // v3 returns the full conversation; the last message is the assistant reply
        const raw: string = output[0]?.generated_text?.at(-1)?.content ?? '';
        return extractYesNo(raw) === 'Yes' ? 1.0 : 0.0;
    } catch (e) {
        console.error('Error in checkSimilarity:', e);
        return 0;
    }
};

/**
 * Uses Qwen2.5-0.5B-Instruct locally to answer a Yes/No game question.
 * `context` should be the `fullText` field from WikiItem — up to 4 000 chars
 * of plain-text Wikipedia article content.
 */
export const answerQuestion = async (question: string, context: string): Promise<string> => {
    try {
        const qa = await getQaModel();
        const messages = [
            {
                role: 'system',
                content:
                    'You are answering questions in a guessing game. ' +
                    'Use the provided context to answer with only Yes or No. ' +
                    `Current date and time: ${new Date().toUTCString()}.`,
            },
            {
                role: 'user',
                content:
                    `Context: ${context.slice(0, 4_000)}\n\n` +
                    `Question: ${question}`,
            },
        ];

        const output = await qa(messages, { max_new_tokens: 10 });
        const raw: string = output[0]?.generated_text?.at(-1)?.content ?? '';
        return extractYesNo(raw);
    } catch (error) {
        console.error('Error in answerQuestion (Qwen2.5):', error);
        return 'No';
    }
};

/**
 * Uses Gemini to generate the AI player's next turn (ask a question or guess).
 */
export const generateAITurn = async (
    persona: AIPersona,
    category: string,
    history: string[]
): Promise<{ action: 'QUESTION' | 'GUESS'; content: string }> => {
    try {
        const answeredCount = history.length;
        const guessPrompt =
            answeredCount >= 5
                ? `\n\nIMPORTANT: You have received ${answeredCount} answers already. You MUST make a GUESS now unless you have zero useful information. Do not ask another question.`
                : answeredCount >= 3
                ? `\n\nYou have ${answeredCount} answers. Strongly consider making a GUESS if you can narrow down the identity from what you know.`
                : '';

        const prompt = `
        ${persona.systemPrompt}

        Current Game Context:
        We are playing "Who/What Am I?". You must guess your own secret identity by asking YES/NO questions.
        The identity is ALWAYS a real, well-known entity — never fictional.
        Category: ${category}. The identity belongs to this category. Ask questions specific to this category.

        Your Q&A history so far (read carefully — build on every answer):
        ${history.length > 0 ? history.join('\n') : 'No questions asked yet.'}${guessPrompt}

        Rules:
        - NEVER repeat a question already in the history above.
        - Use every Yes and No answer to eliminate possibilities and focus your next move.
        - If you have enough to make a confident guess, choose GUESS over asking more questions.
        - Your guess must be a real name (e.g. "Albert Einstein", "France", "Mount Everest").
        
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
            generationConfig: { responseMimeType: 'application/json' },
        });

        const text = result.response.text();
        // Strip any markdown code fences if present
        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const action = JSON.parse(jsonStr);

        return {
            action: action.action === 'GUESS' ? 'GUESS' : 'QUESTION',
            content: action.content,
        };
    } catch (e) {
        console.error('Error generating AI turn:', e);
        return { action: 'QUESTION', content: 'Is it a person?' };
    }
};
