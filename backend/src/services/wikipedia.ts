
/**
 * Wikipedia service for fetching random items from real Wikipedia categories.
 * Uses the MediaWiki API to list category members, filters by page-view
 * popularity, then fetches page summaries.
 */

/** Configuration for a single game category. */
interface CategoryConfig {
    /** One or more Wikipedia category slugs to draw articles from. */
    categories: string[];
    /**
     * Minimum average monthly page views required for an article to be
     * included. Use this to filter out obscure entries.
     * Set to 0 (or omit) to skip the popularity filter for a category.
     */
    minMonthlyViews?: number;
}

/**
 * Maps game-facing category names to Wikipedia category slugs and an optional
 * popularity threshold.
 *
 * Tips:
 *  - Avoid top-level meta-categories (e.g. Category:Animals) — they contain
 *    only subcategories, not article pages.
 *  - Use leaf-level or well-populated mid-level categories instead.
 *  - List multiple slugs to merge them before sampling.
 *  - Raise minMonthlyViews to get more famous/recognisable results.
 */
const CATEGORY_MAP: Record<string, CategoryConfig> = {
    Animals: {
        categories: ['Category:Individual_animals'],
        minMonthlyViews: 0,
    },
    People: {
        // Curated categories that by definition contain globally famous people.
        // Broad categories (Living_people) are intentionally excluded — they
        // contain millions of obscure biographies.
        categories: [
            'Category:Academy_Award_winners',
            'Category:Grammy_Award_winners',
            'Category:Nobel_laureates',
            'Category:Olympic_gold_medalists',
            'Category:Heads_of_government',
            'Category:Monarchs',
            'Category:Forbes_list_of_billionaires',
            'Category:American_film_actors',
            'Category:English_footballers',
            'Category:Ancient_Greek_philosophers',
        ],
        // 200 k views/month keeps only household names within those already
        // famous categories.
        minMonthlyViews: 200_000,
    },
    Countries: {
        categories: ['Category:Member_states_of_the_United_Nations'],
        minMonthlyViews: 0,
    },
    Places: {
        categories: ['Category:World_Heritage_Sites'],
        minMonthlyViews: 0,
    },
};

