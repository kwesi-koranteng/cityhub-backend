import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { login, signup, me } from '../controllers/authController.js';

const router = express.Router();

// Public routes
router.post('/register', signup);
router.post('/login', login);

// Protected routes
router.get('/me', authenticateToken, me);

export default router;
