# OAuth Authentication Setup

This document explains how to set up OAuth authentication for the Quortex multiplayer server.

## Overview

The multiplayer server supports multiple OAuth 2.0 providers for user authentication. This provides a simple, secure way for users to log in without creating separate accounts.

**Supported Providers:**
- Discord OAuth
- Google OAuth
- Facebook OAuth

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

Add your Discord credentials to the `.env` file (see section below for complete example).

## Google OAuth Setup

### 1. Create a Google Cloud Project

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Give your project a name (e.g., "Quortex")

### 2. Enable Google+ API

1. In your project, go to "APIs & Services" > "Library"
2. Search for "Google+ API"
3. Click "Enable"

### 3. Create OAuth 2.0 Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth 2.0 Client IDs"
3. If prompted, configure the OAuth consent screen:
   - Choose "External" user type
   - Fill in the required fields (app name, user support email, developer contact)
   - Add scopes: `profile` and `email`
   - Add test users if needed during development
4. For Application type, select "Web application"
5. Give it a name (e.g., "Quortex Web Client")
6. Add Authorized redirect URIs:
   - For local development: `http://localhost:3001/auth/google/callback`
   - For production: `https://yourdomain.com/auth/google/callback`
7. Click "Create"

### 4. Get Your Credentials

1. After creation, you'll see:
   - **Client ID**: Copy this value
   - **Client Secret**: Copy this value (keep this secure!)
2. You can view these again in "APIs & Services" > "Credentials"

### 5. Configure Environment Variables

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

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id-here
GOOGLE_CLIENT_SECRET=your-google-client-secret-here

# Facebook OAuth
FACEBOOK_APP_ID=your-facebook-app-id-here
FACEBOOK_APP_SECRET=your-facebook-app-secret-here

# Client configuration
VITE_SERVER_URL=http://localhost:3001
```

**Important:** 
- Never commit `.env` files to version control
- Use a strong, random JWT_SECRET in production
- Keep your CLIENT_SECRET secure

## Facebook OAuth Setup

### 1. Create a Facebook App

1. Go to the [Facebook Developers Portal](https://developers.facebook.com/apps/)
2. Click "Create App"
3. Select "Consumer" as the app type (for user authentication)
4. Click "Next"
5. Give your app a name (e.g., "Quortex")
6. Enter a contact email
7. Click "Create App"

### 2. Add Facebook Login Product

1. In your app dashboard, find "Facebook Login" in the products list
2. Click "Set Up" on the Facebook Login card
3. Select "Web" as your platform
4. Enter your site URL (e.g., `http://localhost:3001` for development)
5. Click "Save" and "Continue"

### 3. Configure OAuth Settings

1. In the left sidebar, go to "Facebook Login" > "Settings"
2. Under "Valid OAuth Redirect URIs", add:
   - For local development: `http://localhost:3001/auth/facebook/callback`
   - For production: `https://yourdomain.com/auth/facebook/callback`
3. Click "Save Changes"

### 4. Get Your Credentials

1. In the left sidebar, go to "Settings" > "Basic"
2. You'll see:
   - **App ID**: Copy this value (this is your FACEBOOK_APP_ID)
   - **App Secret**: Click "Show" and copy the value (keep this secure!)
3. Note: You may need to complete additional verification for production use

### 5. Configure App Settings

1. Still in "Settings" > "Basic":
   - Add an **App Domain** (e.g., `localhost` for development, `yourdomain.com` for production)
   - Add a **Privacy Policy URL** (required for production)
   - Add **Terms of Service URL** (optional but recommended)
2. Click "Save Changes"

### 6. Set App Mode

1. For development, your app will be in "Development" mode
2. For production, you'll need to switch to "Live" mode:
   - Complete all required app review items
   - Switch the toggle at the top of the dashboard from "Development" to "Live"

### 7. Configure Environment Variables

Add your Facebook credentials to the `.env` file (see the configuration example above).

## Environment Variables Configuration

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

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id-here
GOOGLE_CLIENT_SECRET=your-google-client-secret-here

# Facebook OAuth
FACEBOOK_APP_ID=your-facebook-app-id-here
FACEBOOK_APP_SECRET=your-facebook-app-secret-here

# Client configuration
VITE_SERVER_URL=http://localhost:3001
```

**Important:** 
- Never commit `.env` files to version control
- Use a strong, random JWT_SECRET in production
- Keep your CLIENT_SECRET secure

## OAuth Flow

The authentication flow works as follows (same for Discord, Google, and Facebook):

1. User clicks "Continue with Discord", "Continue with Google", or "Continue with Facebook" on the multiplayer login screen
2. Client redirects to `/auth/{provider}?returnTo={currentUrl}` with the current page URL
3. Server encodes the returnTo URL in the OAuth state parameter
4. Server redirects to the provider's OAuth page
5. User authorizes the application
6. Provider redirects back to `/auth/{provider}/callback` with the state parameter
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
- `GET /auth/google` - Initiate Google OAuth flow
- `GET /auth/google/callback` - Google OAuth callback
- `GET /auth/facebook` - Initiate Facebook OAuth flow
- `GET /auth/facebook/callback` - Facebook OAuth callback
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

**Discord:**
1. Navigate to `http://localhost:3001/auth/discord`
2. You should be redirected to Discord
3. Authorize the application
4. You'll be redirected back to the client with a token in the URL

**Google:**
1. Navigate to `http://localhost:3001/auth/google`
2. You should be redirected to Google
3. Select your Google account and authorize the application
4. You'll be redirected back to the client with a token in the URL

**Facebook:**
1. Navigate to `http://localhost:3001/auth/facebook`
2. You should be redirected to Facebook
3. Log in if needed and authorize the application
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

### "Google OAuth credentials not configured"

Make sure you've set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in your `.env` file.

### "Facebook OAuth credentials not configured"

Make sure you've set `FACEBOOK_APP_ID` and `FACEBOOK_APP_SECRET` in your `.env` file.

### "Redirect URI mismatch"

The callback URL in your OAuth application settings must exactly match `BASE_URL/auth/{provider}/callback`. Check Discord, Google Cloud Console, and Facebook App settings.

### "Invalid token"

The JWT token may have expired or been tampered with. Users need to log in again.

### Facebook-specific issues

**"App Not Set Up"**: Make sure you've added the Facebook Login product to your app.

**"URL Blocked"**: Ensure your redirect URI is listed in "Valid OAuth Redirect URIs" in Facebook Login Settings.

**"This app is in development mode"**: For testing, add your Facebook account as a test user in "Roles" > "Test Users" or switch the app to Live mode for public access.

## Future Enhancements

According to the web multiplayer design document, additional OAuth providers can be added:
- Apple Sign In

Each provider follows a similar pattern to the Discord, Google, and Facebook implementations.
