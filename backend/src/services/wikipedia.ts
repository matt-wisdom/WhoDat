/**
 * Wikipedia service.
 *
 * `getRandomItems` / `getRandomItem` now draw from the persistent wiki_cache
 * (populated by wikiCache.ts) rather than making live API calls at game time.
 *
 * `fetchPageSummary` and `fetchFullExtract` are kept as exported helpers so
 * that wikiCache.ts can reuse them when populating / refreshing the cache.
 */

/** A single Wikipedia item returned to consumers. */
export interface WikiItem {
    title: string;
    /** Short introductory extract shown in the game UI. */
    summary: string;
    /** Full article text (up to ~4 000 chars) used as AI Q&A context. */
    fullText: string;
    image: string;
}

// ---------------------------------------------------------------------------
// Shared fetch helpers (used by wikiCache.ts to build the cache)
// ---------------------------------------------------------------------------

/**
 * Fetches the REST summary for a single Wikipedia page title.
 * Returns null if the page cannot be fetched or is a disambiguation page.
 */
export const fetchPageSummary = async (
    title: string
): Promise<{ title: string; summary: string; image: string } | null> => {
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;

    try {
        const response = await fetch(url, {
            headers: { 'User-Agent': 'WhoDatGame/1.0 (contact@whodat.game)' },
        });

        if (!response.ok) return null;

        const data = await response.json();
        if (data.type === 'disambiguation') return null;

        return {
            title: data.title,
            summary: data.extract ?? 'No summary available.',
            image: data.originalimage?.source ?? '',
        };
    } catch {
        return null;
    }
};

/**
 * Fetches a longer plain-text article extract via the MediaWiki query API.
 * Returns an empty string on failure.
 */
export const fetchFullExtract = async (title: string): Promise<string> => {
    const params = new URLSearchParams({
        action: 'query',
        titles: title,
        prop: 'extracts',
        explaintext: '1',
        exsectionformat: 'plain',
        format: 'json',
        origin: '*',
    });

    try {
        const response = await fetch(
            `https://en.wikipedia.org/w/api.php?${params.toString()}`,
            { headers: { 'User-Agent': 'WhoDatGame/1.0 (contact@whodat.game)' } }
        );
        if (!response.ok) return '';

        const data = await response.json();
        const pages: Record<string, { extract?: string }> = data?.query?.pages ?? {};
        const page = Object.values(pages)[0];
        return (page?.extract ?? '').slice(0, 4_000);
    } catch {
        return '';
    }
};

// ---------------------------------------------------------------------------
// Public game API — reads from the wiki_cache at game time
// ---------------------------------------------------------------------------

/**
 * Returns `count` unique random WikiItems for `category` from the local cache.
 * Falls back to a direct Wikipedia fetch if the cache is empty (e.g. first
 * boot before the background population has finished).
 */
export const getRandomItems = async (
    category: string,
    count: number
): Promise<WikiItem[]> => {
    // Lazy import to avoid circular dependency at module load time
    const { getRandomCachedItems } = await import('./wikiCache.js');
    const cached = getRandomCachedItems(category, count);

    if (cached.length >= count) {
        return cached;
    }

    // Fallback: live fetch from Wikipedia for the shortfall
    console.warn(
        `[Wikipedia] Cache miss for "${category}" (have ${cached.length}, need ${count}). Falling back to live fetch.`
    );

    const needed = count - cached.length;
    const titles = (await import('../data/predefined.js')).PREDEFINED_TITLES[category] ?? [];

    // Pick random titles not already in cached results
    const usedTitles = new Set(cached.map(c => c.title));
    const candidates = titles
        .filter(t => !usedTitles.has(t))
        .sort(() => Math.random() - 0.5)
        .slice(0, needed * 3);

    const results: WikiItem[] = [...cached];

    for (const title of candidates) {
        if (results.length >= count) break;
        const [summary, fullText] = await Promise.all([
            fetchPageSummary(title),
            fetchFullExtract(title),
        ]);
        if (!summary) continue;
        results.push({
            title: summary.title,
            summary: summary.summary,
            fullText: fullText || summary.summary,
            image: summary.image,
        });
    }

    if (results.length < count) {
        throw new Error(
            `Could not retrieve ${count} items for category "${category}" (got ${results.length}).`
        );
    }

    return results.slice(0, count);
};

/**
 * Returns a single random WikiItem for `category`.
 */
export const getRandomItem = async (category: string): Promise<WikiItem> => {
    const items = await getRandomItems(category, 1);
    return items[0];
};
