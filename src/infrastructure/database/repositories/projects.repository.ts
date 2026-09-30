import { eq, and, sql, desc, inArray } from 'drizzle-orm';
import { db } from '../../../db/index.ts';
import {
  projects,
  projectContracts,
  projectSites,
  projectActivities,
  projectBudgets,
  billingProfiles,
  billingAuthorizations,
  externalWorkers,
  workforceSupplierAgreements,
  workforceRateCards,
  workforceDeployments,
  externalLabourSettlements,
  externalLabourSettlementLines,
  clients,
  suppliers,
  clientSites,
  employees,
  auditLogs,
  supplierBills,
  supplierBillLines,
  invoices
} from '../../../db/schema.ts';

export class ProjectsRepository {
  // ==========================================
  // 1. BILLING PROFILES & AUTHORIZATIONS
  // ==========================================

  public async listBillingProfiles(tenantId: string) {
    return db
      .select()
      .from(billingProfiles)
      .where(and(eq(billingProfiles.tenantId, tenantId), sql`${billingProfiles.deletedAt} IS NULL`))
      .orderBy(desc(billingProfiles.createdAt));
  }

  public async getBillingProfile(tenantId: string, id: number) {
    if (!id || isNaN(id) || id <= 0) return null;
    const [profile] = await db
      .select()
      .from(billingProfiles)
      .where(and(eq(billingProfiles.tenantId, tenantId), eq(billingProfiles.id, id), sql`${billingProfiles.deletedAt} IS NULL`))
      .limit(1);

    if (!profile) return null;

    const authorizations = await db
      .select()
      .from(billingAuthorizations)
      .where(and(eq(billingAuthorizations.tenantId, tenantId), eq(billingAuthorizations.billingProfileId, id)))
      .orderBy(desc(billingAuthorizations.createdAt));

    return { ...profile, authorizations };
  }

  public async createBillingProfile(
    tenantId: string,
    input: {
      profileCode: string;
      profileName: string;
      isOperatingCompany?: boolean;
      principalSupplierId?: number;
      principalClientId?: number;
      legalNameEn: string;
      legalNameAr: string;
      tradeNameEn?: string;
      tradeNameAr?: string;
      crNumber?: string;
      licenseNumber?: string;
      vatNumber?: string;
      phone?: string;
      email?: string;
      addressEn?: string;
      addressAr?: string;
      bankName?: string;
      iban?: string;
      swiftCode?: string;
      signatoryName?: string;
      signatoryTitle?: string;
      effectiveFrom: string;
      effectiveTo?: string;
    },
    actorId = 'system'
  ) {
    const code = input.profileCode.toUpperCase().trim();

    const [created] = await db
      .insert(billingProfiles)
      .values({
        tenantId,
        profileCode: code,
        profileName: input.profileName.trim(),
        isOperatingCompany: input.isOperatingCompany ?? false,
        principalSupplierId: input.principalSupplierId || null,
        principalClientId: input.principalClientId || null,
        legalNameEn: input.legalNameEn.trim(),
        legalNameAr: input.legalNameAr.trim(),
        tradeNameEn: input.tradeNameEn?.trim() || null,
        tradeNameAr: input.tradeNameAr?.trim() || null,
        crNumber: input.crNumber?.trim() || null,
        licenseNumber: input.licenseNumber?.trim() || null,
        vatNumber: input.vatNumber?.trim() || null,
        phone: input.phone?.trim() || null,
        email: input.email?.trim() || null,
        addressEn: input.addressEn?.trim() || null,
        addressAr: input.addressAr?.trim() || null,
        bankName: input.bankName?.trim() || null,
        iban: input.iban?.trim() || null,
        swiftCode: input.swiftCode?.trim() || null,
        signatoryName: input.signatoryName?.trim() || null,
        signatoryTitle: input.signatoryTitle?.trim() || null,
        status: 'ACTIVE',
        effectiveFrom: input.effectiveFrom,
        effectiveTo: input.effectiveTo || null,
        createdBy: actorId,
        updatedBy: actorId,
      })
      .returning();

    await db.insert(auditLogs).values({
      tenantId,
      actorId,
      action: 'CREATE',
      entityType: 'BILLING_PROFILE',
      entityId: String(created.id),
      previousState: null,
      resultingState: created,
    });

    return created;
  }

  public async updateBillingProfile(
    tenantId: string,
    id: number,
    input: Partial<{
      profileName: string;
      legalNameEn: string;
      legalNameAr: string;
      tradeNameEn: string;
      tradeNameAr: string;
      crNumber: string;
      licenseNumber: string;
      vatNumber: string;
      phone: string;
      email: string;
      addressEn: string;
      addressAr: string;
      bankName: string;
      iban: string;
      swiftCode: string;
      signatoryName: string;
      signatoryTitle: string;
      effectiveFrom: string;
      effectiveTo: string;
      status: string;
    }>,
    actorId = 'system'
  ) {
    const existing = await this.getBillingProfile(tenantId, id);
    if (!existing) throw new Error('Billing Profile not found');

    const [updated] = await db
      .update(billingProfiles)
      .set({
        ...input,
        updatedAt: new Date(),
        updatedBy: actorId,
      })
      .where(and(eq(billingProfiles.tenantId, tenantId), eq(billingProfiles.id, id)))
      .returning();

    await db.insert(auditLogs).values({
      tenantId,
      actorId,
      action: 'UPDATE',
      entityType: 'BILLING_PROFILE',
      entityId: String(id),
      previousState: existing,
      resultingState: updated,
    });

    return updated;
  }

