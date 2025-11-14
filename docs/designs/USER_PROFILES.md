# User Profile System Design

## Overview

This document outlines the design for a comprehensive user profile system that enables users to create personalized profiles with aliases, claim anonymous accounts, and maintain their game history and ratings across sessions.

## Executive Summary

**Key Features:**
- Custom user aliases displayed in-game instead of OAuth IDs
- Profile creation flow for new sign-ins
- Anonymous player support with cookie-based persistence
- Claim code system for account migration
- Profile view accessible from lobby
- 30-day expiration for inactive anonymous users

## 1. User Profile Model

### 1.1 Profile Data Structure

```typescript
interface IUser {
  // Existing fields
  id: string;                    // Stable ID: googleId, discordId, or anon:uuid
  discordId?: string;
  googleId?: string;
  displayName: string;           // Default from OAuth or guest username
  email?: string;
  avatar?: string;
  provider: 'discord' | 'google' | 'anonymous';
  
  // New profile fields
  alias: string;                 // User-chosen display name
  claimCode: string;             // 6-letter random code for account claiming
  isAnonymous: boolean;          // True for guest/anonymous users
  
  // Enhanced tracking
  stats: {
    gamesPlayed: number;
    gamesWon: number;
    gamesLost: number;
    winStreak: number;
    bestWinStreak: number;
    rating?: number;             // Future: ELO or similar rating
  };
  
  settings: {
    notifications: boolean;
    soundEnabled: boolean;
    theme: string;
  };
  
  createdAt: Date;
  lastActive: Date;
}
```

### 1.2 Claim Code Generation

- **Format:** 6 uppercase letters (e.g., "ABCDEF")
- **Character Set:** A-Z (excluding confusing characters like O, I, L)
- **Uniqueness:** Verified unique across all users
- **Regeneration:** Can be regenerated if user suspects compromise

**Implementation:**
```typescript
function generateClaimCode(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ'; // Exclude I, L, O for clarity
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}
```

## 2. User Flows

### 2.1 New OAuth User Flow

1. User clicks "Sign in with Discord/Google"
2. OAuth flow completes successfully
3. System checks if user has existing profile
4. **If new user:**
   - Redirect to profile creation screen
   - Pre-fill alias with OAuth display name
   - Allow user to customize alias
   - Generate claim code
   - Save profile and proceed to lobby
5. **If existing user:**
   - Update lastActive timestamp
   - Proceed directly to lobby

### 2.2 Anonymous User Flow

1. User enters guest username on login screen
2. System creates anonymous user profile:
   - Generate unique ID: `anon:uuid`
   - Set alias to entered username
   - Generate claim code
   - Set isAnonymous = true
   - Provider = 'anonymous'
3. Store user ID in browser cookie (httpOnly, secure)
4. Proceed to lobby
5. On subsequent visits:
   - Check for anonymous user cookie
   - Load user profile if cookie exists
   - Allow rejoining games and maintaining stats

### 2.3 Account Claiming Flow

1. Anonymous user decides to sign in with OAuth
2. Complete OAuth flow
3. Show "Claim Anonymous Account" prompt:
   - "We detected you have a guest account. Enter your claim code to migrate your game history."
   - Input field for 6-letter claim code
   - Option to skip and start fresh
4. If user enters claim code:
   - Validate claim code against anonymous accounts
   - Migrate stats and game history to OAuth account
   - Delete anonymous account
   - Clear anonymous cookie
5. If user skips:
   - Create new OAuth account (standard flow)
   - Keep anonymous account separate

### 2.4 OAuth User Claims Anonymous Account

1. OAuth user views their profile
2. Sees their claim code displayed
3. Wants to claim an old anonymous account
4. Clicks "Claim Another Account"
5. Enters claim code from anonymous account
6. System validates claim code
7. Merges stats and game history:
   - Add games played/won/lost
   - Keep higher win streak
   - Merge game history
8. Delete claimed anonymous account

## 3. Profile View

### 3.1 Profile Screen Components

**Location:** Accessible by clicking username in lobby

**Sections:**

1. **User Info**
   - Avatar (from OAuth or default)
   - Alias (editable)
   - Provider badge (Discord/Google/Guest)
   - Member since date

