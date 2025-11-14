<script lang="ts">
  import { onMount } from 'svelte';
  import { multiplayerStore } from '../stores/multiplayerStore';

  let serverUrl = '';
  let profile: any = null;
  let loading = true;
  let error = '';
  let editingAlias = false;
  let newAlias = '';
  let claimCode = '';
  let claiming = false;
  let claimError = '';
  let claimSuccess = false;
  let copySuccess = false;

  onMount(async () => {
    // @ts-ignore - Vite injects import.meta.env
    serverUrl = import.meta.env?.VITE_SERVER_URL || 'http://localhost:3001';
    await loadProfile();
  });

  async function loadProfile() {
    loading = true;
    error = '';
    
    const token = localStorage.getItem('quortex_token');
    if (!token) {
      error = 'Not authenticated';
      loading = false;
      return;
    }

    try {
      const response = await fetch(`${serverUrl}/api/profile`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load profile');
      }

      profile = await response.json();
      newAlias = profile.alias;
      
      // Auto-enable editing for new users
      if (!profile.profileCompleted && !profile.isAnonymous) {
        editingAlias = true;
      }
    } catch (err) {
      error = 'Failed to load profile';
      console.error(err);
    } finally {
      loading = false;
    }
  }

  async function saveAlias() {
    const token = localStorage.getItem('quortex_token');
    if (!token) return;

    try {
      const response = await fetch(`${serverUrl}/api/profile/alias`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ alias: newAlias })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update alias');
      }

      const data = await response.json();
      profile.alias = newAlias;
      profile.displayName = newAlias;
      profile.profileCompleted = data.profileCompleted;
      editingAlias = false;
      
      // If this was the first time setting alias, redirect to lobby
      if (data.profileCompleted && !profile.isAnonymous) {
        setTimeout(() => {
          multiplayerStore.setScreen('lobby');
        }, 1000);
      }
    } catch (err: any) {
      error = err.message;
    }
  }

  async function claimAccount() {
    if (!claimCode.trim()) return;

    claiming = true;
    claimError = '';
    claimSuccess = false;

    const token = localStorage.getItem('quortex_token');
    if (!token) return;

    try {
      const response = await fetch(`${serverUrl}/api/profile/claim`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ claimCode: claimCode.trim().toUpperCase() })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to claim account');
      }

      const data = await response.json();
      claimSuccess = true;
      claimCode = '';
      
      // Reload profile to show merged stats
      await loadProfile();
    } catch (err: any) {
      claimError = err.message;
    } finally {
      claiming = false;
    }
  }

  function copyClaimCode() {
    if (!profile?.claimCode) return;
    
    navigator.clipboard.writeText(profile.claimCode).then(() => {
      copySuccess = true;
      setTimeout(() => {
        copySuccess = false;
      }, 2000);
    });
  }

  function goBack() {
    multiplayerStore.setScreen('lobby');
  }
  
  $: isNewUser = profile && !profile.profileCompleted && !profile.isAnonymous;

  function getProviderDisplay(provider: string) {
    switch (provider) {
      case 'discord': return '🎮 Discord';
      case 'google': return '🔵 Google';
      case 'anonymous': return '👤 Guest';
      default: return provider;
    }
  }

  function formatDate(dateStr: string) {
    const date = new Date(dateStr);
    return date.toLocaleDateString();
  }
</script>

