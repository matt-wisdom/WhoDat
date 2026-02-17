import txtai from 'txtai';

const spring = new txtai.Embeddings('http://localhost:8000');
const extractor = new txtai.Extractor('http://localhost:8000');

export const checkSimilarity = async (guess: string, groundTruth: string): Promise<number> => {
    try {
        const results = await spring.similarity(guess, [groundTruth]);
        // results is array of {id, score} or just scores depending on input. 
        // With single query and list, it usually returns list of {id, score}.
        // Let's assume it returns {id: index, score: number}[]
        if (results && results.length > 0) {
            return results[0].score;
        }
        return 0;
    } catch (error) {
        console.error('Error checking similarity:', error);
        return 0;
    }
};

export const answerQuestion = async (question: string, context: string): Promise<string> => {
    try {
        const data = [{ query: question, question: question, context: context }];
        const results = await extractor.extract(data);
        // Extractor returns array of {answer, score} or similar.
        if (results && results.length > 0) {
            return results[0].answer;
        }
        return 'I cannot answer that.';
    } catch (error) {
        console.error('Error asking question:', error);
        return 'Error processing question.';
    }
};
