import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import authRoutes from './routes/authRoutes.js';
import eventRoutes from './routes/eventRoutes.js';
import reservationRoutes from './routes/reservationRoutes.js';
import bookingRoutes from './routes/bookingRoutes.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

export function createApp({ clientOrigin = true, nodeEnv = 'development' } = {}) {
  const app = express();

  // express-rate-limit needs the real client IP behind a proxy.
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(cors({ origin: clientOrigin }));
  app.use(express.json());
  if (nodeEnv !== 'test') {
    app.use(morgan(nodeEnv === 'production' ? 'combined' : 'dev'));
  }

  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

  app.use('/api/auth', authRoutes);
  app.use('/api/events', eventRoutes);
  app.use('/api/reserve', reservationRoutes);
  app.use('/api/bookings', bookingRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
