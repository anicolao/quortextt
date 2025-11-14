/**
 * Migration script to add rating fields to existing users
 * 
 * This script adds default Glicko-2 ratings to users who were created
 * before the rating system was implemented.
 */

import { UserStore } from '../models/User.js';
import { createDefaultRating } from '../rating/glicko2.js';

/**
 * Migrate existing users to have rating fields
 * This should be run once after deploying the rating system
 */
export async function migrateUsersToRatings(): Promise<void> {
  console.log('[Migration] Starting user rating migration...');
  
  const users = UserStore.getAll();
  let migrated = 0;
  let skipped = 0;
  
  for (const user of users) {
    // Check if user already has ratings
    if (user.ratings) {
      skipped++;
      continue;
    }
    
    // Add default ratings
    const updatedUser = {
      ...user,
      ratings: {
        twoPlayer: createDefaultRating(),
        threePlayer: createDefaultRating(),
        fourPlayer: createDefaultRating(),
        fivePlayer: createDefaultRating(),
        sixPlayer: createDefaultRating()
      },
      ratingHistory: []
    };
    
    await UserStore.update(user.id, updatedUser);
    migrated++;
    
    console.log(`[Migration] Migrated user ${user.displayName} (${user.id})`);
  }
  
  console.log(`[Migration] Complete! Migrated ${migrated} users, skipped ${skipped} users.`);
}

/**
 * Check if any users need migration
 */
export function checkMigrationNeeded(): boolean {
  const users = UserStore.getAll();
  return users.some(user => !user.ratings);
}
