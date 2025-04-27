import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

export const auth = (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      console.log('No token provided in request');
      return res.status(401).json({ message: 'Authentication required' });
    }

    console.log('Verifying token:', token);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Decoded token:', decoded);
    
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ message: 'Invalid token' });
  }
};

export const adminAuth = (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      console.log('No token provided in admin request');
      return res.status(401).json({ message: 'Authentication required' });
    }

    console.log('Verifying admin token:', token);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Decoded admin token:', decoded);

    if (decoded.role !== 'admin') {
      console.log('User is not an admin:', decoded);
      return res.status(403).json({ message: 'Admin access required' });
    }

    req.user = decoded;
    next();
  } catch (error) {
    console.error('Admin auth middleware error:', error);
    res.status(401).json({ message: 'Invalid token' });
  }
};
