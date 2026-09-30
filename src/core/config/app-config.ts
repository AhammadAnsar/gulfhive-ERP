/**
 * GulfHive ERP - Central Configuration Engine
 * Manages configuration for Desktop Offline, Self-Hosted On-Premise, and Cloud Hosted modes.
 */

export type DeploymentMode = 'DESKTOP_OFFLINE' | 'SELF_HOSTED_ON_PREMISE' | 'ONLINE_CLOUD_HOSTED';

export interface DatabaseConfig {
  readonly host: string;
  readonly user: string;
  readonly password?: string;
  readonly database: string;
  readonly adminUser?: string;
  readonly adminPassword?: string;
  readonly maxPoolSize: number;
  readonly connectionTimeoutMs: number;
}

export interface AppConfig {
  readonly appName: string;
  readonly deploymentMode: DeploymentMode;
  readonly appUrl: string;
  readonly isProduction: boolean;
  readonly defaultLanguage: 'en' | 'ar';
  readonly defaultCountry: string; // KW, SA, etc.
  readonly defaultCurrency: string; // KWD, SAR, etc.
  readonly database: DatabaseConfig;
}

export function loadAppConfig(): AppConfig {
  const deploymentModeEnv = process.env.DEPLOYMENT_MODE?.toUpperCase();
  let deploymentMode: DeploymentMode = 'ONLINE_CLOUD_HOSTED';

  if (deploymentModeEnv === 'DESKTOP_OFFLINE') {
    deploymentMode = 'DESKTOP_OFFLINE';
  } else if (deploymentModeEnv === 'SELF_HOSTED_ON_PREMISE') {
    deploymentMode = 'SELF_HOSTED_ON_PREMISE';
  }

  const isProduction = process.env.NODE_ENV === 'production';

  return {
    appName: 'GulfHive ERP',
    deploymentMode,
    appUrl: process.env.APP_URL || 'http://localhost:3000',
    isProduction,
    defaultLanguage: 'en',
    defaultCountry: process.env.DEFAULT_COUNTRY || 'KW',
    defaultCurrency: process.env.DEFAULT_CURRENCY || 'KWD',
    database: {
      host: process.env.SQL_HOST || '/cloudsql/map-data-491118:asia-southeast1:ai-studio-2a4207b7',
      user: process.env.SQL_USER || 'postgres',
      password: process.env.SQL_PASSWORD,
      database: process.env.SQL_DB_NAME || 'postgres',
      adminUser: process.env.SQL_ADMIN_USER || process.env.SQL_USER || 'postgres',
      adminPassword: process.env.SQL_ADMIN_PASSWORD || process.env.SQL_PASSWORD,
      maxPoolSize: 10,
      connectionTimeoutMs: 15000,
    },
  };
}

export const appConfig = loadAppConfig();
