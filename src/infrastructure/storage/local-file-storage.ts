/**
 * GulfHive ERP - Real Desktop & Local Filesystem Storage Adapter
 * Strictly adheres to enterprise storage invariants:
 * 1. Safe path normalization & zero path traversal (blocks '..', null bytes, root escaping).
 * 2. Strict company/tenant isolation namespaces.
 * 3. Atomic writes via temp files + rename.
 * 4. SHA-256 checksum generation & validation.
 * 5. Metadata tracking (size, MIME type, timestamps).
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  IStorageService,
  DocumentMetadata,
  PathTraversalError,
  FileNotFoundError,
} from '../runtime/runtime-context.ts';
import { logger } from '../../core/logging/logger.ts';

export interface LocalStorageOptions {
  baseDirectory?: string;
  maxSizeBytes?: number; // default 25MB
  allowedMimeTypes?: string[];
}

export class LocalFileStorageService implements IStorageService {
  public readonly providerType = 'LOCAL_FILESYSTEM';
  public readonly isConfigured = true;

  private readonly baseDirectory: string;
  private readonly maxSizeBytes: number;
  private readonly allowedMimeTypes: Set<string>;

  constructor(options: LocalStorageOptions = {}) {
    this.baseDirectory = path.resolve(
      options.baseDirectory || process.env.STORAGE_BASE_DIR || './storage/documents'
    );
    this.maxSizeBytes = options.maxSizeBytes || 25 * 1024 * 1024; // 25 MB
    this.allowedMimeTypes = new Set(
      options.allowedMimeTypes || [
        'application/pdf',
        'image/png',
        'image/jpeg',
        'image/webp',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // XLSX
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
        'text/csv',
        'application/json',
        'text/plain',
        'application/octet-stream',
      ]
    );

    this.ensureDirectoryExists(this.baseDirectory);
  }

  public getBaseDirectory(): string {
    return this.baseDirectory;
  }

  /**
   * Resolves a sanitized, canonical path for a company and relative subpath.
   * Throws PathTraversalError if any path traversal attempt is detected.
   */
  public resolveSafePath(tenantId: string, relativePath: string): { fullPath: string; sanitizedRelPath: string } {
    if (!tenantId || typeof tenantId !== 'string' || tenantId.trim() === '') {
      throw new Error('Tenant ID is required for storage operations.');
    }
    if (!relativePath || typeof relativePath !== 'string') {
      throw new Error('Relative path is required.');
    }

    // Check for null bytes or suspicious characters
    if (relativePath.includes('\0') || tenantId.includes('\0')) {
      throw new PathTraversalError('Prohibited null byte character detected in path.');
    }

    // Sanitize tenant ID (alphanumeric, underscore, dash)
    const sanitizedTenant = tenantId.replace(/[^a-zA-Z0-9_-]/g, '_');

    // Normalize path separators and remove leading slashes
    const normalized = path.normalize(relativePath).replace(/^[/\\]+/, '');

    // Check for path traversal segments
    const segments = normalized.split(/[/\\]/);
    if (segments.includes('..') || segments.includes('.')) {
      throw new PathTraversalError(`Prohibited path traversal sequence in path: '${relativePath}'`);
    }

    const tenantDir = path.join(this.baseDirectory, sanitizedTenant);
    const fullPath = path.resolve(tenantDir, normalized);

    // Verify canonical boundary
    if (!fullPath.startsWith(tenantDir)) {
      throw new PathTraversalError(`Escaping tenant directory boundary is forbidden: '${relativePath}'`);
    }

    return { fullPath, sanitizedRelPath: normalized };
  }

  public async saveDocument(
    tenantId: string,
    docPath: string,
    content: Buffer | Uint8Array,
    contentType = 'application/octet-stream'
  ): Promise<DocumentMetadata> {
    const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content);

    // Size limit check
    if (buffer.length > this.maxSizeBytes) {
      throw new Error(
        `File size (${buffer.length} bytes) exceeds the maximum allowed limit of ${this.maxSizeBytes} bytes.`
      );
    }

    // Resolve safe path
    const { fullPath, sanitizedRelPath } = this.resolveSafePath(tenantId, docPath);

    // Calculate sha256 checksum
    const hash = crypto.createHash('sha256').update(buffer).digest('hex');
    const checksum = `sha256:${hash}`;

    // Ensure parent directory exists
    const dir = path.dirname(fullPath);
    this.ensureDirectoryExists(dir);

    // Atomic write using a unique temporary file in the same directory, then rename
    const tempPath = `${fullPath}.${Date.now()}.${crypto.randomBytes(4).toString('hex')}.tmp`;
    await fs.promises.writeFile(tempPath, buffer);
    await fs.promises.rename(tempPath, fullPath);

    // Save metadata sidecar
    const now = new Date();
    const metadata: DocumentMetadata = {
      path: sanitizedRelPath,
      tenantId,
      sizeBytes: buffer.length,
      contentType,
      checksum,
      createdAt: now,
      updatedAt: now,
    };

    const metaPath = `${fullPath}.meta.json`;
    await fs.promises.writeFile(metaPath, JSON.stringify(metadata, null, 2), 'utf-8');

    logger.debug(`[LocalStorage] Saved document '${sanitizedRelPath}' for company '${tenantId}' (${buffer.length} bytes, ${checksum})`);
    return metadata;
  }

  public async readDocument(tenantId: string, docPath: string): Promise<{ content: Buffer; metadata: DocumentMetadata }> {
    const { fullPath, sanitizedRelPath } = this.resolveSafePath(tenantId, docPath);

    if (!fs.existsSync(fullPath)) {
      throw new FileNotFoundError(docPath, tenantId);
    }

    const content = await fs.promises.readFile(fullPath);
    const meta = await this.getMetadata(tenantId, docPath);

    // Verify integrity
    const hash = crypto.createHash('sha256').update(content).digest('hex');
    const computedChecksum = `sha256:${hash}`;

    if (meta && meta.checksum && meta.checksum !== computedChecksum) {
      logger.warn(`Checksum mismatch on reading '${sanitizedRelPath}': expected ${meta.checksum}, got ${computedChecksum}`);
    }

    const resolvedMeta: DocumentMetadata = meta || {
      path: sanitizedRelPath,
      tenantId,
      sizeBytes: content.length,
      contentType: 'application/octet-stream',
      checksum: computedChecksum,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return { content, metadata: resolvedMeta };
  }

  public async deleteDocument(tenantId: string, docPath: string): Promise<boolean> {
    const { fullPath, sanitizedRelPath } = this.resolveSafePath(tenantId, docPath);

    if (!fs.existsSync(fullPath)) {
      return false;
    }

    await fs.promises.unlink(fullPath);

    const metaPath = `${fullPath}.meta.json`;
    if (fs.existsSync(metaPath)) {
      try {
        await fs.promises.unlink(metaPath);
      } catch {
        // Ignore meta unlink error
      }
    }

    logger.debug(`[LocalStorage] Deleted document '${sanitizedRelPath}' for company '${tenantId}'`);
    return true;
  }

  public async exists(tenantId: string, docPath: string): Promise<boolean> {
    try {
      const { fullPath } = this.resolveSafePath(tenantId, docPath);
      return fs.existsSync(fullPath);
    } catch {
      return false;
    }
  }

  public async getMetadata(tenantId: string, docPath: string): Promise<DocumentMetadata | null> {
    try {
      const { fullPath, sanitizedRelPath } = this.resolveSafePath(tenantId, docPath);
      if (!fs.existsSync(fullPath)) return null;

      const metaPath = `${fullPath}.meta.json`;
      if (fs.existsSync(metaPath)) {
        const raw = await fs.promises.readFile(metaPath, 'utf-8');
        const parsed = JSON.parse(raw);
        return {
          path: sanitizedRelPath,
          tenantId,
          sizeBytes: parsed.sizeBytes,
          contentType: parsed.contentType,
          checksum: parsed.checksum,
          createdAt: new Date(parsed.createdAt),
          updatedAt: new Date(parsed.updatedAt),
        };
      }

      const stat = await fs.promises.stat(fullPath);
      const content = await fs.promises.readFile(fullPath);
      const hash = crypto.createHash('sha256').update(content).digest('hex');

      return {
        path: sanitizedRelPath,
        tenantId,
        sizeBytes: stat.size,
        contentType: 'application/octet-stream',
        checksum: `sha256:${hash}`,
        createdAt: stat.birthtime,
        updatedAt: stat.mtime,
      };
    } catch {
      return null;
    }
  }

  private ensureDirectoryExists(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}
