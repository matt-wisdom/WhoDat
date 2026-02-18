


// Helper to get a random item based on category
export const getRandomItem = async (category: string) => {
    try {
        const topics = [
            'Albert Einstein', 'Barack Obama', 'Taylor Swift', 'Elon Musk', 'Lionel Messi',
            'Leonardo da Vinci', 'William Shakespeare', 'Marilyn Monroe', 'Steve Jobs', 'Serena Williams',
            'Lion', 'Elephant', 'Giraffe', 'Penguin', 'Dolphin', 'Tiger', 'Panda', 'Kangaroo'
        ];
        
        const randomTitle = topics[Math.floor(Math.random() * topics.length)];
        const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(randomTitle)}`;
        
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'WhoDatGame/1.0 (http://localhost:8080; admin@example.com) node-fetch'
            }
        });

        if (!response.ok) {
            throw new Error(`Wikipedia API error: ${response.status}`);
        }

        const summary = await response.json();
        
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
