#!/usr/bin/env tsx
import { runMdroomCli } from './app.js';

await runMdroomCli(process.argv.slice(2), {
  process,
  cwd: process.cwd(),
});
