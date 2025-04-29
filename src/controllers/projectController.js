import { query } from '../config/database.js';
import path from 'path';
import { URL } from 'url';

const defaultThumbnails = [
  "https://th.bing.com/th/id/OIP.OACmP6GQapaMmDQxj9guvgHaHJ?rs=1&pid=ImgDetMain",
  "https://th.bing.com/th/id/OIP.7T8gJCW11R29gj3PRhfrhwAAAA?rs=1&pid=ImgDetMain",
  "https://th.bing.com/th/id/OIP.cRZKM0zd0u0eUtR8XiUZuwHaD3?w=325&h=180&c=7&r=0&o=5&dpr=1.1&pid=1.7"
];

// Helper function to get full URL for uploaded files
const getFullUrl = (filePath) => {
  if (!filePath) return null;
  
  // If the file is already a URL (from production), return it as is
  if (filePath.startsWith('http')) {
    return filePath;
  }
  
  // For local development, convert file path to URL
  const cleanPath = filePath.replace(/\\/g, '/').replace(/^\/+/, '');
  const baseUrl = process.env.NODE_ENV === 'production' 
    ? process.env.API_BASE_URL.replace('/api', '')
    : 'http://localhost:5000';
  return `${baseUrl}/uploads/${cleanPath}`;
};

// Helper function to validate image URL
const isValidImageUrl = (url) => {
  try {
    const parsedUrl = new URL(url);
    // Check if the URL is valid and has a protocol
    if (!parsedUrl.protocol.startsWith('http')) {
      return false;
    }
    // Check if the URL ends with a common image extension
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
    const hasImageExtension = imageExtensions.some(ext => 
      parsedUrl.pathname.toLowerCase().endsWith(ext)
    );
    return hasImageExtension;
  } catch (error) {
    return false;
  }
};

