<script>
  import { multiplayerStore } from '../stores/multiplayerStore';
  import { onMount, onDestroy } from 'svelte';
  
  $: connectionStatus = $multiplayerStore.connectionStatus;
  $: connected = $multiplayerStore.connected;
  
  let hasConnectedBefore = false;
  let reconnectAttempts = 0;
  let showPoorConnectionWarning = false;
  let poorConnectionTimer = null;
  
  // Track if we've ever been connected
  $: if (connected) {
    hasConnectedBefore = true;
    reconnectAttempts = 0;
    showPoorConnectionWarning = false;
    if (poorConnectionTimer) {
      clearTimeout(poorConnectionTimer);
      poorConnectionTimer = null;
    }
  }
  
  // Detect poor connection (Section 2.2.1, item 1)
  // If reconnecting for more than 3 attempts or 15 seconds, show warning
  $: if (connectionStatus === 'reconnecting') {
    reconnectAttempts++;
    
    if (reconnectAttempts >= 3 && !showPoorConnectionWarning) {
      showPoorConnectionWarning = true;
    }
    
    // Also show warning after 15 seconds of reconnecting
    if (!poorConnectionTimer) {
      poorConnectionTimer = setTimeout(() => {
        showPoorConnectionWarning = true;
      }, 15000);
    }
  }
  
  // Only show status if we've connected before and are now not connected
  $: showStatus = hasConnectedBefore && connectionStatus !== 'connected';
  
  onDestroy(() => {
    if (poorConnectionTimer) {
      clearTimeout(poorConnectionTimer);
    }
  });
</script>

{#if showStatus}
  <div class="connection-status {connectionStatus}">
    {#if connectionStatus === 'reconnecting'}
      <span class="status-icon">🔄</span>
      <span class="status-text">
        {#if showPoorConnectionWarning}
          Poor connection - retrying...
        {:else}
          Reconnecting to game...
        {/if}
      </span>
    {:else if connectionStatus === 'disconnected'}
      <span class="status-icon">⚠️</span>
      <span class="status-text">Disconnected</span>
    {:else if connectionStatus === 'connected_elsewhere'}
      <span class="status-icon">📱</span>
      <span class="status-text">Connected from another device (read-only)</span>
    {/if}
  </div>
{/if}

<style>
  .connection-status {
    position: fixed;
    top: 10px;
    left: 50%;
    transform: translateX(-50%);
    padding: 12px 24px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 500;
    z-index: 1000;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    animation: slideDown 0.3s ease-out;
  }
  
  .connection-status.reconnecting {
    background-color: #fef3cd;
    color: #856404;
    border: 1px solid #ffeaa7;
  }
  
  .connection-status.disconnected {
    background-color: #f8d7da;
    color: #721c24;
    border: 1px solid #f5c6cb;
  }
  
  .connection-status.connected_elsewhere {
    background-color: #d1ecf1;
    color: #0c5460;
    border: 1px solid #bee5eb;
  }
  
  .status-icon {
    font-size: 18px;
    line-height: 1;
  }
  
  .status-text {
    font-size: 14px;
  }
  
  .reconnecting .status-icon {
    animation: spin 1s linear infinite;
  }
  
  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(-20px);
    }
    to {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
  }
  
  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
</style>
