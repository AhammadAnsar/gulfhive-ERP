/**
 * GulfHive ERP - Payroll & Compensation Router
 * Handles payroll runs, periods, salary components, structures, adjustments, loans, WPS export, payslips, and final settlements (EOSB).
 */

import { Router, Request, Response, NextFunction } from 'express';
import { payrollRepository } from '../infrastructure/database/repositories/payroll.repository.ts';
import { ValidationError, NotFoundError } from '../core/errors/app-error.ts';
import { logger } from '../core/logging/logger.ts';

export const payrollRouter = Router();

// List Payroll Runs
payrollRouter.get('/companies/:companyId/payroll/runs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const list = await payrollRepository.listPayrollRuns(req.params.companyId);
    res.json({ runs: list });
  } catch (error) {
    next(error);
  }
});

// Payroll Periods
payrollRouter.get('/companies/:companyId/payroll/periods', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const periods = await payrollRepository.listPayrollPeriods(req.params.companyId);
    res.json({ periods });
  } catch (error) {
    next(error);
  }
});

payrollRouter.post('/companies/:companyId/payroll/periods', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { year, month, periodStart, periodEnd, paymentDate, actorId } = req.body;
    if (!year || !month || !periodStart || !periodEnd) {
      throw new ValidationError('year, month, periodStart, and periodEnd are required.');
    }
    const period = await payrollRepository.createPayrollPeriod(req.params.companyId, {
      year: Number(year),
      month: Number(month),
      periodStart,
      periodEnd,
      paymentDate,
      actorId,
    });
    res.status(201).json({ period });
  } catch (error) {
    next(error);
  }
});

payrollRouter.put('/companies/:companyId/payroll/periods/:id/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, actorId } = req.body;
    if (!status) throw new ValidationError('status is required.');
    const period = await payrollRepository.updatePayrollPeriodStatus(req.params.companyId, req.params.id, status, actorId);
    res.json({ period });
  } catch (error) {
    next(error);
  }
});

// Configurable Salary Components
payrollRouter.get('/companies/:companyId/payroll/components', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const components = await payrollRepository.listSalaryComponents(req.params.companyId);
    res.json({ components });
  } catch (error) {
    next(error);
  }
});

payrollRouter.post('/companies/:companyId/payroll/components', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code, nameEn, nameAr, componentType, calculationType, formulaExpression, affectsGross, affectsNet, affectsOvertimeBase, affectsEosBase, displayOrder } = req.body;
    if (!code || !nameEn || !nameAr) {
      throw new ValidationError('code, nameEn, and nameAr are required.');
    }
    const component = await payrollRepository.createSalaryComponent(req.params.companyId, {
      code,
      nameEn,
      nameAr,
      componentType: componentType || 'EARNING',
      calculationType: calculationType || 'FIXED',
      formulaExpression,
      affectsGross,
      affectsNet,
      affectsOvertimeBase,
      affectsEosBase,
      displayOrder: displayOrder ? Number(displayOrder) : 0,
    });
    res.status(201).json({ component });
  } catch (error) {
    next(error);
  }
});

// Salary Structures
payrollRouter.get('/companies/:companyId/payroll/structures', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const structures = await payrollRepository.listSalaryStructures(req.params.companyId);
    res.json({ structures });
  } catch (error) {
    next(error);
  }
});

payrollRouter.post('/companies/:companyId/payroll/structures', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code, nameEn, nameAr, effectiveFrom, effectiveTo, components } = req.body;
    if (!code || !nameEn || !nameAr || !effectiveFrom) {
      throw new ValidationError('code, nameEn, nameAr, and effectiveFrom are required.');
    }
    const structure = await payrollRepository.createSalaryStructure(req.params.companyId, {
      code,
      nameEn,
      nameAr,
      effectiveFrom,
      effectiveTo,
      components: components || [],
    });
    res.status(201).json({ structure });
  } catch (error) {
    next(error);
  }
});

// Payroll Adjustments
payrollRouter.get('/companies/:companyId/payroll/adjustments', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const employeeId = req.query.employeeId as string | undefined;
    const periodId = req.query.periodId as string | undefined;
    const adjustments = await payrollRepository.listAdjustments(req.params.companyId, employeeId, periodId);
    res.json({ adjustments });
  } catch (error) {
    next(error);
  }
});

payrollRouter.post('/companies/:companyId/payroll/adjustments', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { employeeId, payrollPeriodId, type, amount, quantity, reason, effectiveDate, createdBy } = req.body;
    if (!employeeId || !type || !amount || !reason || !effectiveDate) {
      throw new ValidationError('employeeId, type, amount, reason, and effectiveDate are required.');
    }
    const adjustment = await payrollRepository.createAdjustment(req.params.companyId, {
      employeeId,
      payrollPeriodId,
      type,
      amount,
      quantity,
      reason,
      effectiveDate,
      createdBy,
    });
    res.status(201).json({ adjustment });
  } catch (error) {
    next(error);
  }
});

// Get Single Run with Items
payrollRouter.get('/companies/:companyId/payroll/runs/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const run = await payrollRepository.getPayrollRun(req.params.companyId, req.params.id);
    if (!run) throw new NotFoundError('Payroll run', req.params.id);
    res.json({ run });
  } catch (error) {
    next(error);
  }
});

