import { Pool } from 'pg';
import fs from 'fs/promises';
import path from 'path';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const setupDatabase = async () => {
  const pool = new Pool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
  });

  try {
    const result = await pool.query(`
      SELECT FROM pg_database WHERE datname = '${process.env.DB_NAME}'
    `);
    if (result.rows.length === 0) {
      await pool.query(`CREATE DATABASE ${process.env.DB_NAME}`);
      console.log(`Database ${process.env.DB_NAME} created.`);
    }

    const client = new Pool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT,
    });

    const schema = await fs.readFile(
      path.join(__dirname, 'schema.sql'),
      'utf-8'
    );

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('admin123', salt);

    const schemaWithPassword = schema.replace(
      '$2a$10$YourHashedPasswordHere',
      hashedPassword
    );

    await client.query(schemaWithPassword);

    console.log('✅ Database setup completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error setting up database:', error);
    process.exit(1);
  }
};

setupDatabase();
