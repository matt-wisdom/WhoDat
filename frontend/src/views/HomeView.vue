<script setup lang="ts">
import { useAuth0 } from '@auth0/auth0-vue';

const { loginWithRedirect, user, isAuthenticated, logout } = useAuth0();

const handleLogin = () => {
  loginWithRedirect();
};

const handleLogout = () => {
  logout({ logoutParams: { returnTo: window.location.origin } });
};
</script>

<template>
  <div class="home">
    <h1>Welcome to Guess Who AI</h1>
    <div v-if="!isAuthenticated">
      <button @click="handleLogin">Log In</button>
    </div>
    <div v-else>
      <h2>Hello, {{ user?.name }}</h2>
      <router-link to="/game">
        <button>Start Game</button>
      </router-link>
      <button @click="handleLogout">Log Out</button>
    </div>
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
