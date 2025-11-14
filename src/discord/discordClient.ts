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
   * Authenticate with Discord using OAuth2 flow
   * Uses client-side authentication via Discord SDK
   */
  async authenticate(): Promise<DiscordAuthResult> {
    console.log('[Discord Activity] Starting authentication...');
    
    try {
      const clientId = import.meta.env.VITE_DISCORD_CLIENT_ID;
      if (!clientId) {
        throw new Error('VITE_DISCORD_CLIENT_ID not configured');
      }

      // Request authorization from Discord
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

      // Use Discord SDK to get user info directly (client-side only, no backend needed)
      // The SDK already has access to the authenticated user session
      const { user } = await this.sdk.commands.authenticate({
        access_token: await this.sdk.commands.getAccessToken(),
      });

      console.log('[Discord Activity] User authenticated:', user);
      
      this.authResult = {
        token: code, // Use code as token for now (client-side only)
        userId: user.id,
        username: user.username,
        discriminator: user.discriminator || '0',
        avatarUrl: user.avatar
          ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
          : null,
      };

      console.log('[Discord Activity] Authentication successful:', this.authResult.username);
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
   * Check if running in a Discord Activity context
   */
  static isDiscordActivity(): boolean {
    // Discord adds frame_id and instance_id to URL params when running in Activity
    const params = new URLSearchParams(window.location.search);
    return params.has('frame_id') || params.has('instance_id');
  }
}
