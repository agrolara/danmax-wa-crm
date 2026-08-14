import fs from 'fs';
import path from 'path';
import os from 'os';
import { Request } from 'express';

export const CANONICAL_ADMIN_TENANT = 'tenant_demo_pizzeria';

/**
 * Multi-Platform Persistent Disk Directory Resolution
 * Aggregates user home, system temp, OS temp, and relative project directories.
 * Deduplicates and normalizes paths to survive container restarts and wipes.
 */
export function getPersistentDirs(): string[] {
  const isBackendCwd =
    process.cwd().endsWith('backend') ||
    process.cwd().endsWith('backend\\') ||
    process.cwd().endsWith('backend/');
  const rootDataDir = isBackendCwd ? path.resolve(process.cwd(), '../data') : path.resolve(process.cwd(), 'data');
  const backendDataDir = isBackendCwd ? path.resolve(process.cwd(), 'data') : path.resolve(process.cwd(), 'backend/data');

  const rawDirs = [
    path.resolve(os.homedir(), '.danmax_crm_data'),
    path.resolve('/tmp/danmax_crm_persistent_data'),
    path.resolve(os.tmpdir(), 'danmax_crm_persistent_data'),
    rootDataDir,
    backendDataDir,
    path.resolve(__dirname, '../../data'),
    path.resolve(__dirname, '../../../data'),
  ];

  const uniqueDirs = new Set<string>();
  for (const d of rawDirs) {
    try {
      uniqueDirs.add(path.resolve(d));
    } catch {
      uniqueDirs.add(d);
    }
  }

  return Array.from(uniqueDirs);
}

/**
 * Safely ensures that a directory exists, trapping permission or filesystem errors.
 */
export function ensureDir(dirPath: string): boolean {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    return true;
  } catch {
    return false;
  }
}

// Pre-initialize all persistent directory candidates
for (const dir of getPersistentDirs()) {
  ensureDir(dir);
}

const ADMIN_TENANT_ALIASES = new Set([
  'danmax_wa_owner',
  'super_admin',
  'tenant_demo_pizzeria',
  'global_whatsapp_line',
  'pizzeria',
  'default',
  'admin',
  'owner',
  'undefined',
  'null',
  '',
]);

/**
 * Normalizes any tenant identifier into its canonical partition key.
 * All admin/default session aliases resolve to CANONICAL_ADMIN_TENANT.
 */
export function normalizeTenantId(rawTenant?: string | null): string {
  if (!rawTenant || typeof rawTenant !== 'string') {
    return CANONICAL_ADMIN_TENANT;
  }
  const clean = rawTenant.trim().toLowerCase().replace(/[^a-z0-9_]/gi, '_');
  if (ADMIN_TENANT_ALIASES.has(clean)) {
    return CANONICAL_ADMIN_TENANT;
  }
  return clean;
}

/**
 * Hierarchically extracts and normalizes the tenant identifier from an Express Request.
 * Priority: Header (x-tenant-id) -> Query (tenantId, sessionName) -> Body (tenantId, sessionName) -> Fallback
 */
export function getTenantIdFromReq(req: Request | any): string {
  if (!req) return CANONICAL_ADMIN_TENANT;

  // 1. Header extraction
  const headerTenant = (req.headers && (req.headers['x-tenant-id'] || req.headers['X-Tenant-Id'])) as string;
  if (headerTenant && typeof headerTenant === 'string' && headerTenant.trim()) {
    return normalizeTenantId(headerTenant);
  }

  // 2. Query extraction
  const queryTenant = req.query && (req.query.tenantId || req.query.sessionName || req.query.tenant);
  if (queryTenant && typeof queryTenant === 'string' && queryTenant.trim()) {
    return normalizeTenantId(queryTenant);
  }

  // 3. Body extraction
  const bodyTenant = req.body && (req.body.tenantId || req.body.sessionName || req.body.tenant);
  if (bodyTenant && typeof bodyTenant === 'string' && bodyTenant.trim()) {
    return normalizeTenantId(bodyTenant);
  }

  return CANONICAL_ADMIN_TENANT;
}

