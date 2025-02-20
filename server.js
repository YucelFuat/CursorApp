require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const validator = require('validator');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Add these lines after creating the app but before other middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Add this line after creating the app but before the routes
app.use(express.static(path.join(__dirname, 'public')));

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
            fontSrc: ["'self'", "https://cdnjs.cloudflare.com"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    }
}));
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type']
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Input validation middleware
const validateTaskInput = (req, res, next) => {
    const { task_name, priority, status } = req.body;
    const errors = [];

    if (task_name) {
        if (!validator.isLength(task_name, { min: 1, max: 200 })) {
            errors.push('Task name must be between 1 and 200 characters');
        }
        if (!validator.matches(task_name, /^[a-zA-Z0-9\s\-_.,!?()]+$/)) {
            errors.push('Task name contains invalid characters');
        }
    }

    if (priority && !['low', 'medium', 'high'].includes(priority)) {
        errors.push('Invalid priority value');
    }

    if (status && !['ongoing', 'completed'].includes(status)) {
        errors.push('Invalid status value');
    }

    if (errors.length > 0) {
        return res.status(400).json({ errors });
    }

    next();
};

// Database configuration with connection pooling optimization
const pool = new Pool({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    max: 20, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

// Error handling for database connection
pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
});

// Create tasks table if it doesn't exist
async function initializeDatabase() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query(`
            CREATE TABLE IF NOT EXISTS tasks (
                id SERIAL PRIMARY KEY,
                created_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                task_name TEXT NOT NULL,
                priority VARCHAR(10) NOT NULL CHECK (priority IN ('low', 'medium', 'high')),
                status VARCHAR(20) DEFAULT 'ongoing' CHECK (status IN ('ongoing', 'completed')),
                completed_date TIMESTAMP WITH TIME ZONE,
                completion_duration INTERVAL,
                CONSTRAINT task_name_length CHECK (char_length(task_name) <= 200)
            )
        `);
        await client.query('COMMIT');
        console.log('Database initialized successfully');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error initializing database:', err);
        throw err;
    } finally {
        client.release();
    }
}

initializeDatabase();

// API Endpoints with proper error handling and input validation
app.get('/api/tasks', async (req, res) => {
    const client = await pool.connect();
    try {
        const result = await client.query(`
            SELECT 
                id, 
                created_date, 
                task_name, 
                priority, 
                status, 
                completed_date,
                CASE 
                    WHEN completion_duration IS NOT NULL THEN
                        CONCAT(
                            CASE WHEN EXTRACT(DAY FROM completion_duration) > 0 
                                THEN EXTRACT(DAY FROM completion_duration)::text || 'd ' 
                                ELSE '' END,
                            CASE WHEN EXTRACT(HOUR FROM completion_duration) > 0 
                                THEN EXTRACT(HOUR FROM completion_duration)::text || 'h ' 
                                ELSE '' END,
                            CASE WHEN EXTRACT(MINUTE FROM completion_duration) > 0 
                                THEN EXTRACT(MINUTE FROM completion_duration)::text || 'm'
                                ELSE '' END
                        )
                    ELSE NULL
                END as completion_duration
            FROM tasks 
            ORDER BY created_date DESC
        `);
        res.json(result.rows);
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        client.release();
    }
});

app.post('/api/tasks', validateTaskInput, async (req, res) => {
    const client = await pool.connect();
    try {
        const { task_name, priority } = req.body;
        const result = await client.query(
            'INSERT INTO tasks (task_name, priority) VALUES ($1, $2) RETURNING *',
            [task_name, priority]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        client.release();
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
                    completion_duration = age(CURRENT_TIMESTAMP, created_date),
                    priority = $2,
                    task_name = $3
                WHERE id = $4 
                RETURNING *,
                    CASE 
                        WHEN completion_duration IS NOT NULL THEN
                            CONCAT(
                                CASE WHEN EXTRACT(DAY FROM completion_duration) > 0 
                                    THEN EXTRACT(DAY FROM completion_duration)::text || 'd ' 
                                    ELSE '' END,
                                CASE WHEN EXTRACT(HOUR FROM completion_duration) > 0 
                                    THEN EXTRACT(HOUR FROM completion_duration)::text || 'h ' 
                                    ELSE '' END,
                                CASE WHEN EXTRACT(MINUTE FROM completion_duration) > 0 
                                    THEN EXTRACT(MINUTE FROM completion_duration)::text || 'm'
                                    ELSE '' END
                            )
                        ELSE NULL
                    END as formatted_duration
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
        
        // If we have a formatted duration, use it instead of the raw interval
        if (result.rows[0].formatted_duration) {
            result.rows[0].completion_duration = result.rows[0].formatted_duration;
            delete result.rows[0].formatted_duration;
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

// Add these routes before app.listen()
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
}); 