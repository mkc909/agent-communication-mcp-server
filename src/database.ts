import { connect, Connection } from '@planetscale/database';
import { Agent } from './agent-registry.js';
import { Message } from './message-bus.js';
import { Task } from './task-management.js';
import { TaskDependency } from './task-dependencies.js';
import { TaskReminder } from './task-reminders.js';
import { SharedContext, AgentContextAccess, ContextVersion, ContextTag, ContextSubscription } from './context-sharing.js';

export class Database {
  private connection: Connection | null = null;

  constructor() {
    // Connection will be initialized in the initialize method
  }

  public async initialize(): Promise<void> {
    try {
      // Connect to PlanetScale
      this.connection = connect({
        host: process.env.PLANETSCALE_HOST || '',
        username: process.env.PLANETSCALE_USERNAME || '',
        password: process.env.PLANETSCALE_PASSWORD || '',
      });

      console.log('Connected to PlanetScale database');

      // In a real implementation, we would check if tables exist and create them if needed
      // For now, we'll assume the tables already exist
    } catch (error) {
      console.error('Failed to connect to PlanetScale database:', error);
      throw error;
    }
  }

  // Agent methods
  public async createAgent(agent: Agent): Promise<void> {
    if (!this.connection) {
      throw new Error('Database not initialized');
    }

    try {
      await this.connection.execute(
        `INSERT INTO agents (agent_id, name, capabilities, system, status, last_active, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          agent.agent_id,
          agent.name,
          JSON.stringify(agent.capabilities),
          agent.system,
          agent.status,
          agent.last_active,
          agent.created_at,
        ]
      );
    } catch (error) {
      console.error('Failed to create agent:', error);
      throw error;
    }
  }

  public async updateAgent(agentId: string, updates: Partial<Agent>): Promise<void> {
    if (!this.connection) {
      throw new Error('Database not initialized');
    }

    try {
      // Build update query dynamically based on provided fields
      const updateFields: string[] = [];
      const values: any[] = [];

      if (updates.name) {
        updateFields.push('name = ?');
        values.push(updates.name);
      }

      if (updates.capabilities) {
        updateFields.push('capabilities = ?');
        values.push(JSON.stringify(updates.capabilities));
      }

      if (updates.status) {
        updateFields.push('status = ?');
        values.push(updates.status);
      }

      if (updates.last_active) {
        updateFields.push('last_active = ?');
        values.push(updates.last_active);
      }

      // Add agent_id at the end for WHERE clause
      values.push(agentId);

      if (updateFields.length === 0) {
        return; // Nothing to update
      }

      await this.connection.execute(
        `UPDATE agents SET ${updateFields.join(', ')} WHERE agent_id = ?`,
        values
      );
    } catch (error) {
      console.error('Failed to update agent:', error);
      throw error;
    }
  }

  public async getAgent(agentId: string): Promise<Agent | null> {
    if (!this.connection) {
      throw new Error('Database not initialized');
    }

    try {
      const result = await this.connection.execute(
        'SELECT * FROM agents WHERE agent_id = ?',
        [agentId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0] as any;
      return {
        agent_id: row.agent_id,
        name: row.name,
        capabilities: JSON.parse(row.capabilities),
        system: row.system,
        status: row.status as 'active' | 'inactive',
        last_active: new Date(row.last_active),
        created_at: new Date(row.created_at),
      };
    } catch (error) {
      console.error('Failed to get agent:', error);
      throw error;
    }
  }

  public async listAgents(system?: string, status?: string): Promise<Agent[]> {
    if (!this.connection) {
      throw new Error('Database not initialized');
    }

    try {
      let query = 'SELECT * FROM agents';
      const conditions: string[] = [];
      const values: any[] = [];

      if (system) {
        conditions.push('system = ?');
        values.push(system);
      }

      if (status) {
        conditions.push('status = ?');
        values.push(status);
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      const result = await this.connection.execute(query, values);

      return result.rows.map((row: any) => ({
        agent_id: row.agent_id,
        name: row.name,
        capabilities: JSON.parse(row.capabilities),
        system: row.system,
        status: row.status as 'active' | 'inactive',
        last_active: new Date(row.last_active),
        created_at: new Date(row.created_at),
      }));
    } catch (error) {
      console.error('Failed to list agents:', error);
      throw error;
    }
  }

  // Message methods
  public async createMessage(message: Message): Promise<number> {
    if (!this.connection) {
      throw new Error('Database not initialized');
    }

    try {
      const result = await this.connection.execute(
        `INSERT INTO messages (from_agent_id, to_agent_id, message, priority, read_status, timestamp)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          message.from_agent_id,
          message.to_agent_id,
          message.message,
          message.priority,
          message.read_status ? 1 : 0,
          message.timestamp,
        ]
      );

      return Number(result.insertId);
    } catch (error) {
      console.error('Failed to create message:', error);
      throw error;
    }
  }

  public async getMessages(agentId: string, readStatus?: boolean, limit?: number): Promise<Message[]> {
    if (!this.connection) {
      throw new Error('Database not initialized');
    }

    try {
      let query = 'SELECT * FROM messages WHERE to_agent_id = ?';
      const values: any[] = [agentId];

      if (readStatus !== undefined) {
        query += ' AND read_status = ?';
        values.push(readStatus ? 1 : 0);
      }

      query += ' ORDER BY timestamp DESC';

      if (limit) {
        query += ' LIMIT ?';
        values.push(limit);
      }

      const result = await this.connection.execute(query, values);

      return result.rows.map((row: any) => ({
        message_id: row.message_id,
        from_agent_id: row.from_agent_id,
        to_agent_id: row.to_agent_id,
        message: row.message,
        priority: row.priority,
        read_status: Boolean(row.read_status),
        timestamp: new Date(row.timestamp),
      }));
    } catch (error) {
      console.error('Failed to get messages:', error);
      throw error;
    }
  }

  public async markMessageRead(messageId: number): Promise<void> {
    if (!this.connection) {
      throw new Error('Database not initialized');
    }

    try {
      await this.connection.execute(
        'UPDATE messages SET read_status = 1 WHERE message_id = ?',
        [messageId]
      );
    } catch (error) {
      console.error('Failed to mark message as read:', error);
      throw error;
    }
  }

  public async deleteMessage(messageId: number): Promise<void> {
    if (!this.connection) {
      throw new Error('Database not initialized');
    }

    try {
      await this.connection.execute(
        'DELETE FROM messages WHERE message_id = ?',
        [messageId]
      );
    } catch (error) {
      console.error('Failed to delete message:', error);
      throw error;
    }
  }

  // Task methods
  public async createTask(task: Omit<Task, 'task_id'>): Promise<number> {
    if (!this.connection) {
      throw new Error('Database not initialized');
    }

    try {
      const result = await this.connection.execute(
        `INSERT INTO tasks (title, description, status, assigned_to, created_by, github_issue_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          task.title,
          task.description,
          task.status,
          task.assigned_to,
          task.created_by,
          task.github_issue_id,
          task.created_at,
          task.updated_at,
        ]
      );

      return Number(result.insertId);
    } catch (error) {
      console.error('Failed to create task:', error);
      throw error;
    }
  }

  public async updateTask(taskId: number, updates: Partial<Task>): Promise<void> {
    if (!this.connection) {
      throw new Error('Database not initialized');
    }

    try {
      // Build update query dynamically based on provided fields
      const updateFields: string[] = [];
      const values: any[] = [];

      if (updates.title) {
        updateFields.push('title = ?');
        values.push(updates.title);
      }

      if (updates.description) {
        updateFields.push('description = ?');
        values.push(updates.description);
      }

      if (updates.status) {
        updateFields.push('status = ?');
        values.push(updates.status);
      }

      if (updates.assigned_to) {
        updateFields.push('assigned_to = ?');
        values.push(updates.assigned_to);
      }

      if (updates.github_issue_id) {
        updateFields.push('github_issue_id = ?');
        values.push(updates.github_issue_id);
      }

      // Always update the updated_at timestamp
      updateFields.push('updated_at = ?');
      values.push(new Date());

      // Add task_id at the end for WHERE clause
      values.push(taskId);

      if (updateFields.length === 0) {
        return; // Nothing to update
      }

      await this.connection.execute(
        `UPDATE tasks SET ${updateFields.join(', ')} WHERE task_id = ?`,
        values
      );
    } catch (error) {
      console.error('Failed to update task:', error);
      throw error;
    }
  }

  public async getTask(taskId: number): Promise<Task | null> {
    if (!this.connection) {
      throw new Error('Database not initialized');
    }

    try {
      const result = await this.connection.execute(
        'SELECT * FROM tasks WHERE task_id = ?',
        [taskId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0] as any;
      return {
        task_id: row.task_id,
        title: row.title,
        description: row.description,
        status: row.status,
        assigned_to: row.assigned_to,
        created_by: row.created_by,
        github_issue_id: row.github_issue_id,
        created_at: new Date(row.created_at),
        updated_at: new Date(row.updated_at),
      };
    } catch (error) {
      console.error('Failed to get task:', error);
      throw error;
    }
  }

  public async listTasks(assignedTo?: string, status?: string, limit?: number): Promise<Task[]> {
    if (!this.connection) {
      throw new Error('Database not initialized');
    }

    try {
      let query = 'SELECT * FROM tasks';
      const conditions: string[] = [];
      const values: any[] = [];

      if (assignedTo) {
        conditions.push('assigned_to = ?');
        values.push(assignedTo);
      }

      if (status) {
        conditions.push('status = ?');
        values.push(status);
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      query += ' ORDER BY updated_at DESC';

      if (limit) {
        query += ' LIMIT ?';
        values.push(limit);
      }

      const result = await this.connection.execute(query, values);

      return result.rows.map((row: any) => ({
        task_id: row.task_id,
        title: row.title,
        description: row.description,
        status: row.status,
        assigned_to: row.assigned_to,
        created_by: row.created_by,
        github_issue_id: row.github_issue_id,
        created_at: new Date(row.created_at),
        updated_at: new Date(row.updated_at),
      }));
    } catch (error) {
      console.error('Failed to list tasks:', error);
      throw error;
    }
  }

  // Context methods
  public async createContext(context: Omit<SharedContext, 'context_id'>): Promise<number> {
    if (!this.connection) {
      throw new Error('Database not initialized');
    }

    try {
      const result = await this.connection.execute(
        `INSERT INTO shared_context (
          title, content, created_by, category, version, is_latest, metadata, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          context.title,
          context.content,
          context.created_by,
          context.category || null,
          context.version,
          context.is_latest,
          context.metadata ? JSON.stringify(context.metadata) : null,
          context.created_at,
          context.updated_at,
        ]
      );

      return Number(result.insertId);
    } catch (error) {
      console.error('Failed to create context:', error);
      throw error;
    }
  }

  public async updateContext(contextId: number, content: string): Promise<void> {
    if (!this.connection) {
      throw new Error('Database not initialized');
    }

    try {
      await this.connection.execute(
        'UPDATE shared_context SET content = ?, updated_at = ? WHERE context_id = ?',
        [content, new Date(), contextId]
      );
    } catch (error) {
      console.error('Failed to update context:', error);
      throw error;
    }
  }

  public async shareContext(contextAccess: AgentContextAccess): Promise<void> {
    if (!this.connection) {
      throw new Error('Database not initialized');
    }

    try {
      await this.connection.execute(
        `INSERT INTO agent_context_access (agent_id, context_id, access_level)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE access_level = ?`,
        [
          contextAccess.agent_id,
          contextAccess.context_id,
          contextAccess.access_level,
          contextAccess.access_level,
        ]
      );
    } catch (error) {
      console.error('Failed to share context:', error);
      throw error;
    }
  }

  public async getContext(contextId: number): Promise<SharedContext | null> {
    if (!this.connection) {
      throw new Error('Database not initialized');
    }

    try {
      const result = await this.connection.execute(
        'SELECT * FROM shared_context WHERE context_id = ?',
        [contextId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0] as any;
      return {
        context_id: row.context_id,
        title: row.title,
        content: row.content,
        created_by: row.created_by,
        category: row.category,
        version: row.version,
        is_latest: Boolean(row.is_latest),
        metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
        created_at: new Date(row.created_at),
        updated_at: new Date(row.updated_at),
      };
    } catch (error) {
      console.error('Failed to get context:', error);
      throw error;
    }
  }

  public async listContexts(agentId?: string): Promise<SharedContext[]> {
    if (!this.connection) {
      throw new Error('Database not initialized');
    }

    try {
      let query = 'SELECT sc.* FROM shared_context sc';
      const values: any[] = [];

      if (agentId) {
        query += ` JOIN agent_context_access aca ON sc.context_id = aca.context_id
                   WHERE aca.agent_id = ?`;
        values.push(agentId);
      }

      query += ' ORDER BY sc.updated_at DESC';

      const result = await this.connection.execute(query, values);

      return result.rows.map((row: any) => ({
        context_id: row.context_id,
        title: row.title,
        content: row.content,
        created_by: row.created_by,
        category: row.category,
        version: row.version,
        is_latest: Boolean(row.is_latest),
        metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
        created_at: new Date(row.created_at),
        updated_at: new Date(row.updated_at),
      }));
    } catch (error) {
      console.error('Failed to list contexts:', error);
      throw error;
    }
  }

  public async createContextVersion(version: Omit<ContextVersion, 'version_id'>): Promise<number> {
    if (!this.connection) {
      throw new Error('Database not initialized');
    }

    try {
      const result = await this.connection.execute(
        `INSERT INTO context_versions (context_id, version_number, content, created_by, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [
          version.context_id,
          version.version_number,
          version.content,
          version.created_by,
          version.created_at,
        ]
      );

      return Number(result.insertId);
    } catch (error) {
      console.error('Failed to create context version:', error);
      throw error;
    }
  }

  public async getContextVersions(contextId: number): Promise<ContextVersion[]> {
    if (!this.connection) {
      throw new Error('Database not initialized');
    }

    try {
      const result = await this.connection.execute(
        `SELECT * FROM context_versions
         WHERE context_id = ?
         ORDER BY version_number DESC`,
        [contextId]
      );

      return result.rows.map((row: any) => ({
        version_id: row.version_id,
        context_id: row.context_id,
        version_number: row.version_number,
        content: row.content,
        created_by: row.created_by,
        created_at: new Date(row.created_at),
      }));
    } catch (error) {
      console.error('Failed to get context versions:', error);
      throw error;
    }
  }

  public async addContextTag(contextId: number, tagName: string): Promise<void> {
    if (!this.connection) {
      throw new Error('Database not initialized');
    }

    try {
      // First, get or create the tag
      let tagId: number;
      const existingTags = await this.connection.execute(
        'SELECT tag_id FROM context_tags WHERE name = ?',
        [tagName]
      );
      
      if (existingTags.rows.length > 0) {
        tagId = existingTags.rows[0].tag_id;
      } else {
        // Create new tag
        const result = await this.connection.execute(
          'INSERT INTO context_tags (name) VALUES (?)',
          [tagName]
        );
        tagId = Number(result.insertId);
      }

      // Now map the tag to the context
      await this.connection.execute(
        `INSERT INTO context_tag_mapping (context_id, tag_id)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE context_id = context_id`,
        [contextId, tagId]
      );
    } catch (error) {
      console.error('Failed to add context tag:', error);
      throw error;
    }
  }

  public async removeContextTag(contextId: number, tagName: string): Promise<void> {
    if (!this.connection) {
      throw new Error('Database not initialized');
    }

    try {
      // Get the tag ID
      const tags = await this.connection.execute(
        'SELECT tag_id FROM context_tags WHERE name = ?',
        [tagName]
      );
      
      if (tags.rows.length === 0) {
        return; // Tag doesn't exist, nothing to remove
      }
      
      const tagId = tags.rows[0].tag_id;

      // Remove the mapping
      await this.connection.execute(
        'DELETE FROM context_tag_mapping WHERE context_id = ? AND tag_id = ?',
        [contextId, tagId]
      );
    } catch (error) {
      console.error('Failed to remove context tag:', error);
      throw error;
    }
  }

  public async getContextTags(contextId: number): Promise<ContextTag[]> {
    if (!this.connection) {
      throw new Error('Database not initialized');
    }

    try {
      const result = await this.connection.execute(
        `SELECT t.tag_id, t.name
         FROM context_tags t
         JOIN context_tag_mapping m ON t.tag_id = m.tag_id
         WHERE m.context_id = ?
         ORDER BY t.name`,
        [contextId]
      );

      return result.rows.map((row: any) => ({
        tag_id: row.tag_id,
        name: row.name,
      }));
    } catch (error) {
      console.error('Failed to get context tags:', error);
      throw error;
    }
  }

  public async subscribeToContext(subscription: Omit<ContextSubscription, 'subscription_id'>): Promise<number> {
    if (!this.connection) {
      throw new Error('Database not initialized');
    }

    try {
      const result = await this.connection.execute(
        `INSERT INTO context_subscriptions (agent_id, context_id, created_at)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE created_at = VALUES(created_at)`,
        [
          subscription.agent_id,
          subscription.context_id,
          subscription.created_at,
        ]
      );

      return Number(result.insertId);
    } catch (error) {
      console.error('Failed to subscribe to context:', error);
      throw error;
    }
  }

  public async unsubscribeFromContext(agentId: string, contextId: number): Promise<void> {
    if (!this.connection) {
      throw new Error('Database not initialized');
    }

    try {
      await this.connection.execute(
        `DELETE FROM context_subscriptions
         WHERE agent_id = ? AND context_id = ?`,
        [agentId, contextId]
      );
    } catch (error) {
      console.error('Failed to unsubscribe from context:', error);
      throw error;
    }
  }

  public async getContextSubscribers(contextId: number): Promise<{ agent_id: string; created_at: Date }[]> {
    if (!this.connection) {
      throw new Error('Database not initialized');
    }

    try {
      const result = await this.connection.execute(
        `SELECT agent_id, created_at
         FROM context_subscriptions
         WHERE context_id = ?
         ORDER BY created_at`,
        [contextId]
      );

      return result.rows.map((row: any) => ({
        agent_id: row.agent_id,
        created_at: new Date(row.created_at),
      }));
    } catch (error) {
      console.error('Failed to get context subscribers:', error);
      throw error;
    }
  }

  public async getAgentContextAccess(agentId: string, contextId: number): Promise<AgentContextAccess | null> {
    if (!this.connection) {
      throw new Error('Database not initialized');
    }

    try {
      const result = await this.connection.execute(
        'SELECT * FROM agent_context_access WHERE agent_id = ? AND context_id = ?',
        [agentId, contextId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0] as any;
      return {
        agent_id: row.agent_id,
        context_id: row.context_id,
        access_level: row.access_level,
      };
    } catch (error) {
      console.error('Failed to get agent context access:', error);
      throw error;
    }
  }
}