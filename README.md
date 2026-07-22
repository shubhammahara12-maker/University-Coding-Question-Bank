# P4 - University Question Bank

This project is a Node.js web application for managing a university question bank. It supports user registration, login, password recovery, admin uploads, and dashboard-based question browsing.

## Overview

The application is built with:
- Express.js for the backend server
- SQLite for local data storage
- Multer for file uploads
- XLSX for reading Excel question files
- Static HTML/CSS/JS pages in the `public` folder

The backend runs on port `3001` and serves the frontend pages from `public/`.

## Features

- User registration with username/password and security answer
- Login authentication using a session token
- Password reset using the security question flow
- Admin-only access to upload Excel question files
- Student and admin dashboard views
- Question filtering by subject, category, topic, and level
- Uploaded file tracking and deletion from the admin panel
- SQLite database initialization on first run

## Tech Stack

- Node.js
- Express
- SQLite3
- Multer
- XLSX
- CORS

## Project Structure

- `server.js` - Main Express server and API endpoints
- `public/` - Frontend HTML, CSS, JS, and image assets
- `db/` - SQLite database directory
- `uploads/` - Uploaded Excel files and related storage
- `package.json` - Project metadata and scripts

## Installation

1. Open the project folder.
2. Install dependencies:

```bash
npm install
```

## Running the App

Start the server with either of the following commands:

```bash
npm start
```

or

```bash
node server.js
```

The application will be available at:

```text
http://localhost:3001/
```

## Default Admin Account

A default admin user is created automatically when the database is initialized:

- Username: `admin`
- Password: `12345678`

You should change this credential for production use.

## Main API Endpoints

### Authentication
- `POST /api/register` - Register a new student account
- `POST /api/login` - Login and receive a session token
- `POST /api/get-security-question` - Retrieve the security question for a username
- `POST /api/reset-password` - Reset a password using the security answer
- `POST /api/add-admin` - Create an admin account (admin-only)

### Questions and Uploads
- `POST /api/upload` - Upload an Excel file and insert questions into the database (admin-only)
- `GET /api/uploaded-files` - Get uploaded file history (admin-only)
- `DELETE /api/uploaded-file/:filename` - Delete an uploaded file and its related questions (admin-only)
- `GET /api/questions` - Fetch questions with optional filtering
- `GET /api/filters` - Get distinct filter values for subjects, categories, topics, and levels
- `GET /api/stats` - Get admin statistics

## Frontend Pages

The frontend includes these pages:

- `public/index.html` - Landing page
- `public/login.html` - Login page
- `public/register.html` - Registration page
- `public/forgot-password.html` - Password recovery page
- `public/student-dashboard.html` - Student dashboard
- `public/admin-dashboard.html` - Admin dashboard

## Upload Format

The admin upload feature expects an Excel file with columns such as:
- Subject
- Category
- Topic
- Level
- Question

The app reads the first sheet in the workbook and stores valid rows into the `questions` table.

## Database Behavior

On startup, the server creates the following SQLite tables if they do not already exist:

- `users`
- `questions`
- `uploaded_files`

The database file is stored in:

```text
db/database.sqlite
```

## Notes

- The project uses a local SQLite database, so no external database server is required.
- Uploaded files are saved under `uploads/`.
- The app currently stores plain-text passwords in the database, so this should be improved for real-world production use.
- If the server cannot start, verify that all dependencies are installed and that the `db/` and `uploads/` folders exist.

## Development Tip

For local development, you can use:

```bash
npm run dev
```

This works with `nodemon` to restart the server automatically after changes.
