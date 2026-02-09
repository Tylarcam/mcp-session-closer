import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface NotionBlock {
  type: string;
  [key: string]: any;
}

export interface NotionPageProperties {
  [key: string]: any;
}

export interface NotionParent {
  type: 'database_id' | 'page_id' | 'workspace';
  database_id?: string;
  page_id?: string;
}

export class NotionMCPClient {
  private client: Client | null = null;
  private connected: boolean = false;
  private mcpUrl?: string;
  private useDocker: boolean;

  constructor(mcpUrl?: string) {
    this.mcpUrl = mcpUrl;
    // If no URL provided, use Docker stdio transport
    this.useDocker = !mcpUrl;
  }

  /**
   * Connect to Notion MCP server
   */
  async connect(): Promise<void> {
    if (this.connected && this.client) {
      return;
    }

    try {
      if (this.useDocker) {
        // Use Docker stdio transport
        const transport = new StdioClientTransport({
          command: 'docker',
          args: [
            'run',
            '-i',
            '--rm',
            'mcp/notion:latest'
          ],
          env: {
            ...process.env,
            NOTION_API_TOKEN: process.env.NOTION_API_TOKEN || 
                             process.env.NOTION_API_KEY || 
                             ''
          }
        });

        this.client = new Client(
          {
            name: 'session-closer',
            version: '1.0.0',
          },
          {
            capabilities: {},
          }
        );

        await this.client.connect(transport);
      } else {
        // Use HTTP transport (if mcpUrl provided)
        // For now, we'll use Docker stdio as default
        throw new Error('HTTP transport not yet implemented, using Docker stdio');
      }

      this.connected = true;
    } catch (error: any) {
      this.connected = false;
      throw new Error(`Failed to connect to Notion MCP server: ${error.message}`);
    }
  }

  /**
   * Append blocks to an existing Notion page
   * This avoids the parent serialization issue by using page_id directly
   */
  async appendBlocks(pageId: string, blocks: NotionBlock[]): Promise<any> {
    if (!this.connected || !this.client) {
      await this.connect();
    }

    try {
      const result = await this.client!.callTool({
        name: 'append_blocks',
        arguments: {
          page_id: pageId,
          blocks: blocks
        }
      });

      if (result.isError) {
        const errorContent = result.content as Array<{ type: string; text?: string }>;
        throw new Error(errorContent[0]?.text || 'Unknown error');
      }

      return result;
    } catch (error: any) {
      throw new Error(`Failed to append blocks: ${error.message}`);
    }
  }

  /**
   * Create a new page in a Notion database
   * Handles parent serialization correctly
   */
  async createPage(
    parent: NotionParent,
    properties: NotionPageProperties
  ): Promise<any> {
    if (!this.connected || !this.client) {
      await this.connect();
    }

    try {
      // Ensure parent is properly structured as an object, not a string
      const parentObj: any = {
        type: parent.type
      };

      if (parent.type === 'database_id' && parent.database_id) {
        parentObj.database_id = parent.database_id;
      } else if (parent.type === 'page_id' && parent.page_id) {
        parentObj.page_id = parent.page_id;
      }

      const result = await this.client!.callTool({
        name: 'create_page',
        arguments: {
          parent: parentObj, // Pass as object, not string
          properties: properties
        }
      });

      if (result.isError) {
        const errorContent = result.content as Array<{ type: string; text?: string }>;
        throw new Error(errorContent[0]?.text || 'Unknown error');
      }

      return result;
    } catch (error: any) {
      throw new Error(`Failed to create page: ${error.message}`);
    }
  }

  /**
   * Query a Notion database
   */
  async queryDatabase(databaseId: string, filter?: any): Promise<any> {
    if (!this.connected || !this.client) {
      await this.connect();
    }

    try {
      const result = await this.client!.callTool({
        name: 'query_database',
        arguments: {
          database_id: databaseId,
          ...(filter && { filter })
        }
      });

      if (result.isError) {
        const errorContent = result.content as Array<{ type: string; text?: string }>;
        throw new Error(errorContent[0]?.text || 'Unknown error');
      }

      return result;
    } catch (error: any) {
      throw new Error(`Failed to query database: ${error.message}`);
    }
  }

  /**
   * Get page content (blocks)
   */
  async getPageBlocks(pageId: string): Promise<any> {
    if (!this.connected || !this.client) {
      await this.connect();
    }

    try {
      const result = await this.client!.callTool({
        name: 'get_block_children',
        arguments: {
          block_id: pageId
        }
      });

      if (result.isError) {
        const errorContent = result.content as Array<{ type: string; text?: string }>;
        throw new Error(errorContent[0]?.text || 'Unknown error');
      }

      return result;
    } catch (error: any) {
      throw new Error(`Failed to get page blocks: ${error.message}`);
    }
  }

  /**
   * Close the connection
   */
  async close(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.connected = false;
      this.client = null;
    }
  }

  /**
   * Convert markdown text to Notion blocks
   */
  static markdownToBlocks(markdown: string): NotionBlock[] {
    const blocks: NotionBlock[] = [];
    const lines = markdown.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      
      if (!trimmed) {
        continue; // Skip empty lines
      }

      // Headers
      if (trimmed.startsWith('### ')) {
        blocks.push({
          type: 'heading_3',
          heading_3: {
            rich_text: [{
              type: 'text',
              text: { content: trimmed.substring(4) }
            }]
          }
        });
      } else if (trimmed.startsWith('## ')) {
        blocks.push({
          type: 'heading_2',
          heading_2: {
            rich_text: [{
              type: 'text',
              text: { content: trimmed.substring(3) }
            }]
          }
        });
      } else if (trimmed.startsWith('# ')) {
        blocks.push({
          type: 'heading_1',
          heading_1: {
            rich_text: [{
              type: 'text',
              text: { content: trimmed.substring(2) }
            }]
          }
        });
      } else if (trimmed.startsWith('- ')) {
        // Bullet list item
        blocks.push({
          type: 'bulleted_list_item',
          bulleted_list_item: {
            rich_text: [{
              type: 'text',
              text: { content: trimmed.substring(2) }
            }]
          }
        });
      } else {
        // Regular paragraph
        blocks.push({
          type: 'paragraph',
          paragraph: {
            rich_text: [{
              type: 'text',
              text: { content: trimmed }
            }]
          }
        });
      }
    }

    return blocks.length > 0 ? blocks : [{
      type: 'paragraph',
      paragraph: {
        rich_text: [{
          type: 'text',
          text: { content: markdown }
        }]
      }
    }];
  }
}

