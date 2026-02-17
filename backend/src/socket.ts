import { Server, Socket } from 'socket.io';
import { gameManager } from './services/gameManager.js';

export const setupSocket = (io: Server) => {
    io.on('connection', (socket: Socket) => {
        console.log('User connected:', socket.id);

        socket.on('create_room', ({ playerName }, callback) => {
            const roomId = gameManager.createRoom(socket.id, playerName);
            socket.join(roomId);
            callback({ roomId });
        });

        socket.on('join_room', ({ roomId, playerName }, callback) => {
            const room = gameManager.joinRoom(roomId, socket.id, playerName);
            if (room) {
                socket.join(roomId);
                io.to(roomId).emit('room_update', room);
                callback({ success: true, room });
            } else {
                callback({ success: false, error: 'Room not found or game started' });
            }
        });

        socket.on('start_game', ({ roomId }) => {
            gameManager.startGame(roomId).then(room => {
                if (room) {
                    io.to(roomId).emit('game_started', room);
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
                
                io.to(roomId).emit('room_update', result.roomState);
                
            } catch (error) {
                socket.emit('error', (error as Error).message);
            }
        });

        socket.on('disconnect', () => {
            gameManager.removePlayer(socket.id);
        });
    });
};
