import http from 'node:http';
import { resolve } from 'node:path';
import * as nextModule from 'next/dist/server/next.js';
import { hostedPortFromEnv, resolvePublicOrigin } from '../deploy/public-origin.js';
import { formatDeploymentDiagnostics, validateHostedRuntime } from '../deploy/runtime-config.js';
import { EncryptedAppendLogServer, FileAppendLogStore } from '../server/append-log.js';

type NextRequestHandler = (request: http.IncomingMessage, response: http.ServerResponse) => Promise<void>;
type CreateNextServer = (options: {
  dev: boolean;
  dir: string;
  hostname: string;
  port: number;
}) => {
  getRequestHandler(): NextRequestHandler;
  prepare(): Promise<void>;
};

const next = (nextModule.default ?? nextModule) as unknown as CreateNextServer;

export interface HostedCliOptions {
  host: string;
  port: number;
  dataDirectory: string;
  defaultDataDirectory: string;
  webDirectory: string;
}

export function parseHostedCliOptions(
  argv: readonly string[],
  cwd = process.cwd(),
  env: Record<string, string | undefined> = process.env,
): HostedCliOptions {
  const defaultDataDirectory = resolve(cwd, 'data/append-log');
  const options: HostedCliOptions = {
    host: env.HOST ?? '0.0.0.0',
    port: hostedPortFromEnv(env, 3000),
    dataDirectory: resolve(cwd, env.FOLD_DATA_DIR ?? defaultDataDirectory),
    defaultDataDirectory,
    webDirectory: resolve(cwd, 'apps/web'),
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
    if (arg === '--web-dir') {
      options.webDirectory = resolve(cwd, readFlagValue(argv, index, '--web-dir'));
      index += 1;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      throw new HostedCliHelp();
    }
    throw new Error(`Unknown hosted option: ${arg}`);
  }

  return options;
}

export async function runHostedCli(argv = process.argv.slice(2)): Promise<void> {
  let options: HostedCliOptions;
  try {
    options = parseHostedCliOptions(argv);
  } catch (error) {
    if (error instanceof HostedCliHelp) {
      console.log(hostedUsage());
      return;
    }
    console.error(error instanceof Error ? error.message : String(error));
    console.error(hostedUsage());
    process.exitCode = 1;
    return;
  }

  const publicOrigin = resolvePublicOrigin({
    defaultUrl: `http://127.0.0.1:${options.port}`,
  });
  const validation = validateHostedRuntime({
    dataDirectory: options.dataDirectory,
    defaultDataDirectory: options.defaultDataDirectory,
    publicOrigin,
  });
  for (const line of formatDeploymentDiagnostics(validation.warnings)) {
    console.warn(`fold deploy ${line}`);
  }
  if (!validation.ok) {
    for (const line of formatDeploymentDiagnostics(validation.errors)) {
      console.error(`fold deploy ${line}`);
    }
    process.exitCode = 1;
    return;
  }

  const nextApp = next({
    dev: false,
    dir: options.webDirectory,
    hostname: options.host,
    port: options.port,
  });
  const nextHandler = nextApp.getRequestHandler();
  const appendLog = new EncryptedAppendLogServer(new FileAppendLogStore(options.dataDirectory));

  try {
    await nextApp.prepare();
  } catch (error) {
    console.error('fold hosted server failed to prepare the web app');
    console.error(error instanceof Error ? error.message : String(error));
    console.error('Run `npm run build` before `npm start`.');
    process.exitCode = 1;
    return;
  }

  const server = http.createServer((request, response) => {
    void (async () => {
      if (await appendLog.handleHttpRequest(request, response)) return;
      await nextHandler(request, response);
    })().catch((error) => {
      if (!response.headersSent) {
        response.writeHead(500, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ error: 'internal server error' }));
      }
      console.error(error instanceof Error ? error.message : String(error));
    });
  });
  appendLog.attachWebSocketServer(server);

  await new Promise<void>((resolveListen, rejectListen) => {
    const onError = (error: Error): void => {
      server.off('listening', onListening);
      rejectListen(error);
    };
    const onListening = (): void => {
      server.off('error', onError);
      resolveListen();
    };

    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(options.port, options.host);
  });

  console.log(`fold hosted server listening on ${options.host}:${options.port}`);
  console.log(`public app/sync URL: ${publicOrigin.appUrl} (${publicOrigin.source})`);
  console.log(`health endpoint: ${publicOrigin.syncUrl}/health`);
  console.log(`append-log store: file (${options.dataDirectory})`);

  let stopping = false;
  const stop = async (signal: NodeJS.Signals): Promise<void> => {
    if (stopping) return;
    stopping = true;
    console.log(`received ${signal}; shutting down fold hosted server`);
    try {
      await appendLog.stop();
      await new Promise<void>((resolveClose, rejectClose) => {
        server.close((error) => error ? rejectClose(error) : resolveClose());
      });
      console.log('fold hosted server stopped');
    } catch (error) {
      console.error('fold hosted server shutdown failed');
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

class HostedCliHelp extends Error {}

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

function hostedUsage(): string {
  return [
    'Usage: npm start -- [--host <host>] [--port <port>] [--data <directory>] [--web-dir <directory>]',
    '',
    'Defaults: --host ${HOST:-0.0.0.0} --port ${PORT:-3000} --data ${FOLD_DATA_DIR:-./data/append-log}',
  ].join('\n');
}
