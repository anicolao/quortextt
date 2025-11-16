<script lang="ts">
  import { multiplayerStore } from './stores/multiplayerStore';
  import LoginScreen from './components/LoginScreen.svelte';
  import LobbyScreen from './components/LobbyScreen.svelte';
  import RoomScreen from './components/RoomScreen.svelte';
  import ProfileScreen from './components/ProfileScreen.svelte';
  import ConnectionStatus from './components/ConnectionStatus.svelte';

  $: screen = $multiplayerStore.screen;
</script>

<div class="app">
  <ConnectionStatus />
  {#if screen === 'login'}
    <LoginScreen />
  {:else if screen === 'lobby'}
    <LobbyScreen />
  {:else if screen === 'room'}
    <RoomScreen />
  {:else if screen === 'profile'}
    <ProfileScreen />
  {:else if screen === 'game'}
    <!-- Game screen handled by existing canvas game -->
    <div class="game-active">
      <div class="game-info">Game in progress...</div>
    </div>
  {/if}
</div>

<style>
  .app {
    width: 100%;
    min-height: 100vh;
  }

  .game-active {
    display: none; /* Canvas will be shown instead */
  }

  .game-info {
    position: fixed;
    top: 20px;
    left: 20px;
    background: rgba(0, 0, 0, 0.7);
    color: white;
    padding: 10px 20px;
    border-radius: 8px;
    z-index: 1000;
  }
</style>