  public async createBillingAuthorization(
    tenantId: string,
    input: {
      billingProfileId: number;
      authorizationReference: string;
      effectiveFrom: string;
      effectiveTo: string;
      documentReference?: string;
      notes?: string;
    },
    actorId = 'system'
  ) {
    const [created] = await db
      .insert(billingAuthorizations)
      .values({
        tenantId,
        billingProfileId: input.billingProfileId,
        authorizationReference: input.authorizationReference.trim(),
        effectiveFrom: input.effectiveFrom,
        effectiveTo: input.effectiveTo,
        documentReference: input.documentReference?.trim() || null,
        notes: input.notes?.trim() || null,
        status: 'APPROVED',
        approvedBy: actorId,
        approvedAt: new Date(),
        createdBy: actorId,
        updatedBy: actorId,
      })
      .returning();

    await db.insert(auditLogs).values({
      tenantId,
      actorId,
      action: 'APPROVE',
      entityType: 'BILLING_AUTHORIZATION',
      entityId: String(created.id),
      previousState: null,
      resultingState: created,
    });

    return created;
  }

  // ==========================================
  // 2. PROJECTS CRUD & RELATIONSHIPS
  // ==========================================

  public async listProjects(tenantId: string, filters?: { status?: string; clientId?: number }) {
    const conditions = [eq(projects.tenantId, tenantId), sql`${projects.deletedAt} IS NULL`];
    if (filters?.status && filters.status !== 'ALL') {
      conditions.push(eq(projects.status, filters.status));
    }
    if (filters?.clientId && !isNaN(Number(filters.clientId)) && Number(filters.clientId) > 0) {
      conditions.push(eq(projects.clientId, Number(filters.clientId)));
    }

    const rows = await db
      .select({
        project: projects,
        client: clients,
        principalSupplier: suppliers,
        billingProfile: billingProfiles,
      })
      .from(projects)
      .innerJoin(clients, eq(projects.clientId, clients.id))
      .leftJoin(suppliers, eq(projects.principalSupplierId, suppliers.id))
      .innerJoin(billingProfiles, eq(projects.billingProfileId, billingProfiles.id))
      .where(and(...conditions))
      .orderBy(desc(projects.createdAt));

    return rows.map((r) => ({
      ...r.project,
      client: r.client,
      principalSupplier: r.principalSupplier,
      billingProfile: r.billingProfile,
    }));
  }

  public async getProject(tenantId: string, id: number) {
    const numId = Number(id);
    if (!numId || isNaN(numId) || numId <= 0) return null;
    const [row] = await db
      .select({
        project: projects,
        client: clients,
        principalSupplier: suppliers,
        billingProfile: billingProfiles,
      })
      .from(projects)
      .innerJoin(clients, eq(projects.clientId, clients.id))
      .leftJoin(suppliers, eq(projects.principalSupplierId, suppliers.id))
      .innerJoin(billingProfiles, eq(projects.billingProfileId, billingProfiles.id))
      .where(and(eq(projects.tenantId, tenantId), eq(projects.id, numId), sql`${projects.deletedAt} IS NULL`))
      .limit(1);

    if (!row) return null;

    const contracts = await db
      .select()
      .from(projectContracts)
      .where(and(eq(projectContracts.tenantId, tenantId), eq(projectContracts.projectId, id)))
      .orderBy(desc(projectContracts.createdAt));

    const sites = await db
      .select({
        projectSite: projectSites,
        clientSite: clientSites,
      })
      .from(projectSites)
      .innerJoin(clientSites, eq(projectSites.clientSiteId, clientSites.id))
      .where(and(eq(projectSites.tenantId, tenantId), eq(projectSites.projectId, id)));

    const deployments = await db
      .select()
      .from(workforceDeployments)
      .where(and(eq(workforceDeployments.tenantId, tenantId), eq(workforceDeployments.projectId, id), sql`${workforceDeployments.deletedAt} IS NULL`));

    return {
      ...row.project,
      client: row.client,
      principalSupplier: row.principalSupplier,
      billingProfile: row.billingProfile,
      contracts,
      sites: sites.map((s) => ({ ...s.projectSite, siteDetails: s.clientSite })),
      deploymentsCount: deployments.length,
    };
  }

