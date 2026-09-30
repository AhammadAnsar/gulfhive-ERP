import { describe, it, expect } from 'vitest';
import { DesktopRuntimeAdapter } from '../src/infrastructure/runtime/desktop-runtime.ts';
import { HostedRuntimeAdapter } from '../src/infrastructure/runtime/hosted-runtime.ts';

describe('Runtime Target Abstraction', () => {
  it('should configure desktop offline capabilities with local backup', async () => {
    const desktop = new DesktopRuntimeAdapter();
    expect(desktop.mode).toBe('DESKTOP_OFFLINE');
    expect(desktop.isOfflineCapable).toBe(true);

    const backup = await desktop.backupService.createBackup();
    expect(backup.backupId).toBeDefined();
    expect(backup.schemaVersion).toBeGreaterThan(0);

    const diag = await desktop.getSystemDiagnostics();
    expect(diag.status).toBe('HEALTHY');
    expect(diag.database.connected).toBe(true);
  });

  it('should configure hosted cloud runtime with automated cloud persistence', async () => {
    const hosted = new HostedRuntimeAdapter();
    expect(hosted.mode).toBe('ONLINE_CLOUD_HOSTED');
    expect(hosted.isOfflineCapable).toBe(false);

    const diag = await hosted.getSystemDiagnostics();
    expect(diag.runtimeMode).toBe('ONLINE_CLOUD_HOSTED');
    expect(diag.database.connected).toBe(true);
  });
});
