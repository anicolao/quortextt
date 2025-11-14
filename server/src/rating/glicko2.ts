/**
 * Glicko-2 Rating System Implementation
 * Based on the paper by Mark Glickman: http://www.glicko.net/glicko/glicko2.pdf
 * 
 * This implementation handles:
 * - Standard 1v1 ratings
 * - Multi-player games (3+ players with pairwise comparisons)
 * - Team games (4-6 players)
 */

// Constants
const GLICKO_SCALE = 173.7178;  // Conversion factor between standard and Glicko-2 scale
const TAU = 0.5;                // System constant that constrains volatility changes
const EPSILON = 0.000001;       // Convergence tolerance for iterative calculations

export interface GlickoRating {
  rating: number;      // Player rating (default: 1500)
  rd: number;          // Rating Deviation (default: 350, min: 75)
  volatility: number;  // Rating volatility (default: 0.06)
  lastUpdated: Date;   // When this rating was last updated
  gamesPlayed: number; // Number of games at this player count
}

export interface GameResult {
  playerId: string;
  rank: number;        // 1 = winner, 2 = second place, etc.
  teamId?: string;     // For team games
}

export const DEFAULT_RATING = 1500;
export const DEFAULT_RD = 350;
export const DEFAULT_VOLATILITY = 0.06;
export const MIN_RD = 75;

/**
 * Create a new default Glicko rating
 */
export function createDefaultRating(): GlickoRating {
  return {
    rating: DEFAULT_RATING,
    rd: DEFAULT_RD,
    volatility: DEFAULT_VOLATILITY,
    lastUpdated: new Date(),
    gamesPlayed: 0
  };
}

/**
 * Convert standard rating to Glicko-2 scale
 */
function toGlickoScale(rating: number): number {
  return (rating - 1500) / GLICKO_SCALE;
}

/**
 * Convert Glicko-2 scale rating to standard scale
 */
function fromGlickoScale(mu: number): number {
  return mu * GLICKO_SCALE + 1500;
}

/**
 * Convert standard RD to Glicko-2 scale
 */
function rdToGlickoScale(rd: number): number {
  return rd / GLICKO_SCALE;
}

/**
 * Convert Glicko-2 scale RD to standard scale
 */
function rdFromGlickoScale(phi: number): number {
  return phi * GLICKO_SCALE;
}

/**
 * Calculate g(φ) function used in Glicko-2
 */
function g(phi: number): number {
  return 1 / Math.sqrt(1 + 3 * phi * phi / (Math.PI * Math.PI));
}

/**
 * Calculate E(μ, μ_j, φ_j) - expected score
 */
function E(mu: number, muJ: number, phiJ: number): number {
  return 1 / (1 + Math.exp(-g(phiJ) * (mu - muJ)));
}

/**
 * Calculate the variance v
 */
function calculateVariance(mu: number, opponents: Array<{ mu: number, phi: number }>): number {
  let sum = 0;
  for (const opp of opponents) {
    const e = E(mu, opp.mu, opp.phi);
    const gPhi = g(opp.phi);
    sum += gPhi * gPhi * e * (1 - e);
  }
  return 1 / sum;
}

/**
 * Calculate the delta value
 */
function calculateDelta(
  mu: number,
  opponents: Array<{ mu: number, phi: number, score: number }>
): number {
  let sum = 0;
  for (const opp of opponents) {
    const e = E(mu, opp.mu, opp.phi);
    sum += g(opp.phi) * (opp.score - e);
  }
  return sum;
}

/**
 * Calculate the new volatility using the iterative algorithm
 */
