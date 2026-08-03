import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createBuildMetadata } from './build-metadata.mjs';

const serverDirectory = resolve(import.meta.dirname, '..', 'server');
const outputDirectory = resolve(serverDirectory, 'dist');
const metadata = {
  component: 'server',
  ...createBuildMetadata(process.env, { cwd: resolve(serverDirectory, '..') }),
};

await mkdir(outputDirectory, { recursive: true });
await writeFile(
  resolve(outputDirectory, 'version.json'),
  `${JSON.stringify(metadata, null, 2)}\n`,
  'utf8',
);
