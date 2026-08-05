import { resolve } from 'node:path';
import { verifyRelease } from './release-manifest.mjs';

const releaseDirectory = process.argv[2];
if (!releaseDirectory) {
  throw new Error('Usage: npm run verify:release -- <release-directory> [expected-sha]');
}

const manifest = await verifyRelease(resolve(releaseDirectory), {
  expectedSha: process.argv[3] || undefined,
  expectedNodeMajor: Number(process.env.QUORTEX_EXPECTED_NODE_MAJOR ?? '22'),
});
console.log(`Verified immutable release ${manifest.gitSha}`);
