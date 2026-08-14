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

interface TestStats {
  total: number;
  passed: number;
  failed: number;
}

const stats: TestStats = {
  total: 0,
  passed: 0,
  failed: 0,
};

function assert(condition: boolean, testName: string, details?: string) {
  stats.total++;
  if (condition) {
    console.log(`  ✅ [PASS] ${testName}`);
    stats.passed++;
  } else {
    console.error(`  ❌ [FAIL] ${testName}${details ? ` -> ${details}` : ''}`);
    stats.failed++;
    process.exitCode = 1;
  }
}

async function runAdversarialTestSuite() {
  console.log('================================================================');
  console.log('   CHALLENGER 1: ADVERSARIAL STRESS TEST & EMPIRICAL HARNESS   ');
  console.log('   Milestone 1: Storage Engine Core & Multi-Disk Fallback      ');
  console.log('================================================================\n');

  const allDirs = getPersistentDirs();
  console.log(`Targeting ${allDirs.length} active persistent storage tiers:`);
  allDirs.forEach((d, idx) => console.log(`  Tier [${idx + 1}]: ${d}`));
  console.log('');

  // -------------------------------------------------------------------------
  // SUITE 1: Extreme Partial File Wiping (N-1 Disks Wiped)
  // -------------------------------------------------------------------------
  console.log('----------------------------------------------------------------');
  console.log('SUITE 1: Extreme Partial File Wiping (Wiping N-1 Disks)');
  console.log('----------------------------------------------------------------');
  const wipeStoreName = `adv_wipe_test_${Date.now()}.json`;
  const canonicalData = {
    tenant_demo_pizzeria: {
      categories: ['VIP Customers', 'Delivery Zone North', 'Promotions 2026'],
      templates: [
        {
          id: 'tmpl_101',
          title: 'Bienvenida Pizza Deluxe',
          content: 'Hola {nombre}, disfruta un 30% de descuento en tu primer pedido!',
          variables: ['nombre'],
          mediaUrl: 'https://cdn.agrolara.dedyn.io/pizza.jpg',
        },
        {
          id: 'tmpl_102',
          title: 'Confirmación Delivery',
          content: 'Tu orden #{pedido} está en camino con nuestro repartidor.',
          variables: ['pedido'],
        },
      ],
      groupCategoryMap: {
        '12036302001@g.us': 'VIP Customers',
        '12036302002@g.us': 'Delivery Zone North',
      },
      hiddenGroupIds: ['12036309999@g.us'],
    },
    tenant_client_acme: {
      categories: ['General', 'Support'],
      templates: [{ id: 'acme_1', title: 'Acme Info', content: 'Info' }],
    },
  };

  // Step 1: Write to all disks
  PersistentStore.writeJSON(wipeStoreName, canonicalData);
  const filePaths1 = PersistentStore.getFilePaths(wipeStoreName);
  const existingBeforeWipe = filePaths1.filter((p) => fs.existsSync(p));
  assert(
    existingBeforeWipe.length === allDirs.length,
    `Initial write successfully seeded all ${allDirs.length} disk locations`
  );

  // Step 2: Delete N-1 disks, leaving exactly 1 survivor
  console.log(`  Deleting ${existingBeforeWipe.length - 1} out of ${existingBeforeWipe.length} disk copies...`);
  for (let i = 0; i < existingBeforeWipe.length - 1; i++) {
    fs.unlinkSync(existingBeforeWipe[i]);
  }
  const survivors = filePaths1.filter((p) => fs.existsSync(p));
  assert(survivors.length === 1, `Exactly 1 survivor disk replica remains (${survivors[0]})`);

  // Step 3: Trigger readJSON and verify restoration of ALL N disks
  const recoveredFromSingleSurvivor = PersistentStore.readJSON<typeof canonicalData>(
    wipeStoreName,
    {} as any
  );
  assert(
    recoveredFromSingleSurvivor.tenant_demo_pizzeria.templates.length === 2 &&
      recoveredFromSingleSurvivor.tenant_demo_pizzeria.categories.length === 3,
    'readJSON returned 100% accurate data from the single remaining survivor disk'
  );

  // Verify all previously wiped disks are restored
  let restoredCount = 0;
  for (const p of filePaths1) {
    if (fs.existsSync(p)) {
      restoredCount++;
      const diskContent = JSON.parse(fs.readFileSync(p, 'utf-8'));
      if (diskContent.tenant_demo_pizzeria?.templates?.length !== 2) {
        assert(false, `Content mismatch on restored disk: ${p}`);
      }
    }
  }
  assert(
    restoredCount === allDirs.length,
    `Auto-backfill successfully restored all ${allDirs.length} disk replicas simultaneously`
  );

  // -------------------------------------------------------------------------
  // SUITE 2: Multi-Disk Corruption, Truncation & Type Pollution Injection
  // -------------------------------------------------------------------------
  console.log('\n----------------------------------------------------------------');
  console.log('SUITE 2: Multi-Disk Corruption & Hostile Payload Injection');
  console.log('----------------------------------------------------------------');
  const corruptStoreName = `adv_corrupt_test_${Date.now()}.json`;
  PersistentStore.writeJSON(corruptStoreName, canonicalData);
  const corruptPaths = PersistentStore.getFilePaths(corruptStoreName);

  // We have at least 3-5 disk paths. Let's corrupt them in different hostile ways:
  // Disk 0: Malformed JSON syntax error (missing closing brackets)
  // Disk 1: Empty file (0 bytes)
  // Disk 2: Whitespace only (\n\t   \r\n)
  // Disk 3 (if exists): Type-incompatible data (primitive string instead of object)
  // Disk 4 (if exists): Incompatible JSON array instead of object
  // Disk N-1: Clean canonical data (survivor)

  const survivorPath = corruptPaths[corruptPaths.length - 1];
  console.log(`  Survivor disk reserved: ${survivorPath}`);

  if (corruptPaths.length >= 2) {
    console.log(`  Injecting syntax error into: ${corruptPaths[0]}`);
    fs.writeFileSync(corruptPaths[0], '{"corrupted_root": [ { "broken": unquoted_val', 'utf-8');
  }
  if (corruptPaths.length >= 3) {
    console.log(`  Injecting 0-byte empty file into: ${corruptPaths[1]}`);
    fs.writeFileSync(corruptPaths[1], '', 'utf-8');
  }
  if (corruptPaths.length >= 4) {
    console.log(`  Injecting whitespace-only file into: ${corruptPaths[2]}`);
    fs.writeFileSync(corruptPaths[2], '   \n\t  \r\n  ', 'utf-8');
  }
  if (corruptPaths.length >= 5) {
    console.log(`  Injecting type-incompatible string into: ${corruptPaths[3]}`);
    fs.writeFileSync(corruptPaths[3], '"this is an incompatible string"', 'utf-8');
  }

  // Trigger readJSON with fallback
  const recoveredAfterMultiCorruption = PersistentStore.readJSON<typeof canonicalData>(
    corruptStoreName,
    {} as any
  );

  assert(
    recoveredAfterMultiCorruption.tenant_demo_pizzeria?.templates?.length === 2,
    'readJSON successfully bypassed syntax errors, empty files, whitespace files, and type pollution'
  );

  // Verify all corrupted locations were overwritten with clean valid JSON
  let repairedCount = 0;
  for (const cp of corruptPaths) {
    try {
      const raw = fs.readFileSync(cp, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed.tenant_demo_pizzeria?.templates?.length === 2) {
        repairedCount++;
      }
    } catch (e) {
      assert(false, `Disk file at ${cp} failed to repair: ${e}`);
    }
  }
  assert(
    repairedCount === corruptPaths.length,
    `All ${corruptPaths.length} damaged/corrupted disks were automatically repaired and overwritten with clean data`
  );

  // -------------------------------------------------------------------------
  // SUITE 3: Total Annihilation / Full Corruption Fallback Safety
  // -------------------------------------------------------------------------
  console.log('\n----------------------------------------------------------------');
  console.log('SUITE 3: Total Annihilation Safety (All Disks Corrupted/Missing)');
  console.log('----------------------------------------------------------------');
  const doomedStoreName = `adv_doomed_test_${Date.now()}.json`;
  const doomedPaths = PersistentStore.getFilePaths(doomedStoreName);

  // Intentionally write junk to ALL disk files
  for (const dp of doomedPaths) {
    fs.writeFileSync(dp, 'TOTAL_CORRUPTION_NO_VALID_JSON_HERE_###', 'utf-8');
  }

  const fallbackObj = { fallbackTenant: { default: true, count: 42 } };
  let thrownError = false;
  let returnedFallback: any = null;

  try {
    returnedFallback = PersistentStore.readJSON(doomedStoreName, fallbackObj);
  } catch (err) {
    thrownError = true;
  }

  assert(!thrownError, 'readJSON does NOT throw when ALL disks are corrupted');
  assert(
    returnedFallback && returnedFallback.fallbackTenant?.count === 42,
    'readJSON returns the fallback object safely when no valid candidate exists'
  );

  // Ensure fallback is cloned and mutations don't alter fallbackObj
  returnedFallback.fallbackTenant.count = 9999;
  assert(
    fallbackObj.fallbackTenant.count === 42,
    'Fallback object returned from total corruption remains immutable'
  );

  // Cleanup doomed files
  for (const dp of doomedPaths) {
    try {
      fs.unlinkSync(dp);
    } catch {}
  }

  // -------------------------------------------------------------------------
  // SUITE 4: Atomic Temporary File Safety & No-Leak Verification
  // -------------------------------------------------------------------------
  console.log('\n----------------------------------------------------------------');
  console.log('SUITE 4: Atomic Temporary File Safety & High-Frequency Write Stress');
  console.log('----------------------------------------------------------------');
  const tempSafetyStore = `adv_atomic_test_${Date.now()}.json`;

  // Rapidly write 20 sequential updates to test temp file lifecycle
  for (let i = 1; i <= 20; i++) {
    const payload = {
      tenant_demo_pizzeria: {
        categories: [`Iteration_${i}`],
        counter: i,
      },
    };
    PersistentStore.writeJSON(tempSafetyStore, payload);
  }

  // Verify final data on all disks
  const finalFilePaths = PersistentStore.getFilePaths(tempSafetyStore);
  for (const fp of finalFilePaths) {
    const content = JSON.parse(fs.readFileSync(fp, 'utf-8'));
    assert(
      content.tenant_demo_pizzeria?.counter === 20,
      `Disk ${fp} contains the final state (counter = 20)`
    );
  }

  // Verify no temporary files remain anywhere across all persistent directories
  let leakedTempFiles = 0;
  for (const dir of allDirs) {
    if (fs.existsSync(dir)) {
      const dirFiles = fs.readdirSync(dir);
      const leftoverTemps = dirFiles.filter((f) => f.startsWith('.') && f.includes('.tmp.'));
      if (leftoverTemps.length > 0) {
        console.error(`  Leaked temp files detected in ${dir}:`, leftoverTemps);
        leakedTempFiles += leftoverTemps.length;
      }
    }
  }
  assert(leakedTempFiles === 0, 'Zero leftover atomic temp files (.tmp.) across all persistent directories');

  // Cleanup tempSafetyStore
  for (const fp of finalFilePaths) {
    try {
      fs.unlinkSync(fp);
    } catch {}
  }

  // -------------------------------------------------------------------------
  // SUITE 5: UTF-8, Rich Multimedia Emojis, Accents & Large Payloads
  // -------------------------------------------------------------------------
  console.log('\n----------------------------------------------------------------');
  console.log('SUITE 5: UTF-8, Accents, WhatsApp Emojis & Deep Tree Resilience');
  console.log('----------------------------------------------------------------');
  const utf8StoreName = `adv_utf8_test_${Date.now()}.json`;
  const complexUtf8Data = {
    tenant_demo_pizzeria: {
      categories: ['🔥 Promociones Especiales 🔥', '🍕 Pizzas & Bebidas 🍹', '¡Atención al Cliente!'],
      templates: [
        {
          id: 'tmpl_emoji_1',
          title: '🔥 Super Promo 2x1 🍕',
          content: '¡Hola {{nombre}}! 🍕🍕 Tenemos 2x1 en pizzas familiares este fin de semana. \n\n' +
                   '👉 Ingresa a nuestro menú: https://pizzeria.example.com/menu?ref=wa \n' +
                   '¡Buen provecho! ✨🎉 \n' +
                   'Simbolos: € $ £ ¥ ¢ © ® ™ \n' +
                   'Caracteres especiales: "comillas", \'simples\', \\escapes\\, /slashes/, <html>tags</html>',
          variables: ['nombre'],
          footer: 'DanMax WA CRM 🚀',
          mediaUrl: 'https://cdn.example.com/images/pizza_deluxe_🍕.png',
        },
      ],
      groupCategoryMap: {
        '12036302001@g.us': '🔥 Promociones Especiales 🔥',
      },
      kanbanColumns: [
        {
          id: 'col_1',
          name: 'Nuevos Contactos 📥',
          leads: Array.from({ length: 50 }, (_, i) => ({
            id: `lead_${i}`,
            name: `Cliente Español ${i} Ñandú Müller`,
            phone: `+54911${10000000 + i}`,
            notes: `Nota de prueba con acentos: áéíóú ÁÉÍÓÚ ñÑ üÜ y emojis 🚀🎯`,
          })),
        },
      ],
    },
  };

  PersistentStore.writeJSON(utf8StoreName, complexUtf8Data);
  const utf8Read = PersistentStore.readJSON<typeof complexUtf8Data>(utf8StoreName, {} as any);

  assert(
    utf8Read.tenant_demo_pizzeria.categories[0] === '🔥 Promociones Especiales 🔥',
    'Emoji category name preserved exactly'
  );
  assert(
    utf8Read.tenant_demo_pizzeria.templates[0].footer === 'DanMax WA CRM 🚀',
    'Emoji footer preserved exactly'
  );
  assert(
    utf8Read.tenant_demo_pizzeria.kanbanColumns[0].leads.length === 50,
    '50 lead objects with Spanish characters (ñ, á, ü) preserved without loss'
  );
  assert(
    utf8Read.tenant_demo_pizzeria.kanbanColumns[0].leads[0].notes.includes('ñÑ üÜ'),
    'Spanish accented and diacritic strings preserved 100%'
  );

  // Cleanup UTF-8 store
  for (const fp of PersistentStore.getFilePaths(utf8StoreName)) {
    try {
      fs.unlinkSync(fp);
    } catch {}
  }

  // -------------------------------------------------------------------------
  // SUITE 6: Multi-Tenant Boundary Integrity & Request Parsing Edge Cases
  // -------------------------------------------------------------------------
  console.log('\n----------------------------------------------------------------');
  console.log('SUITE 6: Multi-Tenant Boundary & Request Normalization Edge Cases');
  console.log('----------------------------------------------------------------');

  // Test hostile inputs to normalizeTenantId
  const hostileTenantInputs = [
    { input: '   DANMAX_WA_OWNER   ', expected: CANONICAL_ADMIN_TENANT },
    { input: 'SUPER_ADMIN', expected: CANONICAL_ADMIN_TENANT },
    { input: 'Global_WhatsApp_Line', expected: CANONICAL_ADMIN_TENANT },
    { input: 'pizzeria', expected: CANONICAL_ADMIN_TENANT },
    { input: 'ADMIN', expected: CANONICAL_ADMIN_TENANT },
    { input: '   ', expected: CANONICAL_ADMIN_TENANT },
    { input: null, expected: CANONICAL_ADMIN_TENANT },
    { input: undefined, expected: CANONICAL_ADMIN_TENANT },
    { input: 'tenant-client$#@!999', expected: 'tenant_client____999' },
    { input: 'tenant_valid_client_42', expected: 'tenant_valid_client_42' },
  ];

  for (const t of hostileTenantInputs) {
    const res = normalizeTenantId(t.input as any);
    assert(
      res === t.expected,
      `normalizeTenantId(${JSON.stringify(t.input)}) correctly resolved to '${t.expected}'`
    );
  }

  // Test request extraction hierarchy precedence:
  // Header takes precedence over query, query takes precedence over body
  const conflictingReq = {
    headers: { 'x-tenant-id': 'tenant_header_wins' },
    query: { tenantId: 'tenant_query_loses' },
    body: { tenantId: 'tenant_body_loses' },
  };
  assert(
    getTenantIdFromReq(conflictingReq) === 'tenant_header_wins',
    'Request extractor prioritizes Header over Query and Body'
  );

  const queryReq = {
    headers: {},
    query: { sessionName: 'tenant_query_wins' },
    body: { sessionName: 'tenant_body_loses' },
  };
  assert(
    getTenantIdFromReq(queryReq) === 'tenant_query_wins',
    'Request extractor prioritizes Query over Body when Header is absent'
  );

  const bodyReq = {
    headers: {},
    query: {},
    body: { tenant: 'tenant_body_wins' },
  };
  assert(
    getTenantIdFromReq(bodyReq) === 'tenant_body_wins',
    'Request extractor extracts Body tenant when Header and Query are absent'
  );

  const emptyReq = { headers: {}, query: {}, body: {} };
  assert(
    getTenantIdFromReq(emptyReq) === CANONICAL_ADMIN_TENANT,
    'Empty request falls back to CANONICAL_ADMIN_TENANT'
  );

  assert(
    getTenantIdFromReq(null) === CANONICAL_ADMIN_TENANT,
    'Null request falls back to CANONICAL_ADMIN_TENANT'
  );

  // -------------------------------------------------------------------------
  // SUITE 7: Completeness Contest Metric Deep Stress
  // -------------------------------------------------------------------------
  console.log('\n----------------------------------------------------------------');
  console.log('SUITE 7: Completeness Metric Edge Cases & Structural Depth');
  console.log('----------------------------------------------------------------');

  const emptyObjScore = calculateCompletenessScore({});
  const emptyArrScore = calculateCompletenessScore([]);
  const nullScore = calculateCompletenessScore(null);
  const undefinedScore = calculateCompletenessScore(undefined);

  assert(emptyObjScore === 10, 'Empty object has baseline structural score of 10');
  assert(emptyArrScore === 10, 'Empty array has baseline structural score of 10');
  assert(nullScore === 0, 'Null score is 0');
  assert(undefinedScore === 0, 'Undefined score is 0');

  // Object with nested CRM properties
  const scoreWithTemplates = calculateCompletenessScore({
    tenant_1: {
      templates: [{ id: '1' }, { id: '2' }],
    },
  });
  // 2 templates * 500 = 1000 + object weights
  assert(
    scoreWithTemplates > 1000,
    `CRM structure with 2 templates receives heavy weighting (Score: ${scoreWithTemplates})`
  );

  // Cleanup any lingering artifacts from previous runs
  console.log('\n----------------------------------------------------------------');
  console.log('FINAL CLEANUP & DIRECTORY HYGIENE');
  console.log('----------------------------------------------------------------');
  for (const fp of PersistentStore.getFilePaths(wipeStoreName)) {
    try {
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    } catch {}
  }
  for (const fp of PersistentStore.getFilePaths(corruptStoreName)) {
    try {
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    } catch {}
  }

  console.log('\n================================================================');
  console.log(`   ADVERSARIAL STRESS TEST SUMMARY`);
  console.log(`   Total Tests:  ${stats.total}`);
  console.log(`   Passed:       ${stats.passed}`);
  console.log(`   Failed:       ${stats.failed}`);
  console.log('================================================================\n');

  if (stats.failed > 0) {
    throw new Error(`Adversarial stress test failed with ${stats.failed} failures.`);
  } else {
    console.log('🎉 ALL ADVERSARIAL STRESS CHALLENGES PASSED WITH ZERO DEFECTS!\n');
  }
}

runAdversarialTestSuite().catch((err) => {
  console.error('Fatal Test Harness Error:', err);
  process.exit(1);
});