/**
 * Recursively calculates the structural completeness score for any parsed JSON data.
 * Rewards deep object structures, non-empty arrays, templates, categories, and lead cards.
 */
export function calculateCompletenessScore(val: unknown, depth = 0): number {
  if (val === null || val === undefined || depth > 10) {
    return 0;
  }

  if (typeof val === 'boolean') {
    return 1;
  }

  if (typeof val === 'number') {
    return isNaN(val) ? 0 : 2;
  }

  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (trimmed.length === 0) return 0;
    // Reward non-empty strings, capped to prevent raw byte length from overriding structure
    return 5 + Math.min(trimmed.length, 500);
  }

  if (Array.isArray(val)) {
    let arrayScore = 10 + val.length * 20;
    for (const item of val) {
      arrayScore += calculateCompletenessScore(item, depth + 1);
    }
    return arrayScore;
  }

  if (typeof val === 'object') {
    const keys = Object.keys(val as Record<string, unknown>);
    let objScore = 10 + keys.length * 50;

    for (const k of keys) {
      const propVal = (val as Record<string, unknown>)[k];
      objScore += calculateCompletenessScore(propVal, depth + 1);

      // Domain-specific weighting for CRM structures
      if (propVal && typeof propVal === 'object') {
        const nested = propVal as Record<string, any>;
        if (Array.isArray(nested.templates)) objScore += nested.templates.length * 500;
        if (Array.isArray(nested.categories)) objScore += nested.categories.length * 100;
        if (Array.isArray(nested.lines)) objScore += nested.lines.length * 200;
        if (Array.isArray(nested.hiddenGroupIds)) objScore += nested.hiddenGroupIds.length * 50;
        if (nested.groupCategoryMap && typeof nested.groupCategoryMap === 'object') {
          objScore += Object.keys(nested.groupCategoryMap).length * 100;
        }
        if (Array.isArray(nested)) {
          // Kanban column cards
          for (const col of nested) {
            if (col && Array.isArray(col.leads)) {
              objScore += col.leads.length * 300;
            }
          }
        }
      }
    }
    return objScore;
  }

  return 0;
}

/**
 * Validates whether parsed JSON matches the expected structural type of fallback.
 */
export function isTypeCompatible(parsed: unknown, fallback: unknown): boolean {
  if (fallback === null || fallback === undefined) {
    return parsed !== undefined;
  }

  if (Array.isArray(fallback)) {
    return Array.isArray(parsed);
  }

  if (typeof fallback === 'object') {
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed);
  }

  return typeof parsed === typeof fallback;
}

/**
 * Performs a deep clone of data to prevent caller mutations from altering defaults.
 */
export function deepClone<T>(val: T): T {
  if (val === null || typeof val !== 'object') {
    return val;
  }
  try {
    return JSON.parse(JSON.stringify(val));
  } catch {
    return val;
  }
}

export interface CandidateInfo<T> {
  dir: string;
  filePath: string;
  raw: string;
  parsed: T;
  score: number;
  mtimeMs: number;
  sizeBytes: number;
}

export class PersistentStore {
  private static activeBackfills = new Set<string>();

  /**
   * Returns all resolved candidate file paths across all persistent directories for a given filename.
   */
  public static getFilePaths(filename: string): string[] {
    return getPersistentDirs().map((dir) => path.join(dir, filename));
  }

