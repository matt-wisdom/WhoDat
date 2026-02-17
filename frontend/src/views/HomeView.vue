<script setup lang="ts">
import { SignedIn, SignedOut, SignInButton, UserButton, useUser } from '@clerk/vue';

const { user } = useUser();
</script>

<template>
  <div class="home">
    <h1>Welcome to Guess Who AI</h1>
    <SignedOut>
      <SignInButton />
    </SignedOut>
    <SignedIn>
      <h2>Hello, {{ user?.firstName }}</h2>
      <UserButton />
      <div class="actions">
        <router-link to="/lobby/new">
            <button>Create New Game</button>
        </router-link>
      </div>
    </SignedIn>
  </div>
</template>

<style scoped>
.home {
  text-align: center;
  padding: 2rem;
}
button {
  margin: 0.5rem;
  padding: 0.5rem 1rem;
  font-size: 1rem;
  cursor: pointer;
}
</style>
