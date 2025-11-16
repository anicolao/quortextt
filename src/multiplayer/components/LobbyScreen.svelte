<script lang="ts">
  import { onMount } from 'svelte';
  import { multiplayerStore } from '../stores/multiplayerStore';
  import { socket } from '../socket';
  import type { Room } from '../stores/multiplayerStore';
  import { store } from '../../redux/store';
  import { setSpectatorMode } from '../../redux/actions';

  let rooms: Room[] = [];
  let showCreateModal = false;
  let roomName = '';
  let maxPlayers = 2;
  let creating = false;
  let refreshing = false;

  $: username = $multiplayerStore.username;
  $: playerId = $multiplayerStore.playerId;

  // Helper function to check if current player is in a room
  function isPlayerInRoom(room: Room): boolean {
    if (!playerId || !room.players) return false;
    return room.players.some(p => p.id === playerId);
  }

  onMount(() => {
    refreshRooms();
    
    // Auto-refresh every 5 seconds
    const interval = setInterval(refreshRooms, 5000);
    return () => clearInterval(interval);
  });

  async function refreshRooms() {
    refreshing = true;
    // Pass playerId to get user's active games if authenticated
    const fetchedRooms = await socket.fetchRooms(playerId || undefined);
    rooms = fetchedRooms || [];
    multiplayerStore.setAvailableRooms(rooms);
    refreshing = false;
  }

  async function createRoom() {
    if (!roomName.trim() || !playerId) return;
    
    creating = true;
    const roomId = await socket.createRoom(roomName.trim(), maxPlayers, playerId);
    
    if (roomId) {
      socket.joinRoom(roomId);
      multiplayerStore.setScreen('room');
    }
    
    creating = false;
    showCreateModal = false;
    roomName = '';
  }

  function joinRoom(room: Room) {
    socket.joinRoom(room.id);
    multiplayerStore.setScreen('room');
  }

  function watchGame(room: Room) {
    // Join as spectator
    socket.joinAsSpectator(room.id);
    multiplayerStore.setIsSpectator(true);
    multiplayerStore.setGameId(room.id);
    multiplayerStore.setScreen('game');
    
    // Also update Redux state
    store.dispatch(setSpectatorMode(true));
  }

  function showCreate() {
    showCreateModal = true;
    roomName = `${username}'s game`;
  }
  
  function handleSignOut() {
    // Clear stored token
    localStorage.removeItem('quortex_token');
    
    // Disconnect socket
    socket.disconnect();
    
    // Return to login screen
    multiplayerStore.setScreen('login');
  }
  
  function viewProfile() {
    multiplayerStore.setScreen('profile');
  }
</script>

