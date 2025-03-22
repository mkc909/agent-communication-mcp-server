import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { Database } from './database.js';

export interface Task {
  task_id: number;
  title: string;
  description: string | null;
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'failed';
  assigned_to: string | null;
  created_by: string;
  github_issue_id: number | null;
  created_at: Date;
  updated_at: Date;
}

export class TaskManagement {
  constructor(private database: Database) {}

  public registerHandlers(server: Server) {
    // Register tools for task management
    server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'create_task',
          description: 'Create a new task',
          inputSchema: {
            type: 'object',
            properties: {
              title: {
                type: 'string',
                description: 'Task title',
              },
              description: {
                type: 'string',
                description: 'Task description',
              },
              created_by: {
                type: 'string',
                description: 'Agent ID of task creator',
              },
              github_issue_id: {
                type: 'number',
                description: 'Associated GitHub issue ID (optional)',
              },
            },
            required: ['title', 'created_by'],
          },
        },
        {
          name: 'assign_task',
          description: 'Assign task to an agent',
          inputSchema: {
            type: 'object',
            properties: {
              task_id: {
                type: 'number',
                description: 'Task ID to assign',
              },
              assigned_to: {
                type: 'string',
                description: 'Agent ID to assign the task to',
              },
            },
            required: ['task_id', 'assigned_to'],
          },
        },
        {
          name: 'update_task_status',
          description: 'Update task status',
          inputSchema: {
            type: 'object',
            properties: {
              task_id: {
                type: 'number',
                description: 'Task ID to update',
              },
              status: {
                type: 'string',
                enum: ['pending', 'assigned', 'in_progress', 'completed', 'failed'],
                description: 'New task status',
              },
            },
            required: ['task_id', 'status'],
          },
        },
        {
          name: 'get_task',
          description: 'Get task details',
          inputSchema: {
            type: 'object',
            properties: {
              task_id: {
                type: 'number',
                description: 'Task ID to retrieve',
              },
            },
            required: ['task_id'],
          },
        },
        {
          name: 'list_tasks',
          description: 'List tasks',
          inputSchema: {
            type: 'object',
            properties: {
              assigned_to: {
                type: 'string',
                description: 'Filter by assigned agent ID',
              },
              status: {
                type: 'string',
                enum: ['pending', 'assigned', 'in_progress', 'completed', 'failed'],
                description: 'Filter by task status',
              },
              limit: {
                type: 'number',
                description: 'Maximum number of tasks to return',
              },
            },
          },
        },
      ],
    }));

    // Handle tool calls
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      switch (request.params.name) {
        case 'create_task':
          return this.createTask(request.params.arguments);
        case 'assign_task':
          return this.assignTask(request.params.arguments);
        case 'update_task_status':
          return this.updateTaskStatus(request.params.arguments);
        case 'get_task':
          return this.getTask(request.params.arguments);
        case 'list_tasks':
          return this.listTasks(request.params.arguments);
        default:
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Unknown tool: ${request.params.name}`
          );
      }
    });
  }

  private async createTask(args: any): Promise<any> {
    try {
      // Validate arguments
      if (!this.isValidCreateTaskArgs(args)) {
        throw new McpError(
          ErrorCode.InvalidParams,
          'Invalid task creation arguments'
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

      // Create task
      const now = new Date();
      const task = {
        title: args.title,
        description: args.description || null,
        status: 'pending' as const,
        assigned_to: null,
        created_by: args.created_by,
        github_issue_id: args.github_issue_id || null,
        created_at: now,
        updated_at: now,
      };

      // Save to database
      const taskId = await this.database.createTask(task);

      // Return the created task with ID
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ ...task, task_id: taskId }, null, 2),
          },
        ],
      };
    } catch (error) {
      if (error instanceof McpError) {
        throw error;
      }
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to create task: ${(error as Error).message}`
      );
    }
  }

  private async assignTask(args: any): Promise<any> {
    try {
      // Validate arguments
      if (!this.isValidAssignTaskArgs(args)) {
        throw new McpError(
          ErrorCode.InvalidParams,
          'Invalid task assignment arguments'
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

      // Check if assignee agent exists
      const assigneeAgent = await this.database.getAgent(args.assigned_to);
      if (!assigneeAgent) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `Assignee agent with ID ${args.assigned_to} not found`
        );
      }

      // Update task
      const updates = {
        assigned_to: args.assigned_to,
        status: 'assigned' as const,
        updated_at: new Date(),
      };

      // Save to database
      await this.database.updateTask(args.task_id, updates);

      // Get updated task
      const updatedTask = await this.database.getTask(args.task_id);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(updatedTask, null, 2),
          },
        ],
      };
    } catch (error) {
      if (error instanceof McpError) {
        throw error;
      }
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to assign task: ${(error as Error).message}`
      );
    }
  }

  private async updateTaskStatus(args: any): Promise<any> {
    try {
      // Validate arguments
      if (!this.isValidUpdateTaskStatusArgs(args)) {
        throw new McpError(
          ErrorCode.InvalidParams,
          'Invalid task status update arguments'
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

      // Update task
      const updates = {
        status: args.status as Task['status'],
        updated_at: new Date(),
      };

      // Save to database
      await this.database.updateTask(args.task_id, updates);

      // Get updated task
      const updatedTask = await this.database.getTask(args.task_id);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(updatedTask, null, 2),
          },
        ],
      };
    } catch (error) {
      if (error instanceof McpError) {
        throw error;
      }
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to update task status: ${(error as Error).message}`
      );
    }
  }

  private async getTask(args: any): Promise<any> {
    try {
      // Validate arguments
      if (!args.task_id || typeof args.task_id !== 'number') {
        throw new McpError(
          ErrorCode.InvalidParams,
          'task_id is required and must be a number'
        );
      }

      // Get task from database
      const task = await this.database.getTask(args.task_id);
      if (!task) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `Task with ID ${args.task_id} not found`
        );
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(task, null, 2),
          },
        ],
      };
    } catch (error) {
      if (error instanceof McpError) {
        throw error;
      }
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to get task: ${(error as Error).message}`
      );
    }
  }

  private async listTasks(args: any): Promise<any> {
    try {
      // Get tasks from database with optional filters
      const tasks = await this.database.listTasks(
        args?.assigned_to,
        args?.status,
        args?.limit
      );

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(tasks, null, 2),
          },
        ],
      };
    } catch (error) {
      if (error instanceof McpError) {
        throw error;
      }
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to list tasks: ${(error as Error).message}`
      );
    }
  }

  private isValidCreateTaskArgs(args: any): args is {
    title: string;
    description?: string;
    created_by: string;
    github_issue_id?: number;
  } {
    return (
      typeof args === 'object' &&
      args !== null &&
      typeof args.title === 'string' &&
      typeof args.created_by === 'string' &&
      (args.description === undefined || typeof args.description === 'string') &&
      (args.github_issue_id === undefined || typeof args.github_issue_id === 'number')
    );
  }

  private isValidAssignTaskArgs(args: any): args is {
    task_id: number;
    assigned_to: string;
  } {
    return (
      typeof args === 'object' &&
      args !== null &&
      typeof args.task_id === 'number' &&
      typeof args.assigned_to === 'string'
    );
  }

  private isValidUpdateTaskStatusArgs(args: any): args is {
    task_id: number;
    status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'failed';
  } {
    return (
      typeof args === 'object' &&
      args !== null &&
      typeof args.task_id === 'number' &&
      typeof args.status === 'string' &&
      ['pending', 'assigned', 'in_progress', 'completed', 'failed'].includes(args.status)
    );
  }
}