import {
  buildApplication,
  buildCommand,
  buildRouteMap,
  run,
  type Application,
  buildChoiceParser,
} from '@stricli/core';
import type { FoldCommandContext } from './context.js';
import {
  acceptProposal,
  addComment,
  addRoomProfile,
  bootstrapRoom,
  createRoomProfile,
  createRoomInvite,
  exportMarkdown,
  forgetRoomProfile,
  listComments,
  listProposals,
  listRoomProfiles,
  patchMarkdown,
  postMarkdown,
  proposeMarkdown,
  publishMarkdown,
  rejectProposal,
  replyToComment,
  resumeRoom,
  roomContext,
  roomStatus,
  setRoomProfileUrls,
  showRoomProfile,
  showProposal,
} from './operations.js';
import { installFoldSkill } from './skill-install.js';
import {
  writeBootstrapHuman,
  writeDecisionHuman,
  writeCommentHuman,
  writeCommentsHuman,
  writeExportHuman,
  writeJson,
  writePatchHuman,
  writePostHuman,
  writeProposalsHuman,
  writeProposeHuman,
  writePublishHuman,
  writeResumeHuman,
  writeRoomForgetHuman,
  writeRoomCreateHuman,
  writeRoomInviteHuman,
  writeRoomListHuman,
  writeRoomProfileHuman,
  writeShowProposalHuman,
  writeSkillHuman,
  writeStatusHuman,
} from './output.js';
import type { SkillInstallScope } from './results.js';

type PublishFlags = {
  server?: string;
  appUrl?: string;
  syncUrl?: string;
  alias?: string;
  path?: string;
  json: boolean;
  save: boolean;
};

type ExportFlags = {
  room: string;
  output?: string;
  path?: string;
  json: boolean;
};

type StatusFlags = {
  room: string;
  json: boolean;
};

type PatchFlags = {
  room: string;
  path?: string;
  summary?: string;
  json: boolean;
};

type ProposeFlags = {
  room: string;
  path?: string;
  title?: string;
  comment?: string;
  json: boolean;
};

type PostFlags = {
  room: string;
  path?: string;
  json: boolean;
};

type ProposalRoomFlags = {
  room: string;
  json: boolean;
};

type CommentListFlags = {
  room: string;
  path?: string;
  type?: 'all' | 'comment' | 'request';
  open: boolean;
  json: boolean;
};

type RequestListFlags = {
  room: string;
  path?: string;
  open: boolean;
  json: boolean;
};

type ResumeFlags = {
  room: string;
  alias?: string;
  output?: string;
  json: boolean;
};

type BootstrapFlags = {
  room: string;
  alias?: string;
  output: string;
  skipSkill: boolean;
  skillScope: SkillInstallScope;
  nextCommandPrefix?: string;
  json: boolean;
};

type SkillFlags = {
  scope?: 'project' | 'global';
  all: boolean;
  json: boolean;
};

type CommentFlags = {
  room: string;
  path?: string;
  quote?: string;
  type?: 'comment' | 'request';
  text: string;
  json: boolean;
};

type ReplyFlags = {
  room: string;
  text: string;
  json: boolean;
};

type RoomAddFlags = {
  alias: string;
  json: boolean;
};

type RoomCreateFlags = {
  alias: string;
  server?: string;
  appUrl?: string;
  syncUrl?: string;
  json: boolean;
};

type RoomAliasFlags = {
  json: boolean;
};

type RoomSetUrlFlags = {
  appUrl?: string;
  syncUrl?: string;
  json: boolean;
};

type RoomInviteFlags = {
  for: 'human' | 'agent';
  json: boolean;
};