// Create a new project
const createProject = async (req, res) => {
  try {
    console.log('Creating project with data:', {
      body: req.body,
      files: req.files,
      user: req.user,
      headers: req.headers
    });

    // Validate user
    if (!req.user || !req.user.id) {
      console.error('No user found in request');
      return res.status(401).json({ 
        message: 'User not authenticated',
        error: 'Authentication required'
      });
    }

    // Extract and validate required fields
    const { title, description, category, academicYear, tags, videoUrl, thumbnail } = req.body;
    
    // Log the raw request body for debugging
    console.log('Raw request body:', req.body);

    // Handle project files separately
    const projectFiles = req.files || []; // Multiple project files

    console.log('Processed files:', {
      projectFiles: projectFiles,
      fileCount: projectFiles.length,
      fileNames: projectFiles.map(f => f.originalname)
    });

    // Process project files (if any)
    const files = projectFiles.map(file => {
      try {
        // In production, we'll store the file data directly
        if (process.env.NODE_ENV === 'production') {
          return {
            name: file.originalname,
            type: file.mimetype,
            data: file.buffer.toString('base64') // Store file content as base64
          };
        }
        // In development, store the file path
        return {
          name: file.originalname,
          url: getFullUrl(file.path),
          type: file.mimetype
        };
      } catch (error) {
        console.error('Error processing file:', {
          file: file.originalname,
          error: error.message
        });
        throw error;
      }
    });

    console.log('Processed files data:', files);

    // Allow projects without a thumbnail. Only validate if provided and not empty.
    let finalThumbnail = thumbnail;
    if (finalThumbnail && typeof finalThumbnail === 'string' && finalThumbnail.trim() !== '') {
      if (!finalThumbnail.trim().startsWith('http')) {
        return res.status(400).json({
          message: 'Please provide a valid image URL for the thumbnail.',
          error: 'Invalid thumbnail URL'
        });
      }
      finalThumbnail = finalThumbnail.trim();
    } else {
      finalThumbnail = null;
    }

    // Ensure required fields are present and not empty
    if (!title || !description || !category || !academicYear) {
      console.error('Missing required fields:', { title, description, category, academicYear });
      return res.status(400).json({ 
        message: 'Title, description, category, and academic year are required.',
        error: 'Missing required fields',
        missingFields: {
          title: !title,
          description: !description,
          category: !category,
          academicYear: !academicYear
        }
      });
    }

    // Trim all string fields
    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();
    const trimmedCategory = category.trim();
    const trimmedAcademicYear = academicYear.trim();
    const trimmedVideoUrl = videoUrl ? videoUrl.trim() : null;

    // Parse tags from JSON string
    let parsedTags = [];
    try {
      // Check if tags is already an array
      if (Array.isArray(tags)) {
        parsedTags = tags;
      } else if (typeof tags === 'string') {
        // Try to parse as JSON if it's a string
        parsedTags = JSON.parse(tags);
      }
      
      // Ensure parsedTags is an array
      if (!Array.isArray(parsedTags)) {
        throw new Error('Tags must be an array');
      }
      
      console.log('Parsed tags:', parsedTags);
    } catch (error) {
      console.error('Error parsing tags:', error);
      return res.status(400).json({ 
        message: 'Invalid tags format',
        error: error.message
      });
    }

    // Format arrays for PostgreSQL
    const filesArray = files.length > 0 ? files : null;
    const tagsArray = parsedTags.length > 0 ? parsedTags : [];

    // Set initial status to 'pending'
    const initialStatus = 'pending';
    console.log('Setting initial project status to:', initialStatus);

    // Prepare the query values
    const queryValues = [
      trimmedTitle,
      trimmedDescription,
      finalThumbnail,
      req.user.id,
      trimmedCategory,
      trimmedAcademicYear,
      initialStatus,
      filesArray ? JSON.stringify(filesArray) : null,
      tagsArray,
      trimmedVideoUrl
    ];

    console.log('Query values:', queryValues);

    try {
      // Log the SQL query for debugging
      const queryText = `INSERT INTO projects 
         (title, description, thumbnail, author_id, category, academic_year, status, files, tags, video_url, created_at) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP) 
         RETURNING *`;
      console.log('Executing query:', queryText);
      console.log('With values:', queryValues);

      // Insert project into the database
      const result = await query(queryText, queryValues);

      console.log('Database insert result:', result);

      if (!result.rows || result.rows.length === 0) {
        throw new Error('No rows returned from insert');
      }

      // Transform the response to include full URLs
      const project = {
        ...result.rows[0],
        thumbnail: result.rows[0].thumbnail,
        files: result.rows[0].files ? JSON.parse(result.rows[0].files) : null,
        tags: result.rows[0].tags || []
      };

      console.log('Project created successfully:', project);

      // Verify the project was actually inserted
      const verifyResult = await query('SELECT * FROM projects WHERE id = $1', [project.id]);
      console.log('Verification query result:', verifyResult.rows);

      res.status(201).json({
        message: 'Project created successfully',
        project
      });
    } catch (dbError) {
      console.error('Database error:', {
        message: dbError.message,
        code: dbError.code,
        detail: dbError.detail,
        hint: dbError.hint,
        where: dbError.where
      });
      
      // Create a serializable error object
      const errorResponse = {
        message: 'Error creating project',
        error: dbError.message,
        code: dbError.code,
        detail: dbError.detail
      };
      
      res.status(500).json(errorResponse);
    }
  } catch (error) {
    console.error('Create project error:', error);
    
    // Create a serializable error object
    const errorResponse = {
      message: 'Error creating project',
      error: error.message,
      code: error.code,
      detail: error.detail
    };
    
    res.status(500).json(errorResponse);
  }
};

