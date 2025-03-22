import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { Database } from './database.js';

interface AgentCapability {
  name: string;
  description: string;
  version?: string;
  parameters?: Record<string, unknown>;
}

export interface Agent {
  agent_id: string;
  name: string;
  capabilities: AgentCapability[];
  system: string;
  status: 'active' | 'inactive';
  last_active: Date;
  created_at: Date;
  metadata?: Record<string, unknown>;
}

export class AgentRegistry {
  constructor(private database: Database) {}

  public registerHandlers(server: Server) {
    // Register tools for agent management
    server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'register_agent',
          description: 'Register a new agent',
          inputSchema: {
            type: 'object',
            properties: {
              agent_id: {
                type: 'string',
                description: 'Unique identifier for the agent',
              },
              name: {
                type: 'string',
                description: 'Human-readable name for the agent',
              },
              capabilities: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: {
                      type: 'string',
                      description: 'Name of the capability',
                    },
                    description: {
                      type: 'string',
                      description: 'Description of the capability',
                    },
                    version: {
                      type: 'string',
                      description: 'Version of the capability',
                    },
                    parameters: {
                      type: 'object',
                      description: 'Additional parameters for the capability',
                    },
                  },
                  required: ['name', 'description'],
                },
                description: 'List of agent capabilities',
              },
              system: {
                type: 'string',
                description: 'System identifier where the agent is running',
              },
              metadata: {
                type: 'object',
                description: 'Additional metadata for the agent',
              },
            },
            required: ['agent_id', 'name', 'capabilities', 'system'],
          },
        },
        {
          name: 'update_agent',
          description: 'Update agent information',
          inputSchema: {
            type: 'object',
            properties: {
              agent_id: {
                type: 'string',
                description: 'Unique identifier for the agent',
              },
              name: {
                type: 'string',
                description: 'Human-readable name for the agent',
              },
              capabilities: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: {
                      type: 'string',
                      description: 'Name of the capability',
                    },
                    description: {
                      type: 'string',
                      description: 'Description of the capability',
                    },
                    version: {
                      type: 'string',
                      description: 'Version of the capability',
                    },
                    parameters: {
                      type: 'object',
                      description: 'Additional parameters for the capability',
                    },
                  },
                  required: ['name', 'description'],
                },
                description: 'List of agent capabilities',
              },
              status: {
                type: 'string',
                enum: ['active', 'inactive'],
                description: 'Agent status',
              },
              metadata: {
                type: 'object',
                description: 'Additional metadata for the agent',
              },
            },
            required: ['agent_id'],
          },
        },
        {
          name: 'get_agent',
          description: 'Get agent information',
          inputSchema: {
            type: 'object',
            properties: {
              agent_id: {
                type: 'string',
                description: 'Unique identifier for the agent',
              },
            },
            required: ['agent_id'],
          },
        },
        {
          name: 'list_agents',
          description: 'List all registered agents',
          inputSchema: {
            type: 'object',
            properties: {
              system: {
                type: 'string',
                description: 'Filter by system identifier',
              },
              status: {
                type: 'string',
                enum: ['active', 'inactive'],
                description: 'Filter by agent status',
              },
            },
          },
        },
      ],
    }));

    // Handle tool calls
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      switch (request.params.name) {
        case 'register_agent':
          return this.registerAgent(request.params.arguments);
        case 'update_agent':
          return this.updateAgent(request.params.arguments);
        case 'get_agent':
          return this.getAgent(request.params.arguments);
        case 'list_agents':
          return this.listAgents(request.params.arguments);
        default:
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Unknown tool: ${request.params.name}`
          );
      }
    });
  }

  private async registerAgent(args: any): Promise<any> {
    try {
      // Validate arguments
      if (!this.isValidRegisterAgentArgs(args)) {
        throw new McpError(
          ErrorCode.InvalidParams,
          'Invalid agent registration arguments'
        );
      }

      // Check if agent already exists
      const existingAgent = await this.database.getAgent(args.agent_id);
      if (existingAgent) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `Agent with ID ${args.agent_id} already exists`
        );
      }

      // Create new agent
      const agent: Agent = {
        agent_id: args.agent_id,
        name: args.name,
        capabilities: args.capabilities,
        system: args.system,
        status: 'active',
        last_active: new Date(),
        created_at: new Date(),
      };

      // Save to database
      await this.database.createAgent(agent);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(agent, null, 2),
          },
        ],
      };
    } catch (error) {
      if (error instanceof McpError) {
        throw error;
      }
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to register agent: ${(error as Error).message}`
      );
    }
  }

  private async updateAgent(args: any): Promise<any> {
    try {
      // Validate arguments
      if (!args.agent_id) {
        throw new McpError(
          ErrorCode.InvalidParams,
          'agent_id is required'
        );
      }

      // Check if agent exists
      const existingAgent = await this.database.getAgent(args.agent_id);
      if (!existingAgent) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `Agent with ID ${args.agent_id} not found`
        );
      }

      // Update agent fields
      const updatedAgent: Partial<Agent> = {};
      if (args.name) updatedAgent.name = args.name;
      if (args.capabilities) updatedAgent.capabilities = args.capabilities;
      if (args.status) updatedAgent.status = args.status;
      updatedAgent.last_active = new Date();

      // Save to database
      await this.database.updateAgent(args.agent_id, updatedAgent);

      // Get updated agent
      const agent = await this.database.getAgent(args.agent_id);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(agent, null, 2),
          },
        ],
      };
    } catch (error) {
      if (error instanceof McpError) {
        throw error;
      }
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to update agent: ${(error as Error).message}`
      );
    }
  }

  private async getAgent(args: any): Promise<any> {
    try {
      // Validate arguments
      if (!args.agent_id) {
        throw new McpError(
          ErrorCode.InvalidParams,
          'agent_id is required'
        );
      }

      // Get agent from database
      const agent = await this.database.getAgent(args.agent_id);
      if (!agent) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `Agent with ID ${args.agent_id} not found`
        );
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(agent, null, 2),
          },
        ],
      };
    } catch (error) {
      if (error instanceof McpError) {
        throw error;
      }
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to get agent: ${(error as Error).message}`
      );
    }
  }

  private async listAgents(args: any): Promise<any> {
    try {
      // Get agents from database with optional filters
      const agents = await this.database.listAgents(args.system, args.status);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(agents, null, 2),
          },
        ],
      };
    } catch (error) {
      if (error instanceof McpError) {
        throw error;
      }
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to list agents: ${(error as Error).message}`
      );
    }
  }

  private isValidRegisterAgentArgs(args: any): args is {
    agent_id: string;
    name: string;
    capabilities: AgentCapability[];
    system: string;
  } {
    return (
      typeof args === 'object' &&
      args !== null &&
      typeof args.agent_id === 'string' &&
      typeof args.name === 'string' &&
      Array.isArray(args.capabilities) &&
      args.capabilities.every(
        (cap: any) =>
          typeof cap === 'object' &&
          cap !== null &&
          typeof cap.name === 'string' &&
          typeof cap.description === 'string'
      ) &&
      typeof args.system === 'string'
    );
  }
}