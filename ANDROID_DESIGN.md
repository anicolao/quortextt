# Android Application Design for Quortex

## Executive Summary

This document outlines the architecture for wrapping the Quortex web implementation in a native Android application with multi-platform authentication (Google, Apple, Discord, Facebook) and a lightweight server backend using MongoDB for persistence.

**Key Features:**
- Native Android app wrapping existing web implementation
- Multi-platform authentication (Google, Apple Sign-In, Discord, Facebook)
- WebView-based game rendering with native performance optimization
- Real-time multiplayer using WebSocket
- Lightweight Node.js backend with MongoDB persistence
- Cloud save and cross-platform play
- Native Android features (notifications, sharing, deep linking)

**Architecture Approach:**
- **Android WebView** - Embed existing Vite app for rapid deployment
- **Native Authentication** - Platform-specific login flows
- **Hybrid Architecture** - Web rendering + native features
- **Centralized Backend** - Single server for all platforms (web, Android, future iOS)

**Related Documents:**
- [DESIGN_DOC.md](docs/designs/DESIGN_DOC.md) - Core game implementation
- [DISCORD_DESIGN.md](docs/designs/DISCORD_DESIGN.md) - Discord integration architecture
- [FACEBOOK_INTEGRATION.md](FACEBOOK_INTEGRATION.md) - Facebook integration design
- [RULES.md](docs/RULES.md) - Complete game rules

---

## 1. Platform Overview

### 1.1 Why Android?

**Market Reach:**
- 70%+ global smartphone market share
- Strong presence in emerging markets
- Google Play Store distribution
- Cross-device compatibility (phones, tablets, Chrome OS)

**Technical Advantages:**
- Reuse existing web codebase via WebView
- Native performance optimizations available
- Rich ecosystem for authentication SDKs
- Push notification support
- Deep linking for social features

**User Experience Benefits:**
- Native app launcher icon
- Offline capabilities (future)
- System integration (share sheet, etc.)
- Better performance than mobile web
- App store discovery

### 1.2 Technology Stack

**Android Application:**
- **Language:** Kotlin (modern, Google-recommended)
- **Minimum SDK:** API 24 (Android 7.0 Nougat) - 95%+ device coverage
- **Target SDK:** API 34 (Android 14)
- **Architecture:** MVVM (Model-View-ViewModel)
- **UI:** WebView (primary) + Jetpack Compose (native screens)
- **Dependency Injection:** Hilt
- **Networking:** Retrofit + OkHttp + Socket.IO client
- **Local Storage:** Room (SQLite wrapper) + SharedPreferences

**Authentication SDKs:**
- **Google Sign-In:** Google Identity Services SDK
- **Apple Sign-In:** Sign in with Apple (via web flow on Android)
- **Discord:** Discord OAuth2 (web flow)
- **Facebook:** Facebook Login SDK for Android

**Backend Server:**
- **Runtime:** Node.js 20+ or Bun
- **Framework:** Express.js or Fastify
- **Database:** MongoDB 7.0+
- **Real-time:** Socket.IO (WebSocket)
- **Authentication:** JWT tokens
- **Hosting:** Single Linux server (DigitalOcean, AWS, Google Cloud)

**Build & Distribution:**
- **Build System:** Gradle (Kotlin DSL)
- **CI/CD:** GitHub Actions
- **Distribution:** Google Play Store
- **Signing:** Android App Bundle (AAB) with Play App Signing

---

## 2. Architecture Overview

### 2.1 System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Android Application                         │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │              Activity Stack                             │    │
│  │                                                         │    │
│  │  ┌──────────────────────────────────────────────┐      │    │
│  │  │  SplashActivity (Native - Jetpack Compose)  │      │    │
│  │  │  - App initialization                        │      │    │
│  │  │  - Check authentication                      │      │    │
│  │  └──────────────────────────────────────────────┘      │    │
│  │                       │                                 │    │
│  │  ┌────────────────────▼───────────────────────┐        │    │
│  │  │  AuthActivity (Native - Jetpack Compose)   │        │    │
│  │  │  - Provider selection (Google/Apple/etc)   │        │    │
│  │  │  - Platform-specific login flows           │        │    │
│  │  │  - Token exchange with backend             │        │    │
│  │  └────────────────────────────────────────────┘        │    │
│  │                       │                                 │    │
│  │  ┌────────────────────▼───────────────────────┐        │    │
│  │  │  MainActivity (WebView Container)          │        │    │
│  │  │                                             │        │    │
│  │  │  ┌─────────────────────────────────┐       │        │    │
│  │  │  │      WebView (Quortex Game)     │       │        │    │
│  │  │  │  • Vite app from backend server │       │        │    │
│  │  │  │  • Canvas rendering             │       │        │    │
│  │  │  │  • Game logic                   │       │        │    │
│  │  │  │  • Touch input                  │       │        │    │
│  │  │  └─────────────────────────────────┘       │        │    │
│  │  │                                             │        │    │
│  │  │  JavaScript Bridge                          │        │    │
│  │  │  • Auth token injection                    │        │    │
│  │  │  • Native feature calls                    │        │    │
│  │  │  • Deep link handling                      │        │    │
│  │  └─────────────────────────────────────────────┘       │    │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │              Native Services                            │    │
│  │  • AuthenticationManager (multi-provider)              │    │
│  │  • WebSocketClient (Socket.IO)                         │    │
│  │  • NotificationService (Firebase Cloud Messaging)      │    │
│  │  • DeepLinkHandler (game invites, match links)         │    │
│  │  • ShareManager (native share sheet)                   │    │
│  └────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────┘
                             │
                    HTTPS + WebSocket
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              Backend Server (Node.js/Bun)                       │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │              Web Server (Express/Fastify)              │    │
│  │  • Serves Vite app (static files)                      │    │
│  │  • REST API endpoints                                  │    │
│  │  • WebSocket server (Socket.IO)                        │    │
│  │  • Authentication endpoints                            │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │           Authentication Service                        │    │
│  │  • Verify Google/Apple/Discord/Facebook tokens         │    │
│  │  • Issue JWT session tokens                            │    │
│  │  • User account management                             │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │              Game State Manager                         │    │
│  │  • Active games in memory                              │    │
│  │  • Player sessions (userId → gameId)                   │    │
│  │  • Real-time state sync via WebSocket                  │    │
│  │  • Game lifecycle management                           │    │
│  │  • Reuse existing game core (src/game/)                │    │
│  └────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    MongoDB Database                              │
│  Collections:                                                    │
│  • users (auth info, stats, preferences)                        │
│  • games (active and completed game states)                     │
│  • moves (move history for replays)                             │
│  • player_stats (wins, losses, achievements)                    │
│  • sessions (active JWT tokens)                                 │
└──────────────────────────────────────────────────────────────────┘
```

### 2.2 Data Flow

**App Launch Flow:**
1. User launches Android app
2. SplashActivity checks for saved authentication
3. If authenticated → Navigate to MainActivity (WebView)
4. If not authenticated → Navigate to AuthActivity
5. User selects auth provider (Google/Apple/Discord/Facebook)
6. Native SDK handles OAuth flow
7. Android app receives auth token
8. Exchange auth token with backend for JWT
9. Store JWT in SharedPreferences
10. Navigate to MainActivity with JWT
11. WebView loads game from backend server
12. JavaScript bridge injects JWT into web app
13. Web app establishes WebSocket connection
14. User can start/join games

**Multiplayer Game Flow:**
1. User creates/joins game in WebView
2. WebView calls native bridge method
3. Native code establishes WebSocket connection (if not already)
4. WebSocket sends game action to backend
5. Backend validates using game core logic
6. Backend updates MongoDB
7. Backend broadcasts state to all players via WebSocket
8. WebSocket sends update to native Android app
9. Native app forwards to WebView via JavaScript injection
10. WebView updates UI with new game state

---

## 3. Authentication Integration

### 3.1 Multi-Provider Authentication

**Supported Providers:**
1. **Google Sign-In** - Primary (most Android users have Google account)
2. **Apple Sign-In** - iOS users who play cross-platform
3. **Discord** - Gaming community integration
4. **Facebook** - Social gaming features

**Authentication Architecture:**

```kotlin
// AuthenticationManager.kt
sealed class AuthProvider {
    object Google : AuthProvider()
    object Apple : AuthProvider()
    object Discord : AuthProvider()
    object Facebook : AuthProvider()
}

