


// Helper to get a random item based on category
// Helper to get multiple unique items
export const getRandomItems = async (category: string, count: number) => {
    const categories: Record<string, string[]> = {
        'People': [
            'Albert Einstein', 'Barack Obama', 'Taylor Swift', 'Elon Musk', 'Lionel Messi',
            'Leonardo da Vinci', 'William Shakespeare', 'Marilyn Monroe', 'Steve Jobs', 'Serena Williams',
            'Beyoncé', 'Oprah Winfrey', 'Cristiano Ronaldo', 'Muhammad Ali', 'Michael Jordan',
            'Pablo Picasso', 'Vincent van Gogh', 'Walt Disney', 'Elvis Presley', 'Madonna'
        ],
        'Animals': [
            'Lion', 'Elephant', 'Giraffe', 'Penguin', 'Dolphin', 'Tiger', 'Panda', 'Kangaroo',
            'Zebra', 'Gorilla', 'Polar Bear', 'Koala', 'Cheetah', 'Wolf', 'Eagle',
            'Octopus', 'Shark', 'Whale', 'Crocodile', 'Rhinoceros'
        ],
        'Countries': [
            'United States', 'China', 'India', 'Brazil', 'France', 'Japan', 'Germany', 'Italy',
            'United Kingdom', 'Canada', 'Australia', 'Russia', 'Spain', 'Mexico', 'Egypt',
            'South Africa', 'Argentina', 'Thailand', 'Turkey', 'South Korea'
        ],
        'Places': [
            'Eiffel Tower', 'Great Wall of China', 'Statue of Liberty', 'Taj Mahal', 'Machu Picchu',
            'Colosseum', 'Pyramids of Giza', 'Grand Canyon', 'Sydney Opera House', 'Mount Everest',
            'Niagara Falls', 'Petra', 'Stonehenge', 'Burj Khalifa', 'Disneyland',
            'Louvre Museum', 'Golden Gate Bridge', 'Christ the Redeemer', 'Acropolis of Athens', 'Times Square'
        ]
    };

    const list = categories[category] || categories['Animals'];
    
    // Shuffle list using Fisher-Yates
    const shuffled = [...list];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // specific items to fetch
    const selectedTitles = shuffled.slice(0, count);
    
    // allow duplicates if we request more than available? No, simply loop if needed or just return what we have?
    // Ideally user shouldn't request more than available list size (which is ~20 now).
    // Game max players usually small.
    
    const promises = selectedTitles.map(async (title) => {
         const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
         try {
            const response = await fetch(url, {
                headers: { 'User-Agent': 'WhoDatGame/1.0' }
            });
            if (!response.ok) throw new Error('Wiki Error');
            const summary = await response.json();
            return {
                title: summary.title,
                summary: summary.extract,
                image: summary.originalimage?.source || '',
            };
         } catch (e) {
             return {
                 title: title,
                 summary: 'No summary available.',
                 image: ''
             };
         }
    });

    return Promise.all(promises);
};

export const getRandomItem = async (category: string) => {
    const items = await getRandomItems(category, 1);
    return items[0];
};
