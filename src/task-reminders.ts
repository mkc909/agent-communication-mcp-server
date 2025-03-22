import { Server } from '@modelcontextprotocol/sdk';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk';
import { Database } from './database';

export interface TaskReminder {
  reminder_id: number;
  task_id: number;
  reminder_time: Date;
  message: string;
  sent: boolean;
  created_at: Date;
}

export class TaskReminderManager {
  constructor(private database: Database) {}

  public registerHandlers(server: Server) {
    // Register tools for task reminder management
    server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'add_task_reminder',
          description: 'Add a reminder for a task',
          inputSchema: {
            type: 'object',
            properties: {
              task_id: {
                type: 'number',
                description: 'Task ID to add reminder for',
              },
              reminder_time: {
                type: 'string',
                format: 'date-time',
                description: 'Time for the reminder (ISO 8601 format)',
              },
              message: {
                type: 'string',
                description: 'Reminder message',
              },
            },
            required: ['task_id', 'reminder_time', 'message'],
          },
        },
        {
          name: 'list_task_reminders',
          description: 'List reminders for a task',
          inputSchema: {
            type: 'object',
            properties: {
              task_id: {
                type: 'number',
                description: 'Task ID to get reminders for',
              },
            },
            required: ['task_id'],
          },
        },
        {
          name: 'delete_task_reminder',
          description: 'Delete a reminder for a task',
          inputSchema: {
            type: 'object',
            properties: {
              reminder_id: {
                type: 'number',
                description: 'Reminder ID to delete',
              },
            },
            required: ['reminder_id'],
          },
        },
      ],
    }));

    // Handle tool calls
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      switch (request.params.name) {
        case 'add_task_reminder':
          return this.addTaskReminder(request.params.arguments);
        case 'list_task_reminders':
          return this.listTaskReminders(request.params.arguments);
        case 'delete_task_reminder':
          return this.deleteTaskReminder(request.params.arguments);
        default:
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Unknown tool: ${request.params.name}`
          );
      }
    });
  }

  private async addTaskReminder(args: any): Promise<any> {
    try {
      // Validate arguments
      if (!this.isValidAddTaskReminderArgs(args)) {
        throw new McpError(
          ErrorCode.InvalidParams,
          'Invalid task reminder arguments'
        );
      }

      // Check if task exists
      const task = await this.database.getTask(args.task_id);
      if (!task) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `Task with ID ${args.task_id} not found`
        );
      }

      // Parse reminder time
      let reminderTime: Date;
      try {
        reminderTime = new Date(args.reminder_time);
        if (isNaN(reminderTime.getTime())) {
          throw new Error('Invalid date');
        }
      } catch (error) {
        throw new McpError(
          ErrorCode.InvalidParams,
          'Invalid reminder time format. Use ISO 8601 format (e.g., "2025-04-01T12:00:00Z")'
        );
      }

      // Check if reminder time is in the future
      const now = new Date();
      if (reminderTime <= now) {
        throw new McpError(
          ErrorCode.InvalidParams,
          'Reminder time must be in the future'
        );
      }

      // Create reminder
      const reminder = {
        task_id: args.task_id,
        reminder_time: reminderTime,
        message: args.message,
        sent: false,
        created_at: now,
      };

      // Save to database
      const reminderId = await this.database.createTaskReminder(reminder);

      // Return the created reminder with ID
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ ...reminder, reminder_id: reminderId }, null, 2),
          },
        ],
      };
    } catch (error) {
      if (error instanceof McpError) {
        throw error;
      }
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to add task reminder: ${(error as Error).message}`
      );
    }
  }

  private async listTaskReminders(args: any): Promise<any> {
    try {
      // Validate arguments
      if (!args.task_id || typeof args.task_id !== 'number') {
        throw new McpError(
          ErrorCode.InvalidParams,
          'task_id is required and must be a number'
        );
      }

      // Check if task exists
      const task = await this.database.getTask(args.task_id);
      if (!task) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `Task with ID ${args.task_id} not found`
        );
      }

      // Get reminders
      const reminders = await this.database.getTaskReminders(args.task_id);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(reminders, null, 2),
          },
        ],
      };
    } catch (error) {
      if (error instanceof McpError) {
        throw error;
      }
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to list task reminders: ${(error as Error).message}`
      );
    }
  }

  private async deleteTaskReminder(args: any): Promise<any> {
    try {
      // Validate arguments
      if (!args.reminder_id || typeof args.reminder_id !== 'number') {
        throw new McpError(
          ErrorCode.InvalidParams,
          'reminder_id is required and must be a number'
        );
      }

      // Check if reminder exists
      const reminder = await this.database.getTaskReminderById(args.reminder_id);
      if (!reminder) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `Reminder with ID ${args.reminder_id} not found`
        );
      }

      // Delete reminder
      await this.database.deleteTaskReminder(args.reminder_id);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ success: true }, null, 2),
          },
        ],
      };
    } catch (error) {
      if (error instanceof McpError) {
        throw error;
      }
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to delete task reminder: ${(error as Error).message}`
      );
    }
  }

  private isValidAddTaskReminderArgs(args: any): args is {
    task_id: number;
    reminder_time: string;
    message: string;
  } {
    return (
      typeof args === 'object' &&
      args !== null &&
      typeof args.task_id === 'number' &&
      typeof args.reminder_time === 'string' &&
      typeof args.message === 'string' &&
      args.message.trim() !== ''
    );
  }
}