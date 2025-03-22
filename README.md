# Cross-System Agent Communication MCP Server

## Overview

This MCP server enables communication and coordination between different Roo modes/roles across multiple systems. It creates a "team of agents" architecture where specialized LLM agents can collaborate on tasks, share context, and coordinate work.

## Features

- **Agent Registry**: Register and manage different Roo modes/roles with their capabilities
- **Message Bus**: Enable asynchronous communication between agents
- **Task Coordination**: Manage task assignment and progress tracking
- **Context Sharing**: Facilitate knowledge transfer between agents
- **GitHub Integration**: Create and track GitHub issues, manage pull requests
- **PlanetScale Integration**: Store agent data, messages, and tasks in a scalable database

## Architecture

The Cross-System Agent Communication MCP Server consists of three main components:

1. **Core MCP Server**
   - Agent Registry
   - Message Bus
   - Task Coordination
   - Context Sharing

2. **GitHub Integration Layer**
   - Issue Management
   - PR Workflow
   - Project Management

3. **PlanetScale Database Layer**
   - Agent Data Storage
   - Message Storage
   - Task Database

## Getting Started

### Prerequisites

- Node.js 18 or higher
- TypeScript 5.3 or higher
- GitHub API access
- PlanetScale database account

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/mkc909/agent-communication-mcp-server.git
   cd agent-communication-mcp-server
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env` file with the following variables:
   ```
   GITHUB_TOKEN=your_github_token
   PLANETSCALE_HOST=your_planetscale_host
   PLANETSCALE_USERNAME=your_planetscale_username
   PLANETSCALE_PASSWORD=your_planetscale_password
   ```

4. Build the project:
   ```
   npm run build
   ```

5. Start the server:
   ```
   npm start
   ```

## Development

### Running in Development Mode

```
npm run dev
```

### Running Tests

```
npm test
```

### Linting

```
npm run lint
```

## API Endpoints

### Agent Management

- `register_agent`: Register a new agent
- `update_agent`: Update agent information
- `get_agent`: Get agent information
- `list_agents`: List all registered agents

### Messaging

- `send_message`: Send message to another agent
- `get_messages`: Get messages for an agent
- `mark_message_read`: Mark message as read
- `delete_message`: Delete a message

### Task Management

- `create_task`: Create a new task
- `assign_task`: Assign task to an agent
- `update_task_status`: Update task status
- `get_task`: Get task details
- `list_tasks`: List tasks

### Context Sharing

- `create_context`: Create shared context
- `update_context`: Update shared context
- `share_context`: Share context with agent
- `get_context`: Get shared context
- `list_contexts`: List shared contexts

### GitHub Integration

- `github_create_issue`: Create GitHub issue
- `github_comment_issue`: Comment on GitHub issue
- `github_create_pr`: Create GitHub PR
- `github_review_pr`: Review GitHub PR

## License

MIT