// Get all projects (with filters)
const getProjects = async (req, res) => {
  try {
    console.log('=== getProjects called ===');
    console.log('Request query:', req.query);
    console.log('User:', req.user ? 'Authenticated' : 'Not authenticated');
    
    // First, verify database connection
    try {
      const connectionTest = await query('SELECT NOW() as current_time');
      console.log('Database connection verified:', connectionTest.rows[0].current_time);
    } catch (error) {
      console.error('Database connection error:', error);
      return res.status(500).json({ 
        message: 'Database connection error',
        error: error.message
      });
    }
    
    // Check project status distribution
    const statusCheck = await query(`
      SELECT status, COUNT(*) as count 
      FROM projects 
      GROUP BY status
    `);
    console.log('Project status distribution:', statusCheck.rows);
    
    const { status, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
    
    // Build the base query
    let queryString = `
      SELECT 
        p.id,
        p.title,
        p.description,
        p.thumbnail,
        p.category,
        p.academic_year,
        p.status,
        p.files,
        p.tags,
        p.video_url,
        p.created_at,
        p.updated_at,
        u.name as author_name,
        u.email as author_email
      FROM projects p
      LEFT JOIN users u ON p.author_id = u.id
    `;
    
    const values = [];
    let whereClauses = [];
    
    // If user is authenticated, they can see all projects
    // If not authenticated, they can only see approved projects
    if (!req.user) {
      whereClauses.push('p.status = $1');
      values.push('approved');
    } else if (status) {
      whereClauses.push('p.status = $1');
      values.push(status);
    }
    
    if (whereClauses.length > 0) {
      queryString += ' WHERE ' + whereClauses.join(' AND ');
    }
    
    queryString += ' ORDER BY p.created_at DESC LIMIT $' + (values.length + 1) + ' OFFSET $' + (values.length + 2);
    values.push(limit, offset);
    
    console.log('Final query:', queryString);
    console.log('Query values:', values);
    
    // Execute the query
    const result = await query(queryString, values);
    console.log('Query result rows:', result.rows.length);
    
    if (result.rows.length > 0) {
      console.log('First result row:', result.rows[0]);
    }
    
    // Format the projects
    const projects = result.rows.map(project => {
      try {
        return {
          id: project.id,
          title: project.title,
          description: project.description,
          thumbnail: project.thumbnail,
          category: project.category,
          academicYear: project.academic_year,
          status: project.status,
          files: project.files ? (typeof project.files === 'string' ? JSON.parse(project.files) : project.files) : null,
          tags: project.tags ? (Array.isArray(project.tags) ? project.tags : project.tags.split(',')) : [],
          videoUrl: project.video_url,
          createdAt: project.created_at,
          updatedAt: project.updated_at,
          author: {
            name: project.author_name,
            email: project.author_email
          }
        };
      } catch (error) {
        console.error('Error formatting project:', error);
        console.error('Problematic project data:', project);
        return null;
      }
    }).filter(project => project !== null);
    
    console.log('Formatted projects:', projects);
    res.json(projects);
  } catch (error) {
    console.error('Error in getProjects:', error);
    console.error('Error stack:', error.stack);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint
    });
    
    // Check if it's a database connection error
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return res.status(500).json({ 
        message: 'Database connection error',
        error: 'Could not connect to the database'
      });
    }
    
    // Check if it's a table not found error
    if (error.code === '42P01') {
      return res.status(500).json({ 
        message: 'Database table error',
        error: 'Required tables do not exist'
      });
    }
    
    // Check if it's a syntax error
    if (error.code === '42601') {
      return res.status(500).json({ 
        message: 'Database query error',
        error: 'Invalid SQL syntax'
      });
    }
    
    // Check if it's an SSL error
    if (error.code === '28000' || error.message.includes('SSL')) {
      return res.status(500).json({ 
        message: 'Database SSL error',
        error: 'SSL connection failed'
      });
    }
    
    res.status(500).json({ 
      message: 'Error fetching projects', 
      error: error.message,
      details: error.detail
    });
  }
};