/** A single Wikipedia item returned to consumers. */
export interface WikiItem {
    title: string;
    /** Short introductory extract (1–3 sentences) shown in the game UI. */
    summary: string;
    /**
     * Full article text (up to ~4 000 chars) used as context for AI Q&A.
     * Contains significantly more biographical detail than `summary`.
     */
    fullText: string;
    image: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Fetches all page-level members of a Wikipedia category using the MediaWiki
 * API. Returns up to `limit` member titles (max 500 per API call).
 */
const fetchCategoryMembers = async (
    category: string,
    limit: number = 500
): Promise<string[]> => {
    const params = new URLSearchParams({
        action: 'query',
        list: 'categorymembers',
        cmtitle: category,
        cmtype: 'page',
        cmlimit: String(Math.min(limit, 500)),
        format: 'json',
        origin: '*',
    });

    const url = `https://en.wikipedia.org/w/api.php?${params.toString()}`;

    const response = await fetch(url, {
        headers: { 'User-Agent': 'WhoDatGame/1.0 (contact@whodat.game)' },
    });

    if (!response.ok) {
        throw new Error(`Wikipedia category fetch failed: ${response.statusText}`);
    }

    const data = await response.json();
    const members: Array<{ title: string }> = data?.query?.categorymembers ?? [];
    return members.map((m) => m.title);
};

/**
 * Fetches and merges page titles from multiple Wikipedia category slugs.
 * Deduplicates results so a title appearing in more than one category is only
 * returned once.
 */
const fetchMergedCategoryMembers = async (
    categories: string[],
    limitPerCategory: number = 500
): Promise<string[]> => {
    const results = await Promise.all(
        categories.map((cat) => fetchCategoryMembers(cat, limitPerCategory))
    );

    const seen = new Set<string>();
    const merged: string[] = [];
    for (const titles of results) {
        for (const title of titles) {
            if (!seen.has(title)) {
                seen.add(title);
                merged.push(title);
            }
        }
    }
    return merged;
};

/**
 * Returns the total page views for a Wikipedia article over the most recent
 * complete calendar month. Returns 0 on any error so the caller can safely
 * compare against a threshold.
 */
const fetchMonthlyPageViews = async (title: string): Promise<number> => {
    // Build YYYYMMDD strings for the first day of the previous two months
    // (start = 1st of last month, end = last day of last month via '01' of current).
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endDate = new Date(now.getFullYear(), now.getMonth(), 1);

    const fmt = (d: Date): string =>
        `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}01`;

    const url =
        `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/` +
        `en.wikipedia/all-access/all-agents/${encodeURIComponent(title)}/` +
        `monthly/${fmt(startDate)}/${fmt(endDate)}`;

    try {
        const response = await fetch(url, {
            headers: { 'User-Agent': 'WhoDatGame/1.0 (contact@whodat.game)' },
        });
        if (!response.ok) return 0;

        const data = await response.json();
        const items: Array<{ views: number }> = data?.items ?? [];
        return items.reduce((sum, item) => sum + (item.views ?? 0), 0);
    } catch {
        return 0;
    }
};

/**
 * Filters a list of titles to only those with at least `minMonthlyViews`
 * page views in the last calendar month. Checks are made in parallel.
 */
const filterByPopularity = async (
    titles: string[],
    minMonthlyViews: number
): Promise<string[]> => {
    if (minMonthlyViews <= 0) return titles;

    const viewCounts = await Promise.all(
        titles.map(async (title) => ({
            title,
            views: await fetchMonthlyPageViews(title),
        }))
    );

    return viewCounts
        .filter(({ views }) => views >= minMonthlyViews)
        .map(({ title }) => title);
};

/**
 * Fetches a longer plain-text extract for a Wikipedia article using the
 * MediaWiki query API. Returns an empty string on failure so callers can
 * fall back gracefully.
 */
const fetchFullExtract = async (title: string): Promise<string> => {
    const params = new URLSearchParams({
        action: 'query',
        titles: title,
        prop: 'extracts',
        explaintext: '1',   // plain text — strip all HTML/wikitext
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
        const pages: Record<string, { extract?: string }> =
            data?.query?.pages ?? {};
        const page = Object.values(pages)[0];
        // Cap at 4 000 chars — enough for multi-section context without
        // overwhelming the LLM prompt.
        return (page?.extract ?? '').slice(0, 4_000);
    } catch {
        return '';
    }
};

/**
 * Fetches the REST summary AND a full article extract for a Wikipedia page.
 * Returns null if the page cannot be fetched or is a disambiguation page.
 */
const fetchPageSummary = async (title: string): Promise<WikiItem | null> => {
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;

    try {
        const [response, fullText] = await Promise.all([
            fetch(url, {
                headers: { 'User-Agent': 'WhoDatGame/1.0 (contact@whodat.game)' },
            }),
            fetchFullExtract(title),
        ]);

        if (!response.ok) return null;

        const summary = await response.json();

        // Skip disambiguation pages
        if (summary.type === 'disambiguation') return null;

        return {
            title: summary.title,
            summary: summary.extract ?? 'No summary available.',
            fullText: fullText || summary.extract || 'No information available.',
            image: summary.originalimage?.source ?? '',
        };
    } catch {
        return null;
    }
};

/**
 * Picks `count` random elements from an array using Fisher-Yates partial
 * shuffle.
 */
const pickRandom = <T>(arr: T[], count: number): T[] => {
    const pool = [...arr];
    const result: T[] = [];

    for (let i = 0; i < Math.min(count, pool.length); i++) {
        const j = i + Math.floor(Math.random() * (pool.length - i));
        [pool[i], pool[j]] = [pool[j], pool[i]];
        result.push(pool[i]);
    }

    return result;
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns `count` unique, random Wikipedia items from the given game category.
 *
 * Flow:
 *  1. Fetch all titles from the configured Wikipedia categories.
 *  2. Apply a popularity filter (if configured) to drop obscure articles.
 *  3. Pick a random over-sample of candidates.
 *  4. Fetch page summaries in parallel, discarding failures or disambiguation.
 *  5. Return the first `count` valid results.
 */
export const getRandomItems = async (
    category: string,
    count: number
): Promise<WikiItem[]> => {
    const config = CATEGORY_MAP[category] ?? CATEGORY_MAP['Animals'];

    let allTitles = await fetchMergedCategoryMembers(config.categories);

    if (allTitles.length === 0) {
        throw new Error(
            `No members found for Wikipedia categories: ${config.categories.join(', ')}`
        );
    }

    // Apply popularity filter when a threshold is set for this category.
    // Sample a large pool first so the view-count check has plenty to work with —
    // a tiny pre-sample is the main failure mode (bad luck lands all obscure titles).
    const { minMonthlyViews = 0 } = config;
    if (minMonthlyViews > 0) {
        // Check at least 60 candidates, or 20× the number we need — whichever is larger.
        const presampleSize = Math.min(allTitles.length, Math.max(count * 20, 60));
        const preSample = pickRandom(allTitles, presampleSize);

        // Progressively halve the threshold up to 3 times as a fallback so we
        // never hard-crash simply due to a bad random draw.
        let threshold = minMonthlyViews;
        let popular: string[] = [];
        for (let attempt = 0; attempt <= 3; attempt++) {
            popular = await filterByPopularity(preSample, threshold);
            if (popular.length > 0) break;
            threshold = Math.floor(threshold / 2);
            console.warn(
                `[wikipedia] No titles met ${threshold * 2} views/month for "${category}". ` +
                `Retrying with threshold ${threshold}.`
            );
        }

        if (popular.length === 0) {
            // Last resort: use the unfiltered pre-sample rather than crashing.
            console.warn(
                `[wikipedia] Popularity filter fully exhausted for "${category}". Falling back to unfiltered sample.`
            );
            allTitles = preSample;
        } else {
            allTitles = popular;
        }
    }

    // Fetch summaries — use the whole popular pool first (not a sub-sample) so
    // that summary failures don't leave us short when the pool is small.
    // If we still don't have enough, keep drawing fresh batches from allTitles.
    const usedTitles = new Set<string>();
    const valid: WikiItem[] = [];

    // First pass: try every title that survived the popularity filter.
    const initialCandidates = allTitles.filter((t) => !usedTitles.has(t));
    initialCandidates.forEach((t) => usedTitles.add(t));
    const initialSummaries = await Promise.all(initialCandidates.map(fetchPageSummary));
    for (const s of initialSummaries) {
        if (s) valid.push(s);
        if (valid.length >= count) break;
    }

    // Retry passes: draw extra random titles from the full (unfiltered) list
    // when the popular pool is exhausted but we still need more.
    const allUnfiltered = await fetchMergedCategoryMembers(config.categories);
    let retries = 0;
    while (valid.length < count && retries < 5) {
        retries++;
        const remaining = allUnfiltered.filter((t) => !usedTitles.has(t));
        if (remaining.length === 0) break;

        const batch = pickRandom(remaining, Math.max(count * 3, 10));
        batch.forEach((t) => usedTitles.add(t));

        const batchSummaries = await Promise.all(batch.map(fetchPageSummary));
        for (const s of batchSummaries) {
            if (s) valid.push(s);
            if (valid.length >= count) break;
        }
    }

    if (valid.length < count) {
        throw new Error(
            `Could only retrieve ${valid.length} valid items from category "${category}", needed ${count} after ${retries} retries.`
        );
    }

    return valid.slice(0, count);
};

/**
 * Returns a single random Wikipedia item from the given game category.
 */
export const getRandomItem = async (category: string): Promise<WikiItem> => {
    const items = await getRandomItems(category, 1);
    return items[0];
};
