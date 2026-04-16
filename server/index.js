require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const session = require('express-session');

const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const classesRoutes = require('./routes/classes');
const announcementsRoutes = require('./routes/announcements');
const { auth } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
  resave: false,
  saveUninitialized: true,
  cookie: { 
    secure: false, // Set to true if using HTTPS in production
    maxAge: 30 * 60 * 1000, // 30 minutes
    httpOnly: true
  }
}));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/classes', classesRoutes);
app.use('/api/announcements', auth, announcementsRoutes);

// Serve frontend (optional: static files from parent folder)
const clientPath = path.join(__dirname, '..');
app.use(express.static(clientPath));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// SPA fallback: serve index.html for client routes
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(clientPath, 'index.html'));
});

function startServer(port) {
  const server = app.listen(port, () => {
    console.log(`Server running at http://localhost:${server.address().port}`);
  });
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE' && port === 3000) {
      console.log('Port 3000 in use, trying 3001...');
      startServer(3001);
    } else {
      throw err;
    }
  });
}
startServer(PORT);
