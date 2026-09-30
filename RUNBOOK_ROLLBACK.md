# GulfHive ERP — Runbook: Rollback Procedures

This document outlines the step-by-step procedures to revert GulfHive ERP to a previous stable state in case of a failed release or critical production bug.

## 1. Application Rollback (Code Reversal)

### Step 1.1: Stop Currently Running Application Instance
```bash
pm2 stop "gulfhive-erp"
```

### Step 1.2: Check Out Prior Target Release Tag
Checkout the last stable version using Git:
```bash
git checkout tags/v0.9.5-stable -b rollback-branch
```

### Step 1.3: Clean and Reinstall Dependencies
Ensure no stale node_modules or cached assets remain:
```bash
rm -rf node_modules dist
npm ci --production
```

### Step 1.4: Compile Stable Production Bundle
```bash
npm run build
```

## 2. Database Schema Rollback
If the failed release introduced incompatible SQL schema migrations, follow these precautions:
- GulfHive ERP migration files are designed as forward-only immutable transactions to protect business record history.
- Direct database schema demotion must be resolved through controlled SQL adjustments.
- For severe failures, restore database state to the last successful pre-release snapshot file following the instructions in `RUNBOOK_BACKUP_RESTORE.md`.

## 3. Resume Application Execution
```bash
pm2 start "gulfhive-erp"
```
Ensure all verification health checks pass cleanly.