data class AuthToken(
    val provider: AuthProvider,
    val accessToken: String,
    val idToken: String?,
    val userId: String
)

interface AuthenticationManager {
    suspend fun signIn(provider: AuthProvider): Result<AuthToken>
    suspend fun signOut()
    suspend fun getCurrentUser(): User?
    suspend fun isAuthenticated(): Boolean
}
```

### 3.2 Google Sign-In Implementation

**Setup:**
- Add Google Services JSON configuration
- Configure OAuth consent screen in Google Cloud Console
- Enable Google Sign-In API

**Implementation:**

```kotlin
// GoogleAuthProvider.kt
class GoogleAuthProvider(
    private val context: Context
) : AuthProvider {
    
    private val oneTapClient: SignInClient by lazy {
        Identity.getSignInClient(context)
    }
    
    suspend fun signIn(): Result<AuthToken> = withContext(Dispatchers.IO) {
        try {
            val result = oneTapClient.beginSignIn(
                BeginSignInRequest.builder()
                    .setGoogleIdTokenRequestOptions(
                        GoogleIdTokenRequestOptions.builder()
                            .setSupported(true)
                            .setServerClientId(BuildConfig.GOOGLE_WEB_CLIENT_ID)
                            .setFilterByAuthorizedAccounts(false)
                            .build()
                    )
                    .build()
            ).await()
            
            // Launch sign-in UI
            val credential = oneTapClient.getSignInCredentialFromIntent(result.pendingIntent)
            val idToken = credential.googleIdToken
            
            if (idToken == null) {
                Result.failure(Exception("No ID token received"))
            } else {
                // Exchange with backend
                val authToken = backendService.exchangeGoogleToken(idToken)
                Result.success(authToken)
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
```

**Backend Token Verification:**

```typescript
// backend/src/auth/google.ts
import { OAuth2Client } from 'google-auth-library';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export async function verifyGoogleToken(idToken: string): Promise<UserInfo> {
    const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
    });
    
    const payload = ticket.getPayload();
    
    if (!payload) {
        throw new Error('Invalid token');
    }
    
    return {
        provider: 'google',
        providerId: payload.sub,
        email: payload.email,
        name: payload.name,
        picture: payload.picture,
    };
}
```

### 3.3 Apple Sign-In Implementation

**Setup:**
- Configure Sign in with Apple in Apple Developer Portal
- Add associated domain for web authentication

**Implementation (Web-based OAuth on Android):**

```kotlin
// AppleAuthProvider.kt
class AppleAuthProvider(
    private val context: Context
) : AuthProvider {
    
    suspend fun signIn(): Result<AuthToken> = withContext(Dispatchers.IO) {
        try {
            // Use web-based OAuth flow
            val authUrl = buildAppleAuthUrl()
            
            // Launch Chrome Custom Tab for OAuth
            val result = launchOAuthFlow(authUrl)
            
            // Extract authorization code from redirect
            val authCode = extractAuthCode(result.redirectUri)
            
            // Exchange with backend
            val authToken = backendService.exchangeAppleAuthCode(authCode)
            Result.success(authToken)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    private fun buildAppleAuthUrl(): String {
        return "https://appleid.apple.com/auth/authorize?" +
            "client_id=${BuildConfig.APPLE_CLIENT_ID}" +
            "&redirect_uri=${BuildConfig.APPLE_REDIRECT_URI}" +
            "&response_type=code" +
            "&scope=name email" +
            "&response_mode=form_post"
    }
}
```

**Backend Token Verification:**

```typescript
// backend/src/auth/apple.ts
import { verify } from 'jsonwebtoken';
import fetch from 'node-fetch';

export async function verifyAppleAuthCode(authCode: string): Promise<UserInfo> {
    // Exchange auth code for tokens
    const response = await fetch('https://appleid.apple.com/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: process.env.APPLE_CLIENT_ID!,
            client_secret: generateAppleClientSecret(),
            code: authCode,
            grant_type: 'authorization_code',
        }),
    });
    
    const data = await response.json();
    
    // Verify ID token
    const decoded = verify(data.id_token, getApplePublicKey(), {
        algorithms: ['RS256'],
        audience: process.env.APPLE_CLIENT_ID,
        issuer: 'https://appleid.apple.com',
    });
    
    return {
        provider: 'apple',
        providerId: decoded.sub,
        email: decoded.email,
        name: decoded.name || 'Apple User',
    };
}
```

### 3.4 Discord OAuth Implementation

**Setup:**
- Create Discord Application in Developer Portal
- Configure OAuth2 redirect URIs

**Implementation:**

```kotlin
// DiscordAuthProvider.kt
class DiscordAuthProvider(
    private val context: Context
) : AuthProvider {
    
    suspend fun signIn(): Result<AuthToken> = withContext(Dispatchers.IO) {
        try {
            val authUrl = buildDiscordAuthUrl()
            
            // Launch Chrome Custom Tab
            val result = launchOAuthFlow(authUrl)
            
            // Extract authorization code
            val authCode = extractAuthCode(result.redirectUri)
            
            // Exchange with backend
            val authToken = backendService.exchangeDiscordAuthCode(authCode)
            Result.success(authToken)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    private fun buildDiscordAuthUrl(): String {
        return "https://discord.com/api/oauth2/authorize?" +
            "client_id=${BuildConfig.DISCORD_CLIENT_ID}" +
            "&redirect_uri=${BuildConfig.DISCORD_REDIRECT_URI}" +
            "&response_type=code" +
            "&scope=identify email"
    }
}
```

**Backend Token Exchange:**

```typescript
// backend/src/auth/discord.ts
export async function verifyDiscordAuthCode(authCode: string): Promise<UserInfo> {
    // Exchange auth code for access token
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: process.env.DISCORD_CLIENT_ID!,
            client_secret: process.env.DISCORD_CLIENT_SECRET!,
            code: authCode,
            grant_type: 'authorization_code',
            redirect_uri: process.env.DISCORD_REDIRECT_URI!,
        }),
    });
    
    const { access_token } = await tokenResponse.json();
    
    // Get user info
    const userResponse = await fetch('https://discord.com/api/users/@me', {
        headers: { 'Authorization': `Bearer ${access_token}` },
    });
    
    const user = await userResponse.json();
    
    return {
        provider: 'discord',
        providerId: user.id,
        email: user.email,
        name: user.username,
        picture: `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`,
    };
}
```

### 3.5 Facebook Login Implementation

**Setup:**
- Create Facebook App in Meta Developer Portal
- Add Facebook SDK to Android app

**Implementation:**

```kotlin
// FacebookAuthProvider.kt
class FacebookAuthProvider(
    private val context: Context
) : AuthProvider {
    
    private val callbackManager = CallbackManager.Factory.create()
    private val loginManager = LoginManager.getInstance()
    
    suspend fun signIn(): Result<AuthToken> = suspendCancellableCoroutine { continuation ->
        loginManager.registerCallback(callbackManager, object : FacebookCallback<LoginResult> {
            override fun onSuccess(result: LoginResult) {
                val accessToken = result.accessToken.token
                
                // Exchange with backend
                lifecycleScope.launch {
                    try {
                        val authToken = backendService.exchangeFacebookToken(accessToken)
                        continuation.resume(Result.success(authToken))
                    } catch (e: Exception) {
                        continuation.resume(Result.failure(e))
                    }
                }
            }
            
            override fun onCancel() {
                continuation.resume(Result.failure(Exception("Login cancelled")))
            }
            
            override fun onError(error: FacebookException) {
                continuation.resume(Result.failure(error))
            }
        })
        
        loginManager.logInWithReadPermissions(
            activity,
            listOf("public_profile", "email")
        )
    }
}
```

**Backend Token Verification:**

```typescript
// backend/src/auth/facebook.ts
export async function verifyFacebookToken(accessToken: string): Promise<UserInfo> {
    // Verify token with Facebook
    const response = await fetch(
        `https://graph.facebook.com/me?fields=id,name,email,picture&access_token=${accessToken}`
    );
    
    const data = await response.json();
    
    if (data.error) {
        throw new Error('Invalid Facebook token');
    }
    
    return {
        provider: 'facebook',
        providerId: data.id,
        email: data.email,
        name: data.name,
        picture: data.picture?.data?.url,
    };
}
```

### 3.6 Unified Backend Authentication

**JWT Token Issuance:**

```typescript
// backend/src/auth/jwt.ts
import jwt from 'jsonwebtoken';