// Get a single project
const getProject = async (req, res) => {
  try {
    console.log('Fetching project with ID:', req.params.id);
    
    const result = await query(
      `SELECT 
        p.*,
        u.name as author_name,
        u.email as author_email
       FROM projects p
       LEFT JOIN users u ON p.author_id = u.id
       WHERE p.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      console.log('Project not found with ID:', req.params.id);
      return res.status(404).json({ message: 'Project not found' });
    }

    // Get comments for the project
    const comments = await query(
      `SELECT c.*, u.name as user_name, u.avatar as user_avatar
       FROM comments c
       LEFT JOIN users u ON c.user_id = u.id
       WHERE c.project_id = $1
       ORDER BY c.created_at DESC`,
      [req.params.id]
    );

    // Parse the project data
    const projectData = result.rows[0];
    console.log('Raw project data from database:', {
      id: projectData.id,
      title: projectData.title,
      created_at: projectData.created_at,
      thumbnail: projectData.thumbnail,
      video_url: projectData.video_url,
      tags: projectData.tags,
      files: projectData.files
    });

    // Parse JSON fields
    let parsedFiles = null;
    try {
      if (typeof projectData.files === 'string') {
        parsedFiles = JSON.parse(projectData.files);
      } else if (Array.isArray(projectData.files)) {
        parsedFiles = projectData.files;
      } else {
        parsedFiles = null;
      }
    } catch (error) {
      console.error('Error parsing JSON fields:', error);
      parsedFiles = null;
    }

    // Create the project object with proper field mapping
    const project = {
      id: projectData.id,
      title: projectData.title,
      description: projectData.description,
      thumbnail: projectData.thumbnail || defaultThumbnails[Math.floor(Math.random() * defaultThumbnails.length)],
      files: parsedFiles,
      tags: projectData.tags || [],  // Tags are now a native array
      createdAt: projectData.created_at,
      videoUrl: projectData.video_url,
      category: projectData.category,
      academicYear: projectData.academic_year,
      status: projectData.status,
      author: {
        id: projectData.author_id,
        name: projectData.author_name || 'Unknown Author',
        email: projectData.author_email
      },
      comments: comments.rows.map(comment => ({
        id: comment.id,
        content: comment.content,
        createdAt: comment.created_at,
        user: {
          id: comment.user_id,
          name: comment.user_name || 'Unknown User',
          avatar: comment.user_avatar
        }
      }))
    };

    console.log('Processed project data being sent to frontend:', {
      id: project.id,
      title: project.title,
      createdAt: project.createdAt,
      thumbnail: project.thumbnail,
      videoUrl: project.videoUrl,
      tags: project.tags,
      files: project.files
    });

    res.json(project);
  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({ 
      message: 'Error fetching project',
      error: error.message,
      details: error.code
    });
  }
};

// Update project status (admin only)
const updateProjectStatus = async (req, res) => {
  const { status } = req.body;

  try {
    const result = await query(
      'UPDATE projects SET status = $1 WHERE id = $2 RETURNING *',
      [status, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Project not found' });
    }

    res.json({
      message: 'Project status updated successfully',
      project: result.rows[0]
    });
  } catch (error) {
    console.error('Update project status error:', error);
    res.status(500).json({ message: 'Error updating project status' });
  }
};

// Add a comment to a project
const addComment = async (req, res) => {
  const { content } = req.body;
  const projectId = req.params.id;

  try {
    // Insert the comment with the authenticated user's ID
    const result = await query(
      `INSERT INTO comments (project_id, user_id, content)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [projectId, req.user.id, content]
    );

    // Get user info for the comment
    const userInfo = await query(
      'SELECT id, name, avatar FROM users WHERE id = $1',
      [req.user.id]
    );

    const comment = {
      ...result.rows[0],
      user: {
        id: userInfo.rows[0].id,
        name: userInfo.rows[0].name,
        avatar: userInfo.rows[0].avatar
      }
    };

    res.status(201).json({
      message: 'Comment added successfully',
      comment
    });
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ message: 'Error adding comment' });
  }
};

