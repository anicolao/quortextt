# Production Deployment Guide

This guide covers deploying Quortex to production with the new serving strategy where:
- **`/`** serves the multiplayer experience (default)
- **`/tabletop`** serves the single-player tabletop experience
- **API server** runs separately for multiplayer functionality

## Quick Start - GitHub Pages (Recommended)

The simplest way to deploy is using GitHub Pages with the existing configuration:

### 1. Build the Application

```bash
npm run build
```

This creates:
- `dist/index.html` - Multiplayer experience (served at `/`)
- `dist/tabletop.html` - Tabletop experience (served at `/tabletop`)
- `dist/assets/` - Bundled JavaScript and CSS

### 2. Deploy to GitHub Pages

The repository is already configured for automatic deployment:

1. Push to the `main` branch:
   ```bash
   git push origin main
   ```

2. GitHub Actions automatically:
   - Runs tests
   - Builds the application
   - Deploys to GitHub Pages

3. Access your site at: `https://anicolao.github.io/quortextt/`

### 3. Verify Deployment

Test both endpoints:
- Multiplayer: `https://anicolao.github.io/quortextt/`
- Tabletop: `https://anicolao.github.io/quortextt/tabletop.html`

## Production Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Production Setup                      │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────────┐         ┌──────────────────┐     │
│  │  GitHub Pages    │         │  Backend Server  │     │
│  │  (Static Files)  │         │  (Optional)      │     │
│  ├──────────────────┤         ├──────────────────┤     │
│  │ / → Multiplayer  │◄────────┤ Socket.IO        │     │
│  │ /tabletop →      │  WSS    │ Express API      │     │
│  │   Tabletop       │         │ Auth (OAuth)     │     │
│  └──────────────────┘         └──────────────────┘     │
│         │                              │                │
│         │ HTTPS                        │ HTTPS          │
│         ▼                              ▼                │
│  ┌──────────────────────────────────────────────┐      │
│  │              End Users                        │      │
│  └──────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────┘
```

## Deploying the Multiplayer Server (Optional)

The multiplayer server is only needed for online multiplayer games. For single-player tabletop mode, it's not required.

### Option 1: Render.com (Free Tier)

1. Create account at [render.com](https://render.com)

2. Create a new Web Service:
   - **Build Command**: `cd server && npm install && npm run build`
   - **Start Command**: `cd server && npm start`
   - **Environment Variables**:
     ```
     NODE_ENV=production
     PORT=3001
     CLIENT_URL=https://anicolao.github.io
     JWT_SECRET=<generate-random-secret>
     DISCORD_CLIENT_ID=<your-discord-app-id>
     DISCORD_CLIENT_SECRET=<your-discord-app-secret>
     DISCORD_CALLBACK_URL=https://your-app.onrender.com/auth/discord/callback
     ```

3. Deploy and note the server URL

4. Update client environment to point to production server

### Option 2: Railway.app (Free Tier)

1. Connect GitHub repository to Railway

2. Configure service:
   - **Root Directory**: `server`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`

3. Add environment variables (same as Render.com)

### Option 3: DigitalOcean App Platform

1. Create a new App from GitHub

2. Configure:
   - **Build Command**: `cd server && npm install && npm run build`
   - **Run Command**: `cd server && npm start`
   - **Environment Variables**: (same as above)

3. Deploy

## Environment Variables

### Required for Production

```bash
# Server Configuration
NODE_ENV=production
PORT=3001

# CORS Configuration
CLIENT_URL=https://anicolao.github.io

# Security
JWT_SECRET=<use-strong-random-secret>  # Generate with: openssl rand -base64 32

# OAuth Configuration (Discord)
DISCORD_CLIENT_ID=<your-discord-client-id>
DISCORD_CLIENT_SECRET=<your-discord-client-secret>
DISCORD_CALLBACK_URL=https://your-server.com/auth/discord/callback

# Optional: Google OAuth
GOOGLE_CLIENT_ID=<your-google-client-id>
GOOGLE_CLIENT_SECRET=<your-google-client-secret>
GOOGLE_CALLBACK_URL=https://your-server.com/auth/google/callback

# Data Storage (optional, defaults to local filesystem)
DATA_DIR=/app/data
```

### Generating Secrets

```bash
# Generate JWT secret
openssl rand -base64 32

# Or use Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## OAuth Setup for Production

### Discord OAuth

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. Add OAuth2 redirect URL: `https://your-server.com/auth/discord/callback`
4. Copy Client ID and Client Secret to environment variables