interface JWTPayload {
    userId: string;
    provider: string;
    email: string;
}

export function issueJWT(userInfo: UserInfo, dbUserId: string): string {
    const payload: JWTPayload = {
        userId: dbUserId,
        provider: userInfo.provider,
        email: userInfo.email,
    };
    
    return jwt.sign(payload, process.env.JWT_SECRET!, {
        expiresIn: '30d',
        issuer: 'quortex-backend',
    });
}

export function verifyJWT(token: string): JWTPayload {
    return jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;
}
```

**Authentication Endpoint:**

```typescript
// backend/src/routes/auth.ts
router.post('/auth/:provider/exchange', async (req, res) => {
    const { provider } = req.params;
    const { token, authCode } = req.body;
    
    try {
        let userInfo: UserInfo;
        
        // Verify token with respective provider
        switch (provider) {
            case 'google':
                userInfo = await verifyGoogleToken(token);
                break;
            case 'apple':
                userInfo = await verifyAppleAuthCode(authCode);
                break;
            case 'discord':
                userInfo = await verifyDiscordAuthCode(authCode);
                break;
            case 'facebook':
                userInfo = await verifyFacebookToken(token);
                break;
            default:
                return res.status(400).json({ error: 'Invalid provider' });
        }
        
        // Find or create user in MongoDB
        const user = await findOrCreateUser(userInfo);
        
        // Issue JWT
        const jwtToken = issueJWT(userInfo, user._id.toString());
        
        res.json({
            token: jwtToken,
            userId: user._id,
            username: user.name,
            provider: userInfo.provider,
        });
    } catch (error) {
        res.status(401).json({ error: 'Authentication failed' });
    }
});
```

---

## 4. Android Application Architecture

### 4.1 WebView Container

**MainActivity - WebView Host:**

```kotlin
// MainActivity.kt
class MainActivity : ComponentActivity() {
    
