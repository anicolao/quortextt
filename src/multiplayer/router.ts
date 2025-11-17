/**
 * Browser History API-based Router
 * Provides URL routing for the multiplayer app without external dependencies
 */

export type Screen = 'login' | 'lobby' | 'room' | 'game' | 'profile';

export interface RouteParams {
  id?: string;
  discord?: string;
  spectate?: string;
}

export interface Route {
  screen: Screen;
  params: RouteParams;
}

/**
 * Router class for managing URL-based navigation
 */
export class Router {
  private static basePath = '/quortextt/';
  private static listeners: Array<(route: Route) => void> = [];
  private static initialized = false;

  /**
   * Initialize the router and set up event listeners
   */
  static init(): void {
    if (this.initialized) {
      console.warn('[Router] Already initialized');
      return;
    }

    console.log('[Router] Initializing...');
    
    // Handle browser back/forward buttons
    window.addEventListener('popstate', (event) => {
      console.log('[Router] popstate event', event.state);
      const route = this.getCurrentRoute();
      this.notifyListeners(route);
    });

    // Restore state from URL on page load
    const route = this.getCurrentRoute();
    console.log('[Router] Initial route:', route);
    
    this.initialized = true;
  }

  /**
   * Navigate to a new screen with optional parameters
   * Updates the URL and browser history
   */
  static navigate(screen: Screen, params: RouteParams = {}): void {
    const url = this.buildURL(screen, params);
    const state = { screen, params };
    
    console.log('[Router] Navigating to:', screen, params, '→', url);
    
    // Only push state if URL is different to avoid duplicate history entries
    if (window.location.pathname + window.location.search !== url) {
      window.history.pushState(state, '', url);
    }
    
    this.notifyListeners({ screen, params });
  }

  /**
   * Replace current history entry (useful for redirects)
   */
  static replace(screen: Screen, params: RouteParams = {}): void {
    const url = this.buildURL(screen, params);
    const state = { screen, params };
    
    console.log('[Router] Replacing route:', screen, params, '→', url);
    window.history.replaceState(state, '', url);
    
    this.notifyListeners({ screen, params });
  }

  /**
   * Get the current route from the URL
   */
  static getCurrentRoute(): Route {
    const path = window.location.pathname;
    const searchParams = new URLSearchParams(window.location.search);
    
    // Extract screen from path
    let screen: Screen = 'login'; // default
    
    if (path.includes('/lobby')) {
      screen = 'lobby';
    } else if (path.includes('/room')) {
      screen = 'room';
    } else if (path.includes('/game')) {
      screen = 'game';
    } else if (path.includes('/profile')) {
      screen = 'profile';
    } else if (path === this.basePath || path === this.basePath.slice(0, -1)) {
      screen = 'login';
    }
    
    // Extract parameters
    const params: RouteParams = {};
    const id = searchParams.get('id');
    const discord = searchParams.get('discord');
    const spectate = searchParams.get('spectate');
    
    if (id) params.id = id;
    if (discord) params.discord = discord;
    if (spectate) params.spectate = spectate;
    
    return { screen, params };
  }

  /**
   * Subscribe to route changes
   */
  static subscribe(listener: (route: Route) => void): () => void {
    this.listeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Check if we're in Discord context
   */
  static isDiscordContext(): boolean {
    const params = new URLSearchParams(window.location.search);
    return params.get('discord') === 'true';
  }

  /**
   * Build URL from screen and parameters
   */
  private static buildURL(screen: Screen, params: RouteParams): string {
    let path = this.basePath;
    
    // Add screen to path (except for login which is the root)
    if (screen !== 'login') {
      path += screen;
    }
    
    // Add query parameters
    const searchParams = new URLSearchParams();
    if (params.id) searchParams.set('id', params.id);
    if (params.discord) searchParams.set('discord', params.discord);
    if (params.spectate) searchParams.set('spectate', params.spectate);
    
    const queryString = searchParams.toString();
    return queryString ? `${path}?${queryString}` : path;
  }

  /**
   * Notify all listeners of route change
   */
  private static notifyListeners(route: Route): void {
    this.listeners.forEach(listener => {
      try {
        listener(route);
      } catch (error) {
        console.error('[Router] Error in route listener:', error);
      }
    });
  }

  /**
   * Get the base path for the application
   */
  static getBasePath(): string {
    return this.basePath;
  }
}
