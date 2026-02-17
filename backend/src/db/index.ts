import Database from 'better-sqlite3';
import path from 'path';

// Initialize DB
const dbPath = path.resolve('game.db');
const db = new Database(dbPath);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

// Create tables
const initDb = () => {
    db.prepare(`
        CREATE TABLE IF NOT EXISTS rooms (
            id TEXT PRIMARY KEY,
            host_id TEXT NOT NULL,
            state TEXT DEFAULT 'LOBBY', -- LOBBY, PLAYING, ENDED
            current_turn_index INTEGER DEFAULT 0,
            category TEXT DEFAULT 'Animal',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            players_json TEXT DEFAULT '[]', -- Storing players as JSON for simplicity
            settings_json TEXT DEFAULT '{}'
        )
    `).run();
    
    console.log('Database initialized at', dbPath);
};

initDb();

export default db;
