import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const repositoryRoot = resolve(import.meta.dirname, '..');

async function readMetadata(relativePath) {
  return JSON.parse(await readFile(resolve(repositoryRoot, relativePath), 'utf8'));
}

const frontend = await readMetadata('dist/version.json');
const server = await readMetadata('server/dist/version.json');

if (frontend.component !== 'frontend') {
  throw new Error('dist/version.json does not identify the frontend component');
}
if (server.component !== 'server') {
  throw new Error('server/dist/version.json does not identify the server component');
}

for (const field of ['gitSha', 'buildTime', 'buildId', 'dirty']) {
  if (frontend[field] !== server[field]) {
    throw new Error(`Frontend and server build metadata disagree on ${field}`);
  }
}

const expectedSha = process.env.QUORTEX_GIT_SHA ?? process.env.GITHUB_SHA;
if (expectedSha && frontend.gitSha !== expectedSha.toLowerCase()) {
  throw new Error('Generated build metadata does not match the expected Git SHA');
}

console.log(`Verified frontend and server build metadata for ${frontend.gitSha}`);