// Get project statistics for admin dashboard
export const getProjectStats = async (req, res) => {
  try {
    console.log('=== Fetching Project Statistics ===');
    console.log('User making request:', req.user);

    // Get total projects count
    const totalResult = await query('SELECT COUNT(*) FROM projects');
    const totalProjects = parseInt(totalResult.rows[0].count);
    console.log('Total projects:', totalProjects);

    // Get pending projects count
    const pendingResult = await query(
      'SELECT COUNT(*) FROM projects WHERE status = $1',
      ['pending']
    );
    const pendingProjects = parseInt(pendingResult.rows[0].count);
    console.log('Pending projects:', pendingProjects);

    // Get approved projects count
    const approvedResult = await query(
      'SELECT COUNT(*) FROM projects WHERE status = $1',
      ['approved']
    );
    const approvedProjects = parseInt(approvedResult.rows[0].count);
    console.log('Approved projects:', approvedProjects);

    // Get recent projects (last 5)
    const recentResult = await query(
      'SELECT p.*, u.name as author_name ' +
      'FROM projects p ' +
      'JOIN users u ON p.author_id = u.id ' +
      'ORDER BY p.created_at DESC ' +
      'LIMIT 5'
    );
    console.log('Recent projects:', recentResult.rows.length);

    // Format response
    const stats = {
      total: totalProjects,
      pending: pendingProjects,
      approved: approvedProjects,
      recent: recentResult.rows.map(project => ({
        id: project.id,
        title: project.title,
        author: project.author_name,
        status: project.status,
        created_at: project.created_at
      }))
    };

    console.log('Sending stats:', stats);
    res.json(stats);
  } catch (error) {
    console.error('Error fetching project stats:', error);
    res.status(500).json({ 
      message: 'Error fetching project statistics',
      error: error.message,
      details: error.detail || 'No additional details available'
    });
  }
};

// Update project
const updateProject = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, category } = req.body;
    const userId = req.user.id;

    // Check if user is admin
    const user = await query(
      'SELECT role FROM users WHERE id = $1',
      [userId]
    );
    if (user.rows[0].role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can update projects' });
    }

    // Update project
    const result = await query(
      'UPDATE projects SET title = $1, description = $2, category = $3, updated_at = NOW() WHERE id = $4 RETURNING *',
      [title, description, category, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Project not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).json({ message: 'Error updating project' });
  }
};

// Delete project
const deleteProject = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if user is admin
    const user = await query(
      'SELECT role FROM users WHERE id = $1',
      [userId]
    );
    if (user.rows[0].role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can delete projects' });
    }

    // Delete project
    const result = await query(
      'DELETE FROM projects WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Project not found' });
    }

    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ message: 'Error deleting project' });
  }
};

// Test endpoint to verify database state
const testDatabaseState = async (req, res) => {
  try {
    console.log('Testing database state...');
    
    // Check all projects
    const allProjects = await query('SELECT id, title, status FROM projects');
    console.log('All projects:', allProjects.rows);
    
    // Check pending projects specifically
    const pendingProjects = await query(
      'SELECT id, title, status FROM projects WHERE status = $1',
      ['pending']
    );
    console.log('Pending projects:', pendingProjects.rows);
    
    // Check user roles
    const users = await query('SELECT id, email, role FROM users');
    console.log('Users:', users.rows);
    
    res.json({
      allProjects: allProjects.rows,
      pendingProjects: pendingProjects.rows,
      users: users.rows
    });
  } catch (error) {
    console.error('Database test error:', error);
    res.status(500).json({ 
      message: 'Error testing database state',
      error: error.message 
    });
  }
};

export {
  createProject,
  getProjects,
  getProject,
  updateProjectStatus,
  addComment,
  updateProject,
  deleteProject,
  testDatabaseState
};
