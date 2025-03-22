import { Server } from '@modelcontextprotocol/sdk';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk';
import { Database } from './database';

/**
 * Represents a capability that an agent can have.
 * Capabilities define what an agent can do and are used for discovery and routing.
 */
export interface AgentCapability {
  name: string;
  description: string;
  version?: string;
  parameters?: Record<string, unknown>;
}

/**
 * Represents an agent in the system.
 * Agents are the core entities that can communicate with each other across systems.
 */
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

/**
 * The AgentRegistry manages agent registration, discovery, and status updates.
 * It provides tools for registering, updating, and querying agents in the system.
 */
export class AgentRegistry {
  constructor(private database: Database) {}

  /**
   * Registers all agent management tools with the MCP server.
   * @param server The MCP server instance
   */
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
                      description: 'Version of the capability (optional)',
                    },
                    parameters: {
                      type: 'object',
                      description: 'Additional parameters for the capability (optional)',
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
                description: 'Additional metadata for the agent (optional)',
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
                      description: 'Version of the capability (optional)',
                    },
                    parameters: {
                      type: 'object',
                      description: 'Additional parameters for the capability (optional)',
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
                description: 'Additional metadata for the agent (optional)',
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
              capability: {
                type: 'string',
                description: 'Filter by capability name',
              },
              limit: {
                type: 'number',
                description: 'Maximum number of agents to return',
              },
            },
          },
        },
        {
          name: 'search_agents',
          description: 'Search for agents by name or capability',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search query (matches against name or capability names)',
              },
              system: {
                type: 'string',
                description: 'Filter by system identifier',
              },
              status: {
                type: 'string',
                enum: ['active', 'inactive'],
                description: 'Filter by agent status',
              },
              limit: {
                type: 'number',
                description: 'Maximum number of agents to return',
              },
            },
            required: ['query'],
          },
        },
        {
          name: 'ping_agent',
          description: 'Ping an agent to check if it is active',
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
        case 'search_agents':
          return this.searchAgents(request.params.arguments);
        case 'ping_agent':
          return this.pingAgent(request.params.arguments);
        default:
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Unknown tool: ${request.params.name}`
          );
      }
    });
  }

  /**
   * Registers a new agent in the system.
   * @param args The agent registration arguments
   * @returns The registered agent
   */
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

      // Validate capabilities
      if (!this.validateCapabilities(args.capabilities)) {
        throw new McpError(
          ErrorCode.InvalidParams,
          'Invalid agent capabilities format'
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
        metadata: args.metadata || {},
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

  /**
   * Updates an existing agent in the system.
   * @param args The agent update arguments
   * @returns The updated agent
   */
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

      // Validate capabilities if provided
      if (args.capabilities && !this.validateCapabilities(args.capabilities)) {
        throw new McpError(
          ErrorCode.InvalidParams,
          'Invalid agent capabilities format'
        );
      }

      // Update agent fields
      const updatedAgent: Partial<Agent> = {};
      if (args.name) updatedAgent.name = args.name;
      if (args.capabilities) updatedAgent.capabilities = args.capabilities;
      if (args.status) updatedAgent.status = args.status;
      if (args.metadata) {
        updatedAgent.metadata = {
          ...existingAgent.metadata,
          ...args.metadata,
        };
      }
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

  /**
   * Gets information about a specific agent.
   * @param args The agent query arguments
   * @returns The agent information
   */
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

  /**
   * Lists agents in the system with optional filtering.
   * @param args The list query arguments
   * @returns The list of agents
   */
  private async listAgents(args: any): Promise<any> {
    try {
      // Get agents from database with optional filters
      const agents = await this.database.listAgents(
        args.system,
        args.status,
        args.limit
      );

      // Filter by capability if specified
      let filteredAgents = agents;
      if (args.capability) {
        filteredAgents = agents.filter(agent =>
          agent.capabilities.some(cap => cap.name === args.capability)
        );
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(filteredAgents, null, 2),
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

  /**
   * Searches for agents by name or capability.
   * @param args The search query arguments
   * @returns The matching agents
   */
  private async searchAgents(args: any): Promise<any> {
    try {
      // Validate arguments
      if (!args.query) {
        throw new McpError(
          ErrorCode.InvalidParams,
          'query is required'
        );
      }

      // Get all agents matching system and status filters
      const agents = await this.database.listAgents(
        args.system,
        args.status,
        args.limit
      );

      // Filter agents by query (case-insensitive)
      const query = args.query.toLowerCase();
      const matchingAgents = agents.filter(agent =>
        agent.name.toLowerCase().includes(query) ||
        agent.capabilities.some(cap => cap.name.toLowerCase().includes(query))
      );

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(matchingAgents, null, 2),
          },
        ],
      };
    } catch (error) {
      if (error instanceof McpError) {
        throw error;
      }
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to search agents: ${(error as Error).message}`
      );
    }
  }

  /**
   * Pings an agent to check if it is active and updates its last_active timestamp.
   * @param args The ping arguments
   * @returns The ping result
   */
  private async pingAgent(args: any): Promise<any> {
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

      // Update last_active timestamp
      await this.database.updateAgent(args.agent_id, {
        last_active: new Date(),
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              agent_id: args.agent_id,
              status: agent.status,
              last_active: new Date(),
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      if (error instanceof McpError) {
        throw error;
      }
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to ping agent: ${(error as Error).message}`
      );
    }
  }

  /**
   * Validates the agent registration arguments.
   * @param args The arguments to validate
   * @returns Whether the arguments are valid
   */
  private isValidRegisterAgentArgs(args: any): args is {
    agent_id: string;
    name: string;
    capabilities: AgentCapability[];
    system: string;
    metadata?: Record<string, unknown>;
  } {
    return (
      typeof args === 'object' &&
      args !== null &&
      typeof args.agent_id === 'string' &&
      typeof args.name === 'string' &&
      Array.isArray(args.capabilities) &&
      args.capabilities.length > 0 &&
      typeof args.system === 'string' &&
      (args.metadata === undefined || typeof args.metadata === 'object')
    );
  }

  /**
   * Validates the agent capabilities format.
   * @param capabilities The capabilities to validate
   * @returns Whether the capabilities are valid
   */
  private validateCapabilities(capabilities: any[]): boolean {
    if (!Array.isArray(capabilities) || capabilities.length === 0) {
      return false;
    }

    return capabilities.every(cap =>
      typeof cap === 'object' &&
      cap !== null &&
      typeof cap.name === 'string' &&
      typeof cap.description === 'string' &&
      (cap.version === undefined || typeof cap.version === 'string') &&
      (cap.parameters === undefined || typeof cap.parameters === 'object')
    );
  }
}