<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue';
import { onBeforeRouteLeave, useRouter } from 'vue-router';
import { useGameStore } from '../stores/game';
import HelpModal from '../components/HelpModal.vue';

const router = useRouter();
const store = useGameStore();

const question = ref('');
const guess = ref('');
const activeAction = ref<'QUESTION' | 'GUESS'>('QUESTION');
const showExitModal = ref(false);
const showCancelledModal = ref(false);
const showHelp = ref(false);
const isExiting = ref(false);

const myTurn = computed(() => store.currentTurn === store.myId);
const currentTurnName = computed(() => {
    const p = store.players.find((p: any) => p.id === store.currentTurn);
    return p ? p.name : 'Unknown';
});

const opponents = computed(() => store.players.filter((p: any) => p.id !== store.myId));

// Human players only (for showing the end-game button)
const humanPlayers = computed(() => store.players.filter((p: any) => !p.isAI));
const isHuman = computed(() => humanPlayers.value.some((p: any) => p.id === store.myId));

const submit = () => {
    if (activeAction.value === 'QUESTION') {
        if (!question.value) return;
        store.submitAction('QUESTION', question.value);
        question.value = '';
    } else {
        if (!guess.value) return;
        store.submitAction('GUESS', guess.value);
        guess.value = '';
    }
};

// Auto-scroll game log to bottom
const logsEl = ref<HTMLElement | null>(null);
watch(() => store.logs.length, async () => {
    await nextTick();
    if (logsEl.value) logsEl.value.scrollTop = logsEl.value.scrollHeight;
});

// Show cancelled modal instead of browser alert
watch(() => store.gameState, (newState) => {
    if (newState === 'CANCELLED') showCancelledModal.value = true;
});

const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    if (store.gameState === 'PLAYING') {
        e.preventDefault();
        e.returnValue = '';
    }
};

const goHome = () => {
    isExiting.value = true;
    router.push('/');
};

const confirmExit = () => {
    isExiting.value = true;
    showExitModal.value = false;
    router.push('/');
};

onMounted(() => {
    window.addEventListener('beforeunload', handleBeforeUnload);
});

onUnmounted(() => {
    window.removeEventListener('beforeunload', handleBeforeUnload);
});

onBeforeRouteLeave((to, from, next) => {
    if (store.gameState === 'PLAYING' && !isExiting.value) {
        showExitModal.value = true;
        next(false);
    } else {
        next();
    }
});
</script>

