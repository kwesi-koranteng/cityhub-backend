-- Create users table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'user',
  avatar VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create projects table
CREATE TABLE projects (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  thumbnail VARCHAR(255),
  author_id INTEGER REFERENCES users(id),
  tags TEXT[] DEFAULT '{}',
  category VARCHAR(100) NOT NULL,
  academic_year VARCHAR(50) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  video_url VARCHAR(255),
  files JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create comments table
CREATE TABLE comments (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_projects_author ON projects(author_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_comments_project ON comments(project_id);
CREATE INDEX idx_comments_user ON comments(user_id);

-- Create admin user (password: admin123)
INSERT INTO users (name, email, password, role)
VALUES (
  'Arnold Kimkpe',
  'arnold@acity.edu.gh',
  '$2a$10$YourHashedPasswordHere',
  'admin'
); 