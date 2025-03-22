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
  priority ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
  assigned_to VARCHAR(255),
  created_by VARCHAR(255) NOT NULL,
  github_issue_id INT,
  deadline TIMESTAMP NULL,
  metadata JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (assigned_to) REFERENCES agents(agent_id),
  FOREIGN KEY (created_by) REFERENCES agents(agent_id)
);

-- Task dependencies table
CREATE TABLE task_dependencies (
  dependency_id INT AUTO_INCREMENT PRIMARY KEY,
  task_id INT NOT NULL,
  depends_on_task_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES tasks(task_id) ON DELETE CASCADE,
  FOREIGN KEY (depends_on_task_id) REFERENCES tasks(task_id) ON DELETE CASCADE,
  UNIQUE KEY unique_dependency (task_id, depends_on_task_id)
);

-- Task reminders table
CREATE TABLE task_reminders (
  reminder_id INT AUTO_INCREMENT PRIMARY KEY,
  task_id INT NOT NULL,
  reminder_time TIMESTAMP NOT NULL,
  message TEXT NOT NULL,
  sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES tasks(task_id) ON DELETE CASCADE
);

-- Shared context table
CREATE TABLE shared_context (
  context_id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES agents(agent_id)
);

-- Agent context access table
CREATE TABLE agent_context_access (
  agent_id VARCHAR(255) NOT NULL,
  context_id INT NOT NULL,
  access_level ENUM('read', 'write') DEFAULT 'read',
  PRIMARY KEY (agent_id, context_id),
  FOREIGN KEY (agent_id) REFERENCES agents(agent_id),
  FOREIGN KEY (context_id) REFERENCES shared_context(context_id)
);