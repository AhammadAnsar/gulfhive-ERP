import { eq, and, desc, asc, sql, inArray, ilike, or } from 'drizzle-orm';
import { db } from '../../../db/index.ts';
import {
  parties,
  partyRoles,
  clientProfiles,
  supplierProfiles,
  clients,
  suppliers,
  projects,
  externalWorkers,
  invoices,
  supplierBills,
  auditLogs,
} from '../../../db/schema.ts';
import { numberingRepository } from './numbering.repository.ts';
import { logger } from '../../../core/logging/logger.ts';

export type PartyRoleType = 'CLIENT' | 'SUPPLIER' | 'PRINCIPAL_CONTRACTOR' | 'WORKFORCE_SUPPLIER';

export interface CreatePartyInput {
  partyType?: 'ORGANIZATION' | 'INDIVIDUAL';
  legalNameEn: string;
  legalNameAr: string;
  tradeNameEn?: string;
  tradeNameAr?: string;
  countryCode?: string;
  crNumber?: string;
  taxNumber?: string;
  licenseNumber?: string;
  primaryContactName?: string;
  phone?: string;
  email?: string;
  website?: string;
  addressEn?: string;
  addressAr?: string;
  notes?: string;
  roles?: PartyRoleType[];
  clientProfile?: {
    creditLimit?: string;
    paymentTermsDays?: number;
    paymentTermsId?: string;
    billingCurrency?: string;
    salesPersonId?: string;
  };
  supplierProfile?: {
    paymentTermsDays?: number;
    paymentTermsId?: string;
    purchaseCurrency?: string;
    bankName?: string;
    bankIban?: string;
    bankSwift?: string;
  };
}

export interface UpdatePartyInput {
  legalNameEn?: string;
  legalNameAr?: string;
  tradeNameEn?: string;
  tradeNameAr?: string;
  countryCode?: string;
  crNumber?: string;
  taxNumber?: string;
  licenseNumber?: string;
  primaryContactName?: string;
  phone?: string;
  email?: string;
  website?: string;
  addressEn?: string;
  addressAr?: string;
  status?: string;
  notes?: string;
}

export class PartyRepository {
  private _tablesEnsured = false;

  public async ensurePartyTables(): Promise<void> {
    if (this._tablesEnsured) return;
    try {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS parties (
          id SERIAL PRIMARY KEY,
          tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
          party_number VARCHAR(64) NOT NULL,
          party_type VARCHAR(32) NOT NULL DEFAULT 'ORGANIZATION',
          legal_name_en TEXT NOT NULL,
          legal_name_ar TEXT NOT NULL,
          trade_name_en TEXT,
          trade_name_ar TEXT,
          country_code VARCHAR(2) NOT NULL DEFAULT 'KW',
          cr_number TEXT,
          tax_number TEXT,
          license_number TEXT,
          primary_contact_name TEXT,
          phone VARCHAR(32),
          email TEXT,
          website TEXT,
          address_en TEXT,
          address_ar TEXT,
          status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
          notes TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
          created_by TEXT,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
          updated_by TEXT,
          deleted_at TIMESTAMP WITH TIME ZONE,
          deleted_by TEXT,
          delete_reason TEXT
        );
      `);

      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS party_roles (
          id SERIAL PRIMARY KEY,
          tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
          party_id INTEGER NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
          role_type VARCHAR(64) NOT NULL,
          status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
          created_by TEXT,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
          updated_by TEXT,
          CONSTRAINT party_roles_tenant_party_role_unique UNIQUE (tenant_id, party_id, role_type)
        );
      `);

      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS client_profiles (
          id SERIAL PRIMARY KEY,
          tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
          party_id INTEGER NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
          credit_limit TEXT DEFAULT '0.000',
          payment_terms_days INTEGER DEFAULT 30,
          payment_terms_id VARCHAR(64),
          billing_currency VARCHAR(3) DEFAULT 'KWD' NOT NULL,
          sales_person_id TEXT,
          notes TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
          CONSTRAINT client_profiles_party_unique UNIQUE (party_id)
        );
      `);

      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS supplier_profiles (
          id SERIAL PRIMARY KEY,
          tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
          party_id INTEGER NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
          payment_terms_days INTEGER DEFAULT 30,
          payment_terms_id VARCHAR(64) DEFAULT '30 Days',
          purchase_currency VARCHAR(3) DEFAULT 'KWD' NOT NULL,
          bank_name TEXT,
          bank_iban TEXT,
          bank_swift TEXT,
          notes TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
          CONSTRAINT supplier_profiles_party_unique UNIQUE (party_id)
        );
      `);

