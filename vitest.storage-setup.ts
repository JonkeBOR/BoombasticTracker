import { execFileSync } from 'node:child_process';
import { rm } from 'node:fs/promises';

const stateDirectory = '.wrangler/test-state';
const wranglerEntry = 'node_modules/wrangler/bin/wrangler.js';

export default async function setup(): Promise<void> {
  await rm(stateDirectory, { recursive: true, force: true });
  execFileSync(
    process.execPath,
    [
      wranglerEntry,
      'd1',
      'migrations',
      'apply',
      'onestopshop',
      '--local',
      '--persist-to',
      stateDirectory,
    ],
    { stdio: ['ignore', 'pipe', 'inherit'] },
  );
}
