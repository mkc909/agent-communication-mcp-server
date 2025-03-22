-- Agents table
CREATE TABLE agents (
  agent_id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  capabilities JSON NOT NULL,
  system VARCHAR(255) NOT NULL,
  status ENUM('active', 'inactive') DEFAULT 'active',
  last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Messages table
CREATE TABLE messages (
  message_id INT AUTO_INCREMENT PRIMARY KEY,
  from_agent_id VARCHAR(255) NOT NULL,
  to_agent_id VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  priority ENUM('low', 'medium', 'high') DEFAULT 'medium',
  read_status BOOLEAN DEFAULT FALSE,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (from_agent_id) REFERENCES agents(agent_id),
  FOREIGN KEY (to_agent_id) REFERENCES agents(agent_id)
);

-- Tasks table
CREATE TABLE tasks (
  task_id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status ENUM('pending', 'assigned', 'in_progress', 'completed', 'failed') DEFAULT 'pending',
  assigned_to VARCHAR(255),
  created_by VARCHAR(255) NOT NULL,
  github_issue_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (assigned_to) REFERENCES agents(agent_id),
  FOREIGN KEY (created_by) REFERENCES agents(agent_id)
);

-- Shared context table
CREATE TABLE shared_context (
  context_id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  created_by VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  version INT DEFAULT 1,
  is_latest BOOLEAN DEFAULT TRUE,
  metadata JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES agents(agent_id)
);

-- Context versions table
CREATE TABLE context_versions (
  version_id INT AUTO_INCREMENT PRIMARY KEY,
  context_id INT NOT NULL,
  version_number INT NOT NULL,
  content TEXT NOT NULL,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (context_id) REFERENCES shared_context(context_id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES agents(agent_id),
  UNIQUE KEY unique_context_version (context_id, version_number)
);

-- Context tags table
CREATE TABLE context_tags (
  tag_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  UNIQUE KEY unique_tag_name (name)
);

-- Context tag mapping table
CREATE TABLE context_tag_mapping (
  context_id INT NOT NULL,
  tag_id INT NOT NULL,
  PRIMARY KEY (context_id, tag_id),
  FOREIGN KEY (context_id) REFERENCES shared_context(context_id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES context_tags(tag_id) ON DELETE CASCADE
);

-- Agent context access table
CREATE TABLE agent_context_access (
  agent_id VARCHAR(255) NOT NULL,
  context_id INT NOT NULL,
  access_level ENUM('read', 'write') DEFAULT 'read',
  PRIMARY KEY (agent_id, context_id),
  FOREIGN KEY (agent_id) REFERENCES agents(agent_id),
  FOREIGN KEY (context_id) REFERENCES shared_context(context_id) ON DELETE CASCADE
);

-- Context subscription table for real-time updates
CREATE TABLE context_subscriptions (
  subscription_id INT AUTO_INCREMENT PRIMARY KEY,
  agent_id VARCHAR(255) NOT NULL,
  context_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (agent_id) REFERENCES agents(agent_id),
  FOREIGN KEY (context_id) REFERENCES shared_context(context_id) ON DELETE CASCADE,
  UNIQUE KEY unique_subscription (agent_id, context_id)
);