/**
 * GulfHive ERP - Reports, Dashboard, Documents & System Reliability Router
 * Handles executive dashboard stats, document file storage (upload/download/delete), and system backup & restore.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { dashboardRepository } from '../infrastructure/database/repositories/dashboard.repository.ts';
import { currentRuntime } from '../infrastructure/runtime/index.ts';
import { authenticateToken, requireCompanyAccess } from '../core/security/auth.middleware.ts';
import {
  PathTraversalError,
  FileNotFoundError,
  StorageNotConfiguredError,
} from '../infrastructure/runtime/runtime-context.ts';
import { ValidationError, NotFoundError } from '../core/errors/app-error.ts';
import { logger } from '../core/logging/logger.ts';

export const reportsRouter = Router();

// Executive Dashboard Summary
reportsRouter.get('/companies/:companyId/dashboard', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const branchId = req.query.branchId as string | undefined;
    const summary = await dashboardRepository.getDashboardSummary(req.params.companyId, branchId);
    res.json({ summary });
  } catch (error) {
    next(error);
  }
});

// Document File Storage
reportsRouter.post('/companies/:companyId/documents/upload', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.params.companyId;
    const { path: docPath, contentBase64, contentType } = req.body;

    if (!docPath || !contentBase64) {
      throw new ValidationError('path and contentBase64 parameters are required.');
    }

    const buffer = Buffer.from(contentBase64, 'base64');
    const metadata = await currentRuntime.storageService.saveDocument(
      tenantId,
      docPath,
      buffer,
      contentType || 'application/octet-stream'
    );

    res.status(201).json({ metadata });
  } catch (error) {
    next(error);
  }
});

reportsRouter.get('/companies/:companyId/documents/:docPath(*)', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.params.companyId;
    const docPath = req.params.docPath;

    const { content, metadata } = await currentRuntime.storageService.readDocument(tenantId, docPath);

    res.setHeader('Content-Type', metadata.contentType || 'application/octet-stream');
    res.setHeader('Content-Length', metadata.sizeBytes);
    res.setHeader('X-Document-Checksum', metadata.checksum);
    res.send(content);
  } catch (error) {
    next(error);
  }
});

reportsRouter.delete('/companies/:companyId/documents/:docPath(*)', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.params.companyId;
    const docPath = req.params.docPath;

    const deleted = await currentRuntime.storageService.deleteDocument(tenantId, docPath);
    res.json({ deleted });
  } catch (error) {
    next(error);
  }
});

// System Backup & Restore
reportsRouter.post('/companies/:companyId/system/backups', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const metadata = await currentRuntime.backupService.createBackup(req.body?.targetPath);
    res.status(201).json({ backup: metadata });
  } catch (error) {
    next(error);
  }
});

reportsRouter.get('/companies/:companyId/system/backups', authenticateToken, requireCompanyAccess, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const backups = await currentRuntime.backupService.listBackups();
    res.json({ backups });
  } catch (error) {
    next(error);
  }
});

reportsRouter.post('/companies/:companyId/system/backups/verify', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { backupIdOrPath } = req.body;
    if (!backupIdOrPath) {
      throw new ValidationError('backupIdOrPath parameter is required.');
    }
    const isValid = await currentRuntime.backupService.verifyBackup(backupIdOrPath);
    res.json({ isValid });
  } catch (error) {
    next(error);
  }
});

reportsRouter.post('/companies/:companyId/system/backups/restore', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { backupIdOrPath } = req.body;
    if (!backupIdOrPath) {
      throw new ValidationError('backupIdOrPath parameter is required.');
    }
    const restored = await currentRuntime.backupService.restoreBackup(backupIdOrPath);
    res.json({ restored });
  } catch (error) {
    next(error);
  }
});
