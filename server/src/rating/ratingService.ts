/**
 * Rating Service - Handles rating updates after game completion
 */

import { GameResult, updateGameRatings, type GlickoRating } from './glicko2.js';
import { UserStore } from '../models/User.js';

/**
 * Process game completion and update all player ratings
 * 
 * @param gameId Unique identifier for the game
 * @param playerCount Number of players in the game (2-6)
 * @param results Array of game results with player rankings
 * @param isTeamGame Whether this was a team game (4-6 players)
 */
export async function processGameCompletion(
  gameId: string,
  playerCount: 2 | 3 | 4 | 5 | 6,
  results: GameResult[],
  isTeamGame: boolean = false
): Promise<void> {
  console.log(`[Rating] Processing game completion for game ${gameId} with ${playerCount} players`);
  
  // Validate player count matches results
  if (results.length !== playerCount) {
    console.error(`[Rating] Player count mismatch: expected ${playerCount}, got ${results.length}`);
    return;
  }
  
  // Get current ratings for all players
  const currentRatings = new Map<string, GlickoRating>();
  
  for (const result of results) {
    const rating = UserStore.getRating(result.playerId, playerCount);
    
    if (!rating) {
      console.error(`[Rating] No rating found for player ${result.playerId} in ${playerCount}-player games`);
      return;
    }
    
    currentRatings.set(result.playerId, rating);
  }
  
  // Calculate new ratings
  const updatedRatings = updateGameRatings(results, currentRatings, isTeamGame);
  
  // Update each player's rating in the database
  for (const result of results) {
    const newRating = updatedRatings.get(result.playerId);
    
    if (!newRating) {
      console.error(`[Rating] Failed to calculate new rating for player ${result.playerId}`);
      continue;
    }
    
    const oldRating = currentRatings.get(result.playerId)!;
    
    // Update the user's rating
    await UserStore.updateRating(result.playerId, playerCount, newRating, gameId);
    
    console.log(
      `[Rating] Updated ${result.playerId}: ` +
      `${oldRating.rating.toFixed(0)} → ${newRating.rating.toFixed(0)} ` +
      `(RD: ${oldRating.rd.toFixed(0)} → ${newRating.rd.toFixed(0)})`
    );
  }
  
  console.log(`[Rating] Completed rating updates for game ${gameId}`);
}

/**
 * Determine if a game is a team game based on player count
 * Team games are 4 or 6 player games (2v2 or 3v3)
 */
export function isTeamGameByPlayerCount(playerCount: number): boolean {
  return playerCount === 4 || playerCount === 6;
}

/**
 * Validate and extract game results from game state
 * This function should be called when a game reaches 'finished' status
 * 
 * @param players Array of player IDs in the game
 * @param winner Player ID or Team ID of the winner
 * @param teams Optional team assignments for team games
 * @returns GameResult array or null if invalid
 */
export function extractGameResults(
  players: string[],
  winner: string,
  teams?: Map<string, string> // playerId -> teamId
): GameResult[] | null {
  if (players.length < 2 || players.length > 6) {
    console.error(`[Rating] Invalid player count: ${players.length}`);
    return null;
  }
  
  const results: GameResult[] = [];
  
  // Determine if this is a team game
  const isTeamGame = teams && teams.size > 0;
  
  if (isTeamGame && teams) {
    // Team game - assign ranks based on team
    // Winner team gets rank 1, others get rank 2
    for (const playerId of players) {
      const teamId = teams.get(playerId);
      if (!teamId) {
        console.error(`[Rating] Missing team for player ${playerId}`);
        return null;
      }
      
      const rank = teamId === winner ? 1 : 2;
      results.push({
        playerId,
        rank,
        teamId
      });
    }
  } else {
    // Individual game - winner gets rank 1, others get rank 2 (tie)
    // In a real implementation, you'd want actual rankings
    for (const playerId of players) {
      const rank = playerId === winner ? 1 : 2;
      results.push({
        playerId,
        rank
      });
    }
  }
  
  return results;
}