  public async createProject(
    tenantId: string,
    input: {
      projectCode: string;
      nameEn: string;
      nameAr: string;
      projectType?: string;
      clientId: number;
      principalSupplierId?: number;
      billingProfileId: number;
      contractReference?: string;
      principalReference?: string;
      primarySiteId?: number;
      branchId?: string;
      currency?: string;
      contractValue?: string;
      billingMethod?: string;
      startDate: string;
      plannedEndDate?: string;
      projectManagerEmployeeId?: string;
      description?: string;
    },
    actorId = 'system'
  ) {
    const code = input.projectCode.toUpperCase().trim();

    // Cross-company relational check
    if (input.clientId) {
      const [cCheck] = await db.select().from(clients).where(and(eq(clients.id, input.clientId), eq(clients.tenantId, tenantId))).limit(1);
      if (!cCheck) {
        throw new Error('Cross-company reference violation: Client does not belong to the active company.');
      }
    }

    // Verify unique project code
    const existing = await db
      .select()
      .from(projects)
      .where(and(eq(projects.tenantId, tenantId), eq(projects.projectCode, code), sql`${projects.deletedAt} IS NULL`))
      .limit(1);

    if (existing.length > 0) {
      throw new Error(`Project code '${code}' already exists.`);
    }

    // Look up party IDs for Client and Principal Supplier
    let clientPartyId: number | null = null;
    let principalPartyId: number | null = null;

    if (input.clientId) {
      const [c] = await db.select({ partyId: clients.partyId }).from(clients).where(eq(clients.id, input.clientId)).limit(1);
      if (c?.partyId) clientPartyId = c.partyId;
    }

    if (input.principalSupplierId) {
      const [s] = await db.select({ partyId: suppliers.partyId }).from(suppliers).where(eq(suppliers.id, input.principalSupplierId)).limit(1);
      if (s?.partyId) principalPartyId = s.partyId;
    }

    const [created] = await db
      .insert(projects)
      .values({
        tenantId,
        projectCode: code,
        nameEn: input.nameEn.trim(),
        nameAr: input.nameAr.trim(),
        projectType: input.projectType || 'General Contract',
        clientId: input.clientId,
        principalSupplierId: input.principalSupplierId || null,
        principalPartyId,
        clientPartyId,
        billingProfileId: input.billingProfileId,
        contractReference: input.contractReference?.trim() || null,
        principalReference: input.principalReference?.trim() || null,
        primarySiteId: input.primarySiteId || null,
        branchId: input.branchId || null,
        currency: input.currency || 'KWD',
        contractValue: input.contractValue || '0.000',
        billingMethod: input.billingMethod || 'FIXED_CONTRACT',
        startDate: input.startDate,
        plannedEndDate: input.plannedEndDate || null,
        projectManagerEmployeeId: input.projectManagerEmployeeId || null,
        status: 'ACTIVE',
        description: input.description?.trim() || null,
        createdBy: actorId,
        updatedBy: actorId,
      })
      .returning();

    // If primary site is specified, also add as project site
    if (input.primarySiteId) {
      await db.insert(projectSites).values({
        tenantId,
        projectId: created.id,
        clientSiteId: input.primarySiteId,
        siteCode: 'SITE-MAIN',
        status: 'ACTIVE',
        createdBy: actorId,
        updatedBy: actorId,
      });
    }

    // Automatically create initial contract if contract value > 0
    if (input.contractReference || parseFloat(input.contractValue || '0') > 0) {
      await db.insert(projectContracts).values({
        tenantId,
        projectId: created.id,
        contractNumber: input.contractReference || `CTR-${code}`,
        contractType: input.projectType || 'Direct Contract',
        clientId: input.clientId,
        principalSupplierId: input.principalSupplierId || null,
        contractDate: input.startDate,
        effectiveFrom: input.startDate,
        effectiveTo: input.plannedEndDate || null,
        contractValue: input.contractValue || '0.000',
        currency: input.currency || 'KWD',
        billingMethod: input.billingMethod || 'FIXED_CONTRACT',
        status: 'ACTIVE',
        version: 1,
        createdBy: actorId,
        updatedBy: actorId,
      });
    }

    await db.insert(auditLogs).values({
      tenantId,
      actorId,
      action: 'CREATE',
      entityType: 'PROJECT',
      entityId: String(created.id),
      previousState: null,
      resultingState: created,
    });

    return created;
  }

  public async updateProject(
    tenantId: string,
    id: number,
    input: Partial<{
      nameEn: string;
      nameAr: string;
      projectType: string;
      clientId: number;
      principalSupplierId: number | null;
      billingProfileId: number;
      contractReference: string;
      principalReference: string;
      primarySiteId: number | null;
      currency: string;
      contractValue: string;
      billingMethod: string;
      startDate: string;
      plannedEndDate: string;
      actualEndDate: string;
      projectManagerEmployeeId: string | null;
      status: string;
      description: string;
    }>,
    actorId = 'system'
  ) {
    const existing = await this.getProject(tenantId, id);
    if (!existing) throw new Error('Project not found');

    const [updated] = await db
      .update(projects)
      .set({
        ...input,
        updatedAt: new Date(),
        updatedBy: actorId,
      })
      .where(and(eq(projects.tenantId, tenantId), eq(projects.id, id)))
      .returning();

    await db.insert(auditLogs).values({
      tenantId,
      actorId,
      action: 'UPDATE',
      entityType: 'PROJECT',
      entityId: String(id),
      previousState: existing,
      resultingState: updated,
    });

    return updated;
  }

