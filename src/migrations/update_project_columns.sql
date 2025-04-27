-- First, drop any existing backup table
DROP TABLE IF EXISTS projects_backup;

-- Create a backup of the existing data
CREATE TABLE projects_backup AS SELECT * FROM projects;

-- Drop the existing table with CASCADE to handle dependencies
DROP TABLE IF EXISTS projects CASCADE;

-- Recreate the table with the correct column types
CREATE TABLE projects (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    thumbnail VARCHAR(255),
    author_id INTEGER REFERENCES users(id),
    category VARCHAR(50) NOT NULL,
    academic_year VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    files JSONB,
    tags JSONB,
    video_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Restore the data from backup
INSERT INTO projects (
    id, title, description, thumbnail, author_id, 
    category, academic_year, status, files, tags, 
    video_url, created_at, updated_at
)
SELECT
    id, title, description, thumbnail, author_id,
    category, academic_year, status,
    CASE
        WHEN files IS NOT NULL THEN files::jsonb
        ELSE NULL
    END as files,
    CASE
        WHEN tags IS NOT NULL THEN tags::jsonb
        ELSE NULL
    END as tags,
    video_url, created_at, updated_at
FROM projects_backup;

-- Drop the backup table
DROP TABLE projects_backup;

-- Add any necessary indexes
CREATE INDEX idx_projects_author_id ON projects(author_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_category ON projects(category);
CREATE INDEX idx_projects_academic_year ON projects(academic_year);

-- Recreate the comments table with foreign key constraint
CREATE TABLE IF NOT EXISTS comments (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
); 