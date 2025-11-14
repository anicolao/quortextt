# Discord Activity Setup Guide

This guide explains how to set up and test the Quortex Discord Activity integration.

## Overview

The Discord Activity allows players to play Quortex directly within Discord using an embedded web application. This implementation reuses the existing multiplayer infrastructure with Discord SDK integration for authentication.

## Prerequisites

- Node.js v18 or later
- Discord Application created at [Discord Developer Portal](https://discord.com/developers/applications)
- A Discord server for testing

## Discord Application Setup

### 1. Create Discord Application

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application"
3. Enter a name (e.g., "Quortex")
4. Accept the Developer Terms of Service

### 2. Configure Discord Activity

1. In your application settings, navigate to the **Activities** section
2. Enable Activities for your application
3. Configure Activity settings:
   - **Activity Name**: Quortex
   - **Description**: Strategic tile-placement game for 2-6 players
   - **URL Mappings**: Add your development/production URLs
   - For development: `http://localhost:5173/discord.html`
   - For production: `https://your-domain.com/quortextt/discord.html`

### 3. Get OAuth2 Credentials

1. Go to **OAuth2** section in your application settings
2. Copy your **Client ID**
3. Copy your **Client Secret** (if needed for backend OAuth)
4. Add redirect URIs:
   - Development: `http://localhost:3001/auth/discord/callback`
   - Production: `https://your-server.com/auth/discord/callback`

### 4. Configure OAuth2 Scopes

The Discord Activity requires the following scopes:
- `identify` - Get Discord user info
- `guilds` - Verify server membership (optional, for server-specific games)

## Local Development Setup

### 1. Install Dependencies

```bash
npm install
```

This will install all required dependencies including `@discord/embedded-app-sdk`.

### 2. Configure Environment Variables

Create a `.env` file in the project root (copy from `.env.example`):

```bash
# Discord Activity Configuration
VITE_DISCORD_CLIENT_ID=your-discord-client-id

# Multiplayer Server Configuration
VITE_SERVER_URL=http://localhost:3001

# Server-side Discord OAuth (for backend)
DISCORD_CLIENT_ID=your-discord-client-id
DISCORD_CLIENT_SECRET=your-discord-client-secret
```

**Important**: The `VITE_` prefix is required for client-side environment variables in Vite.

### 3. Start Development Servers

You need to run both the client and server:

```bash
# Terminal 1: Start the Vite development server
npm run dev

# Terminal 2: Start the multiplayer server (in a separate terminal)
npm run dev:server
```

- Client will be available at: `http://localhost:5173`
- Discord Activity at: `http://localhost:5173/discord.html`
- Server will be available at: `http://localhost:3001`

## Testing the Discord Activity

### Option 1: Using Discord Developer Portal (Recommended)

1. Go to your application in the Discord Developer Portal
2. Navigate to **URL Mappings** under Activities
3. Add a mapping:
   - **Root Mapping**: `/` → `http://localhost:5173/discord.html`
4. Use the **Test Mode** to launch the activity in Discord
5. The activity will load in an iframe within Discord

### Option 2: Direct Browser Testing (Limited)

While you can open `http://localhost:5173/discord.html` directly in a browser, it won't have access to Discord SDK features. This is mainly useful for UI testing.

To test Discord-specific features, you must run it within Discord using the Developer Portal's test mode.

## Build for Production

### 1. Build the Application

```bash
npm run build
```

This creates optimized production files in the `dist/` directory, including:
- `dist/discord.html` - Discord Activity entry point
- `dist/index.html` - Standard multiplayer entry point
- `dist/tabletop.html` - Tabletop mode entry point

### 2. Deploy to Production

The built files can be deployed to any static hosting service (GitHub Pages, Netlify, Vercel, etc.) or served from your own server.

Update your Discord Application's Activity URL to point to your production URL:
```
https://your-domain.com/quortextt/discord.html
```

## Architecture Overview

### Files Added/Modified

**New Files:**
- `discord.html` - Entry point HTML for Discord Activity
- `src/discordMain.ts` - Main TypeScript entry point for Discord mode
- `src/discord/discordClient.ts` - Discord SDK integration and authentication
- `src/vite-env.d.ts` - TypeScript environment variable definitions
- `docs/dev/DISCORD_ACTIVITY_SETUP.md` - This file

**Modified Files:**
- `vite.config.ts` - Added discord.html to build inputs
- `.env.example` - Added VITE_DISCORD_CLIENT_ID configuration
- `src/multiplayer/stores/multiplayerStore.ts` - Added userId field and helper methods
- `package.json` - Added @discord/embedded-app-sdk dependency

### How It Works

1. **Discord Launch**: User clicks "Play Quortex" in Discord Activity shelf
2. **SDK Initialization**: Discord SDK initializes in the embedded iframe
3. **Authentication**: App authenticates user via Discord OAuth2
4. **Multiplayer Setup**: User info is stored and WebSocket connection established
5. **Game Launch**: User joins/creates a game room using existing multiplayer UI
6. **Gameplay**: Full game runs using existing canvas renderer and game logic

### Code Reuse

The Discord Activity implementation reuses:
- ✅ 100% of game logic (`src/game/`)
- ✅ 100% of rendering code (`src/rendering/`)
- ✅ 100% of multiplayer infrastructure (`src/multiplayer/`)
- ✅ Existing WebSocket communication
- ✅ Existing Svelte UI components

Only additions:
- Discord SDK initialization
- Discord authentication flow
- Activity-specific entry point

## Troubleshooting

### Activity Won't Load

**Problem**: Discord shows blank screen or loading error

**Solutions**:
1. Check Discord Developer Portal URL mapping is correct
2. Verify VITE_DISCORD_CLIENT_ID is set in `.env`
3. Check browser console for errors
4. Ensure development server is running on correct port

### Authentication Fails

**Problem**: "Authentication failed" error

**Solutions**:
1. Verify Discord Client ID is correct
2. Check OAuth2 scopes are configured (identify, guilds)
3. Ensure backend server is running and accessible
4. Check backend `/api/auth/discord` endpoint exists

### Cannot Connect to Game Server

**Problem**: "Connection failed" when joining game

**Solutions**:
1. Verify multiplayer server is running (`npm run dev:server`)
2. Check VITE_SERVER_URL in `.env` matches server URL
3. Check server logs for errors
4. Ensure WebSocket connection isn't blocked by firewall/proxy

### TypeScript Errors

**Problem**: Build fails with TypeScript errors

**Solutions**:
1. Run `npm install` to ensure all dependencies are installed
2. Check `src/vite-env.d.ts` exists for environment type definitions
3. Clear TypeScript cache: `rm -rf node_modules/.cache`

## Development Workflow

1. Make changes to source files
2. Vite hot-reloads changes automatically
3. Test in Discord using Developer Portal test mode
4. Check browser console for errors
5. Build for production: `npm run build`
6. Test production build locally: `npm run preview`

## Additional Resources

- [Discord Activities Documentation](https://discord.com/developers/docs/activities/overview)
- [Discord Embedded App SDK](https://github.com/discord/embedded-app-sdk)
- [Quortex Design Documentation](../designs/DISCORD_DESIGN.md)
- [Multiplayer Architecture](../designs/WEB_MULTIPLAYER.md)

## Security Considerations

- Never commit `.env` file with real credentials
- Use environment variables for all sensitive configuration
- Client ID can be public, but Client Secret must stay server-side only
- VITE_ prefix exposes variables to client - only use for non-sensitive data
- Validate all user input from Discord SDK
- Implement rate limiting on backend API endpoints

## Next Steps

After basic setup, consider:
1. Implementing server-side Discord authentication endpoint
2. Adding Discord-specific features (Rich Presence, voice integration)
3. Implementing spectator mode for Discord server members
4. Adding Discord server-specific game rooms
5. Integration with Discord roles/permissions for game access
