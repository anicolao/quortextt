# Routing Design Document

## Overview

This document evaluates different approaches for implementing distinct routes for games in Quortex, specifically to support URLs like `/quortextt/game?id=<gameid>`. The goal is to enable sharing game links, deep linking directly into games, and supporting browser navigation (back/forward buttons).

## Current State Analysis

### Existing Architecture

Quortex currently uses a **multi-page application (MPA)** approach with Vite as the build tool:

**Entry Points:**
- `/` (index.html) → Multiplayer experience with Svelte UI
- `/tabletop` (tabletop.html) → Local tabletop mode (Canvas only)
- `/discord/` (discord/index.html) → Discord Activity embedded mode

**Navigation Model:**
- The multiplayer mode uses a Svelte store (`multiplayerStore`) with a `screen` property
- Screens: `'login' | 'lobby' | 'room' | 'game' | 'profile'`
- Navigation is purely state-based (no URL changes)
- When `screen = 'game'` and `gameId` is set, the Svelte UI hides and the canvas game shows

**Current Limitations:**
1. ❌ No URL reflects current screen/game state
2. ❌ Can't share direct links to games
3. ❌ Browser back/forward buttons don't work
4. ❌ Refreshing the page always returns to login
5. ❌ No deep linking support

### Technology Stack

- **Frontend Build Tool:** Vite 7.x
- **UI Framework:** Svelte 5.x (components only, not SvelteKit)
- **State Management:** Redux (for game state) + Svelte stores (for multiplayer UI)
- **Base Path:** `/quortextt/` (configured in vite.config.ts)
- **Backend:** Node.js + Express + Socket.IO

**Key Insight:** The project uses **Svelte components** but **NOT SvelteKit** - there's no SvelteKit routing infrastructure.

## Routing Approaches Comparison

### Option 1: SvelteKit Migration (Full Framework)

**Description:** Migrate from Vite + Svelte to SvelteKit, which provides built-in routing, server-side rendering, and state management.

**Implementation:**
```
src/routes/
  +layout.svelte
  +page.svelte              → /quortextt/ (lobby)
  game/
    +page.svelte            → /quortextt/game?id=xxx
  tabletop/
    +page.svelte            → /quortextt/tabletop
  discord/
    +page.svelte            → /quortextt/discord
```

**Pros:**
- ✅ Professional routing solution with file-based routing
- ✅ Built-in support for query parameters and dynamic routes
- ✅ Server-side rendering capabilities
- ✅ Better SEO potential
- ✅ Simplified state management with $page store
- ✅ Excellent TypeScript support

**Cons:**
- ❌ **MAJOR REFACTOR**: Requires restructuring entire application
- ❌ Need to migrate all HTML entry points to SvelteKit routes
- ❌ Vite config would need significant changes
- ❌ Multi-entry build setup (index.html, tabletop.html, discord/) would need rethinking
- ❌ May conflict with existing Redux store architecture
- ❌ Learning curve for team unfamiliar with SvelteKit
- ❌ Potential complications with canvas-based game (not traditional SPA UI)
- ❌ Requires adapter configuration for static deployment (GitHub Pages)

**Effort Estimate:** 3-5 days (HIGH)

**Risk Level:** HIGH - Touches all parts of the application

---

### Option 2: Client-Side Router Library (Svelte-spa-router, Page.js, Navaid)

**Description:** Add a lightweight client-side routing library that works with existing Svelte setup.

**Popular Options:**
- `svelte-spa-router` - Most popular for Svelte SPAs
- `page.js` - Minimalist router (4KB)
- `navaid` - Ultra-lightweight (650B)
- `tinro` - Modern SPA router for Svelte

**Implementation Example (svelte-spa-router):**
```typescript
// App.svelte
import Router from 'svelte-spa-router';
import { wrap } from 'svelte-spa-router/wrap';

const routes = {
  '/': LoginScreen,
  '/lobby': LobbyScreen,
  '/room/:roomId': RoomScreen,
  '/game': wrap({
    asyncComponent: () => import('./GameScreen.svelte')
  }),
  '/profile': ProfileScreen,
};
```

**URL Structure:**
```
/quortextt/                    → Login
/quortextt/lobby               → Lobby
/quortextt/room/abc123         → Room
/quortextt/game?id=xyz789      → Game
/quortextt/profile             → Profile
```

