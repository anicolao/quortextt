#!/usr/bin/env tsx
/**
 * CLI script to generate test files for a complete game
 * 
 * Usage: tsx scripts/generate-game-test.ts <seed> <output-dir>
 * 
 * Generates:
 * - <output-dir>/<seed>.actions - JSONL file of all Redux actions
 * - <output-dir>/<seed>.clicks - JSONL file of UI click sequence
 * - <output-dir>/<seed>.expectations - Expectations file for validation
 */

import * as fs from 'fs';
import * as path from 'path';
import { generateRandomGameWithState, saveActionsToFile } from '../tests/utils/gameGenerator';
import { actionsToClicks, generateExpectationsWithPrefixes, saveClicksToFile } from '../tests/utils/actionConverter';

function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.error('Usage: tsx scripts/generate-game-test.ts <seed> <output-dir>');
    console.error('');
    console.error('Example: tsx scripts/generate-game-test.ts 999 tests/e2e/user-stories/005-complete-game/999');
    process.exit(1);
  }
  
  const seed = parseInt(args[0]);
  const outputDir = args[1];
  
  if (isNaN(seed)) {
    console.error(`Error: seed must be a number, got: ${args[0]}`);
    process.exit(1);
  }
  
  console.log(`Generating game test files for seed ${seed}...`);
  console.log(`Output directory: ${outputDir}`);
  
  // Create output directory if it doesn't exist
  fs.mkdirSync(outputDir, { recursive: true });
  
  // Generate game actions and final state
  console.log('  Generating random game...');
  const { actions, finalState, movePrefixes } = generateRandomGameWithState(seed, 50);
  console.log(`  Generated ${actions.length} actions`);
  
  // Save actions file
  const actionsFile = path.join(outputDir, `${seed}.actions`);
  const actionsContent = saveActionsToFile(actions);
  fs.writeFileSync(actionsFile, actionsContent, 'utf-8');
  console.log(`  ✓ Saved ${actionsFile}`);
  
  // Generate and save clicks file
  console.log('  Generating click sequence...');
  const clicks = actionsToClicks(actions);
  const clicksFile = path.join(outputDir, `${seed}.clicks`);
  const clicksContent = saveClicksToFile(clicks);
  fs.writeFileSync(clicksFile, clicksContent, 'utf-8');
  console.log(`  ✓ Saved ${clicksFile}`);
  
  // Generate and save expectations file (includes move prefixes)
  console.log('  Generating expectations...');
  const expectations = generateExpectationsWithPrefixes(finalState, movePrefixes);
  const expectationsFile = path.join(outputDir, `${seed}.expectations`);
  fs.writeFileSync(expectationsFile, expectations, 'utf-8');
  console.log(`  ✓ Saved ${expectationsFile}`);
  
  console.log('');
  console.log('✓ Successfully generated all test files');
}

main();
