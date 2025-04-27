import express from 'express';
const router = express.Router();
import { signup, login, me } from '../controllers/authController.js';
import { auth } from '../middleware/auth.js';

// Auth routes
router.post('/signup', signup);
router.post('/login', login);
router.get('/me', auth, me);

export default router;
