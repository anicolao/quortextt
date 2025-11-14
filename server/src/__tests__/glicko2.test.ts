import { describe, it, expect } from 'vitest';
import {
  createDefaultRating,
  updateRating,
  updateGameRatings,
  calculateMultiPlayerScores,
  calculateTeamGameScores,
  DEFAULT_RATING,
  DEFAULT_RD,
  DEFAULT_VOLATILITY,
  MIN_RD,
  type GlickoRating,
  type GameResult
} from '../rating/glicko2';

describe('Glicko-2 Rating System', () => {
  describe('createDefaultRating', () => {
    it('should create a rating with default values', () => {
      const rating = createDefaultRating();
      expect(rating.rating).toBe(DEFAULT_RATING);
      expect(rating.rd).toBe(DEFAULT_RD);
      expect(rating.volatility).toBe(DEFAULT_VOLATILITY);
      expect(rating.gamesPlayed).toBe(0);
      expect(rating.lastUpdated).toBeInstanceOf(Date);
    });
  });

  describe('updateRating', () => {
    it('should update rating after a win', () => {
      const playerRating = createDefaultRating();
      const opponentRating = createDefaultRating();

      const newRating = updateRating(playerRating, [
        { rating: opponentRating, score: 1.0 } // Win
      ]);

      // Rating should increase after a win against equal opponent
      expect(newRating.rating).toBeGreaterThan(playerRating.rating);
      // RD should decrease after playing a game
      expect(newRating.rd).toBeLessThan(playerRating.rd);
      // RD should not go below minimum
      expect(newRating.rd).toBeGreaterThanOrEqual(MIN_RD);
      // Games played should increment
      expect(newRating.gamesPlayed).toBe(1);
    });

    it('should update rating after a loss', () => {
      const playerRating = createDefaultRating();
      const opponentRating = createDefaultRating();

      const newRating = updateRating(playerRating, [
        { rating: opponentRating, score: 0.0 } // Loss
      ]);

      // Rating should decrease after a loss against equal opponent
      expect(newRating.rating).toBeLessThan(playerRating.rating);
      // RD should decrease after playing a game
      expect(newRating.rd).toBeLessThan(playerRating.rd);
      expect(newRating.gamesPlayed).toBe(1);
    });

    it('should keep rating similar after a draw', () => {
      const playerRating = createDefaultRating();
      const opponentRating = createDefaultRating();

      const newRating = updateRating(playerRating, [
        { rating: opponentRating, score: 0.5 } // Draw
      ]);

      // Rating should stay relatively similar after draw
      expect(Math.abs(newRating.rating - playerRating.rating)).toBeLessThan(10);
      // RD should decrease
      expect(newRating.rd).toBeLessThan(playerRating.rd);
    });

    it('should clamp RD to minimum value', () => {
      // Create a player with very low RD
      const playerRating: GlickoRating = {
        rating: 1600,
        rd: 80, // Close to minimum
        volatility: 0.06,
        lastUpdated: new Date(),
        gamesPlayed: 50
      };
      
      const opponentRating = createDefaultRating();

      const newRating = updateRating(playerRating, [
        { rating: opponentRating, score: 1.0 }
      ]);

      // RD should be clamped at minimum
      expect(newRating.rd).toBeGreaterThanOrEqual(MIN_RD);
    });

    it('should handle multiple opponents', () => {
      const playerRating = createDefaultRating();
      const opponent1 = createDefaultRating();
      const opponent2 = createDefaultRating();

      const newRating = updateRating(playerRating, [
        { rating: opponent1, score: 1.0 }, // Win vs opponent 1
        { rating: opponent2, score: 0.0 }  // Loss vs opponent 2
      ]);

      // Rating should change but RD should decrease
      expect(newRating.rd).toBeLessThan(playerRating.rd);
      expect(newRating.gamesPlayed).toBe(1);
    });

    it('should give larger rating changes for wins against higher-rated opponents', () => {
      const playerRating = createDefaultRating();
      const weakOpponent: GlickoRating = {
        ...createDefaultRating(),
        rating: 1300
      };
      const strongOpponent: GlickoRating = {
        ...createDefaultRating(),
        rating: 1700
      };

      const winVsWeak = updateRating(playerRating, [
        { rating: weakOpponent, score: 1.0 }
      ]);

      const winVsStrong = updateRating(playerRating, [
        { rating: strongOpponent, score: 1.0 }
      ]);

      // Beating a stronger opponent should give more rating
      const gainVsWeak = winVsWeak.rating - playerRating.rating;
      const gainVsStrong = winVsStrong.rating - playerRating.rating;
      expect(gainVsStrong).toBeGreaterThan(gainVsWeak);
    });
  });

  describe('calculateMultiPlayerScores', () => {
    it('should calculate pairwise scores for 3 players', () => {
      const results: GameResult[] = [
        { playerId: 'p1', rank: 1 }, // Winner
        { playerId: 'p2', rank: 2 }, // Second
        { playerId: 'p3', rank: 3 }  // Third
      ];

      const scores = calculateMultiPlayerScores(results);

      // Player 1 (winner) should have wins against both others
      const p1Scores = scores.get('p1')!;
      expect(p1Scores).toHaveLength(2);
      expect(p1Scores.every(s => s.score === 1.0)).toBe(true);

      // Player 2 (second) should have loss to p1, win against p3
      const p2Scores = scores.get('p2')!;
      expect(p2Scores).toHaveLength(2);
      const p2VsP1 = p2Scores.find(s => s.playerId === 'p1');
      const p2VsP3 = p2Scores.find(s => s.playerId === 'p3');
      expect(p2VsP1?.score).toBe(0.0);
      expect(p2VsP3?.score).toBe(1.0);

      // Player 3 (last) should have losses against both
      const p3Scores = scores.get('p3')!;
      expect(p3Scores).toHaveLength(2);
      expect(p3Scores.every(s => s.score === 0.0)).toBe(true);
    });

    it('should handle ties in rankings', () => {
      const results: GameResult[] = [
        { playerId: 'p1', rank: 1 }, // Winner
        { playerId: 'p2', rank: 2 }, // Tied for second
        { playerId: 'p3', rank: 2 }  // Tied for second
      ];

      const scores = calculateMultiPlayerScores(results);

      // Players with tied rank should have 0.5 score against each other
      const p2Scores = scores.get('p2')!;
      const p2VsP3 = p2Scores.find(s => s.playerId === 'p3');
      expect(p2VsP3?.score).toBe(0.5);

      const p3Scores = scores.get('p3')!;
      const p3VsP2 = p3Scores.find(s => s.playerId === 'p2');
      expect(p3VsP2?.score).toBe(0.5);
    });
  });

  describe('calculateTeamGameScores', () => {
    it('should calculate scores for team games', () => {
      const results: GameResult[] = [
        { playerId: 'p1', rank: 1, teamId: 'team1' }, // Team 1 wins
        { playerId: 'p2', rank: 1, teamId: 'team1' },
        { playerId: 'p3', rank: 2, teamId: 'team2' }, // Team 2 loses
        { playerId: 'p4', rank: 2, teamId: 'team2' }
      ];

      const scores = calculateTeamGameScores(results);

      // Team 1 members should have wins against all Team 2 members
      const p1Scores = scores.get('p1')!;
      expect(p1Scores).toHaveLength(2); // Against p3 and p4
      expect(p1Scores.every(s => s.score === 1.0)).toBe(true);

      // Team 2 members should have losses against all Team 1 members
      const p3Scores = scores.get('p3')!;
      expect(p3Scores).toHaveLength(2); // Against p1 and p2
      expect(p3Scores.every(s => s.score === 0.0)).toBe(true);

      // Teammates should not have scores against each other
      expect(p1Scores.find(s => s.playerId === 'p2')).toBeUndefined();
    });

    it('should throw error if teamId is missing', () => {
      const results: GameResult[] = [
        { playerId: 'p1', rank: 1 }, // Missing teamId
        { playerId: 'p2', rank: 2, teamId: 'team2' }
      ];

      expect(() => calculateTeamGameScores(results)).toThrow('Team games require teamId');
    });
  });

  describe('updateGameRatings', () => {
    it('should update ratings for a 2-player game', () => {
      const p1Rating = createDefaultRating();
      const p2Rating = createDefaultRating();

      const results: GameResult[] = [
        { playerId: 'p1', rank: 1 }, // Winner
        { playerId: 'p2', rank: 2 }  // Loser
      ];

      const currentRatings = new Map([
        ['p1', p1Rating],
        ['p2', p2Rating]
      ]);

      const updatedRatings = updateGameRatings(results, currentRatings);

      // Winner's rating should increase
      const newP1 = updatedRatings.get('p1')!;
      expect(newP1.rating).toBeGreaterThan(p1Rating.rating);

      // Loser's rating should decrease
      const newP2 = updatedRatings.get('p2')!;
      expect(newP2.rating).toBeLessThan(p2Rating.rating);

      // Both RDs should decrease
      expect(newP1.rd).toBeLessThan(p1Rating.rd);
      expect(newP2.rd).toBeLessThan(p2Rating.rd);
    });

    it('should update ratings for a 3-player game', () => {
      const p1Rating = createDefaultRating();
      const p2Rating = createDefaultRating();
      const p3Rating = createDefaultRating();

      const results: GameResult[] = [
        { playerId: 'p1', rank: 1 },
        { playerId: 'p2', rank: 2 },
        { playerId: 'p3', rank: 3 }
      ];

      const currentRatings = new Map([
        ['p1', p1Rating],
        ['p2', p2Rating],
        ['p3', p3Rating]
      ]);

      const updatedRatings = updateGameRatings(results, currentRatings);

      // First place should have highest rating gain
      const newP1 = updatedRatings.get('p1')!;
      const newP2 = updatedRatings.get('p2')!;
      const newP3 = updatedRatings.get('p3')!;

      expect(newP1.rating).toBeGreaterThan(p1Rating.rating);
      expect(newP3.rating).toBeLessThan(p3Rating.rating);
    });

    it('should update ratings for a team game', () => {
      const ratings = new Map([
        ['p1', createDefaultRating()],
        ['p2', createDefaultRating()],
        ['p3', createDefaultRating()],
        ['p4', createDefaultRating()]
      ]);

      const results: GameResult[] = [
        { playerId: 'p1', rank: 1, teamId: 'team1' },
        { playerId: 'p2', rank: 1, teamId: 'team1' },
        { playerId: 'p3', rank: 2, teamId: 'team2' },
        { playerId: 'p4', rank: 2, teamId: 'team2' }
      ];

      const updatedRatings = updateGameRatings(results, ratings, true);

      // Winning team members should gain rating
      expect(updatedRatings.get('p1')!.rating).toBeGreaterThan(ratings.get('p1')!.rating);
      expect(updatedRatings.get('p2')!.rating).toBeGreaterThan(ratings.get('p2')!.rating);

      // Losing team members should lose rating
      expect(updatedRatings.get('p3')!.rating).toBeLessThan(ratings.get('p3')!.rating);
      expect(updatedRatings.get('p4')!.rating).toBeLessThan(ratings.get('p4')!.rating);
    });

    it('should throw error if rating is missing for a player', () => {
      const results: GameResult[] = [
        { playerId: 'p1', rank: 1 },
        { playerId: 'p2', rank: 2 }
      ];

      const ratings = new Map([
        ['p1', createDefaultRating()]
        // p2 rating is missing
      ]);

      expect(() => updateGameRatings(results, ratings)).toThrow('No rating found for opponent p2');
    });
  });

  describe('Rating consistency', () => {
    it('should preserve total rating in a closed system over many games', () => {
      // Create 3 players with default ratings
      let ratings = new Map([
        ['p1', createDefaultRating()],
        ['p2', createDefaultRating()],
        ['p3', createDefaultRating()]
      ]);

      const initialTotal = Array.from(ratings.values())
        .reduce((sum, r) => sum + r.rating, 0);

      // Play 10 games with various outcomes
      for (let i = 0; i < 10; i++) {
        const results: GameResult[] = [
          { playerId: 'p1', rank: 1 },
          { playerId: 'p2', rank: 2 },
          { playerId: 'p3', rank: 3 }
        ];

        ratings = updateGameRatings(results, ratings);
      }

      const finalTotal = Array.from(ratings.values())
        .reduce((sum, r) => sum + r.rating, 0);

      // Total rating should remain approximately the same
      // (Small differences due to volatility updates are expected)
      expect(Math.abs(finalTotal - initialTotal)).toBeLessThan(50);
    });
  });
});
