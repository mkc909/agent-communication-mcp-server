import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { Database } from './database.js';

export interface SharedContext {
  context_id: number;
  title: string;
  content: string;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export interface AgentContextAccess {
  agent_id: string;
  context_id: number;
  access_level: 'read' | 'write';
}

export class ContextSharing {
  constructor(private database: Database) {}

  public registerHandlers(server: Server) {
    // Register tools for context sharing
    server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'create_context',
          description: 'Create shared context',
          inputSchema: {
            type: 'object',
            properties: {
              title: {
                type: 'string',
                description: 'Context title',
              },
              content: {
                type: 'string',
                description: 'Context content',
              },
              created_by: {
                type: 'string',
                description: 'Agent ID of context creator',
              },
            },
            required: ['title', 'content', 'created_by'],
          },
        },
        {
          name: 'update_context',
          description: 'Update shared context',
          inputSchema: {
            type: 'object',
            properties: {
              context_id: {
                type: 'number',
                description: 'Context ID to update',
              },
              content: {
                type: 'string',
                description: 'New context content',
              },
            },
            required: ['context_id', 'content'],
          },
        },
        {
          name: 'share_context',
          description: 'Share context with agent',
          inputSchema: {
            type: 'object',
            properties: {
              context_id: {
                type: 'number',
                description: 'Context ID to share',
              },
              agent_id: {
                type: 'string',
                description: 'Agent ID to share with',
              },
              access_level: {
                type: 'string',
                enum: ['read', 'write'],
                description: 'Access level for the agent',
              },
            },
            required: ['context_id', 'agent_id', 'access_level'],
          },
        },
        {
          name: 'get_context',
          description: 'Get shared context',
          inputSchema: {
            type: 'object',
            properties: {
              context_id: {
                type: 'number',
                description: 'Context ID to retrieve',
              },
            },
            required: ['context_id'],
          },
        },
        {
          name: 'list_contexts',
          description: 'List shared contexts',
          inputSchema: {
            type: 'object',
            properties: {
              agent_id: {
                type: 'string',
                description: 'Filter by agent ID with access',
              },
            },
          },
        },
      ],
    }));

    // Handle tool calls
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      switch (request.params.name) {
        case 'create_context':
          return this.createContext(request.params.arguments);
        case 'update_context':
          return this.updateContext(request.params.arguments);
        case 'share_context':
          return this.shareContext(request.params.arguments);
        case 'get_context':
          return this.getContext(request.params.arguments);
        case 'list_contexts':
          return this.listContexts(request.params.arguments);
        default:
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Unknown tool: ${request.params.name}`
          );
      }
    });
  }

  private async createContext(args: any): Promise<any> {
    try {
      // Validate arguments
      if (!this.isValidCreateContextArgs(args)) {
        throw new McpError(
          ErrorCode.InvalidParams,
          'Invalid context creation arguments'
        );
      }

      // Check if creator agent exists
      const creatorAgent = await this.database.getAgent(args.created_by);
      if (!creatorAgent) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `Creator agent with ID ${args.created_by} not found`
        );
      }

      // Create context
      const now = new Date();
      const context = {
        title: args.title,
        content: args.content,
        created_by: args.created_by,
        created_at: now,
        updated_at: now,
      };

      // Save to database
      const contextId = await this.database.createContext(context);

      // Automatically give creator write access
      await this.database.shareContext({
        agent_id: args.created_by,
        context_id: contextId,
        access_level: 'write',
      });

      // Return the created context with ID
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ ...context, context_id: contextId }, null, 2),
          },
        ],
      };
    } catch (error) {
      if (error instanceof McpError) {
        throw error;
      }
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to create context: ${(error as Error).message}`
      );
    }
  }

  private async updateContext(args: any): Promise<any> {
    try {
      // Validate arguments
      if (!this.isValidUpdateContextArgs(args)) {
        throw new McpError(
          ErrorCode.InvalidParams,
          'Invalid context update arguments'
        );
      }

      // Check if context exists
      const context = await this.database.getContext(args.context_id);
      if (!context) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `Context with ID ${args.context_id} not found`
        );
      }

      // Update context in database
      await this.database.updateContext(args.context_id, args.content);

      // Get updated context
      const updatedContext = await this.database.getContext(args.context_id);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(updatedContext, null, 2),
          },
        ],
      };
    } catch (error) {
      if (error instanceof McpError) {
        throw error;
      }
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to update context: ${(error as Error).message}`
      );
    }
  }

  private async shareContext(args: any): Promise<any> {
    try {
      // Validate arguments
      if (!this.isValidShareContextArgs(args)) {
        throw new McpError(
          ErrorCode.InvalidParams,
          'Invalid context sharing arguments'
        );
      }

      // Check if context exists
      const context = await this.database.getContext(args.context_id);
      if (!context) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `Context with ID ${args.context_id} not found`
        );
      }

      // Check if agent exists
      const agent = await this.database.getAgent(args.agent_id);
      if (!agent) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `Agent with ID ${args.agent_id} not found`
        );
      }

      // Share context
      const contextAccess: AgentContextAccess = {
        agent_id: args.agent_id,
        context_id: args.context_id,
        access_level: args.access_level as 'read' | 'write',
      };

      // Save to database
      await this.database.shareContext(contextAccess);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(contextAccess, null, 2),
          },
        ],
      };
    } catch (error) {
      if (error instanceof McpError) {
        throw error;
      }
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to share context: ${(error as Error).message}`
      );
    }
  }

  private async getContext(args: any): Promise<any> {
    try {
      // Validate arguments
      if (!args.context_id || typeof args.context_id !== 'number') {
        throw new McpError(
          ErrorCode.InvalidParams,
          'context_id is required and must be a number'
        );
      }

      // Get context from database
      const context = await this.database.getContext(args.context_id);
      if (!context) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `Context with ID ${args.context_id} not found`
        );
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(context, null, 2),
          },
        ],
      };
    } catch (error) {
      if (error instanceof McpError) {
        throw error;
      }
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to get context: ${(error as Error).message}`
      );
    }
  }

  private async listContexts(args: any): Promise<any> {
    try {
      // Get contexts from database with optional agent filter
      const contexts = await this.database.listContexts(args?.agent_id);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(contexts, null, 2),
          },
        ],
      };
    } catch (error) {
      if (error instanceof McpError) {
        throw error;
      }
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to list contexts: ${(error as Error).message}`
      );
    }
  }

  private isValidCreateContextArgs(args: any): args is {
    title: string;
    content: string;
    created_by: string;
  } {
    return (
      typeof args === 'object' &&
      args !== null &&
      typeof args.title === 'string' &&
      typeof args.content === 'string' &&
      typeof args.created_by === 'string'
    );
  }

  private isValidUpdateContextArgs(args: any): args is {
    context_id: number;
    content: string;
  } {
    return (
      typeof args === 'object' &&
      args !== null &&
      typeof args.context_id === 'number' &&
      typeof args.content === 'string'
    );
  }

  private isValidShareContextArgs(args: any): args is {
    context_id: number;
    agent_id: string;
    access_level: 'read' | 'write';
  } {
    return (
      typeof args === 'object' &&
      args !== null &&
      typeof args.context_id === 'number' &&
      typeof args.agent_id === 'string' &&
      typeof args.access_level === 'string' &&
      ['read', 'write'].includes(args.access_level)
    );
  }
}