    private lateinit var webView: WebView
    private lateinit var jsBridge: JavaScriptBridge
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        setContent {
            QuortexTheme {
                WebViewContainer(
                    onWebViewCreated = { webView ->
                        this.webView = webView
                        setupWebView()
                    }
                )
            }
        }
        
        handleDeepLink(intent)
    }
    
    private fun setupWebView() {
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            allowFileAccess = false
            allowContentAccess = false
            
            // Performance optimizations
            cacheMode = WebSettings.LOAD_DEFAULT
            setRenderPriority(WebSettings.RenderPriority.HIGH)
            
            // Enable hardware acceleration
            setLayerType(View.LAYER_TYPE_HARDWARE, null)
        }
        
        // Inject JavaScript bridge
        jsBridge = JavaScriptBridge(this)
        webView.addJavascriptInterface(jsBridge, "Android")
        
        // Custom WebViewClient for URL handling
        webView.webViewClient = QuortexWebViewClient()
        
        // Custom WebChromeClient for console logs
        webView.webChromeClient = QuortexWebChromeClient()
        
        // Load game from backend server
        val jwt = getAuthToken()
        val gameUrl = "${BuildConfig.BACKEND_URL}/?jwt=$jwt&platform=android"
        webView.loadUrl(gameUrl)
    }
}
```

**WebView Configuration:**

```kotlin
// QuortexWebViewClient.kt
class QuortexWebViewClient : WebViewClient() {
    
    override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
        // Handle deep links
        if (request.url.scheme == "quortex") {
            handleDeepLink(request.url)
            return true
        }
        
        // Allow navigation within game domain
        if (request.url.host == BuildConfig.BACKEND_HOST) {
            return false
        }
        
        // Open external links in browser
        Intent(Intent.ACTION_VIEW, request.url).also { intent ->
            view.context.startActivity(intent)
        }
        return true
    }
    
    override fun onPageFinished(view: WebView, url: String) {
        super.onPageFinished(view, url)
        
        // Inject authentication token
        injectAuthToken(view)
    }
    
    private fun injectAuthToken(view: WebView) {
        val jwt = getAuthToken()
        view.evaluateJavascript(
            """
            window.quortexAndroid = {
                authToken: '$jwt',
                platform: 'android',
                version: '${BuildConfig.VERSION_NAME}'
            };
            """.trimIndent(),
            null
        )
    }
}
```

### 4.2 JavaScript Bridge

**Native ↔ WebView Communication:**

```kotlin
// JavaScriptBridge.kt
class JavaScriptBridge(
    private val activity: MainActivity
) {
    
    @JavascriptInterface
    fun getAuthToken(): String {
        return activity.getAuthToken()
    }
    
    @JavascriptInterface
    fun shareGame(title: String, text: String, url: String) {
        activity.runOnUiThread {
            val shareIntent = Intent().apply {
                action = Intent.ACTION_SEND
                type = "text/plain"
                putExtra(Intent.EXTRA_SUBJECT, title)
                putExtra(Intent.EXTRA_TEXT, "$text\n$url")
            }
            activity.startActivity(Intent.createChooser(shareIntent, "Share Game"))
        }
    }
    
    @JavascriptInterface
    fun openExternalUrl(url: String) {
        activity.runOnUiThread {
            Intent(Intent.ACTION_VIEW, Uri.parse(url)).also { intent ->
                activity.startActivity(intent)
            }
        }
    }
    
    @JavascriptInterface
    fun vibrate(duration: Long) {
        val vibrator = activity.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            vibrator.vibrate(VibrationEffect.createOneShot(duration, VibrationEffect.DEFAULT_AMPLITUDE))
        } else {
            @Suppress("DEPRECATION")
            vibrator.vibrate(duration)
        }
    }
    
    @JavascriptInterface
    fun requestNotificationPermission(callback: String) {
        activity.runOnUiThread {
            // Request notification permission (Android 13+)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                activity.requestPermissionLauncher.launch(
                    android.Manifest.permission.POST_NOTIFICATIONS
                ) { granted ->
                    activity.webView.evaluateJavascript(
                        "$callback($granted)",
                        null
                    )
                }
            } else {
                // Notifications enabled by default on older versions
                activity.webView.evaluateJavascript("$callback(true)", null)
            }
        }
    }
}
```

**JavaScript Side (Web App):**

```typescript
// src/android/bridge.ts
interface AndroidBridge {
    getAuthToken(): string;
    shareGame(title: string, text: string, url: string): void;
    openExternalUrl(url: string): void;
    vibrate(duration: number): void;
    requestNotificationPermission(callback: string): void;
}

declare global {
    interface Window {
        Android?: AndroidBridge;
        quortexAndroid?: {
            authToken: string;
            platform: string;
            version: string;
        };
    }
}

export function isAndroid(): boolean {
    return typeof window.Android !== 'undefined';
}

export function getAuthToken(): string | null {
    if (isAndroid() && window.quortexAndroid) {
        return window.quortexAndroid.authToken;
    }
    return null;
}

export function shareGame(title: string, text: string, url: string): void {
    if (isAndroid() && window.Android) {
        window.Android.shareGame(title, text, url);
    } else {
        // Fallback to Web Share API
        if (navigator.share) {
            navigator.share({ title, text, url });
        }
    }
}

