/**
 * GulfHive ERP - Leave Management Router
 * Handles leave types, leave policies, leave entitlements, leave applications, approvals, leave balances, and leave ledger transactions.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { leaveRepository } from '../infrastructure/database/repositories/leave.repository.ts';
import { ValidationError, NotFoundError } from '../core/errors/app-error.ts';
import { logger } from '../core/logging/logger.ts';

export const leaveRouter = Router();

// Leave Types
leaveRouter.get('/companies/:companyId/leave/types', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const types = await leaveRepository.listLeaveTypes(req.params.companyId);
    res.json({ leaveTypes: types });
  } catch (error) {
    next(error);
  }
});

leaveRouter.post('/companies/:companyId/leave/types', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code, nameEn, nameAr } = req.body;
    if (!code || !nameEn || !nameAr) {
      throw new ValidationError('code, nameEn, and nameAr are required.');
    }
    const type = await leaveRepository.createLeaveType(req.params.companyId, req.body);
    res.status(201).json({ leaveType: type });
  } catch (error) {
    next(error);
  }
});

// Leave Policies
leaveRouter.get('/companies/:companyId/leave/policies', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const policies = await leaveRepository.listLeavePolicies(req.params.companyId);
    res.json({ leavePolicies: policies });
  } catch (error) {
    next(error);
  }
});

leaveRouter.post('/companies/:companyId/leave/policies', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { leaveTypeId, nameEn, nameAr, effectiveFrom, annualEntitlement } = req.body;
    if (!leaveTypeId || !nameEn || !nameAr || !effectiveFrom || annualEntitlement === undefined) {
      throw new ValidationError('leaveTypeId, nameEn, nameAr, effectiveFrom, and annualEntitlement are required.');
    }
    const policy = await leaveRepository.createLeavePolicy(req.params.companyId, req.body);
    res.status(201).json({ leavePolicy: policy });
  } catch (error) {
    next(error);
  }
});

// Leave Applications / Requests
leaveRouter.get('/companies/:companyId/leave/requests', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filters = {
      employeeId: req.query.employeeId as string | undefined,
      status: req.query.status as string | undefined,
      leaveTypeId: req.query.leaveTypeId as string | undefined,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
    };
    const list = await leaveRepository.listLeaveRequests(req.params.companyId, filters);
    res.json({ leaveRequests: list });
  } catch (error) {
    next(error);
  }
});

leaveRouter.post('/companies/:companyId/leave/requests', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { employeeId, leaveTypeId, startDate, endDate, actorId } = req.body;
    if (!employeeId || !leaveTypeId || !startDate || !endDate) {
      throw new ValidationError('employeeId, leaveTypeId, startDate, and endDate are required.');
    }
    const request = await leaveRepository.submitLeaveRequest(req.params.companyId, {
      ...req.body,
      actorId: actorId || 'admin',
    });
    res.status(201).json({ leaveRequest: request });
  } catch (error) {
    next(error);
  }
});

leaveRouter.post('/companies/:companyId/leave/requests/:id/approve', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { approverId } = req.body;
    const request = await leaveRepository.reviewLeaveRequest(req.params.companyId, req.params.id, 'APPROVED', approverId || 'admin');
    res.json({ leaveRequest: request });
  } catch (error) {
    next(error);
  }
});

leaveRouter.post('/companies/:companyId/leave/requests/:id/reject', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { approverId, reason } = req.body;
    if (!reason) {
      throw new ValidationError('Rejection reason is required.');
    }
    const request = await leaveRepository.reviewLeaveRequest(req.params.companyId, req.params.id, 'REJECTED', approverId || 'admin', reason);
    res.json({ leaveRequest: request });
  } catch (error) {
    next(error);
  }
});

// Leave Balances
leaveRouter.get('/companies/:companyId/leave/balances/:employeeId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const asOfDate = req.query.asOfDate as string | undefined;
    const balances = await leaveRepository.getEmployeeLeaveBalances(req.params.companyId, req.params.employeeId, asOfDate);
    res.json({ balances });
  } catch (error) {
    next(error);
  }
});

// Manual Ledger Adjustment
leaveRouter.post('/companies/:companyId/leave/adjustments', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { employeeId, leaveTypeId, quantity, reason, effectiveDate, actorId } = req.body;
    if (!employeeId || !leaveTypeId || quantity === undefined || !reason || !effectiveDate) {
      throw new ValidationError('employeeId, leaveTypeId, quantity, reason, and effectiveDate are required.');
    }
    const transaction = await leaveRepository.adjustLeaveBalance(req.params.companyId, {
      employeeId,
      leaveTypeId,
      quantity,
      reason,
      effectiveDate,
      actorId: actorId || 'admin',
    });
    res.status(201).json({ transaction });
  } catch (error) {
    next(error);
  }
});
