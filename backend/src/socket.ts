import { Server, Socket } from 'socket.io';
import { gameManager } from './services/gameManager.js';

const userSockets = new Map<string, string>(); // userId -> socketId

export const setupSocket = (io: Server) => {
    const broadcastRoomUpdate = (roomId: string, room: any) => {
        io.in(roomId).fetchSockets().then(sockets => {
            sockets.forEach(socket => {
                const sanitizedRoom = gameManager.getSanitizedRoom(room, socket.id);
                socket.emit('room_update', sanitizedRoom);
            });
        });
    };

    const broadcastGameStarted = (roomId: string, room: any) => {
         io.in(roomId).fetchSockets().then(sockets => {
            sockets.forEach(socket => {
                const sanitizedRoom = gameManager.getSanitizedRoom(room, socket.id);
                socket.emit('game_started', sanitizedRoom);
            });
        });
    };

    // Register AI callback
    gameManager.setAIMoveCallback((roomId, result) => {
        io.to(roomId).emit('turn_result', {
            playerId: result.roomState.players[result.roomState.currentTurnIndex === 0 ? result.roomState.players.length -1 : result.roomState.currentTurnIndex - 1].id, // Previous player was the AI
            // Actually result object from processTurn has: result, correct, nextTurn, roomState, gameEnded, winner
            // But turn_result event expects: { playerId, action, content, result, correct } 
            
            // We need to reconstruct action/content if possible or adjust frontend to not need it
            // or pass it in result from gameManager.
            // Looking at `processTurn` in gameManager, it doesn't return action/content.
            // Let's just emit the result text for now.
            // ideally logic should be unified. 
            
            // For now, let's just make sure we emit what we have.
            result: result.result,
            correct: result.correct
        });

        if (result.gameEnded) {
            io.to(roomId).emit('game_over', {
                winner: result.winner,
                players: result.roomState.players
            });
        }
        
        broadcastRoomUpdate(roomId, result.roomState);
    });

    io.on('connection', (socket: Socket) => {
        console.log('User connected:', socket.id);

        socket.on('register_user', ({ userId }) => {
            userSockets.set(userId, socket.id);
            console.log(`Registered user ${userId} to socket ${socket.id}`);
        });

        socket.on('create_room', ({ playerName, category, isPublic }, callback) => {
            const room = gameManager.createRoom(socket.id, playerName, category, isPublic);
            socket.join(room.id);
            // Verify room.id is returned in the callback structure expected by frontend
            // Frontend currently expects { roomId }, so we should verify if we change structure.
            // Better to send { roomId: room.id, room } or just { room } and update frontend.
            // I will send { roomId: room.id, room } to be safe and backward compatible if needed, 
            // but primarily we want the room.
            callback({ roomId: room.id, room });
            // Also emit update to the room (self) just in case
            broadcastRoomUpdate(room.id, room);
        });

        socket.on('get_public_rooms', (callback) => {
            const rooms = gameManager.getPublicRooms();
            callback({ rooms });
        });

        socket.on('invite_player', ({ targetUserId, roomId, inviterName }, callback) => {
            const targetSocketId = userSockets.get(targetUserId);
            if (targetSocketId) {
                io.to(targetSocketId).emit('invite_received', { roomId, inviterName });
                callback({ success: true, message: 'Invite sent to online user' });
            } else {
                // TODO: Send Email via email service
                console.log(`User ${targetUserId} not online. Should send email.`);
                callback({ success: true, message: 'User offline, email invite logic needed' });
            }
        });

        socket.on('join_room', ({ roomId, playerName }, callback) => {
            const room = gameManager.joinRoom(roomId, socket.id, playerName);
            if (room) {
                socket.join(roomId);
                broadcastRoomUpdate(roomId, room);
                callback({ success: true, room: gameManager.getSanitizedRoom(room, socket.id) });
            } else {
                callback({ success: false, error: 'Room not found or game started' });
            }
        });

        socket.on('start_game', ({ roomId }) => {
            gameManager.startGame(roomId).then(room => {
                if (room) {
                    broadcastGameStarted(roomId, room);
                }
            });
        });

        socket.on('game_action', async ({ roomId, action, content }) => {
            try {
                const result = await gameManager.processTurn(roomId, socket.id, action, content);
                io.to(roomId).emit('turn_result', {
                    playerId: socket.id,
                    action,
                    content,
                    result: result.result,
                    correct: result.correct
                });
                
                if ((result as any).gameEnded) {
                    io.to(roomId).emit('game_over', {
                        winner: (result as any).winner,
                        players: result.roomState.players
                    });
                }
                
                broadcastRoomUpdate(roomId, result.roomState);
                
            } catch (error) {
                socket.emit('error', (error as Error).message);
            }
        });

        socket.on('disconnect', () => {
            const result = gameManager.removePlayer(socket.id);
            if (result) {
                if (result.gameCancelled) {
                    io.to(result.roomId).emit('game_cancelled');
                } else if (result.room) {
                    broadcastRoomUpdate(result.roomId, result.room);
                }
            }
            
            for (const [uid, sid] of userSockets.entries()) {
                if (sid === socket.id) {
                    userSockets.delete(uid);
                    break;
                }
            }
        });

        socket.on('add_ai_player', ({ roomId, personaId }, callback) => {
            console.log(`[SOCKET] Request to add AI ${personaId} to room ${roomId}`);
            try {
                const room = gameManager.addAIPlayer(roomId, personaId);
                if (room) {
                     console.log(`[SOCKET] AI added. Broadcasting update to room ${roomId}`);
                     // Use specific broadcast function if available, or raw emit
                     // Re-using broadcastRoomUpdate logic here manually to ensure consistency
                     io.in(roomId).fetchSockets().then(sockets => {
                        sockets.forEach(s => {
                            const sanitizedRoom = gameManager.getSanitizedRoom(room, s.id);
                            s.emit('room_update', sanitizedRoom);
                        });
                    });
                     
                     callback({ success: true });
                } else {
                    console.error(`[SOCKET] Failed to add AI: Room not found or not in LOBBY`);
                    callback({ success: false, error: 'Failed to add AI (Invalid room or state)' });
                }
            } catch (e) {
                console.error('[SOCKET] Error adding AI:', e);
                callback({ success: false, error: 'Internal Server Error' });
            }
        });
    });
};
