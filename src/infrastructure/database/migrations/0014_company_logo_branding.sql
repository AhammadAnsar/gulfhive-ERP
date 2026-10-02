-- Migration 0014: Add company logo and branding column to tenants
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS logo_url text;
