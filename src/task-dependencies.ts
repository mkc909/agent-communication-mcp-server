import { Server } from '@modelcontextprotocol/sdk';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk';
import { Database } from './database';

export interface TaskDependency {
  dependency_id: number;
  task_id: number;
  depends_on_task_id: number;
  created_at: Date;
}

export class TaskDependencyManager {
  constructor(private database: Database) {}

  public registerHandlers(server: Server) {
    // Register tools for task dependency management
    server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'add_task_dependency',
          description: 'Add a dependency between tasks',
          inputSchema: {
            type: 'object',
            properties: {
              task_id: {
                type: 'number',
                description: 'ID of the task that depends on another task',
              },
              depends_on_task_id: {
                type: 'number',
                description: 'ID of the task that must be completed first',
              },
            },
            required: ['task_id', 'depends_on_task_id'],
          },
        },
        {
          name: 'remove_task_dependency',
          description: 'Remove a dependency between tasks',
          inputSchema: {
            type: 'object',
            properties: {
              task_id: {
                type: 'number',
                description: 'ID of the task that depends on another task',
              },
              depends_on_task_id: {
                type: 'number',
                description: 'ID of the task that must be completed first',
              },
            },
            required: ['task_id', 'depends_on_task_id'],
          },
        },
        {
          name: 'list_task_dependencies',
          description: 'List dependencies for a task',
          inputSchema: {
            type: 'object',
            properties: {
              task_id: {
                type: 'number',
                description: 'Task ID to get dependencies for',
              },
            },
            required: ['task_id'],
          },
        },
      ],
    }));

    // Handle tool calls
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      switch (request.params.name) {
        case 'add_task_dependency':
          return this.addTaskDependency(request.params.arguments);
        case 'remove_task_dependency':
          return this.removeTaskDependency(request.params.arguments);
        case 'list_task_dependencies':
          return this.listTaskDependencies(request.params.arguments);
        default:
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Unknown tool: ${request.params.name}`
          );
      }
    });
  }

  private async addTaskDependency(args: any): Promise<any> {
    try {
      // Validate arguments
      if (!this.isValidTaskDependencyArgs(args)) {
        throw new McpError(
          ErrorCode.InvalidParams,
          'Invalid task dependency arguments'
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

      // Check if dependency task exists
      const dependencyTask = await this.database.getTask(args.depends_on_task_id);
      if (!dependencyTask) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `Dependency task with ID ${args.depends_on_task_id} not found`
        );
      }

      // Check for circular dependencies
      if (await this.hasCircularDependency(args.depends_on_task_id, args.task_id)) {
        throw new McpError(
          ErrorCode.InvalidParams,
          'Adding this dependency would create a circular dependency'
        );
      }

      // Create dependency
      const dependency = {
        task_id: args.task_id,
        depends_on_task_id: args.depends_on_task_id,
        created_at: new Date(),
      };

      // Save to database
      const dependencyId = await this.database.createTaskDependency(dependency);

      // Return the created dependency with ID
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ ...dependency, dependency_id: dependencyId }, null, 2),
          },
        ],
      };
    } catch (error) {
      if (error instanceof McpError) {
        throw error;
      }
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to add task dependency: ${(error as Error).message}`
      );
    }
  }

  private async removeTaskDependency(args: any): Promise<any> {
    try {
      // Validate arguments
      if (!this.isValidTaskDependencyArgs(args)) {
        throw new McpError(
          ErrorCode.InvalidParams,
          'Invalid task dependency arguments'
        );
      }

      // Check if dependency exists
      const dependency = await this.database.getTaskDependency(
        args.task_id,
        args.depends_on_task_id
      );
      if (!dependency) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `Dependency between task ${args.task_id} and ${args.depends_on_task_id} not found`
        );
      }

      // Remove dependency
      await this.database.deleteTaskDependency(args.task_id, args.depends_on_task_id);

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
        `Failed to remove task dependency: ${(error as Error).message}`
      );
    }
  }

  private async listTaskDependencies(args: any): Promise<any> {
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

      // Get dependencies
      const dependencies = await this.database.getTaskDependencies(args.task_id);
      const dependents = await this.database.getTaskDependents(args.task_id);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                task_id: args.task_id,
                dependencies: dependencies, // Tasks this task depends on
                dependents: dependents, // Tasks that depend on this task
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      if (error instanceof McpError) {
        throw error;
      }
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to list task dependencies: ${(error as Error).message}`
      );
    }
  }

  private async hasCircularDependency(
    taskId: number,
    dependsOnTaskId: number
  ): Promise<boolean> {
    // Check if dependsOnTaskId depends on taskId (which would create a circular dependency)
    const dependencies = await this.database.getTaskDependencies(dependsOnTaskId);
    if (dependencies.some((dep) => dep.depends_on_task_id === taskId)) {
      return true;
    }

    // Recursively check dependencies of dependencies
    for (const dep of dependencies) {
      if (await this.hasCircularDependency(taskId, dep.depends_on_task_id)) {
        return true;
      }
    }

    return false;
  }

  private isValidTaskDependencyArgs(args: any): args is {
    task_id: number;
    depends_on_task_id: number;
  } {
    return (
      typeof args === 'object' &&
      args !== null &&
      typeof args.task_id === 'number' &&
      typeof args.depends_on_task_id === 'number' &&
      args.task_id !== args.depends_on_task_id // Task cannot depend on itself
    );
  }
}