#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import dotenv from 'dotenv';
import { AgentRegistry } from './agent-registry.js';
import { MessageBus } from './message-bus.js';
import { TaskManagement } from './task-management.js';
import { ContextSharing } from './context-sharing.js';
import { GitHubIntegration } from './github-integration.js';
import { Database } from './database.js';

// Load environment variables
dotenv.config();

class AgentCommunicationServer {
  private server: Server;
  private agentRegistry: AgentRegistry;
  private messageBus: MessageBus;
  private taskManagement: TaskManagement;
  private contextSharing: ContextSharing;
  private githubIntegration: GitHubIntegration;
  private database: Database;

  constructor() {
    // Initialize database connection
    this.database = new Database();

    // Initialize components
    this.agentRegistry = new AgentRegistry(this.database);
    this.messageBus = new MessageBus(this.database);
    this.taskManagement = new TaskManagement(this.database);
    this.contextSharing = new ContextSharing(this.database);
    this.githubIntegration = new GitHubIntegration();

    // Initialize MCP server
    this.server = new Server(
      {
        name: 'agent-communication-mcp-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          resources: {},
          tools: {},
        },
      }
    );

    // Set up request handlers
    this.setupRequestHandlers();
    
    // Error handling
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupRequestHandlers() {
    // Register all request handlers from components
    this.agentRegistry.registerHandlers(this.server);
    this.messageBus.registerHandlers(this.server);
    this.taskManagement.registerHandlers(this.server);
    this.contextSharing.registerHandlers(this.server);
    this.githubIntegration.registerHandlers(this.server);
  }

  async run() {
    // Initialize database
    await this.database.initialize();

    // Connect to MCP transport
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Agent Communication MCP server running on stdio');
  }
}

// Create and run the server
const server = new AgentCommunicationServer();
server.run().catch(console.error);