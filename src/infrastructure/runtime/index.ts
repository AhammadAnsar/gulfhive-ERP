/**
 * GulfHive ERP - Runtime Environment Selector
 */

import { IRuntimeAdapter } from './runtime-context.ts';
import { DesktopRuntimeAdapter } from './desktop-runtime.ts';
import { HostedRuntimeAdapter } from './hosted-runtime.ts';
import { appConfig } from '../../core/config/app-config.ts';

export function getRuntimeAdapter(): IRuntimeAdapter {
  if (appConfig.deploymentMode === 'DESKTOP_OFFLINE') {
    return new DesktopRuntimeAdapter();
  }
  return new HostedRuntimeAdapter();
}

export const currentRuntime = getRuntimeAdapter();