export function vibrateDevice(duration: number = 50): void {
    if (isAndroid() && window.Android) {
        window.Android.vibrate(duration);
    } else if (navigator.vibrate) {
        navigator.vibrate(duration);
    }
}
```

### 4.3 Native Feature Integration

**Push Notifications (Firebase Cloud Messaging):**

```kotlin
// QuortexFirebaseMessagingService.kt
class QuortexFirebaseMessagingService : FirebaseMessagingService() {
    
    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        // Handle different notification types
        when (remoteMessage.data["type"]) {
            "turn_notification" -> handleTurnNotification(remoteMessage)
            "game_invite" -> handleGameInvite(remoteMessage)
            "game_ended" -> handleGameEnded(remoteMessage)
        }
    }
    
    private fun handleTurnNotification(message: RemoteMessage) {
        val gameId = message.data["gameId"] ?: return
        val playerName = message.data["playerName"] ?: "Opponent"
        
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            putExtra("gameId", gameId)
        }
        
        val pendingIntent = PendingIntent.getActivity(
            this, 0, intent, PendingIntent.FLAG_IMMUTABLE
        )
        
        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_quortex_logo)
            .setContentTitle("Your Turn!")
            .setContentText("$playerName made their move in Quortex")
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .build()
        
        NotificationManagerCompat.from(this).notify(gameId.hashCode(), notification)
    }
    
    override fun onNewToken(token: String) {
        // Send FCM token to backend
        lifecycleScope.launch {
            backendService.updateFCMToken(token)
        }
    }
}
```

**Deep Linking:**

```kotlin
// AndroidManifest.xml configuration
<activity
    android:name=".MainActivity"
    android:exported="true">
    <intent-filter>
        <action android:name="android.intent.action.VIEW" />
        <category android:name="android.intent.category.DEFAULT" />
        <category android:name="android.intent.category.BROWSABLE" />
        
        <!-- Deep link for game invites -->
        <data
            android:scheme="quortex"
            android:host="game" />
        
        <!-- App Links (HTTPS) -->
        <data
            android:scheme="https"
            android:host="play.quortex.com"
            android:pathPrefix="/game" />
    </intent-filter>
</activity>

// Deep link handling
fun handleDeepLink(intent: Intent) {
    val uri = intent.data ?: return
    
    when {
        uri.scheme == "quortex" && uri.host == "game" -> {
            // quortex://game?id=<gameId>
            val gameId = uri.getQueryParameter("id")
            joinGame(gameId)
        }
        uri.scheme == "https" && uri.path?.startsWith("/game") == true -> {
            // https://play.quortex.com/game/<gameId>
            val gameId = uri.lastPathSegment
            joinGame(gameId)
        }
    }
}
```

---

## 5. Backend Server Architecture

### 5.1 MongoDB Data Model

**Database Schema:**

```typescript
// backend/src/models/User.ts
interface User {
    _id: ObjectId;
    
    // Authentication
    provider: 'google' | 'apple' | 'discord' | 'facebook';
    providerId: string;        // Provider's user ID
    email: string;
    name: string;
    picture?: string;
    
    // Game stats
    gamesPlayed: number;
    gamesWon: number;
    currentStreak: number;
    longestStreak: number;
    
    // Preferences
    preferences: {
        notifications: boolean;
        soundEnabled: boolean;
        theme: string;
    };
    
    // FCM token for push notifications
    fcmToken?: string;
    
    // Timestamps
    createdAt: Date;
    lastActive: Date;
}

// MongoDB indexes
db.users.createIndex({ provider: 1, providerId: 1 }, { unique: true });
db.users.createIndex({ email: 1 });
db.users.createIndex({ lastActive: -1 });
```

```typescript
// backend/src/models/Game.ts
interface Game {
    _id: ObjectId;
    gameId: string;            // UUID for easy sharing
    
    // Game configuration
    playerCount: number;
    gameType: 'quick' | 'private' | 'ranked';
    
    // Players
    players: Array<{
        userId: ObjectId;
        playerIndex: number;   // 0-5
        color: string;
        edge: number;          // 0-5
        isAI: boolean;
    }>;
    
    teams: Array<{
        player1Id: ObjectId;
        player2Id: ObjectId;
    }>;
    
    // Game state (from existing src/game/ types)
    currentPlayerIndex: number;
    board: {                   // Map serialized as object
        [key: string]: {       // "row,col"
            type: number;      // TileType
            rotation: number;  // 0-5
        };
    };
    availableTiles: number[];  // Array of TileType
    currentTile: number | null;
    flows: {                   // Map serialized as object
        [playerId: string]: string[];  // Array of "row,col"
    };
    
    // Game status
    phase: 'lobby' | 'seating' | 'playing' | 'finished';
    winner: ObjectId | null;
    winType: 'flow' | 'constraint' | 'tie' | null;
    
    // Timestamps
    createdAt: Date;
    startedAt: Date | null;
    completedAt: Date | null;
    lastMoveAt: Date;
}

// MongoDB indexes
db.games.createIndex({ gameId: 1 }, { unique: true });
db.games.createIndex({ phase: 1 });
db.games.createIndex({ 'players.userId': 1 });
db.games.createIndex({ lastMoveAt: -1 });
```

```typescript
// backend/src/models/Move.ts
interface Move {
    _id: ObjectId;
    gameId: string;
    userId: ObjectId;
    moveNumber: number;
    
    // Move details
    tileType: number;
    rotation: number;
    position: {
        row: number;
        col: number;
    };
    
    // Timing
    duration: number;          // Milliseconds taken
    timestamp: Date;
}

// MongoDB indexes
db.moves.createIndex({ gameId: 1, moveNumber: 1 });
db.moves.createIndex({ userId: 1 });
```

### 5.2 REST API Endpoints

```typescript
// backend/src/routes/index.ts

// Authentication
POST   /api/auth/:provider/exchange    // Exchange provider token for JWT
POST   /api/auth/refresh               // Refresh JWT token
POST   /api/auth/signout               // Invalidate session
GET    /api/auth/me                    // Get current user info

// User Management
GET    /api/users/:userId              // Get user profile
PUT    /api/users/:userId              // Update user profile
GET    /api/users/:userId/stats        // Get user statistics
POST   /api/users/fcm-token            // Update FCM token

// Game Management
POST   /api/games                      // Create new game
GET    /api/games/:gameId              // Get game state
POST   /api/games/:gameId/join         // Join game
POST   /api/games/:gameId/leave        // Leave game
GET    /api/games/active               // Get user's active games
GET    /api/games/history              // Get user's game history

// Matchmaking
POST   /api/matchmaking/quick          // Quick match with anyone
POST   /api/matchmaking/private        // Create private game
GET    /api/matchmaking/invites        // Get pending invites

// Leaderboards
GET    /api/leaderboards/global        // Global leaderboard
GET    /api/leaderboards/friends       // Friends leaderboard

