# Webhook-Based Deployment Design Document

## Overview

This document outlines a design for webhook-triggered automated deployment on a self-hosted server. The goal is to automatically pull and redeploy the Quortex game server whenever code is pushed to the main branch, using systemd for service management and a webhook endpoint for triggering deployments.

## Executive Summary

**Recommended Approach:** GitHub webhook → Deployment endpoint → Systemd service reload

**Key Benefits:**
- Automatic deployments on push to main
- Zero-downtime updates with systemd service management
- Built-in rollback capability
- Minimal manual intervention

**Key Risks:**
- Security vulnerabilities if webhook endpoint is not properly secured
- Potential downtime during deployment if not handled carefully
- Webhook delivery failures may require manual deployment
- Race conditions with simultaneous deployments

---

## Architecture Overview

```
┌──────────────────┐         ┌──────────────────────┐         ┌─────────────────────┐
│   GitHub Push    │────────▶│  GitHub Webhook      │────────▶│  Self-Hosted Server │
│   to main        │  HTTPS  │  (POST request)      │  HTTPS  │  - Webhook Endpoint │
└──────────────────┘         └──────────────────────┘         └─────────────────────┘
                                                                          │
                                                                          ▼
                                                               ┌─────────────────────┐
                                                               │  Deployment Script  │
                                                               │  - git pull         │
                                                               │  - npm install      │
                                                               │  - npm run build    │
                                                               │  - systemd reload   │
                                                               └─────────────────────┘
                                                                          │
                                                                          ▼
                                                               ┌─────────────────────┐
                                                               │  Systemd Service    │
                                                               │  - quortex-server   │
                                                               │  - Auto-restart     │
                                                               └─────────────────────┘
```

---

## 1. Webhook Endpoint Design

### 1.1 Webhook Service Architecture

The webhook endpoint should be a lightweight service separate from the game server to ensure deployment operations don't interfere with game functionality.

**Option 1: Separate Node.js Service (Recommended)**
```javascript
// webhook-server.js
import express from 'express';
import crypto from 'crypto';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const app = express();

// Webhook secret for signature verification
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'your-secret-here';
const DEPLOY_SCRIPT = '/opt/quortex/scripts/deploy.sh';

// Middleware to verify GitHub webhook signature
function verifyGitHubSignature(req, res, next) {
  const signature = req.headers['x-hub-signature-256'];
  if (!signature) {
    return res.status(401).json({ error: 'No signature provided' });
  }

  const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
  const digest = 'sha256=' + hmac.update(JSON.stringify(req.body)).digest('hex');

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest))) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  next();
}

app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'webhook-deployment' });
});

// Webhook endpoint
app.post('/webhook/deploy', verifyGitHubSignature, async (req, res) => {
  const { ref, repository, pusher } = req.body;

  // Only deploy on push to main branch
  if (ref !== 'refs/heads/main') {
    return res.json({ 
      message: 'Skipping deployment - not main branch',
      ref 
    });
  }

  console.log(`Deployment triggered by ${pusher.name} for ${repository.full_name}`);

  // Respond immediately to avoid webhook timeout
  res.json({ 
    message: 'Deployment started',
    timestamp: new Date().toISOString()
  });

  // Execute deployment script asynchronously
  try {
    const { stdout, stderr } = await execAsync(DEPLOY_SCRIPT);
    console.log('Deployment stdout:', stdout);
    if (stderr) console.error('Deployment stderr:', stderr);
    console.log('Deployment completed successfully');
  } catch (error) {
    console.error('Deployment failed:', error);
  }
});

const PORT = process.env.WEBHOOK_PORT || 3002;
app.listen(PORT, () => {
  console.log(`Webhook server listening on port ${PORT}`);
});
```

**Option 2: GitHub Actions Self-Hosted Runner**
- Use a self-hosted GitHub Actions runner on your server
- More complex but provides better integration with GitHub
- Can reuse existing CI/CD workflows
- Requires additional setup and maintenance

### 1.2 Security Considerations

**Critical Security Measures:**

1. **Webhook Secret Verification** (REQUIRED)
   - Use `X-Hub-Signature-256` header to verify requests are from GitHub
   - Never accept unsigned webhooks
   - Use `crypto.timingSafeEqual()` to prevent timing attacks

2. **HTTPS Only** (REQUIRED)
   - Webhook endpoint MUST use HTTPS
   - Prevents man-in-the-middle attacks
   - GitHub requires HTTPS for webhook delivery

3. **IP Whitelist** (Recommended)
   - GitHub publishes webhook IP ranges via API: https://api.github.com/meta
   - Add nginx rule to only accept requests from GitHub IPs
   ```nginx
   # Get IPs from: curl https://api.github.com/meta | jq -r '.hooks[]'
   allow 192.30.252.0/22;
   allow 185.199.108.0/22;
   allow 140.82.112.0/20;
   deny all;
   ```

4. **Rate Limiting** (Recommended)
   - Limit deployment requests to prevent abuse
   - Example: Max 10 deployments per hour
   ```javascript
   import rateLimit from 'express-rate-limit';

   const deployLimiter = rateLimit({
     windowMs: 60 * 60 * 1000, // 1 hour
     max: 10, // Max 10 requests per hour
     message: 'Too many deployment requests'
   });

   app.post('/webhook/deploy', deployLimiter, verifyGitHubSignature, handler);
   ```

