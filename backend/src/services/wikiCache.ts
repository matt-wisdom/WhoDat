/**
 * Wiki cache service.
 *
 * On startup:
 *  1. For each predefined title that is missing from the DB, fetch the article
 *     and insert it (runs in the background, does not block the server).
 *  2. Schedules a refresh interval that re-fetches any row whose `last_updated`
 *     is older than 24 hours.
 *
 * Games read from this cache via `getRandomCachedItems`, never directly from
 * the Wikipedia API at match time.
 */

import db from '../db/index.js';
import { PREDEFINED_TITLES } from '../data/predefined.js';
import { fetchPageSummary, fetchFullExtract } from './wikipedia.js';
import type { WikiItem } from './wikipedia.js';

/** How old a cache row must be (ms) before it is refreshed. */
const CACHE_TTL_MS = 24 * 60 * 60 * 1_000; // 24 hours

/** Millis between background refresh sweeps. */
const REFRESH_INTERVAL_MS = CACHE_TTL_MS;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface CacheRow {
    category: string;
    title: string;
    summary: string;
    full_text: string;
    image: string;
    last_updated: string;
}

/** Fetch a single article from Wikipedia and upsert it into the cache. */
const fetchAndUpsert = async (category: string, title: string): Promise<void> => {
    try {
        const [summary, fullText] = await Promise.all([
            fetchPageSummary(title),
            fetchFullExtract(title),
        ]);

        if (!summary) return; // skip disambiguation / missing pages

        db.prepare(`
            INSERT INTO wiki_cache (category, title, summary, full_text, image, last_updated)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT (category, title)
            DO UPDATE SET
                summary      = excluded.summary,
                full_text    = excluded.full_text,
                image        = excluded.image,
                last_updated = CURRENT_TIMESTAMP
        `).run(
            category,
            summary.title,           // use canonical Wikipedia title
            summary.summary,
            fullText || summary.summary,
            summary.image ?? ''
        );
    } catch (err) {
        console.warn(`[Cache] Failed to fetch "${title}" (${category}):`, err);
    }
};

/**
 * Refreshes a single category: fetches all titles that are either missing from
 * the cache or whose `last_updated` is older than CACHE_TTL_MS.
 */
const refreshCategory = async (category: string): Promise<void> => {
    const titles = PREDEFINED_TITLES[category] ?? [];
    const staleThreshold = new Date(Date.now() - CACHE_TTL_MS).toISOString();

    // Work out which titles need fetching (missing or stale)
    const existing = db.prepare(`
        SELECT title FROM wiki_cache
        WHERE category = ? AND last_updated > ?
    `).all(category, staleThreshold) as { title: string }[];

    const freshTitles = new Set(existing.map(r => r.title.toLowerCase()));
    const toFetch = titles.filter(t => !freshTitles.has(t.toLowerCase()));

    if (toFetch.length === 0) {
        console.log(`[Cache] "${category}" is fully up-to-date (${titles.length} entries).`);
        return;
    }

    console.log(`[Cache] Fetching ${toFetch.length} articles for "${category}"...`);

    // Fetch in small batches to avoid hammering the Wikipedia API
    const BATCH = 10;
    for (let i = 0; i < toFetch.length; i += BATCH) {
        const batch = toFetch.slice(i, i + BATCH);
        await Promise.all(batch.map(title => fetchAndUpsert(category, title)));
    }

    console.log(`[Cache] "${category}" refresh complete.`);
};

/** Refreshes all categories in sequence. */
const refreshAll = async (): Promise<void> => {
    console.log('[Cache] Starting full refresh...');
    for (const category of Object.keys(PREDEFINED_TITLES)) {
        await refreshCategory(category);
    }
    console.log('[Cache] Full refresh complete.');
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Initialises the wiki cache on server startup.
 *  - Runs a background refresh immediately (fills missing entries).
 *  - Schedules a recurring refresh every 24 h to keep articles current.
 */
export const initCache = (): void => {
    // Background population — do NOT await so the server starts immediately.
    refreshAll().catch(err => console.error('[Cache] Background refresh error:', err));

    // Periodic refresh (24 h)
    setInterval(() => {
        refreshAll().catch(err => console.error('[Cache] Periodic refresh error:', err));
    }, REFRESH_INTERVAL_MS);
};

/**
 * Returns `count` random `WikiItem`s for `category` from the local cache.
 * Falls back to an empty array if the cache has fewer entries than requested
 * (the caller should handle the fallback).
 */
export const getRandomCachedItems = (category: string, count: number): WikiItem[] => {
    const rows = db.prepare(`
        SELECT title, summary, full_text, image
        FROM wiki_cache
        WHERE category = ?
          AND summary != ''
        ORDER BY RANDOM()
        LIMIT ?
    `).all(category, count) as Array<{ title: string; summary: string; full_text: string; image: string }>;

    return rows.map(row => ({
        title: row.title,
        summary: row.summary,
        fullText: row.full_text,
        image: row.image,
    }));
};
