<script setup lang="ts">
// Force HMR: Lucide Icons
import { onMounted, computed, ref } from 'vue';
import { SignedIn, SignedOut, SignInButton, UserButton, useUser } from '@clerk/vue';
import { useGameStore } from '../stores/game';
import { useRouter } from 'vue-router';
import { Copy, Check, Plus, RefreshCw, Users, ArrowRight, Play } from '../components/icons';

const { user } = useUser();
const store = useGameStore();
const router = useRouter();

const publicRooms = computed(() => store.publicRooms);
const roomCodeInput = ref('');
const joinError = ref('');

onMounted(() => {
    store.connect(); 
    store.getPublicRooms();
});

const joinRoom = async (roomId: string) => {
    if (!user.value) return;
    const success = await store.joinRoom(roomId, user.value.firstName || 'Player');
    if (success) {
        router.push(`/lobby/${roomId}`);
    } else {
        joinError.value = store.error || 'Failed to join room';
    }
};

const handleJoinByCode = () => {
    if (roomCodeInput.value.length < 3) return;
    joinRoom(roomCodeInput.value.toUpperCase());
};

const copied = ref(false);
const copyToClipboard = () => {
    if (user.value?.id) {
        navigator.clipboard.writeText(user.value.id);
        copied.value = true;
        setTimeout(() => copied.value = false, 2000);
    }
};
</script>

<template>
  <div class="home-container">
    <header class="navbar">
        <h1 class="logo">WhoDat</h1>
        <div class="user-action">
            <SignedOut>
                <SignInButton mode="modal" />
            </SignedOut>
            <SignedIn>
                <UserButton />
            </SignedIn>
        </div>
    </header>

    <main class="main-content">
        <SignedIn>
            <div class="dashboard-grid">
                <!-- Left Panel: Actions & Profile -->
                <div class="panel action-panel">
                    <div class="welcome-section">
                        <h2>Welcome back, {{ user?.firstName }}</h2>
                        <div class="user-id-pill" @click="copyToClipboard">
                            <span class="label">ID:</span>
                            <code class="id-text">{{ user?.id }}</code>
                            <span class="copy-icon-wrapper" v-if="!copied">
                                <Copy :size="16" />
                            </span>
                            <span class="copy-success-wrapper" v-else>
                                <Check :size="16" />
                            </span>
                        </div>
                    </div>

                    <div class="primary-actions">
                        <router-link to="/create" class="action-card create">
                            <div class="icon-wrapper">
                                <Plus :size="32" />
                            </div>
                            <div class="text">
                                <h3>Create Game</h3>
                                <p>Host a new lobby</p>
                            </div>
                        </router-link>
                    </div>

                    <div class="join-section">
                        <h3>Join via Code</h3>
                        <div class="input-group">
                            <input 
                                v-model="roomCodeInput" 
                                placeholder="ENTER CODE" 
                                maxlength="6"
                                @keyup.enter="handleJoinByCode"
                            />
                            <button @click="handleJoinByCode" :disabled="!roomCodeInput">
                                JOIN <ArrowRight :size="18" />
                            </button>
                        </div>
                        <p v-if="joinError" class="error-msg">{{ joinError }}</p>
                    </div>
                </div>

                <!-- Right Panel: Public Lobbies -->
                <div class="panel lobby-panel">
                    <div class="panel-header">
                        <h3>Live Public Lobbies</h3>
                        <button class="refresh-btn" @click="store.getPublicRooms" title="Refresh">
                            <RefreshCw :size="20" />
                        </button>
                    </div>
                    
                    <div class="lobby-list" v-if="publicRooms.length">
                        <div v-for="room in publicRooms" :key="room.id" class="lobby-card">
                            <div class="lobby-info">
                                <span class="room-code">#{{ room.id }}</span>
                                <span class="player-count">
                                    <Users :size="14" />
                                    {{ room.players ? room.players.length : 0 }} Players
                                </span>
                            </div>
                            <button class="join-btn" @click="joinRoom(room.id)">
                                JOIN <Play :size="14" fill="currentColor" />
                            </button>
                        </div>
                    </div>
                    
                    <div v-else class="empty-state">
                        <p>No public games active right now.</p>
                        <p class="sub">Be the first to create one!</p>
                    </div>
                </div>
            </div>
        </SignedIn>

        <SignedOut>
            <div class="hero">
                <h1>Guess Who AI</h1>
                <p>The classic guessing game, powered by AI.</p>
                <SignInButton mode="modal">
                    <button class="hero-btn">Play Now</button>
                </SignInButton>
            </div>
        </SignedOut>
    </main>
  </div>
