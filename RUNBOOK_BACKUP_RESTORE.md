# GulfHive ERP — Runbook: Backup & Restore

This document outlines the authoritative steps for generating and restoring database state using the integrated cryptographic backup system of GulfHive ERP.

## 1. Creating Database Backups

### Automated Backups
GulfHive can be configured to take automated daily snapshots. Ensure the following environment variables are declared:
- `BACKUP_BASE_DIR=/var/lib/gulfhive/backups`

### Manual Backups
To create a manual verified backup of the current database state immediately, run the backup utility:
```bash
node dist/infrastructure/backup/trigger-backup.js
```
The system will write an atomic backup file: `gh_backup_[timestamp]_[hash].bak.json` containing:
- Cryptographic SHA-256 validation headers.
- Accurate relational data maps for tenants, branches, employees, and parties.

## 2. Verifying Backup File Integrity
Each backup contains a self-verifying SHA-256 signature calculated across the data payload. To run a verification check without writing to the database:
```bash
node dist/infrastructure/backup/verify-backup.js --file /var/lib/gulfhive/backups/gh_backup_123.bak.json
```
If the file was tampered with or experienced write corruption, the utility will abort and print `CorruptedBackupError`.

## 3. Restoring from a Backup (Disaster Recovery)
To restore a verified backup file into the active PostgreSQL instance:
```bash
node dist/infrastructure/backup/restore-backup.js --file /var/lib/gulfhive/backups/gh_backup_123.bak.json
```
This action:
1. Validates the SHA-256 signature first.
2. Initiates a single database transaction blocks.
3. Upserts tenants, branches, and associated records.
4. Commits changes only if all inserts complete successfully, preventing partial or corrupt restorations.
