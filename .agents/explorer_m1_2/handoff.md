# Handoff Report: PersistentStore Completeness Scoring, Multi-Disk Candidate Comparison & Safe Backfill Architecture

**Agent**: Explorer 2 (Milestone 1)  
**Date**: 2026-08-14T04:55:00Z  
**Working Directory**: `c:\Users\Usuario\Documents\antigravity\CRM WHATSAPP\.agents\explorer_m1_2`  
**Target Milestone**: Milestone 1 — Storage Engine Core & Multi-Disk Fallback  

---

## 1. Observation

### 1.1 Current Baseline in `backend/src/services/storage.service.ts`
Direct inspection of `backend/src/services/storage.service.ts` (Lines 60–103) reveals the following baseline behavior:

```typescript
// Lines 60–89: Current readJSON implementation
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

// Lines 91–102: Current writeJSON implementation
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
```

### 1.2 Key Deficiencies and Vulnerabilities Observed
1. **Flawed Completeness Metric (`raw.length`)**:
   - `entriesCount = raw.length` is purely byte/character length. Formatted JSON with whitespace or trailing padded noise can outscore a compact, minified JSON store containing far more data records.
   - An empty multi-tenant shell `{ "tenant_1": {}, "tenant_2": {}, "tenant_3": {} }` formatted with 4-space indentation can easily have higher `raw.length` than an unformatted single-tenant store containing 50 rich templates and 20 group categories.
2. **Absence of Type Integrity & Corruption Filtering**:
   - If a file contains invalid JSON (e.g. truncated `{"tenant_demo": { "catego`), `JSON.parse` throws and is caught, but no logging or candidate diagnostic is preserved.
   - If a file parses to a primitive (e.g. `null`, `123`, `"error"`), when `fallback` is `{}` or `[]`, `readJSON` treats it as valid and can return an invalid type to callers, crashing downstream code (e.g. `allStores[cleanTenant]` throwing `TypeError: Cannot read properties of null`).
3. **Unchecked Universal Backfill on Every Read**:
   - `this.writeJSON(filename, bestData)` is executed synchronously on **every** read operation even when all disk locations already contain identical, 100% synchronized copies. This introduces unnecessary disk wear and write overhead on high-frequency read endpoints (`GET /api/groups`, `GET /api/templates`, `GET /api/kanban`).
4. **Risk of Infinite Write-Read Recursion**:
   - If `writeJSON` invokes audit logging, version tracking, file integrity verification, or hooks that call `readJSON`, an infinite synchronous loop occurs (`readJSON` -> `writeJSON` -> `readJSON` -> `writeJSON` -> Stack Overflow).
5. **Fallback Reference Leakage**:
   - Returning `fallback` directly without deep-cloning allows mutating callers (e.g. `allStores[cleanTenant] = ...`) to mutate the original fallback reference in memory.

---

## 2. Logic Chain

### 2.1 Multi-Disk Candidate Discovery & Evaluation Reasoning
- **Premise 1**: In containerized environments (Docker, Alpine, Coolify, Kubernetes), filesystem state can be wiped or mounted partially across `/tmp/danmax_crm_persistent_data`, `~/.danmax_crm_data`, and `./data`.
- **Premise 2**: A candidate store file is usable if and only if:
  1. The file exists and is readable.
  2. The file contains non-empty, valid JSON syntax that parses without error.
  3. The parsed data matches the expected structural type of `fallback` (Object, Array, or matching Primitive).
  4. The parsed data is not `null` or `undefined` (unless `fallback === null`).
- **Inference 1**: Any file that fails parsing, contains 0 bytes, or fails type compatibility must be discarded as a candidate with score `-1`.
- **Inference 2**: When comparing valid candidates across disk locations, we must evaluate the **deep structural density** of the data, not character length.

### 2.2 Deep Structural Completeness Scoring Logic
To accurately measure completeness across all DanMax CRM stores:
- **`groups_categories.json`**: Number of tenant keys, number of categories, number of mapped group IDs, number of hidden group IDs.
- **`templates_db.json`**: Number of tenant keys, number of categories, number of rich template objects, presence of populated template fields (title, content, variables, mediaUrl).
- **`kanban_store.json`**: Number of tenant keys, number of columns, number of lead cards, card property completeness.
- **`tenant_lines.json`**: Number of tenant keys, number of WhatsApp lines, line properties.
- **`openwa_config.json`**: Populated fields (`openwaApiUrl`, `openwaAdminKey`).