function calculateNewVolatility(
  phi: number,
  sigma: number,
  delta: number,
  v: number
): number {
  const phiSquared = phi * phi;
  const deltaSquared = delta * delta;
  
  // Step 5.2: Set the initial values
  const a = Math.log(sigma * sigma);
  let A = a;
  
  // Step 5.3: Set the initial value of B
  let B: number;
  if (deltaSquared > phiSquared + v) {
    B = Math.log(deltaSquared - phiSquared - v);
  } else {
    let k = 1;
    while (f(a - k * TAU, deltaSquared, phiSquared, v, a) < 0) {
      k++;
    }
    B = a - k * TAU;
  }
  
  // Helper function f(x)
  function f(x: number, deltaSq: number, phiSq: number, v: number, a: number): number {
    const ex = Math.exp(x);
    const num1 = ex * (deltaSq - phiSq - v - ex);
    const den1 = 2 * Math.pow(phiSq + v + ex, 2);
    const num2 = x - a;
    const den2 = TAU * TAU;
    return num1 / den1 - num2 / den2;
  }
  
  // Step 5.4: Iterative algorithm
  let fA = f(A, deltaSquared, phiSquared, v, a);
  let fB = f(B, deltaSquared, phiSquared, v, a);
  
  while (Math.abs(B - A) > EPSILON) {
    // Step 5.4a
    const C = A + (A - B) * fA / (fB - fA);
    const fC = f(C, deltaSquared, phiSquared, v, a);
    
    // Step 5.4b
    if (fC * fB < 0) {
      A = B;
      fA = fB;
    } else {
      fA = fA / 2;
    }
    
    B = C;
    fB = fC;
  }
  
  // Step 5.5: Return new volatility
  return Math.exp(A / 2);
}

/**
 * Update a player's rating based on game results
 * 
 * @param rating Current player rating
 * @param opponents Array of opponent ratings and scores (1 = win, 0.5 = draw, 0 = loss)
 * @returns Updated rating
 */
export function updateRating(
  rating: GlickoRating,
  opponents: Array<{ rating: GlickoRating, score: number }>
): GlickoRating {
  // If no opponents, just update the RD due to inactivity
  if (opponents.length === 0) {
    return updateInactiveRating(rating);
  }
  
  // Step 1: Convert to Glicko-2 scale
  const mu = toGlickoScale(rating.rating);
  const phi = rdToGlickoScale(rating.rd);
  const sigma = rating.volatility;
  
  // Convert opponents to Glicko-2 scale
  const opponentsGlicko = opponents.map(opp => ({
    mu: toGlickoScale(opp.rating.rating),
    phi: rdToGlickoScale(opp.rating.rd),
    score: opp.score
  }));
  
  // Step 2: Calculate variance (v)
  const v = calculateVariance(mu, opponentsGlicko);
  
  // Step 3: Calculate delta
  const deltaValue = v * calculateDelta(mu, opponentsGlicko);
  
  // Step 4: Calculate new volatility
  const sigmaPrime = calculateNewVolatility(phi, sigma, deltaValue, v);
  
  // Step 5: Calculate new phi (RD)
  const phiStar = Math.sqrt(phi * phi + sigmaPrime * sigmaPrime);
  const phiPrime = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);
  
  // Step 6: Calculate new mu (rating)
  let updateSum = 0;
  for (const opp of opponentsGlicko) {
    const e = E(mu, opp.mu, opp.phi);
    updateSum += g(opp.phi) * (opp.score - e);
  }
  const muPrime = mu + phiPrime * phiPrime * updateSum;
  
  // Step 7: Convert back to standard scale
  const newRating = fromGlickoScale(muPrime);
  let newRD = rdFromGlickoScale(phiPrime);
  
  // Apply RD floor
  newRD = Math.max(newRD, MIN_RD);
  
  return {
    rating: newRating,
    rd: newRD,
    volatility: sigmaPrime,
    lastUpdated: new Date(),
    gamesPlayed: rating.gamesPlayed + 1
  };
}

/**
 * Update rating for an inactive player (increases RD but keeps rating same)
 */
export function updateInactiveRating(rating: GlickoRating): GlickoRating {
  const phi = rdToGlickoScale(rating.rd);
  const sigma = rating.volatility;
  
  // Update phi based on volatility
  const phiStar = Math.sqrt(phi * phi + sigma * sigma);
  let newRD = rdFromGlickoScale(phiStar);
  
  // Don't let RD grow beyond initial value
  newRD = Math.min(newRD, DEFAULT_RD);
  
  return {
    ...rating,
    rd: newRD,
    lastUpdated: new Date()
  };
}

