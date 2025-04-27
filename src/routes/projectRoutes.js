import express from 'express';
const router = express.Router();
import multer from 'multer';
import path from 'path';
import { auth, adminAuth } from '../middleware/auth.js';
import { 
  createProject, 
  getProjects, 
  getProject, 
  updateProjectStatus, 
  addComment,
  getProjectStats,
  updateProject,
  deleteProject,
} from '../controllers/projectController.js';

// Configure multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// Configure multer upload
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

// Debug middleware to log request details
const debugMiddleware = (req, res, next) => {
  console.log('Request headers:', req.headers);
  console.log('Request body:', req.body);
  console.log('Request files:', req.files);
  next();
};

// Project routes
router.get('/stats', auth, getProjectStats);
router.get('/', auth, getProjects);
router.get('/:id', auth, getProject);
router.post('/', 
  auth, 
  debugMiddleware,
  upload.fields([
    { name: 'thumbnail', maxCount: 1 },
    { name: 'projectFiles', maxCount: 5 }
  ]),
  createProject
);
router.patch('/:id/status', adminAuth, updateProjectStatus);
router.post('/:id/comments', auth, addComment);
router.put('/:id', auth, updateProject);
router.delete('/:id', auth, deleteProject);

export default router;
