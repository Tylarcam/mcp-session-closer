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
   * Format Notion ID to ensure it has proper hyphens
   * Notion IDs should be in format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
   */
  private formatNotionId(id: string): string {
    if (!id) return id;
    
    // Remove any existing hyphens and whitespace
    const cleanId = id.replace(/[-\s]/g, '');
    
    // Check if it's a valid UUID format (32 hex characters)
    if (cleanId.length !== 32 || !/^[0-9a-fA-F]{32}$/.test(cleanId)) {
      // If it's already formatted or doesn't match UUID format, return as-is
      return id;
    }
    
    // Format as: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    return `${cleanId.substring(0, 8)}-${cleanId.substring(8, 12)}-${cleanId.substring(12, 16)}-${cleanId.substring(16, 20)}-${cleanId.substring(20, 32)}`;
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
   * List available MCP tools and their schemas for debugging
   */
  async listTools(): Promise<any> {
    if (!this.connected || !this.client) {
      await this.connect();
    }

    try {
      const tools = await this.client!.listTools();
      return tools;
    } catch (error: any) {
      throw new Error(`Failed to list tools: ${error.message}`);
    }
  }

  /**
   * Inspect the create_page tool schema to verify expected parameters
   */
  async inspectCreatePageTool(): Promise<any> {
    const tools = await this.listTools();
    const createPageTool = tools.tools?.find((t: any) => t.name === 'create_page' || t.name === 'create-page');
    
    if (createPageTool) {
      console.log('📋 create_page tool schema:', JSON.stringify(createPageTool, null, 2));
    } else {
      console.log('⚠️ create_page tool not found. Available tools:', tools.tools?.map((t: any) => t.name));
    }
    
    return createPageTool;
  }

  /**
   * Append blocks to an existing Notion page
   * This avoids the parent serialization issue by using page_id directly
   * Handles chunking for large block arrays (Notion limit: 100 blocks per request)
   */
  async appendBlocks(pageId: string, blocks: NotionBlock[]): Promise<any> {
    if (!this.connected || !this.client) {
      await this.connect();
    }

    try {
      // Format page ID with proper hyphens
      const formattedPageId = this.formatNotionId(pageId);
      
      // Ensure blocks is a plain array, not stringified
      const blocksArray = typeof blocks === 'string' 
        ? JSON.parse(blocks) 
        : blocks;

      // Notion API has a limit of 100 blocks per request
      const chunkSize = 100;
      const results = [];

      for (let i = 0; i < blocksArray.length; i += chunkSize) {
        const chunk = blocksArray.slice(i, i + chunkSize);
        
        try {
          const result = await this.client!.callTool({
            name: 'append_blocks',
            arguments: {
              page_id: formattedPageId,
              blocks: chunk
            }
          });

          if (result.isError) {
            const errorContent = result.content as Array<{ type: string; text?: string }>;
            throw new Error(errorContent[0]?.text || 'Unknown error');
          }

          results.push(result);
        } catch (mcpError: any) {
          // If MCP tool fails, try direct API
          const notionToken = process.env.NOTION_API_TOKEN || 
                             process.env.NOTION_API_KEY || 
                             '';
          
          if (!notionToken) {
            throw new Error('Notion API token not found for direct API call');
          }

          const response = await fetch(`https://api.notion.com/v1/blocks/${formattedPageId}/children`, {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${notionToken}`,
              'Content-Type': 'application/json',
              'Notion-Version': '2022-06-28'
            },
            body: JSON.stringify({
              children: chunk
            })
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Notion API error (${response.status}): ${errorText}`);
          }

          const apiResult = await response.json();
          results.push({ content: [{ type: 'text', text: JSON.stringify(apiResult) }] });
        }
      }

      return results.length === 1 ? results[0] : { content: [{ type: 'text', text: JSON.stringify({ chunks: results.length, totalBlocks: blocksArray.length }) }] };
    } catch (error: any) {
      throw new Error(`Failed to append blocks: ${error.message}`);
    }
  }

  /**
   * Create a new page in a Notion database
   * Handles parent serialization correctly - ensures parent is a proper object, not a string
   * Falls back to direct Notion API if MCP tool fails
   */
  async createPage(
    parent: NotionParent,
    properties: NotionPageProperties
  ): Promise<any> {
    if (!this.connected || !this.client) {
      await this.connect();
    }

    try {
      // First, inspect the tool schema to understand expected format
      try {
        await this.inspectCreatePageTool();
      } catch (e) {
        // Ignore inspection errors
      }

      // Ensure parent is properly structured as a plain object, not a string
      // Create a fresh plain object to avoid any serialization issues
      const parentObj: Record<string, string> = {
        type: parent.type
      };

      if (parent.type === 'database_id' && parent.database_id) {
        // Format database ID with proper hyphens
        parentObj.database_id = this.formatNotionId(parent.database_id);
      } else if (parent.type === 'page_id' && parent.page_id) {
        // Format page ID with proper hyphens
        parentObj.page_id = this.formatNotionId(parent.page_id);
      }

      // Ensure properties is also a plain object (not stringified)
      const propertiesObj = typeof properties === 'string' 
        ? JSON.parse(properties) 
        : properties;

      // Log what we're sending for debugging
      if (process.env.DEBUG_NOTION) {
        console.log('📤 Sending to MCP tool:', JSON.stringify({
          name: 'create_page',
          arguments: {
            parent: parentObj,
            properties: propertiesObj
          }
        }, null, 2));
      }

      // Try MCP tool first
      try {
        const result = await this.client!.callTool({
          name: 'create_page',
          arguments: {
            parent: parentObj, // Plain object, will be serialized to JSON properly
            properties: propertiesObj // Plain object, will be serialized to JSON properly
          }
        });

        if (result.isError) {
          const errorContent = result.content as Array<{ type: string; text?: string }>;
          const errorMsg = errorContent[0]?.text || 'Unknown error';
          
          // If MCP fails, try direct API
          console.warn('⚠️ MCP tool failed, trying direct Notion API:', errorMsg);
          return await this.createPageDirectAPI(parentObj, propertiesObj);
        }

        return result;
      } catch (mcpError: any) {
        // If MCP call fails, fall back to direct API
        console.warn('⚠️ MCP tool call failed, trying direct Notion API:', mcpError.message);
        return await this.createPageDirectAPI(parentObj, propertiesObj);
      }
    } catch (error: any) {
      throw new Error(`Failed to create page: ${error.message}`);
    }
  }

  /**
   * Create page using direct Notion API (fallback when MCP tool fails)
   */
  private async createPageDirectAPI(
    parent: Record<string, string>,
    properties: NotionPageProperties
  ): Promise<any> {
    const notionToken = process.env.NOTION_API_TOKEN || 
                       process.env.NOTION_API_KEY || 
                       '';
    
    if (!notionToken) {
      throw new Error('Notion API token not found for direct API call');
    }

    const requestBody = {
      parent: parent,
      properties: properties
    };

    if (process.env.DEBUG_NOTION) {
      console.log('📤 Direct API request body:', JSON.stringify(requestBody, null, 2));
    }

    try {
      const response = await fetch('https://api.notion.com/v1/pages', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${notionToken}`,
          'Content-Type': 'application/json',
          'Notion-Version': '2022-06-28'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Notion API error (${response.status}): ${errorText}`);
      }

      const result = await response.json();
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    } catch (error: any) {
      throw new Error(`Direct Notion API call failed: ${error.message}`);
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
      // Format database ID with proper hyphens
      const formattedDatabaseId = this.formatNotionId(databaseId);
      
      // Ensure filter is a plain object if provided
      const filterObj = filter && typeof filter === 'string' 
        ? JSON.parse(filter) 
        : filter;

      const result = await this.client!.callTool({
        name: 'query_database',
        arguments: {
          database_id: formattedDatabaseId,
          ...(filterObj && { filter: filterObj })
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
      // Format page ID with proper hyphens
      const formattedPageId = this.formatNotionId(pageId);

      const result = await this.client!.callTool({
        name: 'get_block_children',
        arguments: {
          block_id: formattedPageId
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

