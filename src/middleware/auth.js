import jwt from 'jsonwebtoken';
import { query } from '../config/database.js';

// Middleware to authenticate JWT token
export const authenticateToken = async (req, res, next) => {
  try {
    console.log('=== Authentication Check ===');
    console.log('Request URL:', req.originalUrl);
    console.log('Request method:', req.method);
    console.log('Request headers:', {
      authorization: req.headers.authorization,
      accept: req.headers.accept,
      origin: req.headers.origin
    });
    
    const authHeader = req.headers['authorization'];
    console.log('Auth header:', authHeader);
    
    if (!authHeader) {
      console.log('No authorization header found');
      return res.status(401).json({ message: 'No authorization header' });
    }

    const token = authHeader.split(' ')[1];
    console.log('Token extracted:', token ? 'Present' : 'Missing');

    if (!token) {
      console.log('No token found in authorization header');
      return res.status(401).json({ message: 'No token provided' });
    }

    console.log('Token found, verifying...');
    console.log('JWT Secret:', process.env.JWT_SECRET ? 'Present' : 'Missing');
    
    try {
      // Verify token and get user data
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log('Token decoded successfully:', {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role
      });

      // Get user from database
      const userResult = await query(
        'SELECT id, email, name, role FROM users WHERE id = $1',
        [decoded.id]
      );

      if (userResult.rows.length === 0) {
        console.log('User not found in database for ID:', decoded.id);
        return res.status(401).json({ message: 'User not found' });
      }

      console.log('User found in database:', userResult.rows[0]);
      req.user = userResult.rows[0];
      next();
    } catch (jwtError) {
      console.error('JWT verification error:', {
        name: jwtError.name,
        message: jwtError.message,
        expiredAt: jwtError.expiredAt
      });
      
      if (jwtError.name === 'JsonWebTokenError') {
        return res.status(401).json({ message: 'Invalid token' });
      }
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({ message: 'Token expired' });
      }
      throw jwtError;
    }
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ 
      message: 'Authentication error', 
      error: error.message,
      details: error.name
    });
  }
};

// Middleware to check if user is admin
export const adminAuth = async (req, res, next) => {
  try {
    console.log('=== Admin Authorization Check ===');
    console.log('Request URL:', req.originalUrl);
    console.log('Request method:', req.method);
    console.log('User:', req.user);
    
    if (!req.user) {
      console.log('No user found in request');
      return res.status(401).json({ 
        message: 'Not authenticated',
        error: 'User not found in request'
      });
    }

    // Double check user role in database
    const userCheck = await query(
      'SELECT id, email, role FROM users WHERE id = $1',
      [req.user.id]
    );

    if (userCheck.rows.length === 0) {
      console.log('User not found in database:', req.user.id);
      return res.status(401).json({ 
        message: 'User not found',
        error: 'User does not exist in database'
      });
    }

    const userRole = userCheck.rows[0].role;
    console.log('User role from database:', userRole);

    if (userRole !== 'admin') {
      console.log('User is not an admin:', {
        userId: req.user.id,
        userRole: userRole,
        requiredRole: 'admin'
      });
      return res.status(403).json({ 
        message: 'Access denied. Admin privileges required.',
        error: 'Insufficient permissions',
        userRole: userRole,
        requiredRole: 'admin'
      });
    }

    console.log('Admin authorization successful');
    next();
  } catch (error) {
    console.error('Admin authorization error:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      detail: error.detail
    });
    
    res.status(500).json({ 
      message: 'Authorization error',
      error: error.message
    });
  }
};