<div class="lobby-screen">
  <div class="lobby-container">
    <header>
      <div class="header-content">
        <h1>Game Lobby</h1>
        <div class="user-info">
          <button class="username-btn" on:click={viewProfile} title="View Profile">
            👤 {username}
          </button>
          <button class="signout-btn" on:click={handleSignOut} title="Sign Out">
            🚪 Sign Out
          </button>
        </div>
      </div>
    </header>

    <div class="actions">
      <button class="create-btn" on:click={showCreate}>
        ➕ Create New Room
      </button>
      <button class="refresh-btn" on:click={refreshRooms} disabled={refreshing}>
        {refreshing ? '⟳' : '🔄'} Refresh
      </button>
    </div>

    <div class="rooms-section">
      <h2>Available Rooms</h2>
      
      {#if !rooms || rooms.length === 0}
        <div class="no-rooms">
          <p>No rooms available</p>
          <p class="hint">Create a new room to start playing!</p>
        </div>
      {:else}
        <div class="rooms-list">
          {#each rooms as room}
            <div class="room-card" class:in-progress={room.status === 'playing'}>
              <div class="room-info">
                <h3>{room.name}</h3>
                <p class="room-players">
                  👥 {room.playerCount || room.players?.length || 0}/{room.maxPlayers} players
                  {#if room.spectatorCount && room.spectatorCount > 0}
                    <span class="spectator-count">👁️ {room.spectatorCount} watching</span>
                  {/if}
                </p>
                {#if room.status === 'playing'}
                  <span class="status-badge">In Progress</span>
                {:else if room.status === 'finished'}
                  <span class="status-badge finished">Finished</span>
                {/if}
              </div>
              <div class="room-actions">
                {#if room.status === 'playing' || room.status === 'finished'}
                  {#if isPlayerInRoom(room)}
                    <!-- Player in game: show only Resume/View button -->
                    <button 
                      class="join-btn" 
                      on:click={() => joinRoom(room)}
                    >
                      {#if room.status === 'playing'}
                        Resume
                      {:else}
                        View
                      {/if}
                    </button>
                  {:else}
                    <!-- Not a player: show only Watch button -->
                    <button 
                      class="watch-btn" 
                      on:click={() => watchGame(room)}
                    >
                      👁️ Watch
                    </button>
                  {/if}
                {:else}
                  <!-- Waiting room: show Join button -->
                  <button 
                    class="join-btn" 
                    on:click={() => joinRoom(room)}
                    disabled={(room.playerCount || room.players?.length || 0) >= room.maxPlayers}
                  >
                    {#if (room.playerCount || room.players?.length || 0) >= room.maxPlayers}
                      Full
                    {:else}
                      Join
                    {/if}
                  </button>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>

  {#if showCreateModal}
    <div class="modal-backdrop" on:click={() => showCreateModal = false}>
      <div class="modal" on:click|stopPropagation>
        <h2>Create New Room</h2>
        
        <div class="form-group">
          <label>Room Name</label>
          <input 
            type="text" 
            bind:value={roomName}
            maxlength="30"
            placeholder="Enter room name"
          />
        </div>

        <div class="form-group">
          <label>Max Players</label>
          <select bind:value={maxPlayers}>
            <option value={2}>2 Players</option>
            <option value={3}>3 Players</option>
            <option value={4}>4 Players</option>
            <option value={5}>5 Players</option>
            <option value={6}>6 Players</option>
          </select>
        </div>

        <div class="modal-actions">
          <button class="cancel-btn" on:click={() => showCreateModal = false}>
            Cancel
          </button>
          <button 
            class="create-confirm-btn" 
            on:click={createRoom}
            disabled={creating || !roomName.trim()}
          >
            {creating ? 'Creating...' : 'Create Room'}
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .lobby-screen {
    min-height: 100vh;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    padding: 20px;
  }

  .lobby-container {
    max-width: 800px;
    margin: 0 auto;
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
    margin: 0;
    font-size: 28px;
  }

  .user-info {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .username-btn {
    font-size: 16px;
    background: rgba(255, 255, 255, 0.2);
    padding: 8px 16px;
    border-radius: 20px;
    border: 1px solid rgba(255, 255, 255, 0.3);
    color: white;
    cursor: pointer;
    transition: all 0.3s;
  }
  
  .username-btn:hover {
    background: rgba(255, 255, 255, 0.3);
    border-color: rgba(255, 255, 255, 0.5);
  }
  
  .signout-btn {
    padding: 8px 16px;
    background: rgba(255, 255, 255, 0.2);
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.3s;
  }
  
  .signout-btn:hover {
    background: rgba(255, 255, 255, 0.3);
    border-color: rgba(255, 255, 255, 0.5);
  }

  .actions {
    padding: 20px 30px;
    display: flex;
    gap: 10px;
    border-bottom: 1px solid #eee;
  }

  .create-btn {
    flex: 1;
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

  .create-btn:hover {
    background: #5568d3;
  }

  .refresh-btn {
    padding: 12px 24px;
    background: white;
    color: #667eea;
    border: 2px solid #667eea;
    border-radius: 8px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s;
  }

  .refresh-btn:hover:not(:disabled) {
    background: #667eea;
    color: white;
  }

  .refresh-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .rooms-section {
    padding: 30px;
  }

  h2 {
    margin: 0 0 20px 0;
    color: #333;
    font-size: 22px;
  }

  .no-rooms {
    text-align: center;
    padding: 60px 20px;
    color: #999;
  }

  .no-rooms p {
    margin: 10px 0;
  }

  .hint {
    font-size: 14px;
  }

  .rooms-list {
    display: flex;
    flex-direction: column;
    gap: 15px;
  }

  .room-card {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px;
    background: #f8f9fa;
    border-radius: 8px;
    transition: transform 0.2s;
  }
  
  .room-card.in-progress {
    background: #e3f2fd;
    border-left: 4px solid #2196F3;
  }

  .room-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  .room-info h3 {
    margin: 0 0 8px 0;
    color: #333;
    font-size: 18px;
  }

  .room-players {
    margin: 0 0 4px 0;
    color: #666;
    font-size: 14px;
  }
  
  .spectator-count {
    margin-left: 12px;
    color: #2196F3;
    font-weight: 500;
  }
  
  .status-badge {
    display: inline-block;
    padding: 4px 12px;
    background: #2196F3;
    color: white;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 600;
  }
  
  .status-badge.finished {
    background: #757575;
  }

  .room-actions {
    display: flex;
    gap: 10px;
    align-items: center;
  }

  .join-btn {
    padding: 10px 30px;
    background: #667eea;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.3s;
  }

  .join-btn:hover:not(:disabled) {
    background: #5568d3;
  }

  .join-btn:disabled {
    background: #ccc;
    cursor: not-allowed;
  }

  .watch-btn {
    padding: 10px 24px;
    background: #2196F3;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.3s;
  }

  .watch-btn:hover {
    background: #1976D2;
  }

  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    z-index: 1000;
  }

  .modal {
    background: white;
    border-radius: 12px;
    padding: 30px;
    max-width: 400px;
    width: 100%;
  }

  .modal h2 {
    margin: 0 0 20px 0;
  }

  .form-group {
    margin-bottom: 20px;
  }

  .form-group label {
    display: block;
    margin-bottom: 8px;
    color: #333;
    font-weight: 600;
  }

  .form-group input,
  .form-group select {
    width: 100%;
    padding: 10px;
    border: 2px solid #ddd;
    border-radius: 6px;
    font-size: 14px;
  }

  .form-group input:focus,
  .form-group select:focus {
    outline: none;
    border-color: #667eea;
  }

  .modal-actions {
    display: flex;
    gap: 10px;
    margin-top: 30px;
  }

  .cancel-btn,
  .create-confirm-btn {
    flex: 1;
    padding: 12px 24px;
    border: none;
    border-radius: 8px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s;
  }

  .cancel-btn {
    background: white;
    color: #666;
    border: 2px solid #ddd;
  }

  .cancel-btn:hover {
    background: #f5f5f5;
  }

  .create-confirm-btn {
    background: #667eea;
    color: white;
  }

  .create-confirm-btn:hover:not(:disabled) {
    background: #5568d3;
  }

  .create-confirm-btn:disabled {
    background: #ccc;
    cursor: not-allowed;
  }
</style>