<template>
  <div class="game">

    <!-- Game Over Modal -->
    <div v-if="store.gameState === 'ENDED'" class="modal-overlay">
        <div class="modal">
            <h2>Game Over!</h2>
            <h3 v-if="store.winner">Winner: {{ store.winner.name }}</h3>
            <h3 v-else class="no-winner">Game ended by vote</h3>

            <div class="results-grid">
                <div
                    v-for="player in store.players"
                    :key="player.id"
                    class="result-card"
                    :class="{ winner: player.id === store.winner?.id }"
                >
                    <img v-if="player.secretIdentity?.image" :src="player.secretIdentity.image" class="result-img" alt="Identity" />
                    <div class="result-info">
                        <h4>{{ player.name }}</h4>
                        <p class="role">{{ player.secretIdentity?.title || 'Unknown' }}</p>
                        <p v-if="player.secretIdentity?.summary" class="identity-summary">
                            {{ player.secretIdentity.summary }}
                        </p>
                    </div>
                </div>
            </div>

            <button class="home-btn" @click="goHome">Back to Home</button>
        </div>
    </div>

    <!-- Game Cancelled Modal -->
    <div v-if="showCancelledModal" class="modal-overlay">
        <div class="modal modal--sm">
            <h2>Game Cancelled</h2>
            <p class="modal-text">The host has left the game.</p>
            <button class="home-btn" @click="goHome">Back to Home</button>
        </div>
    </div>

    <!-- Exit Confirmation Modal -->
    <div v-if="showExitModal" class="modal-overlay">
        <div class="modal modal--sm">
            <h2>Leave Game?</h2>
            <p class="modal-text">
                {{ store.myId === store.players[0]?.id && store.gameState === 'LOBBY'
                    ? 'You are the host. The game will be cancelled for everyone.'
                    : 'Are you sure you want to leave? You will be removed from the room.'
                }}
            </p>
            <div class="modal-actions">
                <button class="cancel-btn" @click="showExitModal = false">Cancel</button>
                <button class="confirm-btn" @click="confirmExit">Leave Game</button>
            </div>
        </div>
    </div>

    <!-- Top-right controls -->
    <div class="top-controls">
        <button class="exit-btn" @click="showExitModal = true">Exit Game</button>
    </div>

    <div class="sidebar">
        <h3>Game Log</h3>
        <div class="logs" ref="logsEl">
            <div v-for="(log, i) in store.logs" :key="i" class="log-entry">
                <span class="log-player">{{ log.playerName || 'Unknown' }}</span>
                <p class="log-action">{{ log.action }}: <em>{{ log.content }}</em></p>
                <strong class="log-result" :class="{ yes: log.result === 'Yes', correct: log.correct }">{{ log.result }}</strong>
                <div v-if="log.correct" class="correct">CORRECT!</div>
            </div>
        </div>

        <!-- End Game vote button — human players only, during active game -->
        <div v-if="store.gameState === 'PLAYING' && isHuman" class="end-game-section">
            <button
                class="end-game-btn"
                :class="{ voted: store.hasVotedToEnd }"
                :disabled="store.hasVotedToEnd"
                @click="store.voteEndGame()"
            >
                {{ store.hasVotedToEnd ? 'Vote Cast' : 'Vote to End Game' }}
            </button>
            <p v-if="store.endGameVote" class="vote-tally">
                {{ store.endGameVote.votesFor }} / {{ humanPlayers.length }} voted to end
            </p>
        </div>

        <button class="help-btn" @click="showHelp = true" title="How to play">? How to Play</button>
    </div>

    <div class="main">
        <div class="turn-indicator" :class="{ myTurn: myTurn }">
            Current Turn: {{ myTurn ? 'YOUR TURN' : currentTurnName }}
        </div>

        <div class="opponents">
            <div v-for="player in opponents" :key="player.id" class="player-card">
                <h4>{{ player.name }}</h4>
                <div v-if="player.secretIdentity" class="identity">
                    <img v-if="player.secretIdentity.image" :src="player.secretIdentity.image" alt="Identity" class="id-img" />
                    <p class="id-title">{{ player.secretIdentity.title }}</p>
                    <details>
                        <summary>Read Bio</summary>
                        <p class="summary">{{ player.secretIdentity.summary }}</p>
                    </details>
                </div>
                <div v-else class="identity filtered">
                     <span class="icon">?</span>
                     <p>Identity Hidden</p>
                </div>
            </div>
        </div>

        <div v-if="myTurn" class="actions">
            <div class="tabs">
                <button :class="{ active: activeAction === 'QUESTION' }" @click="activeAction = 'QUESTION'">Ask Question</button>
                <button :class="{ active: activeAction === 'GUESS' }" @click="activeAction = 'GUESS'">Make Guess</button>
            </div>

            <div class="input-area">
                <input v-if="activeAction === 'QUESTION'" v-model="question" placeholder="Is it an animal?" @keyup.enter="submit" />
                <input v-else v-model="guess" placeholder="e.g. Batman" @keyup.enter="submit" />
                <button @click="submit">Submit</button>
            </div>
        </div>
        <div v-else class="waiting">
            Waiting for {{ currentTurnName }}...
        </div>
    </div>

    <HelpModal v-if="showHelp" @close="showHelp = false" />
  </div>
</template>


<style scoped>
.game {
    display: flex;
    height: 90vh;
    width: 98vw;
    margin: 0 auto;
    gap: 1rem;
    color: var(--text-primary);
}
.top-controls {
    position: fixed;
    top: 1rem;
    right: 1rem;
    z-index: 500;
    display: flex;
    gap: 0.5rem;
}
.sidebar {
    width: 260px;
    border-right: 1px solid var(--border-color);
    overflow-y: auto;
    padding-right: 1rem;
    display: flex;
    flex-direction: column;
}
.logs {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    flex: 1;
    overflow-y: auto;
}
.log-entry {
    border-bottom: 1px solid var(--border-color);
    padding-bottom: 0.5rem;
}
.log-player {
    font-weight: 700;
    font-size: 0.8rem;
    color: var(--primary-color);
    text-transform: uppercase;
    letter-spacing: 0.05em;
}
.log-action {
    font-size: 0.85rem;
    color: var(--text-secondary);
    margin: 0.25rem 0;
}
.log-result {
    font-size: 0.85rem;
}
.log-result.yes {
    color: #10b981;
}
.correct {
    color: var(--primary-color);
    font-weight: bold;
}

