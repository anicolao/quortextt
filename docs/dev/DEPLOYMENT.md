# Deployment Design Document

## Overview

This document outlines the deployment strategy for Quortex, a web-based implementation of the Flows board game. The primary deployment target is **GitHub Pages** as a static website, but alternative deployment options are also evaluated.

## Executive Summary

**Recommended Approach:** GitHub Pages with GitHub Actions CI/CD

- **Cost:** Free for public repositories
- **Complexity:** Low - minimal configuration required
- **Performance:** Good - CDN-backed static hosting
- **Maintenance:** Minimal - automated deployments
- **Custom Domain:** Supported (optional)

---

## 1. GitHub Pages Deployment (Recommended)

### 1.1 Architecture

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│  Push to main   │────────▶│ GitHub Actions   │────────▶│  GitHub Pages   │
│   (git push)    │         │  - Build         │         │  (Static Site)  │
└─────────────────┘         │  - Test          │         └─────────────────┘
                            │  - Deploy        │                  │
                            └──────────────────┘                  │
                                                                   ▼
                                                          ┌─────────────────┐
                                                          │   Users Access  │
                                                          │ your-username.  │
                                                          │ github.io/      │
                                                          │ your-repo-name  │
                                                          └─────────────────┘
```

### 1.2 Implementation Steps

#### Step 1: Configure Vite for GitHub Pages

The application uses Vite as its build tool. For GitHub Pages deployment, the `base` path must be configured to match the repository name.

**File: `vite.config.ts`** (create new file)
```typescript
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/your-repo-name/', // Replace with your repository name
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    minify: 'terser',
    rollupOptions: {
      output: {
        manualChunks: undefined, // Single bundle for simplicity
      },
    },
  },
});
```

**Rationale:**
- `base: '/your-repo-name/'` ensures asset paths work correctly when deployed to `username.github.io/your-repo-name/`
- Single bundle simplifies caching and reduces request overhead
- Minification with terser provides better compression than esbuild

#### Step 2: Create GitHub Actions Workflow

**File: `.github/workflows/deploy.yml`**
```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches:
      - main
  workflow_dispatch: # Allow manual deployment

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests
        run: npm run test:coverage
        env:
          CI: true
      
      - name: Build for production
        run: npm run build
      
      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: ./dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

**Key Features:**
- Runs on every push to `main` branch
- Executes tests before building (fail fast)
- Only deploys if tests pass
- Supports manual deployment via GitHub UI
- Uses official GitHub Pages actions
- Proper permissions for Pages deployment

#### Step 3: Configure GitHub Repository Settings

1. Navigate to repository **Settings** → **Pages**
2. Under **Source**, select **GitHub Actions**
3. Save the configuration

**Note:** GitHub Pages is automatically enabled for public repositories. For private repositories, GitHub Pro/Team/Enterprise is required.

#### Step 4: Optional - Custom Domain

If using a custom domain (e.g., `quortex.example.com`):

1. Add a `CNAME` file to the repository root:
   ```
   quortex.example.com
   ```

2. Update DNS records:
   ```
   Type:  CNAME
   Name:  quortex (or @)
   Value: your-username.github.io
   ```

3. Update `vite.config.ts`:
   ```typescript
   base: '/', // Root path for custom domain
   ```

4. Configure custom domain in repository Settings → Pages

### 1.3 Deployment Process

**Automatic Deployment:**
```bash
# 1. Make changes locally
git add .
git commit -m "Add new feature"

# 2. Push to main branch
git push origin main

# 3. GitHub Actions automatically:
#    - Installs dependencies
#    - Runs tests
#    - Builds the application
#    - Deploys to GitHub Pages

# 4. Site is live at: https://username.github.io/your-repo-name/
```

**Manual Deployment:**
1. Go to repository **Actions** tab
2. Select "Deploy to GitHub Pages" workflow
3. Click "Run workflow" → "Run workflow"

### 1.4 Build Optimization