  public async preflightDeleteProject(tenantId: string, id: number) {
    const project = await this.getProject(tenantId, id);
    if (!project) throw new Error('Project not found');

    const deployments = await db
      .select()
      .from(workforceDeployments)
      .where(and(eq(workforceDeployments.tenantId, tenantId), eq(workforceDeployments.projectId, id), sql`${workforceDeployments.deletedAt} IS NULL`));

    const settlements = await db
      .select()
      .from(externalLabourSettlements)
      .where(and(eq(externalLabourSettlements.tenantId, tenantId), eq(externalLabourSettlements.projectId, id)));

    const hasHistory = deployments.length > 0 || settlements.length > 0;

    return {
      projectId: id,
      projectCode: project.projectCode,
      nameEn: project.nameEn,
      nameAr: project.nameAr,
      action: hasHistory ? 'SOFT_DELETE' : 'HARD_DELETE',
      isEligibleForHardDelete: !hasHistory,
      dependentRecords: {
        deployments: deployments.length,
        settlements: settlements.length,
      },
    };
  }

  public async deleteProject(tenantId: string, id: number, actorId = 'system', reason?: string) {
    const preflight = await this.preflightDeleteProject(tenantId, id);
    const existing = await this.getProject(tenantId, id);

    if (preflight.action === 'SOFT_DELETE') {
      await db
        .update(projects)
        .set({
          status: 'CLOSED',
          deletedAt: new Date(),
          deletedBy: actorId,
          deleteReason: reason || 'Soft archived due to historical deployments',
        })
        .where(and(eq(projects.tenantId, tenantId), eq(projects.id, id)));

      await db.insert(auditLogs).values({
        tenantId,
        actorId,
        action: 'ARCHIVE',
        entityType: 'PROJECT',
        entityId: String(id),
        previousState: existing,
        resultingState: { status: 'CLOSED', deletedAt: new Date() },
      });

      return { success: true, action: 'SOFT_DELETE' };
    } else {
      await db
        .delete(projects)
        .where(and(eq(projects.tenantId, tenantId), eq(projects.id, id)));

      await db.insert(auditLogs).values({
        tenantId,
        actorId,
        action: 'DELETE',
        entityType: 'PROJECT',
        entityId: String(id),
        previousState: existing,
        resultingState: null,
      });

      return { success: true, action: 'HARD_DELETE' };
    }
  }

  public async preflightBulkDeleteProjects(tenantId: string, projectIds: number[]) {
    const results = await Promise.all(projectIds.map((id) => this.preflightDeleteProject(tenantId, id)));
    const hardDeleteCount = results.filter((r) => r.action === 'HARD_DELETE').length;
    const softDeleteCount = results.filter((r) => r.action === 'SOFT_DELETE').length;
    return { projectIds, hardDeleteCount, softDeleteCount, details: results };
  }

  public async bulkDeleteProjects(tenantId: string, input: { projectIds: number[]; reason?: string; actorId?: string }) {
    const actorId = input.actorId || 'system';
    const results = [];
    for (const id of input.projectIds) {
      results.push(await this.deleteProject(tenantId, id, actorId, input.reason));
    }
    return { processed: results.length, results };
  }

  // ==========================================
  // 3. EXTERNAL WORKERS (MANPOWER SUPPLIERS)
  // ==========================================

  public async listExternalWorkers(tenantId: string, filters?: { status?: string; supplierId?: number }) {
    const conditions = [eq(externalWorkers.tenantId, tenantId), sql`${externalWorkers.deletedAt} IS NULL`];
    if (filters?.status && filters.status !== 'ALL') {
      conditions.push(eq(externalWorkers.status, filters.status));
    }
    if (filters?.supplierId && !isNaN(Number(filters.supplierId)) && Number(filters.supplierId) > 0) {
      conditions.push(eq(externalWorkers.sourceSupplierId, Number(filters.supplierId)));
    }

    const rows = await db
      .select({
        worker: externalWorkers,
        supplier: suppliers,
      })
      .from(externalWorkers)
      .innerJoin(suppliers, eq(externalWorkers.sourceSupplierId, suppliers.id))
      .where(and(...conditions))
      .orderBy(desc(externalWorkers.createdAt));

    return rows.map((r) => ({
      ...r.worker,
      supplier: r.supplier,
    }));
  }

  public async getExternalWorker(tenantId: string, id: number) {
    const numId = Number(id);
    if (!numId || isNaN(numId) || numId <= 0) return null;
    const [row] = await db
      .select({
        worker: externalWorkers,
        supplier: suppliers,
      })
      .from(externalWorkers)
      .innerJoin(suppliers, eq(externalWorkers.sourceSupplierId, suppliers.id))
      .where(and(eq(externalWorkers.tenantId, tenantId), eq(externalWorkers.id, numId), sql`${externalWorkers.deletedAt} IS NULL`))
      .limit(1);

    if (!row) return null;

    const deployments = await db
      .select({
        deployment: workforceDeployments,
        project: projects,
      })
      .from(workforceDeployments)
      .innerJoin(projects, eq(workforceDeployments.projectId, projects.id))
      .where(and(eq(workforceDeployments.tenantId, tenantId), eq(workforceDeployments.externalWorkerId, id), sql`${workforceDeployments.deletedAt} IS NULL`))
      .orderBy(desc(workforceDeployments.startDate));

    return {
      ...row.worker,
      supplier: row.supplier,
      deployments: deployments.map((d) => ({ ...d.deployment, project: d.project })),
    };
  }

