/**
 * Discord Activity SDK Integration
 * Handles Discord authentication and activity initialization
 */

import { DiscordSDK } from '@discord/embedded-app-sdk';

export interface DiscordAuthResult {
  token: string;
  userId: string;
  username: string;
  discriminator: string;
  avatarUrl: string | null;
}

export class DiscordActivityClient {
  private sdk: DiscordSDK;
  private authResult: DiscordAuthResult | null = null;

  constructor(clientId: string) {
    this.sdk = new DiscordSDK(clientId);
  }

  /**
   * Initialize the Discord SDK and wait for ready state
   */
  async initialize(): Promise<void> {
    console.log('[Discord Activity] Initializing SDK...');
    await this.sdk.ready();
    console.log('[Discord Activity] SDK ready');
  }

  /**
   * Authenticate with Discord using client-side flow for Discord Activities
   * This uses the Discord SDK's authorize() → token exchange → authenticate() pattern
   */
  async authenticate(): Promise<DiscordAuthResult> {
    console.log('[Discord Activity] Starting authentication...');
    
    try {
      const clientId = import.meta.env.VITE_DISCORD_CLIENT_ID;
      if (!clientId) {
        throw new Error('VITE_DISCORD_CLIENT_ID not configured');
      }

      // Step 1: Request authorization code from Discord
      const { code } = await this.sdk.commands.authorize({
        client_id: clientId,
        response_type: 'code',
        state: '',
        prompt: 'none',
        scope: [
          'identify',
          'guilds',
        ],
      });

      console.log('[Discord Activity] Authorization code received');

      // Step 2: Exchange code for access token via backend
      // Use /.proxy path which Discord automatically routes to our backend
      const response = await fetch('/.proxy/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Discord Activity] Token exchange failed:', errorText);
        throw new Error(`Token exchange failed: ${response.statusText}`);
      }

      const { access_token } = await response.json();
      console.log('[Discord Activity] Access token received');

      // Step 3: Authenticate with Discord client using the access token
      const auth = await this.sdk.commands.authenticate({
        access_token,
      });

      console.log('[Discord Activity] Authentication successful:', auth.user.username);
      
      this.authResult = {
        token: access_token,
        userId: auth.user.id,
        username: auth.user.username,
        discriminator: auth.user.discriminator || '0',
        avatarUrl: auth.user.avatar
          ? `https://cdn.discordapp.com/avatars/${auth.user.id}/${auth.user.avatar}.png`
          : null,
      };

      return this.authResult;

    } catch (error) {
      console.error('[Discord Activity] Authentication error:', error);
      throw error;
    }
  }

  /**
   * Get the current authenticated user info
   */
  getAuthResult(): DiscordAuthResult | null {
    return this.authResult;
  }

  /**
   * Get the Discord SDK instance
   */
  getSDK(): DiscordSDK {
    return this.sdk;
  }

  /**
   * Get Discord channel and guild information
   */
  getChannelInfo(): { channelId: string | null; guildId: string | null } {
    return {
      channelId: this.sdk.channelId,
      guildId: this.sdk.guildId,
    };
  }

  /**
   * Check if running in a Discord Activity context
   */
  static isDiscordActivity(): boolean {
    // Discord adds frame_id and instance_id to URL params when running in Activity
    const params = new URLSearchParams(window.location.search);
    return params.has('frame_id') || params.has('instance_id');
  }
}
