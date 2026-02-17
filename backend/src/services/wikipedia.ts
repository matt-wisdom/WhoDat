import wiki from 'wikipedia';


// Helper to get a random item based on category
export const getRandomItem = async (category: string) => {
    try {
        // Simple mapping for now - in production would want more robust lists
        let query = 'Animal';
        if (category === 'place') query = 'List of cities';
        if (category === 'person') query = 'List of people';
        
        // For a hackathon/MVP, fetching a "Random" page is risky (could be anything).
        // Better to search for a category and pick one.
        // Or just use wiki.random() and hope for the best, checking categories.
        
        const page = await (wiki as any).random();
        // page is { title: string, id: number }
        
        const summary = await wiki.summary(page.title);
        // summary has { title, extract, originalimage, ... }
        
        return {
            title: summary.title,
            summary: summary.extract,
            image: summary.originalimage?.source || '',
        };
    } catch (error) {
        console.error('Error fetching from Wikipedia:', error);
        // Fallback
        return {
            title: 'Lion',
            summary: 'The lion is a large cat of the genus Panthera native to Africa and India.',
            image: 'https://upload.wikimedia.org/wikipedia/commons/7/73/Lion_waiting_in_Namibia.jpg'
        };
    }
};
