import express from 'express';
import { createProject, getProjects, getProject, updateProjectStatus, addComment, getProjectStats, updateProject, deleteProject, testDatabaseState } from '../controllers/projectController.js';
import { authenticateToken, adminAuth } from '../middleware/auth.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = express.Router();

// Set default environment if not set
const env = process.env.NODE_ENV || 'development';
console.log('Current environment:', env);

// Configure multer based on environment
let storage;
if (env === 'production') {
  // In production, use memory storage
  storage = multer.memoryStorage();
} else {
  // In development, use disk storage
  const uploadsDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
  });
}

// Configure multer
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 5 // Maximum 5 files
  },
  fileFilter: (req, file, cb) => {
    // Accept images, PDFs, and common document formats
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/zip',
      'application/x-rar-compressed'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images, PDFs, and documents are allowed.'));
    }
  }
});

// Debug middleware to log request details
const debugMiddleware = (req, res, next) => {
  console.log('Request received:', {
    method: req.method,
    url: req.originalUrl,
    query: req.query,
    headers: {
      authorization: req.headers.authorization,
      accept: req.headers.accept,
      origin: req.headers.origin
    }
  });
  next();
};

// Apply debug middleware to all routes
router.use(debugMiddleware);

// Test endpoint (no auth required for testing)
router.get('/test', testDatabaseState);

// Public routes (no authentication required)
router.get('/', (req, res, next) => {
  // If status=approved, allow without authentication
  if (req.query.status === 'approved') {
    return next();
  }
  // Otherwise require authentication
  authenticateToken(req, res, next);
}, getProjects);

// Protected routes
router.post('/', authenticateToken, upload.any(), createProject);
router.get('/:id', authenticateToken, getProject);
router.patch('/:id/status', authenticateToken, adminAuth, updateProjectStatus);
router.post('/:id/comments', authenticateToken, addComment);
router.get('/stats/dashboard', authenticateToken, adminAuth, getProjectStats);
router.put('/:id', authenticateToken, adminAuth, updateProject);
router.delete('/:id', authenticateToken, adminAuth, deleteProject);

export default router;
