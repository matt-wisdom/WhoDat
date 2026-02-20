import { getRandomItem, getRandomItems } from './wikipedia.js';
import { checkSimilarity, answerQuestion, generateAITurn } from './ai.js';
import { AI_PERSONAS } from './ai_personas.js';
import db from '../db/index.js';

interface Player {
    id: string;
    name: string;
    score: number;
    isReady: boolean;
    secretIdentity?: {
        title: string;
        summary: string;
        fullText: string;
        image: string;
    };
    winner?: boolean; // Tag for frontend to highlight winner
    isAI?: boolean;
    personaId?: string;
}

interface Room {
    id: string;
    hostId: string;
    players: Player[];
    gameState: 'LOBBY' | 'PLAYING' | 'ENDED';
    currentTurnIndex: number;
    category: string;
    rounds: number;
    createdAt?: string;
    isPublic: boolean;
}

class GameManager {
    
    private playerRooms = new Map<string, string>(); // socketId -> roomId
    /** Tracks Q&A history per room so AI can build on previous rounds */
    private roomHistory = new Map<string, string[]>();

    // Helper to parse room from DB row
    private parseRoom(row: any): Room | null {
        if (!row) return null;
        return {
            id: row.id,
            hostId: row.host_id,
            players: JSON.parse(row.players_json),
            gameState: row.state as any,
            currentTurnIndex: row.current_turn_index,
            category: row.category,
            rounds: 0,
            createdAt: row.created_at,
            isPublic: !!row.is_public
        };
    }

    createRoom(hostId: string, hostName: string, category: string = 'Animal', isPublic: boolean = false): Room {
        const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
        const players: Player[] = [{ id: hostId, name: hostName, score: 0, isReady: false }];
        
        db.prepare(`
            INSERT INTO rooms (id, host_id, players_json, category, is_public)
            VALUES (?, ?, ?, ?, ?)
        `).run(roomId, hostId, JSON.stringify(players), category, isPublic ? 1 : 0);
        
        this.playerRooms.set(hostId, roomId);

        return this.getRoom(roomId)!;
    }

    addAIPlayer(roomId: string, personaId: string): Room | null {
        const room = this.getRoom(roomId);
        if (!room || room.gameState !== 'LOBBY') return null;

        const persona = AI_PERSONAS[personaId];
        if (!persona) return null;

        const aiId = `ai_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const aiPlayer: Player = {
            id: aiId,
            name: `${persona.name} (Bot)`,
            score: 0,
            isReady: true,
            isAI: true,
            personaId: persona.id
        };

        room.players.push(aiPlayer);
        this.updateRoomPlayers(roomId, room.players);
        // Map AI to room so we can find it if needed (though they don't have sockets)
        this.playerRooms.set(aiId, roomId);

        return this.getRoom(roomId);
    }

    getPublicRooms(): Room[] {
        try {
            const rows = db.prepare(`
                SELECT * FROM rooms 
                WHERE is_public = 1 AND state = 'LOBBY'
                ORDER BY created_at DESC
                LIMIT 20
            `).all();
            return rows.map(r => this.parseRoom(r)).filter(r => r !== null) as Room[];
        } catch (e) {
            console.error('Error getting public rooms:', e);
            return [];
        }
    }

    joinRoom(roomId: string, playerId: string, playerName: string): Room | null {
        const room = this.getRoom(roomId);
        if (!room) return null;
        if (room.gameState !== 'LOBBY') return null; 

        // Check if player already exists (reconnect)
        const existingPlayer = room.players.find(p => p.id === playerId);
        if (!existingPlayer) {
            room.players.push({ id: playerId, name: playerName, score: 0, isReady: false });
            this.updateRoomPlayers(roomId, room.players);
            this.playerRooms.set(playerId, roomId);
            
            // Re-fetch to return fresh state
            return this.getRoom(roomId);
        }
        
        // Even if existing, update socket mapping just in case (though socketId is passed as playerId usually)
        this.playerRooms.set(playerId, roomId);

        return room;
    }

    private async takeAITurn(roomId: string, aiPlayer: Player) {
        console.log(`[AI-DEBUG] Starting turn for ${aiPlayer.name} (${aiPlayer.id}) in room ${roomId}`);
        
        const room = this.getRoom(roomId);
        if (!room) {
            console.error(`[AI-DEBUG] Room ${roomId} not found during AI turn`);
            return;
        }
        if (room.gameState !== 'PLAYING') {
             console.log(`[AI-DEBUG] Game not playing (state: ${room.gameState}). Aborting AI turn.`);
             return;
        }

        // Double check it's still their turn
        const currentPlayer = room.players[room.currentTurnIndex];
        if (currentPlayer.id !== aiPlayer.id) {
            console.error(`[AI-DEBUG] It is not AI's turn! Current: ${currentPlayer.id}, AI: ${aiPlayer.id}`);
            return;
        }

        const persona = AI_PERSONAS[aiPlayer.personaId || 'standard'];
        console.log(`[AI-DEBUG] Generating move with persona: ${persona.name}`);
        
