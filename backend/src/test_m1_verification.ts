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
} from './services/storage.service';
import { ENV, loadSavedOpenWAConfig, reloadEnvConfig } from './config/env';

async function runMilestone1Verification() {
  console.log('====================================================');
  console.log('  MILESTONE 1 VERIFICATION: STORAGE ENGINE CORE     ');
  console.log('====================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, details?: string) {
    totalTests++;
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passedTests++;
    } else {
      console.error(`❌ [FAIL] ${testName}${details ? ` -> ${details}` : ''}`);
      process.exitCode = 1;
    }
  }

  // TEST 1: Multi-Platform Persistent Directory Discovery
  console.log('\n--- TEST GROUP 1: Directory Resolution & Safety ---');
  const dirs = getPersistentDirs();
  console.log('Discovered persistent directories:', dirs);
  assert(dirs.length >= 3, 'getPersistentDirs returns at least 3 candidate persistent locations');
  const allResolved = dirs.every((d) => path.isAbsolute(d));
  assert(allResolved, 'All persistent directory paths are strictly absolute');
  const uniqueCheck = new Set(dirs).size === dirs.length;
  assert(uniqueCheck, 'Persistent directory paths are deduplicated');

  const testTempDir = path.join(os.tmpdir(), 'danmax_crm_test_ensure_' + Date.now());
  const ensured = ensureDir(testTempDir);
  assert(ensured && fs.existsSync(testTempDir), 'ensureDir safely creates directory');
  try {
    fs.rmdirSync(testTempDir);
  } catch {}

  // TEST 2: Completeness Scoring & Type Compatibility
  console.log('\n--- TEST GROUP 2: Completeness Scoring & Type Compatibility ---');
  const sparseObj = { tenant_demo_pizzeria: {} };
  const richObj = {
    tenant_demo_pizzeria: {
      categories: ['Ventas', 'Soporte', 'Facturación'],
      templates: [
        { id: '1', title: 'Bienvenida', content: 'Hola {nombre}, gracias por escribirnos.', variables: ['nombre'] },
        { id: '2', title: 'Promo Pizza', content: '2x1 en pizzas familiares hoy!', mediaUrl: 'https://img.png' },
      ],
      groupCategoryMap: { '12036302@g.us': 'Ventas', '12036303@g.us': 'Soporte' },
      hiddenGroupIds: ['12036399@g.us'],
    },
    tenant_client_acme: {
      categories: ['General'],
      templates: [{ id: '10', title: 'Info', content: 'Información general' }],
    },
  };

  const sparseScore = calculateCompletenessScore(sparseObj);
  const richScore = calculateCompletenessScore(richObj);
  console.log(`Sparse store score: ${sparseScore} | Rich store score: ${richScore}`);
  assert(richScore > sparseScore * 10, 'Rich CRM store scores significantly higher than sparse shell');

  assert(isTypeCompatible({}, {}), 'isTypeCompatible({}, {}) is true');
  assert(isTypeCompatible([], []), 'isTypeCompatible([], []) is true');
  assert(!isTypeCompatible({}, []), 'isTypeCompatible({}, []) is false');
  assert(!isTypeCompatible([], {}), 'isTypeCompatible([], {}) is false');
  assert(!isTypeCompatible(null, {}), 'isTypeCompatible(null, {}) is false');
  assert(!isTypeCompatible('string', {}), 'isTypeCompatible(string, {}) is false');

  const originalFallback = { defaultTenant: 'test' };
  const clonedFallback = deepClone(originalFallback);
  clonedFallback.defaultTenant = 'mutated';
  assert(originalFallback.defaultTenant === 'test', 'deepClone prevents mutation of fallback object');

  // TEST 3: Multi-Disk Atomic Write
  console.log('\n--- TEST GROUP 3: Multi-Disk Atomic Write ---');
  const testFileName = `test_m1_store_${Date.now()}.json`;
  PersistentStore.writeJSON(testFileName, richObj);

  const filePaths = PersistentStore.getFilePaths(testFileName);
  let writtenCount = 0;
  for (const fp of filePaths) {
    if (fs.existsSync(fp)) {
      writtenCount++;
      const content = JSON.parse(fs.readFileSync(fp, 'utf-8'));
      assert(
        content.tenant_demo_pizzeria.categories.length === 3,
        `File written accurately to ${fp}`
      );
    }
  }
  assert(writtenCount >= 2, `writeJSON concurrently wrote to multiple disk tiers (${writtenCount} locations)`);

  // Check no temp files left behind
  for (const d of dirs) {
    if (fs.existsSync(d)) {
      const files = fs.readdirSync(d);
      const tmpFiles = files.filter((f) => f.includes(testFileName) && f.includes('.tmp.'));
      assert(tmpFiles.length === 0, `No leftover .tmp files in ${d}`);
    }
  }

  // TEST 4: Read & Auto-Recovery / Backfill after Disk Deletion
  console.log('\n--- TEST GROUP 4: Auto-Recovery & Backfill on Missing Disk File ---');
  const existingFiles = filePaths.filter((fp) => fs.existsSync(fp));
  const fileToDelete = existingFiles[0];
  console.log(`Deleting disk replica at: ${fileToDelete}`);
  fs.unlinkSync(fileToDelete);
  assert(!fs.existsSync(fileToDelete), 'Disk replica successfully deleted for failover test');

  // readJSON should find surviving replicas, return richObj, and backfill the deleted file
  const recoveredData = PersistentStore.readJSON<typeof richObj>(testFileName, {} as any);
  assert(
    recoveredData.tenant_demo_pizzeria?.templates?.length === 2,
    'readJSON recovered full data from surviving disk locations'
  );
  assert(
    fs.existsSync(fileToDelete),
    'readJSON automatically backfilled and restored the missing disk file replica'
  );
  const restoredContent = JSON.parse(fs.readFileSync(fileToDelete, 'utf-8'));
  assert(
    restoredContent.tenant_demo_pizzeria.templates.length === 2,
    'Restored replica content matches original data 100%'
  );

  // TEST 5: Auto-Recovery & Repair on Corrupted File
  console.log('\n--- TEST GROUP 5: Auto-Recovery & Repair on Corrupted File ---');
  console.log(`Corrupting disk replica at: ${fileToDelete} with invalid JSON`);
  fs.writeFileSync(fileToDelete, '{"corrupted_data_syntax_error: [1, 2,', 'utf-8');

  const recoveredAfterCorruption = PersistentStore.readJSON<typeof richObj>(testFileName, {} as any);
  assert(
    recoveredAfterCorruption.tenant_demo_pizzeria?.templates?.length === 2,
    'readJSON recovered clean data despite corrupted disk replica'
  );
  const repairedContent = JSON.parse(fs.readFileSync(fileToDelete, 'utf-8'));
  assert(
    repairedContent.tenant_demo_pizzeria?.templates?.length === 2,
    'Corrupted disk replica was automatically repaired with valid data'
  );

  // TEST 6: Completeness Contest between Disks
  console.log('\n--- TEST GROUP 6: Completeness Contest & Superseding Outdated Store ---');
  const contestFileName = `test_m1_contest_${Date.now()}.json`;
  const sparseContest = { tenant_demo_pizzeria: { categories: ['Old Category'] } };
  const richContest = {
    tenant_demo_pizzeria: {
      categories: ['Cat 1', 'Cat 2', 'Cat 3', 'Cat 4'],
      templates: [{ id: '100', title: 'Promo Grande', content: 'Super promo' }],
    },
  };

  const candidatePaths = PersistentStore.getFilePaths(contestFileName);
  if (candidatePaths.length >= 2) {
    fs.writeFileSync(candidatePaths[0], JSON.stringify(sparseContest, null, 2), 'utf-8');
    fs.writeFileSync(candidatePaths[1], JSON.stringify(richContest, null, 2), 'utf-8');

    const winner = PersistentStore.readJSON<typeof richContest>(contestFileName, {} as any);
    assert(
      winner.tenant_demo_pizzeria.categories.length === 4,
      'readJSON chose the richer store (4 categories + template) over sparse store (1 category)'
    );

    // Verify candidatePaths[0] was backfilled with the winner
    const backfilledDisk0 = JSON.parse(fs.readFileSync(candidatePaths[0], 'utf-8'));
    assert(
      backfilledDisk0.tenant_demo_pizzeria.categories.length === 4,
      'Sparse disk location was upgraded and backfilled with the winning rich store'
    );
  }

  // TEST 7: Tenant Normalization & Admin Aliasing
  console.log('\n--- TEST GROUP 7: Tenant Normalization & Admin Aliasing ---');
  assert(CANONICAL_ADMIN_TENANT === 'tenant_demo_pizzeria', 'CANONICAL_ADMIN_TENANT is tenant_demo_pizzeria');
  const adminAliases = [
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
    undefined,
    null,
  ];

  for (const alias of adminAliases) {
    const normalized = normalizeTenantId(alias as any);
    assert(
      normalized === CANONICAL_ADMIN_TENANT,
      `normalizeTenantId('${alias}') resolves to '${CANONICAL_ADMIN_TENANT}'`
    );
  }

  assert(
    normalizeTenantId('tenant_client_123') === 'tenant_client_123',
    "normalizeTenantId('tenant_client_123') preserves client tenant partition"
  );
  assert(
    normalizeTenantId('Tenant-Client-456!') === 'tenant_client_456_',
    "normalizeTenantId cleans and sanitizes client tenant key"
  );

  // Test getTenantIdFromReq
  const reqWithHeader = { headers: { 'x-tenant-id': 'super_admin' }, query: {}, body: {} };
  assert(getTenantIdFromReq(reqWithHeader) === CANONICAL_ADMIN_TENANT, 'getTenantIdFromReq parses header and normalizes');

  const reqWithClientHeader = { headers: { 'x-tenant-id': 'tenant_acme_corp' }, query: {}, body: {} };
  assert(getTenantIdFromReq(reqWithClientHeader) === 'tenant_acme_corp', 'getTenantIdFromReq preserves client header');

  const reqWithQuery = { headers: {}, query: { sessionName: 'danmax_wa_owner' }, body: {} };
  assert(getTenantIdFromReq(reqWithQuery) === CANONICAL_ADMIN_TENANT, 'getTenantIdFromReq parses query sessionName and normalizes');

  const reqWithBody = { headers: {}, query: {}, body: { tenantId: 'tenant_custom_client' } };
  assert(getTenantIdFromReq(reqWithBody) === 'tenant_custom_client', 'getTenantIdFromReq parses body tenantId');

  // TEST 8: Persistent Config Boot & env.ts
  console.log('\n--- TEST GROUP 8: env.ts Persistent Config Boot & Reload ---');
  const testConfig = {
    openwaApiUrl: 'https://whatsapp-test-instance.agrolara.dedyn.io',
    openwaAdminKey: 'TestKeySecret999@',
    webhookPublicUrl: 'https://crm-test-webhook.agrolara.dedyn.io',
  };
  PersistentStore.writeJSON('openwa_config.json', testConfig);

  const loadedConfig = loadSavedOpenWAConfig();
  assert(loadedConfig.openwaApiUrl === testConfig.openwaApiUrl, 'loadSavedOpenWAConfig recovered openwaApiUrl');
  assert(loadedConfig.openwaAdminKey === testConfig.openwaAdminKey, 'loadSavedOpenWAConfig recovered openwaAdminKey');

  const reloadedEnv = reloadEnvConfig();
  assert(reloadedEnv.OPENWA_API_URL === testConfig.openwaApiUrl, 'reloadEnvConfig updated ENV.OPENWA_API_URL');
  assert(reloadedEnv.OPENWA_ADMIN_KEY === testConfig.openwaAdminKey, 'reloadEnvConfig updated ENV.OPENWA_ADMIN_KEY');
  assert(ENV.OPENWA_API_URL === testConfig.openwaApiUrl, 'ENV singleton reflects updated OpenWA URL');

  // Cleanup test files
  console.log('\n--- CLEANUP ---');
  for (const fp of PersistentStore.getFilePaths(testFileName)) {
    try {
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    } catch {}
  }
  for (const fp of PersistentStore.getFilePaths(contestFileName)) {
    try {
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    } catch {}
  }
  console.log('Temporary test files cleaned up successfully.');

  console.log('\n====================================================');
  console.log(`  VERIFICATION COMPLETE: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log('====================================================\n');

  if (passedTests === totalTests) {
    console.log('🎉 ALL MILESTONE 1 CHECKS PASSED PERFECTLY!');
  } else {
    throw new Error(`Verification failed: ${totalTests - passedTests} tests failed.`);
  }
}

runMilestone1Verification().catch((err) => {
  console.error('Fatal Verification Error:', err);
  process.exit(1);
});
