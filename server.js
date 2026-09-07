const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Initialize database
const { initDb } = require('./db/database');

const authRoutes = require('./routes/auth');
const jobsRoutes = require('./routes/jobs');
const applicationRoutes = require('./routes/applications');

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files statically if needed
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    service: 'Job Portal API'
  });
});

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/jobs', jobsRoutes);
app.use('/api/applications', applicationRoutes);

// Production frontend static files serving
const frontendDist = path.join(__dirname, '../frontend/dist');
const fs = require('fs');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
      return next();
    }
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  if (err instanceof require('multer').MulterError) {
    return res.status(400).json({ message: `Upload error: ${err.message}` });
  }
  res.status(500).json({ message: err.message || 'An unexpected error occurred.' });
});

const startServer = async () => {
  try {
    await initDb();
    app.listen(PORT, () => {
      console.log(`Job Portal API server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  }
};

startServer();
