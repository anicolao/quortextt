# Discord Activity Setup Guide

This guide explains how to set up and test the Quortex Discord Activity integration.

## Overview

The Discord Activity allows players to play Quortex directly within Discord using an embedded web application. This implementation reuses the existing multiplayer infrastructure with Discord SDK integration for authentication.

**⚠️ Important**: Discord Activities require a **publicly accessible URL**. You cannot use `localhost` directly. For local development, you'll need to use a tunnel service like Cloudflare Tunnel or ngrok (setup instructions below).

## Prerequisites

- Node.js v18 or later
- Discord Application created at [Discord Developer Portal](https://discord.com/developers/applications)
- A Discord server for testing
- **Cloudflare Tunnel** or **ngrok** for local development (free)

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
   - **URL Mappings**: You'll add this after setting up your tunnel (see Testing section below)
   - ⚠️ **Do NOT use** `http://localhost:5173` - Discord cannot access localhost URLs
   - For development: Use tunnel URL like `https://random-name.trycloudflare.com/discord/`
   - For production: `https://your-domain.com/quortextt/discord/`

### 3. Get OAuth2 Credentials

1. Go to **OAuth2** section in your application settings
2. Copy your **Client ID**
3. Copy your **Client Secret**
4. **For Discord Activity**: No redirect URIs needed (uses client-side auth)
5. **For regular web multiplayer** (optional): Add redirect URIs:
   - Development: `http://localhost:3001/auth/discord/callback`
   - Production: `https://your-server.com/auth/discord/callback`

### 4. Configure OAuth2 Scopes

The Discord Activity requires the following scopes:
- `identify` - Get Discord user info
- `guilds` - Verify server membership (optional, for server-specific games)

## Authentication Architecture

This project supports **two different authentication methods** for different use cases:

### Discord Activity Authentication (Client-Side)
- **Used by**: Discord Activity embedded app (`/discord/`)
- **Flow**: 
  1. Client calls Discord SDK's `authorize()` to get code
  2. Client sends code to backend via `/.proxy/api/token`
  3. Backend exchanges code for access token
  4. Client receives access token and calls SDK's `authenticate()`
- **Benefits**: Works within Discord's iframe, no redirects needed
- **Backend endpoint**: `/api/token`

### Regular Web Multiplayer Authentication (OAuth Redirect)
- **Used by**: Regular web multiplayer (`/multiplayer.html`)
- **Flow**: Traditional OAuth2 redirect flow
- **Benefits**: Works for standalone web apps outside Discord
- **Backend endpoints**: `/auth/discord`, `/auth/discord/callback`, `/auth/google`, `/auth/google/callback`

Both flows use the same Discord Client ID and Secret, but Discord Activities use the SDK's client-side method while regular web uses OAuth redirects.

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
- Discord Activity at: `http://localhost:5173/discord/`
- Server will be available at: `http://localhost:3001`

## Testing the Discord Activity

### Important: Public URL Required for Discord Activities

**Discord Activities cannot load from `localhost` directly.** You must use a tunnel service to expose your local dev server to the internet.

### Setup Public Tunnel (Required for Testing)

**Option A: Cloudflare Tunnel (Free, Recommended)**
```bash
# Install cloudflared (one time)
brew install cloudflare/cloudflare/cloudflared  # macOS
# or download from https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/

# Start tunnel (each dev session)
cloudflared tunnel --url http://localhost:5173
```

This outputs a URL like: `https://random-name.trycloudflare.com`

**Option B: ngrok (Alternative)**
```bash
# Install ngrok (one time)
# Download from https://ngrok.com/download

# Start tunnel (each dev session)
ngrok http 5173
```

This outputs a URL like: `https://abc123.ngrok.io`

### Configure Discord Developer Portal

1. Go to your application in the Discord Developer Portal
2. Navigate to **Activities** → **URL Mappings**
3. Add a mapping:
   - **Root Mapping**: `/` → `https://your-tunnel-url.com/discord/`
   - Example: `https://random-name.trycloudflare.com/discord/`
4. **Save** the mapping

**Note**: Cloudflare/ngrok URLs change each session, so update the mapping each time you restart the tunnel.

### Launch the Activity

1. Use the **Test Mode** in Discord Developer Portal to launch the activity
2. The activity will load in an iframe within Discord
3. Check browser console (DevTools) for any errors

### Option 2: Direct Browser Testing (Limited)

While you can open `http://localhost:5173/discord/` directly in a browser, it won't have access to Discord SDK features. This is mainly useful for UI testing.

To test Discord-specific features, you must run it within Discord using the Developer Portal's test mode.

## Build for Production

### 1. Build the Application

```bash
npm run build
```

This creates optimized production files in the `dist/` directory, including:
- `dist/discord/` - Discord Activity entry point
- `dist/index.html` - Standard multiplayer entry point
- `dist/tabletop.html` - Tabletop mode entry point

### 2. Deploy to Production

The built files can be deployed to any static hosting service (GitHub Pages, Netlify, Vercel, etc.) or served from your own server.

Update your Discord Application's Activity URL to point to your production URL:
```
https://your-domain.com/quortextt/discord/
```

## Architecture Overview

### Files Added/Modified

**New Files:**
- `discord/` - Entry point HTML for Discord Activity
- `src/discordMain.ts` - Main TypeScript entry point for Discord mode
- `src/discord/discordClient.ts` - Discord SDK integration and authentication
- `src/vite-env.d.ts` - TypeScript environment variable definitions
- `docs/dev/DISCORD_ACTIVITY_SETUP.md` - This file

**Modified Files:**
- `vite.config.ts` - Added discord/ to build inputs
- `.env.example` - Added VITE_DISCORD_CLIENT_ID configuration
- `src/multiplayer/stores/multiplayerStore.ts` - Added userId field and helper methods
- `package.json` - Added @discord/embedded-app-sdk dependency
- `server/src/routes/auth.ts` - Added `/api/token` endpoint for Discord Activity auth
- `server/src/index.ts` - Mounted API routes for Discord Activity compatibility

### How It Works

1. **Discord Launch**: User clicks "Play Quortex" in Discord Activity shelf
2. **SDK Initialization**: Discord SDK initializes in the embedded iframe
3. **Client-Side Authentication**: App uses Discord's recommended 3-step flow:
   - Step 1: SDK calls `authorize()` to get authorization code
   - Step 2: App exchanges code for access token via `/.proxy/api/token` endpoint
   - Step 3: SDK calls `authenticate()` with access token to complete auth
4. **Multiplayer Setup**: User info is stored and WebSocket connection established
5. **Game Launch**: User joins/creates a game room using existing multiplayer UI
6. **Gameplay**: Full game runs using existing canvas renderer and game logic

**Note**: Discord Activities use a special `/.proxy` path that Discord automatically routes to your backend server. This is how the client can securely exchange the authorization code for an access token without exposing client secrets.

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

### "Refused to Connect" Error (Most Common Issue)

**Problem**: Discord Activity shows error like `1438532244628050002.discordsays.com refused to connect.`

**Root Cause**: Discord Activities uses a proxy system (`*.discordsays.com`) to load your application. For local development, Discord cannot reach your `localhost:5173` directly because it's not publicly accessible.

**Solution - Use Cloudflare Tunnel (Recommended)**:

1. **Install Cloudflare Tunnel** (cloudflared):
   ```bash
   # macOS
   brew install cloudflare/cloudflare/cloudflared
   
   # Windows (via Chocolatey)
   choco install cloudflared
   
   # Linux
   wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
   sudo dpkg -i cloudflared-linux-amd64.deb
   ```

2. **Start your local dev server**:
   ```bash
   npm run dev
   ```

3. **Create a tunnel to your localhost**:
   ```bash
   cloudflared tunnel --url http://localhost:5173
   ```
   
   This will output a public URL like: `https://random-name.trycloudflare.com`

4. **Update Discord Developer Portal**:
   - Go to your Discord Application
   - Navigate to **Activities** → **URL Mappings**
   - Set the root mapping to: `https://random-name.trycloudflare.com/discord/`
   - **Important**: The URL changes each time you run cloudflared, so update it each session

5. **Test the Activity** in Discord - it should now load successfully!

**Alternative Solutions**:

- **ngrok**: Similar to Cloudflare Tunnel
  ```bash
  ngrok http 5173
  # Use the https URL provided
  ```

- **Production Deployment**: Deploy to a public hosting service (Vercel, Netlify, GitHub Pages) and use that URL

**Why This Happens**:
Discord's Activity proxy cannot access `localhost` URLs. The `*.discordsays.com` domain is Discord's CDN/proxy that loads your activity in an iframe, but it needs a publicly accessible URL to proxy.

### Production Server "Refused to Connect" Error

**Problem**: Getting "refused to connect" error on production server (e.g., `quortex.morpheum.dev/quortextt/discord/`)

**Common Causes & Solutions**:

**1. CORS Headers Not Configured**
   
Discord's proxy (`*.discordsays.com`) needs your server to allow cross-origin requests.

**Fix**: Add these headers to your server configuration:

```nginx
# Nginx configuration
location /quortextt/ {
    add_header Access-Control-Allow-Origin "*";
    add_header Access-Control-Allow-Methods "GET, POST, OPTIONS";
    add_header Access-Control-Allow-Headers "Content-Type, Authorization";
}
```

Or for Apache:
```apache
<Directory /path/to/quortextt>
    Header set Access-Control-Allow-Origin "*"
    Header set Access-Control-Allow-Methods "GET, POST, OPTIONS"
</Directory>
```

**2. HTTPS/SSL Certificate Issues**

Discord Activities require valid HTTPS. Check:
- Certificate is valid and not expired
- No mixed content warnings
- Test URL directly in browser: `https://quortex.morpheum.dev/quortextt/discord/`

**3. Content-Security-Policy (CSP) Headers**

If your server has CSP headers, they might block Discord's iframe.

**Fix**: Update CSP to allow Discord's iframe:
```
Content-Security-Policy: frame-ancestors https://*.discord.com https://*.discordsays.com https://discord.com;
```

**4. Server Not Serving Files Correctly**

Verify the files are accessible:
```bash
# Test if files are served correctly
curl -I https://quortex.morpheum.dev/quortextt/discord/

# Should return 200 OK with text/html content-type
# Should NOT return 404 or redirect
```

**5. Base Path Configuration Issue**

If using a subdirectory (`/quortextt/`), ensure your web server is configured to serve static files correctly:

```nginx
# Nginx - serve static files from /quortextt/ path
location /quortextt/ {
    alias /var/www/quortex/dist/;
    try_files $uri $uri/ /quortextt/discord/;
    
    # Enable CORS for Discord Activities
    add_header Access-Control-Allow-Origin "*";
}
```

**6. Discord URL Mapping Configuration**

In Discord Developer Portal, ensure URL mapping is correct:
- **Incorrect**: `quortex.morpheum.dev/quortextt/discord/` (missing protocol)
- **Correct**: `https://quortex.morpheum.dev/quortextt/discord/`

**Debugging Steps**:

1. **Test the URL directly in browser**:
   - Open: `https://quortex.morpheum.dev/quortextt/discord/`
   - Should load the page (may show Discord SDK error, but page should render)
   - Check browser console (F12) for errors

2. **Check Network Tab**:
   - Open DevTools → Network tab
   - Reload the page
   - Look for failed requests (red)
   - Check if JS/CSS assets load correctly

3. **Verify CORS**:
   ```bash
   curl -I -X OPTIONS https://quortex.morpheum.dev/quortextt/discord/ \
     -H "Origin: https://discord.com" \
     -H "Access-Control-Request-Method: GET"
   
   # Should include: Access-Control-Allow-Origin header
   ```

4. **Check Discord Developer Console**:
   - In Discord, open DevTools (Ctrl+Shift+I)
   - Try launching the activity
   - Check Console and Network tabs for errors

**Common Error Messages**:

- **"Mixed Content"**: Your server has HTTP resources on an HTTPS page - fix all URLs to use HTTPS
- **"Blocked by CORS policy"**: Add CORS headers (see solution #1)
- **"Failed to load resource"**: Check if static files (JS/CSS) are accessible
- **"X-Frame-Options denied"**: Remove or update X-Frame-Options header to allow Discord

### Activity Won't Load

**Problem**: Discord shows blank screen or loading error (after tunnel is set up)

**Solutions**:
1. Check Discord Developer Portal URL mapping is correct
2. Verify VITE_DISCORD_CLIENT_ID is set in `.env`
3. Check browser console for errors
4. Ensure development server is running on correct port
5. Verify your tunnel (cloudflared/ngrok) is still running

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
