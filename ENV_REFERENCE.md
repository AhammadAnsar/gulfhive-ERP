# GulfHive ERP — Environment Variables Reference

This document serves as the authoritative source of truth for the environment configuration variables used by GulfHive ERP.

## General Parameters
- `NODE_ENV`: Defines current environment mode (`production`, `development`, `testing`).
- `PORT`: The listener port for the Express application. Default is `3000`.

## Database Parameters (PostgreSQL)
- `SQL_HOST`: Host address of the PostgreSQL database instance (e.g. `127.0.0.1` or `localhost`).
- `SQL_PORT`: Listener port of the database. Default is `5432`.
- `SQL_USER`: Connection user name.
- `SQL_PASSWORD`: Connection password.
- `SQL_DB_NAME`: Target database name (e.g. `gulfhive`).

## Security Parameters
- `ALLOW_DEV_AUTH_BYPASS`: Controls development-mode auth overrides. Must be set to `false` in production.
- `JWT_SECRET`: Secret string used to sign and verify JWT authentication tokens. Must contain at least 32 high-entropy characters.

## Disk Storage and Backup
- `BACKUP_BASE_DIR`: Directory where database backups are stored. Default is `./storage/backups`.
- `STORAGE_BASE_DIR`: Root directory where user attachments and PDF documents are written. Default is `./storage/documents`.