</template>

<style scoped>
/* Reset & Layout */
.home-container {
    min-height: 100vh;
    background-color: transparent; /* Handled by body now */
    color: var(--text-primary);
}

.navbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 2rem;
    background: rgba(30, 41, 59, 0.95);
    border-bottom: 2px solid var(--border-color);
    backdrop-filter: blur(10px);
}

.logo {
    font-weight: 900;
    font-size: 2rem;
    color: var(--primary-color);
    margin: 0;
    text-shadow: 0 0 10px rgba(16, 185, 129, 0.4);
    letter-spacing: -1px;
}

.main-content {
    padding: 2rem;
    max-width: 1200px;
    margin: 0 auto;
}

/* Dashboard Grid */
.dashboard-grid {
    display: grid;
    grid-template-columns: 1fr 1.5fr;
    gap: 2rem;
    align-items: start;
}

@media (max-width: 768px) {
    .dashboard-grid {
        grid-template-columns: 1fr;
    }
}

.panel {
    background: rgba(30, 41, 59, 0.8);
    border-radius: 16px;
    border: 2px solid var(--border-color);
    padding: 1.5rem;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3);
}

/* Action Panel Styles */
.welcome-section {
    margin-bottom: 2rem;
}

.welcome-section h2 {
    font-size: 1.1rem;
    margin-bottom: 0.5rem;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 1px;
}

.user-id-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.8rem;
    background: var(--bg-color);
    padding: 0.6rem 1rem;
    border-radius: 8px;
    font-size: 0.9rem;
    cursor: pointer;
    transition: all 0.2s;
    user-select: all;
    border: 1px solid var(--border-color);
}

.copy-icon-wrapper, .copy-success-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-secondary);
    background: var(--surface-color);
    padding: 4px;
    border-radius: 4px;
    border: 1px solid var(--border-color);
}
.copy-success-wrapper {
    color: var(--primary-color);
    border-color: var(--primary-color);
}

.user-id-pill:hover {
    border-color: var(--primary-color);
    box-shadow: 0 0 8px rgba(16, 185, 129, 0.2);
}

.id-text {
    font-family: 'Roboto Mono', monospace;
    font-weight: 700;
    color: var(--primary-color);
    font-size: 1.1rem;
}

.action-card {
    display: flex;
    align-items: center;
    gap: 1.5rem;
    background: linear-gradient(145deg, var(--surface-hover) 0%, var(--surface-color) 100%);
    color: var(--text-primary);
    padding: 1.5rem;
    border-radius: 12px;
    text-decoration: none;
    transition: all 0.2s;
    border: 2px solid var(--border-color);
    position: relative;
    overflow: hidden;
}

.action-card::before {
    content: '';
    position: absolute;
    top: 0; left: 0; bottom: 0; width: 4px;
    background: var(--primary-color);
}

.action-card:hover {
    transform: translateY(-4px);
    border-color: var(--primary-color);
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.5);
}

.icon-wrapper {
    color: var(--primary-color);
    display: flex;
    align-items: center;
    justify-content: center;
}

.action-card h3 {
    margin: 0;
    font-size: 1.3rem;
}

.action-card p {
    margin: 0.2rem 0 0;
    font-size: 0.9rem;
    opacity: 0.8;
    color: var(--text-secondary);
    font-family: var(--font-body);
}

.join-section {
    margin-top: 2rem;
    padding-top: 2rem;
    border-top: 2px dashed var(--border-color);
}
.join-section h3 {
    font-size: 1rem;
    color: var(--text-secondary);
    margin-bottom: 1rem;
}

