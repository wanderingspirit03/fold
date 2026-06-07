import {
  buildApplication,
  buildCommand,
  buildRouteMap,
  run,
  type Application,
} from '@stricli/core';
import type { MdroomCommandContext } from './context.js';
import {
  acceptProposal,
  exportMarkdown,
  listProposals,
  patchMarkdown,
  proposeMarkdown,
  publishMarkdown,
  rejectProposal,
  roomStatus,
  showProposal,
} from './operations.js';
import {
  writeDecisionHuman,
  writeExportHuman,
  writeJson,
  writePatchHuman,
  writeProposalsHuman,
  writeProposeHuman,
  writePublishHuman,
  writeShowProposalHuman,
  writeStatusHuman,
} from './output.js';

type PublishFlags = {
  server?: string;
  json: boolean;
  save: boolean;
};

type ExportFlags = {
  room: string;
  output?: string;
  json: boolean;
};

type StatusFlags = {
  room: string;
  json: boolean;
};

type PatchFlags = {
  room: string;
  summary?: string;
  json: boolean;
};

type ProposeFlags = {
  room: string;
  title?: string;
  comment?: string;
  json: boolean;
};

type ProposalRoomFlags = {
  room: string;
  json: boolean;
};

export const app: Application<MdroomCommandContext> = buildApplication(
  buildRouteMap({
    routes: {
      publish: buildCommand<PublishFlags, [string], MdroomCommandContext>({
        parameters: {
          flags: {
            server: {
              kind: 'parsed',
              parse: parseString,
              optional: true,
              brief: 'Room server origin for generated links',
              placeholder: 'url',
            },
            json: {
              kind: 'boolean',
              default: false,
              withNegated: false,
              brief: 'Print a stable JSON result',
            },
            save: {
              kind: 'boolean',
              default: true,
              withNegated: true,
              brief: 'Save room metadata in .mdroom/rooms.json',
            },
          },
          positional: {
            kind: 'tuple',
            parameters: [
              {
                parse: parseString,
                placeholder: 'file.md',
                brief: 'Markdown file to publish',
              },
            ],
          },
        },
        docs: {
          brief: 'Publish Markdown into a local encrypted room foundation',
          customUsage: ['mdroom publish <file.md> [--server <url>] [--json] [--no-save]'],
        },
        async func(this: MdroomCommandContext, flags, filePath) {
          const result = await publishMarkdown({
            cwd: this.cwd,
            filePath,
            serverUrl: flags.server,
            save: flags.save,
          });
          if (flags.json) writeJson(this, result);
          else writePublishHuman(this, result);
        },
      }),
      export: buildCommand<ExportFlags, [], MdroomCommandContext>({
        parameters: {
          flags: {
            room: {
              kind: 'parsed',
              parse: parseString,
              brief: 'Room URL or mdroom token',
              placeholder: 'url-or-token',
            },
            output: {
              kind: 'parsed',
              parse: parseString,
              optional: true,
              brief: 'File to write exported Markdown',
              placeholder: 'file',
            },
            json: {
              kind: 'boolean',
              default: false,
              withNegated: false,
              brief: 'Print a stable JSON result',
            },
          },
        },
        docs: {
          brief: 'Export Markdown from local encrypted room metadata',
          customUsage: ['mdroom export --room <url-or-token> [--output <file>] [--json]'],
        },
        async func(this: MdroomCommandContext, flags) {
          const result = await exportMarkdown({
            cwd: this.cwd,
            room: flags.room,
            outputPath: flags.output,
          });
          if (flags.json) writeJson(this, result);
          else writeExportHuman(this, result);
        },
      }),
      patch: buildCommand<PatchFlags, [string], MdroomCommandContext>({
        parameters: {
          flags: {
            room: {
              kind: 'parsed',
              parse: parseString,
              brief: 'Room URL or mdroom token',
              placeholder: 'url-or-token',
            },
            summary: {
              kind: 'parsed',
              parse: parseString,
              optional: true,
              brief: 'Human-readable patch summary',
              placeholder: 'text',
            },
            json: {
              kind: 'boolean',
              default: false,
              withNegated: false,
              brief: 'Print a stable JSON result',
            },
          },
          positional: {
            kind: 'tuple',
            parameters: [
              {
                parse: parseString,
                placeholder: 'file.md',
                brief: 'Markdown file to submit as a suggestion',
              },
            ],
          },
        },
        docs: {
          brief: 'Submit an encrypted whole-document patch suggestion',
          customUsage: ['mdroom patch <file.md> --room <url-or-token> [--summary <text>] [--json]'],
        },
        async func(this: MdroomCommandContext, flags, filePath) {
          const result = await patchMarkdown({
            cwd: this.cwd,
            filePath,
            room: flags.room,
            summary: flags.summary,
          });
          if (flags.json) writeJson(this, result);
          else writePatchHuman(this, result);
        },
      }),
      propose: buildCommand<ProposeFlags, [string], MdroomCommandContext>({
        parameters: {
          flags: {
            room: {
              kind: 'parsed',
              parse: parseString,
              brief: 'Room URL or mdroom token',
              placeholder: 'url-or-token',
            },
            title: {
              kind: 'parsed',
              parse: parseString,
              optional: true,
              brief: 'Proposal title assigned to the encrypted record',
              placeholder: 'text',
            },
            comment: {
              kind: 'parsed',
              parse: parseString,
              optional: true,
              brief: 'Proposal comment assigned to the encrypted record',
              placeholder: 'text',
            },
            json: {
              kind: 'boolean',
              default: false,
              withNegated: false,
              brief: 'Print a stable JSON result',
            },
          },
          positional: {
            kind: 'tuple',
            parameters: [
              {
                parse: parseString,
                placeholder: 'file.md',
                brief: 'Markdown file to submit as a proposal',
              },
            ],
          },
        },
        docs: {
          brief: 'Submit an encrypted whole-document proposal',
          customUsage: ['mdroom propose <file.md> --room <url-or-token> [--title <text>] [--comment <text>] [--json]'],
        },
        async func(this: MdroomCommandContext, flags, filePath) {
          const result = await proposeMarkdown({
            cwd: this.cwd,
            filePath,
            room: flags.room,
            title: flags.title,
            comment: flags.comment,
          });
          if (flags.json) writeJson(this, result);
          else writeProposeHuman(this, result);
        },
      }),
      proposals: buildCommand<ProposalRoomFlags, [], MdroomCommandContext>({
        parameters: {
          flags: roomOnlyFlags(),
        },
        docs: {
          brief: 'List encrypted room proposals',
          customUsage: ['mdroom proposals --room <url-or-token> [--json]'],
        },
        async func(this: MdroomCommandContext, flags) {
          const result = await listProposals({
            cwd: this.cwd,
            room: flags.room,
          });
          if (flags.json) writeJson(this, result);
          else writeProposalsHuman(this, result);
        },
      }),
      'show-proposal': buildCommand<ProposalRoomFlags, [string], MdroomCommandContext>({
        parameters: {
          flags: roomOnlyFlags(),
          positional: {
            kind: 'tuple',
            parameters: [
              {
                parse: parseString,
                placeholder: 'proposal-id',
                brief: 'Proposal id to decrypt and show',
              },
            ],
          },
        },
        docs: {
          brief: 'Show one encrypted proposal',
          customUsage: ['mdroom show-proposal <proposal-id> --room <url-or-token> [--json]'],
        },
        async func(this: MdroomCommandContext, flags, proposalId) {
          const result = await showProposal({
            cwd: this.cwd,
            room: flags.room,
            proposalId,
          });
          if (flags.json) writeJson(this, result);
          else writeShowProposalHuman(this, result);
        },
      }),
      accept: buildCommand<ProposalRoomFlags, [string], MdroomCommandContext>({
        parameters: {
          flags: roomOnlyFlags(),
          positional: {
            kind: 'tuple',
            parameters: [
              {
                parse: parseString,
                placeholder: 'proposal-id',
                brief: 'Proposal id to accept',
              },
            ],
          },
        },
        docs: {
          brief: 'Accept an encrypted proposal and append canonical Markdown',
          customUsage: ['mdroom accept <proposal-id> --room <url-or-token> [--json]'],
        },
        async func(this: MdroomCommandContext, flags, proposalId) {
          const result = await acceptProposal({
            cwd: this.cwd,
            room: flags.room,
            proposalId,
          });
          if (flags.json) writeJson(this, result);
          else writeDecisionHuman(this, result);
        },
      }),
      reject: buildCommand<ProposalRoomFlags, [string], MdroomCommandContext>({
        parameters: {
          flags: roomOnlyFlags(),
          positional: {
            kind: 'tuple',
            parameters: [
              {
                parse: parseString,
                placeholder: 'proposal-id',
                brief: 'Proposal id to reject',
              },
            ],
          },
        },
        docs: {
          brief: 'Reject an encrypted proposal',
          customUsage: ['mdroom reject <proposal-id> --room <url-or-token> [--json]'],
        },
        async func(this: MdroomCommandContext, flags, proposalId) {
          const result = await rejectProposal({
            cwd: this.cwd,
            room: flags.room,
            proposalId,
          });
          if (flags.json) writeJson(this, result);
          else writeDecisionHuman(this, result);
        },
      }),
      status: buildCommand<StatusFlags, [], MdroomCommandContext>({
        parameters: {
          flags: {
            room: {
              kind: 'parsed',
              parse: parseString,
              brief: 'Room URL or mdroom token',
              placeholder: 'url-or-token',
            },
            json: {
              kind: 'boolean',
              default: false,
              withNegated: false,
              brief: 'Print a stable JSON result',
            },
          },
        },
        docs: {
          brief: 'Show local room metadata status',
          customUsage: ['mdroom status --room <url-or-token> [--json]'],
        },
        async func(this: MdroomCommandContext, flags) {
          const result = await roomStatus({
            cwd: this.cwd,
            room: flags.room,
          });
          if (flags.json) writeJson(this, result);
          else writeStatusHuman(this, result);
        },
      }),
    },
    docs: {
      brief: 'Encrypted Markdown room CLI',
      fullDescription: 'Publish, export, and inspect encrypted Markdown room metadata.',
    },
  }),
  {
    name: 'mdroom',
    scanner: {
      caseStyle: 'allow-kebab-for-camel',
    },
    documentation: {
      caseStyle: 'convert-camel-to-kebab',
    },
    determineExitCode: () => 1,
  },
);

export async function runMdroomCli(inputs: readonly string[], context: MdroomCommandContext): Promise<void> {
  await run(app, inputs, context);
}

function parseString(input: string): string {
  return input;
}

function roomOnlyFlags(): {
  room: {
    kind: 'parsed';
    parse: (input: string) => string;
    brief: string;
    placeholder: string;
  };
  json: {
    kind: 'boolean';
    default: false;
    withNegated: false;
    brief: string;
  };
} {
  return {
    room: {
      kind: 'parsed',
      parse: parseString,
      brief: 'Room URL or mdroom token',
      placeholder: 'url-or-token',
    },
    json: {
      kind: 'boolean',
      default: false,
      withNegated: false,
      brief: 'Print a stable JSON result',
    },
  };
}
