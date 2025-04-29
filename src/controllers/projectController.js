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
  // Convert backslashes to forward slashes and remove any leading slashes
  const cleanPath = filePath.replace(/\\/g, '/').replace(/^\/+/, '');
  // Ensure we're using the correct base URL with proper path separation
  return `https://cityhub-backend.onrender.com/uploads/${cleanPath}`;
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
      user: req.user
    });

    const { title, description, category, academicYear, tags, videoUrl, thumbnail } = req.body;
    
    // Handle project files separately
    const projectFiles = req.files?.projectFiles || []; // Multiple project files

    console.log('Processed files:', {
      projectFiles: projectFiles
    });

    // Process project files (if any)
    const files = projectFiles.map(file => ({
      name: file.originalname,
      url: getFullUrl(file.path),
      type: file.mimetype
    }));

    // Allow projects without a thumbnail. Only validate if provided and not empty.
    let finalThumbnail = thumbnail;
    if (finalThumbnail && typeof finalThumbnail === 'string' && finalThumbnail.trim() !== '') {
      if (!finalThumbnail.trim().startsWith('http')) {
        return res.status(400).json({
          message: 'Please provide a valid image URL for the thumbnail.',
          field: 'thumbnail'
        });
      }
      finalThumbnail = finalThumbnail.trim();
    } else {
      finalThumbnail = null;
    }

    // Ensure required fields are present
    if (!title || !description || !category || !academicYear) {
      console.error('Missing required fields:', { title, description, category, academicYear });
      return res.status(400).json({ 
        message: 'Title, description, category, and academic year are required.',
        missingFields: {
          title: !title,
          description: !description,
          category: !category,
          academicYear: !academicYear
        }
      });
    }

    // Parse tags from JSON string
    let parsedTags = [];
    try {
      parsedTags = tags ? JSON.parse(tags) : [];
      console.log('Parsed tags:', parsedTags);
    } catch (error) {
      console.error('Error parsing tags:', error);
      return res.status(400).json({ message: 'Invalid tags format' });
    }

    // Format arrays for PostgreSQL
    const filesArray = files.length > 0 ? files : null;
    const tagsArray = parsedTags.length > 0 ? parsedTags : [];

    // Prepare the query values
    const queryValues = [
      title,
      description,
      finalThumbnail || null,  // Use final thumbnail URL
      req.user.id,  // Assuming the user ID is attached to req.user
      category,
      academicYear,
      'pending',  // Default status for new projects
      filesArray ? JSON.stringify(filesArray) : null,  // Store files as JSON
      tagsArray,  // Store tags as VARCHAR array
      videoUrl || null
    ];

    console.log('Query values:', queryValues);

    // Insert project into the database
    const result = await query(
      `INSERT INTO projects 
       (title, description, thumbnail, author_id, category, academic_year, status, files, tags, video_url, created_at) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP) 
       RETURNING *`,
      queryValues
    );

    // Transform the response to include full URLs
    const project = {
      ...result.rows[0],
      thumbnail: result.rows[0].thumbnail,  // Thumbnail is already a URL
      files: result.rows[0].files ? JSON.parse(result.rows[0].files) : null,
      tags: result.rows[0].tags || []  // Tags are now a native array
    };

    console.log('Project created successfully:', project);

    res.status(201).json({
      message: 'Project created successfully',
      project
    });
  } catch (error) {
    console.error('Create project error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      code: error.code
    });
    res.status(500).json({ 
      message: 'Error creating project',
      error: error.message,
      details: error.code
    });
  }
};

// Get all projects (with filters)
const getProjects = async (req, res) => {
  try {
    console.log('Fetching projects with filters:', req.query);
    
    let queryString = `
      SELECT 
        p.*,
        u.name as author_name,
        u.email as author_email
      FROM projects p
      LEFT JOIN users u ON p.author_id = u.id
      WHERE 1=1
    `;
    const values = [];
    let valueIndex = 1;

    // Add filters
    if (req.query.search) {
      queryString += ` AND (p.title ILIKE $${valueIndex} OR p.description ILIKE $${valueIndex})`;
      values.push(`%${req.query.search}%`);
      valueIndex++;
    }

    if (req.query.tags) {
      const tags = Array.isArray(req.query.tags) ? req.query.tags : [req.query.tags];
      queryString += ` AND p.tags && $${valueIndex}`;
      values.push(tags);
      valueIndex++;
    }

    if (req.query.category) {
      queryString += ` AND p.category = $${valueIndex}`;
      values.push(req.query.category);
      valueIndex++;
    }

    if (req.query.academicYear) {
      queryString += ` AND p.academic_year = $${valueIndex}`;
      values.push(req.query.academicYear);
      valueIndex++;
    }

    // Only show approved projects for non-admin users
    if (!req.user || req.user.role !== 'admin') {
      queryString += ` AND p.status = 'approved'`;
    }

    // Add status filter if provided
    if (req.query.status) {
      queryString += ` AND p.status = $${valueIndex}`;
      values.push(req.query.status);
      valueIndex++;
    }

    // Add order by created_at desc
    queryString += ` ORDER BY p.created_at DESC`;

    console.log('Executing query:', queryString);
    console.log('With values:', values);

    const result = await query(queryString, values);
    console.log('Query result:', result.rows);
    
    // Format the response to include full URLs and author information
    const projects = result.rows.map(project => ({
      ...project,
      thumbnail: project.thumbnail || defaultThumbnails[Math.floor(Math.random() * defaultThumbnails.length)],
      files: project.files ? (typeof project.files === 'string' ? JSON.parse(project.files) : project.files) : null,
      tags: Array.isArray(project.tags) ? project.tags : []
    }));

    res.json(projects);
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ message: 'Error fetching projects', error: error.message });
  }
};

// Get a single project
const getProject = async (req, res) => {
  try {
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
      thumbnail: projectData.thumbnail, // Use the URL directly
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
    res.status(500).json({ message: 'Error fetching project' });
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

// Get project statistics for dashboard
const getProjectStats = async (req, res) => {
  try {
    console.log('Fetching project stats...');
    const result = await query(`
      SELECT 
        COUNT(*) as total_projects,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_projects,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_projects
      FROM projects
    `);
    console.log('Query result:', result.rows[0]);

    const stats = {
      totalProjects: parseInt(result.rows[0].total_projects),
      pendingProjects: parseInt(result.rows[0].pending_projects),
      approvedProjects: parseInt(result.rows[0].approved_projects)
    };
    console.log('Sending stats:', stats);

    res.json(stats);
  } catch (error) {
    console.error('Get project stats error:', error);
    res.status(500).json({ message: 'Error fetching project statistics' });
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

export {
  createProject,
  getProjects,
  getProject,
  updateProjectStatus,
  addComment,
  getProjectStats,
  updateProject,
  deleteProject,
};