### Google OAuth (Optional)

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project
3. Enable Google+ API
4. Create OAuth credentials
5. Add authorized redirect URI: `https://your-server.com/auth/google/callback`
6. Copy Client ID and Client Secret to environment variables

See [docs/dev/OAUTH_SETUP.md](docs/dev/OAUTH_SETUP.md) for detailed instructions.

## Deployment Checklist

### Pre-Deployment

- [ ] All tests passing: `npm test`
- [ ] Build succeeds: `npm run build`
- [ ] Environment variables configured
- [ ] OAuth applications created and configured
- [ ] Server tested locally with production settings

### GitHub Pages Deployment

- [ ] Code merged to `main` branch
- [ ] GitHub Actions workflow completes successfully
- [ ] Site accessible at production URL
- [ ] Multiplayer route works: `/`
- [ ] Tabletop route works: `/tabletop`
- [ ] Assets loading correctly

### Server Deployment (if using multiplayer)

- [ ] Server environment variables set
- [ ] Server builds successfully
- [ ] Server starts without errors
- [ ] Health check endpoint responds: `/health`
- [ ] OAuth flow works end-to-end
- [ ] WebSocket connections successful
- [ ] CORS configured correctly for client URL

## Monitoring and Maintenance

### Health Checks

Test the server health endpoint:
```bash
curl https://your-server.com/health
```

Expected response:
```json
{
  "status": "ok",
  "games": 0,
  "players": 0,
  "storage": "file-based"
}
```

### Logs

Monitor server logs for errors:
- Render.com: View in dashboard
- Railway: `railway logs`
- DigitalOcean: View in App Platform console

### Common Issues

**Issue: CORS errors in browser**
- Check `CLIENT_URL` environment variable matches your GitHub Pages URL
- Verify server is running and accessible

**Issue: OAuth redirect fails**
- Verify callback URL in Discord/Google app matches server URL
- Check environment variables are set correctly

**Issue: WebSocket connection fails**
- Check firewall allows WebSocket connections
- Verify server supports WebSocket protocol
- Check browser console for connection errors

## Rollback Procedure

If deployment fails:

### GitHub Pages
1. Revert the commit: `git revert HEAD`
2. Push to main: `git push origin main`
3. Wait for automatic redeployment

### Server
1. Revert to previous deployment in hosting platform dashboard
2. Or redeploy previous commit manually

## Performance Optimization

### Client (GitHub Pages)

Already optimized:
- ✅ Minified bundles
- ✅ Gzip compression (via CDN)
- ✅ Asset hashing for cache busting
- ✅ Lazy loading animations

### Server

Optimize for production:
1. Enable compression:
   ```javascript
   import compression from 'compression';
   app.use(compression());
   ```

2. Set up rate limiting (already configured)

3. Configure connection pooling for database (if using)

4. Enable production logging

## Scaling Considerations

### Current Setup (Sufficient for <1000 concurrent users)
- Static files: GitHub Pages CDN
- Server: Single instance on free tier

### Future Scaling (1000+ concurrent users)
- Add Redis for session storage
- Add PostgreSQL for persistent data
- Use managed WebSocket service (e.g., Pusher, Ably)
- Deploy server to multiple regions
- Add load balancer

## Cost Estimate

**Current Setup: $0/month**
- GitHub Pages: Free for public repos
- Server: Free tier (Render.com, Railway, or similar)

**Scaling Up:**
- GitHub Pages: Still free
- Server: $7-20/month (paid tier with more resources)
- Database: $0-15/month (if needed)
- Redis: $0-10/month (if needed)

**Total for moderate traffic: $7-45/month**

## Security Best Practices

- ✅ Use HTTPS everywhere (automatic with GitHub Pages and hosting platforms)
- ✅ Generate strong JWT secret
- ✅ Never commit secrets to repository
- ✅ Use environment variables for all sensitive configuration
- ✅ Enable rate limiting on API endpoints
- ✅ Validate and sanitize all user inputs
- ✅ Keep dependencies updated (`npm audit`)
- ✅ Enable CORS only for your domain

## Support and Troubleshooting

For issues:
1. Check GitHub Actions logs
2. Check server logs in hosting platform
3. Review browser console for client-side errors
4. Test health endpoints
5. Verify environment variables
6. Check OAuth configuration

---

Last Updated: 2025-11-14