**Current Build Output:**
- `index.html`: ~0.65 KB
- `assets/index-*.js`: ~39 KB (gzipped: ~11.6 KB)
- Total: ~12 KB gzipped

**Optimization Recommendations:**

1. **Code Splitting** (future enhancement):
   ```typescript
   // Lazy load game logic after player configuration
   const gameModule = await import('./game');
   ```

2. **Asset Optimization**:
   - Already using minification
   - Already using gzip compression (via CDN)
   - Consider adding Brotli compression for modern browsers

3. **Caching Strategy**:
   - Vite automatically generates hashed filenames (`index-CHABeWam.js`)
   - GitHub Pages CDN automatically caches assets
   - Browser caching configured via CDN headers

### 1.5 Pros and Cons

#### Pros ✅
- **Zero cost** for public repositories
- **Automatic CI/CD** via GitHub Actions
- **Global CDN** for fast content delivery
- **HTTPS by default** with free SSL certificate
- **Custom domain support** with no additional cost
- **Version control integration** - deployment tied to git history
- **Minimal configuration** - works out of the box
- **No server management** required
- **High availability** - backed by GitHub's infrastructure
- **Simple rollback** - redeploy previous commit

#### Cons ❌
- **Static content only** - no server-side logic (not needed for this game)
- **100 GB/month bandwidth limit** (soft limit, typically enough)
- **Repository must be public** for free tier (or requires GitHub Pro)
- **Build time limitations** - 6 hours max per workflow (not an issue for this project)
- **No server-side analytics** - must use client-side solutions (e.g., Google Analytics)
- **Limited to 1 GB site size** (current build is ~40 KB, no concern)

---

## 2. Alternative Deployment Options

### 2.1 Netlify

**Deployment Process:**
1. Connect GitHub repository to Netlify
2. Configure build settings:
   - Build command: `npm run build`
   - Publish directory: `dist`
3. Automatic deployments on push

#### Pros ✅
- **Generous free tier** - 100 GB bandwidth/month
- **Branch previews** - automatic preview deployments for PRs
- **Form handling** - built-in form submission (not needed)
- **Serverless functions** - if backend needed in future
- **Built-in analytics** (paid feature)
- **Automatic HTTPS** with free SSL
- **Custom domain** with automatic DNS management

#### Cons ❌
- **External dependency** - another service to manage
- **Vendor lock-in** - harder to migrate than GitHub Pages
- **Build minutes limit** - 300 minutes/month on free tier
- **Configuration file required** - `netlify.toml`

#### Configuration Example

**File: `netlify.toml`**
```toml
[build]
  command = "npm run build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "18"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

**Cost:** Free (100 GB bandwidth, 300 build minutes/month)

**Use Case:** Choose if you need branch preview deployments or plan to add serverless functions.

---

### 2.2 Vercel

**Deployment Process:**
1. Import GitHub repository to Vercel
2. Vercel auto-detects Vite configuration
3. Automatic deployments on push

#### Pros ✅
- **Zero configuration** - auto-detects Vite
- **Excellent preview deployments** - automatic for PRs
- **Fast global CDN** - edge network
- **Built-in analytics** (free tier)
- **Serverless functions** - if needed in future
- **Custom domain** with automatic DNS
- **Web vitals monitoring** - performance metrics

#### Cons ❌
- **External dependency** - another service to manage
- **Tighter limits** - 100 GB bandwidth/month, 6000 build minutes/year
- **Vendor lock-in** - proprietary platform
- **Overkill for simple static site**

**Cost:** Free (100 GB bandwidth, 6000 build minutes/year)

**Use Case:** Choose if you want best-in-class preview deployments and may add Next.js in future.

---

### 2.3 Cloudflare Pages

**Deployment Process:**
1. Connect GitHub repository to Cloudflare Pages
2. Configure build:
   - Build command: `npm run build`
   - Build output directory: `dist`
3. Automatic deployments on push

#### Pros ✅
- **Unlimited bandwidth** - no bandwidth limits on free tier
- **Unlimited requests** - no limit on number of requests
- **Fast global CDN** - Cloudflare's edge network
- **Automatic HTTPS** with free SSL
- **Branch previews** - preview deployments for PRs
- **Workers integration** - serverless compute if needed
- **Web analytics** - built-in privacy-focused analytics

#### Cons ❌
- **External dependency** - another service to manage
- **Build time limit** - 20 minutes per build (plenty for this project)
- **Configuration required** - must set up in Cloudflare dashboard
- **More complex** - additional service to learn

**Cost:** Free (unlimited bandwidth and requests)

**Use Case:** Choose if you expect high traffic or want unlimited bandwidth.

---

### 2.4 Self-Hosted (VPS)

**Deployment Architecture:**
```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│ GitHub Repo │────▶│ CI/CD        │────▶│ VPS Server  │
└─────────────┘     │ (Actions or  │     │ (Nginx)     │
                    │  Jenkins)    │     └─────────────┘
                    └──────────────┘            │
                                                 ▼
                                        ┌─────────────────┐
                                        │ Users Access    │
                                        │ yourdomain.com  │
                                        └─────────────────┘