**Pros:**
- ✅ Minimal code changes to existing structure
- ✅ Works with current Svelte component architecture
- ✅ Supports query parameters and route params
- ✅ Browser history integration (back/forward)
- ✅ Small bundle size (especially tinro/navaid)
- ✅ Can coexist with existing state management

**Cons:**
- ❌ Additional dependency
- ❌ Need to refactor screen state management
- ❌ Still need to handle canvas game visibility based on route
- ❌ Less "official" than SvelteKit for Svelte projects
- ❌ May have edge cases with multi-entry setup

**Effort Estimate:** 1-2 days (MEDIUM)

**Risk Level:** MEDIUM - Requires refactoring screen management

---

### Option 3: Vanilla Browser History API (Custom Solution)

**Description:** Implement URL routing manually using the native History API without external libraries.

**Implementation:**
```typescript
// router.ts
export class Router {
  static navigate(screen: string, params?: Record<string, string>) {
    const url = new URL(window.location.href);
    url.pathname = `/quortextt/${screen}`;
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
    }
    window.history.pushState({ screen, params }, '', url);
    multiplayerStore.setScreen(screen);
    if (params?.id) {
      multiplayerStore.setGameId(params.id);
    }
  }
  
  static init() {
    // Handle popstate (back/forward)
    window.addEventListener('popstate', (event) => {
      const path = window.location.pathname;
      const params = new URLSearchParams(window.location.search);
      
      if (path.includes('/game')) {
        const gameId = params.get('id');
        multiplayerStore.setScreen('game');
        multiplayerStore.setGameId(gameId);
      } else if (path.includes('/lobby')) {
        multiplayerStore.setScreen('lobby');
      }
      // ... handle other routes
    });
    
    // Restore state on page load
    this.restoreFromURL();
  }
}
```

**URL Structure:**
```
/quortextt/                    → Default (login)
/quortextt/lobby               → Lobby
/quortextt/room?id=abc123      → Room
/quortextt/game?id=xyz789      → Game
/quortextt/profile             → Profile
```

**Pros:**
- ✅ **No external dependencies**
- ✅ **Minimal code changes** - add router, update store setters
- ✅ Full control over routing logic
- ✅ Works perfectly with existing multiplayerStore
- ✅ Tiny implementation (~100-200 lines)
- ✅ Easy to understand and maintain
- ✅ No conflicts with existing build setup

**Cons:**
- ❌ Must implement URL parsing ourselves
- ❌ Need to manually sync URL with state
- ❌ No advanced features (nested routes, lazy loading by default)
- ❌ More testing needed for edge cases
- ❌ Less community support than libraries

**Effort Estimate:** 1 day (LOW-MEDIUM)

**Risk Level:** LOW - Isolated changes, easy to test

---

### Option 4: Vite-Plugin-Pages (File-Based Routing for Vite)

**Description:** Use `vite-plugin-pages` to get file-based routing without full SvelteKit migration.

**Implementation:**
```typescript
// vite.config.ts
import Pages from 'vite-plugin-pages';

export default defineConfig({
  plugins: [
    svelte(),
    Pages({
      dirs: 'src/pages',
      extensions: ['svelte'],
    })
  ]
});
```

**File Structure:**
```
src/pages/
  index.svelte              → /quortextt/
  lobby.svelte              → /quortextt/lobby
  game.svelte               → /quortextt/game
  profile.svelte            → /quortextt/profile
```

**Pros:**
- ✅ File-based routing (intuitive)
- ✅ Automatic route generation
- ✅ Works with existing Vite setup
- ✅ Supports dynamic routes and params

**Cons:**
- ❌ Requires restructuring component organization
- ❌ Additional build complexity
- ❌ Less documentation for Svelte (more React-focused)
- ❌ Still need to handle multi-entry setup
- ❌ Might conflict with existing HTML entry points

**Effort Estimate:** 2-3 days (MEDIUM-HIGH)

**Risk Level:** MEDIUM-HIGH - Build configuration changes

---

## Recommendation

### **Recommended Approach: Option 3 - Vanilla Browser History API**

**Rationale:**

1. **Simplest Implementation** - The project doesn't need advanced routing features. We just need:
   - URL reflects current screen
   - Query parameters for game/room IDs
   - Browser back/forward support
   - Deep linking

2. **Minimal Disruption** - Works seamlessly with existing architecture:
   - No migration needed
   - Keeps current Svelte store pattern
   - No new dependencies
   - Isolated changes to specific files