// Static Assets
GET    /                               // Serve Vite app
GET    /assets/*                       // Serve static assets
```

### 5.3 WebSocket Protocol (Socket.IO)

```typescript
// backend/src/websocket/events.ts

// Client → Server Events
interface ClientEvents {
    authenticate: (token: string) => void;
    join_game: (gameId: string) => void;
    leave_game: (gameId: string) => void;
    select_edge: (edge: number) => void;
    place_tile: (position: HexPosition, rotation: number) => void;
    request_rematch: () => void;
}

// Server → Client Events
interface ServerEvents {
    authenticated: (userId: string) => void;
    game_state: (state: GameState) => void;
    player_joined: (player: Player) => void;
    player_left: (playerId: string) => void;
    move_made: (move: Move) => void;
    game_over: (result: GameResult) => void;
    error: (message: string) => void;
}
```

**WebSocket Server Implementation:**

```typescript
// backend/src/websocket/server.ts
import { Server } from 'socket.io';
import { verifyJWT } from '../auth/jwt';
import { GameStateManager } from '../game/manager';

export function setupWebSocket(io: Server) {
    const gameManager = new GameStateManager();
    
    io.on('connection', (socket) => {
        let userId: string | null = null;
        let currentGameId: string | null = null;
        
        socket.on('authenticate', async (token: string) => {
            try {
                const payload = verifyJWT(token);
                userId = payload.userId;
                socket.emit('authenticated', userId);
            } catch (error) {
                socket.emit('error', 'Authentication failed');
                socket.disconnect();
            }
        });
        
        socket.on('join_game', async (gameId: string) => {
            if (!userId) {
                return socket.emit('error', 'Not authenticated');
            }
            
            try {
                await gameManager.addPlayer(gameId, userId);
                currentGameId = gameId;
                
                // Join Socket.IO room
                socket.join(gameId);
                
                // Broadcast to all players in game
                const gameState = await gameManager.getGameState(gameId);
                io.to(gameId).emit('game_state', gameState);
            } catch (error) {
                socket.emit('error', error.message);
            }
        });
        
        socket.on('place_tile', async (position, rotation) => {
            if (!userId || !currentGameId) {
                return socket.emit('error', 'Not in a game');
            }
            
            try {
                // Validate and apply move
                await gameManager.placeTile(currentGameId, userId, position, rotation);
                
                // Broadcast updated state
                const gameState = await gameManager.getGameState(currentGameId);
                io.to(currentGameId).emit('game_state', gameState);
                
                // Check for game over
                if (gameState.phase === 'finished') {
                    io.to(currentGameId).emit('game_over', {
                        winner: gameState.winner,
                        winType: gameState.winType,
                    });
                    
                    // Send push notifications to other players
                    await sendGameOverNotifications(currentGameId, gameState);
                }
            } catch (error) {
                socket.emit('error', error.message);
            }
        });
        
        socket.on('disconnect', () => {
            if (userId && currentGameId) {
                gameManager.handleDisconnect(currentGameId, userId);
            }
        });
    });
}
```

**Game State Manager (Reuses Existing Game Core):**

```typescript
// backend/src/game/manager.ts
import { 
    GameState, 
    PlacedTile, 
    isLegalMove, 
    calculateFlows, 
    checkVictory 
} from '../../src/game';  // Import from existing game core

export class GameStateManager {
    private activeGames: Map<string, GameState> = new Map();
    private gameLocks: Map<string, Promise<void>> = new Map();
    
    async placeTile(
        gameId: string, 
        userId: string, 
        position: HexPosition, 
        rotation: number
    ): Promise<void> {
        return this.withLock(gameId, async () => {
            const game = await this.loadGame(gameId);
            
            // Validate turn
            const currentPlayer = game.players[game.currentPlayerIndex];
            if (currentPlayer.id !== userId) {
                throw new Error('Not your turn');
            }
            
            // Create tile object
            const tile: PlacedTile = {
                type: game.currentTile!,
                rotation,
                position,
            };
            
            // Validate using existing game logic
            if (!isLegalMove(game.board, tile, game.players, game.teams)) {
                throw new Error('Illegal move');
            }
            
            // Apply move
            game.board.set(`${position.row},${position.col}`, tile);
            
            // Update flows using existing logic
            game.flows = calculateFlows(game.board, game.players);
            
            // Check victory using existing logic
            const victoryResult = checkVictory(
                game.board, 
                game.flows, 
                game.players, 
                game.teams
            );
            
            if (victoryResult.winner) {
                game.winner = victoryResult.winner;
                game.winType = victoryResult.winType;
                game.phase = 'finished';
                game.completedAt = new Date();
            } else {
                // Next player
                game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.players.length;
                game.currentTile = game.availableTiles.pop() || null;
            }
            
            game.lastMoveAt = new Date();
            
            // Save to MongoDB
            await this.saveGame(game);
            
            // Save move history
            await this.saveMove(gameId, userId, tile);
        });
    }
    
    private async withLock<T>(gameId: string, fn: () => Promise<T>): Promise<T> {
        // Wait for existing lock
        while (this.gameLocks.has(gameId)) {
            await this.gameLocks.get(gameId);
        }
        
        // Acquire lock
        let release: () => void;
        const lock = new Promise<void>(resolve => { release = resolve; });
        this.gameLocks.set(gameId, lock);
        
        try {
            return await fn();
        } finally {
            this.gameLocks.delete(gameId);
            release!();
        }
    }
}
```

---

## 6. Deployment Architecture

### 6.1 Server Setup

**Technology Stack:**
- **OS:** Ubuntu 22.04 LTS
- **Runtime:** Node.js 20+ or Bun
- **Database:** MongoDB 7.0+
- **Reverse Proxy:** Nginx
- **Process Manager:** PM2
- **SSL:** Let's Encrypt

**Server Requirements:**
- 2 vCPU, 4GB RAM (handles ~50 concurrent games)
- 20GB SSD storage
- Public IP with ports 80, 443, 8080
- Estimated cost: $10-20/month (DigitalOcean, Hetzner, Linode)

**Directory Structure:**

```
/opt/quortex/
├── backend/
│   ├── dist/                  # Compiled TypeScript
│   ├── src/                   # Backend source code
│   ├── node_modules/
│   ├── package.json
│   └── .env                   # Environment variables
├── frontend/
│   ├── dist/                  # Built Vite app (served by backend)
│   └── (existing repo)
└── nginx/
    └── quortex.conf           # Nginx configuration
```

**Environment Variables:**

```bash
# /opt/quortex/backend/.env
NODE_ENV=production
PORT=3000
WS_PORT=8080

# MongoDB
MONGODB_URI=mongodb://localhost:27017/quortex

# JWT
JWT_SECRET=<random-secret-key>

# Google OAuth
GOOGLE_CLIENT_ID=<client-id>
GOOGLE_WEB_CLIENT_ID=<web-client-id>

# Apple Sign-In
APPLE_CLIENT_ID=<client-id>
APPLE_TEAM_ID=<team-id>
APPLE_KEY_ID=<key-id>
APPLE_PRIVATE_KEY=<private-key>

# Discord OAuth
DISCORD_CLIENT_ID=<client-id>
DISCORD_CLIENT_SECRET=<client-secret>

# Facebook Login
FACEBOOK_APP_ID=<app-id>
FACEBOOK_APP_SECRET=<app-secret>

# Firebase Cloud Messaging
FCM_SERVER_KEY=<server-key>

# Backend URL
BACKEND_URL=https://api.quortex.com
```

**Nginx Configuration:**

```nginx
# /etc/nginx/sites-available/quortex
server {
    listen 80;
    server_name api.quortex.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.quortex.com;
    
    ssl_certificate /etc/letsencrypt/live/api.quortex.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.quortex.com/privkey.pem;
    
    # Serve Vite app (static files)
    location / {
        root /opt/quortex/frontend/dist;
        try_files $uri $uri/ /index.html;
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
    
    # REST API
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # WebSocket
    location /socket.io/ {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

**PM2 Configuration:**

```javascript
// /opt/quortex/backend/ecosystem.config.js
module.exports = {
    apps: [{
        name: 'quortex-backend',
        script: './dist/index.js',
        instances: 2,
        exec_mode: 'cluster',
        env: {
            NODE_ENV: 'production'
        },
        error_file: '/var/log/quortex/error.log',
        out_file: '/var/log/quortex/out.log',
        log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
        merge_logs: true,
        autorestart: true,
        max_restarts: 10,
        min_uptime: '10s'
    }]
};
```

### 6.2 Android App Distribution

**Google Play Store Setup:**

1. **Developer Account:**
   - Create Google Play Developer account ($25 one-time fee)
   - Set up merchant account (for IAP, if needed)

2. **App Listing:**
   - App name: Quortex
   - Category: Puzzle / Board
   - Content rating: Everyone
   - Screenshots: 4-8 images (phone + tablet)
   - Feature graphic: 1024x500
   - App icon: 512x512

3. **Build Configuration:**

```groovy
// app/build.gradle.kts
android {
    defaultConfig {
        applicationId = "com.quortex.android"
        minSdk = 24
        targetSdk = 34
        versionCode = 1
        versionName = "1.0.0"
    }
    
    signingConfigs {
        create("release") {
            storeFile = file(System.getenv("KEYSTORE_FILE") ?: "release.keystore")
            storePassword = System.getenv("KEYSTORE_PASSWORD")
            keyAlias = System.getenv("KEY_ALIAS")
            keyPassword = System.getenv("KEY_PASSWORD")
        }
    }
    
    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            signingConfig = signingConfigs.getByName("release")
        }
    }
}
```

4. **GitHub Actions CI/CD:**

```yaml
# .github/workflows/android-release.yml
name: Android Release

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up JDK 17
        uses: actions/setup-java@v3
        with:
          distribution: 'temurin'
          java-version: '17'
      
      - name: Decode keystore
        run: |
          echo "${{ secrets.KEYSTORE_BASE64 }}" | base64 -d > release.keystore
      
      - name: Build release AAB
        env:
          KEYSTORE_FILE: release.keystore
          KEYSTORE_PASSWORD: ${{ secrets.KEYSTORE_PASSWORD }}
          KEY_ALIAS: ${{ secrets.KEY_ALIAS }}
          KEY_PASSWORD: ${{ secrets.KEY_PASSWORD }}
        run: ./gradlew bundleRelease
      
      - name: Upload to Play Store
        uses: r0adkll/upload-google-play@v1
        with:
          serviceAccountJsonPlainText: ${{ secrets.PLAY_SERVICE_ACCOUNT_JSON }}
          packageName: com.quortex.android
          releaseFiles: app/build/outputs/bundle/release/app-release.aab
          track: internal
          status: completed
```

---

## 7. Implementation Phases

### Phase 1: Backend Infrastructure (Weeks 1-2)

**Goals:**
- Set up MongoDB database
- Build REST API and WebSocket server
- Implement multi-provider authentication

**Tasks:**
- [ ] Set up MongoDB database and schema
- [ ] Create Express/Fastify server
- [ ] Implement authentication endpoints for all providers
- [ ] Set up JWT token issuance and verification
- [ ] Implement WebSocket server with Socket.IO
- [ ] Integrate existing game core logic (`src/game/`)
- [ ] Build game state manager with locking
- [ ] Deploy to server and test

**Deliverables:**
- Backend server running and accessible
- All auth providers working
- WebSocket multiplayer functional
- Database persisting game states

### Phase 2: Android App Foundation (Weeks 3-4)

**Goals:**
- Create Android app structure
- Implement authentication UI
- Set up WebView container

**Tasks:**
- [ ] Create Android Studio project (Kotlin)
- [ ] Set up dependency injection (Hilt)
- [ ] Build authentication screens with Jetpack Compose
- [ ] Integrate Google Sign-In SDK
- [ ] Integrate Facebook Login SDK
- [ ] Implement Apple/Discord OAuth (web flow)
- [ ] Create unified AuthenticationManager
- [ ] Build MainActivity with WebView
- [ ] Implement JavaScript bridge
- [ ] Test authentication flow end-to-end

**Deliverables:**
- Android app with working authentication
- All 4 providers functional
- WebView loading game from server

### Phase 3: Native Features Integration (Week 5)

**Goals:**
- Add native Android features
- Implement JavaScript bridge

**Tasks:**
- [ ] Set up Firebase Cloud Messaging
- [ ] Implement push notification handling
- [ ] Build deep link handling
- [ ] Create native share integration
- [ ] Add haptic feedback (vibration)
- [ ] Implement JavaScript bridge methods
- [ ] Test all native features with WebView

**Deliverables:**
- Push notifications working
- Deep links opening app to specific games
- Native sharing functional
- JavaScript bridge complete

### Phase 4: WebView Optimization (Week 6)

**Goals:**
- Optimize WebView performance
- Ensure smooth gameplay

**Tasks:**
- [ ] Enable hardware acceleration
- [ ] Configure caching strategy
- [ ] Optimize JavaScript injection
- [ ] Test on multiple devices
- [ ] Profile performance
- [ ] Fix rendering issues
- [ ] Add loading states

**Deliverables:**
- 60 FPS gameplay in WebView
- Fast initial load time
- No visual glitches

### Phase 5: Testing & Polish (Week 7)

**Goals:**
- Comprehensive testing
- Bug fixes
- UI/UX polish

**Tasks:**
- [ ] Test on 5+ different devices
- [ ] Test all auth providers
- [ ] Test multiplayer scenarios
- [ ] Test push notifications
- [ ] Test deep links
- [ ] Fix all critical bugs
- [ ] Optimize app size
- [ ] Add crash reporting (Firebase Crashlytics)

**Deliverables:**
- Stable app with no critical bugs
- Tested on multiple devices
- Ready for beta testing

### Phase 6: Beta Testing & Launch (Week 8)

**Goals:**
- Beta test with users
- Submit to Google Play Store
- Launch app

**Tasks:**
- [ ] Create Play Store listing
- [ ] Generate screenshots and graphics
- [ ] Set up internal testing track
- [ ] Invite beta testers
- [ ] Collect feedback
- [ ] Fix beta issues
- [ ] Submit for Play Store review
- [ ] Launch to production

**Deliverables:**
- App live on Google Play Store
- Marketing materials ready
- Beta feedback incorporated

---

## 8. Security & Privacy

### 8.1 Authentication Security

**Token Storage:**
- JWT tokens stored in encrypted SharedPreferences
- Tokens never exposed in URLs
- Short-lived tokens with refresh mechanism
- Secure token transmission (HTTPS only)

**Provider Token Validation:**
- Always verify tokens server-side
- Never trust client-provided auth data
- Use official SDKs for token verification
- Implement rate limiting on auth endpoints

### 8.2 Data Privacy

**Data Collection:**
- Only collect necessary user data
- Clear privacy policy
- GDPR compliance
- User data deletion on request

**Data Storage:**
- Encrypted database connections
- Secure MongoDB authentication
- Regular database backups
- Data retention policy (90 days for inactive accounts)

### 8.3 Network Security

**HTTPS Enforcement:**
- All API calls over HTTPS
- Certificate pinning in Android app
- WebSocket over WSS (secure WebSocket)

**Rate Limiting:**
- API endpoint rate limits
- WebSocket message throttling
- Authentication attempt limits

---

## 9. Cost Estimates

### Development Costs

**Phase 1-2 (Backend + Android Foundation):** 4 weeks
- Developer time: $8,000 - $12,000

**Phase 3-4 (Native Features + Optimization):** 2 weeks
- Developer time: $4,000 - $6,000

**Phase 5-6 (Testing + Launch):** 2 weeks
- Developer time: $4,000 - $6,000
- App store assets: $500
- Beta testing: $0 (community testers)

**Total Development:** $16,500 - $24,500

### Ongoing Costs

**Monthly:**
- Server hosting: $10-20 (DigitalOcean, Hetzner)
- MongoDB Atlas (optional cloud): $0-57
- Firebase (notifications): $0-25
- Domain name: $1
- **Total: $11-103/month**

**One-time:**
- Google Play Developer account: $25
- Domain name: $10/year

**Scaling (at 10,000+ active users):**
- Server: $50-100/month
- MongoDB: $57-180/month
- Firebase: $25-100/month
- **Total: $132-380/month**

---

## 10. Success Metrics

### Key Performance Indicators

**User Acquisition:**
- Downloads per day
- Install-to-registration conversion rate
- Active users (DAU, MAU)

**Engagement:**
- Average session length
- Games per user per day
- Retention (Day 1, Day 7, Day 30)

**Technical:**
- App crash rate (< 1%)
- API response time (< 200ms)
- WebSocket latency (< 100ms)

**Quality:**
- Play Store rating (target 4.5+)
- User reviews sentiment

---

## 11. Future Enhancements

### Phase 2 Features

**Offline Mode:**
- Local game state caching
- Play vs AI offline
- Sync when back online

**iOS App:**
- Port to iOS using same backend
- Native iOS UI
- Same multi-provider auth

**Advanced Features:**
- Tournaments
- Achievements system
- Player profiles
- Friends system
- Chat (text/emojis)
- Replay system

### Cross-Platform Play

**Web ↔ Android:**
- Same backend, seamless play
- Account linking
- Cloud save sync

**Future Platforms:**
- iOS
- Desktop (Electron)
- More social platforms

---

## 12. Conclusion

This Android app architecture provides a pragmatic approach to bringing Quortex to mobile devices:

**Key Benefits:**
- ✅ Reuses 100% of existing web game code
- ✅ Multi-platform authentication (Google, Apple, Discord, Facebook)
- ✅ Lightweight server with MongoDB (cost-effective)
- ✅ Native Android features (notifications, sharing, deep links)
- ✅ Real-time multiplayer via WebSocket
- ✅ Cross-platform play (web + Android)
- ✅ Scalable architecture for future growth

**Total Timeline:** 8 weeks from start to Play Store launch

**Total Cost:**
- Development: $16,500 - $24,500
- Monthly: $11-103
- One-time: $35

**Next Steps:**
1. Set up development environment
2. Deploy backend server
3. Begin Phase 1 (Backend Infrastructure)
4. Create Android app in Phase 2
5. Iterate based on testing
6. Launch on Google Play Store

---

**Document Version:** 1.0  
**Last Updated:** 2025-11-12  
**Author:** Quortex Development Team  
**Status:** Design Specification
