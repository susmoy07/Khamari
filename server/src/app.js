import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import { checkDbHealth } from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import bazaarPriceRoutes from './routes/bazaarPriceRoutes.js';
import cropRoutes from './routes/cropRoutes.js';
import negotiationRoutes from './routes/negotiationRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import { errorHandler, notFoundHandler } from './middleware/errorMiddleware.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: true,
      credentials: true,
    })
  );
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use('/uploads', express.static(path.resolve(__dirname, '../uploads')));

  app.get('/api/health', async (_req, res) => {
    try {
      const dbOk = await checkDbHealth();
      return res.json({
        success: true,
        service: 'khamari-server',
        database: dbOk ? 'connected' : 'unavailable',
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      return res.status(503).json({
        success: false,
        service: 'khamari-server',
        database: 'disconnected',
        error: err.message,
      });
    }
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/bazaar-prices', bazaarPriceRoutes);
  app.use('/api/crops', cropRoutes);
  app.use('/api/negotiations', negotiationRoutes);
  app.use('/api/orders', orderRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
