import { defineStore } from 'pinia';
import { io, Socket } from 'socket.io-client';
import { ref } from 'vue';

export const useGameStore = defineStore('game', () => {
    const socket = ref<Socket | null>(null);
    const roomId = ref<string>('');
    const players = ref<any[]>([]);
    const gameState = ref<string>('LOBBY');
    const currentTurn = ref<string>('');
    const myId = ref<string>('');
    const logs = ref<any[]>([]);
    const error = ref<string>('');

    const publicRooms = ref<any[]>([]);
    const invites = ref<any[]>([]);

    // Connect to backend
    const connect = async () => {
        if (socket.value) return;
        
        let token = '';
        let userId = '';
        try {
            // @ts-ignore
            if (window.Clerk) {
                // @ts-ignore
                token = await window.Clerk.session?.getToken();
                // @ts-ignore
                userId = window.Clerk.user?.id;
            }
        } catch (e) {
            console.error('Failed to get token', e);
        }

        socket.value = io('http://localhost:8080', {
            auth: {
                token
            }
        });
        
        socket.value.on('connect', () => {
             myId.value = socket.value?.id || '';
             console.log('Connected to server:', myId.value);
             if (userId) {
                 socket.value?.emit('register_user', { userId });
             }
        });

        socket.value.on('room_update', (room: any) => {
            console.log('Room update:', room);
            players.value = room.players;
            gameState.value = room.gameState;
            currentTurn.value = room.players[room.currentTurnIndex]?.id || '';
            // Sync local room ID if needed
        });

        socket.value.on('game_started', (room: any) => {
            console.log('Game started!', room);
            gameState.value = 'PLAYING';
            // Logic to transition to Game View if not already
        });
        
        socket.value.on('turn_result', (result: any) => {
            logs.value.push(result);
        });

        socket.value.on('invite_received', (invite: any) => {
            console.log('Invite received:', invite);
            invites.value.push(invite);
            // Ideally trigger a toast notification here
        });

        socket.value.on('error', (msg: string) => {
            error.value = msg;
            console.error(msg);
        });
    };

    const createRoom = (playerName: string, isPublic: boolean = false) => {
        return new Promise<string>((resolve) => {
             socket.value?.emit('create_room', { playerName, isPublic }, (res: any) => {
                 roomId.value = res.roomId;
                 resolve(res.roomId);
             });
        });
    };

    const getPublicRooms = () => {
        return new Promise<void>((resolve) => {
            socket.value?.emit('get_public_rooms', (res: any) => {
                publicRooms.value = res.rooms;
                resolve();
            });
        });
    };

    const invitePlayer = (targetUserId: string, inviterName: string) => {
        return new Promise<any>((resolve) => {
            socket.value?.emit('invite_player', { targetUserId, roomId: roomId.value, inviterName }, (res: any) => {
                resolve(res);
            });
        });
    };

    const joinRoom = (id: string, playerName: string) => {
        return new Promise<boolean>((resolve) => {
            socket.value?.emit('join_room', { roomId: id, playerName }, (res: any) => {
                if (res.success) {
                    roomId.value = id;
                    resolve(true);
                } else {
                    error.value = res.error;
                    resolve(false);
                }
            });
        });
    };
    
    const startGame = () => {
        socket.value?.emit('start_game', { roomId: roomId.value });
    };

    const submitAction = (action: 'QUESTION' | 'GUESS', content: string) => {
        socket.value?.emit('game_action', { roomId: roomId.value, action, content });
    };

    return {
        socket,
        roomId,
        players,
        gameState,
        currentTurn,
        myId,
        logs,
        error,
        publicRooms,
        invites,
        connect,
        createRoom,
        joinRoom,
        startGame,
        submitAction,
        getPublicRooms,
        invitePlayer
    };
});