/* End Game vote area */
.end-game-section {
    margin-top: auto;
    padding-top: 1rem;
    border-top: 1px solid var(--border-color);
}
.end-game-btn {
    width: 100%;
    padding: 0.6rem 1rem;
    background: transparent;
    border: 1px solid #f59e0b;
    color: #f59e0b;
    border-radius: 6px;
    font-weight: 600;
    font-size: 0.85rem;
    cursor: pointer;
    transition: background 0.2s, color 0.2s;
}
.end-game-btn:hover:not(:disabled) {
    background: #f59e0b;
    color: #0f172a;
}
.end-game-btn.voted,
.end-game-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}
.vote-tally {
    text-align: center;
    font-size: 0.8rem;
    color: var(--text-secondary);
    margin: 0.4rem 0 0;
}

.main {
    flex: 1;
    display: flex;
    flex-direction: column;
}
.opponents {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 1rem;
    overflow-y: auto;
    padding: 1rem;
}
.player-card {
    border: 1px solid var(--border-color);
    padding: 1rem;
    border-radius: 12px;
    text-align: center;
    background: var(--surface-color);
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    transition: transform 0.2s;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
}
.player-card:hover {
    transform: translateY(-2px);
    border-color: var(--primary-color);
}
.player-card h4 {
    color: var(--primary-color);
    font-size: 1.1rem;
    margin: 0;
}
.id-img {
    width: 80px;
    height: 80px;
    object-fit: cover;
    border-radius: 50%;
    border: 2px solid var(--border-color);
}
.id-title {
    font-weight: 700;
    font-size: 1.1rem;
    margin: 0.5rem 0;
    color: var(--text-primary);
}
.summary {
    font-size: 0.9rem;
    text-align: left;
    min-height: 100px;
    color: var(--text-secondary);
    white-space: pre-wrap;
}
.turn-indicator {
    padding: 1rem;
    background: var(--surface-color);
    text-align: center;
    font-size: 1.5rem;
    margin-bottom: 1rem;
    border-radius: 8px;
    border: 1px solid var(--border-color);
}
.myTurn {
    background: rgba(16, 185, 129, 0.1);
    color: var(--primary-color);
    font-weight: bold;
    border: 2px solid var(--primary-color);
    box-shadow: 0 0 15px rgba(16, 185, 129, 0.2);
}
.actions {
    margin-top: auto;
    padding: 1rem;
    background: var(--surface-color);
    border-top: 1px solid var(--border-color);
    border-radius: 8px 8px 0 0;
}
.tabs {
    margin-bottom: 1rem;
}
.tabs button {
    margin-right: 0.5rem;
    padding: 0.5rem 1rem;
    border: 1px solid var(--border-color);
    background: var(--surface-hover);
    color: var(--text-secondary);
    cursor: pointer;
    border-radius: 4px;
}
.tabs button.active {
    background: var(--primary-color);
    color: #0f172a;
    border-color: var(--primary-color);
    font-weight: bold;
    font-size: 0.9rem;
}
.input-area {
    display: flex;
    gap: 0.5rem;
}
input {
    flex: 1;
    padding: 0.8rem;
    background: var(--bg-color);
    border: 1px solid var(--border-color);
    color: var(--text-primary);
    border-radius: 4px;
}
input:focus {
    outline: none;
    border-color: var(--primary-color);
}
.input-area button {
    padding: 0.8rem 1.5rem;
    background: var(--primary-color);
    border: none;
    border-radius: 4px;
    color: #0f172a;
    font-weight: bold;
    cursor: pointer;
}
.waiting {
    margin-top: auto;
    padding: 1rem;
    text-align: center;
    font-style: italic;
    color: var(--text-secondary);
}

