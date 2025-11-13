# OAuth Authentication Setup

This document explains how to set up Discord OAuth authentication for the Quortex multiplayer server.

## Overview

The multiplayer server uses Discord OAuth 2.0 for user authentication. This provides a simple, secure way for users to log in without creating separate accounts.

## Discord OAuth Setup

### 1. Create a Discord Application

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application"
3. Give your application a name (e.g., "Quortex Dev")
4. Click "Create"

### 2. Configure OAuth2

1. In your application settings, go to the "OAuth2" section
2. Click "Add Redirect" under "Redirects"
3. Add your callback URL:
   - For local development: `http://localhost:3001/auth/discord/callback`
   - For production: `https://yourdomain.com/auth/discord/callback`
4. Click "Save Changes"

### 3. Get Your Credentials

1. In the "OAuth2" section, you'll see:
   - **CLIENT ID**: Copy this value
   - **CLIENT SECRET**: Click "Reset Secret" and copy the value (keep this secure!)

### 4. Configure Environment Variables

Create a `.env` file in the root directory (copy from `.env.example`):

```bash
# Server configuration
PORT=3001
BASE_URL=http://localhost:3001
CLIENT_URL=http://localhost:5173

# Authentication
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Discord OAuth
DISCORD_CLIENT_ID=your-discord-client-id-here
DISCORD_CLIENT_SECRET=your-discord-client-secret-here

# Client configuration
VITE_SERVER_URL=http://localhost:3001
```

**Important:** 
- Never commit `.env` files to version control
- Use a strong, random JWT_SECRET in production
- Keep your CLIENT_SECRET secure

## OAuth Flow

The authentication flow works as follows:

1. User clicks "Continue with Discord" on the multiplayer login screen
2. Client redirects to `/auth/discord?returnTo={currentUrl}` with the current page URL
3. Server encodes the returnTo URL in the OAuth state parameter
4. Server redirects to Discord's OAuth page
5. User authorizes the application on Discord
6. Discord redirects back to `/auth/discord/callback` with the state parameter
7. Server exchanges code for user info
8. Server creates/updates user in database
9. Server generates JWT token
10. Server redirects back to the original page (from state) with token in URL
11. Client stores token and uses it for API requests

**Note:** The redirect is dynamic and returns to wherever authentication was initiated, making it work seamlessly with different base paths (e.g., `/quortextt/multiplayer.html`).

## API Endpoints

### Authentication Endpoints

- `GET /auth/discord` - Initiate Discord OAuth flow
- `GET /auth/discord/callback` - Discord OAuth callback
- `GET /auth/me` - Get current authenticated user (requires JWT)
- `PUT /auth/me/settings` - Update user settings (requires JWT)
- `POST /auth/logout` - Logout (client should delete token)

### Using JWT Tokens

Include the JWT token in the Authorization header for protected routes:

```
Authorization: Bearer <your-jwt-token>
```

Example with fetch:

```javascript
fetch('http://localhost:3001/auth/me', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
})
```

### Socket.IO Authentication

Pass the JWT token when connecting to Socket.IO:

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3001', {
  auth: {
    token: yourJwtToken
  }
});
```

## Testing the OAuth Flow

### 1. Start the Server

```bash
npm run dev:server
```

### 2. Test Authentication

1. Navigate to `http://localhost:3001/auth/discord`
2. You should be redirected to Discord
3. Authorize the application
4. You'll be redirected back to the client with a token in the URL

### 3. Test Protected Routes

```bash
# Get your user info
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3001/auth/me
```

## Security Considerations

1. **HTTPS in Production**: Always use HTTPS in production to protect tokens
2. **Token Storage**: Store JWT tokens securely on the client (consider httpOnly cookies)
3. **Token Expiration**: Tokens expire after 7 days by default
4. **Environment Variables**: Never commit sensitive credentials
5. **CORS**: Configure CORS properly to allow only trusted origins

## Troubleshooting

### "Discord OAuth credentials not configured"

Make sure you've set `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET` in your `.env` file.

### "Redirect URI mismatch"

The callback URL in your Discord application settings must exactly match `BASE_URL/auth/discord/callback`.

### "Invalid token"

The JWT token may have expired or been tampered with. Users need to log in again.

## Future Enhancements

According to the web multiplayer design document, additional OAuth providers can be added:
- Facebook OAuth
- Google Sign-In  
- Apple Sign In

Each provider follows a similar pattern to the Discord implementation.
