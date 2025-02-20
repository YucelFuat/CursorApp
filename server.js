require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.')); // Serve static files from current directory

// Database configuration
const pool = new Pool({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME
});

// Create tasks table if it doesn't exist
async function initializeDatabase() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS tasks (
                id SERIAL PRIMARY KEY,
                created_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                task_name TEXT NOT NULL,
                priority VARCHAR(10) NOT NULL,
                status VARCHAR(20) DEFAULT 'ongoing',
                completed_date TIMESTAMP WITH TIME ZONE,
                completion_duration INTERVAL
            )
        `);
        console.log('Database initialized successfully');
    } catch (err) {
        console.error('Error initializing database:', err);
    }
}

initializeDatabase();

// API Endpoints

// Get all tasks
app.get('/api/tasks', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM tasks ORDER BY created_date DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create a new task
app.post('/api/tasks', async (req, res) => {
    const { task_name, priority } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO tasks (task_name, priority) VALUES ($1, $2) RETURNING *',
            [task_name, priority]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update task status
app.put('/api/tasks/:id', async (req, res) => {
    const { id } = req.params;
    const { status, priority, task_name } = req.body;
    
    try {
        let query, params;
        
        if (status === 'completed') {
            query = `
                UPDATE tasks 
                SET status = $1, 
                    completed_date = CURRENT_TIMESTAMP,
                    completion_duration = CURRENT_TIMESTAMP - created_date,
                    priority = $2,
                    task_name = $3
                WHERE id = $4 
                RETURNING *
            `;
            params = [status, priority, task_name, id];
        } else {
            query = `
                UPDATE tasks 
                SET status = $1, 
                    completed_date = NULL,
                    completion_duration = NULL,
                    priority = $2,
                    task_name = $3
                WHERE id = $4 
                RETURNING *
            `;
            params = [status, priority, task_name, id];
        }
        
        const result = await pool.query(query, params);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }
        
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete a task
app.delete('/api/tasks/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM tasks WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }
        res.json({ message: 'Task deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
}); 