```

**Implementation:**
1. Provision VPS (DigitalOcean, Linode, AWS EC2, etc.)
2. Install Nginx or Apache
3. Set up CI/CD to build and deploy to VPS
4. Configure SSL with Let's Encrypt

#### Pros ✅
- **Full control** - complete server access
- **No vendor lock-in** - can migrate easily
- **Custom server configuration** - install anything
- **Can add backend** - Node.js, database, etc.
- **Private by default** - not dependent on repository visibility

#### Cons ❌
- **Cost** - $5-$20/month minimum
- **Maintenance burden** - security updates, monitoring, backups
- **DevOps expertise required** - server management, SSL, etc.
- **Availability concerns** - must handle uptime, scaling
- **Complexity** - significantly more complex than static hosting
- **Overkill** - unnecessary for static site

**Cost:** $5-$20/month (minimum)

**Use Case:** Choose if you need backend functionality or complete control over infrastructure.

---

## 3. Comparison Matrix

| Feature                  | GitHub Pages | Netlify | Vercel | Cloudflare | Self-Hosted |
|-------------------------|--------------|---------|--------|------------|-------------|
| **Cost (Free Tier)**    | Free         | Free    | Free   | Free       | $5-20/mo    |
| **Bandwidth Limit**     | 100 GB/mo    | 100 GB/mo | 100 GB/mo | Unlimited | Server limit |
| **Build Time Limit**    | 6 hrs        | 300 min/mo | 6000 min/yr | 20 min | Unlimited   |
| **Custom Domain**       | Yes          | Yes     | Yes    | Yes        | Yes         |
| **Automatic HTTPS**     | Yes          | Yes     | Yes    | Yes        | Manual      |
| **Branch Previews**     | No           | Yes     | Yes    | Yes        | Manual      |
| **Setup Complexity**    | ⭐ Low       | ⭐ Low  | ⭐ Low | ⭐⭐ Medium | ⭐⭐⭐ High |
| **Maintenance**         | ⭐ None      | ⭐ None | ⭐ None | ⭐ None    | ⭐⭐⭐ High |
| **CDN Performance**     | ⭐⭐⭐ Good  | ⭐⭐⭐ Good | ⭐⭐⭐⭐ Excellent | ⭐⭐⭐⭐ Excellent | ⭐ Variable |
| **Vendor Lock-in**      | ⭐ Low       | ⭐⭐ Medium | ⭐⭐⭐ High | ⭐⭐ Medium | None |
| **Backend Support**     | No           | Functions | Functions | Workers | Yes         |
| **Analytics**           | Manual       | Paid    | Free   | Free       | Manual      |

---

## 4. Recommendation

### Primary Recommendation: **GitHub Pages**

**Rationale:**
1. **Best integration** - Already using GitHub for version control and CI/CD
2. **Zero cost** - No additional services or subscriptions
3. **Sufficient for use case** - Static game with no backend requirements
4. **Simple maintenance** - Automatic deployments, no service management
5. **Good performance** - CDN-backed with global distribution
6. **No vendor lock-in** - Easy to migrate to alternatives if needed

### When to Consider Alternatives

**Choose Netlify if:**
- You need branch preview deployments for testing PRs
- You plan to add serverless functions (e.g., leaderboard, user accounts)
- You want built-in form handling

**Choose Vercel if:**
- You want best-in-class developer experience
- You may migrate to Next.js framework in future
- You need detailed performance analytics

**Choose Cloudflare Pages if:**
- You expect very high traffic (>100 GB/month)
- You want privacy-focused built-in analytics
- You may need Workers for edge computing

**Choose Self-Hosted if:**
- You need a full backend (database, authentication, etc.)
- You require complete control over infrastructure
- Repository must remain private (and you don't have GitHub Pro)

---

## 5. Migration Strategy

If you need to migrate from GitHub Pages to another platform:

### Migration Checklist

1. **Update `vite.config.ts`:**
   ```typescript
   base: '/', // Change from '/your-repo-name/' to root
   ```

2. **Deploy to new platform** using their deployment process

3. **Test thoroughly** on new domain

4. **Update DNS** (if using custom domain):
   - Point CNAME to new hosting provider
   - Wait for DNS propagation (up to 48 hours)

5. **Keep GitHub Pages active** for transition period (1-2 weeks)

6. **Monitor** for issues during transition

7. **Deactivate GitHub Pages** once new deployment is stable

**Migration Time:** 1-2 hours (excluding DNS propagation)

---

## 6. Security Considerations

### Content Security Policy (CSP)

Add CSP headers to `index.html` for enhanced security:

```html
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'self'; 
               script-src 'self' 'unsafe-inline'; 
               style-src 'self' 'unsafe-inline'; 
               img-src 'self' data:;">