/**
 * Calculate scores for a multi-player game (3+ players)
 * Uses pairwise comparisons based on rankings
 * 
 * @param results Game results with rankings
 * @returns Map of playerId to array of opponent scores
 */
export function calculateMultiPlayerScores(
  results: GameResult[]
): Map<string, Array<{ playerId: string, score: number }>> {
  const scores = new Map<string, Array<{ playerId: string, score: number }>>();
  
  // For each player, calculate their score against each other player
  for (const player of results) {
    const playerScores: Array<{ playerId: string, score: number }> = [];
    
    for (const opponent of results) {
      if (player.playerId === opponent.playerId) continue;
      
      // Calculate pairwise score based on rankings
      let score: number;
      if (player.rank < opponent.rank) {
        // Player finished better than opponent
        score = 1.0;
      } else if (player.rank > opponent.rank) {
        // Player finished worse than opponent
        score = 0.0;
      } else {
        // Tie
        score = 0.5;
      }
      
      playerScores.push({
        playerId: opponent.playerId,
        score
      });
    }
    
    scores.set(player.playerId, playerScores);
  }
  
  return scores;
}

/**
 * Calculate scores for team games (4-6 players)
 * Team members share the same outcome against opponents
 * 
 * @param results Game results with team assignments
 * @returns Map of playerId to array of opponent scores
 */
export function calculateTeamGameScores(
  results: GameResult[]
): Map<string, Array<{ playerId: string, score: number }>> {
  const scores = new Map<string, Array<{ playerId: string, score: number }>> ();
  
  // Group players by team
  const teams = new Map<string, GameResult[]>();
  for (const player of results) {
    if (!player.teamId) {
      throw new Error('Team games require teamId for all players');
    }
    
    if (!teams.has(player.teamId)) {
      teams.set(player.teamId, []);
    }
    teams.get(player.teamId)!.push(player);
  }
  
  // For each player, calculate scores against all opponents (players on other teams)
  for (const player of results) {
    const playerScores: Array<{ playerId: string, score: number }> = [];
    
    for (const opponent of results) {
      // Skip teammates
      if (player.teamId === opponent.teamId) continue;
      
      // Calculate score based on team rankings
      let score: number;
      if (player.rank < opponent.rank) {
        score = 1.0;
      } else if (player.rank > opponent.rank) {
        score = 0.0;
      } else {
        score = 0.5;
      }
      
      playerScores.push({
        playerId: opponent.playerId,
        score
      });
    }
    
    scores.set(player.playerId, playerScores);
  }
  
  return scores;
}

/**
 * Update ratings for all players in a game
 * 
 * @param results Game results with rankings and optional teams
 * @param currentRatings Map of playerId to current rating
 * @param isTeamGame Whether this is a team game
 * @returns Map of playerId to updated rating
 */
export function updateGameRatings(
  results: GameResult[],
  currentRatings: Map<string, GlickoRating>,
  isTeamGame: boolean = false
): Map<string, GlickoRating> {
  // Calculate pairwise scores
  const pairwiseScores = isTeamGame
    ? calculateTeamGameScores(results)
    : calculateMultiPlayerScores(results);
  
  const updatedRatings = new Map<string, GlickoRating>();
  
  // Update each player's rating
  for (const player of results) {
    const currentRating = currentRatings.get(player.playerId);
    if (!currentRating) {
      throw new Error(`No rating found for player ${player.playerId}`);
    }
    
    const playerScores = pairwiseScores.get(player.playerId) || [];
    
    // Build opponents array with ratings and scores
    const opponents = playerScores.map(ps => {
      const oppRating = currentRatings.get(ps.playerId);
      if (!oppRating) {
        throw new Error(`No rating found for opponent ${ps.playerId}`);
      }
      return {
        rating: oppRating,
        score: ps.score
      };
    });
    
    // Update this player's rating
    const newRating = updateRating(currentRating, opponents);
    updatedRatings.set(player.playerId, newRating);
  }
  
  return updatedRatings;
}
