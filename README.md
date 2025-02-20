# Modern Todo Application

A full-stack Todo application with a modern UI, built with Node.js, Express, and PostgreSQL. Features include dark mode, keyboard shortcuts, task prioritization, and real-time task duration tracking.

## Features

- ✨ Modern, responsive UI with dark/light mode
- 🎯 Task prioritization (Low, Medium, High)
- ⌨️ Keyboard shortcuts for better productivity
- 🕒 Real-time task duration tracking
- 🔍 Filter tasks by status (All, Active, Completed)
- 📊 Sort tasks by date or priority
- 🔒 Secure API with input validation and rate limiting
- 🎨 Clean and accessible interface

## Tech Stack

- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **Backend**: Node.js, Express.js
- **Database**: PostgreSQL
- **Security**: Helmet.js, CORS, Rate Limiting
- **Validation**: Express Validator

## Prerequisites

- Node.js (v14 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn

## Installation

1. Clone the repository
2. Install dependencies using npm install
3. Create a .env file in the root directory
4. Initialize the database
5. Start the server using npm start

## Environment Variables

The following environment variables need to be set in your .env file:

- PORT
- DB_USER
- DB_PASSWORD
- DB_HOST
- DB_PORT
- DB_NAME
- ALLOWED_ORIGINS

## Keyboard Shortcuts

- Ctrl + D: Toggle dark/light mode
- Ctrl + K: Show/hide keyboard shortcuts
- Enter: Add new task (when input is focused)
- Escape: Cancel task editing

## API Endpoints

- GET /api/tasks: Get all tasks
- POST /api/tasks: Create a new task
- PUT /api/tasks/:id: Update a task
- DELETE /api/tasks/:id: Delete a task

## Security Features

- CORS protection
- Rate limiting
- XSS protection via Helmet
- Input validation
- Prepared statements for SQL queries

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Font Awesome for icons
- PostgreSQL for reliable data storage
- Express.js community for excellent middleware
