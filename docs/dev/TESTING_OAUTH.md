# Testing OAuth Authentication

This guide walks through testing the Discord OAuth authentication implementation.

## Prerequisites

1. **Discord Application Setup**
   - Follow the setup instructions in [OAUTH_SETUP.md](./OAUTH_SETUP.md) to create a Discord application
   - Configure the OAuth redirect URL: `http://localhost:3001/auth/discord/callback`
   - Get your Client ID and Client Secret

2. **Environment Configuration**
   - Create a `.env` file in the project root (copy from `.env.example`)
   - Add your Discord credentials:
     ```
     DISCORD_CLIENT_ID=your-client-id-here
     DISCORD_CLIENT_SECRET=your-client-secret-here
     JWT_SECRET=a-random-secret-key-for-development
     ```

## Manual Testing

### 1. Start the Server

```bash
# From the project root
npm run dev:server
```

The server should start on `http://localhost:3001` and display:
```
✓ Discord OAuth strategy configured
🎮 Quortex multiplayer server running on port 3001
   Client URL: http://localhost:5173
```

If you see a warning about Discord credentials, check your `.env` file.

### 2. Test with the OAuth Test Page

Open the test page in your browser:
```bash
# Option 1: Use a simple HTTP server
npx http-server . -p 8080 -o auth-test.html

# Option 2: Open directly in browser
open auth-test.html  # macOS
xdg-open auth-test.html  # Linux
start auth-test.html  # Windows
```

**Note:** The test page needs to be served over HTTP (not file://) for proper OAuth redirect handling.

### 3. Test the Flow

On the test page:

1. **Check Server Status**
   - Click "Check Server"
   - Should show: "Server is running! ✓"

2. **Login with Discord**
   - Click "Login with Discord"
   - You'll be redirected to Discord
   - Authorize the application
   - You'll be redirected back with a token

3. **View User Info**
   - After login, user info should appear automatically
   - Click "Get User Info" to refresh
   - Should display your Discord username, avatar, and stats

4. **Test Token Persistence**
   - Refresh the page
   - Your login should persist (token stored in localStorage)

### 4. Test with cURL

Test the API endpoints directly:

```bash
# 1. Initiate OAuth (will redirect to Discord in browser)
curl http://localhost:3001/auth/discord

# 2. After getting a token from the OAuth flow, test /auth/me
curl -H "Authorization: Bearer YOUR_TOKEN_HERE" http://localhost:3001/auth/me

# 3. Test updating settings
curl -X PUT \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{"settings":{"soundEnabled":false}}' \
  http://localhost:3001/auth/me/settings

# 4. Test logout
curl -X POST http://localhost:3001/auth/logout
```

### 5. Test Socket.IO Authentication

Test WebSocket connection with authentication:

```javascript
// In browser console or Node.js
import { io } from 'socket.io-client';

// With authentication
const socket = io('http://localhost:3001', {
  auth: {
    token: 'YOUR_JWT_TOKEN'
  }
});

socket.on('connect', () => {
  console.log('Connected with auth:', socket.id);
  
  // Identify player
  socket.emit('identify', { username: 'TestPlayer' });
});

socket.on('identified', (data) => {
  console.log('Identified:', data);
  // data.authenticated should be true
});
```

## Expected Results

### Successful Authentication

After logging in, you should receive:
- A JWT token (valid for 7 days)
- User profile with:
  - Discord ID
  - Display name
  - Avatar URL
  - Provider: 'discord'
  - Stats (all zeros for new users)
  - Settings (defaults)

### Error Cases to Test

1. **Invalid Token**
   ```bash
   curl -H "Authorization: Bearer invalid_token" http://localhost:3001/auth/me
   # Expected: {"error":"Invalid or expired token"}
   ```

2. **Missing Token**
   ```bash
   curl http://localhost:3001/auth/me
   # Expected: {"error":"No token provided"}
   ```

3. **Expired Token**
   - Wait 7 days or manually expire the token
   # Expected: {"error":"Invalid or expired token"}

## Troubleshooting

### "Discord OAuth credentials not configured"

**Problem:** Server shows this warning on startup

**Solution:** 
1. Check that `.env` file exists in project root
2. Verify `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET` are set
3. Restart the server

### "Redirect URI mismatch"

**Problem:** Discord shows "Invalid Redirect URI" error

**Solution:**
1. Go to Discord Developer Portal
2. Check OAuth2 → Redirects section
3. Make sure `http://localhost:3001/auth/discord/callback` is listed exactly
4. Save changes

### "Authentication failed"

**Problem:** Redirected to client with `?error=auth_failed`

**Solution:**
1. Check server logs for errors
2. Verify Discord application is active
3. Try re-authorizing the application

### Token Not Working

**Problem:** `/auth/me` returns 403 or 401

**Solution:**
1. Check token format: should be `Bearer <token>` in Authorization header
2. Verify token hasn't expired
3. Check JWT_SECRET matches between token generation and validation
4. Try logging in again to get a fresh token

## Security Notes for Testing

- **JWT_SECRET**: Use a strong random value in production
- **HTTPS**: Always use HTTPS in production
- **Token Storage**: The test page uses localStorage - consider httpOnly cookies for production
- **CORS**: Test page must be on same domain or properly configured in CORS settings

## Integration with Multiplayer

Once authentication is working, integrate with the multiplayer client:

1. Add login button to multiplayer UI
2. Store JWT token after successful authentication
3. Pass token when connecting to Socket.IO
4. Include token in Authorization header for API requests
5. Handle token expiration and re-authentication

## Next Steps

After OAuth is working:
- Add additional OAuth providers (Facebook, Google, Apple)
- Implement database persistence (MongoDB)
- Add token refresh mechanism
- Implement proper session management
- Add rate limiting for auth endpoints