3. **Best Effort/Value Ratio** - ~1 day implementation vs. 3-5 days for SvelteKit

4. **Maintains Simplicity** - The project uses "simple" tools (Vite, not SvelteKit). Adding lightweight routing matches this philosophy.

5. **Low Risk** - Changes are isolated and easy to test/rollback

### Implementation Plan

**Phase 1: Core Router (2-4 hours)**

Create `src/multiplayer/router.ts`:
```typescript
export class Router {
  static navigate(screen: Screen, params?: Record<string, string>): void
  static init(): void
  static getCurrentRoute(): { screen: Screen; params: Record<string, string> }
  private static restoreFromURL(): void
  private static syncStoreToURL(): void
}
```

**Phase 2: Store Integration (1-2 hours)**

Update `multiplayerStore.ts` to call `Router.navigate()`:
```typescript
setScreen: (screen: Screen) => {
  update(state => {
    Router.navigate(screen, screen === 'game' ? { id: state.gameId } : undefined);
    return { ...state, screen };
  });
}
```

**Phase 3: Page Load Restoration (1 hour)**

Initialize router in `multiplayerMain.ts`:
```typescript
Router.init(); // Restores state from URL on page load
```

**Phase 4: Testing (2 hours)**
- Test all navigation flows
- Test browser back/forward
- Test deep linking
- Test URL sharing

**Total Effort: 6-9 hours (~1 day)**

---

## Alternative: If You Want Maximum Features

If future requirements emerge (SSR, complex routing, better SEO), **reconsider SvelteKit**. But for current needs:

**Start with History API → Migrate to SvelteKit later if needed**

The History API solution is:
- ✅ Non-invasive (easy to replace later)
- ✅ Quick to implement
- ✅ Solves immediate problem
- ✅ Doesn't prevent future migration

---

## URL Structure Specification

### Proposed Routes

```
Base: /quortextt/

/quortextt/                     → Login screen (default)
/quortextt/lobby                → Lobby (room list)
/quortextt/room?id=<roomId>     → Room (pre-game setup)
/quortextt/game?id=<gameId>     → Active game
/quortextt/profile              → User profile
/quortextt/tabletop             → Local tabletop mode (existing)
/quortextt/discord/             → Discord Activity mode (existing)
```

### Route Parameters

**Query Parameters:**
- `id` - Game ID or Room ID (required for game/room routes)
- `spectate` - Optional flag for spectator mode (e.g., `?id=xyz&spectate=true`)

**State Restoration:**
- On page load, parse URL and restore appropriate screen
- If game/room ID is invalid or expired, redirect to lobby
- Preserve auth state separately (via localStorage/cookies)

---

## Migration Path (If Choosing SvelteKit Later)

If we start with History API and later want SvelteKit:

1. **Create parallel SvelteKit app** in new directory
2. **Move Svelte components** to SvelteKit routes structure
3. **Keep game logic unchanged** (Redux, canvas, input handlers)
4. **Test thoroughly** with both versions running
5. **Switch deployment** when confident

This approach allows **incremental migration** with **zero downtime**.

---

## Open Questions

1. **Auth State on Refresh**: How should authentication persist across page loads?
   - Current: Likely localStorage or cookies
   - Impact: Router should redirect to login if no valid session

2. **Socket Reconnection**: When deep linking to a game, how to handle Socket.IO reconnection?
   - Need to ensure `gameCoordinator` properly initializes from URL state

3. **Invalid Game IDs**: What to show if user visits `/game?id=invalid`?
   - Proposal: Redirect to lobby with error message

4. **Discord Activity**: Should Discord mode use routing or stay separate?
   - Recommendation: Keep separate (different context, embedded)

---

## Conclusion

For implementing distinct routes like `/quortextt/game?id=<gameid>`, the **vanilla Browser History API** approach offers the best balance of:
- ✅ Simplicity
- ✅ Low effort (1 day)
- ✅ Minimal risk
- ✅ Compatibility with existing architecture
- ✅ Easy to replace later if needs grow

**Next Steps:**
1. Review and approve this design
2. Create implementation task
3. Build router.ts with tests
4. Integrate with multiplayerStore
5. Test thoroughly
6. Deploy and validate

**Alternative:** If team prefers "official" solution and has time, **svelte-spa-router** is solid second choice (adds 1-2 days).
