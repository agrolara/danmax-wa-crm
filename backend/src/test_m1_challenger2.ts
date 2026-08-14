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

interface TestStats {
  passed: number;
  failed: number;
  total: number;
  failures: string[];
}

const stats: TestStats = {
  passed: 0,
  failed: 0,
  total: 0,
  failures: [],
};

function assert(condition: boolean, testName: string, details?: string) {
  stats.total++;
  if (condition) {
    console.log(`  ✅ [PASS] ${testName}`);
    stats.passed++;
  } else {
    const msg = `❌ [FAIL] ${testName}${details ? ` -> ${details}` : ''}`;
    console.error(`  ${msg}`);
    stats.failed++;
    stats.failures.push(msg);
  }
}

async function runChallenger2AdversarialSuite() {
  console.log('================================================================');
  console.log('  CHALLENGER 2: ADVERSARIAL STRESS TEST & VERIFICATION HARNESS  ');
  console.log('  Milestone 1: Storage Engine Core & Multi-Disk Fallback        ');
  console.log('================================================================\n');

  // ==========================================================================
  // SECTION 1: COMPLETENESS CONTEST (Sparse vs Dense Store with 10 Templates & 5 Categories)
  // ==========================================================================
  console.log('--- SECTION 1: Adversarial Completeness Contest ---');

  const sparsePayload = {
    tenant_demo_pizzeria: {
      categories: [],
      templates: [],
    },
  };

  const densePayload = {
    tenant_demo_pizzeria: {
      categories: ['Promociones', 'Pizzas Especiales', 'Bebidas', 'Postres', 'Combos Familiares'],
      templates: [
        { id: 'tpl_1', title: 'Bienvenida Pizzería', content: 'Hola {nombre}, bienvenido a Pizzería DanMax!' },
        { id: 'tpl_2', title: 'Promo Martes 2x1', content: 'Hoy 2x1 en pizzas medianas.', mediaUrl: 'https://cdn.example.com/p1.jpg' },
        { id: 'tpl_3', title: 'Menú Digital', content: 'Consulta nuestra carta completa aquí: {link}' },
        { id: 'tpl_4', title: 'Confirmación Pedido', content: 'Tu orden #{order_id} ha sido confirmada.' },
        { id: 'tpl_5', title: 'Pedido en Camino', content: 'El repartidor va en camino a {direccion}.' },
        { id: 'tpl_6', title: 'Encuesta Satisfacción', content: 'Califica tu experiencia de 1 a 5 estrellas.' },
        { id: 'tpl_7', title: 'Cupón Descuento', content: 'Usa el cupón PIZZA10 para 10% OFF.' },
        { id: 'tpl_8', title: 'Horarios de Atención', content: 'Abrimos todos los días de 12:00 a 23:00.' },
        { id: 'tpl_9', title: 'Promoción Fin de Semana', content: 'Pizza familiar + Bebida 1.5L a precio especial.' },
        { id: 'tpl_10', title: 'Contacto Soporte', content: 'Para reclamos o dudas escribe a soporte@pizzeria.com' },
      ],
      groupCategoryMap: {
        '12036301@g.us': 'Promociones',
        '12036302@g.us': 'Pizzas Especiales',
        '12036303@g.us': 'Combos Familiares',
      },
      hiddenGroupIds: ['12036399@g.us', '12036398@g.us'],
    },
    tenant_client_vip: {
      categories: ['VIP'],
      templates: [{ id: 'tpl_vip_1', title: 'Atención VIP', content: 'Bienvenido socio VIP' }],
    },
  };

  const scoreSparse = calculateCompletenessScore(sparsePayload);
  const scoreDense = calculateCompletenessScore(densePayload);

  console.log(`  [Score Check] Sparse Store Score: ${scoreSparse}`);
  console.log(`  [Score Check] Dense Store Score (10 tpl, 5 cat): ${scoreDense}`);

  assert(scoreDense > scoreSparse * 20, 'Dense store score is over 20x higher than sparse store');
  assert(scoreDense > 5000, `Dense store score is sufficiently high (got ${scoreDense})`);

  // Multi-tier disk contest simulation
  const contestFile = `adversarial_contest_${Date.now()}.json`;
  const persistentDirs = getPersistentDirs();
  const allCandidatePaths = PersistentStore.getFilePaths(contestFile);

  assert(persistentDirs.length >= 3, `Discovered ${persistentDirs.length} persistent directories (>=3 required)`);

  // Setup varied disk states across tiers:
  // Disk 0: Sparse store
  // Disk 1: Dense store (the winner)
  // Disk 2: Corrupted invalid JSON
  // Disk 3: 0-byte empty file (if available)
  // Disk 4+: Non-existent
  if (allCandidatePaths.length >= 2) {
    fs.writeFileSync(allCandidatePaths[0], JSON.stringify(sparsePayload, null, 2), 'utf-8');
    fs.writeFileSync(allCandidatePaths[1], JSON.stringify(densePayload, null, 2), 'utf-8');

    if (allCandidatePaths.length >= 3) {
      fs.writeFileSync(allCandidatePaths[2], '{"corrupted_data_syntax_error: [1,2,3', 'utf-8');
    }
    if (allCandidatePaths.length >= 4) {
      fs.writeFileSync(allCandidatePaths[3], '', 'utf-8');
    }

    console.log('  [Contest] Executing PersistentStore.readJSON under heterogeneous disk states...');
    const contestResult = PersistentStore.readJSON<typeof densePayload>(contestFile, {} as any);

    assert(
      contestResult.tenant_demo_pizzeria?.templates?.length === 10,
      'readJSON returned the dense store with all 10 templates intact'
    );
    assert(
      contestResult.tenant_demo_pizzeria?.categories?.length === 5,
      'readJSON returned the dense store with all 5 categories intact'
    );
    assert(
      contestResult.tenant_client_vip?.templates?.length === 1,
      'readJSON preserved multi-tenant client partition data'
    );

    // Verify automatic backfill across ALL disk locations
    for (let i = 0; i < allCandidatePaths.length; i++) {
      const p = allCandidatePaths[i];
      const exists = fs.existsSync(p);
      assert(exists, `Disk location #${i} (${p}) was backfilled`);
      if (exists) {
        try {
          const content = JSON.parse(fs.readFileSync(p, 'utf-8'));
          assert(
            content.tenant_demo_pizzeria?.templates?.length === 10 &&
              content.tenant_demo_pizzeria?.categories?.length === 5,
            `Disk location #${i} content strictly upgraded to dense winning store`
          );
        } catch (e) {
          assert(false, `Disk location #${i} contains invalid JSON after backfill: ${e}`);
        }
      }
    }
  }

  // ==========================================================================
  // SECTION 2: ANTI-RECURSION & RE-ENTRANCY SAFETY
  // ==========================================================================
  console.log('\n--- SECTION 2: Anti-Recursion & Re-Entrancy Protection ---');

  // Test 2.1: Deep nesting stack safety in calculateCompletenessScore
  let deepObject: any = { value: 'leaf' };
  for (let d = 0; d < 50; d++) {
    deepObject = { nested: deepObject };
  }

  let deepScore = 0;
  let didBlowStack = false;
  try {
    deepScore = calculateCompletenessScore(deepObject);
  } catch (err) {
    didBlowStack = true;
  }
  assert(!didBlowStack, 'calculateCompletenessScore safely handles 50-level deep nested object without stack overflow');
  assert(deepScore > 0, `calculateCompletenessScore returned score ${deepScore} for deep object`);

  // Test 2.2: Re-entrant readJSON calls during backfill or property extraction
  const reentrantFileA = `reentrant_test_a_${Date.now()}.json`;
  const reentrantFileB = `reentrant_test_b_${Date.now()}.json`;

  PersistentStore.writeJSON(reentrantFileA, { step: 'A', data: [1, 2, 3] });
  PersistentStore.writeJSON(reentrantFileB, { step: 'B', data: [4, 5, 6] });

  // Simulate hooked getter that calls readJSON internally during serialization/access
  let reentrantReadSuccess = false;
  try {
    const objWithHook = {
      tenant_demo_pizzeria: {
        get dynamicTemplate() {
          // Trigger nested readJSON on another file
          return PersistentStore.readJSON(reentrantFileB, { fallback: true });
        },
        templates: [{ id: '1', title: 'Hooked' }],
      },
    };

    // Calculate score on object with hook getter
    const hookScore = calculateCompletenessScore(objWithHook);
    assert(hookScore > 0, `Hook getter inside calculateCompletenessScore executed safely (score: ${hookScore})`);
    reentrantReadSuccess = true;
  } catch (err) {
    console.error('Re-entrancy hook error:', err);
    reentrantReadSuccess = false;
  }
  assert(reentrantReadSuccess, 'Re-entrant readJSON execution inside hooked getters succeeded without deadlocks');

  // Test 2.3: Same-file recursive read backfill guard
  const recursiveFile = `recursive_backfill_${Date.now()}.json`;
  const pathsRecursive = PersistentStore.getFilePaths(recursiveFile);
  if (pathsRecursive.length >= 2) {
    // Make path 0 outdated to force backfill
    fs.writeFileSync(pathsRecursive[0], JSON.stringify({ version: 1 }), 'utf-8');
    fs.writeFileSync(pathsRecursive[1], JSON.stringify({ version: 2, templates: [{ id: 'x' }] }), 'utf-8');

    let nestedRanWithoutLoop = true;
    try {
      // Call readJSON which triggers auto-backfill on recursiveFile
      const res = PersistentStore.readJSON(recursiveFile, {});
      assert(res !== null, 'Initial readJSON completed');
    } catch (err) {
      nestedRanWithoutLoop = false;
    }
    assert(nestedRanWithoutLoop, 'Auto-backfill anti-recursion guard successfully prevented infinite re-entry');
  }

  // ==========================================================================
  // SECTION 3: FALLBACK DEEP CLONE IMMUTABILITY & SAFETY
  // ==========================================================================
  console.log('\n--- SECTION 3: Fallback Deep Clone Safety ---');

  const pristineFallback = {
    canonicalTenant: CANONICAL_ADMIN_TENANT,
    config: {
      autoReply: true,
      maxRetries: 3,
      tags: ['initial', 'default'],
    },
    templates: [
      { id: 'fb_1', name: 'Default Template', items: [{ key: 'k1', val: 'v1' }] },
    ],
  };

  const missingFile = `non_existent_file_${Date.now()}_${Math.random()}.json`;

  // Read 1: Obtain cloned fallback
  const read1 = PersistentStore.readJSON<typeof pristineFallback>(missingFile, pristineFallback);

  // Adversarial caller mutation: Mutate EVERYTHING in read1
  read1.canonicalTenant = 'HACKED_TENANT';
  read1.config.autoReply = false;
  read1.config.maxRetries = 9999;
  read1.config.tags.push('CORRUPTED_TAG');
  read1.templates[0].name = 'MUTATED_NAME';
  read1.templates[0].items.push({ key: 'k2', val: 'v2' });
  (read1 as any).injectedProperty = 'MALICIOUS_DATA';

  // Verify pristineFallback remains 100% UNTOUCHED
  assert(
    pristineFallback.canonicalTenant === CANONICAL_ADMIN_TENANT,
    'Fallback top-level primitive was NOT mutated by caller changes'
  );
  assert(
    pristineFallback.config.autoReply === true && pristineFallback.config.maxRetries === 3,
    'Fallback nested object properties were NOT mutated'
  );
  assert(
    pristineFallback.config.tags.length === 2 && !pristineFallback.config.tags.includes('CORRUPTED_TAG'),
    'Fallback nested array was NOT mutated'
  );
  assert(
    pristineFallback.templates[0].name === 'Default Template' && pristineFallback.templates[0].items.length === 1,
    'Fallback deeply nested object array was NOT mutated'
  );
  assert(
    !(pristineFallback as any).injectedProperty,
    'Fallback did NOT receive injected properties'
  );

  // Read 2: Second call with pristineFallback must return fresh unmutated data
  const read2 = PersistentStore.readJSON<typeof pristineFallback>(missingFile, pristineFallback);
  assert(
    read2.canonicalTenant === CANONICAL_ADMIN_TENANT &&
      read2.config.autoReply === true &&
      read2.config.tags.length === 2 &&
      read2.templates[0].name === 'Default Template',
    'Second readJSON call returns a fresh, pristine clone unaffected by previous caller mutations'
  );

  // Array fallback clone test
  const arrayFallback = [{ id: 1, name: 'Original' }, { id: 2, name: 'Original 2' }];
  const readArray = PersistentStore.readJSON<typeof arrayFallback>(missingFile, arrayFallback);
  readArray[0].name = 'MUTATED_ARRAY_ITEM';
  readArray.push({ id: 3, name: 'INJECTED' });
  assert(
    arrayFallback.length === 2 && arrayFallback[0].name === 'Original',
    'Array fallback reference is protected against element mutations and additions'
  );

  // ==========================================================================
  // SECTION 4: HIGH CONCURRENCY & RACE CONDITION STRESS TEST
  // ==========================================================================
  console.log('\n--- SECTION 4: High Concurrency & Interleaved Read/Write Stress ---');

  const concurrentFile = `concurrent_stress_${Date.now()}.json`;
  const CONCURRENT_OPS = 80;
  const writePromises: Promise<any>[] = [];
  const readPromises: Promise<any>[] = [];

  // Launch interleaved concurrent writes and reads
  for (let i = 0; i < CONCURRENT_OPS; i++) {
    const payload = {
      tenant_demo_pizzeria: {
        categories: [`Cat_${i}`, `Cat_${i + 1}`],
        templates: [
          { id: `tpl_${i}`, title: `Template ${i}`, content: `Content ${i}` },
          { id: `tpl_${i}_b`, title: `Template B ${i}`, content: `Content B ${i}` },
        ],
      },
      iteration: i,
      timestamp: Date.now(),
    };

    // Interleave writes
    writePromises.push(
      new Promise<void>((resolve) => {
        setImmediate(() => {
          try {
            PersistentStore.writeJSON(concurrentFile, payload);
          } catch (e) {
            console.error(`Concurrent write error at iteration ${i}:`, e);
          }
          resolve();
        });
      })
    );

    // Interleave reads
    readPromises.push(
      new Promise<void>((resolve) => {
        setImmediate(() => {
          try {
            const data = PersistentStore.readJSON(concurrentFile, { fallback: true });
            assert(data !== null && typeof data === 'object', `Concurrent read #${i} returned valid object`);
          } catch (e) {
            console.error(`Concurrent read error at iteration ${i}:`, e);
          }
          resolve();
        });
      })
    );
  }

  await Promise.all([...writePromises, ...readPromises]);
  console.log(`  [Concurrency] Completed ${CONCURRENT_OPS * 2} interleaved async operations.`);

  // Post-concurrency sanity check: all disk files must be valid, parseable JSON
  const concurrentPaths = PersistentStore.getFilePaths(concurrentFile);
  for (const cp of concurrentPaths) {
    if (fs.existsSync(cp)) {
      const raw = fs.readFileSync(cp, 'utf-8');
      assert(raw.length > 0, `Concurrent file at ${cp} is non-empty`);
      let parsedOk = false;
      try {
        const parsed = JSON.parse(raw);
        assert(parsed && typeof parsed === 'object', `Concurrent file at ${cp} parsed into valid JSON object`);
        parsedOk = true;
      } catch (e) {
        assert(false, `Concurrent file at ${cp} is corrupted: ${e}`);
      }
      assert(parsedOk, `No corrupted half-writes on disk ${cp}`);
    }
  }

  // ==========================================================================
  // SECTION 5: ADVERSARIAL SCORE GAMING & EDGE CASES
  // ==========================================================================
  console.log('\n--- SECTION 5: Adversarial Score Gaming & Boundary Edge Cases ---');

  // Attack 1: Massive raw string trying to outscore real CRM data
  const massiveStringPayload = {
    garbage: 'A'.repeat(50000), // 50KB string
  };
  const crmRealData = {
    tenant_demo_pizzeria: {
      categories: ['Ventas', 'Soporte'],
      templates: [
        { id: '1', title: 'T1', content: 'Short content' },
        { id: '2', title: 'T2', content: 'Short content 2' },
      ],
    },
  };

  const stringAttackScore = calculateCompletenessScore(massiveStringPayload);
  const realCrmScore = calculateCompletenessScore(crmRealData);
  console.log(`  [Score Attack] 50KB string score: ${stringAttackScore} | Real CRM score: ${realCrmScore}`);
  assert(
    realCrmScore > stringAttackScore,
    `Real structured CRM data (${realCrmScore}) beats 50KB raw string payload (${stringAttackScore})`
  );

  // Attack 2: Boundary values: NaN, Infinity, null, boolean, empty strings
  assert(calculateCompletenessScore(null) === 0, 'calculateCompletenessScore(null) === 0');
  assert(calculateCompletenessScore(undefined) === 0, 'calculateCompletenessScore(undefined) === 0');
  assert(calculateCompletenessScore(NaN) === 0, 'calculateCompletenessScore(NaN) === 0');
  assert(calculateCompletenessScore('') === 0, 'calculateCompletenessScore("") === 0');
  assert(calculateCompletenessScore('   ') === 0, 'calculateCompletenessScore("   ") === 0');
  assert(calculateCompletenessScore(true) === 1, 'calculateCompletenessScore(true) === 1');
  assert(calculateCompletenessScore(false) === 1, 'calculateCompletenessScore(false) === 1');
  assert(calculateCompletenessScore(123) === 2, 'calculateCompletenessScore(123) === 2');
  assert(calculateCompletenessScore([]) === 10, 'calculateCompletenessScore([]) === 10');
  assert(calculateCompletenessScore({}) === 10, 'calculateCompletenessScore({}) === 10');

  // Attack 3: Type Incompatibility Detection
  assert(!isTypeCompatible('hello', 123), 'String is incompatible with number');
  assert(!isTypeCompatible({ a: 1 }, [1, 2]), 'Object is incompatible with Array');
  assert(!isTypeCompatible([1, 2], { a: 1 }), 'Array is incompatible with Object');
  assert(!isTypeCompatible(null, { a: 1 }), 'null is incompatible with Object');
  assert(isTypeCompatible({ a: 1 }, { b: 2 }), 'Object is compatible with Object');
  assert(isTypeCompatible([1, 2], [3, 4]), 'Array is compatible with Array');

  // ==========================================================================
  // SECTION 6: CLEANUP & TEMP FILE ACCUMULATION AUDIT
  // ==========================================================================
  console.log('\n--- SECTION 6: Temp File Leak & Cleanup Audit ---');

  // Cleanup test artifacts
  const testFilesToClean = [contestFile, reentrantFileA, reentrantFileB, recursiveFile, concurrentFile];
  for (const fname of testFilesToClean) {
    for (const p of PersistentStore.getFilePaths(fname)) {
      try {
        if (fs.existsSync(p)) fs.unlinkSync(p);
      } catch {}
    }
  }

  // Scan all persistent directories for lingering .tmp files
  let lingeringTmpCount = 0;
  for (const d of persistentDirs) {
    if (fs.existsSync(d)) {
      const files = fs.readdirSync(d);
      const tmpFiles = files.filter((f) => f.includes('.tmp.'));
      if (tmpFiles.length > 0) {
        console.warn(`  ⚠️ Found ${tmpFiles.length} leftover .tmp files in ${d}:`, tmpFiles);
        lingeringTmpCount += tmpFiles.length;
        // Clean them
        for (const tf of tmpFiles) {
          try {
            fs.unlinkSync(path.join(d, tf));
          } catch {}
        }
      }
    }
  }
  assert(lingeringTmpCount === 0, `Zero lingering .tmp files detected across all persistent disk directories`);

  // ==========================================================================
  // SUMMARY
  // ==========================================================================
  console.log('\n================================================================');
  console.log(`  CHALLENGER 2 SUITE COMPLETE: ${stats.passed}/${stats.total} ASSERTIONS PASSED`);
  if (stats.failed > 0) {
    console.error(`  ❌ ${stats.failed} ASSERTIONS FAILED:`);
    stats.failures.forEach((f) => console.error(`    - ${f}`));
    console.log('================================================================\n');
    process.exitCode = 1;
    throw new Error(`Challenger 2 Suite Failed: ${stats.failed} tests failed.`);
  } else {
    console.log('  🎉 ALL ADVERSARIAL STRESS TESTS PASSED WITH 100% SUCCESS!');
    console.log('================================================================\n');
  }
}

runChallenger2AdversarialSuite().catch((err) => {
  console.error('Fatal Test Execution Error:', err);
  process.exit(1);
});
