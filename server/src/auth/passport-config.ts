// Passport configuration for Discord OAuth
import passport from 'passport';
import { Strategy as DiscordStrategy } from '@oauth-everything/passport-discord';
import { UserStore, IUser } from '../models/User.js';
import { v4 as uuidv4 } from 'uuid';

// Configure Discord Strategy
export function configurePassport() {
  if (!process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_CLIENT_SECRET) {
    console.warn('⚠️  Discord OAuth credentials not configured. Set DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET environment variables.');
    return;
  }

  passport.use(new DiscordStrategy({
    clientID: process.env.DISCORD_CLIENT_ID,
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
    callbackURL: `${process.env.BASE_URL || 'http://localhost:3001'}/auth/discord/callback`,
    scope: ['identify', 'email']
  },
  async (accessToken: string, refreshToken: string, profile: any, done: any) => {
    try {
      // Check if user already exists
      let user = UserStore.findByDiscordId(profile.id);
      
      if (!user) {
        // Create new user
        const avatarUrl = profile.avatar 
          ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
          : undefined;

        user = UserStore.create({
          id: uuidv4(),
          discordId: profile.id,
          displayName: profile.username,
          email: profile.email,
          avatar: avatarUrl
        });

        console.log(`✓ New user created: ${user.displayName} (Discord ID: ${profile.id})`);
      } else {
        // Update last active time
        UserStore.update(user.id, { lastActive: new Date() });
        console.log(`✓ User logged in: ${user.displayName}`);
      }
      
      return done(null, user);
    } catch (error) {
      console.error('Error in Discord OAuth strategy:', error);
      return done(error);
    }
  }));

  // Serialize user for the session
  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  // Deserialize user from the session
  passport.deserializeUser((id: string, done) => {
    const user = UserStore.findById(id);
    done(null, user || null);
  });

  console.log('✓ Discord OAuth strategy configured');
}

export default passport;
