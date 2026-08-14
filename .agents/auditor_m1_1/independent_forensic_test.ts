import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  PersistentStore,
  getPersistentDirs,
  ensureDir,
  calculateCompletenessScore,
  isTypeCompatible,
  deepClone,
  normalizeTenantId,
  getTenantIdFromReq,
  CANONICAL_ADMIN_TENANT,
} from '../../backend/src/services/storage.service';
import { ENV, loadSavedOpenWAConfig, reloadEnvConfig } from '../../backend/src/config/env';

async function runForensicAuditorAdversarialTests() {
  console.log('================================================================');
  console.log('   INDEPENDENT ADVERSARIAL FORENSIC AUDIT: STORAGE ENGINE CORE  ');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function auditAssert(cond: boolean, name: string, errDetail?: string) {
    if (cond) {
      console.log(`[AUDIT_PASS] ${name}`);
      passed++;
    } else {
      console.error(`[AUDIT_FAIL] ${name} ${errDetail ? `-> ${errDetail}` : ''}`);
      failed++;
    }
  }

  // 1. FORENSIC CHECK: Multi-Disk Discovery & Isolation
  const dirs = getPersistentDirs();
  console.log('Discovered directories:', dirs);
  auditAssert(dirs.length >= 3, 'Directory count >= 3');
  auditAssert(dirs.every(d => path.isAbsolute(d)), 'All directory paths absolute');
  auditAssert(new Set(dirs).size === dirs.length, 'No duplicate directory paths');

  // 2. FORENSIC CHECK: Completeness Calculation Edge Cases
  auditAssert(calculateCompletenessScore(null) === 0, 'Score null is 0');
  auditAssert(calculateCompletenessScore(undefined) === 0, 'Score undefined is 0');
  auditAssert(calculateCompletenessScore('') === 0, 'Score empty string is 0');
  auditAssert(calculateCompletenessScore('   ') === 0, 'Score whitespace string is 0');
  auditAssert(calculateCompletenessScore(NaN) === 0, 'Score NaN is 0');
  auditAssert(calculateCompletenessScore(true) === 1, 'Score boolean is 1');
  auditAssert(calculateCompletenessScore(123) === 2, 'Score number is 2');

  const objA = {
    tenant_demo_pizzeria: {
      categories: ['CatA'],
      templates: [{ id: '1', title: 'T1', content: 'C1' }],
    },
  };
  const objB = {
    tenant_demo_pizzeria: {
      categories: ['CatA', 'CatB', 'CatC'],
      templates: [
        { id: '1', title: 'T1', content: 'C1' },
        { id: '2', title: 'T2', content: 'C2' },
        { id: '3', title: 'T3', content: 'C3' },
      ],
      groupCategoryMap: { g1: 'CatA', g2: 'CatB' },
      lines: [{ lineId: 'L1' }],
    },
  };
  const scoreA = calculateCompletenessScore(objA);
  const scoreB = calculateCompletenessScore(objB);
  console.log(`objA score: ${scoreA}, objB score: ${scoreB}`);
  auditAssert(scoreB > scoreA * 3, 'Rich store B decisively outweighs store A');

  // 3. FORENSIC CHECK: Atomic Write with Chaos File Operations
  const chaosTestFile = `forensic_audit_store_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.json`;
  PersistentStore.writeJSON(chaosTestFile, objB);

  const candidatePaths = PersistentStore.getFilePaths(chaosTestFile);
  auditAssert(candidatePaths.length === dirs.length, 'Candidate paths match persistent dirs count');

  let writtenCount = 0;
  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      writtenCount++;
      const readBack = JSON.parse(fs.readFileSync(p, 'utf-8'));
      auditAssert(
        readBack.tenant_demo_pizzeria.categories.length === 3,
        `Integrity of written JSON on disk: ${p}`
      );
    }
  }
  auditAssert(writtenCount >= 2, `Written to at least 2 valid disk directories (Actual: ${writtenCount})`);

  // 4. ADVERSARIAL STRESS: Delete 2 replicas, Corrupt 1 replica, Leave 1 intact
  const availablePaths = candidatePaths.filter(p => fs.existsSync(p));
  auditAssert(availablePaths.length >= 3, 'At least 3 valid files available for chaos test');

  const deletedPath1 = availablePaths[0];
  const deletedPath2 = availablePaths[1];
  const corruptedPath = availablePaths[2];

  fs.unlinkSync(deletedPath1);
  fs.unlinkSync(deletedPath2);
  fs.writeFileSync(corruptedPath, '{"corrupted": true, broken JSON payload :::');

  auditAssert(!fs.existsSync(deletedPath1), 'Replica 1 successfully deleted');
  auditAssert(!fs.existsSync(deletedPath2), 'Replica 2 successfully deleted');

  // Read JSON -> should recover objB and backfill ALL 3 missing/corrupted files
  const recovered = PersistentStore.readJSON<typeof objB>(chaosTestFile, {} as any);
  auditAssert(recovered.tenant_demo_pizzeria?.templates?.length === 3, 'Recovered exact data from remaining disk replicas');

  auditAssert(fs.existsSync(deletedPath1), 'Replica 1 was auto-backfilled');
  auditAssert(fs.existsSync(deletedPath2), 'Replica 2 was auto-backfilled');
  
  const contentCorruptFixed = JSON.parse(fs.readFileSync(corruptedPath, 'utf-8'));
  auditAssert(contentCorruptFixed.tenant_demo_pizzeria.templates.length === 3, 'Corrupted replica was repaired and backfilled');

  // 5. ADVERSARIAL STRESS: Completeness Hierarchy (Lesser store on disk vs richer store on another disk)
  const duelFileName = `forensic_duel_${Date.now()}.json`;
  const duelPaths = PersistentStore.getFilePaths(duelFileName);
  
  if (duelPaths.length >= 2) {
    // Write objA (small) to disk 0
    fs.writeFileSync(duelPaths[0], JSON.stringify(objA, null, 2), 'utf-8');
    // Write objB (rich) to disk 1
    fs.writeFileSync(duelPaths[1], JSON.stringify(objB, null, 2), 'utf-8');

    const duelResult = PersistentStore.readJSON<typeof objB>(duelFileName, {} as any);
    auditAssert(duelResult.tenant_demo_pizzeria.categories.length === 3, 'Completeness contest chose richer store');

    // Verify disk 0 was upgraded to objB
    const disk0Content = JSON.parse(fs.readFileSync(duelPaths[0], 'utf-8'));
    auditAssert(disk0Content.tenant_demo_pizzeria.categories.length === 3, 'Lower-scored disk 0 was upgraded to richer store B');
  }

  // 6. FORENSIC CHECK: Tenant Normalization Rigor
  const testAliases = [
    'danmax_wa_owner',
    'DANMAX_WA_OWNER',
    '  super_admin  ',
    'tenant_demo_pizzeria',
    'GLOBAL_WHATSAPP_LINE',
    'pizzeria',
    'default',
    'admin',
    'owner',
    'undefined',
    'null',
    '',
    null,
    undefined,
  ];

  for (const alias of testAliases) {
    const norm = normalizeTenantId(alias as any);
    auditAssert(norm === CANONICAL_ADMIN_TENANT, `Alias '${alias}' normalized to '${CANONICAL_ADMIN_TENANT}'`);
  }

  auditAssert(normalizeTenantId('tenant_client_alpha') === 'tenant_client_alpha', 'Client tenant alpha preserved');
  auditAssert(normalizeTenantId('Tenant Client Beta!#$') === 'tenant_client_beta___', 'Client tenant sanitized');

  // 7. FORENSIC CHECK: Request Tenant Hierarchy
  auditAssert(
    getTenantIdFromReq({ headers: { 'x-tenant-id': 'danmax_wa_owner' }, query: {}, body: {} }) === CANONICAL_ADMIN_TENANT,
    'getTenantIdFromReq header alias resolution'
  );
  auditAssert(
    getTenantIdFromReq({ headers: { 'x-tenant-id': 'tenant_client_zeta' }, query: {}, body: {} }) === 'tenant_client_zeta',
    'getTenantIdFromReq client header preservation'
  );
  auditAssert(
    getTenantIdFromReq({ headers: {}, query: { sessionName: 'tenant_custom_1' }, body: {} }) === 'tenant_custom_1',
    'getTenantIdFromReq query extraction'
  );
  auditAssert(
    getTenantIdFromReq({ headers: {}, query: {}, body: { tenantId: 'tenant_custom_2' } }) === 'tenant_custom_2',
    'getTenantIdFromReq body extraction'
  );
  auditAssert(
    getTenantIdFromReq(null) === CANONICAL_ADMIN_TENANT,
    'getTenantIdFromReq null request fallback'
  );

  // 8. FORENSIC CHECK: Config persistence and dynamic reload
  const customConfig = {
    openwaApiUrl: 'https://wa-custom.agrolara.dedyn.io',
    openwaAdminKey: 'SecretKeyCustom_456!',
    webhookPublicUrl: 'https://webhook-custom.agrolara.dedyn.io',
  };
  PersistentStore.writeJSON('openwa_config.json', customConfig);

  const loadedConf = loadSavedOpenWAConfig();
  auditAssert(loadedConf.openwaApiUrl === customConfig.openwaApiUrl, 'loadSavedOpenWAConfig retrieved custom URL');
  auditAssert(loadedConf.openwaAdminKey === customConfig.openwaAdminKey, 'loadSavedOpenWAConfig retrieved custom key');

  const reloaded = reloadEnvConfig();
  auditAssert(reloaded.OPENWA_API_URL === customConfig.openwaApiUrl, 'reloadEnvConfig reflected in return value');
  auditAssert(ENV.OPENWA_API_URL === customConfig.openwaApiUrl, 'reloadEnvConfig reflected in ENV singleton');

  // Cleanup test files
  for (const p of PersistentStore.getFilePaths(chaosTestFile)) {
    try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch {}
  }
  for (const p of PersistentStore.getFilePaths(duelFileName)) {
    try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch {}
  }

  console.log('\n================================================================');
  console.log(`   FORENSIC AUDIT RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    throw new Error(`Forensic audit failed with ${failed} failure(s).`);
  }
}

runForensicAuditorAdversarialTests().catch(err => {
  console.error('Forensic Audit Execution Error:', err);
  process.exit(1);
});
