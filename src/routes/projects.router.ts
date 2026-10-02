/**
 * GulfHive ERP - Projects, Subcontracts & Workforce Deployment Router
 * Handles Projects, Billing Profiles, External Workers, Workforce Deployments, and Labour Settlements.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { projectsRepository } from '../infrastructure/database/repositories/projects.repository.ts';
import { authenticateToken, requireCompanyAccess } from '../core/security/auth.middleware.ts';
import { ValidationError, NotFoundError } from '../core/errors/app-error.ts';
import { logger } from '../core/logging/logger.ts';

export const projectsRouter = Router();

// Billing Profiles & Authorizations
projectsRouter.get('/companies/:companyId/projects/billing-profiles', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const list = await projectsRepository.listBillingProfiles(req.params.companyId);
    res.json({ billingProfiles: list });
  } catch (error) {
    next(error);
  }
});

projectsRouter.post('/companies/:companyId/projects/billing-profiles', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profile = await projectsRepository.createBillingProfile(req.params.companyId, req.body, (req as any).user?.uid || 'admin');
    res.status(201).json({ billingProfile: profile });
  } catch (error) {
    next(error);
  }
});

projectsRouter.post('/companies/:companyId/projects/billing-profiles/:id/authorizations', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id) || id <= 0) throw new ValidationError('Invalid billing profile ID');
    const auth = await projectsRepository.createBillingAuthorization(req.params.companyId, {
      ...req.body,
      billingProfileId: id,
    }, (req as any).user?.uid || 'admin');
    res.status(201).json({ authorization: auth });
  } catch (error) {
    next(error);
  }
});

projectsRouter.get('/companies/:companyId/projects/billing-profiles/:id', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id) || id <= 0) throw new ValidationError('Invalid billing profile ID');
    const profile = await projectsRepository.getBillingProfile(req.params.companyId, id);
    if (!profile) throw new NotFoundError('Billing profile', req.params.id);
    res.json({ billingProfile: profile });
  } catch (error) {
    next(error);
  }
});

projectsRouter.put('/companies/:companyId/projects/billing-profiles/:id', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id) || id <= 0) throw new ValidationError('Invalid billing profile ID');
    const profile = await projectsRepository.updateBillingProfile(req.params.companyId, id, req.body, (req as any).user?.uid || 'admin');
    res.json({ billingProfile: profile });
  } catch (error) {
    next(error);
  }
});

// External Workers
projectsRouter.post('/companies/:companyId/projects/external-workers/bulk-delete/preflight', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { workerIds } = req.body;
    const preflight = await projectsRepository.preflightBulkDeleteExternalWorkers(req.params.companyId, workerIds);
    res.json({ preflight });
  } catch (error) {
    next(error);
  }
});

projectsRouter.post('/companies/:companyId/projects/external-workers/bulk-delete', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { workerIds, reason } = req.body;
    const result = await projectsRepository.bulkDeleteExternalWorkers(req.params.companyId, {
      workerIds,
      reason,
      actorId: (req as any).user?.uid || 'admin',
    });
    res.json({ result });
  } catch (error) {
    next(error);
  }
});

projectsRouter.get('/companies/:companyId/projects/external-workers', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const list = await projectsRepository.listExternalWorkers(req.params.companyId, {
      status: req.query.status as string,
      supplierId: req.query.supplierId ? Number(req.query.supplierId) : undefined,
    });
    res.json({ externalWorkers: list });
  } catch (error) {
    next(error);
  }
});

projectsRouter.post('/companies/:companyId/projects/external-workers', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const worker = await projectsRepository.createExternalWorker(req.params.companyId, req.body, (req as any).user?.uid || 'admin');
    res.status(201).json({ externalWorker: worker });
  } catch (error) {
    next(error);
  }
});

projectsRouter.get('/companies/:companyId/projects/external-workers/:id/preflight', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id) || id <= 0) throw new ValidationError('Invalid worker ID');
    const preflight = await projectsRepository.preflightDeleteExternalWorker(req.params.companyId, id);
    res.json({ preflight });
  } catch (error) {
    next(error);
  }
});

projectsRouter.get('/companies/:companyId/projects/external-workers/:id', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id) || id <= 0) throw new ValidationError('Invalid worker ID');
    const worker = await projectsRepository.getExternalWorker(req.params.companyId, id);
    if (!worker) throw new NotFoundError('Worker', req.params.id);
    res.json({ externalWorker: worker });
  } catch (error) {
    next(error);
  }
});

projectsRouter.put('/companies/:companyId/projects/external-workers/:id', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id) || id <= 0) throw new ValidationError('Invalid worker ID');
    const worker = await projectsRepository.updateExternalWorker(req.params.companyId, id, req.body, (req as any).user?.uid || 'admin');
    res.json({ externalWorker: worker });
  } catch (error) {
    next(error);
  }
});

projectsRouter.delete('/companies/:companyId/projects/external-workers/:id', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id) || id <= 0) throw new ValidationError('Invalid worker ID');
    const { reason } = req.body;
    const result = await projectsRepository.deleteExternalWorker(req.params.companyId, id, (req as any).user?.uid || 'admin', reason);
    res.json({ result });
  } catch (error) {
    next(error);
  }
});

// Workforce Deployments
projectsRouter.post('/companies/:companyId/projects/deployments/bulk', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await projectsRepository.bulkDeployWorkers(req.params.companyId, req.body, (req as any).user?.uid || 'admin');
    res.status(201).json({ result });
  } catch (error) {
    next(error);
  }
});

projectsRouter.get('/companies/:companyId/projects/deployments', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const list = await projectsRepository.listDeployments(req.params.companyId, {
      projectId: req.query.projectId ? Number(req.query.projectId) : undefined,
      workforceType: req.query.workforceType as string,
      status: req.query.status as string,
    });
    res.json({ deployments: list });
  } catch (error) {
    next(error);
  }
});

projectsRouter.post('/companies/:companyId/projects/deployments', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dep = await projectsRepository.createDeployment(req.params.companyId, req.body, (req as any).user?.uid || 'admin');
    res.status(201).json({ deployment: dep });
  } catch (error) {
    next(error);
  }
});

projectsRouter.post('/companies/:companyId/projects/deployments/:id/transfer', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id) || id <= 0) throw new ValidationError('Invalid deployment ID');
    const transferred = await projectsRepository.transferDeployment(req.params.companyId, id, req.body, (req as any).user?.uid || 'admin');
    res.json({ deployment: transferred });
  } catch (error) {
    next(error);
  }
});

projectsRouter.post('/companies/:companyId/projects/deployments/:id/end', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id) || id <= 0) throw new ValidationError('Invalid deployment ID');
    const ended = await projectsRepository.endDeployment(req.params.companyId, id, (req as any).user?.uid || 'admin', req.body.reason);
    res.json({ deployment: ended });
  } catch (error) {
    next(error);
  }
});

projectsRouter.delete('/companies/:companyId/projects/deployments/:id', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id) || id <= 0) throw new ValidationError('Invalid deployment ID');
    const result = await projectsRepository.deleteDeployment(req.params.companyId, id, (req as any).user?.uid || 'admin');
    res.json({ result });
  } catch (error) {
    next(error);
  }
});

// External Labour Settlements
projectsRouter.get('/companies/:companyId/projects/labour-settlements', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const list = await projectsRepository.listLabourSettlements(req.params.companyId, req.query.projectId ? Number(req.query.projectId) : undefined);
    res.json({ labourSettlements: list });
  } catch (error) {
    next(error);
  }
});

projectsRouter.post('/companies/:companyId/projects/labour-settlements', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const settlement = await projectsRepository.createLabourSettlement(req.params.companyId, req.body, (req as any).user?.uid || 'admin');
    res.status(201).json({ labourSettlement: settlement });
  } catch (error) {
    next(error);
  }
});

projectsRouter.post('/companies/:companyId/projects/labour-settlements/:id/approve', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id) || id <= 0) throw new ValidationError('Invalid settlement ID');
    const settlement = await projectsRepository.approveLabourSettlement(req.params.companyId, id, (req as any).user?.uid || 'admin');
    res.json({ labourSettlement: settlement });
  } catch (error) {
    next(error);
  }
});

projectsRouter.post('/companies/:companyId/projects/labour-settlements/:id/create-bill', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id) || id <= 0) throw new ValidationError('Invalid settlement ID');
    const result = await projectsRepository.createSupplierBillFromSettlement(
      req.params.companyId,
      id,
      req.body.branchId || 'main_branch',
      (req as any).user?.uid || 'admin'
    );
    res.status(201).json({ result });
  } catch (error) {
    next(error);
  }
});

// Projects Master
projectsRouter.post('/companies/:companyId/projects/bulk-delete/preflight', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectIds } = req.body;
    const preflight = await projectsRepository.preflightBulkDeleteProjects(req.params.companyId, projectIds);
    res.json({ preflight });
  } catch (error) {
    next(error);
  }
});

projectsRouter.post('/companies/:companyId/projects/bulk-delete', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectIds, reason } = req.body;
    const result = await projectsRepository.bulkDeleteProjects(req.params.companyId, {
      projectIds,
      reason,
      actorId: (req as any).user?.uid || 'admin',
    });
    res.json({ result });
  } catch (error) {
    next(error);
  }
});

projectsRouter.get('/companies/:companyId/projects', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const list = await projectsRepository.listProjects(req.params.companyId, {
      status: req.query.status as string,
      clientId: req.query.clientId ? Number(req.query.clientId) : undefined,
    });
    res.json({ projects: list });
  } catch (error) {
    next(error);
  }
});

projectsRouter.post('/companies/:companyId/projects', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const project = await projectsRepository.createProject(req.params.companyId, req.body, (req as any).user?.uid || 'admin');
    res.status(201).json({ project });
  } catch (error) {
    next(error);
  }
});

projectsRouter.get('/companies/:companyId/projects/:id/preflight', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id) || id <= 0) throw new ValidationError('Invalid project ID');
    const preflight = await projectsRepository.preflightDeleteProject(req.params.companyId, id);
    res.json({ preflight });
  } catch (error) {
    next(error);
  }
});

projectsRouter.get('/companies/:companyId/projects/:id', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id) || id <= 0) throw new ValidationError('Invalid project ID');
    const project = await projectsRepository.getProject(req.params.companyId, id);
    if (!project) throw new NotFoundError('Project', req.params.id);
    res.json({ project });
  } catch (error) {
    next(error);
  }
});

projectsRouter.put('/companies/:companyId/projects/:id', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id) || id <= 0) throw new ValidationError('Invalid project ID');
    const project = await projectsRepository.updateProject(req.params.companyId, id, req.body, (req as any).user?.uid || 'admin');
    res.json({ project });
  } catch (error) {
    next(error);
  }
});

projectsRouter.delete('/companies/:companyId/projects/:id', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id) || id <= 0) throw new ValidationError('Invalid project ID');
    const { reason } = req.body;
    const result = await projectsRepository.deleteProject(req.params.companyId, id, (req as any).user?.uid || 'admin', reason);
    res.json({ result });
  } catch (error) {
    next(error);
  }
});

// Project Sites Endpoints
projectsRouter.get('/companies/:companyId/projects/sites', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = req.query.projectId ? Number(req.query.projectId) : undefined;
    const sites = await projectsRepository.listProjectSites(req.params.companyId, projectId);
    res.json({ sites });
  } catch (error) {
    next(error);
  }
});

projectsRouter.post('/companies/:companyId/projects/sites', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId, siteCode, siteNameEn, siteNameAr, siteSupervisorEmployeeId, startDate, endDate, status } = req.body;
    if (!projectId || !siteCode) {
      throw new ValidationError('projectId and siteCode are required');
    }
    const site = await projectsRepository.createProjectSite(
      req.params.companyId,
      {
        projectId: Number(projectId),
        siteCode,
        siteNameEn,
        siteNameAr,
        siteSupervisorEmployeeId,
        startDate,
        endDate,
        status,
      },
      (req as any).user?.uid || 'admin'
    );
    res.status(201).json({ site });
  } catch (error) {
    next(error);
  }
});

projectsRouter.delete('/companies/:companyId/projects/sites/:id', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id) || id <= 0) throw new ValidationError('Invalid site ID');
    const result = await projectsRepository.deleteProjectSite(req.params.companyId, id, (req as any).user?.uid || 'admin');
    res.json(result);
  } catch (error) {
    next(error);
  }
});

