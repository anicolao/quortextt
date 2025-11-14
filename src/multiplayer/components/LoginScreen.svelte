<script lang="ts">
  import { onMount } from 'svelte';
  import { multiplayerStore } from '../stores/multiplayerStore';
  import { socket } from '../socket';

  let username = '';
  let connecting = false;
  let error = '';
  let serverUrl = '';
  
  onMount(() => {
    // Get server URL from environment
    // @ts-ignore - Vite injects import.meta.env
    serverUrl = import.meta.env?.VITE_SERVER_URL || 'http://localhost:3001';
    
    // Check if we have a token from OAuth callback
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const authError = urlParams.get('error');
    
    if (authError) {
      error = `Authentication failed: ${authError}`;
    } else if (token) {
      // Store token and connect with authentication
      localStorage.setItem('quortex_token', token);
      handleAuthenticatedLogin(token);
      
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
    } else {
      // Check for stored token
      const storedToken = localStorage.getItem('quortex_token');
      if (storedToken) {
        handleAuthenticatedLogin(storedToken);
      } else {
        // Check for anonymous cookie
        checkAnonymousCookie();
      }
    }
  });

  async function checkAnonymousCookie() {
    try {
      const response = await fetch(`${serverUrl}/auth/validate-anonymous`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.valid && data.userId) {
          // Generate token for anonymous user (server already has the user)
          // We need to get a token - let's call /auth/me with the anonymous cookie
          // Actually, the server should return a token. Let's update this flow.
          // For now, just show the login screen - user can re-enter their name
          console.log('Anonymous user cookie found but no token - user should log in again');
        }
      }
    } catch (err) {
      console.error('Error checking anonymous cookie:', err);
    }
  }

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
      // Create anonymous user via API
      const response = await fetch(`${serverUrl}/auth/anonymous`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include', // Include cookies
        body: JSON.stringify({ username: username.trim() })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create account');
      }

      const data = await response.json();
      
      // Store token
      localStorage.setItem('quortex_token', data.token);
      
      // Connect to socket with authentication
      await socket.connectWithAuth(data.token);
      socket.identify(data.alias);
      
      // Wait a bit for identification
      setTimeout(() => {
        multiplayerStore.setScreen('lobby');
      }, 500);
    } catch (err: any) {
      error = err.message || 'Failed to connect to server';
      connecting = false;
    }
  }
  
  async function handleAuthenticatedLogin(token: string) {
    connecting = true;
    error = '';
    
    try {
      // Fetch user info from server
      const response = await fetch(`${serverUrl}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Invalid or expired token');
      }
      
      const user = await response.json();
      
      // Connect to socket with authentication
      await socket.connectWithAuth(token);
      socket.identify(user.alias || user.displayName);
      
      // Wait a bit for identification
      setTimeout(() => {
        multiplayerStore.setScreen('lobby');
      }, 500);
    } catch (err) {
      error = 'Authentication failed. Please try again.';
      localStorage.removeItem('quortex_token');
      connecting = false;
    }
  }
  
  function handleDiscordLogin() {
    // Redirect to Discord OAuth with current URL as returnTo
    const returnTo = encodeURIComponent(window.location.href);
    window.location.href = `${serverUrl}/auth/discord?returnTo=${returnTo}`;
  }
  
  function handleGoogleLogin() {
    // Redirect to Google OAuth with current URL as returnTo
    const returnTo = encodeURIComponent(window.location.href);
    window.location.href = `${serverUrl}/auth/google?returnTo=${returnTo}`;
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
    <p class="subtitle">Choose how to join</p>
    
    {#if error}
      <div class="error">{error}</div>
    {/if}
    
    <div class="login-options">
      <div class="oauth-section">
        <button class="discord-button" on:click={handleDiscordLogin} disabled={connecting}>
          <svg class="discord-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
          </svg>
          {connecting ? 'Connecting...' : 'Continue with Discord'}
        </button>
        
        <button class="google-button" on:click={handleGoogleLogin} disabled={connecting}>
          <svg class="google-icon" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          {connecting ? 'Connecting...' : 'Continue with Google'}
        </button>
        <p class="oauth-description">Sign in with Discord or Google</p>
      </div>
      
      <div class="divider">
        <span>or</span>
      </div>
      
      <div class="guest-section">
        <p class="section-label">Join as guest</p>
        <div class="login-form">
          <input
            type="text"
            bind:value={username}
            on:keypress={handleKeyPress}
            placeholder="Enter username"
            maxlength="20"
            disabled={connecting}
          />
          
          <button on:click={handleLogin} disabled={connecting || !username.trim()}>
            {connecting ? 'Connecting...' : 'Join Lobby'}
          </button>
        </div>
      </div>
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
    max-width: 450px;
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
    font-size: 16px;
  }

  .login-options {
    display: flex;
    flex-direction: column;
    gap: 25px;
  }

  .oauth-section {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .discord-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 14px 24px;
    background: #5865F2;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.3s;
  }

  .discord-button:hover:not(:disabled) {
    background: #4752C4;
  }

  .discord-button:disabled {
    background: #ccc;
    cursor: not-allowed;
  }

  .discord-icon {
    width: 24px;
    height: 24px;
  }
  
  .google-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 14px 24px;
    background: white;
    color: #444;
    border: 2px solid #ddd;
    border-radius: 8px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s;
  }

  .google-button:hover:not(:disabled) {
    border-color: #4285F4;
    box-shadow: 0 2px 8px rgba(66, 133, 244, 0.3);
  }

  .google-button:disabled {
    background: #f5f5f5;
    color: #ccc;
    cursor: not-allowed;
  }

  .google-icon {
    width: 24px;
    height: 24px;
  }

  .oauth-description {
    text-align: center;
    color: #666;
    font-size: 14px;
    margin: 0;
  }

  .divider {
    display: flex;
    align-items: center;
    text-align: center;
    color: #999;
    margin: 10px 0;
  }

  .divider::before,
  .divider::after {
    content: '';
    flex: 1;
    border-bottom: 1px solid #ddd;
  }

  .divider span {
    padding: 0 15px;
    font-size: 14px;
  }

  .guest-section {
    display: flex;
    flex-direction: column;
    gap: 15px;
  }

  .section-label {
    text-align: center;
    color: #666;
    font-size: 14px;
    font-weight: 600;
    margin: 0;
  }

  .login-form {
    display: flex;
    flex-direction: column;
    gap: 12px;
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
    padding: 12px;
    background: #fee;
    border-radius: 8px;
    text-align: center;
    margin-bottom: 10px;
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
