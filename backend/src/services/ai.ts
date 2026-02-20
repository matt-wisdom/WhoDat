import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import { AIPersona } from './ai_personas.js';

dotenv.config();

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
// User requested specific model version
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

export const initAI = async () => {
    console.log('AI Service initialized with Gemini.');
};

export const checkSimilarity = async (guess: string, groundTruth: string): Promise<number> => {
    // We can use Gemini to judge similarity too, simpler than embeddings for now?
    // Or we can keep the local embedding model if user wants, but Gemini is requested.
    // Let's use Gemini to judge "Is X the same as Y?"
    try {
        const prompt = `
        Decide if the guess "${guess}" is semantically equivalent to or refers to the same thing as the secret identity "${groundTruth}".
        Ignore minor spelling mistakes or variations (e.g. "Obama" == "Barack Obama").
        Return a score between 0.0 and 1.0 where 1.0 is a match and 0.0 is completely different.
        Return ONLY the number.
        `;
        const result = await model.generateContent(prompt);
        const score = parseFloat(result.response.text());
        return isNaN(score) ? 0 : score;
    } catch (e) {
        console.error('Error in checkSimilarity:', e);
        return 0; // Fail safe
    }
};

export const answerQuestion = async (question: string, context: string): Promise<string> => {
    try {
        const prompt = `
        Context: ${context}
        Question: ${question}
        
        You are the Game Master. Answer the question based ONLY on the context provided.
        Rules:
        1. Answer ONLY "Yes" or "No".
        2. If the answer is unsure or maybe, default to "No".
        3. Do not explain.
        
        Answer:`;
        
        const result = await model.generateContent(prompt);
        const text = result.response.text().trim().toLowerCase();
        
        if (text.includes('yes')) return 'Yes';
        return 'No';
    } catch (error) {
        console.error('Error in answerQuestion:', error);
        return 'No';
    }
};

export const generateAITurn = async (persona: AIPersona, context: string, history: string[]): Promise<{ action: 'QUESTION' | 'GUESS', content: string }> => {
    try {
        const prompt = `
        ${persona.systemPrompt}
        
        Current Game Context:
        We are playing "Who am I?". The goal is to guess a secret identity.
        
        Game State:
        ${history.length > 0 ? 'History:\n' + history.join('\n') : 'No history yet.'}
        
        It is your turn.
        You can either:
        1. Ask a YES/NO question to narrow down the identity.
        2. Make a GUESS if you are confident.
        
        Output Format (JSON ONLY):
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