/* Modal Styles */
.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.85);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
}
.modal {
    background: var(--surface-color);
    padding: 2rem;
    border-radius: 12px;
    max-width: 860px;
    width: 90%;
    max-height: 90vh;
    overflow-y: auto;
    text-align: center;
    border: 1px solid var(--border-color);
    color: var(--text-primary);
}
.modal--sm {
    max-width: 440px;
}
.modal h2 {
    color: var(--primary-color);
    font-size: 2.5rem;
    margin-bottom: 0.5rem;
}
.modal h3 {
    margin-bottom: 2rem;
    font-size: 1.5rem;
}
.no-winner {
    color: var(--text-secondary);
}
.modal-text {
    color: var(--text-secondary);
    margin-bottom: 1.5rem;
}
.modal-actions {
    display: flex;
    gap: 1rem;
    justify-content: center;
    margin-top: 1rem;
}
.cancel-btn {
    padding: 0.75rem 1.5rem;
    background: transparent;
    border: 1px solid var(--border-color);
    color: var(--text-secondary);
    border-radius: 8px;
    cursor: pointer;
    font-weight: 600;
}
.confirm-btn {
    padding: 0.75rem 1.5rem;
    background: #ef4444;
    border: none;
    border-radius: 8px;
    color: #fff;
    font-weight: 600;
    cursor: pointer;
}
.results-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 1.25rem;
    margin-bottom: 2rem;
    text-align: left;
}
.result-card {
    background: var(--bg-color);
    padding: 1rem;
    border-radius: 8px;
    border: 1px solid var(--border-color);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
}
.result-card.winner {
    border-color: var(--primary-color);
    box-shadow: 0 0 15px rgba(16, 185, 129, 0.3);
}
.result-img {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    object-fit: cover;
    margin-bottom: 0.25rem;
}
.result-info {
    width: 100%;
    text-align: center;
}
.result-info h4 {
    margin: 0 0 0.25rem;
    color: var(--text-primary);
}
.role {
    color: var(--primary-color);
    font-weight: bold;
    font-size: 0.95rem;
    margin: 0 0 0.5rem;
}
.identity-summary {
    font-size: 0.8rem;
    color: var(--text-secondary);
    line-height: 1.5;
    text-align: left;
    margin: 0;
    max-height: 120px;
    overflow-y: auto;
}
.home-btn {
    padding: 1rem 2rem;
    font-size: 1.2rem;
    background: var(--primary-color);
    border: none;
    border-radius: 8px;
    color: #0f172a;
    font-weight: bold;
    cursor: pointer;
}
.exit-btn {
    padding: 0.5rem 1.1rem;
    background: transparent;
    border: 1px solid #ef4444;
    color: #ef4444;
    border-radius: 6px;
    font-weight: 600;
    font-size: 0.85rem;
    cursor: pointer;
    transition: background 0.2s, color 0.2s;
}
.exit-btn:hover {
    background: #ef4444;
    color: #fff;
}

@media (max-width: 768px) {
    .game {
        flex-direction: column;
        height: auto;
        min-height: 100svh;
        width: 100%;
        padding: 0.5rem;
        padding-top: 3rem; /* clear fixed top-controls */
        box-sizing: border-box;
        gap: 0.5rem;
    }
    .top-controls {
        top: 0.5rem;
        right: 0.5rem;
        gap: 0.35rem;
    }
    .sidebar {
        width: 100%;
        height: auto;
        max-height: 220px;
        border-right: none;
        border-bottom: 1px solid var(--border-color);
        padding-right: 0;
        padding-bottom: 0.75rem;
        margin-bottom: 0.5rem;
    }
    .logs {
        max-height: 120px;
        overflow-y: auto;
    }
    .main {
        width: 100%;
    }
    .turn-indicator {
        font-size: 1rem;
        padding: 0.6rem;
        margin-bottom: 0.5rem;
    }
    .opponents {
        grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
        gap: 0.5rem;
        padding: 0.5rem;
    }
    .player-card {
        padding: 0.7rem;
    }
    .id-img {
        width: 55px;
        height: 55px;
    }
    .id-title {
        font-size: 0.9rem;
    }
    .actions {
        border-radius: 0;
        padding: 0.75rem;
        position: sticky;
        bottom: 0;
    }
    /* Prevent iOS Safari from zooming on input focus */
    input {
        font-size: 16px !important;
    }
    .input-area {
        flex-direction: column;
    }
    .input-area input {
        width: 100%;
    }
    .input-area button {
        width: 100%;
        padding: 0.7rem;
    }
    .end-game-section {
        margin-top: 0.5rem;
    }
}
.help-btn {
  margin-top: 1rem;
  width: 100%;
  padding: 0.5rem;
  background: transparent;
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
}
.help-btn:hover {
  border-color: var(--primary-color);
  color: var(--primary-color);
}
</style>
