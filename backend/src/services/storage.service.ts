import fs from 'fs';
import path from 'path';
import os from 'os';
import { Request } from 'express';

// Multi-Location Persistent Disk Paths (Survives Docker container rebuilds and restarts)
const PERSISTENT_DIRS = [
  path.join(os.homedir(), '.danmax_crm_data'),
  '/tmp/danmax_crm_persistent_data',
  path.join(__dirname, '../../data'),
];

// Ensure all persistent directories exist
for (const dir of PERSISTENT_DIRS) {
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch (e) {}
}

const ADMIN_TENANT_ALIASES = new Set([
  'danmax_wa_owner',
  'super_admin',
  'tenant_demo_pizzeria',
  'global_whatsapp_line',
  'pizzeria',
  'default',
  'undefined',
  'null',
  '',
]);

export function normalizeTenantId(rawTenant?: string): string {
  if (!rawTenant || typeof rawTenant !== 'string') return 'tenant_demo_pizzeria';
  const clean = rawTenant.trim().toLowerCase().replace(/[^a-z0-9_]/gi, '_');
  if (ADMIN_TENANT_ALIASES.has(clean)) {
    return 'tenant_demo_pizzeria';
  }
  return clean;
}

export function getTenantIdFromReq(req: Request): string {
  const headerTenant = req.headers['x-tenant-id'] as string;
  if (headerTenant && headerTenant.trim()) {
    return normalizeTenantId(headerTenant);
  }
  const queryTenant = (req.query.tenantId || req.query.sessionName) as string;
  if (queryTenant && queryTenant.trim()) {
    return normalizeTenantId(queryTenant);
  }
  const bodyTenant = (req.body?.tenantId || req.body?.sessionName) as string;
  if (bodyTenant && bodyTenant.trim()) {
    return normalizeTenantId(bodyTenant);
  }
  return 'tenant_demo_pizzeria';
}

export class PersistentStore {
  public static readJSON<T>(filename: string, fallback: T): T {
    let bestData: T | null = null;
    let maxEntriesCount = -1;

    // Check all persistent locations to recover the most complete store file
    for (const dir of PERSISTENT_DIRS) {
      try {
        const filePath = path.join(dir, filename);
        if (fs.existsSync(filePath)) {
          const raw = fs.readFileSync(filePath, 'utf-8');
          const parsed = JSON.parse(raw) as T;

          // Estimate completeness by string length or keys count
          const entriesCount = raw.length;
          if (entriesCount > maxEntriesCount) {
            maxEntriesCount = entriesCount;
            bestData = parsed;
          }
        }
      } catch (err) {}
    }

    if (bestData !== null) {
      // Auto-backfill and sync best data across all persistent locations
      this.writeJSON(filename, bestData);
      return bestData;
    }

    return fallback;
  }

  public static writeJSON<T>(filename: string, data: T): void {
    // Write data to ALL persistent directories simultaneously
    for (const dir of PERSISTENT_DIRS) {
      try {
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        const filePath = path.join(dir, filename);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
      } catch (err) {}
    }
  }
}
