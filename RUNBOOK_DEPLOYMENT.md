# GulfHive ERP — Runbook: Deployment

This document contains authoritative procedures for deploying GulfHive ERP to production hosting environments (or self-hosted local systems).

## 1. Prerequisites
- **Node.js**: `v18.0.0` or newer.
- **Database**: PostgreSQL Instance (`v14` or newer).
- **Disk Storage**: At least 5GB free storage space for attachments and backup storage directory.

## 2. Environment Configuration
Create a production `.env` file following the schema documented in `ENV_REFERENCE.md`. Ensure all parameters are correctly customized:
- Set `NODE_ENV=production`.
- Disable bypass variables: `ALLOW_DEV_AUTH_BYPASS=false`.

## 3. Safe Step-by-Step Deployment Routine

### Step 3.1: Package Checkout & Install
```bash
git clone https://github.com/yourorg/gulfhive-erp.git
cd gulfhive-erp
npm ci --production
```

### Step 3.2: Database Migration Check
Execute the deterministic migration engine to apply any pending schema changes sequentially:
```bash
npm run verify:migrations
```

### Step 3.3: Production Build
Compile optimized front-end assets:
```bash
npm run build
```

### Step 3.4: Server Startup
Start the Express server using a process manager (e.g., PM2) or native system service daemon:
```bash
pm2 start server.js --name "gulfhive-erp"
```

## 4. Verification Health Checks
Once the server is running, perform verification requests:
1. Verify system diagnostics status:
   ```bash
   curl -f http://localhost:3000/api/diagnostics/health
   ```
2. Verify that `ALLOW_DEV_AUTH_BYPASS` remains inactive.
