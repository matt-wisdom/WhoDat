import { Socket } from 'socket.io';
import { getRandomItem, getRandomItems } from './wikipedia.js';
import { checkSimilarity, answerQuestion } from './ai.js';
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
    winner?: boolean; // Tag for frontend to highlight winner
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

        // Assign secret identities
        // Assign secret identities
        const items = await getRandomItems(room.category, room.players.length);
        
        room.players.forEach((player, index) => {
            if (!player.secretIdentity) {
                // If items run out (unlikely with our list size vs max players), loop or undefined?
                // For now assuming items.length >= players.length
                player.secretIdentity = items[index];
            }
        });

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
            console.log("Question", currentPlayer.secretIdentity.summary, result)
        } else {
            if (!currentPlayer.secretIdentity) throw new Error('No secret identity');
            const score = await checkSimilarity(content, currentPlayer.secretIdentity.title);
            console.log(score)
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
                    nextTurn: '', // No next turn
                    roomState: room,
                    gameEnded: true,
                    winner: currentPlayer
                };
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
}

export const gameManager = new GameManager();