2. **Claim Code Section**
   - Large, copyable claim code display
   - "Copy Code" button
   - Explanation text: "Share this code to claim your account on another device or after signing in."

3. **Statistics**
   - Games played
   - Win/loss record
   - Win percentage
   - Current win streak
   - Best win streak
   - Rating (future)

4. **Account Actions**
   - Edit alias
   - Claim another account (with claim code input)
   - Regenerate claim code (with confirmation)
   - Sign out

### 3.2 Profile Editing

- Click "Edit Alias" button
- Inline or modal editor
- Validation:
  - 2-20 characters
  - Alphanumeric and spaces
  - No profanity (basic filter)
- Save updates User.alias and displayName

## 4. Anonymous User Management

### 4.1 Cookie Strategy

**Cookie Name:** `quortex_anon_id`

**Properties:**
- HttpOnly: Yes (prevent XSS access)
- Secure: Yes (HTTPS only in production)
- SameSite: Strict
- Max-Age: 30 days
- Path: /

**Server-side:**
```typescript
// Set cookie on anonymous user creation
res.cookie('quortex_anon_id', userId, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
});
```

### 4.2 Expiration Policy

**Inactivity Threshold:** 30 days since lastActive

**Implementation:**
- Background job runs daily
- Identifies anonymous users with `lastActive > 30 days ago`
- Archives or deletes expired anonymous accounts
- Preserves game history for statistical purposes (anonymized)

**Cleanup Job:**
```typescript
async function cleanupExpiredAnonymousUsers() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const expiredUsers = UserStore.getAll()
    .filter(user => 
      user.isAnonymous && 
      new Date(user.lastActive) < thirtyDaysAgo
    );
  
  for (const user of expiredUsers) {
    console.log(`Deleting expired anonymous user: ${user.id}`);
    await UserStore.delete(user.id);
  }
}

// Run daily at 3 AM
setInterval(cleanupExpiredAnonymousUsers, 24 * 60 * 60 * 1000);
```

### 4.3 Cookie Validation

On every request with anonymous cookie:
1. Read `quortex_anon_id` from cookie
2. Validate user exists in database
3. Check user.isAnonymous === true
4. Update lastActive timestamp
5. If user doesn't exist or is claimed, clear cookie

## 5. Game Display

### 5.1 Display Priority

**In-Game Display:** Always show `user.alias`

**Lobby Display:** Show `user.alias` with optional provider icon

**Examples:**
- OAuth user: "Alice 🎮" (Discord icon)
- Anonymous: "Guest123"
- OAuth with custom alias: "ProPlayer 🔵" (Google icon)

### 5.2 Display Implementation

Update all rendering locations:
- Lobby player list
- Game room player list
- In-game player indicators
- Turn notifications
- Victory screen
- Leaderboards (future)

## 6. API Endpoints

### 6.1 Profile Endpoints

```typescript
// Get current user profile
GET /api/profile
Headers: Authorization: Bearer <token>
Response: { 
  id, alias, claimCode, isAnonymous, 
  displayName, avatar, provider, stats, settings,
  createdAt, lastActive 
}

// Update user alias
PUT /api/profile/alias
Headers: Authorization: Bearer <token>
Body: { alias: "NewAlias" }
Response: { alias: "NewAlias" }

// Claim account with claim code
POST /api/profile/claim
Headers: Authorization: Bearer <token>
Body: { claimCode: "ABCDEF" }
Response: { success: true, mergedStats: {...} }

// Regenerate claim code
POST /api/profile/regenerate-claim-code
Headers: Authorization: Bearer <token>
Response: { claimCode: "GHIJKL" }
```

### 6.2 Anonymous User Endpoints

```typescript
// Create anonymous user
POST /api/auth/anonymous
Body: { username: "GuestUser" }
Response: { 
  userId: "anon:uuid", 
  token: "jwt-token",
  claimCode: "ABCDEF"
}
Set-Cookie: quortex_anon_id=anon:uuid; HttpOnly; Secure

// Validate anonymous cookie
GET /api/auth/validate-anonymous
Cookie: quortex_anon_id=anon:uuid
Response: { valid: true, userId: "anon:uuid" }
```

