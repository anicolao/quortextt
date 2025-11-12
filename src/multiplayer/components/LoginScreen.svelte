<script lang="ts">
  import { multiplayerStore } from '../stores/multiplayerStore';
  import { socket } from '../socket';

  let username = '';
  let connecting = false;
  let error = '';

  async function handleLogin() {
    if (!username.trim()) {
      error = 'Please enter a username';
      return;
    }

    if (username.length < 2 || username.length > 20) {
      error = 'Username must be 2-20 characters';
      return;
    }

    connecting = true;
    error = '';

    try {
      await socket.connect();
      socket.identify(username.trim());
      
      // Wait a bit for identification
      setTimeout(() => {
        multiplayerStore.setScreen('lobby');
      }, 500);
    } catch (err) {
      error = 'Failed to connect to server';
      connecting = false;
    }
  }

  function handleKeyPress(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      handleLogin();
    }
  }
</script>

<div class="login-screen">
  <div class="login-container">
    <h1>Quortex Multiplayer</h1>
    <p class="subtitle">Enter your username to join</p>
    
    <div class="login-form">
      <input
        type="text"
        bind:value={username}
        on:keypress={handleKeyPress}
        placeholder="Enter username"
        maxlength="20"
        disabled={connecting}
        autofocus
      />
      
      {#if error}
        <div class="error">{error}</div>
      {/if}
      
      <button on:click={handleLogin} disabled={connecting || !username.trim()}>
        {connecting ? 'Connecting...' : 'Join Lobby'}
      </button>
    </div>

    <div class="info">
      <p>🎮 Play Quortex with friends online!</p>
      <p>Create or join a game room to start playing.</p>
    </div>
  </div>
</div>

<style>
  .login-screen {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    padding: 20px;
  }

  .login-container {
    background: white;
    border-radius: 12px;
    padding: 40px;
    max-width: 400px;
    width: 100%;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  }

  h1 {
    color: #333;
    margin: 0 0 10px 0;
    font-size: 32px;
    text-align: center;
  }

  .subtitle {
    color: #666;
    margin: 0 0 30px 0;
    text-align: center;
  }

  .login-form {
    display: flex;
    flex-direction: column;
    gap: 15px;
  }

  input {
    padding: 12px 16px;
    border: 2px solid #ddd;
    border-radius: 8px;
    font-size: 16px;
    transition: border-color 0.3s;
  }

  input:focus {
    outline: none;
    border-color: #667eea;
  }

  input:disabled {
    background: #f5f5f5;
    cursor: not-allowed;
  }

  button {
    padding: 12px 24px;
    background: #667eea;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.3s;
  }

  button:hover:not(:disabled) {
    background: #5568d3;
  }

  button:disabled {
    background: #ccc;
    cursor: not-allowed;
  }

  .error {
    color: #e74c3c;
    font-size: 14px;
    padding: 8px;
    background: #fee;
    border-radius: 4px;
  }

  .info {
    margin-top: 30px;
    padding-top: 20px;
    border-top: 1px solid #eee;
    color: #666;
    font-size: 14px;
    text-align: center;
  }

  .info p {
    margin: 8px 0;
  }
</style>