<div class="profile-screen">
  <div class="profile-container">
    <header>
      {#if !isNewUser}
        <button class="back-btn" on:click={goBack}>← Back to Lobby</button>
      {/if}
      <h1>{isNewUser ? 'Welcome! Set Up Your Profile' : 'Your Profile'}</h1>
    </header>

    {#if loading}
      <div class="loading">Loading profile...</div>
    {:else if error && !profile}
      <div class="error">{error}</div>
    {:else if profile}
      <div class="profile-content">
        {#if isNewUser}
          <div class="welcome-message">
            <p>👋 Welcome to Quortex! Please choose a display name for yourself.</p>
            <p class="welcome-hint">You can change this later from your profile.</p>
          </div>
        {/if}
        
        <!-- User Info Section -->
        <section class="profile-section">
          <div class="profile-header">
            {#if profile.avatar}
              <img src={profile.avatar} alt="Avatar" class="avatar" />
            {:else}
              <div class="avatar-placeholder">
                {profile.alias[0].toUpperCase()}
              </div>
            {/if}
            <div class="profile-info">
              <div class="alias-section">
                {#if editingAlias}
                  <div class="alias-edit">
                    <input
                      type="text"
                      bind:value={newAlias}
                      maxlength="20"
                      placeholder="Enter alias"
                    />
                    <button on:click={saveAlias}>Save</button>
                    <button class="cancel-btn" on:click={() => { editingAlias = false; newAlias = profile.alias; }}>
                      Cancel
                    </button>
                  </div>
                {:else}
                  <h2>{profile.alias}</h2>
                  <button class="edit-btn" on:click={() => editingAlias = true}>
                    ✏️ Edit
                  </button>
                {/if}
              </div>
              <p class="provider-badge">{getProviderDisplay(profile.provider)}</p>
              <p class="member-since">Member since {formatDate(profile.createdAt)}</p>
            </div>
          </div>
        </section>

        <!-- Claim Code Section -->
        <section class="profile-section claim-code-section">
          <h3>Your Claim Code</h3>
          <p class="claim-code-description">
            Use this code to claim your account on another device or after signing in with a different provider.
          </p>
          <div class="claim-code-display">
            <div class="code">{profile.claimCode}</div>
            <button class="copy-btn" on:click={copyClaimCode}>
              {copySuccess ? '✓ Copied!' : '📋 Copy'}
            </button>
          </div>
        </section>

        <!-- Statistics Section -->
        <section class="profile-section stats-section">
          <h3>Statistics</h3>
          <div class="stats-grid">
            <div class="stat-item">
              <div class="stat-value">{profile.stats.gamesPlayed}</div>
              <div class="stat-label">Games Played</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">{profile.stats.gamesWon}</div>
              <div class="stat-label">Wins</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">{profile.stats.gamesLost}</div>
              <div class="stat-label">Losses</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">
                {profile.stats.gamesPlayed > 0 
                  ? Math.round((profile.stats.gamesWon / profile.stats.gamesPlayed) * 100) 
                  : 0}%
              </div>
              <div class="stat-label">Win Rate</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">{profile.stats.winStreak}</div>
              <div class="stat-label">Current Streak</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">{profile.stats.bestWinStreak}</div>
              <div class="stat-label">Best Streak</div>
            </div>
          </div>
        </section>

        <!-- Claim Another Account Section -->
        <section class="profile-section claim-section">
          <h3>Claim Another Account</h3>
          <p class="claim-description">
            Have a guest account? Enter its claim code to merge the stats and game history into this account.
          </p>
          
          {#if claimSuccess}
            <div class="success-message">
              ✓ Account claimed successfully! Stats have been merged.
            </div>
          {/if}
          
          {#if claimError}
            <div class="error-message">{claimError}</div>
          {/if}
          
          <div class="claim-input-group">
            <input
              type="text"
              bind:value={claimCode}
              placeholder="Enter 6-letter code"
              maxlength="6"
              disabled={claiming}
            />
            <button 
              class="claim-btn" 
              on:click={claimAccount}
              disabled={claiming || !claimCode.trim()}
            >
              {claiming ? 'Claiming...' : 'Claim Account'}
            </button>
          </div>
        </section>
      </div>
    {/if}
  </div>
</div>

<style>
  .profile-screen {
    min-height: 100vh;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    padding: 20px;
  }

  .profile-container {
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
    padding: 20px 30px;
  }

  .back-btn {
    background: rgba(255, 255, 255, 0.2);
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.3);
    padding: 8px 16px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    margin-bottom: 10px;
    transition: all 0.3s;
  }

  .back-btn:hover {
    background: rgba(255, 255, 255, 0.3);
  }

  h1 {
    margin: 0;
    font-size: 28px;
  }

  .loading, .error {
    padding: 40px;
    text-align: center;
    color: #666;
  }

  .error {
    color: #e74c3c;
  }

  .profile-content {
    padding: 30px;
  }
  
  .welcome-message {
    background: #e3f2fd;
    border-left: 4px solid #2196F3;
    padding: 20px;
    margin-bottom: 25px;
    border-radius: 8px;
  }
  
  .welcome-message p {
    margin: 0 0 8px 0;
    color: #1565C0;
    font-size: 16px;
    font-weight: 500;
  }
  
  .welcome-hint {
    font-size: 14px !important;
    font-weight: 400 !important;
    color: #1976D2 !important;
  }

  .profile-section {
    margin-bottom: 30px;
    padding: 20px;
    background: #f8f9fa;
    border-radius: 8px;
  }

  .profile-header {
    display: flex;
    gap: 20px;
    align-items: center;
  }

  .avatar, .avatar-placeholder {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .avatar-placeholder {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 32px;
    font-weight: 600;
  }

  .profile-info {
    flex: 1;
  }

  .alias-section {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 8px;
  }

  .alias-section h2 {
    margin: 0;
    font-size: 24px;
    color: #333;
  }

  .edit-btn {
    padding: 6px 12px;
    background: white;
    border: 2px solid #667eea;
    border-radius: 6px;
    color: #667eea;
    cursor: pointer;
    font-size: 14px;
    transition: all 0.3s;
  }

  .edit-btn:hover {
    background: #667eea;
    color: white;
  }

  .alias-edit {
    display: flex;
    gap: 8px;
    flex: 1;
  }

  .alias-edit input {
    flex: 1;
    padding: 8px 12px;
    border: 2px solid #ddd;
    border-radius: 6px;
    font-size: 16px;
  }

  .alias-edit button {
    padding: 8px 16px;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 600;
  }

  .alias-edit button:first-of-type {
    background: #667eea;
    color: white;
  }

  .cancel-btn {
    background: #ccc !important;
    color: #333 !important;
  }

  .provider-badge {
    margin: 0 0 4px 0;
    font-size: 14px;
    color: #666;
  }

  .member-since {
    margin: 0;
    font-size: 14px;
    color: #999;
  }

  .claim-code-section h3,
  .stats-section h3,
  .claim-section h3 {
    margin: 0 0 15px 0;
    color: #333;
    font-size: 18px;
  }

  .claim-code-description,
  .claim-description {
    color: #666;
    font-size: 14px;
    margin-bottom: 15px;
  }

  .claim-code-display {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .code {
    flex: 1;
    padding: 16px 20px;
    background: white;
    border: 2px solid #667eea;
    border-radius: 8px;
    font-size: 24px;
    font-weight: 700;
    letter-spacing: 4px;
    text-align: center;
    color: #667eea;
    font-family: monospace;
  }

  .copy-btn {
    padding: 12px 20px;
    background: #667eea;
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 600;
    transition: all 0.3s;
    white-space: nowrap;
  }

  .copy-btn:hover {
    background: #5568d3;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 15px;
  }

  .stat-item {
    background: white;
    padding: 15px;
    border-radius: 8px;
    text-align: center;
  }

  .stat-value {
    font-size: 28px;
    font-weight: 700;
    color: #667eea;
    margin-bottom: 5px;
  }

  .stat-label {
    font-size: 12px;
    color: #666;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .claim-input-group {
    display: flex;
    gap: 10px;
  }

  .claim-input-group input {
    flex: 1;
    padding: 12px 16px;
    border: 2px solid #ddd;
    border-radius: 8px;
    font-size: 16px;
    text-transform: uppercase;
  }

  .claim-input-group input:focus {
    outline: none;
    border-color: #667eea;
  }

  .claim-btn {
    padding: 12px 24px;
    background: #667eea;
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-size: 16px;
    font-weight: 600;
    transition: all 0.3s;
    white-space: nowrap;
  }

  .claim-btn:hover:not(:disabled) {
    background: #5568d3;
  }

  .claim-btn:disabled {
    background: #ccc;
    cursor: not-allowed;
  }

  .success-message {
    padding: 12px;
    background: #d4edda;
    border: 1px solid #c3e6cb;
    border-radius: 6px;
    color: #155724;
    margin-bottom: 15px;
  }

  .error-message {
    padding: 12px;
    background: #f8d7da;
    border: 1px solid #f5c6cb;
    border-radius: 6px;
    color: #721c24;
    margin-bottom: 15px;
  }
</style>
