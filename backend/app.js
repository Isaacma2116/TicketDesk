import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import apiRoutes from './routes/index.js';
import { apiLimiter, verifyOrigin } from './middleware/security.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', env.trustProxy);

  app.use(helmet());
  app.use(
    cors({
      origin: env.corsOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.use((_req, res, next) => {
    // Las respuestas del API contienen datos personales: no se cachean.
    res.set('Cache-Control', 'no-store');
    next();
  });

  app.use('/api', apiLimiter, verifyOrigin, apiRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