.input-group {
    display: flex;
    gap: 0.8rem;
    margin-top: 0.5rem;
}

.input-group input {
    flex: 1;
    padding: 0.8rem;
    border: 2px solid var(--border-color);
    background: var(--bg-color);
    color: var(--text-primary);
    border-radius: 8px;
    font-family: var(--font-display);
    text-transform: uppercase;
    font-size: 1.1rem;
    letter-spacing: 2px;
}
.input-group input:focus {
    outline: none;
    border-color: var(--primary-color);
    box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.2);
}

.input-group button {
    padding: 0 1.5rem;
    background: var(--primary-color);
    color: #0f172a;
    border: none;
    border-radius: 8px;
    font-weight: 800;
    cursor: pointer;
    font-size: 1rem;
    border-bottom: 4px solid #065f46 !important; /* Darker emerald */
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.input-group button:hover:not(:disabled) {
    background: #34d399;
}
.input-group button:disabled {
    background: var(--surface-hover);
    color: var(--text-secondary);
    border-bottom-color: var(--border-color) !important;
    cursor: not-allowed;
    transform: none !important;
}

.error-msg {
    color: var(--error-color);
    font-size: 0.9rem;
    margin-top: 0.5rem;
    font-weight: bold;
}

/* Lobby Panel Styles */
.panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
    border-bottom: 2px solid var(--border-color);
    padding-bottom: 1rem;
}
.panel-header h3 {
    margin: 0;
    font-size: 1.2rem;
    color: var(--primary-color);
}

.refresh-btn {
    background: var(--bg-color);
    border: 2px solid var(--border-color);
    color: var(--text-secondary);
    width: 36px;
    height: 36px;
    border-radius: 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    border-bottom: 4px solid var(--border-color) !important;
    padding: 0;
}
.refresh-btn:hover {
    color: var(--text-primary);
    border-color: var(--text-primary);
    border-bottom-color: var(--text-primary) !important;
}
.refresh-btn:active {
    border-bottom-width: 2px !important;
}


.lobby-card {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.2rem;
    background: var(--bg-color);
    margin-bottom: 0.8rem;
    border-radius: 10px;
    border: 1px solid var(--border-color);
    transition: all 0.2s;
}

.lobby-card:hover {
    border-color: var(--accent-color);
    transform: translateX(4px);
}

.room-code {
    font-weight: 700;
    margin-right: 1rem;
    color: var(--accent-color);
    font-family: var(--font-display);
    font-size: 1.1rem;
}

.player-count {
    color: var(--text-secondary);
    font-size: 0.9rem;
    background: var(--surface-color);
    padding: 0.2rem 0.6rem;
    border-radius: 4px;
    display: flex;
    align-items: center;
    gap: 0.4rem;
}

.join-btn {
    padding: 0.5rem 1.2rem;
    background: transparent;
    border: 2px solid var(--accent-color);
    color: var(--accent-color);
    border-radius: 8px;
    cursor: pointer;
    font-weight: 700;
    transition: all 0.2s;
    border-bottom: 4px solid var(--accent-color) !important;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    text-transform: uppercase;
}

.join-btn:hover {
    background: var(--accent-color);
    color: white;
}

.empty-state {
    text-align: center;
    padding: 4rem 0;
    color: var(--text-secondary);
    opacity: 0.7;
}

/* Hero Landing (Signed Out) */
.hero {
    text-align: center;
    padding: 6rem 1rem;
}
.hero h1 {
    font-size: 4rem;
    margin-bottom: 1rem;
    color: var(--primary-color);
    text-shadow: 4px 4px 0px rgba(0,0,0,0.5);
}
.hero p {
    font-size: 1.2rem;
    margin-bottom: 3rem;
}
.hero-btn {
    padding: 1.2rem 3rem;
    font-size: 1.5rem;
    background: var(--primary-color);
    color: #0f172a;
    border: none;
    border-radius: 12px;
    cursor: pointer;
    font-weight: 900;
    border-bottom: 6px solid #065f46 !important;
}
.hero-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 20px rgba(16, 185, 129, 0.3);
}
</style>