```

**Note:** GitHub Pages doesn't support custom headers, but this will work on other platforms.

### HTTPS

All recommended platforms provide automatic HTTPS:
- GitHub Pages: Automatic with Let's Encrypt
- Netlify: Automatic with Let's Encrypt
- Vercel: Automatic with Let's Encrypt
- Cloudflare: Automatic with Cloudflare SSL

### Dependency Security

- **Dependabot** (already configured via GitHub): Automatic security updates
- **npm audit**: Run `npm audit` regularly to check for vulnerabilities
- **Lock file**: Keep `package-lock.json` committed for reproducible builds

---

## 7. Monitoring and Analytics

### Options

1. **Google Analytics** (Free):
   ```html
   <!-- Add to index.html -->
   <script async src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID"></script>
   <script>
     window.dataLayer = window.dataLayer || [];
     function gtag(){dataLayer.push(arguments);}
     gtag('js', new Date());
     gtag('config', 'GA_MEASUREMENT_ID');
   </script>
   ```

2. **Plausible Analytics** (Privacy-focused, open source):
   - Self-hostable or cloud service ($9/month)
   - GDPR compliant, no cookies
   - Simple script tag integration

3. **Cloudflare Web Analytics** (Free):
   - Privacy-focused, if using Cloudflare Pages
   - No impact on page performance
   - No personal data collected

4. **Simple server logs** (Self-hosted only):
   - Nginx/Apache access logs
   - Analyze with GoAccess or similar

### Recommended Metrics

- Page views
- Unique visitors
- Session duration
- Bounce rate
- Device types (desktop vs. mobile)
- Geographic distribution

---

## 8. Future Considerations

### Progressive Web App (PWA)

Consider adding PWA features:
- **Service Worker**: Offline gameplay
- **App Manifest**: Install to home screen
- **Cache Strategy**: Fast loading on repeat visits

**Implementation:**
1. Create `manifest.json`
2. Add service worker with Workbox
3. Cache game assets and game state
4. Update `index.html` with manifest link

### Multiplayer Backend

If adding multiplayer in the future:
- **Serverless Functions**: Netlify Functions, Vercel Functions, or Cloudflare Workers
- **Real-time Backend**: Firebase, Supabase, or Pusher
- **WebSocket Service**: Socket.io with serverless adapter
- **Self-hosted**: Node.js server with WebSocket support

This would require migrating from pure static hosting to a platform with backend support.

---

## 9. Conclusion

**GitHub Pages is the recommended deployment solution** for Quortex because it:
- Integrates seamlessly with existing GitHub workflow
- Costs nothing for public repositories
- Requires minimal configuration
- Provides good performance via CDN
- Simplifies maintenance with automatic deployments

The static nature of the game (client-side only, no backend) makes it ideal for static hosting platforms. GitHub Pages provides the best balance of simplicity, cost, and performance for this use case.

Alternative platforms like Netlify, Vercel, or Cloudflare Pages offer additional features (branch previews, serverless functions, unlimited bandwidth) but add complexity and external dependencies that aren't necessary for the current implementation.

**Start with GitHub Pages.** You can easily migrate to another platform if requirements change in the future (e.g., adding multiplayer, leaderboards, or user accounts).

---

## Appendix A: Complete Deployment Commands

```bash
# 1. Create vite.config.ts (if not exists)
cat > vite.config.ts << 'EOF'
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/your-repo-name/', // Replace with your repository name
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    minify: 'terser',
  },
});
EOF