        try {
            // Only pass this AI's own Q&A history — other players' context is irrelevant
            const allHistory = this.roomHistory.get(roomId) || [];
            const aiName = aiPlayer.name;
            const history = allHistory.filter(entry => entry.startsWith(`[${aiName}]`));
            const move = await generateAITurn(persona, room.category, history);
            console.log(`[AI-DEBUG] Generated move:`, move);

            const result = await this.processTurn(roomId, aiPlayer.id, move.action, move.content);
            console.log(`[AI-DEBUG] Turn processed. Result:`, result ? 'Success' : 'Null');

        } catch (e) {
            console.error('[AI-DEBUG] Error during AI turn execution:', e);
        }
    }
    
    // Event Emitter for AI turns
    public aiMoveCallback: ((roomId: string, result: any) => void) | null = null;
    
    setAIMoveCallback(cb: (roomId: string, result: any) => void) {
        console.log('[AI-DEBUG] AI Move Callback Registered');
        this.aiMoveCallback = cb;
    }

    getRoom(roomId: string): Room | null {
        try {
            const row = db.prepare('SELECT * FROM rooms WHERE id = ?').get(roomId);
            return this.parseRoom(row);
        } catch (e) {
            console.error('Error getting room:', e);
            return null;
        }
    }

    private updateRoomPlayers(roomId: string, players: Player[]) {
        db.prepare('UPDATE rooms SET players_json = ? WHERE id = ?').run(JSON.stringify(players), roomId);
    }

    getSanitizedRoom(room: Room, playerId: string): Room {
        // Deep copy to avoid mutating original
        const sanitizedRoom = JSON.parse(JSON.stringify(room));
        
        if (room.gameState === 'PLAYING') {
            sanitizedRoom.players = sanitizedRoom.players.map((p: any) => {
                // If it's me, hide my identity
                if (p.id === playerId) {
                    delete p.secretIdentity;
                }
                return p;
            });
        }

        return sanitizedRoom;
    }

    async startGame(roomId: string): Promise<Room | null> {
        const room = this.getRoom(roomId);
        if (!room) return null;

        room.gameState = 'PLAYING';
        room.currentTurnIndex = 0;

        // Always assign fresh identities every game — no stale reuse
        const items = await getRandomItems(room.category, room.players.length);
        room.players.forEach((player, index) => {
            player.secretIdentity = items[index];
        });

        // Reset Q&A history for this room
        this.roomHistory.set(roomId, []);

        // Save state
        db.prepare(`
            UPDATE rooms 
            SET state = ?, current_turn_index = ?, players_json = ? 
            WHERE id = ?
        `).run('PLAYING', 0, JSON.stringify(room.players), roomId);

        return this.getRoom(roomId);
    }

    async processTurn(roomId: string, playerId: string, action: 'QUESTION' | 'GUESS', content: string) {
        console.log(`[GAME-DEBUG] Processing turn for ${playerId}: ${action} "${content}"`);
        let room = this.getRoom(roomId);
        if (!room) throw new Error('Room not found');

        const currentPlayer = room.players[room.currentTurnIndex];
        if (currentPlayer.id !== playerId) throw new Error('Not your turn');

        let result = '';
        let correct = false;

        if (action === 'QUESTION') {
            if (!currentPlayer.secretIdentity) throw new Error('No secret identity');
            const fullText = currentPlayer.secretIdentity.fullText || currentPlayer.secretIdentity.summary;
            result = await answerQuestion(content, fullText);
            console.log('Question answered. Context chars:', fullText.length, '| Result:', result, fullText.slice(0, 50));
        } else {
            if (!currentPlayer.secretIdentity) throw new Error('No secret identity');
            const guessContext = currentPlayer.secretIdentity.fullText || currentPlayer.secretIdentity.summary;
            const score = await checkSimilarity(content, currentPlayer.secretIdentity.title, guessContext);
            console.log('Guess score:', score);
            if (score > 0.7) {
                result = 'Correct!';
                correct = true;
                currentPlayer.score += 10;
                // Game Over Logic
                room.gameState = 'ENDED';
                currentPlayer.winner = true;
                
                // Save to history
                db.prepare(`
                    INSERT INTO games_history (room_id, winner_id, winner_name, players_json)
                    VALUES (?, ?, ?, ?)
                `).run(roomId, currentPlayer.id, currentPlayer.name, JSON.stringify(room.players));
                
                // Update room state in DB
                 db.prepare(`
                    UPDATE rooms 
                    SET state = ?, players_json = ? 
                    WHERE id = ?
                `).run('ENDED', JSON.stringify(room.players), roomId);

                return {
                    result,
                    correct,
                    action,
                    content,
                    playerName: currentPlayer.name,
                    nextTurn: '', // No next turn
                    roomState: room,
                    gameEnded: true,
                    winner: currentPlayer
                };
            } else {
                result = 'Incorrect';
            }
        }

        // Record this Q&A in history so the AI can build on it in future turns
        const historyEntry = action === 'QUESTION'
            ? `[${currentPlayer.name}] asked: "${content}" -> Answer: ${result}`
            : `[${currentPlayer.name}] guessed: "${content}" -> ${result}`;
        const currentHistory = this.roomHistory.get(roomId) || [];
        currentHistory.push(historyEntry);
        this.roomHistory.set(roomId, currentHistory);

        // Advance turn
        const nextTurnIndex = (room.currentTurnIndex + 1) % room.players.length;
        
        // Save updates
        db.prepare(`
            UPDATE rooms 
            SET current_turn_index = ?, players_json = ? 
            WHERE id = ?
        `).run(nextTurnIndex, JSON.stringify(room.players), roomId);

        // Fetch updated room
        room = this.getRoom(roomId)!;
        const nextPlayer = room.players[nextTurnIndex];
        const nextTurnId = nextPlayer.id;

        // Trigger AI if next
        if (nextPlayer.isAI) {
            console.log(`[GAME-DEBUG] Next player is AI (${nextPlayer.name}). Scheduling turn in 2000ms.`);
            setTimeout(() => {
                this.takeAITurn(roomId, nextPlayer).catch(e => console.error('[AI-DEBUG] Async AI Turn Error:', e));
            }, 2000);
        } else {
             console.log(`[GAME-DEBUG] Next player is Human (${nextPlayer.name}). Waiting for input.`);
        }

        const turnResult = {
            result,
            correct,
            action,
            content,
            playerName: currentPlayer.name,
            nextTurn: nextTurnId,
            roomState: room,
            gameEnded: false,
            winner: null
        };

        // If this was an AI turn (called internally), we need to broadcast via callback
        if (currentPlayer.isAI) {
            if (this.aiMoveCallback) {
                console.log(`[GAME-DEBUG] Broadcasting AI turn result for ${currentPlayer.name}`);
                this.aiMoveCallback(roomId, turnResult);
            } else {
                console.error('[GAME-DEBUG] CRITICAL: No aiMoveCallback set!');
            }
        }

        return turnResult;
    }
    
    removePlayer(socketId: string): { roomId: string, room: Room | null, gameCancelled?: boolean } | null {
        const roomId = this.playerRooms.get(socketId);
        if (!roomId) return null;

        const room = this.getRoom(roomId);
        if (room) {
            // Check if host is leaving during LOBBY
            if (room.hostId === socketId && room.gameState === 'LOBBY') {
                // Cancel the game
                this.updateRoomPlayers(roomId, []); // Clear players basically
                db.prepare('DELETE FROM rooms WHERE id = ?').run(roomId);
                this.playerRooms.delete(socketId);
                // Also clean up other players from this room in playerRooms map?
                // Ideally yes, but for now they will just be removed when they act or we can loop via room.players
                // Actually, we should iterate room.players and remove them from map
                room.players.forEach(p => this.playerRooms.delete(p.id));

                return { roomId, room: null, gameCancelled: true };
            }

            const newPlayers = room.players.filter(p => p.id !== socketId);
            
            if (newPlayers.length === 0) {
                // Determine if we should delete the room or keep it.
                // For now, let's keep it but ideally we might clean up empty rooms.
                // Or maybe delete if it was just created. 
                // Let's just update as empty for now.
                this.updateRoomPlayers(roomId, []);
                // Ensure room public status is updated if needed (e.g. to hide from public list if empty?)
            } else {
                // If the host left (not in lobby, or we decided not to cancel in other states), maybe assign new host?
                if (room.hostId === socketId && newPlayers.length > 0) {
                    // reassign host to first player
                    const newHost = newPlayers[0];
                    db.prepare('UPDATE rooms SET host_id = ? WHERE id = ?').run(newHost.id, roomId);
                }
                this.updateRoomPlayers(roomId, newPlayers);
            }
        }
        
        this.playerRooms.delete(socketId);
        
        return { roomId, room: this.getRoom(roomId) };
    }
    startCleanupInterval() {
        // Run every 10 minutes
        setInterval(() => {
            this.cleanupStaleLobbies();
        }, 10 * 60 * 1000);
    }

    private cleanupStaleLobbies() {
        console.log('Running stale lobby cleanup...');
        try {
            // Find stale rooms (LOBBY state, created > 1 hour ago)
            const staleRooms = db.prepare(`
                SELECT id FROM rooms 
                WHERE state = 'LOBBY' 
                AND created_at <= datetime('now', '-1 hour')
            `).all() as { id: string }[];

            if (staleRooms.length === 0) return;

            console.log(`Found ${staleRooms.length} stale rooms to clean up.`);

            staleRooms.forEach(({ id }) => {
                const room = this.getRoom(id);
                if (room) {
                    // Notify players if possible (though connection might be dead)
                    // We can try to emit to the room roomID
                    // But we don't have direct access to 'io' here easily unless we pass it or store it.
                    // For now, just clean up data.
                    room.players.forEach(p => this.playerRooms.delete(p.id));
                }
            });

            // Delete from DB
            const info = db.prepare(`
                DELETE FROM rooms 
                WHERE state = 'LOBBY' 
                AND created_at <= datetime('now', '-1 hour')
            `).run();
            
            console.log(`Deleted ${info.changes} stale rooms.`);

        } catch (e) {
            console.error('Error during lobby cleanup:', e);
        }
    }
}

export const gameManager = new GameManager();
gameManager.startCleanupInterval();