5. **Separate User for Deployment** (Recommended)
   - Run webhook service as dedicated user (e.g., `deploy-user`)
   - Grant minimal permissions (only what's needed for deployment)
   - Use sudo with specific command whitelist if needed

6. **Input Validation** (Required)
   - Validate webhook payload structure
   - Verify repository name matches expected value
   - Check ref is exactly `refs/heads/main`
   ```javascript
   const ALLOWED_REPOSITORY = process.env.ALLOWED_REPOSITORY || 'anicolao/quortextt';
   const ALLOWED_BRANCH = process.env.ALLOWED_BRANCH || 'refs/heads/main';

   function validatePayload(body) {
     if (!body.ref || !body.repository || !body.repository.full_name) {
       throw new Error('Invalid payload structure');
     }
     if (body.repository.full_name !== ALLOWED_REPOSITORY) {
       throw new Error(`Invalid repository: ${body.repository.full_name}`);
     }
     if (body.ref !== ALLOWED_BRANCH) {
       throw new Error(`Invalid branch: ${body.ref}`);
     }
   }
   ```

7. **Logging and Monitoring** (Recommended)
   - Log all webhook attempts (success and failure)
   - Monitor for suspicious patterns
   - Alert on repeated failures or unauthorized attempts
   ```javascript
   import winston from 'winston';

   const logger = winston.createLogger({
     level: 'info',
     format: winston.format.json(),
     transports: [
       new winston.transports.File({ filename: '/var/log/webhook/error.log', level: 'error' }),
       new winston.transports.File({ filename: '/var/log/webhook/combined.log' })
     ]
   });

   // Log all webhook attempts
   app.post('/webhook/deploy', (req, res, next) => {
     logger.info('Webhook received', {
       ip: req.ip,
       ref: req.body.ref,
       repository: req.body.repository?.full_name,
       timestamp: new Date().toISOString()
     });
     next();
   });
   ```

---

## 2. Deployment Script

### 2.1 Deployment Script Implementation

```bash
#!/bin/bash
# File: /opt/quortex/scripts/deploy.sh
# Purpose: Automated deployment script for Quortex server

set -e  # Exit on error
set -u  # Exit on undefined variable

# Configuration
REPO_DIR="/opt/quortex/quortextt"
SERVER_DIR="${REPO_DIR}/server"
LOG_DIR="/var/log/quortex"
LOG_FILE="${LOG_DIR}/deploy.log"
BACKUP_DIR="/var/backups/quortex"
SERVICE_NAME="quortex-server"
LOCK_FILE="/var/lock/quortex-deploy.lock"

# Logging function
log() {
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*" | tee -a "${LOG_FILE}"
}

# Cleanup function
cleanup() {
  rm -f "${LOCK_FILE}"
}

# Error handler
error_handler() {
  log "ERROR: Deployment failed at line $1"
  cleanup
  exit 1
}

trap 'error_handler ${LINENO}' ERR
trap cleanup EXIT

# Check if deployment is already in progress
if [ -f "${LOCK_FILE}" ]; then
  log "Deployment already in progress. Exiting."
  exit 0
fi

# Create lock file
touch "${LOCK_FILE}"

log "=========================================="
log "Starting deployment"
log "=========================================="

# 1. Create backup of current deployment
log "Creating backup..."
BACKUP_NAME="backup-$(date +'%Y%m%d-%H%M%S')"
mkdir -p "${BACKUP_DIR}"
cp -r "${SERVER_DIR}/dist" "${BACKUP_DIR}/${BACKUP_NAME}" || true

# 2. Pull latest code
log "Pulling latest code from main branch..."
cd "${REPO_DIR}"
git fetch origin
git reset --hard origin/main

# 3. Install dependencies (server)
log "Installing server dependencies..."
cd "${SERVER_DIR}"
npm ci --production=false

# 4. Build server
log "Building server..."
npm run build

# 5. Install production dependencies
log "Installing production dependencies..."
npm ci --production

# 6. Reload systemd service (zero-downtime)
log "Reloading systemd service..."
sudo systemctl reload-or-restart "${SERVICE_NAME}"

# 7. Verify service is running
log "Verifying service health..."
sleep 5
if systemctl is-active --quiet "${SERVICE_NAME}"; then
  log "Service is running"
else
  log "ERROR: Service failed to start. Rolling back..."
  
  # Rollback
  rm -rf "${SERVER_DIR}/dist"
  cp -r "${BACKUP_DIR}/${BACKUP_NAME}" "${SERVER_DIR}/dist"
  sudo systemctl restart "${SERVICE_NAME}"
  
  log "Rollback completed"
  exit 1
fi

# 8. Health check
log "Performing health check..."
HEALTH_CHECK_URL="http://localhost:3001/health"
if curl -f -s "${HEALTH_CHECK_URL}" > /dev/null; then
  log "Health check passed"
else
  log "WARNING: Health check failed, but service is running"
fi

# 9. Cleanup old backups (keep last 10)
log "Cleaning up old backups..."
cd "${BACKUP_DIR}"
ls -t | tail -n +11 | xargs -r rm -rf

log "=========================================="
log "Deployment completed successfully"
log "=========================================="
```

### 2.2 Script Permissions

```bash
# Create deploy user (if needed)
sudo useradd -r -s /bin/bash -d /opt/quortex deploy-user

# Set ownership
sudo chown -R deploy-user:deploy-user /opt/quortex
sudo chown -R deploy-user:deploy-user /var/log/quortex
sudo chown -R deploy-user:deploy-user /var/backups/quortex

# Make script executable
sudo chmod +x /opt/quortex/scripts/deploy.sh

# Allow deploy-user to reload systemd service without password
# File: /etc/sudoers.d/quortex-deploy
# SECURITY NOTE: Only grant specific commands needed for deployment
# Use full paths to binaries for additional security
cat << 'EOF' | sudo tee /etc/sudoers.d/quortex-deploy
deploy-user ALL=(ALL) NOPASSWD: /usr/bin/systemctl reload-or-restart quortex-server
deploy-user ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart quortex-server
deploy-user ALL=(ALL) NOPASSWD: /usr/bin/systemctl is-active quortex-server
deploy-user ALL=(ALL) NOPASSWD: /usr/bin/systemctl status quortex-server
EOF
sudo chmod 440 /etc/sudoers.d/quortex-deploy
sudo visudo -c  # Validate sudoers syntax
```

---

## 3. Systemd Service Configuration

### 3.1 Main Game Server Service

```ini
# File: /etc/systemd/system/quortex-server.service
[Unit]
Description=Quortex Multiplayer Server
After=network.target
Documentation=https://github.com/anicolao/quortextt

[Service]
Type=simple
User=quortex
Group=quortex
WorkingDirectory=/opt/quortex/quortextt/server
ExecStart=/usr/bin/node dist/index.js

# Environment variables
Environment=NODE_ENV=production
Environment=PORT=3001
Environment=CLIENT_URL=https://quortex.morpheum.dev
EnvironmentFile=-/etc/quortex/server.env

# Restart configuration
Restart=always
RestartSec=10s
StartLimitInterval=5min
StartLimitBurst=4

# Reload support for zero-downtime deployment
ExecReload=/bin/kill -HUP $MAINPID
KillMode=mixed
KillSignal=SIGTERM
TimeoutStopSec=30s

# Security hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/quortex/data
CapabilityBoundingSet=
AmbientCapabilities=
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true
RestrictRealtime=true
RestrictNamespaces=true

# Resource limits
LimitNOFILE=65536
MemoryLimit=1G
CPUQuota=100%

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=quortex-server

[Install]
WantedBy=multi-user.target
```

### 3.2 Webhook Service

```ini
# File: /etc/systemd/system/quortex-webhook.service
[Unit]
Description=Quortex Webhook Deployment Service
After=network.target

[Service]
Type=simple
User=deploy-user
Group=deploy-user
WorkingDirectory=/opt/quortex/webhook
ExecStart=/usr/bin/node webhook-server.js

# Environment variables
Environment=NODE_ENV=production
Environment=WEBHOOK_PORT=3002
EnvironmentFile=-/etc/quortex/webhook.env

# Restart configuration
Restart=always
RestartSec=10s

# Security hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/log/webhook /var/lock /var/backups/quortex /opt/quortex

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=quortex-webhook

[Install]
WantedBy=multi-user.target
```

### 3.3 Zero-Downtime Reload

For Node.js applications to support zero-downtime reload, the application needs to handle the HUP signal:

```javascript
// In server/src/index.ts

let server;
let isShuttingDown = false;

async function gracefulShutdown(signal) {
  if (isShuttingDown) {
    console.log('Shutdown already in progress...');
    return;
  }
  
  isShuttingDown = true;
  console.log(`${signal} received. Closing server gracefully...`);
  
  // Stop accepting new connections
  server.close(async () => {
    console.log('Server closed. Running cleanup...');
    
    // Perform cleanup tasks
    try {
      // Close database connections, finish pending operations, etc.
      await performCleanup();
      console.log('Cleanup completed. Process exiting.');
      process.exit(0);
    } catch (error) {
      console.error('Cleanup failed:', error);
      process.exit(1);
    }
  });

  // Force close after 30 seconds if graceful shutdown fails
  setTimeout(() => {
    console.error('Forcing shutdown after timeout');
    process.exit(1);
  }, 30000).unref(); // unref() allows process to exit naturally if shutdown completes
}

// Handle signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGHUP', () => gracefulShutdown('SIGHUP'));

// Handle uncaught errors gracefully
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});

// Start server
server = app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
```

**Note:** True zero-downtime requires more complex solutions:
1. **Blue-Green Deployment**: Run two instances, switch traffic
2. **Rolling Restart**: Use PM2 cluster mode
3. **Reverse Proxy Health Checks**: Nginx removes unhealthy backends

For simpler deployments, `systemctl reload-or-restart` provides quick restarts with minimal downtime (~1-2 seconds).

---

## 4. Nginx Configuration

### 4.1 Webhook Endpoint Proxy

```nginx
# File: /etc/nginx/sites-available/quortex-webhook

# Upstream for webhook service
upstream webhook_backend {
    server 127.0.0.1:3002;
    keepalive 8;
}

# HTTPS Server Block for Webhook
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name deploy.quortex.morpheum.dev;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/deploy.quortex.morpheum.dev/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/deploy.quortex.morpheum.dev/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Logs
    access_log /var/log/nginx/webhook_access.log;
    error_log /var/log/nginx/webhook_error.log;

    # GitHub webhook IPs (IMPORTANT: Update periodically from https://api.github.com/meta)
    # Last verified: 2025-11-22
    # Auto-update script: /opt/quortex/scripts/update-github-ips.sh (run monthly via cron)
    # To get latest IPs: curl https://api.github.com/meta | jq -r '.hooks[]'
    allow 192.30.252.0/22;
    allow 185.199.108.0/22;
    allow 140.82.112.0/20;
    allow 143.55.64.0/20;
    deny all;

    # Webhook endpoint
    location /webhook/deploy {
        proxy_pass http://webhook_backend;
        proxy_http_version 1.1;
        
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Important: Pass GitHub webhook headers
        proxy_set_header X-Hub-Signature-256 $http_x_hub_signature_256;
        proxy_set_header X-GitHub-Event $http_x_github_event;
        proxy_set_header X-GitHub-Delivery $http_x_github_delivery;
        
        # Timeouts (webhook payload can be large)
        proxy_connect_timeout 10s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
        
        # Buffer settings
        client_max_body_size 10M;
    }

    # Health check
    location /health {
        proxy_pass http://webhook_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        
        # Allow health checks from anywhere
        allow all;
    }
}

# HTTP redirect to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name deploy.quortex.morpheum.dev;
    
    return 301 https://$server_name$request_uri;
}
```

### 4.2 Update GitHub Webhook IPs Script

```bash
#!/bin/bash
# File: /opt/quortex/scripts/update-github-ips.sh
# Purpose: Update nginx configuration with latest GitHub webhook IPs

set -e

NGINX_CONFIG="/etc/nginx/sites-available/quortex-webhook"
TEMP_FILE="/tmp/github-webhook-ips.txt"

# Fetch latest GitHub webhook IPs
curl -s https://api.github.com/meta | jq -r '.hooks[]' > "${TEMP_FILE}"

# Update nginx config (preserving structure)
# This is a simple example - production version should be more robust
echo "GitHub webhook IPs updated on $(date)" >> /var/log/nginx/ip-updates.log
cat "${TEMP_FILE}" >> /var/log/nginx/ip-updates.log

# Notify admin to update nginx config manually
echo "GitHub webhook IPs may have changed. Please review ${TEMP_FILE}"

# Optionally: Automatically update nginx config (risky - needs testing)
# sed -i '/# GitHub webhook IPs/,/deny all/c\<new config>' "${NGINX_CONFIG}"
# nginx -t && systemctl reload nginx

rm -f "${TEMP_FILE}"
```

Add to crontab for monthly updates:
```bash
# Run monthly on the 1st at 3am
0 3 1 * * /opt/quortex/scripts/update-github-ips.sh
```

---

## 5. GitHub Webhook Configuration

### 5.1 Setting Up the Webhook

1. **Navigate to Repository Settings:**
   - Go to https://github.com/anicolao/quortextt/settings/hooks
   - Click "Add webhook"

2. **Configure Webhook:**
   - **Payload URL:** `https://deploy.quortex.morpheum.dev/webhook/deploy`
   - **Content type:** `application/json`
   - **Secret:** Generate a strong secret (store in environment variable)
     ```bash
     openssl rand -base64 32
     ```
   - **Which events:** Select "Just the push event"
   - **Active:** Check the box

3. **Test the Webhook:**
   - GitHub provides a "Recent Deliveries" section
   - Click "Redeliver" to test
   - Check server logs: `journalctl -u quortex-webhook -f`

### 5.2 Webhook Payload Example

```json
{
  "ref": "refs/heads/main",
  "before": "abc123...",
  "after": "def456...",
  "repository": {
    "id": 123456789,
    "name": "quortextt",
    "full_name": "anicolao/quortextt",
    "private": false,
    "url": "https://api.github.com/repos/anicolao/quortextt"
  },
  "pusher": {
    "name": "username",
    "email": "user@example.com"
  },
  "commits": [
    {
      "id": "def456...",
      "message": "Fix bug in game logic",
      "timestamp": "2025-11-22T10:30:00Z",
      "author": {
        "name": "Developer",
        "email": "dev@example.com"
      }
    }
  ]
}
```

---

## 6. Potential Issues and Concerns

### 6.1 Security Vulnerabilities

**Issue:** Unauthorized code execution via webhook
**Mitigation:**
- ✅ Webhook secret verification (HMAC SHA-256)
- ✅ IP whitelist (GitHub webhook IPs only)
- ✅ HTTPS only
- ✅ Input validation (repository name, branch)
- ✅ Rate limiting
- ✅ Dedicated user with minimal permissions
- ✅ Comprehensive logging

**Issue:** Secrets exposed in deployment script
**Mitigation:**
- Store secrets in environment files (`/etc/quortex/*.env`)
- Use systemd `EnvironmentFile` directive
- Never commit secrets to repository
- Use file permissions (600, owned by service user)

### 6.2 Deployment Failures

**Issue:** Deployment fails mid-process, leaving server in broken state
**Mitigation:**
- ✅ Atomic deployments (build in temp directory, swap on success)
- ✅ Automated rollback on failure
- ✅ Health check after deployment
- ✅ Keep backups of previous deployments

**Issue:** Build takes too long, webhook times out
**Mitigation:**
- ✅ Respond to webhook immediately (202 Accepted)
- ✅ Run deployment asynchronously
- ✅ GitHub waits 10 seconds for response
- ✅ Use background job for long-running deploys

### 6.3 Concurrent Deployments

**Issue:** Multiple pushes trigger simultaneous deployments
**Mitigation:**
- ✅ Lock file prevents concurrent deployments
- ✅ Queue system for pending deployments (optional)
- ✅ Skip deployment if already in progress

**Implementation:**
```javascript
let deploymentInProgress = false;

app.post('/webhook/deploy', verifyGitHubSignature, async (req, res) => {
  if (deploymentInProgress) {
    return res.status(429).json({ 
      message: 'Deployment already in progress' 
    });
  }

  deploymentInProgress = true;
  res.json({ message: 'Deployment started' });

  try {
    await execAsync(DEPLOY_SCRIPT);
  } finally {
    deploymentInProgress = false;
  }
});
```

### 6.4 Network Issues

**Issue:** GitHub webhook delivery fails (network timeout, DNS issues)
**Mitigation:**
- GitHub retries failed webhooks automatically
- Check "Recent Deliveries" in webhook settings
- Manual deployment fallback: `ssh server && cd /opt/quortex && ./scripts/deploy.sh`
- Monitor webhook logs for delivery failures

**Issue:** Outbound connection fails (git pull fails)
**Mitigation:**
- Use SSH deploy keys for authentication
- Fallback to HTTPS with credentials
- Monitor for network issues
- Alert on deployment failures

### 6.5 Database Migrations

**Issue:** Code changes require database schema changes
**Current Status:** Not applicable (file-based storage currently)
**Future Mitigation:**
- Include migration step in deployment script
- Use migration tools (e.g., Knex, TypeORM migrations)
- Test migrations in staging environment first
- Support rollback of migrations

### 6.6 Zero-Downtime Challenges

**Issue:** Restarting server causes active games to disconnect
**Mitigation:**
- ✅ Graceful shutdown (close connections cleanly)
- ✅ Session persistence (store game state)
- ✅ Client reconnection logic
- ⚠️ Consider blue-green deployment for true zero-downtime
- ⚠️ Or use PM2 cluster mode for rolling restarts

**Issue:** WebSocket connections drop during restart
**Mitigation:**
- Client-side reconnection with exponential backoff
- Server-side session recovery
- Notify users of impending maintenance (optional)
- Schedule deployments during low-traffic periods

### 6.7 Monitoring and Alerting

**Issue:** Deployment fails silently
**Mitigation:**
- Email/Slack notifications on deployment failure
- Monitoring service (e.g., Uptime Robot, Pingdom)
- Log aggregation (journalctl, syslog)
- Metrics collection (Prometheus, Grafana)

**Example Notification:**
```bash
# In deploy.sh
send_notification() {
  local status=$1
  local message=$2
  
  # Email notification
  echo "${message}" | mail -s "Quortex Deployment ${status}" admin@example.com
  
  # Or Slack webhook
  curl -X POST https://hooks.slack.com/services/YOUR/WEBHOOK/URL \
    -H 'Content-Type: application/json' \
    -d "{\"text\": \"Deployment ${status}: ${message}\"}"
}

# Call on success/failure
send_notification "SUCCESS" "Deployment completed"
send_notification "FAILED" "Deployment failed: ${error_message}"
```

### 6.8 Rollback Complexity

**Issue:** Need to rollback to previous version
**Current Solution:**
- Backup created before each deployment
- Manual rollback: copy backup to dist, restart service

**Improved Solution:**
```bash
# File: /opt/quortex/scripts/rollback.sh
#!/bin/bash
set -e

BACKUP_DIR="/var/backups/quortex"
SERVER_DIR="/opt/quortex/quortextt/server"
SERVICE_NAME="quortex-server"

# List available backups
echo "Available backups:"
ls -1t "${BACKUP_DIR}"

# Get latest backup (or specify one)
BACKUP_NAME=${1:-$(ls -1t "${BACKUP_DIR}" | head -n1)}

echo "Rolling back to: ${BACKUP_NAME}"

# Restore backup
rm -rf "${SERVER_DIR}/dist"
cp -r "${BACKUP_DIR}/${BACKUP_NAME}" "${SERVER_DIR}/dist"

# Restart service
sudo systemctl restart "${SERVICE_NAME}"

echo "Rollback completed"
```

### 6.9 Testing Deployments

**Issue:** No way to test deployment before production
**Mitigation:**
- Staging environment (separate server/branch)
- Local testing of deployment script
- Dry-run mode for deployment script
- CI/CD tests before webhook trigger (already in place)

### 6.10 Access Control

**Issue:** Anyone with webhook URL could trigger deployment
**Mitigation:**
- ✅ Webhook secret verification (prevents unauthorized triggers)
- ✅ IP whitelist (only GitHub IPs)
- ✅ Subdomain isolation (`deploy.quortex.morpheum.dev`)
- ✅ Firewall rules

---

## 7. Comparison with Current Deployment

### 7.1 Current Deployment (GitHub Pages)

**Pros:**
- ✅ Free hosting
- ✅ Automatic CI/CD
- ✅ Global CDN
- ✅ No maintenance
- ✅ Built-in SSL

**Cons:**
- ❌ Static content only (no backend)
- ❌ 100 GB/month bandwidth limit
- ❌ No server-side logic

### 7.2 Webhook-Based Self-Hosted Deployment

**Pros:**
- ✅ Full control over infrastructure
- ✅ Support for backend (multiplayer server)
- ✅ No bandwidth limits
- ✅ Custom server configuration
- ✅ Private deployment possible

**Cons:**
- ❌ Server costs ($5-20/month minimum)
- ❌ Maintenance burden (updates, monitoring, backups)
- ❌ Complexity (DevOps knowledge required)
- ❌ Must handle SSL/certificates
- ❌ Availability responsibility

### 7.3 Hybrid Approach (Recommended)

**Architecture:**
```
GitHub Pages (Static Frontend)
    ↓
    ↓ (WebSocket/HTTPS)
    ↓
Self-Hosted Server (Multiplayer Backend)
    ↑
    ↑ (Webhook)
    ↑
GitHub (Code Repository)
```

**Benefits:**
- Static frontend hosted on GitHub Pages (free, fast, CDN)
- Multiplayer server on self-hosted infrastructure
- Webhook deployment for backend only
- Frontend deploys via GitHub Actions (existing)
- Backend deploys via webhook (new)

**Deployment Flow:**
1. Push to main
2. GitHub Actions runs CI tests
3. **If tests pass:**
   - GitHub Pages deploys frontend automatically
   - GitHub webhook triggers backend deployment
4. Backend pulls code, builds, and restarts
5. Both frontend and backend updated

This is the **recommended approach** as it combines the best of both worlds.

---

## 8. Implementation Checklist

### 8.1 Prerequisites

- [ ] Self-hosted server with Ubuntu/Debian or NixOS
- [ ] Domain name with SSL certificate (Let's Encrypt)
- [ ] Node.js 18+ installed
- [ ] nginx installed and configured
- [ ] SSH access to server
- [ ] sudo privileges

### 8.2 Initial Setup

- [ ] Create deployment user: `deploy-user`
- [ ] Clone repository to `/opt/quortex/quortextt`
- [ ] Create directories:
  - `/opt/quortex/webhook` (webhook service)
  - `/opt/quortex/scripts` (deployment scripts)
  - `/var/log/quortex` (logs)
  - `/var/log/webhook` (webhook logs)
  - `/var/backups/quortex` (backups)
- [ ] Set up SSH deploy key for GitHub access
- [ ] Generate webhook secret: `openssl rand -base64 32`

### 8.3 Webhook Service Setup

- [ ] Create webhook server (`webhook-server.js`)
- [ ] Install dependencies: `npm install express`
- [ ] Create systemd service (`quortex-webhook.service`)
- [ ] Create environment file (`/etc/quortex/webhook.env`)
- [ ] Enable and start service: `systemctl enable --now quortex-webhook`

### 8.4 Deployment Script Setup

- [ ] Create deployment script (`/opt/quortex/scripts/deploy.sh`)
- [ ] Make script executable: `chmod +x`
- [ ] Configure sudoers for systemctl commands
- [ ] Test script manually

### 8.5 Systemd Configuration

- [ ] Create game server service (`quortex-server.service`)
- [ ] Add graceful shutdown handling to server code
- [ ] Enable and start service: `systemctl enable --now quortex-server`
- [ ] Test reload: `systemctl reload quortex-server`

### 8.6 Nginx Configuration

- [ ] Create webhook nginx config
- [ ] Update GitHub webhook IPs
- [ ] Configure SSL certificate
- [ ] Test nginx config: `nginx -t`
- [ ] Reload nginx: `systemctl reload nginx`

### 8.7 GitHub Configuration

- [ ] Add webhook to GitHub repository
- [ ] Set payload URL: `https://deploy.quortex.morpheum.dev/webhook/deploy`
- [ ] Set secret (same as `WEBHOOK_SECRET` environment variable)
- [ ] Set content type: `application/json`
- [ ] Select "push" events only
- [ ] Test webhook delivery

### 8.8 Testing

- [ ] Test webhook endpoint: `curl https://deploy.quortex.morpheum.dev/health`
- [ ] Test deployment script manually: `sudo -u deploy-user /opt/quortex/scripts/deploy.sh`
- [ ] Trigger test deployment (push to main)
- [ ] Verify service restarts correctly
- [ ] Check logs: `journalctl -u quortex-server -f`
- [ ] Test rollback script
- [ ] Verify health check endpoint

### 8.9 Monitoring Setup

- [ ] Set up log rotation
- [ ] Configure monitoring/alerting
- [ ] Test failure scenarios
- [ ] Document incident response procedures

### 8.10 Documentation

- [ ] Update production deployment documentation
- [ ] Document webhook configuration
- [ ] Create runbook for common issues
- [ ] Document rollback procedure

---

## 9. NixOS Configuration (Alternative)

For NixOS users, here's a declarative configuration:

```nix
{ config, pkgs, ... }:

let
  quortexDir = "/opt/quortex";
  webhookPort = 3002;
in
{
  # Create deployment user
  users.users.deploy-user = {
    isSystemUser = true;
    group = "deploy-user";
    home = quortexDir;
    createHome = true;
  };
  users.groups.deploy-user = {};

  # Create required directories
  systemd.tmpfiles.rules = [
    "d /var/log/quortex 0750 quortex quortex -"
    "d /var/log/webhook 0750 deploy-user deploy-user -"
    "d /var/backups/quortex 0750 deploy-user deploy-user -"
    "d ${quortexDir}/webhook 0750 deploy-user deploy-user -"
    "d ${quortexDir}/scripts 0750 deploy-user deploy-user -"
  ];

  # Webhook service
  systemd.services.quortex-webhook = {
    description = "Quortex Webhook Deployment Service";
    after = [ "network.target" ];
    wantedBy = [ "multi-user.target" ];

    environment = {
      NODE_ENV = "production";
      WEBHOOK_PORT = toString webhookPort;
    };

    serviceConfig = {
      Type = "simple";
      User = "deploy-user";
      Group = "deploy-user";
      WorkingDirectory = "${quortexDir}/webhook";
      ExecStart = "${pkgs.nodejs_18}/bin/node webhook-server.js";
      Restart = "always";
      RestartSec = "10s";
      
      # Security
      NoNewPrivileges = true;
      PrivateTmp = true;
      ProtectSystem = "strict";
      ProtectHome = true;
      ReadWritePaths = [ "/var/log/webhook" "/var/lock" "/var/backups/quortex" quortexDir ];
    };
  };

  # Nginx configuration for webhook
  services.nginx.virtualHosts."deploy.quortex.morpheum.dev" = {
    enableACME = true;
    forceSSL = true;
    
    locations."/webhook/deploy" = {
      proxyPass = "http://127.0.0.1:${toString webhookPort}";
      extraConfig = ''
        # GitHub webhook IPs
        allow 192.30.252.0/22;
        allow 185.199.108.0/22;
        allow 140.82.112.0/20;
        deny all;
        
        proxy_set_header X-Hub-Signature-256 $http_x_hub_signature_256;
        proxy_set_header X-GitHub-Event $http_x_github_event;
        client_max_body_size 10M;
      '';
    };
  };
}
```

---

## 10. Monitoring and Maintenance

### 10.1 Log Management

**View deployment logs:**
```bash
# Deployment script logs
tail -f /var/log/quortex/deploy.log

# Webhook service logs
journalctl -u quortex-webhook -f

# Game server logs
journalctl -u quortex-server -f

# All quortex-related logs
journalctl -t quortex-server -t quortex-webhook -f
```

**Log rotation:**
```bash
# File: /etc/logrotate.d/quortex
/var/log/quortex/*.log {
    daily
    rotate 30
    compress
    delaycompress
    notifempty
    missingok
    create 0640 deploy-user deploy-user
}

/var/log/webhook/*.log {
    daily
    rotate 30
    compress
    delaycompress
    notifempty
    missingok
    create 0640 deploy-user deploy-user
}
```

### 10.2 Health Monitoring

**Systemd status:**
```bash
# Check service status
systemctl status quortex-server
systemctl status quortex-webhook

# Check if services are running
systemctl is-active quortex-server
systemctl is-active quortex-webhook
```

**HTTP health checks:**
```bash
# Game server health
curl http://localhost:3001/health

# Webhook service health
curl https://deploy.quortex.morpheum.dev/health
```

**Automated monitoring (cron):**
```bash
# File: /opt/quortex/scripts/health-check.sh
#!/bin/bash

check_health() {
  local url=$1
  local service=$2
  
  if ! curl -f -s "${url}" > /dev/null; then
    echo "ALERT: ${service} health check failed"
    # Send notification
    mail -s "${service} is down" admin@example.com <<< "${service} health check failed at $(date)"
  fi
}

check_health "http://localhost:3001/health" "Quortex Server"
check_health "http://localhost:3002/health" "Webhook Service"
```

Add to crontab:
```bash
*/5 * * * * /opt/quortex/scripts/health-check.sh
```

### 10.3 Backup Management

**Manual backup:**
```bash
# Backup current deployment
sudo -u deploy-user /opt/quortex/scripts/backup.sh
```

**Automated backups (cron):**
```bash
# Daily backup at 2am
0 2 * * * /opt/quortex/scripts/backup.sh
```

**Backup script:**
```bash
#!/bin/bash
# File: /opt/quortex/scripts/backup.sh

BACKUP_DIR="/var/backups/quortex"
SERVER_DIR="/opt/quortex/quortextt/server"
BACKUP_NAME="scheduled-backup-$(date +'%Y%m%d-%H%M%S')"

mkdir -p "${BACKUP_DIR}"
cp -r "${SERVER_DIR}/dist" "${BACKUP_DIR}/${BACKUP_NAME}"

# Cleanup old backups (keep 30 days)
find "${BACKUP_DIR}" -type d -name "scheduled-backup-*" -mtime +30 -exec rm -rf {} \;

echo "Backup created: ${BACKUP_NAME}"
```

---

## 11. Security Hardening

### 11.1 Firewall Configuration

**UFW (Ubuntu):**
```bash
# Allow SSH
sudo ufw allow 22/tcp

# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Block direct access to webhook service
# (only accessible via nginx)
sudo ufw deny 3002/tcp

# Enable firewall
sudo ufw enable
```

### 11.2 Fail2Ban

Protect against brute force attacks:

```ini
# File: /etc/fail2ban/jail.local
[nginx-webhook]
enabled = true
port = http,https
filter = nginx-webhook
logpath = /var/log/nginx/webhook_access.log
maxretry = 5
bantime = 3600
findtime = 600
```

```
# File: /etc/fail2ban/filter.d/nginx-webhook.conf
[Definition]
failregex = ^<HOST> - .* "POST /webhook/deploy HTTP/.*" 401
            ^<HOST> - .* "POST /webhook/deploy HTTP/.*" 403
ignoreregex =
```

### 11.3 SSL/TLS Best Practices

**Test SSL configuration:**
```bash
# Test SSL/TLS security
curl https://deploy.quortex.morpheum.dev/health -v

# Check certificate
openssl s_client -connect deploy.quortex.morpheum.dev:443 -servername deploy.quortex.morpheum.dev
```

**Automatic certificate renewal:**
```bash
# Let's Encrypt auto-renewal (certbot)
sudo certbot renew --dry-run

# Add to crontab
0 3 * * * certbot renew --quiet
```

---

## 12. Troubleshooting Guide

### 12.1 Webhook Not Triggering

**Check 1: Verify webhook is configured in GitHub**
- Go to repository Settings → Webhooks
- Check "Recent Deliveries" tab
- Look for failed deliveries

**Check 2: Verify webhook service is running**
```bash
systemctl status quortex-webhook
journalctl -u quortex-webhook -n 50
```

**Check 3: Test webhook endpoint**
```bash
curl -X POST https://deploy.quortex.morpheum.dev/webhook/deploy \
  -H "Content-Type: application/json" \
  -d '{"ref":"refs/heads/main","repository":{"full_name":"anicolao/quortextt"}}'
```

**Check 4: Verify nginx is forwarding requests**
```bash
tail -f /var/log/nginx/webhook_access.log
tail -f /var/log/nginx/webhook_error.log
```

### 12.2 Deployment Script Fails

**Check 1: View deployment logs**
```bash
tail -f /var/log/quortex/deploy.log
```

**Check 2: Test script manually**
```bash
sudo -u deploy-user /opt/quortex/scripts/deploy.sh
```

**Check 3: Verify git access**
```bash
sudo -u deploy-user git -C /opt/quortex/quortextt fetch origin
```

**Check 4: Verify Node.js and npm**
```bash
node --version
npm --version
```

### 12.3 Service Won't Start After Deployment

**Check 1: View service logs**
```bash
journalctl -u quortex-server -n 100 --no-pager
```

**Check 2: Verify build artifacts**
```bash
ls -la /opt/quortex/quortextt/server/dist/
```

**Check 3: Test server manually**
```bash
cd /opt/quortex/quortextt/server
node dist/index.js
```

**Check 4: Rollback to previous version**
```bash
/opt/quortex/scripts/rollback.sh
```

### 12.4 WebSocket Connections Dropping

**Check 1: Verify nginx WebSocket configuration**
```nginx
# Ensure these headers are set in nginx
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
```

**Check 2: Check service during deployment**
```bash
# Monitor connections during deployment
watch -n 1 'netstat -an | grep :3001'
```

**Check 3: Verify graceful shutdown**
```bash
# Check if server handles SIGTERM correctly
journalctl -u quortex-server | grep -i "shutdown"
```

---

## 13. Conclusion

### 13.1 Summary

This webhook-based deployment design provides:

**Benefits:**
- ✅ Automated deployments on push to main
- ✅ Quick deployment (~30 seconds)
- ✅ Minimal downtime (~1-2 seconds)
- ✅ Automatic rollback on failure
- ✅ Comprehensive security measures
- ✅ Monitoring and logging
- ✅ Easy manual intervention if needed

**Trade-offs:**
- ⚠️ More complex than GitHub Pages alone
- ⚠️ Requires server maintenance
- ⚠️ Need to monitor webhook delivery
- ⚠️ Potential for deployment failures
- ⚠️ Not true zero-downtime (without blue-green deployment)

### 13.2 Recommended Approach

For Quortex, the **hybrid approach** is recommended:

1. **Frontend (GitHub Pages):**
   - Deploy via GitHub Actions (existing)
   - Free, fast, global CDN
   - Automatic HTTPS
   - No maintenance

2. **Backend (Self-Hosted):**
   - Deploy via webhook (this design)
   - Full control
   - Support for multiplayer server
   - Custom configuration

This combines the simplicity of GitHub Pages for the frontend with the flexibility of self-hosted backend deployment.

### 13.3 Next Steps

1. Review this design document
2. Decide on deployment strategy (webhook vs. alternatives)
3. Set up staging environment for testing
4. Implement webhook service and deployment script
5. Test thoroughly in staging
6. Deploy to production
7. Monitor and iterate

### 13.4 Alternatives to Consider

If webhook-based deployment seems too complex:

**Alternative 1: Manual SSH Deployment**
- SSH to server, run deployment script manually
- Simpler, more control
- No webhook security concerns
- But requires manual intervention

**Alternative 2: GitHub Actions Self-Hosted Runner**
- Run GitHub Actions runner on your server
- Reuse existing CI/CD workflows
- Better GitHub integration
- But more complex setup and maintenance

**Alternative 3: CI/CD Tools (GitLab CI, Jenkins, etc.)**
- More features (pipelines, approvals, etc.)
- Better suited for complex deployments
- But higher learning curve and complexity

**Alternative 4: Platform-as-a-Service (Render, Railway, etc.)**
- Automatic deployments from GitHub
- No server management
- Built-in SSL, monitoring, etc.
- But costs money and less control

---

## Appendix A: Full Code Examples

### A.1 Complete Webhook Server

See Section 1.1 for the webhook server implementation.

### A.2 Complete Deployment Script

See Section 2.1 for the deployment script implementation.

### A.3 Complete Nginx Configuration

See Section 4.1 for the nginx configuration.

---

## Appendix B: Environment Variables Reference

### B.1 Webhook Service

```bash
# File: /etc/quortex/webhook.env

# WARNING: Generate a strong secret before using in production!
# Generate with: openssl rand -base64 32
# NEVER use the example values below in production
WEBHOOK_SECRET=your-secret-here-change-this

# Allowed repository (format: owner/repo)
ALLOWED_REPOSITORY=anicolao/quortextt

# Allowed branch for deployment
ALLOWED_BRANCH=refs/heads/main

# Port for webhook service
WEBHOOK_PORT=3002

# Deployment script path
DEPLOY_SCRIPT=/opt/quortex/scripts/deploy.sh

# Node environment
NODE_ENV=production
```

### B.2 Game Server

```bash
# File: /etc/quortex/server.env

# Node environment
NODE_ENV=production

# Server port
PORT=3001

# Client URL (for CORS)
CLIENT_URL=https://quortex.morpheum.dev

# WARNING: Generate strong secrets before using in production!
# Generate JWT secret with: openssl rand -base64 32
# NEVER use the example values below in production
JWT_SECRET=your-jwt-secret-change-this

# OAuth credentials (if used)
# Get these from Discord Developer Portal
DISCORD_CLIENT_ID=your-discord-client-id
DISCORD_CLIENT_SECRET=your-discord-client-secret
DISCORD_CALLBACK_URL=https://quortex.morpheum.dev/auth/discord/callback

# Data directory
DATA_DIR=/var/lib/quortex/data
```

---

## Appendix C: Useful Commands

```bash
# Service management
systemctl start quortex-server
systemctl stop quortex-server
systemctl restart quortex-server
systemctl reload quortex-server
systemctl status quortex-server

# View logs
journalctl -u quortex-server -f
journalctl -u quortex-webhook -f
tail -f /var/log/quortex/deploy.log

# Manual deployment
sudo -u deploy-user /opt/quortex/scripts/deploy.sh

# Rollback
sudo -u deploy-user /opt/quortex/scripts/rollback.sh

# Test webhook
curl -X POST https://deploy.quortex.morpheum.dev/webhook/deploy \
  -H "Content-Type: application/json" \
  -d '{"ref":"refs/heads/main","repository":{"full_name":"anicolao/quortextt"}}'

# Check GitHub webhook IPs
curl https://api.github.com/meta | jq -r '.hooks[]'

# Test SSL certificate
openssl s_client -connect deploy.quortex.morpheum.dev:443

# Check disk space
df -h
du -sh /opt/quortex
du -sh /var/backups/quortex

# Monitor active connections
netstat -an | grep :3001
ss -tulpn | grep :3001
```

---

*Last Updated: 2025-11-22*  
*Document Version: 1.0*  
*Author: AI Assistant (GitHub Copilot)*