# 2. Create GitHub Actions workflow
mkdir -p .github/workflows
cat > .github/workflows/deploy.yml << 'EOF'
# [Full workflow content from Section 1.2 Step 2]
EOF

# 3. Commit and push
git add vite.config.ts .github/workflows/deploy.yml
git commit -m "Add GitHub Pages deployment configuration"
git push origin main

# 4. Enable GitHub Pages in repository settings
# (Done via GitHub web UI: Settings → Pages → Source: GitHub Actions)

# 5. Wait for deployment
# Check: https://github.com/username/your-repo-name/actions

# 6. Access site
# URL: https://username.github.io/your-repo-name/
```

---

## Appendix B: Troubleshooting

### Issue: Assets not loading (404 errors)

**Cause:** Incorrect `base` path in `vite.config.ts`

**Solution:**
```typescript
// For GitHub Pages with repository name
base: '/your-repo-name/', // Must match repository name

// For custom domain or root deployment
base: '/',
```

### Issue: Workflow fails on test step

**Cause:** Tests failing or missing test configuration

**Solution:**
1. Run tests locally: `npm test`
2. Fix failing tests
3. Or remove test step from workflow if not needed (not recommended)

### Issue: Page shows 404 after deployment

**Cause:** GitHub Pages not properly configured

**Solution:**
1. Go to repository Settings → Pages
2. Verify Source is set to "GitHub Actions"
3. Check workflow logs for errors

### Issue: CNAME file deleted after deployment

**Cause:** Build output overwrites repository root

**Solution:**
1. Add `CNAME` file to `public/` directory (Vite copies this to `dist/`)
2. Or configure in GitHub Pages settings (Settings → Pages → Custom domain)

---

## Appendix C: Performance Optimization

### Lighthouse Scores Target

- Performance: ≥90
- Accessibility: ≥90
- Best Practices: ≥90
- SEO: ≥80

### Optimization Checklist

- [x] Minification enabled
- [x] Gzip compression (via CDN)
- [ ] Code splitting for lazy loading
- [ ] Image optimization (if images added)
- [ ] Service worker for caching (PWA)
- [ ] Preload critical resources
- [ ] Font optimization (if custom fonts added)

### Current Performance

**Bundle Size:**
- Initial load: ~12 KB (gzipped)
- First Contentful Paint: <1s (on good connection)
- Time to Interactive: <1s (on good connection)

**Optimization Opportunities:**
1. Add code splitting for game logic vs. UI
2. Lazy load AI opponents when added
3. Consider WebAssembly for game logic (future optimization)

---

*Last Updated: 2025-11-02*
*Document Version: 1.0*