      this._tablesEnsured = true;
    } catch (err: any) {
      logger.debug('ensurePartyTables info:', err.message);
    }
  }

  public async listParties(
    tenantId: string,
    filters?: {
      role?: PartyRoleType;
      status?: string;
      search?: string;
    }
  ) {
    await this.ensurePartyTables();
    let baseQuery = db
      .select({
        party: parties,
      })
      .from(parties)
      .where(and(eq(parties.tenantId, tenantId), sql`${parties.deletedAt} IS NULL`));

    const conditions = [eq(parties.tenantId, tenantId), sql`${parties.deletedAt} IS NULL`];

    if (filters?.status) {
      conditions.push(eq(parties.status, filters.status));
    }

    if (filters?.search) {
      const term = `%${filters.search.trim()}%`;
      conditions.push(
        or(
          ilike(parties.legalNameEn, term),
          ilike(parties.legalNameAr, term),
          ilike(parties.partyNumber, term),
          ilike(parties.crNumber, term),
          ilike(parties.taxNumber, term)
        )!
      );
    }

    const partyRows = await db
      .select()
      .from(parties)
      .where(and(...conditions))
      .orderBy(asc(parties.legalNameEn));

    if (partyRows.length === 0) return [];

    const partyIds = partyRows.map((p) => p.id);

    const rolesRows = await db
      .select()
      .from(partyRoles)
      .where(and(eq(partyRoles.tenantId, tenantId), inArray(partyRoles.partyId, partyIds)));

    if (filters?.role) {
      const validPartyIds = new Set(
        rolesRows
          .filter((r) => r.roleType === filters.role && r.status === 'ACTIVE')
          .map((r) => r.partyId)
      );

      return partyRows
        .filter((p) => validPartyIds.has(p.id))
        .map((p) => ({
          ...p,
          roles: rolesRows.filter((r) => r.partyId === p.id),
        }));
    }

    return partyRows.map((p) => ({
      ...p,
      roles: rolesRows.filter((r) => r.partyId === p.id),
    }));
  }

  public async getParty(tenantId: string, partyId: number) {
    await this.ensurePartyTables();
    const [party] = await db
      .select()
      .from(parties)
      .where(and(eq(parties.tenantId, tenantId), eq(parties.id, partyId), sql`${parties.deletedAt} IS NULL`))
      .limit(1);

    if (!party) return null;

    const roles = await db
      .select()
      .from(partyRoles)
      .where(and(eq(partyRoles.tenantId, tenantId), eq(partyRoles.partyId, partyId)));

    const [clientProfile] = await db
      .select()
      .from(clientProfiles)
      .where(and(eq(clientProfiles.tenantId, tenantId), eq(clientProfiles.partyId, partyId)))
      .limit(1);

    const [supplierProfile] = await db
      .select()
      .from(supplierProfiles)
      .where(and(eq(supplierProfiles.tenantId, tenantId), eq(supplierProfiles.partyId, partyId)))
      .limit(1);

    return {
      ...party,
      roles,
      clientProfile: clientProfile || null,
      supplierProfile: supplierProfile || null,
    };
  }

  public async createParty(tenantId: string, input: CreatePartyInput, actorId = 'system') {
    await this.ensurePartyTables();
    // Check duplicates before creating
    const duplicateCheck = await this.checkDuplicates(tenantId, {
      crNumber: input.crNumber,
      taxNumber: input.taxNumber,
      legalNameEn: input.legalNameEn,
      countryCode: input.countryCode || 'KW',
    });

    if (duplicateCheck.exactMatch) {
      throw new Error(
        `A party with Commercial Registration '${input.crNumber}' or Tax Number '${input.taxNumber}' already exists in company.`
      );
    }

    let partyNumber = `PTY-${Date.now()}`;
    try {
      const generated = await numberingRepository.generateNextNumber(tenantId, 'PARTY');
      if (generated) partyNumber = generated;
    } catch {
      // fallback
    }

    const [party] = await db
      .insert(parties)
      .values({
        tenantId,
        partyNumber,
        partyType: input.partyType || 'ORGANIZATION',
        legalNameEn: input.legalNameEn.trim(),
        legalNameAr: input.legalNameAr.trim(),
        tradeNameEn: input.tradeNameEn?.trim() || null,
        tradeNameAr: input.tradeNameAr?.trim() || null,
        countryCode: input.countryCode || 'KW',
        crNumber: input.crNumber?.trim() || null,
        taxNumber: input.taxNumber?.trim() || null,
        licenseNumber: input.licenseNumber?.trim() || null,
        primaryContactName: input.primaryContactName?.trim() || null,
        phone: input.phone?.trim() || null,
        email: input.email?.trim() || null,
        website: input.website?.trim() || null,
        addressEn: input.addressEn?.trim() || null,
        addressAr: input.addressAr?.trim() || null,
        notes: input.notes?.trim() || null,
        status: 'ACTIVE',
        createdBy: actorId,
        updatedBy: actorId,
      })
      .returning();

    const rolesToCreate = input.roles || ['CLIENT'];
    for (const roleType of rolesToCreate) {
      await db.insert(partyRoles).values({
        tenantId,
        partyId: party.id,
        roleType,
        status: 'ACTIVE',
        createdBy: actorId,
        updatedBy: actorId,
      });
    }

    if (rolesToCreate.includes('CLIENT')) {
      await db.insert(clientProfiles).values({
        tenantId,
        partyId: party.id,
        creditLimit: input.clientProfile?.creditLimit || '0.000',
        paymentTermsDays: input.clientProfile?.paymentTermsDays || 30,
        paymentTermsId: input.clientProfile?.paymentTermsId || '30 Days',
        billingCurrency: input.clientProfile?.billingCurrency || 'KWD',
        salesPersonId: input.clientProfile?.salesPersonId || null,
      });
    }

    if (rolesToCreate.includes('SUPPLIER') || rolesToCreate.includes('WORKFORCE_SUPPLIER')) {
      await db.insert(supplierProfiles).values({
        tenantId,
        partyId: party.id,
        paymentTermsDays: input.supplierProfile?.paymentTermsDays || 30,
        paymentTermsId: input.supplierProfile?.paymentTermsId || '30 Days',
        purchaseCurrency: input.supplierProfile?.purchaseCurrency || 'KWD',
        bankName: input.supplierProfile?.bankName || null,
        bankIban: input.supplierProfile?.bankIban || null,
        bankSwift: input.supplierProfile?.bankSwift || null,
      });
    }

    await db.insert(auditLogs).values({
      tenantId,
      actorId,
      action: 'CREATE',
      entityType: 'PARTY',
      entityId: String(party.id),
      previousState: null,
      resultingState: party,
    });

    return this.getParty(tenantId, party.id);
  }

  public async updateParty(tenantId: string, partyId: number, input: UpdatePartyInput, actorId = 'system') {
    const existing = await this.getParty(tenantId, partyId);
    if (!existing) throw new Error('Party not found or access denied');

    const [updated] = await db
      .update(parties)
      .set({
        legalNameEn: input.legalNameEn !== undefined ? input.legalNameEn.trim() : existing.legalNameEn,
        legalNameAr: input.legalNameAr !== undefined ? input.legalNameAr.trim() : existing.legalNameAr,
        tradeNameEn: input.tradeNameEn !== undefined ? input.tradeNameEn?.trim() || null : existing.tradeNameEn,
        tradeNameAr: input.tradeNameAr !== undefined ? input.tradeNameAr?.trim() || null : existing.tradeNameAr,
        countryCode: input.countryCode !== undefined ? input.countryCode : existing.countryCode,
        crNumber: input.crNumber !== undefined ? input.crNumber?.trim() || null : existing.crNumber,
        taxNumber: input.taxNumber !== undefined ? input.taxNumber?.trim() || null : existing.taxNumber,
        licenseNumber: input.licenseNumber !== undefined ? input.licenseNumber?.trim() || null : existing.licenseNumber,
        primaryContactName: input.primaryContactName !== undefined ? input.primaryContactName?.trim() || null : existing.primaryContactName,
        phone: input.phone !== undefined ? input.phone?.trim() || null : existing.phone,
        email: input.email !== undefined ? input.email?.trim() || null : existing.email,
        website: input.website !== undefined ? input.website?.trim() || null : existing.website,
        addressEn: input.addressEn !== undefined ? input.addressEn?.trim() || null : existing.addressEn,
        addressAr: input.addressAr !== undefined ? input.addressAr?.trim() || null : existing.addressAr,
        status: input.status !== undefined ? input.status : existing.status,
        notes: input.notes !== undefined ? input.notes?.trim() || null : existing.notes,
        updatedAt: new Date(),
        updatedBy: actorId,
      })
      .where(and(eq(parties.tenantId, tenantId), eq(parties.id, partyId)))
      .returning();

    await db.insert(auditLogs).values({
      tenantId,
      actorId,
      action: 'UPDATE',
      entityType: 'PARTY',
      entityId: String(partyId),
      previousState: existing,
      resultingState: updated,
    });

    return this.getParty(tenantId, partyId);
  }

  public async addRole(
    tenantId: string,
    partyId: number,
    roleType: PartyRoleType,
    profileInput?: {
      clientProfile?: any;
      supplierProfile?: any;
    },
    actorId = 'system'
  ) {
    const party = await this.getParty(tenantId, partyId);
    if (!party) throw new Error('Party not found or access denied');

    const existingRole = party.roles.find((r) => r.roleType === roleType);
    if (existingRole) {
      if (existingRole.status !== 'ACTIVE') {
        await db
          .update(partyRoles)
          .set({ status: 'ACTIVE', updatedAt: new Date(), updatedBy: actorId })
          .where(and(eq(partyRoles.tenantId, tenantId), eq(partyRoles.id, existingRole.id)));
      }
    } else {
      await db.insert(partyRoles).values({
        tenantId,
        partyId,
        roleType,
        status: 'ACTIVE',
        createdBy: actorId,
        updatedBy: actorId,
      });
    }

    if (roleType === 'CLIENT' && !party.clientProfile) {
      await db.insert(clientProfiles).values({
        tenantId,
        partyId,
        creditLimit: profileInput?.clientProfile?.creditLimit || '0.000',
        paymentTermsDays: profileInput?.clientProfile?.paymentTermsDays || 30,
        paymentTermsId: profileInput?.clientProfile?.paymentTermsId || '30 Days',
        billingCurrency: profileInput?.clientProfile?.billingCurrency || 'KWD',
      });
    }

    if ((roleType === 'SUPPLIER' || roleType === 'WORKFORCE_SUPPLIER') && !party.supplierProfile) {
      await db.insert(supplierProfiles).values({
        tenantId,
        partyId,
        paymentTermsDays: profileInput?.supplierProfile?.paymentTermsDays || 30,
        paymentTermsId: profileInput?.supplierProfile?.paymentTermsId || '30 Days',
        purchaseCurrency: profileInput?.supplierProfile?.purchaseCurrency || 'KWD',
        bankName: profileInput?.supplierProfile?.bankName || null,
        bankIban: profileInput?.supplierProfile?.bankIban || null,
        bankSwift: profileInput?.supplierProfile?.bankSwift || null,
      });
    }

    return this.getParty(tenantId, partyId);
  }

  public async removeRole(tenantId: string, partyId: number, roleType: PartyRoleType, actorId = 'system') {
    const party = await this.getParty(tenantId, partyId);
    if (!party) throw new Error('Party not found or access denied');

    await db
      .update(partyRoles)
      .set({ status: 'INACTIVE', updatedAt: new Date(), updatedBy: actorId })
      .where(and(eq(partyRoles.tenantId, tenantId), eq(partyRoles.partyId, partyId), eq(partyRoles.roleType, roleType)));

    return this.getParty(tenantId, partyId);
  }

  public async checkDuplicates(
    tenantId: string,
    input: {
      crNumber?: string;
      taxNumber?: string;
      legalNameEn?: string;
      countryCode?: string;
    }
  ) {
    await this.ensurePartyTables();
    const warnings: string[] = [];
    const matches: any[] = [];

    if (input.crNumber?.trim()) {
      const crMatches = await db
        .select()
        .from(parties)
        .where(
          and(
            eq(parties.tenantId, tenantId),
            eq(parties.crNumber, input.crNumber.trim()),
            sql`${parties.deletedAt} IS NULL`
          )
        );

      if (crMatches.length > 0) {
        matches.push(...crMatches);
        warnings.push(`Commercial Registration '${input.crNumber}' is already registered.`);
      }
    }

    if (input.taxNumber?.trim()) {
      const taxMatches = await db
        .select()
        .from(parties)
        .where(
          and(
            eq(parties.tenantId, tenantId),
            eq(parties.taxNumber, input.taxNumber.trim()),
            sql`${parties.deletedAt} IS NULL`
          )
        );

      if (taxMatches.length > 0) {
        matches.push(...taxMatches);
        warnings.push(`Tax Identification '${input.taxNumber}' is already registered.`);
      }
    }

    if (input.legalNameEn?.trim() && matches.length === 0) {
      const nameMatches = await db
        .select()
        .from(parties)
        .where(
          and(
            eq(parties.tenantId, tenantId),
            ilike(parties.legalNameEn, input.legalNameEn.trim()),
            sql`${parties.deletedAt} IS NULL`
          )
        );

      if (nameMatches.length > 0) {
        matches.push(...nameMatches);
        warnings.push(`Legal name '${input.legalNameEn}' matches existing party.`);
      }
    }

    const uniqueMatches = Array.from(new Map(matches.map((m) => [m.id, m])).values());

    return {
      hasMatch: uniqueMatches.length > 0,
      exactMatch: warnings.some((w) => w.includes('Registration') || w.includes('Tax Identification')),
      warnings,
      matches: uniqueMatches,
    };
  }

  public async mergeParties(tenantId: string, sourcePartyId: number, targetPartyId: number, actorId = 'system') {
    if (sourcePartyId === targetPartyId) {
      throw new Error('Source and target party must be different');
    }

    const source = await this.getParty(tenantId, sourcePartyId);
    const target = await this.getParty(tenantId, targetPartyId);

    if (!source || !target) throw new Error('Source or target party not found or access denied');

    // Transfer active roles
    for (const role of source.roles) {
      if (role.status === 'ACTIVE') {
        await this.addRole(tenantId, targetPartyId, role.roleType as PartyRoleType, {}, actorId);
      }
    }

    // Update references
    await db.update(clients).set({ partyId: targetPartyId }).where(and(eq(clients.tenantId, tenantId), eq(clients.partyId, sourcePartyId)));
    await db.update(suppliers).set({ partyId: targetPartyId }).where(and(eq(suppliers.tenantId, tenantId), eq(suppliers.partyId, sourcePartyId)));
    await db.update(invoices).set({ partyId: targetPartyId }).where(and(eq(invoices.tenantId, tenantId), eq(invoices.partyId, sourcePartyId)));
    await db.update(supplierBills).set({ partyId: targetPartyId }).where(and(eq(supplierBills.tenantId, tenantId), eq(supplierBills.partyId, sourcePartyId)));
    await db.update(projects).set({ principalPartyId: targetPartyId }).where(and(eq(projects.tenantId, tenantId), eq(projects.principalPartyId, sourcePartyId)));
    await db.update(projects).set({ clientPartyId: targetPartyId }).where(and(eq(projects.tenantId, tenantId), eq(projects.clientPartyId, sourcePartyId)));
    await db.update(externalWorkers).set({ sourcePartyId: targetPartyId }).where(and(eq(externalWorkers.tenantId, tenantId), eq(externalWorkers.sourcePartyId, sourcePartyId)));

    // Soft delete source party
    await db
      .update(parties)
      .set({
        status: 'DELETED',
        deletedAt: new Date(),
        deletedBy: actorId,
        deleteReason: `Merged into party #${targetPartyId}`,
      })
      .where(and(eq(parties.tenantId, tenantId), eq(parties.id, sourcePartyId)));

    await db.insert(auditLogs).values({
      tenantId,
      actorId,
      action: 'MERGE',
      entityType: 'PARTY',
      entityId: String(targetPartyId),
      previousState: source,
      resultingState: { targetPartyId, mergedSourceId: sourcePartyId },
    });

    return this.getParty(tenantId, targetPartyId);
  }

  public async deleteParty(tenantId: string, partyId: number, reason = 'User requested', actorId = 'system') {
    const existing = await this.getParty(tenantId, partyId);
    if (!existing) throw new Error('Party not found or access denied');

    const [deleted] = await db
      .update(parties)
      .set({
        status: 'DELETED',
        deletedAt: new Date(),
        deletedBy: actorId,
        deleteReason: reason,
      })
      .where(and(eq(parties.tenantId, tenantId), eq(parties.id, partyId)))
      .returning();

    await db.insert(auditLogs).values({
      tenantId,
      actorId,
      action: 'DELETE',
      entityType: 'PARTY',
      entityId: String(partyId),
      previousState: existing,
      resultingState: deleted,
    });

    return deleted;
  }

  public async preflightDeleteParty(tenantId: string, partyId: number) {
    const reasons: string[] = [];
    
    // Check invoice references
    const [inv] = await db.select({ count: sql<number>`count(*)` }).from(invoices).where(eq(invoices.partyId, partyId));
    if (Number(inv?.count || 0) > 0) {
      reasons.push(`Referenced in ${inv.count} customer invoice(s)`);
    }

    // Check project references
    const [prj] = await db.select({ count: sql<number>`count(*)` }).from(projects).where(eq(projects.clientPartyId, partyId));
    if (Number(prj?.count || 0) > 0) {
      reasons.push(`Referenced in ${prj.count} project(s)`);
    }

    return {
      isEligible: reasons.length === 0,
      reasons,
    };
  }

  public async bulkDeleteParties(
    tenantId: string,
    params: {
      partyIds: number[];
      action: 'DELETE' | 'ARCHIVE';
      actorId: string;
      reason?: string;
    }
  ) {
    const result = {
      deleted: 0,
      archived: 0,
      failed: 0,
      details: [] as any[],
    };

    for (const pid of params.partyIds) {
      try {
        const preflight = await this.preflightDeleteParty(tenantId, pid);
        if (!preflight.isEligible && params.action === 'DELETE') {
          result.failed++;
          result.details.push({
            id: pid,
            status: 'FAILED',
            message: `Protected from deletion: ${preflight.reasons.join('; ')}`,
          });
          continue;
        }

        if (params.action === 'DELETE') {
          await this.deleteParty(tenantId, pid, params.reason || 'Bulk deleted', params.actorId);
          result.deleted++;
          result.details.push({ id: pid, status: 'DELETED' });
        } else {
          await db.update(parties).set({ status: 'INACTIVE', updatedAt: new Date(), updatedBy: params.actorId }).where(and(eq(parties.tenantId, tenantId), eq(parties.id, pid)));
          result.archived++;
          result.details.push({ id: pid, status: 'ARCHIVED' });
        }
      } catch (err: any) {
        result.failed++;
        result.details.push({ id: pid, status: 'FAILED', message: err.message });
      }
    }
    return result;
  }
}

export const partyRepository = new PartyRepository();