// Calculate & Generate Payroll Run
payrollRouter.post('/companies/:companyId/payroll/calculate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { month, year, actorId } = req.body;
    if (!month || !year) {
      throw new ValidationError('month and year are required.');
    }
    const result = await payrollRepository.calculateAndCreatePayrollRun(
      req.params.companyId,
      Number(month),
      Number(year),
      actorId || 'admin'
    );
    res.status(201).json({ result });
  } catch (error) {
    next(error);
  }
});

// Validate Payroll Run
payrollRouter.post('/companies/:companyId/payroll/runs/:id/validate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validation = await payrollRepository.validatePayrollRun(req.params.companyId, req.params.id);
    res.json({ validation });
  } catch (error) {
    next(error);
  }
});

// Approve Payroll Run
payrollRouter.post('/companies/:companyId/payroll/runs/:id/approve', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { approverId } = req.body;
    const run = await payrollRepository.approvePayrollRun(req.params.companyId, req.params.id, approverId || 'admin');
    res.json({ run });
  } catch (error) {
    next(error);
  }
});

// Post Payroll Run
payrollRouter.post('/companies/:companyId/payroll/runs/:id/post', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { posterId } = req.body;
    const run = await payrollRepository.postPayrollRun(req.params.companyId, req.params.id, posterId || 'admin');
    res.json({ run });
  } catch (error) {
    next(error);
  }
});

// Controlled Reversal
payrollRouter.post('/companies/:companyId/payroll/runs/:id/reverse', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { actorId, reason } = req.body;
    if (!reason) {
      throw new ValidationError('Reversal reason is required.');
    }
    const run = await payrollRepository.reversePayrollRun(req.params.companyId, req.params.id, actorId || 'admin', reason);
    res.json({ run });
  } catch (error) {
    next(error);
  }
});

// Payslip PDF
payrollRouter.get('/companies/:companyId/payroll/runs/:id/payslips/:employeeId/pdf', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pdfBuffer = await payrollRepository.generatePayslipPdf(req.params.companyId, req.params.id, req.params.employeeId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Payslip_${req.params.id}_${req.params.employeeId}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
});

// Batch Payslips PDF
payrollRouter.get('/companies/:companyId/payroll/runs/:id/payslips/batch/pdf', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pdfBuffer = await payrollRepository.generateBatchPayslipsPdf(req.params.companyId, req.params.id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Batch_Payslips_${req.params.id}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
});

// Export WPS / SIF File
payrollRouter.get('/companies/:companyId/payroll/runs/:id/export/wps', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sifData = await payrollRepository.exportWpsSif(req.params.companyId, req.params.id);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="WPS_SIF_${req.params.id}.sif"`);
    res.send(sifData);
  } catch (error) {
    next(error);
  }
});

// Export Excel CSV
payrollRouter.get('/companies/:companyId/payroll/runs/:id/export/excel', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const csvData = await payrollRepository.exportExcelCsv(req.params.companyId, req.params.id);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="Payroll_Sheet_${req.params.id}.csv"`);
    res.send(csvData);
  } catch (error) {
    next(error);
  }
});

// Loans
payrollRouter.get('/companies/:companyId/loans', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const employeeId = req.query.employeeId as string | undefined;
    const list = await payrollRepository.listLoans(req.params.companyId, employeeId);
    res.json({ loans: list });
  } catch (error) {
    next(error);
  }
});

payrollRouter.post('/companies/:companyId/loans', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { employeeId, loanAmount, monthlyInstallment, currency, disbursementDate, notes } = req.body;
    if (!employeeId || !loanAmount || !monthlyInstallment || !disbursementDate) {
      throw new ValidationError('employeeId, loanAmount, monthlyInstallment, and disbursementDate are required.');
    }
    const loan = await payrollRepository.createLoan(req.params.companyId, {
      employeeId,
      loanAmount,
      monthlyInstallment,
      currency: currency || 'KWD',
      disbursementDate,
      notes,
    });
    res.status(201).json({ loan });
  } catch (error) {
    next(error);
  }
});

// Final Settlements
payrollRouter.get('/companies/:companyId/final-settlements', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const list = await payrollRepository.listFinalSettlements(req.params.companyId);
    res.json({ settlements: list });
  } catch (error) {
    next(error);
  }
});

payrollRouter.post('/companies/:companyId/final-settlements/calculate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { employeeId, contractType, terminationType, lastWorkingDate, accruedLeaveDays, unpaidSalaryDays, actorId } = req.body;
    if (!employeeId || !contractType || !terminationType || !lastWorkingDate) {
      throw new ValidationError('employeeId, contractType, terminationType, and lastWorkingDate are required.');
    }
    const settlement = await payrollRepository.calculateAndCreateFinalSettlement(req.params.companyId, {
      employeeId,
      contractType,
      terminationType,
      lastWorkingDate,
      accruedLeaveDays: Number(accruedLeaveDays) || 0,
      unpaidSalaryDays: Number(unpaidSalaryDays) || 0,
      actorId: actorId || 'admin',
    });
    res.status(201).json({ settlement });
  } catch (error) {
    next(error);
  }
});

payrollRouter.post('/companies/:companyId/final-settlements/:id/approve', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { approverId } = req.body;
    const settlement = await payrollRepository.approveFinalSettlement(req.params.companyId, req.params.id, approverId || 'admin');
    res.json({ settlement });
  } catch (error) {
    next(error);
  }
});