  public async createExternalWorker(
    tenantId: string,
    input: {
      workerCode: string;
      sourceSupplierId: number;
      nameEn: string;
      nameAr?: string;
      nationalityId?: number;
      profession: string;
      phone?: string;
      identityDocumentType?: string;
      identityDocumentNumber?: string;
      defaultRate?: string;
      rateType?: string;
      currency?: string;
      availableFrom?: string;
      availableTo?: string;
    },
    actorId = 'system'
  ) {
    const code = input.workerCode.toUpperCase().trim();

    let sourcePartyId: number | null = null;
    if (input.sourceSupplierId) {
      const [s] = await db.select({ partyId: suppliers.partyId }).from(suppliers).where(eq(suppliers.id, input.sourceSupplierId)).limit(1);
      if (s?.partyId) sourcePartyId = s.partyId;
    }

    const [created] = await db
      .insert(externalWorkers)
      .values({
        tenantId,
        workerCode: code,
        sourceSupplierId: input.sourceSupplierId,
        sourcePartyId,
        nameEn: input.nameEn.trim(),
        nameAr: input.nameAr?.trim() || null,
        nationalityId: input.nationalityId || null,
        profession: input.profession.trim(),
        phone: input.phone?.trim() || null,
        identityDocumentType: input.identityDocumentType || 'Civil ID',
        identityDocumentNumber: input.identityDocumentNumber?.trim() || null,
        defaultRate: input.defaultRate || '0.000',
        rateType: input.rateType || 'HOURLY',
        currency: input.currency || 'KWD',
        availableFrom: input.availableFrom || null,
        availableTo: input.availableTo || null,
        status: 'ACTIVE',
        createdBy: actorId,
        updatedBy: actorId,
      })
      .returning();

    await db.insert(auditLogs).values({
      tenantId,
      actorId,
      action: 'CREATE',
      entityType: 'EXTERNAL_WORKER',
      entityId: String(created.id),
      previousState: null,
      resultingState: created,
    });

    return created;
  }

  public async updateExternalWorker(
    tenantId: string,
    id: number,
    input: Partial<{
      nameEn: string;
      nameAr: string;
      profession: string;
      phone: string;
      identityDocumentType: string;
      identityDocumentNumber: string;
      defaultRate: string;
      rateType: string;
      currency: string;
      status: string;
      availableFrom: string;
      availableTo: string;
    }>,
    actorId = 'system'
  ) {
    const existing = await this.getExternalWorker(tenantId, id);
    if (!existing) throw new Error('External Worker not found');

    const [updated] = await db
      .update(externalWorkers)
      .set({
        ...input,
        updatedAt: new Date(),
        updatedBy: actorId,
      })
      .where(and(eq(externalWorkers.tenantId, tenantId), eq(externalWorkers.id, id)))
      .returning();

    await db.insert(auditLogs).values({
      tenantId,
      actorId,
      action: 'UPDATE',
      entityType: 'EXTERNAL_WORKER',
      entityId: String(id),
      previousState: existing,
      resultingState: updated,
    });

    return updated;
  }

  public async preflightDeleteExternalWorker(tenantId: string, id: number) {
    const worker = await this.getExternalWorker(tenantId, id);
    if (!worker) throw new Error('Worker not found');

    const deployments = await db
      .select()
      .from(workforceDeployments)
      .where(and(eq(workforceDeployments.tenantId, tenantId), eq(workforceDeployments.externalWorkerId, id), sql`${workforceDeployments.deletedAt} IS NULL`));

    const settlements = await db
      .select()
      .from(externalLabourSettlementLines)
      .where(and(eq(externalLabourSettlementLines.tenantId, tenantId), eq(externalLabourSettlementLines.externalWorkerId, id)));

    const hasHistory = deployments.length > 0 || settlements.length > 0;

    return {
      workerId: id,
      workerCode: worker.workerCode,
      nameEn: worker.nameEn,
      action: hasHistory ? 'SOFT_DELETE' : 'HARD_DELETE',
      isEligibleForHardDelete: !hasHistory,
      dependentRecords: {
        deployments: deployments.length,
        settlements: settlements.length,
      },
    };
  }

  public async deleteExternalWorker(tenantId: string, id: number, actorId = 'system', reason?: string) {
    const preflight = await this.preflightDeleteExternalWorker(tenantId, id);
    const existing = await this.getExternalWorker(tenantId, id);

    if (preflight.action === 'SOFT_DELETE') {
      await db
        .update(externalWorkers)
        .set({
          status: 'INACTIVE',
          deletedAt: new Date(),
          deletedBy: actorId,
          deleteReason: reason || 'Soft archived due to historical project assignment',
        })
        .where(and(eq(externalWorkers.tenantId, tenantId), eq(externalWorkers.id, id)));

      return { success: true, action: 'SOFT_DELETE' };
    } else {
      await db
        .delete(externalWorkers)
        .where(and(eq(externalWorkers.tenantId, tenantId), eq(externalWorkers.id, id)));

      return { success: true, action: 'HARD_DELETE' };
    }
  }

