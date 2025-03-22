import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { Database } from './database.js';

export interface Message {
  message_id?: number;
  from_agent_id: string;
  to_agent_id: string;
  message: string;
  priority: 'low' | 'medium' | 'high';
  read_status: boolean;
  timestamp: Date;
}

export class MessageBus {
  constructor(private database: Database) {}

  public registerHandlers(server: Server) {
    // Register tools for messaging
    server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'send_message',
          description: 'Send message to another agent',
          inputSchema: {
            type: 'object',
            properties: {
              from_agent_id: {
                type: 'string',
                description: 'Sender agent ID',
              },
              to_agent_id: {
                type: 'string',
                description: 'Recipient agent ID',
              },
              message: {
                type: 'string',
                description: 'Message content',
              },
              priority: {
                type: 'string',
                enum: ['low', 'medium', 'high'],
                description: 'Message priority',
              },
            },
            required: ['from_agent_id', 'to_agent_id', 'message'],
          },
        },
        {
          name: 'get_messages',
          description: 'Get messages for an agent',
          inputSchema: {
            type: 'object',
            properties: {
              agent_id: {
                type: 'string',
                description: 'Agent ID to get messages for',
              },
              status: {
                type: 'string',
                enum: ['read', 'unread', 'all'],
                description: 'Filter by read status',
              },
              limit: {
                type: 'number',
                description: 'Maximum number of messages to return',
              },
            },
            required: ['agent_id'],
          },
        },
        {
          name: 'mark_message_read',
          description: 'Mark message as read',
          inputSchema: {
            type: 'object',
            properties: {
              message_id: {
                type: 'number',
                description: 'Message ID to mark as read',
              },
            },
            required: ['message_id'],
          },
        },
        {
          name: 'delete_message',
          description: 'Delete a message',
          inputSchema: {
            type: 'object',
            properties: {
              message_id: {
                type: 'number',
                description: 'Message ID to delete',
              },
            },
            required: ['message_id'],
          },
        },
      ],
    }));

    // Handle tool calls
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      switch (request.params.name) {
        case 'send_message':
          return this.sendMessage(request.params.arguments);
        case 'get_messages':
          return this.getMessages(request.params.arguments);
        case 'mark_message_read':
          return this.markMessageRead(request.params.arguments);
        case 'delete_message':
          return this.deleteMessage(request.params.arguments);
        default:
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Unknown tool: ${request.params.name}`
          );
      }
    });
  }

  private async sendMessage(args: any): Promise<any> {
    try {
      // Validate arguments
      if (!this.isValidSendMessageArgs(args)) {
        throw new McpError(
          ErrorCode.InvalidParams,
          'Invalid message arguments'
        );
      }

      // Check if sender agent exists
      const senderAgent = await this.database.getAgent(args.from_agent_id);
      if (!senderAgent) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `Sender agent with ID ${args.from_agent_id} not found`
        );
      }

      // Check if recipient agent exists
      const recipientAgent = await this.database.getAgent(args.to_agent_id);
      if (!recipientAgent) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `Recipient agent with ID ${args.to_agent_id} not found`
        );
      }

      // Create message
      const message: Message = {
        from_agent_id: args.from_agent_id,
        to_agent_id: args.to_agent_id,
        message: args.message,
        priority: args.priority || 'medium',
        read_status: false,
        timestamp: new Date(),
      };

      // Save to database
      const messageId = await this.database.createMessage(message);

      // Return the created message with ID
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ ...message, message_id: messageId }, null, 2),
          },
        ],
      };
    } catch (error) {
      if (error instanceof McpError) {
        throw error;
      }
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to send message: ${(error as Error).message}`
      );
    }
  }

  private async getMessages(args: any): Promise<any> {
    try {
      // Validate arguments
      if (!args.agent_id) {
        throw new McpError(
          ErrorCode.InvalidParams,
          'agent_id is required'
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

      // Determine read status filter
      let readStatus: boolean | undefined;
      if (args.status === 'read') {
        readStatus = true;
      } else if (args.status === 'unread') {
        readStatus = false;
      }

      // Get messages from database
      const messages = await this.database.getMessages(
        args.agent_id,
        readStatus,
        args.limit
      );

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(messages, null, 2),
          },
        ],
      };
    } catch (error) {
      if (error instanceof McpError) {
        throw error;
      }
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to get messages: ${(error as Error).message}`
      );
    }
  }

  private async markMessageRead(args: any): Promise<any> {
    try {
      // Validate arguments
      if (!args.message_id || typeof args.message_id !== 'number') {
        throw new McpError(
          ErrorCode.InvalidParams,
          'message_id is required and must be a number'
        );
      }

      // Mark message as read in database
      await this.database.markMessageRead(args.message_id);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ success: true, message_id: args.message_id }, null, 2),
          },
        ],
      };
    } catch (error) {
      if (error instanceof McpError) {
        throw error;
      }
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to mark message as read: ${(error as Error).message}`
      );
    }
  }

  private async deleteMessage(args: any): Promise<any> {
    try {
      // Validate arguments
      if (!args.message_id || typeof args.message_id !== 'number') {
        throw new McpError(
          ErrorCode.InvalidParams,
          'message_id is required and must be a number'
        );
      }

      // Delete message from database
      await this.database.deleteMessage(args.message_id);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ success: true, message_id: args.message_id }, null, 2),
          },
        ],
      };
    } catch (error) {
      if (error instanceof McpError) {
        throw error;
      }
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to delete message: ${(error as Error).message}`
      );
    }
  }

  private isValidSendMessageArgs(args: any): args is {
    from_agent_id: string;
    to_agent_id: string;
    message: string;
    priority?: 'low' | 'medium' | 'high';
  } {
    return (
      typeof args === 'object' &&
      args !== null &&
      typeof args.from_agent_id === 'string' &&
      typeof args.to_agent_id === 'string' &&
      typeof args.message === 'string' &&
      (args.priority === undefined ||
        ['low', 'medium', 'high'].includes(args.priority))
    );
  }
}