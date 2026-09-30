/**
 * GulfHive ERP - Runtime Environment Abstraction
 * Decouples domain and application logic from deployment targets:
 * - Desktop Offline installation (local storage, file-based backup/restore, local PostgreSQL/SQLite)
 * - Self-hosted On-Premise (internal network, enterprise backup policies)
 * - Online Hosted Cloud (Cloud Run, Cloud SQL, object storage)
 */

export interface BackupMetadata {
  readonly backupId: string;
  readonly createdAt: Date;
  readonly schemaVersion: number;
  readonly checksum: string;
  readonly sizeBytes: number;
  readonly tenantCount: number;
  readonly isEncrypted: boolean;
}

export interface IBackupService {
  createBackup(targetPath?: string): Promise<BackupMetadata>;
  restoreBackup(backupIdOrPath: string): Promise<boolean>;
  listBackups(): Promise<BackupMetadata[]>;
  verifyBackup(backupIdOrPath: string): Promise<boolean>;
}

export interface IStorageService {
  saveDocument(tenantId: string, path: string, content: Buffer | Uint8Array, contentType: string): Promise<string>;
  readDocument(tenantId: string, path: string): Promise<Buffer | Uint8Array>;
  deleteDocument(tenantId: string, path: string): Promise<boolean>;
  exists(tenantId: string, path: string): Promise<boolean>;
}

export interface IRuntimeAdapter {
  readonly mode: 'DESKTOP_OFFLINE' | 'SELF_HOSTED_ON_PREMISE' | 'ONLINE_CLOUD_HOSTED';
  readonly isOfflineCapable: boolean;
  readonly backupService: IBackupService;
  readonly storageService: IStorageService;
  getSystemDiagnostics(): Promise<Record<string, unknown>>;
}