  public async preflightBulkDeleteExternalWorkers(tenantId: string, workerIds: number[]) {
    const results = await Promise.all(workerIds.map((id) => this.preflightDeleteExternalWorker(tenantId, id)));
    return {
      workerIds,
      hardDeleteCount: results.filter((r) => r.action === 'HARD_DELETE').length,
      softDeleteCount: results.filter((r) => r.action === 'SOFT_DELETE').length,
      details: results,
    };
  }

  public async bulkDeleteExternalWorkers(tenantId: string, input: { workerIds: number[]; reason?: string; actorId?: string }) {
    const actorId = input.actorId || 'system';
    const results = [];
    for (const id of input.workerIds) {
      results.push(await this.deleteExternalWorker(tenantId, id, actorId, input.reason));
    }
    return { processed: results.length, results };
  }

  // ==========================================
  // 4. WORKFORCE DEPLOYMENTS (INTERNAL & EXTERNAL)
  // ==========================================

  public async listDeployments(tenantId: string, filters?: { projectId?: number; workforceType?: string; status?: string }) {
    const conditions = [eq(workforceDeployments.tenantId, tenantId), sql`${workforceDeployments.deletedAt} IS NULL`];
    if (filters?.projectId && !isNaN(Number(filters.projectId)) && Number(filters.projectId) > 0) {
      conditions.push(eq(workforceDeployments.projectId, Number(filters.projectId)));
    }
    if (filters?.workforceType) {
      conditions.push(eq(workforceDeployments.workforceType, filters.workforceType));
    }
    if (filters?.status && filters.status !== 'ALL') {
      conditions.push(eq(workforceDeployments.status, filters.status));
    }

    const rows = await db
      .select({
        deployment: workforceDeployments,
        project: projects,
        employee: employees,
        externalWorker: externalWorkers,
      })
      .from(workforceDeployments)
      .innerJoin(projects, eq(workforceDeployments.projectId, projects.id))
      .leftJoin(employees, eq(workforceDeployments.employeeId, employees.id))
      .leftJoin(externalWorkers, eq(workforceDeployments.externalWorkerId, externalWorkers.id))
      .where(and(...conditions))
      .orderBy(desc(workforceDeployments.startDate));

    return rows.map((r) => ({
      ...r.deployment,
      project: r.project,
      employee: r.employee,
      externalWorker: r.externalWorker,
      workerName: r.deployment.workforceType === 'INTERNAL_EMPLOYEE'
        ? `${r.employee?.firstNameEn || ''} ${r.employee?.lastNameEn || ''}`
        : r.externalWorker?.nameEn || 'External Worker',
      workerCode: r.deployment.workforceType === 'INTERNAL_EMPLOYEE'
        ? r.employee?.employeeNumber || r.deployment.employeeId
        : r.externalWorker?.workerCode,
    }));
  }

  public async createDeployment(
    tenantId: string,
    input: {
      projectId: number;
      projectSiteId?: number;
      workforceType: 'INTERNAL_EMPLOYEE' | 'EXTERNAL_WORKER';
      employeeId?: string;
      externalWorkerId?: number;
      position?: string;
      shiftId?: string;
      startDate: string;
      endDate?: string;
      deploymentType?: string;
      rateOverride?: string;
      rateType?: string;
      currency?: string;
    },
    actorId = 'system'
  ) {
    if (input.workforceType === 'INTERNAL_EMPLOYEE' && !input.employeeId) {
      throw new Error('Employee ID is required for internal employee deployment.');
    }
    if (input.workforceType === 'EXTERNAL_WORKER' && !input.externalWorkerId) {
      throw new Error('External Worker ID is required for external worker deployment.');
    }

    // Cross-company relational checks
    const [pCheck] = await db.select().from(projects).where(and(eq(projects.id, input.projectId), eq(projects.tenantId, tenantId))).limit(1);
    if (!pCheck) {
      throw new Error('Cross-company reference violation: Project does not belong to the active company.');
    }

    if (input.workforceType === 'EXTERNAL_WORKER' && input.externalWorkerId) {
      const [wCheck] = await db.select().from(externalWorkers).where(and(eq(externalWorkers.id, input.externalWorkerId), eq(externalWorkers.tenantId, tenantId))).limit(1);
      if (!wCheck) {
        throw new Error('Cross-company reference violation: External worker does not belong to the active company.');
      }
    }

    const [created] = await db
      .insert(workforceDeployments)
      .values({
        tenantId,
        projectId: input.projectId,
        projectSiteId: input.projectSiteId || null,
        workforceType: input.workforceType,
        employeeId: input.workforceType === 'INTERNAL_EMPLOYEE' ? input.employeeId : null,
        externalWorkerId: input.workforceType === 'EXTERNAL_WORKER' ? input.externalWorkerId : null,
        position: input.position?.trim() || 'General Crew',
        shiftId: input.shiftId || null,
        startDate: input.startDate,
        endDate: input.endDate || null,
        deploymentType: input.deploymentType || 'REGULAR',
        rateOverride: input.rateOverride || null,
        rateType: input.rateType || 'HOURLY',
        currency: input.currency || 'KWD',
        status: 'ACTIVE',
        assignedBy: actorId,
        createdBy: actorId,
        updatedBy: actorId,
      })
      .returning();

    await db.insert(auditLogs).values({
      tenantId,
      actorId,
      action: 'CREATE',
      entityType: 'WORKFORCE_DEPLOYMENT',
      entityId: String(created.id),
      previousState: null,
      resultingState: created,
    });

    return created;
  }

