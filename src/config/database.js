import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
});

// Export ES module style
export const query = (text, params) => pool.query(text, params);

export const API_BASE_URL = "http://localhost:5000/api";

// Example using fetch
const signup = async (name, email, password) => {
  const res = await fetch(`${API_BASE_URL}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
  });
  return res.json();
};

const login = async (email, password) => {
  const res = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return res.json();
};

// On the frontend, save token in localStorage or context
// On the backend, retrieve token from request header (for example, in your authController)

const uploadProject = async (formData, token) => {
  const res = await fetch(`${API_BASE_URL}/projects`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,  // Pass token as Bearer token in the header
    },
    body: formData, // formData should include all fields and files
  });
  return res.json();
};
