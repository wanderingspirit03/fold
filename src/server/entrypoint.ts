import { resolve } from 'node:path';
import { EncryptedAppendLogServer, FileAppendLogStore } from './append-log.js';

export interface ServerCliOptions {
  host: string;
  port: number;
  dataDirectory: string;
}

export function parseServerCliOptions(argv: readonly string[], cwd = process.cwd()): ServerCliOptions {
  const options: ServerCliOptions = {
    host: '127.0.0.1',
    port: 8787,
    dataDirectory: resolve(cwd, 'data', 'append-log'),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--host') {
      options.host = readFlagValue(argv, index, '--host');
      index += 1;
      continue;
    }
    if (arg === '--port') {
      options.port = parsePort(readFlagValue(argv, index, '--port'));
      index += 1;
      continue;
    }
    if (arg === '--data') {
      options.dataDirectory = resolve(cwd, readFlagValue(argv, index, '--data'));
      index += 1;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      throw new ServerCliHelp();
    }
    throw new Error(`Unknown server option: ${arg}`);
  }

  return options;
}

export async function runServerCli(argv = process.argv.slice(2)): Promise<void> {
  let options: ServerCliOptions;
  try {
    options = parseServerCliOptions(argv);
  } catch (error) {
    if (error instanceof ServerCliHelp) {
      console.log(serverUsage());
      return;
    }
    console.error(error instanceof Error ? error.message : String(error));
    console.error(serverUsage());
    process.exitCode = 1;
    return;
  }

  const server = new EncryptedAppendLogServer(new FileAppendLogStore(options.dataDirectory));
  let url: string;
  try {
    url = await server.start({ host: options.host, port: options.port });
  } catch (error) {
    console.error('mdroom server failed to start');
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
    return;
  }

  console.log(`mdroom server listening at ${url}`);
  console.log(`append-log store: file (${options.dataDirectory})`);

  let stopping = false;
  const stop = async (signal: NodeJS.Signals): Promise<void> => {
    if (stopping) return;
    stopping = true;
    console.log(`received ${signal}; shutting down mdroom server`);
    try {
      await server.stop();
      console.log('mdroom server stopped');
    } catch (error) {
      console.error('mdroom server shutdown failed');
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  };

  process.once('SIGINT', () => {
    void stop('SIGINT');
  });
  process.once('SIGTERM', () => {
    void stop('SIGTERM');
  });
}

class ServerCliHelp extends Error {}

function readFlagValue(argv: readonly string[], index: number, flag: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

function parsePort(raw: string): number {
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`Invalid --port value: ${raw}`);
  }
  return port;
}

function serverUsage(): string {
  return [
    'Usage: npm run server -- [--host <host>] [--port <port>] [--data <directory>]',
    '',
    'Defaults: --host 127.0.0.1 --port 8787 --data ./data/append-log',
  ].join('\n');
}
