/**
 * GulfHive ERP - Enterprise Backend Server
 * Express fullstack server with Cloud SQL integration, Firebase Auth, modular routers, and Vite dev integration.
 */

import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { appConfig } from './src/core/config/app-config.ts';
import { logger } from './src/core/logging/logger.ts';
import { currentRuntime } from './src/infrastructure/runtime/index.ts';
import { EnvironmentValidator } from './src/core/config/env-validator.ts';
import { TenantContextHolder, TenantContext } from './src/core/domain/tenant-context.ts';
import { authenticateToken, requireCompanyAccess } from './src/core/security/auth.middleware.ts';
import { errorHandler } from './src/core/security/error-handler.ts';
import { MigrationRunner } from './src/infrastructure/database/migrations/migration-runner.ts';
import { ensureDefaultAdmin } from './src/infrastructure/database/seeds/ensure-admin.ts';
import { apiRouter } from './src/routes/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// CORS & Preflight Handling for hosted and separate-origin deployments
app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Correlation-ID, X-Requested-With, Accept');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});

// Request logging middleware with correlation IDs (scoped to API routes)
app.use((req: Request, res: Response, next: NextFunction) => {
  if (!req.originalUrl.startsWith('/api')) {
    return next();
  }

  const correlationId = (req.headers['x-correlation-id'] as string) || `req_${Date.now()}`;
  res.setHeader('X-Correlation-ID', correlationId);

  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`, {
      correlationId,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
    });
  });
  next();
});

// System Health & Diagnostics API
app.get('/api/health', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const diagnostics = await currentRuntime.getSystemDiagnostics();
    const statusCode = diagnostics.status === 'UNHEALTHY' ? 503 : 200;
    res.status(statusCode).json({
      status: diagnostics.status,
      app: 'GulfHive ERP',
      deploymentMode: appConfig.deploymentMode,
      timestamp: diagnostics.timestamp,
      database: diagnostics.database,
      storage: diagnostics.storage,
      backup: diagnostics.backup,
    });
  } catch (error) {
    next(error);
  }
});

// Canonical Multi-Company Isolation & Tenant Context Middleware
app.use(['/api/companies/:companyId', '/api/companies/:id'], (req: Request, res: Response, next: NextFunction) => {
  if (req.params.id && !req.params.companyId) {
    req.params.companyId = req.params.id;
  }
  const correlationId = (req.headers['x-correlation-id'] as string) || (res.getHeader('X-Correlation-ID') as string) || `req_${Date.now()}`;
  const companyId = req.params.companyId;

  const tenantCtx: TenantContext = {
    tenantId: companyId,
    companyCode: companyId.substring(0, 12),
    countryCode: 'KW',
    baseCurrency: 'KWD',
    timezone: 'Asia/Kuwait',
    requestId: correlationId,
  };

  return TenantContextHolder.run(tenantCtx, () => {
    return authenticateToken(req, res, () => {
      return requireCompanyAccess(req, res, next);
    });
  });
});

// Mount Bounded Context API Routers
app.use('/api', apiRouter);

// 404 Handler for undefined API routes
app.all('/api/*', (_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'The requested API endpoint was not found.',
    code: 'NOT_FOUND',
  });
});

// Centralized API Error Handling Middleware
app.use(errorHandler);

// Start Server & integrate Vite dev or static files
async function startServer() {
  try {
    EnvironmentValidator.assertValidOrExit();
    const migrationRunner = new MigrationRunner();
    await migrationRunner.runAllMigrations();
    await ensureDefaultAdmin();
  } catch (mErr: any) {
    logger.error('[FATAL] Database migration failed! Halting application startup to prevent corrupt operations with incomplete schema.', {
      error: mErr.message,
      stack: mErr.stack,
    });
    process.exit(1);
  }

  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, () => {
    logger.info(`GulfHive ERP server running on port ${PORT} [Mode: ${appConfig.deploymentMode}]`);
  });
}

if (process.env.NODE_ENV !== 'test') {
  startServer().catch((err) => {
    logger.error('Fatal server startup failure', err);
    process.exit(1);
  });
}

export { app };