## 7. Security Considerations

### 7.1 Claim Code Security

**Threats:**
- Brute force claim code attempts
- Claim code theft/interception

**Mitigations:**
- Rate limit claim attempts (5 per hour per IP)
- Log all claim attempts
- Short alphanumeric codes reduce guessability (26^6 = ~308M combinations)
- Regeneration capability if code is compromised
- Optional: Add email confirmation for high-value claims

### 7.2 Cookie Security

**Threats:**
- XSS cookie theft
- CSRF attacks
- Session hijacking

**Mitigations:**
- HttpOnly flag prevents JavaScript access
- Secure flag enforces HTTPS
- SameSite=Strict prevents CSRF
- 30-day expiration limits exposure
- Server-side validation on every request

### 7.3 Alias Validation

**Threats:**
- Profanity/offensive usernames
- Impersonation
- SQL injection (though using NoSQL)

**Mitigations:**
- Length limits (2-20 characters)
- Character whitelist (alphanumeric + spaces)
- Basic profanity filter
- Reserved name list (admin, moderator, etc.)
- Display provider badges to prevent impersonation

## 8. Migration Strategy

### 8.1 Existing Users

For users who already have accounts before profile system:

1. **First login after upgrade:**
   - Detect missing alias field
   - Pre-fill alias with current displayName
   - Generate claim code
   - Set isAnonymous = false (OAuth users)
   - Show brief notification: "New feature! Your profile now has a claim code."

2. **Database migration:**
   - Add alias, claimCode, isAnonymous fields
   - Set alias = displayName for all existing users
   - Generate unique claim codes
   - Set isAnonymous = false for all OAuth users

### 8.2 Backward Compatibility

- All existing functionality continues to work
- displayName remains for OAuth default
- Alias takes precedence in display
- Guest users transition to anonymous system

## 9. Future Enhancements

### 9.1 Short-term (Next Release)

- Email verification for anonymous users
- Profile pictures upload (not just OAuth avatar)
- Friend system using claim codes
- Profile privacy settings

### 9.2 Long-term

- ELO rating system
- Achievement badges
- Profile customization (themes, banners)
- Social features (followers, messaging)
- Account linking (multiple OAuth providers)
- Two-factor authentication for high-value accounts

## 10. Testing Strategy

### 10.1 Unit Tests

- Claim code generation and uniqueness
- Profile validation
- Stats merging logic
- Cookie handling
- Expiration cleanup

### 10.2 Integration Tests

- OAuth flow with profile creation
- Anonymous user creation and persistence
- Claim code validation and account merging
- Profile updates
- Cookie-based authentication

### 10.3 E2E Tests

- New user completes profile setup
- Anonymous user creates account and rejoins
- User claims anonymous account via claim code
- Profile view and editing
- Sign out and sign back in

## 11. Implementation Phases

### Phase 1: Core Profile System
1. Extend User model
2. Add profile creation flow for OAuth users
3. Implement profile view screen
4. Display aliases in game

### Phase 2: Anonymous Users
1. Implement anonymous user creation
2. Add cookie-based persistence
3. Anonymous user expiration job
4. Cookie validation middleware

### Phase 3: Claim System
1. Claim code generation and storage
2. Claim account UI and flow
3. Stats merging logic
4. Rate limiting and security

### Phase 4: Polish
1. Profile editing UI
2. Claim code regeneration
3. Improved alias validation
4. Documentation and help text

## 12. Success Metrics

- **Adoption:** % of users who customize their alias
- **Retention:** Anonymous users who later claim with OAuth
- **Engagement:** Average sessions per user (anonymous vs OAuth)
- **Conversion:** Anonymous to OAuth conversion rate
- **Security:** Failed claim attempts (monitor for attacks)

## 13. Documentation Updates

Files to update:
- README.md - Add profile system to features
- docs/dev/OAUTH_SETUP.md - Add anonymous user setup
- docs/designs/WEB_MULTIPLAYER.md - Reference profile system
- Create user guide for claim codes

## Conclusion

This profile system provides a seamless experience for both authenticated and anonymous users, with a secure and user-friendly claim code mechanism for account migration. The implementation prioritizes security, user experience, and future extensibility.
