import { Server } from '@modelcontextprotocol/sdk';
import { AgentRegistry } from '../src/agent-registry';
import { Database } from '../src/database';

// Mock the Database class
jest.mock('../src/database', () => {
  return {
    Database: jest.fn().mockImplementation(() => {
      return {
        createAgent: jest.fn().mockResolvedValue(undefined),
        getAgent: jest.fn().mockResolvedValue(null),
        updateAgent: jest.fn().mockResolvedValue(undefined),
        listAgents: jest.fn().mockResolvedValue([]),
      };
    }),
  };
});

describe('AgentRegistry', () => {
  let agentRegistry: AgentRegistry;
  let database: Database;
  let server: Server;

  beforeEach(() => {
    // Create a new instance of the mocked Database
    database = new Database();
    
    // Create a new instance of AgentRegistry with the mocked Database
    agentRegistry = new AgentRegistry(database);
    
    // Create a mock Server
    server = {
      setRequestHandler: jest.fn(),
    } as unknown as Server;
  });

  test('registerHandlers registers the expected handlers', () => {
    // Call the method under test
    agentRegistry.registerHandlers(server);
    
    // Verify that setRequestHandler was called twice (for ListToolsRequestSchema and CallToolRequestSchema)
    expect(server.setRequestHandler).toHaveBeenCalledTimes(2);
  });

  test('registerAgent creates a new agent', async () => {
    // Setup
    const args = {
      agent_id: 'test-agent',
      name: 'Test Agent',
      capabilities: [{ name: 'test', description: 'Test capability' }],
      system: 'test-system',
    };
    
    // Access the private method using type assertion
    const registerAgent = (agentRegistry as any).registerAgent.bind(agentRegistry);
    
    // Call the method under test
    const result = await registerAgent(args);
    
    // Verify the result
    expect(result).toEqual({
      content: [
        {
          type: 'text',
          text: expect.any(String),
        },
      ],
    });
    
    // Verify that createAgent was called with the expected arguments
    expect(database.createAgent).toHaveBeenCalledWith({
      agent_id: 'test-agent',
      name: 'Test Agent',
      capabilities: [{ name: 'test', description: 'Test capability' }],
      system: 'test-system',
      status: 'active',
      last_active: expect.any(Date),
      created_at: expect.any(Date),
    });
  });
});