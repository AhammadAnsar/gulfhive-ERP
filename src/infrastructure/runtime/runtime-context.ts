/**
 * GulfHive ERP - Runtime Environment Abstraction & Contracts
 * Decouples domain and application logic from deployment targets:
 * - Desktop Offline installation (local storage, file-based backup/restore, local PostgreSQL)
 * - Self-hosted On-Premise (internal network, enterprise backup policies)
 * - Online Hosted Cloud (Cloud Run, Cloud SQL, object storage)
 */

export interface BackupMetadata {
  readonly backupId: string;
  readonly createdAt: Date;
  readonly schemaVersion: number;
  readonly checksum: string; // sha256:...
  readonly sizeBytes: number;
  readonly tenantCount: number;
  readonly isEncrypted: boolean;
  readonly filePath?: string;
  readonly tablesIncluded?: string[];
  readonly recordCount?: number;
}

export interface BackupDrillResult {
  readonly success: boolean;
  readonly backupId: string;
  readonly verifiedChecksum: boolean;
  readonly restoredRecordsCount: number;
  readonly durationMs: number;
  readonly error?: string;
}

export interface DocumentMetadata {
  readonly path: string;
  readonly tenantId: string;
  readonly sizeBytes: number;
  readonly contentType: string;
  readonly checksum: string; // sha256:...
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface IBackupService {
  readonly providerType: 'DESKTOP_LOCAL' | 'CLOUD_PROVIDER_MANAGED' | 'NOT_CONFIGURED';
  readonly isConfigured: boolean;
  createBackup(targetPath?: string): Promise<BackupMetadata>;
  restoreBackup(backupIdOrPath: string): Promise<boolean>;
  listBackups(): Promise<BackupMetadata[]>;
  verifyBackup(backupIdOrPath: string): Promise<boolean>;
}

export interface IStorageService {
  readonly providerType: 'LOCAL_FILESYSTEM' | 'CLOUD_OBJECT_STORAGE' | 'NOT_CONFIGURED';
  readonly isConfigured: boolean;
  saveDocument(tenantId: string, path: string, content: Buffer | Uint8Array, contentType?: string): Promise<DocumentMetadata>;
  readDocument(tenantId: string, path: string): Promise<{ content: Buffer; metadata: DocumentMetadata }>;
  deleteDocument(tenantId: string, path: string): Promise<boolean>;
  exists(tenantId: string, path: string): Promise<boolean>;
  getMetadata(tenantId: string, path: string): Promise<DocumentMetadata | null>;
}

export interface SystemHealthReport {
  readonly status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
  readonly runtimeMode: 'DESKTOP_OFFLINE' | 'SELF_HOSTED_ON_PREMISE' | 'ONLINE_CLOUD_HOSTED';
  readonly timestamp: string;
  readonly database: {
    readonly connected: boolean;
    readonly latencyMs: number;
    readonly currentMigrationVersion: number;
    readonly totalTenants: number;
    readonly error?: string;
  };
  readonly storage: {
    readonly provider: string;
    readonly configured: boolean;
    readonly accessible: boolean;
    readonly storageDirectory?: string;
    readonly error?: string;
  };
  readonly backup: {
    readonly provider: string;
    readonly configured: boolean;
    readonly totalBackupsAvailable: number;
    readonly lastBackupTimestamp?: string;
  };
}

export interface IRuntimeAdapter {
  readonly mode: 'DESKTOP_OFFLINE' | 'SELF_HOSTED_ON_PREMISE' | 'ONLINE_CLOUD_HOSTED';
  readonly isOfflineCapable: boolean;
  readonly backupService: IBackupService;
  readonly storageService: IStorageService;
  getSystemDiagnostics(): Promise<SystemHealthReport>;
}

// Domain Errors for Storage & Backup
export class PathTraversalError extends Error {
  constructor(message = 'Path traversal attempt detected. Path contains prohibited sequences.') {
    super(message);
    this.name = 'PathTraversalError';
  }
}

export class FileNotFoundError extends Error {
  constructor(path: string, tenantId: string) {
    super(`Document '${path}' not found for company '${tenantId}'.`);
    this.name = 'FileNotFoundError';
  }
}

export class CorruptedBackupError extends Error {
  constructor(reason: string) {
    super(`Backup verification failed: ${reason}`);
    this.name = 'CorruptedBackupError';
  }
}

export class StorageNotConfiguredError extends Error {
  constructor(providerName = 'Cloud Object Storage') {
    super(`${providerName} is NOT_CONFIGURED. Please provide cloud bucket and access credentials.`);
    this.name = 'StorageNotConfiguredError';
  }
}

export class BackupNotConfiguredError extends Error {
  constructor(message = 'Cloud backup integration is NOT_CONFIGURED or managed externally by cloud infrastructure.') {
    super(message);
    this.name = 'BackupNotConfiguredError';
  }
}