  public async bulkDeployWorkers(
    tenantId: string,
    input: {
      projectId: number;
      projectSiteId?: number;
      workforceType: 'INTERNAL_EMPLOYEE' | 'EXTERNAL_WORKER';
      workerIds: (string | number)[];
      position?: string;
      shiftId?: string;
      startDate: string;
      endDate?: string;
      deploymentType?: string;
    },
    actorId = 'system'
  ) {
    const createdList = [];
    for (const id of input.workerIds) {
      const dep = await this.createDeployment(
        tenantId,
        {
          projectId: input.projectId,
          projectSiteId: input.projectSiteId,
          workforceType: input.workforceType,
          employeeId: input.workforceType === 'INTERNAL_EMPLOYEE' ? String(id) : undefined,
          externalWorkerId: input.workforceType === 'EXTERNAL_WORKER' ? Number(id) : undefined,
          position: input.position,
          shiftId: input.shiftId,
          startDate: input.startDate,
          endDate: input.endDate,
          deploymentType: input.deploymentType,
        },
        actorId
      );
      createdList.push(dep);
    }
    return { deployedCount: createdList.length, deployments: createdList };
  }

  public async transferDeployment(
    tenantId: string,
    deploymentId: number,
    input: {
      targetProjectId: number;
      targetSiteId?: number;
      transferDate: string;
      position?: string;
    },
    actorId = 'system'
  ) {
    // 1. Fetch current deployment
    const [current] = await db
      .select()
      .from(workforceDeployments)
      .where(and(eq(workforceDeployments.tenantId, tenantId), eq(workforceDeployments.id, deploymentId)))
      .limit(1);

    if (!current) throw new Error('Deployment record not found');

    // 2. End current deployment
    await db
      .update(workforceDeployments)
      .set({
        endDate: input.transferDate,
        status: 'TRANSFERRED',
        updatedAt: new Date(),
        updatedBy: actorId,
      })
      .where(and(eq(workforceDeployments.tenantId, tenantId), eq(workforceDeployments.id, deploymentId)));

    // 3. Create new deployment atomically
    const [newDep] = await db
      .insert(workforceDeployments)
      .values({
        tenantId,
        projectId: input.targetProjectId,
        projectSiteId: input.targetSiteId || null,
        workforceType: current.workforceType,
        employeeId: current.employeeId,
        externalWorkerId: current.externalWorkerId,
        position: input.position || current.position,
        shiftId: current.shiftId,
        startDate: input.transferDate,
        deploymentType: current.deploymentType,
        rateOverride: current.rateOverride,
        rateType: current.rateType,
        currency: current.currency,
        status: 'ACTIVE',
        assignedBy: actorId,
        createdBy: actorId,
        updatedBy: actorId,
      })
      .returning();

    await db.insert(auditLogs).values({
      tenantId,
      actorId,
      action: 'TRANSFER',
      entityType: 'WORKFORCE_DEPLOYMENT',
      entityId: String(deploymentId),
      previousState: current,
      resultingState: newDep,
    });

    return newDep;
  }

  public async endDeployment(tenantId: string, deploymentId: number, actorId = 'system', reason?: string) {
    const [updated] = await db
      .update(workforceDeployments)
      .set({
        endDate: new Date().toISOString().slice(0, 10),
        status: 'COMPLETED',
        updatedAt: new Date(),
        updatedBy: actorId,
        deleteReason: reason || 'Mobilization period completed',
      })
      .where(and(eq(workforceDeployments.tenantId, tenantId), eq(workforceDeployments.id, deploymentId)))
      .returning();

    return updated;
  }

  public async deleteDeployment(tenantId: string, deploymentId: number, actorId = 'system') {
    await db
      .delete(workforceDeployments)
      .where(and(eq(workforceDeployments.tenantId, tenantId), eq(workforceDeployments.id, deploymentId)));

    return { success: true };
  }

  // ==========================================
  // 5. EXTERNAL LABOUR SETTLEMENTS & PAYABLES
  // ==========================================

  public async listLabourSettlements(tenantId: string, projectId?: number) {
    const conditions = [eq(externalLabourSettlements.tenantId, tenantId)];
    if (projectId && !isNaN(Number(projectId)) && Number(projectId) > 0) {
      conditions.push(eq(externalLabourSettlements.projectId, Number(projectId)));
    }

    const rows = await db
      .select({
        settlement: externalLabourSettlements,
        supplier: suppliers,
        project: projects,
      })
      .from(externalLabourSettlements)
      .innerJoin(suppliers, eq(externalLabourSettlements.supplierId, suppliers.id))
      .innerJoin(projects, eq(externalLabourSettlements.projectId, projects.id))
      .where(and(...conditions))
      .orderBy(desc(externalLabourSettlements.createdAt));

    return rows.map((r) => ({
      ...r.settlement,
      supplier: r.supplier,
      project: r.project,
    }));
  }

