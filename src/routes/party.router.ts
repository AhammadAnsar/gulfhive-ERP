/**
 * GulfHive ERP - Party Master Router
 * Unified Party Architecture: Parties, Roles (Client, Supplier, Contractor), Profiles, and Preflight Safeguards.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { partyRepository } from '../infrastructure/database/repositories/party.repository.ts';
import { authenticateToken, requireCompanyAccess } from '../core/security/auth.middleware.ts';
import { ValidationError, NotFoundError } from '../core/errors/app-error.ts';
import { logger } from '../core/logging/logger.ts';

export const partyRouter = Router();

partyRouter.get('/companies/:companyId/parties', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const role = req.query.role as any;
    const search = req.query.search as string;
    const list = await partyRepository.listParties(req.params.companyId, { role, search });
    res.json({ parties: list });
  } catch (error) {
    next(error);
  }
});

partyRouter.get('/companies/:companyId/parties/:id', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const party = await partyRepository.getParty(req.params.companyId, Number(req.params.id));
    if (!party) throw new NotFoundError('Party', req.params.id);
    res.json({ party });
  } catch (error) {
    next(error);
  }
});

partyRouter.post('/companies/:companyId/parties', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { legalNameEn, legalNameAr } = req.body;
    if (!legalNameEn || !legalNameAr) {
      throw new ValidationError('legalNameEn and legalNameAr are required.');
    }
    const actorId = (req as any).user?.uid || 'admin';
    const party = await partyRepository.createParty(req.params.companyId, req.body, actorId);
    res.status(201).json({ party });
  } catch (error) {
    next(error);
  }
});

partyRouter.put('/companies/:companyId/parties/:id', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const actorId = (req as any).user?.uid || 'admin';
    const party = await partyRepository.updateParty(req.params.companyId, Number(req.params.id), req.body, actorId);
    res.json({ party });
  } catch (error) {
    next(error);
  }
});

partyRouter.get('/companies/:companyId/parties/:id/preflight', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const preflight = await partyRepository.preflightDeleteParty(req.params.companyId, Number(req.params.id));
    res.json({ preflight });
  } catch (error) {
    next(error);
  }
});

partyRouter.delete('/companies/:companyId/parties/:id', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const actorId = (req as any).user?.uid || 'admin';
    const { reason } = req.body;
    const result = await partyRepository.deleteParty(req.params.companyId, Number(req.params.id), reason, actorId);
    res.json({ result });
  } catch (error) {
    next(error);
  }
});

partyRouter.post('/companies/:companyId/parties/bulk-delete', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { partyIds, action, reason } = req.body;
    const actorId = (req as any).user?.uid || 'admin';
    const result = await partyRepository.bulkDeleteParties(req.params.companyId, {
      partyIds: (partyIds || []).map(Number),
      action: action || 'DELETE',
      actorId,
      reason,
    });
    res.json({ result });
  } catch (error) {
    next(error);
  }
});
