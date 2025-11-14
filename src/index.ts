#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { SessionCloser } from './session-closer.js';
import * as path from 'path';
import * as os from 'os';

// Get project root from environment or use current working directory
const PROJECT_ROOT = process.env.CURSOR_WORKSPACE || process.env.WORKSPACE_FOLDER || process.cwd();

class SessionCloserMCPServer {
  private server: Server;
  private sessionCloser: SessionCloser;

  constructor() {
    this.server = new Server(
      {
        name: 'session-closer',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.sessionCloser = new SessionCloser(PROJECT_ROOT);
    this.setupHandlers();
  }

  private setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'end_session',
            description: 'Close the current Cursor session, sync all context files, update Agent OS files, and commit to git. This is the main tool for ending a work session.',
            inputSchema: {
              type: 'object',
              properties: {
                conversationSummary: {
                  type: 'string',
                  description: 'Summary of what was accomplished in this session. If not provided, will attempt to extract from context.',
                },
                accomplishments: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'List of specific accomplishments (optional, will be extracted if not provided)',
                },
                decisions: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'List of decisions made during this session (optional)',
                },
                blockers: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'List of blockers or issues encountered (optional)',
                },
                nextSteps: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'List of next steps or TODO items (optional)',
                },
              },
              required: ['conversationSummary'],
            },
          },
          {
            name: 'sync_context_files',
            description: 'Sync all context files (claude.md, gemini.md, agents.md, .cursor/context.md) without closing the session. Useful for mid-session syncs.',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'update_session_summary',
            description: 'Update the session summary file with current session info without doing a full session close.',
            inputSchema: {
              type: 'object',
              properties: {
                summary: {
                  type: 'string',
                  description: 'Session summary text to append to session-summary.md',
                },
              },
              required: ['summary'],
            },
          },
        ],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args = {} } = request.params;

      try {
        switch (name) {
          case 'end_session': {
            const conversationSummary = args.conversationSummary as string || 
              'Session work completed. Review conversation history for details.';
            
            const result = await this.sessionCloser.closeSession(conversationSummary);

            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    success: result.success,
                    summary: result.summary,
                    filesUpdated: result.filesUpdated,
                    gitCommit: result.gitCommit,
                    message: 'Session closed successfully! All context files synced and changes committed.',
                  }, null, 2),
                },
              ],
            };
          }

          case 'sync_context_files': {
            // Create a minimal summary for syncing
            const summary = {
              timestamp: new Date().toISOString(),
              accomplishments: ['Context files synced'],
              decisions: [],
              blockers: [],
              nextSteps: [],
              filesChanged: [],
            };
            
            // Access private method via type assertion
            const filesUpdated = await (this.sessionCloser as any).syncContextFiles(summary);

            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    success: true,
                    filesUpdated,
                    message: 'Context files synced successfully!',
                  }, null, 2),
                },
              ],
            };
          }

          case 'update_session_summary': {
            const summary = {
              timestamp: new Date().toISOString(),
              accomplishments: [],
              decisions: [],
              blockers: [],
              nextSteps: [],
              filesChanged: [],
            };
            
            await (this.sessionCloser as any).updateSessionSummary(summary);

            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    success: true,
                    message: 'Session summary updated!',
                  }),
                },
              ],
            };
          }

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: error.message,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
              }),
            },
          ],
          isError: true,
        };
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Session Closer MCP server running on stdio');
  }
}

const server = new SessionCloserMCPServer();
server.run().catch(console.error);

