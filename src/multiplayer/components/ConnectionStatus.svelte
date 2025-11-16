<script>
  import { multiplayerStore } from '../stores/multiplayerStore';
  
  $: connectionStatus = $multiplayerStore.connectionStatus;
  $: showStatus = connectionStatus !== 'connected';
</script>

{#if showStatus}
  <div class="connection-status {connectionStatus}">
    {#if connectionStatus === 'reconnecting'}
      <span class="status-icon">🔄</span>
      <span class="status-text">Reconnecting to game...</span>
    {:else if connectionStatus === 'disconnected'}
      <span class="status-icon">⚠️</span>
      <span class="status-text">Disconnected</span>
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