  /**
   * Reads JSON data across all persistent disk tiers, scores candidates by structural completeness,
   * picks the most complete candidate, and automatically backfills missing or outdated locations.
   */
  public static readJSON<T>(filename: string, fallback: T): T {
    const dirs = getPersistentDirs();
    const validCandidates: CandidateInfo<T>[] = [];
    const missingOrCorruptDirs: string[] = [];

    // 1. Inspect all persistent disk locations
    for (const dir of dirs) {
      const filePath = path.join(dir, filename);
      try {
        if (!fs.existsSync(filePath)) {
          missingOrCorruptDirs.push(dir);
          continue;
        }

        const raw = fs.readFileSync(filePath, 'utf-8');
        if (!raw || !raw.trim()) {
          missingOrCorruptDirs.push(dir);
          continue;
        }

        const parsed = JSON.parse(raw);
        if (!isTypeCompatible(parsed, fallback)) {
          missingOrCorruptDirs.push(dir);
          continue;
        }

        const stat = fs.statSync(filePath);
        const score = calculateCompletenessScore(parsed);

        validCandidates.push({
          dir,
          filePath,
          raw,
          parsed: parsed as T,
          score,
          mtimeMs: stat.mtimeMs || 0,
          sizeBytes: stat.size || 0,
        });
      } catch {
        missingOrCorruptDirs.push(dir);
      }
    }

    // 2. If no valid candidates exist, return cloned fallback
    if (validCandidates.length === 0) {
      return deepClone(fallback);
    }

    // 3. Sort candidates by completeness score DESC, then freshness (mtimeMs) DESC, then size DESC
    validCandidates.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      if (b.mtimeMs !== a.mtimeMs) {
        return b.mtimeMs - a.mtimeMs;
      }
      return b.sizeBytes - a.sizeBytes;
    });

    const bestCandidate = validCandidates[0];

    // 4. Identify outdated/missing locations requiring auto-backfill
    const dirsToBackfill: string[] = [...missingOrCorruptDirs];
    for (const candidate of validCandidates.slice(1)) {
      if (candidate.score < bestCandidate.score || candidate.raw !== bestCandidate.raw) {
        dirsToBackfill.push(candidate.dir);
      }
    }

    // 5. Safe selective auto-backfill (guarded against re-entrancy)
    if (dirsToBackfill.length > 0 && !this.activeBackfills.has(filename)) {
      this.activeBackfills.add(filename);
      try {
        for (const dir of dirsToBackfill) {
          this.writeDirectAtomic(dir, filename, bestCandidate.parsed);
        }
      } catch (err) {
        console.warn(`[PersistentStore] Auto-backfill warning for ${filename}:`, err);
      } finally {
        this.activeBackfills.delete(filename);
      }
    }

    return bestCandidate.parsed;
  }

  /**
   * Atomically writes JSON data across ALL persistent disk locations simultaneously.
   */
  public static writeJSON<T>(filename: string, data: T): void {
    const dirs = getPersistentDirs();
    for (const dir of dirs) {
      this.writeDirectAtomic(dir, filename, data);
    }
  }

  /**
   * Low-level atomic write primitive using temporary files with rename and Windows lock fallbacks.
   * Cleans up temporary files in all execution branches.
   */
  public static writeDirectAtomic<T>(dir: string, filename: string, data: T): boolean {
    if (!ensureDir(dir)) return false;

    const targetPath = path.join(dir, filename);
    const tempPath = path.join(
      dir,
      `.${filename}.tmp.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}`
    );

    let serialized: string;
    try {
      serialized = JSON.stringify(data, null, 2);
    } catch {
      return false;
    }

    try {
      // Step 1: Write to unique temp file on the same disk directory
      fs.writeFileSync(tempPath, serialized, 'utf-8');

      // Step 2: Atomic rename
      fs.renameSync(tempPath, targetPath);
      return true;
    } catch {
      // Step 3: Windows / File lock fallbacks (EPERM, EBUSY, EACCES)
      try {
        if (fs.existsSync(tempPath)) {
          fs.copyFileSync(tempPath, targetPath);
          try {
            fs.unlinkSync(tempPath);
          } catch {}
          return true;
        }
      } catch {
        // Direct write fallback as last resort
        try {
          fs.writeFileSync(targetPath, serialized, 'utf-8');
          return true;
        } catch {
          return false;
        }
      }
    } finally {
      // Step 4: Guaranteed temp file cleanup
      try {
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }
      } catch {}
    }

    return false;
  }
}
