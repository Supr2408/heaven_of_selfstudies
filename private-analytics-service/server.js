require('dotenv').config();

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const authRoutes = require('./src/routes/authRoutes');
const ingestRoutes = require('./src/routes/ingestRoutes');
const summaryRoutes = require('./src/routes/summaryRoutes');
const exportRoutes = require('./src/routes/exportRoutes');
const { errorHandler } = require('./src/middleware/errorHandler');

const app = express();
const port = Number.parseInt(process.env.PORT || '5100', 10) || 5100;
const mongoUri =
  process.env.PRIVATE_ANALYTICS_MONGODB_URI ||
  'mongodb://localhost:27017/nptel_private_analytics';

const allowedOrigins = [
  String(process.env.ADMIN_FRONTEND_URL || '').trim(),
  'http://localhost:3100',
].filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error('CORS origin not allowed'));
    },
    credentials: false,
  })
);
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Private analytics service is running',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/ingest', ingestRoutes);
app.use('/api/summary', summaryRoutes);
app.use('/api/export', exportRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.path,
  });
});

app.use(errorHandler);

mongoose
  .connect(mongoUri)
  .then(() => {
    console.log(`Private analytics MongoDB connected on ${mongoUri}`);
    app.listen(port, () => {
      console.log(`Private analytics service listening on port ${port}`);
    });
  })
  .catch((error) => {
    console.error('Failed to connect private analytics MongoDB:', error.message);
    process.exit(1);
  });