export const app: Application<FoldCommandContext> = buildApplication(
  buildRouteMap({
    routes: {
      publish: buildCommand<PublishFlags, [string], FoldCommandContext>({
        parameters: {
          flags: {
            server: {
              kind: 'parsed',
              parse: parseString,
              optional: true,
              brief: 'Compatibility shorthand for app and sync URL',
              placeholder: 'url',
            },
            appUrl: {
              kind: 'parsed',
              parse: parseString,
              optional: true,
              brief: 'Human web app origin for generated room links',
              placeholder: 'url',
            },
            syncUrl: {
              kind: 'parsed',
              parse: parseString,
              optional: true,
              brief: 'Append-log API/WebSocket origin',
              placeholder: 'url',
            },
            alias: {
              kind: 'parsed',
              parse: parseString,
              optional: true,
              brief: 'Local room alias to save',
              placeholder: 'name',
            },
            path: {
              kind: 'parsed',
              parse: parseString,
              optional: true,
              brief: 'Room path for a single published Markdown file',
              placeholder: 'path',
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
              brief: 'Save room profile in .fold/rooms.json',
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
          customUsage: ['<file.md> [--server <url>] [--json] [--no-save]'],
        },
        async func(this: FoldCommandContext, flags, filePath) {
          const result = await publishMarkdown({
            cwd: this.cwd,
            filePath,
            serverUrl: flags.server,
            appUrl: flags.appUrl,
            syncUrl: flags.syncUrl,
            alias: flags.alias,
            path: flags.path,
            save: flags.save,
          });
          if (flags.json) writeJson(this, result);
          else writePublishHuman(this, result);
        },
      }),
      export: buildCommand<ExportFlags, [], FoldCommandContext>({
        parameters: {
          flags: {
            room: {
              kind: 'parsed',
              parse: parseString,
              brief: 'Room alias, URL, or token',
              placeholder: 'alias-or-url-or-token',
            },
            output: {
              kind: 'parsed',
              parse: parseString,
              optional: true,
              brief: 'File to write exported Markdown',
              placeholder: 'file',
            },
            path: {
              kind: 'parsed',
              parse: parseString,
              optional: true,
              brief: 'Export one project file by room path',
              placeholder: 'path',
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
          customUsage: ['--room <alias-or-url-or-token> [--path <room-path>] [--output <file-or-directory>] [--json]'],
        },
        async func(this: FoldCommandContext, flags) {
          const result = await exportMarkdown({
            cwd: this.cwd,
            room: flags.room,
            outputPath: flags.output,
            path: flags.path,
          });
          if (flags.json) writeJson(this, result);
          else writeExportHuman(this, result);
        },
      }),
      patch: buildCommand<PatchFlags, [string], FoldCommandContext>({
        parameters: {
          flags: {
            room: {
              kind: 'parsed',
              parse: parseString,
              brief: 'Room alias, URL, or token',
              placeholder: 'alias-or-url-or-token',
            },
            path: {
              kind: 'parsed',
              parse: parseString,
              optional: true,
              brief: 'Room path for a single-file proposal',
              placeholder: 'path',
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
          customUsage: ['<file.md> --room <alias-or-url-or-token> [--path <room-path>] [--summary <text>] [--json]'],
        },
        async func(this: FoldCommandContext, flags, filePath) {
          const result = await patchMarkdown({
            cwd: this.cwd,
            filePath,
            room: flags.room,
            path: flags.path,
            summary: flags.summary,
          });
          if (flags.json) writeJson(this, result);
          else writePatchHuman(this, result);
        },
      }),
      post: buildCommand<PostFlags, [string], FoldCommandContext>({
        parameters: {
          flags: {
            room: {
              kind: 'parsed',
              parse: parseString,
              brief: 'Room alias, URL, or token',
              placeholder: 'alias-or-url-or-token',
            },
            path: {
              kind: 'parsed',
              parse: parseString,
              optional: true,
              brief: 'Fresh room path for the posted Markdown file',
              placeholder: 'path',
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
                brief: 'Fresh Markdown file to post into accepted room state',
              },
            ],
          },
        },
        docs: {
          brief: 'Post a fresh Markdown file into accepted room state',
          customUsage: ['<file.md> --room <alias-or-url-or-token> [--path <room-path>] [--json]'],
        },
        async func(this: FoldCommandContext, flags, filePath) {
          const result = await postMarkdown({
            cwd: this.cwd,
            filePath,
            room: flags.room,
            path: flags.path,
          });
          if (flags.json) writeJson(this, result);
          else writePostHuman(this, result);
        },
      }),
      propose: buildCommand<ProposeFlags, [string], FoldCommandContext>({
        parameters: {
          flags: {
            room: {
              kind: 'parsed',
              parse: parseString,
              brief: 'Room alias, URL, or token',
              placeholder: 'alias-or-url-or-token',
            },
            path: {
              kind: 'parsed',
              parse: parseString,
              optional: true,
              brief: 'Room path for a single-file proposal',
              placeholder: 'path',
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
          customUsage: ['<file-or-directory> --room <alias-or-url-or-token> [--path <room-path>] [--title <text>] [--comment <text>] [--json]'],
        },
        async func(this: FoldCommandContext, flags, filePath) {
          const result = await proposeMarkdown({
            cwd: this.cwd,
            filePath,
            room: flags.room,
            path: flags.path,
            title: flags.title,
            comment: flags.comment,
          });
          if (flags.json) writeJson(this, result);
          else writeProposeHuman(this, result);
        },
      }),
      proposals: buildCommand<ProposalRoomFlags, [], FoldCommandContext>({
        parameters: {
          flags: roomOnlyFlags(),
        },
        docs: {
          brief: 'List encrypted room proposals',
          customUsage: ['--room <alias-or-url-or-token> [--json]'],
        },
        async func(this: FoldCommandContext, flags) {
          const result = await listProposals({
            cwd: this.cwd,
            room: flags.room,
          });
          if (flags.json) writeJson(this, result);
          else writeProposalsHuman(this, result);
        },
      }),
      context: buildCommand<ProposalRoomFlags, [], FoldCommandContext>({
        parameters: {
          flags: roomOnlyFlags(),
        },
        docs: {
          brief: 'Print a redacted agent context packet for a room',
          customUsage: ['--room <alias-or-url-or-token> [--json]'],
        },
        async func(this: FoldCommandContext, flags) {
          const result = await roomContext({
            cwd: this.cwd,
            room: flags.room,
          });
          writeJson(this, result);
        },
      }),
      resume: buildCommand<ResumeFlags, [], FoldCommandContext>({
        parameters: {
          flags: {
            room: {
              kind: 'parsed',
              parse: parseString,
              brief: 'Room alias, URL, or token',
              placeholder: 'alias-or-url-or-token',
            },
            alias: {
              kind: 'parsed',
              parse: parseString,
              optional: true,
              brief: 'Local alias to save when resuming from a URL or token',
              placeholder: 'name',
            },
            output: {
              kind: 'parsed',
              parse: parseString,
              optional: true,
              brief: 'Directory or file path for accepted Markdown export',
              placeholder: 'path',
            },
            json: jsonFlag(),
          },
        },
        docs: {
          brief: 'Resume an encrypted room from a saved alias or explicit room reference',
          customUsage: ['--room <alias-or-url-or-token> [--alias <name>] [--output <path>] [--json]'],
        },
        async func(this: FoldCommandContext, flags) {
          const result = await resumeRoom({
            cwd: this.cwd,
            room: flags.room,
            alias: flags.alias,
            outputPath: flags.output,
            commandPrefix: this.commandPrefix,
          });
          if (flags.json) writeJson(this, result);
          else writeResumeHuman(this, result);
        },
      }),
      bootstrap: buildCommand<BootstrapFlags, [], FoldCommandContext>({
        parameters: {
          flags: {
            room: {
              kind: 'parsed',
              parse: parseString,
              brief: 'Room alias, URL, or token',
              placeholder: 'alias-or-url-or-token',
            },
            alias: {
              kind: 'parsed',
              parse: parseString,
              optional: true,
              brief: 'Local alias to save when bootstrapping from a URL or token',
              placeholder: 'name',
            },
            output: {
              kind: 'parsed',
              parse: parseString,
              brief: 'Directory for accepted Markdown project files',
              placeholder: 'dir',
            },
            skipSkill: {
              kind: 'boolean',
              default: false,
              withNegated: false,
              brief: 'Skip bundled Fold skill install/update',
            },
            skillScope: {
              kind: 'parsed',
              parse: buildChoiceParser(['project', 'global', 'all'] as const),
              default: 'all',
              brief: 'Skill install target scope',
              placeholder: 'project|global|all',
            },
            nextCommandPrefix: {
              kind: 'parsed',
              parse: parseString,
              optional: true,
              brief: 'Override printed follow-up command prefix',
              placeholder: 'command',
            },
            json: jsonFlag(),
          },
        },
        docs: {
          brief: 'Install the Fold skill and resume an encrypted room for agent work',
          customUsage: ['--room <alias-or-url-or-token> [--alias <name>] [--output <dir>] [--json]'],
        },
        async func(this: FoldCommandContext, flags) {
          const result = await bootstrapRoom({
            cwd: this.cwd,
            room: flags.room,
            alias: flags.alias,
            outputPath: flags.output,
            skipSkill: flags.skipSkill,
            skillScope: flags.skillScope,
            nextCommandPrefix: flags.nextCommandPrefix,
          });
          if (flags.json) writeJson(this, result);
          else writeBootstrapHuman(this, result);
        },
      }),
      skill: buildRouteMap({
        routes: {
          install: skillCommand('update'),
          update: skillCommand('update'),
          status: skillCommand('status'),
        },
        defaultCommand: 'install',
        docs: {
          brief: 'Install or inspect the bundled Fold agent skill',
        },
      }),
      comments: buildCommand<CommentListFlags, [], FoldCommandContext>({
        parameters: {
          flags: {
            room: {
              kind: 'parsed',
              parse: parseString,
              brief: 'Room alias, URL, or token',
              placeholder: 'alias-or-url-or-token',
            },
            path: {
              kind: 'parsed',
              parse: parseString,
              optional: true,
              brief: 'Limit comments to a room file path',
              placeholder: 'path',
            },
            type: {
              kind: 'parsed',
              parse: buildChoiceParser(['all', 'comment', 'request'] as const),
              optional: true,
              brief: 'Limit comments by thread type',
              placeholder: 'all|comment|request',
            },
            open: {
              kind: 'boolean',
              default: false,
              withNegated: false,
              brief: 'Only show unresolved comments or requests',
            },
            json: jsonFlag(),
          },
        },
        docs: {
          brief: 'List encrypted room comments',
          customUsage: ['--room <alias-or-url-or-token> [--path <room-path>] [--type all|comment|request] [--open] [--json]'],
        },
        async func(this: FoldCommandContext, flags) {
          const result = await listComments({
            cwd: this.cwd,
            room: flags.room,
            path: flags.path,
            type: flags.type,
            open: flags.open,
          });
          if (flags.json) writeJson(this, result);
          else writeCommentsHuman(this, result);
        },
      }),
      requests: buildCommand<RequestListFlags, [], FoldCommandContext>({
        parameters: {
          flags: {
            room: {
              kind: 'parsed',
              parse: parseString,
              brief: 'Room alias, URL, or token',
              placeholder: 'alias-or-url-or-token',
            },
            path: {
              kind: 'parsed',
              parse: parseString,
              optional: true,
              brief: 'Limit requests to a room file path',
              placeholder: 'path',
            },
            open: {
              kind: 'boolean',
              default: true,
              withNegated: true,
              brief: 'Only show unresolved requests',
            },
            json: jsonFlag(),
          },
        },
        docs: {
          brief: 'List open encrypted agent requests',
          customUsage: ['--room <alias-or-url-or-token> [--path <room-path>] [--no-open] [--json]'],
        },
        async func(this: FoldCommandContext, flags) {
          const result = await listComments({
            cwd: this.cwd,
            room: flags.room,
            path: flags.path,
            type: 'request',
            open: flags.open,
          });
          if (flags.json) writeJson(this, result);
          else writeCommentsHuman(this, result);
        },
      }),
      comment: buildCommand<CommentFlags, [], FoldCommandContext>({
        parameters: {
          flags: {
            room: {
              kind: 'parsed',
              parse: parseString,
              brief: 'Room alias, URL, or token',
              placeholder: 'alias-or-url-or-token',
            },
            path: {
              kind: 'parsed',
              parse: parseString,
              optional: true,
              brief: 'Room file path for this comment',
              placeholder: 'path',
            },
            quote: {
              kind: 'parsed',
              parse: parseString,
              optional: true,
              brief: 'Selected text to anchor this comment',
              placeholder: 'text',
            },
            type: {
              kind: 'parsed',
              parse: buildChoiceParser(['comment', 'request'] as const),
              optional: true,
              brief: 'Thread type to create',
              placeholder: 'comment|request',
            },
            text: {
              kind: 'parsed',
              parse: parseString,
              brief: 'Comment text assigned to the encrypted record',
              placeholder: 'text',
            },
            json: jsonFlag(),
          },
        },
        docs: {
          brief: 'Add an encrypted comment to a room file',
          customUsage: ['--room <alias-or-url-or-token> --text <text> [--path <room-path>] [--quote <text>] [--type comment|request] [--json]'],
        },
        async func(this: FoldCommandContext, flags) {
          const result = await addComment({
            cwd: this.cwd,
            room: flags.room,
            path: flags.path,
            quote: flags.quote,
            type: flags.type === 'request' ? 'request' : 'note',
            text: flags.text,
          });
          if (flags.json) writeJson(this, result);
          else writeCommentHuman(this, result);
        },
      }),
      reply: buildCommand<ReplyFlags, [string], FoldCommandContext>({
        parameters: {
          flags: {
            room: {
              kind: 'parsed',
              parse: parseString,
              brief: 'Room alias, URL, or token',
              placeholder: 'alias-or-url-or-token',
            },
            text: {
              kind: 'parsed',
              parse: parseString,
              brief: 'Reply text assigned to the encrypted record',
              placeholder: 'text',
            },
            json: jsonFlag(),
          },
          positional: {
            kind: 'tuple',
            parameters: [
              {
                parse: parseString,
                placeholder: 'comment-id',
                brief: 'Comment id to reply to',
              },
            ],
          },
        },
        docs: {
          brief: 'Reply to an encrypted room comment',
          customUsage: ['<comment-id> --room <alias-or-url-or-token> --text <text> [--json]'],
        },
        async func(this: FoldCommandContext, flags, commentId) {
          const result = await replyToComment({
            cwd: this.cwd,
            room: flags.room,
            commentId,
            text: flags.text,
          });
          if (flags.json) writeJson(this, result);
          else writeCommentHuman(this, result);
        },
      }),
      'show-proposal': buildCommand<ProposalRoomFlags, [string], FoldCommandContext>({
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
          customUsage: ['<proposal-id> --room <alias-or-url-or-token> [--json]'],
        },
        async func(this: FoldCommandContext, flags, proposalId) {
          const result = await showProposal({
            cwd: this.cwd,
            room: flags.room,
            proposalId,
          });
          if (flags.json) writeJson(this, result);
          else writeShowProposalHuman(this, result);
        },
      }),
      accept: buildCommand<ProposalRoomFlags, [string], FoldCommandContext>({
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
          customUsage: ['<proposal-id> --room <alias-or-url-or-token> [--json]'],
        },
        async func(this: FoldCommandContext, flags, proposalId) {
          const result = await acceptProposal({
            cwd: this.cwd,
            room: flags.room,
            proposalId,
          });
          if (flags.json) writeJson(this, result);
          else writeDecisionHuman(this, result);
        },
      }),
      reject: buildCommand<ProposalRoomFlags, [string], FoldCommandContext>({
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
          customUsage: ['<proposal-id> --room <alias-or-url-or-token> [--json]'],
        },
        async func(this: FoldCommandContext, flags, proposalId) {
          const result = await rejectProposal({
            cwd: this.cwd,
            room: flags.room,
            proposalId,
          });
          if (flags.json) writeJson(this, result);
          else writeDecisionHuman(this, result);
        },
      }),
      room: buildRouteMap({
        routes: {
          create: buildCommand<RoomCreateFlags, [], FoldCommandContext>({
            parameters: {
              flags: {
                alias: {
                  kind: 'parsed',
                  parse: parseString,
                  brief: 'Local alias for this new room',
                  placeholder: 'name',
                },
                server: {
                  kind: 'parsed',
                  parse: parseString,
                  optional: true,
                  brief: 'Compatibility shorthand for app and sync URL',
                  placeholder: 'url',
                },
                appUrl: {
                  kind: 'parsed',
                  parse: parseString,
                  optional: true,
                  brief: 'Human web app origin for generated room links',
                  placeholder: 'url',
                },
                syncUrl: {
                  kind: 'parsed',
                  parse: parseString,
                  optional: true,
                  brief: 'Append-log API/WebSocket origin',
                  placeholder: 'url',
                },
                json: jsonFlag(),
              },
            },
            docs: {
              brief: 'Create an empty encrypted project room',
              customUsage: ['--alias <name> [--server <url>] [--app-url <url>] [--sync-url <url>] [--json]'],
            },
            async func(this: FoldCommandContext, flags) {
              const result = await createRoomProfile({
                cwd: this.cwd,
                alias: flags.alias,
                serverUrl: flags.server,
                appUrl: flags.appUrl,
                syncUrl: flags.syncUrl,
              });
              if (flags.json) writeJson(this, result);
              else writeRoomCreateHuman(this, result);
            },
          }),
          add: buildCommand<RoomAddFlags, [string], FoldCommandContext>({
            parameters: {
              flags: {
                alias: {
                  kind: 'parsed',
                  parse: parseString,
                  brief: 'Local alias for this room',
                  placeholder: 'name',
                },
                json: jsonFlag(),
              },
              positional: {
                kind: 'tuple',
                parameters: [
                  {
                    parse: parseString,
                    placeholder: 'url-or-token',
                    brief: 'Secret Fold room URL or token',
                  },
                ],
              },
            },
            docs: {
              brief: 'Import a room URL/token and save a local alias',
              customUsage: ['<url-or-token> --alias <name> [--json]'],
            },
            async func(this: FoldCommandContext, flags, room) {
              const result = await addRoomProfile({ cwd: this.cwd, room, alias: flags.alias });
              if (flags.json) writeJson(this, result);
              else writeRoomProfileHuman(this, result);
            },
          }),
          list: buildCommand<RoomAliasFlags, [], FoldCommandContext>({
            parameters: {
              flags: { json: jsonFlag() },
            },
            docs: {
              brief: 'List saved room aliases',
              customUsage: ['[--json]'],
            },
            async func(this: FoldCommandContext, flags) {
              const result = await listRoomProfiles({ cwd: this.cwd });
              if (flags.json) writeJson(this, result);
              else writeRoomListHuman(this, result);
            },
          }),
          show: buildCommand<RoomAliasFlags, [string], FoldCommandContext>({
            parameters: {
              flags: { json: jsonFlag() },
              positional: {
                kind: 'tuple',
                parameters: [
                  {
                    parse: parseString,
                    placeholder: 'alias',
                    brief: 'Saved room alias',
                  },
                ],
              },
            },
            docs: {
              brief: 'Show one saved room profile',
              customUsage: ['<alias> [--json]'],
            },
            async func(this: FoldCommandContext, flags, alias) {
              const result = await showRoomProfile({ cwd: this.cwd, alias });
              if (flags.json) writeJson(this, result);
              else writeRoomProfileHuman(this, result);
            },
          }),
          'set-url': buildCommand<RoomSetUrlFlags, [string], FoldCommandContext>({
            parameters: {
              flags: {
                appUrl: {
                  kind: 'parsed',
                  parse: parseString,
                  optional: true,
                  brief: 'Human web app origin',
                  placeholder: 'url',
                },
                syncUrl: {
                  kind: 'parsed',
                  parse: parseString,
                  optional: true,
                  brief: 'Append-log API/WebSocket origin',
                  placeholder: 'url',
                },
                json: jsonFlag(),
              },
              positional: {
                kind: 'tuple',
                parameters: [
                  {
                    parse: parseString,
                    placeholder: 'alias',
                    brief: 'Saved room alias',
                  },
                ],
              },
            },
            docs: {
              brief: 'Update app/sync URLs for a saved room',
              customUsage: ['<alias> [--app-url <url>] [--sync-url <url>] [--json]'],
            },
            async func(this: FoldCommandContext, flags, alias) {
              const result = await setRoomProfileUrls({
                cwd: this.cwd,
                alias,
                appUrl: flags.appUrl,
                syncUrl: flags.syncUrl,
              });
              if (flags.json) writeJson(this, result);
              else writeRoomProfileHuman(this, result);
            },
          }),
          forget: buildCommand<RoomAliasFlags, [string], FoldCommandContext>({
            parameters: {
              flags: { json: jsonFlag() },
              positional: {
                kind: 'tuple',
                parameters: [
                  {
                    parse: parseString,
                    placeholder: 'alias',
                    brief: 'Saved room alias',
                  },
                ],
              },
            },
            docs: {
              brief: 'Forget a saved local room alias',
              customUsage: ['<alias> [--json]'],
            },
            async func(this: FoldCommandContext, flags, alias) {
              const result = await forgetRoomProfile({ cwd: this.cwd, alias });
              if (flags.json) writeJson(this, result);
              else writeRoomForgetHuman(this, result);
            },
          }),
          invite: buildCommand<RoomInviteFlags, [string], FoldCommandContext>({
            parameters: {
              flags: {
                for: {
                  kind: 'parsed',
                  parse: buildChoiceParser(['human', 'agent'] as const),
                  default: 'human',
                  brief: 'Invite audience',
                  placeholder: 'human|agent',
                },
                json: jsonFlag(),
              },
              positional: {
                kind: 'tuple',
                parameters: [
                  {
                    parse: parseString,
                    placeholder: 'alias',
                    brief: 'Saved room alias',
                  },
                ],
              },
            },
            docs: {
              brief: 'Print a human or agent invite for a saved room',
              customUsage: ['<alias> [--for human|agent] [--json]'],
            },
            async func(this: FoldCommandContext, flags, alias) {
              const result = await createRoomInvite({ cwd: this.cwd, alias, audience: flags.for });
              if (flags.json) writeJson(this, result);
              else writeRoomInviteHuman(this, result);
            },
          }),
        },
        docs: {
          brief: 'Manage saved room aliases and invites',
        },
      }),
      status: buildCommand<StatusFlags, [], FoldCommandContext>({
        parameters: {
          flags: {
            room: {
              kind: 'parsed',
              parse: parseString,
              brief: 'Room alias, URL, or token',
              placeholder: 'alias-or-url-or-token',
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
          customUsage: ['--room <alias-or-url-or-token> [--json]'],
        },
        async func(this: FoldCommandContext, flags) {
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
    name: 'fold-agent',
    scanner: {
      caseStyle: 'allow-kebab-for-camel',
    },
    documentation: {
      caseStyle: 'convert-camel-to-kebab',
    },
    determineExitCode: () => 1,
  },
);

export async function runFoldCli(inputs: readonly string[], context: FoldCommandContext): Promise<void> {
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
      brief: 'Room alias, URL, or token',
      placeholder: 'alias-or-url-or-token',
    },
    json: jsonFlag(),
  };
}

function jsonFlag(): {
  kind: 'boolean';
  default: false;
  withNegated: false;
  brief: string;
} {
  return {
    kind: 'boolean',
    default: false,
    withNegated: false,
    brief: 'Print a stable JSON result',
  };
}

function skillCommand(mode: 'update' | 'status') {
  return buildCommand<SkillFlags, [], FoldCommandContext>({
    parameters: {
      flags: {
        scope: {
          kind: 'parsed',
          parse: buildChoiceParser(['project', 'global'] as const),
          optional: true,
          brief: 'Skill install target scope',
          placeholder: 'project|global',
        },
        all: {
          kind: 'boolean',
          default: false,
          withNegated: false,
          brief: 'Target project and known global skill locations',
        },
        json: jsonFlag(),
      },
    },
    docs: {
      brief: mode === 'status' ? 'Inspect bundled Fold skill targets' : 'Install or update the bundled Fold skill',
      customUsage: ['[--scope project|global] [--all] [--json]'],
    },
    async func(this: FoldCommandContext, flags) {
      const scope = skillScopeFromFlags(flags);
      const result = await installFoldSkill({
        cwd: this.cwd,
        scope,
        mode,
      });
      if (flags.json) writeJson(this, result);
      else writeSkillHuman(this, result);
    },
  });
}

function skillScopeFromFlags(flags: SkillFlags): SkillInstallScope {
  if (flags.all) return 'all';
  return flags.scope ?? 'all';
}
