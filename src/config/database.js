import pg from 'pg';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Set default environment if not set
const env = process.env.NODE_ENV || 'development';
console.log('Current environment:', env);

// Database configuration
const config = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: parseInt(process.env.DB_PORT),
  // SSL configuration for Render database
  ssl: {
    rejectUnauthorized: false,
    require: true
  }
};

// Validate required database configuration
if (!config.host || !config.user || !config.password || !config.database || !config.port) {
  throw new Error('Missing required database configuration. Please check your .env file.');
}

console.log('Database configuration:', {
  host: config.host,
  user: config.user,
  database: config.database,
  port: config.port,
  ssl: config.ssl ? 'enabled' : 'disabled'
});

// Create a new pool
const pool = new pg.Pool(config);

// Connection status flags
let connectionLogged = false;
let schemaVerified = false;

// Test the connection
pool.on('connect', () => {
  if (!connectionLogged) {
    console.log('Successfully connected to the database');
    connectionLogged = true;
  }
});

pool.on('error', (err) => {
  console.error('Database pool error:', err);
});

// Verify projects table schema
const verifyProjectsTable = async () => {
  if (schemaVerified) {
    return true;
  }

  try {
    console.log('Verifying projects table schema...');
    const result = await pool.query(`
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns
      WHERE table_name = 'projects'
    `);
    
    console.log('Projects table columns:', result.rows);
    console.log('Projects table schema verified successfully');
    schemaVerified = true;
    return true;
  } catch (error) {
    console.error('Error verifying projects table:', error);
    throw error;
  }
};

// Test database connection
const testConnection = async () => {
  try {
    const result = await pool.query('SELECT NOW() as current_time');
    console.log('Database time:', result.rows[0].current_time);
    await verifyProjectsTable();
    console.log('Database connection verified.');
  } catch (error) {
    console.error('Database connection test failed:', error);
    throw error;
  }
};

// Query function
const query = async (text, params) => {
  try {
    const start = Date.now();
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Executed query:', { text, duration, rows: result.rowCount });
    return result;
  } catch (error) {
    console.error('Query error:', error);
    throw error;
  }
};

// Export
export { pool, query, testConnection, verifyProjectsTable };

// Test the connection on startup
testConnection().catch(error => {
  console.error('Failed to connect to the database:', error);
});