A hierarchical recursive structural scoring function:
$$\text{Score}(V) = \begin{cases}
0 & \text{if } V \text{ is null/undefined} \\
1 & \text{if } V \text{ is boolean} \\
2 & \text{if } V \text{ is number} \\
5 + \min(\text{length}(V), 500) & \text{if } V \text{ is string (non-empty)} \\
10 + 20 \cdot \text{length}(V) + \sum_{i=1}^n \text{Score}(V[i]) & \text{if } V \text{ is Array} \\
10 + 50 \cdot |Keys(V)| + \sum_{k \in Keys(V)} \text{Score}(V[k]) & \text{if } V \text{ is Object}
\end{cases}$$

- **Why this works**:
  - Each additional tenant bucket in a multi-tenant store adds $50 + \text{content score}$.
  - Each rich template, group mapping, or lead card adds $20 + \text{field scores}$ (typically $150 \sim 300$ points).
  - An empty shell `{ "t1": {}, "t2": {} }` scores $\approx 120$, whereas a single populated tenant with 10 templates scores $\approx 2,500$. The populated store decisively wins.

### 2.3 Anti-Recursion Logic
- **Premise 3**: To guarantee that auto-backfill never causes recursive loops:
  1. `PersistentStore` must maintain a static re-entrancy set `activeBackfills: Set<string>`.
  2. Auto-backfill must use a low-level, direct atomic write routine (`writeDirectAtomic`) rather than calling high-level `writeJSON`.
  3. `writeJSON` and `writeDirectAtomic` must never trigger `readJSON`.
  4. Auto-backfill must only write to locations where the file was **missing, corrupt, or had a strictly lower completeness score/content hash**.

---

## 3. Caveats

1. **Cross-Tenant Merging vs Best Store Selection**: The specification dictates selecting the most complete candidate store across disk locations and backfilling it to all replicas. It does not perform field-by-field union merging across conflicting outdated replicas, avoiding potential ghost/zombie entity resurrection.
2. **Platform Path Normalization**: `getPersistentDirs()` must include platform-aware paths:
   - Linux / Docker: `/root/.danmax_crm_data` (via `os.homedir()`), `/tmp/danmax_crm_persistent_data`, `./data`, `backend/data`.
   - Windows: `C:\Users\<User>\.danmax_crm_data`, `os.tmpdir()\danmax_crm_persistent_data`, `C:\tmp\danmax_crm_persistent_data`, `./data`.
3. **Atomic File Replacement on Windows**: Windows file locks can occasionally cause `fs.renameSync` to throw `EPERM` or `EBUSY` if an antivirus or reader holds the file descriptor. The atomic write engine must catch this and gracefully fallback to direct `fs.writeFileSync` with temp file cleanup.

---

## 4. Conclusion & Precise Implementation Specification

### 4.1 Candidate Evaluation & Scoring Algorithm (`storage.service.ts`)

```typescript
export interface CandidateInfo<T> {
  dir: string;
  filePath: string;
  raw: string;
  parsed: T;
  score: number;
  mtimeMs: number;
  sizeBytes: number;
}

/**
 * Calculates structural completeness score for any JSON-compatible entity.
 * Higher scores represent more populated, richer data structures.
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
    // Reward non-empty strings, cap length contribution so text size doesn't eclipse structure
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
      objScore += calculateCompletenessScore((val as Record<string, unknown>)[k], depth + 1);
    }
    return objScore;
  }

  return 0;
}

/**
 * Validates whether parsed JSON matches the expected shape of the fallback.
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
 * Performs a deep clone of fallback data to prevent caller mutations from altering default state.
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
```

### 4.2 Complete `PersistentStore` Class Specification

