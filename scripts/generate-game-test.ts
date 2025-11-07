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
import { actionsToClicks, generateExpectationsWithPrefixes, generateReadme, saveClicksToFile } from '../tests/utils/actionConverter';

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
  
  // Clean up old screenshots to avoid leaving cruft from previous runs
  const screenshotsDir = path.join(outputDir, 'screenshots');
  if (fs.existsSync(screenshotsDir)) {
    console.log('  Cleaning up old screenshots...');
    fs.rmSync(screenshotsDir, { recursive: true, force: true });
    console.log(`  ✓ Removed ${screenshotsDir}`);
  }
  
  // Also clean up 006- screenshots if applicable
  const dir006 = outputDir.replace('/005-complete-game/', '/006-complete-game-mouse/');
  if (dir006 !== outputDir) {
    const screenshots006Dir = path.join(dir006, 'screenshots');
    if (fs.existsSync(screenshots006Dir)) {
      console.log('  Cleaning up old 006- screenshots...');
      fs.rmSync(screenshots006Dir, { recursive: true, force: true });
      console.log(`  ✓ Removed ${screenshots006Dir}`);
    }
  }
  
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
  
  // Generate and save README file for 005- (actions test)
  console.log('  Generating README for 005-...');
  const readme = generateReadme(seed, actions, finalState, movePrefixes);
  const readmeFile = path.join(outputDir, 'README.md');
  fs.writeFileSync(readmeFile, readme, 'utf-8');
  console.log(`  ✓ Saved ${readmeFile}`);
  
  // Generate and save README file for 006- (clicks test) if it's a different directory
  const dir006 = outputDir.replace('/005-complete-game/', '/006-complete-game-mouse/');
  if (dir006 !== outputDir) {
    console.log('  Generating README for 006-...');
    fs.mkdirSync(dir006, { recursive: true });
    const readme006File = path.join(dir006, 'README.md');
    fs.writeFileSync(readme006File, readme, 'utf-8');
    console.log(`  ✓ Saved ${readme006File}`);
  }
  
  console.log('');
  console.log('✓ Successfully generated all test files');
  console.log('');
  console.log('To generate screenshots:');
  console.log(`  npm run test:e2e -- --grep "seed ${seed}"`);
}

main();
