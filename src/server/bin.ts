import { runServerCli } from './entrypoint.js';

void runServerCli().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
