# CityHub Backend

A Node.js backend for the CityHub project management platform, built with Express and PostgreSQL.

## Features

- User authentication with JWT
- Project management API
- File upload handling
- Comment system
- Admin functionality
- Database integration

## Prerequisites

- Node.js (v16 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn
- Git

## Installation

1. Clone the repository:
```bash
git clone https://github.com/kwesi-koranteng/cityhub-backend.git
cd cityhub-backend
```

2. Install dependencies:
```bash
npm install
# or
yarn install
```

3. Create a `.env` file in the root directory:
```env
PORT=5000
DB_HOST=dpg-d084tqc9c44c73bheua0-a.oregon-postgres.render.com
JWT_SECRET=innovision_secret_key_2024
NODE_ENV=development
```

4. Set up the database:
```bash
# Create the database
createdb cityhub

# Run migrations
npm run migrate
```

5. Start the development server:
```bash
npm run dev
# or
yarn dev
```

The server will be available at `http://localhost:5000`

## API Endpoints

### Authentication
- POST /api/auth/register - Register a new user
- POST /api/auth/login - Login user
- GET /api/auth/me - Get current user

### Projects
- GET /api/projects - Get all projects
- POST /api/projects - Create a new project
- GET /api/projects/:id - Get project by ID
- PUT /api/projects/:id - Update project
- DELETE /api/projects/:id - Delete project

### Comments
- POST /api/projects/:id/comments - Add comment
- GET /api/projects/:id/comments - Get project comments



## Project Structure

```
src/
├── config/        # Configuration files
├── controllers/   # Route controllers
├── middleware/    # Custom middleware
├── models/        # Database models
├── routes/        # API routes
└── app.js         # Main application file
```

## Technologies Used

- Node.js
- Express
- PostgreSQL


