-- 0013_unified_party_architecture.sql
-- Migration 13: Unified Party Architecture
-- Single legal entity representation across Client, Supplier, Principal Contractor, and Workforce Supplier roles.

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

-- Add party reference columns to existing domain tables
ALTER TABLE clients ADD COLUMN IF NOT EXISTS party_id INTEGER REFERENCES parties(id) ON DELETE SET NULL;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS party_id INTEGER REFERENCES parties(id) ON DELETE SET NULL;
ALTER TABLE billing_profiles ADD COLUMN IF NOT EXISTS party_id INTEGER REFERENCES parties(id) ON DELETE SET NULL;
ALTER TABLE billing_profiles ADD COLUMN IF NOT EXISTS principal_party_id INTEGER REFERENCES parties(id) ON DELETE SET NULL;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS principal_party_id INTEGER REFERENCES parties(id) ON DELETE SET NULL;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS client_party_id INTEGER REFERENCES parties(id) ON DELETE SET NULL;
ALTER TABLE project_contracts ADD COLUMN IF NOT EXISTS principal_party_id INTEGER REFERENCES parties(id) ON DELETE SET NULL;
ALTER TABLE external_workers ADD COLUMN IF NOT EXISTS source_party_id INTEGER REFERENCES parties(id) ON DELETE SET NULL;
ALTER TABLE workforce_supplier_agreements ADD COLUMN IF NOT EXISTS supplier_party_id INTEGER REFERENCES parties(id) ON DELETE SET NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS party_id INTEGER REFERENCES parties(id) ON DELETE SET NULL;
ALTER TABLE supplier_bills ADD COLUMN IF NOT EXISTS party_id INTEGER REFERENCES parties(id) ON DELETE SET NULL;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS party_id INTEGER REFERENCES parties(id) ON DELETE SET NULL;

-- Backfill Parties & Client Profiles from Clients
DO $$
DECLARE
    r RECORD;
    p_id INTEGER;
BEGIN
    FOR r IN SELECT * FROM clients WHERE party_id IS NULL LOOP
        -- Check if party already created for this tenant with same cr_number or name
        SELECT id INTO p_id FROM parties 
        WHERE tenant_id = r.tenant_id 
          AND (
            (r.cr_number IS NOT NULL AND cr_number = r.cr_number)
            OR (LOWER(legal_name_en) = LOWER(r.name_en))
          )
        LIMIT 1;

        IF p_id IS NULL THEN
            INSERT INTO parties (
                tenant_id, party_number, party_type, legal_name_en, legal_name_ar, 
                country_code, cr_number, phone, email, website, status, created_by
            ) VALUES (
                r.tenant_id, 'PTY-' || UPPER(r.code), 'ORGANIZATION', r.name_en, r.name_ar,
                'KW', r.cr_number, r.phone, r.email, r.website, COALESCE(r.status, 'ACTIVE'), COALESCE(r.created_by, 'system')
            ) RETURNING id INTO p_id;
        END IF;

        -- Ensure CLIENT role
        INSERT INTO party_roles (tenant_id, party_id, role_type, status, created_by)
        VALUES (r.tenant_id, p_id, 'CLIENT', 'ACTIVE', COALESCE(r.created_by, 'system'))
        ON CONFLICT DO NOTHING;

        -- Ensure Client Profile
        IF NOT EXISTS (SELECT 1 FROM client_profiles WHERE party_id = p_id) THEN
            INSERT INTO client_profiles (tenant_id, party_id, payment_terms_id)
            VALUES (r.tenant_id, p_id, r.payment_terms_id);
        END IF;

        -- Update client party_id link
        UPDATE clients SET party_id = p_id WHERE id = r.id;
    END LOOP;
END $$;

-- Backfill Parties & Supplier Profiles from Suppliers
DO $$
DECLARE
    r RECORD;
    p_id INTEGER;
BEGIN
    FOR r IN SELECT * FROM suppliers WHERE party_id IS NULL LOOP
        -- Check if party already created for this tenant
        SELECT id INTO p_id FROM parties 
        WHERE tenant_id = r.tenant_id 
          AND (
            (r.cr_number IS NOT NULL AND cr_number = r.cr_number)
            OR (LOWER(legal_name_en) = LOWER(r.name_en))
          )
        LIMIT 1;

        IF p_id IS NULL THEN
            INSERT INTO parties (
                tenant_id, party_number, party_type, legal_name_en, legal_name_ar, 
                country_code, cr_number, tax_number, phone, email, website, status, created_by
            ) VALUES (
                r.tenant_id, 'PTY-' || UPPER(r.code), 'ORGANIZATION', r.name_en, r.name_ar,
                'KW', r.cr_number, r.vat_number, r.phone, r.email, r.website, COALESCE(r.status, 'ACTIVE'), COALESCE(r.created_by, 'system')
            ) RETURNING id INTO p_id;
        END IF;

        -- Ensure SUPPLIER role
        INSERT INTO party_roles (tenant_id, party_id, role_type, status, created_by)
        VALUES (r.tenant_id, p_id, 'SUPPLIER', 'ACTIVE', COALESCE(r.created_by, 'system'))
        ON CONFLICT DO NOTHING;

        -- Ensure Supplier Profile
        IF NOT EXISTS (SELECT 1 FROM supplier_profiles WHERE party_id = p_id) THEN
            INSERT INTO supplier_profiles (tenant_id, party_id, payment_terms_id, purchase_currency, bank_name, bank_iban, bank_swift)
            VALUES (r.tenant_id, p_id, r.payment_terms_id, COALESCE(r.currency, 'KWD'), r.bank_name, r.bank_iban, r.bank_swift);
        END IF;

        -- Update supplier party_id link
        UPDATE suppliers SET party_id = p_id WHERE id = r.id;
    END LOOP;
END $$;

-- Backfill dependent table party_ids
UPDATE invoices i SET party_id = c.party_id FROM clients c WHERE i.client_id = c.id AND i.party_id IS NULL AND c.party_id IS NOT NULL;
UPDATE supplier_bills b SET party_id = s.party_id FROM suppliers s WHERE b.supplier_id = s.id AND b.party_id IS NULL AND s.party_id IS NOT NULL;
UPDATE purchase_orders po SET party_id = s.party_id FROM suppliers s WHERE po.supplier_id = s.id AND po.party_id IS NULL AND s.party_id IS NOT NULL;
UPDATE billing_profiles bp SET party_id = s.party_id FROM suppliers s WHERE bp.principal_supplier_id = s.id AND bp.party_id IS NULL AND s.party_id IS NOT NULL;
UPDATE projects p SET client_party_id = c.party_id FROM clients c WHERE p.client_id = c.id AND p.client_party_id IS NULL AND c.party_id IS NOT NULL;
UPDATE projects p SET principal_party_id = s.party_id FROM suppliers s WHERE p.principal_supplier_id = s.id AND p.principal_party_id IS NULL AND s.party_id IS NOT NULL;
UPDATE external_workers ew SET source_party_id = s.party_id FROM suppliers s WHERE ew.source_supplier_id = s.id AND ew.source_party_id IS NULL AND s.party_id IS NOT NULL;
