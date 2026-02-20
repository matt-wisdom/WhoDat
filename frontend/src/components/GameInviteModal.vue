<script setup lang="ts">
import { defineProps, defineEmits } from 'vue';

const props = defineProps<{
    invite: {
        roomId: string;
        inviterName: string;
    }
}>();

const emit = defineEmits(['accept', 'decline']);
</script>

<template>
    <div class="modal-overlay">
        <div class="modal">
            <h2>Game Invitation</h2>
            <p class="invite-text">
                <strong>{{ invite.inviterName }}</strong> has invited you to play!
            </p>
            
            <div class="modal-actions">
                <button class="decline-btn" @click="$emit('decline')">Decline</button>
                <button class="accept-btn" @click="$emit('accept')">Join Game</button>
            </div>
        </div>
    </div>
</template>

<style scoped>
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
    z-index: 2000; /* Higher than other modals */
}

.modal {
    background: var(--surface-color);
    padding: 2rem;
    border-radius: 12px;
    max-width: 500px;
    width: 90%;
    text-align: center;
    border: 1px solid var(--primary-color);
    color: var(--text-primary);
    box-shadow: 0 0 20px rgba(16, 185, 129, 0.2);
}

h2 {
    color: var(--primary-color);
    margin-bottom: 1rem;
}

.invite-text {
    font-size: 1.2rem;
    margin-bottom: 2rem;
}

.modal-actions {
    display: flex;
    gap: 1rem;
    justify-content: center;
}

.decline-btn {
    padding: 0.8rem 1.5rem;
    background: transparent;
    border: 1px solid var(--border-color);
    color: var(--text-secondary);
    border-radius: 8px;
    cursor: pointer;
    font-weight: bold;
}

.decline-btn:hover {
    border-color: var(--text-primary);
    color: var(--text-primary);
}

.accept-btn {
    padding: 0.8rem 1.5rem;
    background: var(--primary-color);
    border: none;
    color: #0f172a;
    border-radius: 8px;
    cursor: pointer;
    font-weight: bold;
}

.accept-btn:hover {
    opacity: 0.9;
    transform: translateY(-2px);
}
</style>