  public async createLabourSettlement(
    tenantId: string,
    input: {
      supplierId: number;
      projectId: number;
      periodStart: string;
      periodEnd: string;
      currency?: string;
      notes?: string;
      lines: {
        externalWorkerId: number;
        approvedHours: string;
        rate: string;
        lineTotal: string;
        timesheetReference?: string;
      }[];
    },
    actorId = 'system'
  ) {
    const totalHours = input.lines.reduce((acc, l) => acc + parseFloat(l.approvedHours || '0'), 0);
    const totalAmount = input.lines.reduce((acc, l) => acc + parseFloat(l.lineTotal || '0'), 0);
    const settlementNumber = `SET-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const [settlement] = await db
      .insert(externalLabourSettlements)
      .values({
        tenantId,
        settlementNumber,
        supplierId: input.supplierId,
        projectId: input.projectId,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        currency: input.currency || 'KWD',
        totalApprovedHours: totalHours.toFixed(2),
        totalAmount: totalAmount.toFixed(3),
        status: 'DRAFT',
        notes: input.notes?.trim() || null,
        createdBy: actorId,
        updatedBy: actorId,
      })
      .returning();

    for (const l of input.lines) {
      await db.insert(externalLabourSettlementLines).values({
        tenantId,
        settlementId: settlement.id,
        externalWorkerId: l.externalWorkerId,
        approvedHours: l.approvedHours,
        rate: l.rate,
        lineTotal: l.lineTotal,
        timesheetReference: l.timesheetReference || null,
      });
    }

    return settlement;
  }

  public async approveLabourSettlement(tenantId: string, settlementId: number, actorId = 'system') {
    const [settlement] = await db
      .select()
      .from(externalLabourSettlements)
      .where(and(eq(externalLabourSettlements.tenantId, tenantId), eq(externalLabourSettlements.id, settlementId)))
      .limit(1);

    if (!settlement) throw new Error('Settlement not found');

    const [updated] = await db
      .update(externalLabourSettlements)
      .set({
        status: 'APPROVED',
        approvedBy: actorId,
        approvedAt: new Date(),
        updatedAt: new Date(),
        updatedBy: actorId,
      })
      .where(and(eq(externalLabourSettlements.tenantId, tenantId), eq(externalLabourSettlements.id, settlementId)))
      .returning();

    return updated;
  }

  public async createSupplierBillFromSettlement(tenantId: string, settlementId: number, branchId: string, actorId = 'system') {
    const [settlement] = await db
      .select()
      .from(externalLabourSettlements)
      .where(and(eq(externalLabourSettlements.tenantId, tenantId), eq(externalLabourSettlements.id, settlementId)))
      .limit(1);

    if (!settlement) throw new Error('Settlement not found');
    if (settlement.supplierBillId) throw new Error('Supplier Bill already exists for this labour settlement');

    const lines = await db
      .select({
        line: externalLabourSettlementLines,
        worker: externalWorkers,
      })
      .from(externalLabourSettlementLines)
      .innerJoin(externalWorkers, eq(externalLabourSettlementLines.externalWorkerId, externalWorkers.id))
      .where(and(eq(externalLabourSettlementLines.tenantId, tenantId), eq(externalLabourSettlementLines.settlementId, settlementId)));

    const billNumber = `BIL-LABOUR-${Math.floor(10000 + Math.random() * 90000)}`;

    const [bill] = await db
      .insert(supplierBills)
      .values({
        tenantId,
        branchId,
        billNumber,
        supplierInvoiceNumber: `SET-${settlement.settlementNumber}`,
        supplierId: settlement.supplierId,
        billDate: new Date().toISOString().slice(0, 10),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        currency: settlement.currency,
        paymentTermsId: '30 Days',
        status: 'POSTED',
        subtotal: settlement.totalAmount,
        discountTotal: '0.000',
        taxTotal: '0.000',
        roundingAdjustment: '0.000',
        grandTotal: settlement.totalAmount,
        paidAmount: '0.000',
        outstandingAmount: settlement.totalAmount,
        notes: `Auto-generated from approved external labour settlement ${settlement.settlementNumber}`,
        createdBy: actorId,
        updatedBy: actorId,
        postedAt: new Date(),
        postedBy: actorId,
      })
      .returning();

    for (const l of lines) {
      await db.insert(supplierBillLines).values({
        supplierBillId: bill.id,
        description: `External Labour: ${l.worker.nameEn} (${l.worker.profession}) - ${l.line.approvedHours}h`,
        quantity: l.line.approvedHours,
        unitPrice: l.line.rate,
        discount: '0.000',
        tax: '0.000',
        total: l.line.lineTotal,
        projectId: String(settlement.projectId),
      });
    }

    // Link settlement to the created bill
    await db
      .update(externalLabourSettlements)
      .set({
        supplierBillId: bill.id,
        status: 'BILLED',
        updatedAt: new Date(),
        updatedBy: actorId,
      })
      .where(and(eq(externalLabourSettlements.tenantId, tenantId), eq(externalLabourSettlements.id, settlementId)));

    return { bill, settlementId };
  }
}

export const projectsRepository = new ProjectsRepository();
