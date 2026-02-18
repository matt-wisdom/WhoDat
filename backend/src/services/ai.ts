import { pipeline, env } from '@xenova/transformers';

// Skip local model checks if needed, or configure cache
env.allowLocalModels = false; // Force download from HF initially
env.useBrowserCache = false;

// Singleton instances
let similarityModel: any = null;
let qaModel: any = null;

export const initAI = async () => {
    console.log('Loading AI models... this may take a moment on first run.');
    
    // Feature extraction for similarity (Embeddings)
    if (!similarityModel) {
        similarityModel = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    }

    // Text2Text for QA
    if (!qaModel) {
        qaModel = await pipeline('text2text-generation', 'Xenova/flan-t5-small');
    }
    
    console.log('AI Models loaded.');
};

// Compute Cosine Similarity
function cosineSimilarity(a: number[], b: number[]) {
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    return dotProduct / (magnitudeA * magnitudeB);
}

export const checkSimilarity = async (guess: string, groundTruth: string): Promise<number> => {
    if (!similarityModel) await initAI();
    
    try {
        const output1 = await similarityModel(guess, { pooling: 'mean', normalize: true });
        const output2 = await similarityModel(groundTruth, { pooling: 'mean', normalize: true });
        
        const vec1 = Array.from(output1.data) as number[];
        const vec2 = Array.from(output2.data) as number[];
        
        return cosineSimilarity(vec1, vec2);
    } catch (error) {
        console.error('Error in checkSimilarity:', error);
        return 0;
    }
};

export const answerQuestion = async (question: string, context: string): Promise<string> => {
    if (!qaModel) await initAI();

    try {
        // Prompt engineering for FLAN-T5
        // We act as a strict classifier.
        const prompt = `Context: ${context}\nQuestion: ${question}\nAnswer yes/no/maybe:`;
        const output = await qaModel(prompt, { max_new_tokens: 10 });
        
        let answer = output[0]?.generated_text || '';
        console.log(`[AI Raw] Q: "${question}" -> A: "${answer}"`); // Log for debug
        
        // Strict Post-processing
        const normalized = answer.toLowerCase().trim();
        
        if (normalized.includes('yes')) return 'Yes';
        if (normalized.includes('no')) return 'No';
        if (normalized.includes('maybe') || normalized.includes('unsure') || normalized.includes('depend')) return 'Maybe';

        // Fallback for unable to determine
        return 'Maybe';
    } catch (error) {
        console.error('Error in answerQuestion:', error);
        return 'Maybe';
    }
};
