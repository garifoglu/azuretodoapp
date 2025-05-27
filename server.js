const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false
  } : false
});

// Initialize database
const initializeDatabase = async () => {
  try {
    // Only initialize in development
    if (process.env.NODE_ENV === 'production') {
      console.log('Skipping database initialization in production');
      return true;
    }

    // Drop existing tables
    await pool.query('DROP TABLE IF EXISTS todos');
    await pool.query('DROP TABLE IF EXISTS users');
    
    // Create users table
    await pool.query(`
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create todos table
    await pool.query(`
      CREATE TABLE todos (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        description VARCHAR(255) NOT NULL,
        completed BOOLEAN DEFAULT FALSE,
        deadline TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log('Database initialized successfully');
    return true;
  } catch (err) {
    console.error('Error initializing database:', err);
    return false;
  }
};

// Auth Routes
app.post('/api/register', async (req, res) => {
  try {
    console.log('Registration attempt with:', { email: req.body.email });
    
    const { email, password } = req.body;
    
    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Check if user already exists
    const userExists = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userExists.rows.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Insert new user
    const newUser = await pool.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
      [email, hashedPassword]
    );
    
    console.log('Created new user:', newUser.rows[0]);
    
    // Create token
    const token = jwt.sign(
      { id: newUser.rows[0].id, email: newUser.rows[0].email },
      process.env.JWT_SECRET || 'your-secret-key'
    );
    
    console.log('Registration successful for:', { email: req.body.email, id: newUser.rows[0].id });
    res.json({ token });
  } catch (err) {
    console.error('Registration error:', err.message);
    res.status(500).json({ error: 'Error in registration: ' + err.message });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    
    if (user.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    const validPassword = await bcrypt.compare(password, user.rows[0].password_hash);
    
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid password' });
    }
    
    const token = jwt.sign(
      { id: user.rows[0].id, email: user.rows[0].email },
      process.env.JWT_SECRET || 'your-secret-key'
    );
    
    res.json({ token });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Error in login: ' + err.message });
  }
});

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access denied' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
    if (err) {
      console.error('Token verification error:', err);
      return res.status(403).json({ error: 'Invalid token' });
    }
    console.log('Decoded user:', user);
    req.user = user;
    next();
  });
};

// Todo Routes
app.get('/api/todos', authenticateToken, async (req, res) => {
  try {
    console.log('Fetching todos for user:', req.user);
    const allTodos = await pool.query(
      'SELECT * FROM todos WHERE user_id = $1 ORDER BY id',
      [req.user.id]
    );
    res.json(allTodos.rows);
  } catch (err) {
    console.error('Error fetching todos:', err.message);
    res.status(500).json({ error: 'Database error: ' + err.message });
  }
});

app.post('/api/todos', authenticateToken, async (req, res) => {
  try {
    const { description, deadline } = req.body;
    console.log('Creating todo:', { description, deadline, userId: req.user.id });
    const newTodo = await pool.query(
      'INSERT INTO todos (description, user_id, deadline) VALUES($1, $2, $3) RETURNING *',
      [description, req.user.id, deadline]
    );
    console.log('Created todo:', newTodo.rows[0]);
    res.json(newTodo.rows[0]);
  } catch (err) {
    console.error('Error creating todo:', err.message);
    res.status(500).json({ error: 'Database error: ' + err.message });
  }
});

app.put('/api/todos/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { description, completed, deadline } = req.body;
    const updateTodo = await pool.query(
      'UPDATE todos SET description = $1, completed = $2, deadline = $3 WHERE id = $4 AND user_id = $5 RETURNING *',
      [description, completed, deadline, id, req.user.id]
    );
    
    if (updateTodo.rows.length === 0) {
      return res.status(404).json({ error: 'Todo not found or unauthorized' });
    }
    
    res.json(updateTodo.rows[0]);
  } catch (err) {
    console.error('Error updating todo:', err.message);
    res.status(500).json({ error: 'Database error: ' + err.message });
  }
});

app.delete('/api/todos/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'DELETE FROM todos WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Todo not found or unauthorized' });
    }
    
    res.json({ message: 'Todo deleted successfully' });
  } catch (err) {
    console.error('Error deleting todo:', err.message);
    res.status(500).json({ error: 'Database error: ' + err.message });
  }
});

// Serve static assets in production
if (process.env.NODE_ENV === 'production') {
  // Serve static files from the React app
  app.use(express.static(path.join(__dirname, 'client/build')));

  // Handle any requests that don't match the above
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'client/build/index.html'));
  });
}

// Start server only after database is initialized
const startServer = async () => {
  try {
    // Test database connection
    const client = await pool.connect();
    console.log('Successfully connected to database');
    client.release();

    // Initialize database
    const initialized = await initializeDatabase();
    if (!initialized) {
      console.error('Failed to initialize database');
      process.exit(1);
    }

    // Start server
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Error starting server:', err);
    process.exit(1);
  }
};

startServer(); 