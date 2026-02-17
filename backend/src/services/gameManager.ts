import { Socket } from 'socket.io';
import { getRandomItem } from './wikipedia.js';
import { checkSimilarity, answerQuestion } from './txtai.js';
import db from '../db/index.js';

interface Player {
    id: string;
    name: string;
    score: number;
    isReady: boolean;
    secretIdentity?: {
        title: string;
        summary: string;
        image: string;
    };
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

    createRoom(hostId: string, hostName: string, isPublic: boolean = false): string {
        const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
        const players: Player[] = [{ id: hostId, name: hostName, score: 0, isReady: false }];
        
        db.prepare(`
            INSERT INTO rooms (id, host_id, players_json, category, is_public)
            VALUES (?, ?, ?, ?, ?)
        `).run(roomId, hostId, JSON.stringify(players), 'Animal', isPublic ? 1 : 0);
        
        return roomId;
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
            
            // Re-fetch to return fresh state
            return this.getRoom(roomId);
        }
        
        return room;
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

    async startGame(roomId: string): Promise<Room | null> {
        const room = this.getRoom(roomId);
        if (!room) return null;

        room.gameState = 'PLAYING';
        room.currentTurnIndex = 0;

        // Assign secret identities
        for (const player of room.players) {
            if (!player.secretIdentity) {
                 player.secretIdentity = await getRandomItem(room.category);
            }
        }

        // Save state
        db.prepare(`
            UPDATE rooms 
            SET state = ?, current_turn_index = ?, players_json = ? 
            WHERE id = ?
        `).run('PLAYING', 0, JSON.stringify(room.players), roomId);

        return this.getRoom(roomId);
    }

    async processTurn(roomId: string, playerId: string, action: 'QUESTION' | 'GUESS', content: string) {
        let room = this.getRoom(roomId);
        if (!room) throw new Error('Room not found');

        const currentPlayer = room.players[room.currentTurnIndex];
        if (currentPlayer.id !== playerId) throw new Error('Not your turn');

        let result = '';
        let correct = false;

        if (action === 'QUESTION') {
            if (!currentPlayer.secretIdentity) throw new Error('No secret identity');
            result = await answerQuestion(content, currentPlayer.secretIdentity.summary);
        } else {
            if (!currentPlayer.secretIdentity) throw new Error('No secret identity');
            const score = await checkSimilarity(content, currentPlayer.secretIdentity.title);
            if (score > 0.7) {
                result = 'Correct!';
                correct = true;
                currentPlayer.score += 10;
            } else {
                result = 'Incorrect';
            }
        }

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

        return {
            result,
            correct,
            nextTurn: room.players[nextTurnIndex].id,
            roomState: room
        };
    }
    
    removePlayer(socketId: string) {
        // clean up if needed
    }
}

export const gameManager = new GameManager();