```typescript
export class PersistentStore {
  private static activeBackfills = new Set<string>();

  /**
   * Returns all candidate persistent file paths for a given store filename.
   */
  public static getFilePaths(filename: string): string[] {
    return getPersistentDirs().map((dir) => path.join(dir, filename));
  }

  /**
   * Reads and evaluates candidate JSON stores across all persistent disk tiers,
   * picks the most complete store, and automatically backfills missing/outdated locations.
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

    // 4. Identify outdated locations requiring backfill
    const dirsToBackfill: string[] = [...missingOrCorruptDirs];
    for (const candidate of validCandidates.slice(1)) {
      if (candidate.score < bestCandidate.score || candidate.raw !== bestCandidate.raw) {
        dirsToBackfill.push(candidate.dir);
      }
    }

    // 5. Safe selective backfill (guarded against re-entrancy)
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
   * Atomically writes data to ALL persistent disk locations simultaneously.
   */
  public static writeJSON<T>(filename: string, data: T): void {
    const dirs = getPersistentDirs();
    for (const dir of dirs) {
      this.writeDirectAtomic(dir, filename, data);
    }
  }

  /**
   * Low-level atomic write primitive using temporary files with POSIX rename and fallback.
   */
  private static writeDirectAtomic<T>(dir: string, filename: string, data: T): boolean {
    try {
      if (!ensureDir(dir)) return false;

      const targetPath = path.join(dir, filename);
      const tempPath = path.join(
        dir,
        `.${filename}.tmp.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}`
      );

      const jsonStr = JSON.stringify(data, null, 2);
      fs.writeFileSync(tempPath, jsonStr, 'utf-8');

      try {
        fs.renameSync(tempPath, targetPath);
      } catch (renameErr) {
        // Fallback for Windows locked files or cross-device links
        fs.writeFileSync(targetPath, jsonStr, 'utf-8');
        try {
          if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
        } catch {}
      }

      return true;
    } catch (err) {
      console.warn(`[PersistentStore] Write error for ${filename} at ${dir}:`, err);
      return false;
    }
  }
}
```

### 4.3 Directory Resolution Engine

```typescript
export function getPersistentDirs(): string[] {
  const candidates = [
    path.resolve(os.homedir(), '.danmax_crm_data'),
    path.resolve('/tmp/danmax_crm_persistent_data'),
    path.resolve(os.tmpdir(), 'danmax_crm_persistent_data'),
    path.resolve(process.cwd(), 'data'),
    path.resolve(__dirname, '../../data'),
    path.resolve(__dirname, '../../../data'),
  ];
  return Array.from(new Set(candidates));
}

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
```

---

## 5. Verification Method

### 5.1 Verification Checklist & Test Cases

| # | Test Scenario | Expected Outcome |
|---|---------------|------------------|
| **V1** | **All Dirs Empty** | `readJSON('test.json', { default: true })` returns `{ default: true }`. No corruption, no infinite loop. |
| **V2** | **Corrupt File in Dir A, Valid Store in Dir B** | Dir A has invalid JSON `{"bad"`. Dir B has valid store `{ "tenant": { "templates": [1,2,3] } }`. `readJSON` recovers Dir B and automatically overwrites Dir A with clean data. |
| **V3** | **Completeness Contest (Sparse vs Rich)** | Dir A has 1 category. Dir B has 10 categories + 50 rich templates. `readJSON` evaluates completeness score: Dir B wins ($>3,000$ vs $\approx 150$). Dir A is backfilled with Dir B's rich store. |
| **V4** | **Anti-Recursion Safety** | During backfill, multiple calls to `readJSON` within any hook or re-entrant cycle immediately return candidate without re-triggering recursive auto-sync. |
| **V5** | **Non-Object / Non-Array Fallbacks** | `readJSON('token.txt', 'default_token')` safely scores string length and returns valid string without crashing object key scanners. |
| **V6** | **Atomic Temp File Cleanup** | Interrupted or completed writes leave no leftover `.tmp.*` files on disk. |

### 5.2 Independent Node.js Verification Harness Command
```bash
cmd.exe /c "npx ts-node -e \"
const { PersistentStore } = require('./backend/src/services/storage.service');
const testData = { tenant_demo_pizzeria: { categories: ['Ventas', 'Promociones'], templates: [{ id: '1', title: 'Oferta' }] } };
PersistentStore.writeJSON('test_verify.json', testData);
const recovered = PersistentStore.readJSON('test_verify.json', {});
console.log('Recovery Test Passed:', recovered.tenant_demo_pizzeria.categories.length === 2);
\""
```
