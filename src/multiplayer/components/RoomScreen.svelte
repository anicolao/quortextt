<script lang="ts">
  import { multiplayerStore, isHost } from '../stores/multiplayerStore';
  import { socket } from '../socket';

  $: room = $multiplayerStore.currentRoom;
  $: canStart = $isHost && room && room.players.length >= 2;
  $: emptySlots = room ? Array.from({ length: room.maxPlayers - room.players.length }) : [];

  function leaveRoom() {
    if (room) {
      socket.leaveRoom(room.id);
      multiplayerStore.setCurrentRoom(null);
      multiplayerStore.setScreen('lobby');
    }
  }

  function startGame() {
    if (room && canStart) {
      console.log('Host starting game for room:', room.id);
      socket.startGame(room.id);
    }
  }
  
  function handleSignOut() {
    // Leave room first
    if (room) {
      socket.leaveRoom(room.id);
    }
    
    // Clear stored token
    localStorage.removeItem('quortex_token');
    
    // Disconnect socket
    socket.disconnect();
    
    // Return to login screen
    multiplayerStore.setScreen('login');
  }
</script>

<div class="room-screen">
  <div class="room-container">
    {#if room}
      <header>
        <div class="header-content">
          <div>
            <h1>{room.name}</h1>
            <p class="room-status">
              {room.players.length}/{room.maxPlayers} players
            </p>
          </div>
          <div class="header-actions">
            <button class="leave-btn" on:click={leaveRoom}>
              ← Leave Room
            </button>
            <button class="signout-btn" on:click={handleSignOut} title="Sign Out">
              🚪 Sign Out
            </button>
          </div>
        </div>
      </header>

      <div class="room-content">
        <div class="info-section">
          {#if $isHost}
            <div class="host-badge">👑 You are the host</div>
          {:else}
            <div class="waiting-badge">⏳ Waiting for host to start...</div>
          {/if}
        </div>

        <div class="players-section">
          <h2>Players</h2>
          <div class="players-list">
            {#each room.players as player}
              <div class="player-card">
                <div class="player-info">
                  <span class="player-name">
                    {player.username}
                    {#if player.id === room.hostId}
                      <span class="host-icon">👑</span>
                    {/if}
                  </span>
                </div>
                <span class="player-status">
                  {player.connected !== false ? '🟢 Online' : '🔴 Offline'}
                </span>
              </div>
            {/each}
            
            {#each emptySlots as _, i}
              <div class="player-card empty">
                <span class="waiting-text">Waiting for player...</span>
              </div>
            {/each}
          </div>
        </div>

        {#if $isHost}
          <div class="start-section">
            <button 
              class="start-btn" 
              on:click={startGame}
              disabled={!canStart}
            >
              {canStart ? '🎮 Start Game' : `Need at least 2 players (${room.players.length}/2)`}
            </button>
          </div>
        {/if}
      </div>
    {:else}
      <div class="error-state">
        <p>Room not found</p>
        <button on:click={() => multiplayerStore.setScreen('lobby')}>
          Back to Lobby
        </button>
      </div>
    {/if}
  </div>
</div>

<style>
  .room-screen {
    min-height: 100vh;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    padding: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .room-container {
    max-width: 600px;
    width: 100%;
    background: white;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  }

  header {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 30px;
  }

  .header-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  h1 {
    margin: 0 0 8px 0;
    font-size: 28px;
  }

  .room-status {
    margin: 0;
    opacity: 0.9;
    font-size: 14px;
  }

  .header-actions {
    display: flex;
    gap: 10px;
    align-items: center;
  }

  .leave-btn {
    padding: 10px 20px;
    background: rgba(255, 255, 255, 0.2);
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.3s;
  }

  .leave-btn:hover {
    background: rgba(255, 255, 255, 0.3);
  }
  
  .signout-btn {
    padding: 8px 16px;
    background: rgba(255, 255, 255, 0.2);
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.3s;
  }
  
  .signout-btn:hover {
    background: rgba(255, 255, 255, 0.3);
    border-color: rgba(255, 255, 255, 0.5);
  }

  .room-content {
    padding: 30px;
  }

  .info-section {
    margin-bottom: 30px;
    text-align: center;
  }

  .host-badge,
  .waiting-badge {
    display: inline-block;
    padding: 10px 20px;
    border-radius: 20px;
    font-size: 14px;
    font-weight: 600;
  }

  .host-badge {
    background: #ffd700;
    color: #333;
  }

  .waiting-badge {
    background: #e3f2fd;
    color: #1976d2;
  }

  h2 {
    margin: 0 0 20px 0;
    color: #333;
    font-size: 20px;
  }

  .players-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .player-card {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px;
    background: #f8f9fa;
    border-radius: 8px;
    border: 2px solid transparent;
  }

  .player-card:not(.empty) {
    border-color: #667eea;
  }

  .player-card.empty {
    opacity: 0.5;
    border-style: dashed;
    border-color: #ddd;
  }

  .player-name {
    font-size: 16px;
    font-weight: 600;
    color: #333;
  }

  .host-icon {
    margin-left: 8px;
  }

  .player-status {
    font-size: 14px;
    color: #666;
  }

  .waiting-text {
    color: #999;
    font-style: italic;
  }

  .start-section {
    margin-top: 30px;
    padding-top: 30px;
    border-top: 1px solid #eee;
  }

  .start-btn {
    width: 100%;
    padding: 16px;
    background: #667eea;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 18px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.3s;
  }

  .start-btn:hover:not(:disabled) {
    background: #5568d3;
  }

  .start-btn:disabled {
    background: #ccc;
    cursor: not-allowed;
  }

  .error-state {
    padding: 60px 30px;
    text-align: center;
  }

  .error-state p {
    margin: 0 0 20px 0;
    color: #666;
    font-size: 18px;
  }

  .error-state button {
    padding: 12px 24px;
    background: #667eea;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
  }
</style>
