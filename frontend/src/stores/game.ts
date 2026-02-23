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
    const winner = ref<any>(null);

    const publicRooms = ref<any[]>([]);
    const invites = ref<any[]>([]);

    /** Raw string entered by the host in the lobby (one name per line or comma-separated). */
    const customNamesRaw = ref<string>('');

    /** End-game vote tally received from the server. */
    const endGameVote = ref<{ votesFor: number; votesNeeded: number } | null>(null);
    /** Whether this client has already cast an end-game vote. */
    const hasVotedToEnd = ref<boolean>(false);

    // Connect to backend
    const connect = async () => {
        if (socket.value) return;

        let token = '';
        try {
            // @ts-ignore
            if (window.Clerk) {
                // @ts-ignore
                token = await window.Clerk.session?.getToken();
            }
        } catch (e) {
            console.error('Failed to get token', e);
        }

        // In Docker, VITE_API_URL is empty so socket.io connects to the same
        // origin (nginx proxies /socket.io/ to the backend container).
        // In local dev it falls back to the explicit backend address.
        const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:8080';
        socket.value = io(apiUrl, {
            auth: { token }
        });

        socket.value.on('connect', () => {
            myId.value = socket.value?.id || '';
            console.log('Connected to server with ID:', myId.value);
        });

        socket.value.on('room_update', (room: any) => {
            if (room) {
                players.value = room.players;
                gameState.value = room.gameState;
                currentTurn.value = room.players?.[room.currentTurnIndex]?.id || '';
            }
        });

        socket.value.on('game_started', (room: any) => {
            players.value = room.players;
            gameState.value = room.gameState;
            currentTurn.value = room.players?.[room.currentTurnIndex]?.id || '';
            logs.value = [];
            endGameVote.value = null;
            hasVotedToEnd.value = false;
            customNamesRaw.value = '';
        });

        socket.value.on('game_over', ({ winner: w, players: p }: any) => {
            console.log('Game Over', w);
            winner.value = w;
            players.value = p;
            gameState.value = 'ENDED';
            endGameVote.value = null;
            hasVotedToEnd.value = false;
        });

        socket.value.on('player_kicked', () => {
            gameState.value = 'KICKED';
        });

        socket.value.on('game_cancelled', () => {
            // Handled by GameView/LobbyView with a modal, not a browser alert
            gameState.value = 'CANCELLED';
        });

        socket.value.on('turn_result', (result: any) => {
            logs.value.push(result);
        });

        socket.value.on('end_game_vote_update', (tally: { votesFor: number; votesNeeded: number }) => {
            endGameVote.value = tally;
        });

        socket.value.on('invite_received', (invite: any) => {
            console.log('Invite received:', invite);
            invites.value.push(invite);
        });

        socket.value.on('error', (msg: string) => {
            error.value = msg;
            console.error(msg);
        });
    };

    const registerUser = (userId: string) => {
        if (socket.value && socket.value.connected) {
            socket.value.emit('register_user', { userId });
        }
    };

    const createRoom = (playerName: string, category: string, isPublic: boolean = false) => {
        return new Promise<string>((resolve) => {
            socket.value?.emit('create_room', { playerName, category, isPublic }, (res: any) => {
                roomId.value = res.roomId;
                if (res.room) {
                    players.value = res.room.players;
                    gameState.value = res.room.gameState;
                }
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

    const addAIPlayer = (personaId: string) => {
        return new Promise<void>((resolve, reject) => {
            socket.value?.emit('add_ai_player', { roomId: roomId.value, personaId }, (res: any) => {
                if (res.success) {
                    resolve();
                } else {
                    reject(res.error || 'Unknown error');
                }
            });
        });
    };

    const joinRoom = (id: string, playerName: string) => {
        return new Promise<boolean>((resolve) => {
            socket.value?.emit('join_room', { roomId: id, playerName }, (res: any) => {
                if (res.success) {
                    roomId.value = id;
                    if (res.room) {
                        players.value = res.room.players;
                        gameState.value = res.room.gameState;
                    }
                    resolve(true);
                } else {
                    error.value = res.error;
                    resolve(false);
                }
            });
        });
    };

    /** Parse the host's custom names textarea into a clean string array. */
    const parseCustomNames = (): string[] => {
        if (!customNamesRaw.value.trim()) return [];
        return customNamesRaw.value
            .split(/[\n,]+/)
            .map(n => n.trim())
            .filter(n => n.length > 0);
    };

    const startGame = () => {
        const customNames = parseCustomNames();
        socket.value?.emit('start_game', {
            roomId: roomId.value,
            ...(customNames.length > 0 ? { customNames } : {}),
        });
    };

    const submitAction = (action: 'QUESTION' | 'GUESS', content: string) => {
        socket.value?.emit('game_action', { roomId: roomId.value, action, content });
    };

    /** Cast a vote to end the current game early. */
    const voteEndGame = () => {
        if (hasVotedToEnd.value) return;
        hasVotedToEnd.value = true;
        socket.value?.emit('vote_end_game', { roomId: roomId.value });
    };

    /** Host-only: remove a player or bot from the lobby. */
    const kickPlayer = (targetId: string) => {
        return new Promise<void>((resolve, reject) => {
            socket.value?.emit('kick_player', { roomId: roomId.value, targetId }, (res: any) => {
                if (res.success) resolve();
                else reject(new Error(res.error || 'Failed to kick player'));
            });
        });
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
        winner,
        endGameVote,
        hasVotedToEnd,
        customNamesRaw,
        connect,
        createRoom,
        joinRoom,
        startGame,
        submitAction,
        getPublicRooms,
        invitePlayer,
        registerUser,
        addAIPlayer,
        voteEndGame,
        kickPlayer,
    };
});
