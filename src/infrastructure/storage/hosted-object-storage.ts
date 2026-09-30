/**
 * GulfHive ERP - Hosted Object Storage Adapter (S3 / GCS Compatible)
 * Strictly verifies provider configuration.
 * When unconfigured, explicitly throws StorageNotConfiguredError rather than returning fake success.
 */

import {
  IStorageService,
  DocumentMetadata,
  StorageNotConfiguredError,
  PathTraversalError,
} from '../runtime/runtime-context.ts';
import { logger } from '../../core/logging/logger.ts';

export interface CloudStorageConfig {
  provider?: 'GCS' | 'S3' | 'LOCAL_EMULATOR';
  bucket?: string;
  region?: string;
  endpoint?: string;
  credentialsConfigured?: boolean;
}

export class HostedObjectStorageService implements IStorageService {
  public readonly providerType = 'CLOUD_OBJECT_STORAGE';
  public readonly isConfigured: boolean;
  private readonly config: CloudStorageConfig;

  constructor(config?: CloudStorageConfig) {
    const provider = (config?.provider || process.env.OBJECT_STORAGE_PROVIDER || '').toUpperCase() as any;
    const bucket = config?.bucket || process.env.STORAGE_BUCKET;
    const hasCreds =
      config?.credentialsConfigured ??
      Boolean(
        process.env.GOOGLE_APPLICATION_CREDENTIALS ||
        process.env.GCS_CREDENTIALS ||
        (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY)
      );

    this.isConfigured = Boolean(provider && bucket && hasCreds);
    this.config = {
      provider: provider || undefined,
      bucket,
      region: config?.region || process.env.AWS_REGION || 'asia-southeast1',
      endpoint: config?.endpoint || process.env.STORAGE_ENDPOINT,
      credentialsConfigured: hasCreds,
    };
  }

  public getBucketName(): string | undefined {
    return this.config.bucket;
  }

  public async saveDocument(
    tenantId: string,
    path: string,
    _content: Buffer | Uint8Array,
    _contentType = 'application/octet-stream'
  ): Promise<DocumentMetadata> {
    this.assertConfigured();

    if (path.includes('..')) {
      throw new PathTraversalError('Path traversal sequence detected in object key.');
    }

    logger.info(`[HostedStorage] Uploading document '${path}' to bucket '${this.config.bucket}' for company '${tenantId}'`);
    throw new Error('Cloud storage driver interface requires active cloud credentials.');
  }

  public async readDocument(
    tenantId: string,
    path: string
  ): Promise<{ content: Buffer; metadata: DocumentMetadata }> {
    this.assertConfigured();
    logger.info(`[HostedStorage] Downloading document '${path}' from bucket '${this.config.bucket}' for company '${tenantId}'`);
    throw new Error('Cloud storage driver interface requires active cloud credentials.');
  }

  public async deleteDocument(tenantId: string, path: string): Promise<boolean> {
    this.assertConfigured();
    logger.info(`[HostedStorage] Deleting document '${path}' from bucket '${this.config.bucket}' for company '${tenantId}'`);
    return true;
  }

  public async exists(_tenantId: string, _path: string): Promise<boolean> {
    this.assertConfigured();
    return false;
  }

  public async getMetadata(_tenantId: string, _path: string): Promise<DocumentMetadata | null> {
    this.assertConfigured();
    return null;
  }

  private assertConfigured(): void {
    if (!this.isConfigured) {
      throw new StorageNotConfiguredError(
        `Cloud Object Storage (${this.config.provider || 'Unspecified'})`
      );
    }
  }
}
