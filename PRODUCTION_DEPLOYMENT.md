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

### Important: WebSocket/WSS Support

**No server code changes needed for WSS!** 

The server uses HTTP (`http.createServer()`), but modern hosting platforms (Render, Railway, DigitalOcean, etc.) automatically:
1. Handle SSL/TLS termination at their reverse proxy layer
2. Provide HTTPS URLs for your service
3. Socket.IO automatically upgrades to WSS when accessed via HTTPS

**Key Requirements:**
- Deploy server to a platform with HTTPS support (all options below provide this)
- Server must be accessible on the configured port (default: 3001)
- Client must use HTTPS URL (e.g., `https://your-app.onrender.com`)
- CORS must allow your client domain

### Option 1: Render.com (Free Tier)

1. Create account at [render.com](https://render.com)

2. Create a new Web Service:
   - **Build Command**: `cd server && npm install && npm run build`
   - **Start Command**: `cd server && npm start`
   - **Environment Variables**:
     ```
     NODE_ENV=production
     PORT=10000
     CLIENT_URL=https://anicolao.github.io
     JWT_SECRET=<generate-random-secret>
     DISCORD_CLIENT_ID=<your-discord-app-id>
     DISCORD_CLIENT_SECRET=<your-discord-app-secret>
     DISCORD_CALLBACK_URL=https://your-app.onrender.com/auth/discord/callback
     ```
   
   **Note:** Render.com uses port 10000 by default. The platform handles port mapping automatically.

3. Deploy and note the server URL (e.g., `https://your-app.onrender.com`)

4. Update client: Set `VITE_SERVER_URL=https://your-app.onrender.com` and rebuild

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

### Option 4: Self-Hosted with Nginx (Custom Server)

If you're deploying on your own server behind nginx (e.g., VPS, dedicated server):

#### 1. Server Setup

Install Node.js and dependencies:
```bash
# On Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Clone and build
cd /opt
git clone https://github.com/anicolao/quortextt.git
cd quortextt/server
npm install
npm run build
```

#### 2. Configure Process Manager (PM2)

```bash
# Install PM2
sudo npm install -g pm2

# Create ecosystem file
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'quortex-server',
    script: 'dist/index.js',
    cwd: '/opt/quortextt/server',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3001,
      CLIENT_URL: 'https://quortex.morpheum.dev',
      JWT_SECRET: 'your-secret-here',
      DATA_DIR: '/var/lib/quortex/data'
    }
  }]
};
EOF

# Start the server
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # Follow instructions to enable auto-start
```

#### 3. Nginx Configuration

Create nginx config file `/etc/nginx/sites-available/quortex`:

```nginx
# Upstream configuration - points to your Node.js server
upstream quortex_backend {
    server 127.0.0.1:3001;  # Your server runs on port 3001 locally
    keepalive 64;
}

# HTTPS Server Block
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name quortex.morpheum.dev;

    # SSL Configuration (use certbot for Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/quortex.morpheum.dev/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/quortex.morpheum.dev/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    # Logs
    access_log /var/log/nginx/quortex_access.log;
    error_log /var/log/nginx/quortex_error.log;

    # Serve static files (GitHub Pages alternative)
    location /quortextt/ {
        # If hosting static files on same server
        alias /var/www/quortex/;
        try_files $uri $uri/ /quortextt/index.html;
        
        # Or proxy to GitHub Pages
        # proxy_pass https://anicolao.github.io/quortextt/;
    }

    # Proxy API requests to Node.js server
    location /api/ {
        proxy_pass http://quortex_backend;
        proxy_http_version 1.1;
        
        # Important: Preserve original headers
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        proxy_cache_bypass $http_upgrade;
    }

    # OAuth callback routes
    location /auth/ {
        proxy_pass http://quortex_backend;
        proxy_http_version 1.1;
        
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        proxy_cache_bypass $http_upgrade;
    }

    # Health check endpoint
    location /health {
        proxy_pass http://quortex_backend;
        proxy_http_version 1.1;
        
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket endpoint for Socket.IO
    # This is the CRITICAL part for WebSocket/WSS support
    location /socket.io/ {
        proxy_pass http://quortex_backend;
        proxy_http_version 1.1;
        
        # WebSocket upgrade headers - REQUIRED
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # Standard proxy headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts for long-lived connections
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
        
        # Disable buffering for WebSocket
        proxy_buffering off;
        
        # Disable caching
        proxy_cache_bypass $http_upgrade;
    }
}

# HTTP redirect to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name quortex.morpheum.dev;
    
    return 301 https://$server_name$request_uri;
}
```

#### 4. Enable and Test Nginx

```bash
# Enable the site
sudo ln -s /etc/nginx/sites-available/quortex /etc/nginx/sites-enabled/

# Test nginx configuration
sudo nginx -t

# If test passes, reload nginx
sudo systemctl reload nginx
```

#### 5. SSL Certificate (Let's Encrypt)

```bash
# Install certbot
sudo apt-get install certbot python3-certbot-nginx

# Get certificate (nginx plugin handles config automatically)
sudo certbot --nginx -d quortex.morpheum.dev

# Auto-renewal is set up automatically
# Test renewal:
sudo certbot renew --dry-run
```

**How the Reverse Proxy Works:**

1. **Client connects to:** `https://quortex.morpheum.dev` (port 443)
2. **Nginx receives:** HTTPS request on port 443
3. **Nginx terminates SSL:** Decrypts HTTPS to HTTP
4. **Nginx proxies to:** `http://127.0.0.1:3001` (your Node.js server)
5. **For WebSocket:**
   - Client: `wss://quortex.morpheum.dev/socket.io/` (secure WebSocket)
   - Nginx: Upgrades connection with `Upgrade` and `Connection` headers
   - Backend: `ws://127.0.0.1:3001/socket.io/` (local WebSocket)
6. **Nginx sends response back:** Encrypts and sends to client over HTTPS/WSS

**Key Points:**
- Your Node.js server only needs to listen on `http://localhost:3001`
- Nginx handles ALL SSL/TLS encryption
- The `Upgrade` and `Connection` headers are what make WebSocket work
- Client always uses `https://` (which Socket.io converts to `wss://`)
- Server never needs to know about SSL certificates

#### 6. NixOS Configuration

If you're using NixOS, here's the declarative configuration for nginx and the Node.js service:

**File: `/etc/nixos/configuration.nix`** (or a separate module file)

```nix
{ config, pkgs, ... }:

let
  quortexServerDir = "/opt/quortex/server";
  quortexDataDir = "/var/lib/quortex/data";
in
{
  # System packages
  environment.systemPackages = with pkgs; [
    nodejs_18
    git
  ];

  # Create data directory
  systemd.tmpfiles.rules = [
    "d ${quortexDataDir} 0750 quortex quortex -"
  ];

  # User for running the service
  users.users.quortex = {
    isSystemUser = true;
    group = "quortex";
    home = quortexServerDir;
    createHome = true;
  };

  users.groups.quortex = {};

  # Node.js server systemd service
  systemd.services.quortex-server = {
    description = "Quortex Multiplayer Server";
    after = [ "network.target" ];
    wantedBy = [ "multi-user.target" ];

    environment = {
      NODE_ENV = "production";
      PORT = "3001";
      CLIENT_URL = "https://quortex.morpheum.dev";
      JWT_SECRET = "your-secret-here-change-in-production";
      DATA_DIR = quortexDataDir;
      
      # Optional: OAuth credentials
      # DISCORD_CLIENT_ID = "your-discord-client-id";
      # DISCORD_CLIENT_SECRET = "your-discord-client-secret";
      # DISCORD_CALLBACK_URL = "https://quortex.morpheum.dev/auth/discord/callback";
    };

    serviceConfig = {
      Type = "simple";
      User = "quortex";
      Group = "quortex";
      WorkingDirectory = quortexServerDir;
      ExecStart = "${pkgs.nodejs_18}/bin/node dist/index.js";
      Restart = "always";
      RestartSec = "10s";
      
      # Security hardening
      NoNewPrivileges = true;
      PrivateTmp = true;
      ProtectSystem = "strict";
      ProtectHome = true;
      ReadWritePaths = [ quortexDataDir ];
    };

    # Script to build the project on first start
    preStart = ''
      if [ ! -d "${quortexServerDir}/dist" ]; then
        cd ${quortexServerDir}
        ${pkgs.nodejs_18}/bin/npm install
        ${pkgs.nodejs_18}/bin/npm run build
      fi
    '';
  };

  # Nginx configuration
  services.nginx = {
    enable = true;
    recommendedProxySettings = true;
    recommendedTlsSettings = true;
    recommendedOptimisation = true;
    recommendedGzipSettings = true;

    upstreams = {
      quortex_backend = {
        servers = {
          "127.0.0.1:3001" = {
            max_fails = 3;
            fail_timeout = "30s";
          };
        };
        extraConfig = ''
          keepalive 64;
        '';
      };
    };

    virtualHosts."quortex.morpheum.dev" = {
      # Enable SSL/TLS
      enableACME = true;
      forceSSL = true;
      
      # HTTP2 support
      http2 = true;

      # Security headers
      extraConfig = ''
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
      '';

      locations = {
        # Serve static files (if hosting on same server)
        "/quortextt/" = {
          alias = "/var/www/quortex/";
          tryFiles = "$uri $uri/ /quortextt/index.html";
          extraConfig = ''
            # Cache static assets
            location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
              expires 1y;
              add_header Cache-Control "public, immutable";
            }
          '';
        };

        # API endpoints
        "/api/" = {
          proxyPass = "http://quortex_backend";
          extraConfig = ''
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
          '';
        };

        # OAuth callback routes
        "/auth/" = {
          proxyPass = "http://quortex_backend";
          extraConfig = ''
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
          '';
        };

        # Health check endpoint
        "/health" = {
          proxyPass = "http://quortex_backend";
          extraConfig = ''
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
          '';
        };

        # WebSocket endpoint - CRITICAL for Socket.IO/WSS
        "/socket.io/" = {
          proxyPass = "http://quortex_backend";
          extraConfig = ''
            proxy_http_version 1.1;
            
            # WebSocket upgrade headers - REQUIRED
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            
            # Standard proxy headers
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            # Timeouts for long-lived connections
            proxy_read_timeout 86400;
            proxy_send_timeout 86400;
            
            # Disable buffering for WebSocket
            proxy_buffering off;
            proxy_cache_bypass $http_upgrade;
          '';
        };
      };
    };
  };

  # ACME (Let's Encrypt) configuration
  security.acme = {
    acceptTerms = true;
    defaults.email = "admin@morpheum.dev";
    
    # Use staging for testing, remove for production
    # defaults.server = "https://acme-staging-v02.api.letsencrypt.org/directory";
  };

  # Firewall configuration
  networking.firewall = {
    enable = true;
    allowedTCPPorts = [ 80 443 ];
  };
}
```

**NixOS-Specific Notes:**

1. **Declarative Configuration**: All nginx and service configuration is declared in Nix
2. **Automatic ACME/Let's Encrypt**: Set `enableACME = true` for automatic SSL certificates
3. **Systemd Integration**: Service automatically starts on boot and restarts on failure
4. **Security Hardening**: Built-in systemd security features (PrivateTmp, ProtectSystem, etc.)

**Deployment Steps for NixOS:**

```bash
# 1. Clone the repository
sudo mkdir -p /opt/quortex
sudo git clone https://github.com/anicolao/quortextt.git /opt/quortex
sudo chown -R quortex:quortex /opt/quortex

# 2. Update your NixOS configuration
sudo nano /etc/nixos/configuration.nix
# Add the configuration above

# 3. Rebuild NixOS (this will install packages, start services, configure nginx)
sudo nixos-rebuild switch

# 4. Check service status
systemctl status quortex-server
systemctl status nginx

# 5. View logs
journalctl -u quortex-server -f
journalctl -u nginx -f
```

**Environment Variables for NixOS:**

For sensitive values like secrets, use one of these approaches:

**Option 1: NixOps secrets (recommended for production)**
```nix
# Use NixOps or sops-nix for secret management
deployment.keys."quortex-env" = {
  text = ''
    JWT_SECRET=your-actual-secret
    DISCORD_CLIENT_SECRET=your-discord-secret
  '';
};
```

**Option 2: Environment file**
```nix
systemd.services.quortex-server = {
  # ... other config ...
  serviceConfig = {
    EnvironmentFile = "/etc/quortex/secrets.env";
  };
};
```

Then create `/etc/quortex/secrets.env`:
```bash
JWT_SECRET=your-actual-secret
DISCORD_CLIENT_ID=your-discord-client-id
DISCORD_CLIENT_SECRET=your-discord-client-secret
```

**Testing Your NixOS Setup:**

```bash
# Test health endpoint
curl https://quortex.morpheum.dev/health

# Test WebSocket (should show 101 Switching Protocols)
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" \
  https://quortex.morpheum.dev/socket.io/?EIO=4&transport=websocket

# Check SSL certificate
openssl s_client -connect quortex.morpheum.dev:443 -servername quortex.morpheum.dev
```

## Environment Variables

### Client Configuration (Build Time)

The client needs to know where the multiplayer server is located. This is configured at build time using environment variables:

```bash
# .env.production (create this file in the repository root)

# For nginx reverse proxy (port 443 externally, nginx proxies to 3001 internally):
VITE_SERVER_URL=https://quortex.morpheum.dev

# For cloud platforms (Render, Railway - they handle port mapping):
VITE_SERVER_URL=https://your-app.onrender.com

# For custom port (if nginx proxies on non-standard port):
VITE_SERVER_URL=https://quortex.morpheum.dev:8443
```

**Important:** 
- **With nginx:** Use standard HTTPS port (443), nginx forwards to your Node.js port internally
  - Client connects to: `https://quortex.morpheum.dev` (port 443)
  - Nginx proxies to: `http://localhost:3001`
  - DO NOT include `:3001` in `VITE_SERVER_URL` when using nginx
- **Without reverse proxy:** Include the port if not using standard HTTPS port
- If you don't set `VITE_SERVER_URL`, the client will auto-detect based on the current page's protocol and hostname
- For HTTPS sites, it will automatically use `https://` (which socket.io converts to `wss://` for WebSocket)

### Required for Production Server

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

**Issue: Mixed Content Error - WebSocket (ws://) blocked on HTTPS page**

Error message: `Mixed Content: The page at 'https://...' was loaded over HTTPS, but attempted to connect to the insecure WebSocket endpoint 'ws://...'`

**Solution:**
1. Ensure `VITE_SERVER_URL` is set to use `https://` (not `http://`):
   ```bash
   # .env.production
   VITE_SERVER_URL=https://your-server.com
   ```

2. If `VITE_SERVER_URL` is not set, the client auto-detects based on the page protocol:
   - HTTPS page → uses `https://` (which Socket.io converts to `wss://`)
   - HTTP page → uses `http://` (which Socket.io converts to `ws://`)

3. Rebuild the client after changing environment variables:
   ```bash
   npm run build
   ```

4. Verify your server is accessible over HTTPS and supports WebSocket connections

**Issue: WebSocket still won't connect with wss://***

If you're still having connection issues after fixing the mixed content error:

**Diagnosis Steps:**

1. **Test the server health endpoint:**
   ```bash
   curl https://your-server.com/health
   # Should return: {"status":"ok","games":0,"players":0,"storage":"file-based"}
   ```

2. **Check browser console for specific error:**
   - Open browser DevTools (F12) → Console tab
   - Look for connection errors
   - Common issues:
     - `ERR_CONNECTION_REFUSED` → Server not running or wrong URL
     - `ERR_CONNECTION_TIMED_OUT` → Firewall blocking port or server not accessible
     - `403 Forbidden` → CORS misconfiguration
     - `404 Not Found` → Wrong server URL

3. **Verify VITE_SERVER_URL is correct:**
   - Should be `https://your-server.com` (without port number for Render/Railway/etc.)
   - Should NOT include `:3001` unless you're using a custom port configuration
   - Check the built files: `cat dist/assets/main-*.js | grep -o 'https://[^"]*'`

4. **Check server CORS configuration:**
   - Server's `CLIENT_URL` environment variable must match your client's domain
   - For `https://quortex.morpheum.dev/quortextt/`, set `CLIENT_URL=https://quortex.morpheum.dev`

5. **Platform-specific port issues:**
   - Render.com: Uses port 10000 internally, but serves on standard HTTPS port 443 externally
   - Railway: Auto-assigns PORT, don't hardcode
   - DigitalOcean: Similar to Render
   - **Solution:** Use environment variable for PORT in server code (already configured)

**Common Mistakes:**

❌ **Wrong:** `VITE_SERVER_URL=https://your-app.onrender.com:3001`  
✅ **Correct:** `VITE_SERVER_URL=https://your-app.onrender.com`

❌ **Wrong:** `CLIENT_URL=https://quortex.morpheum.dev/quortextt/`  
✅ **Correct:** `CLIENT_URL=https://quortex.morpheum.dev`

**Issue: CORS errors in browser**
- Check `CLIENT_URL` environment variable matches your GitHub Pages URL (without path)
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
