const axios = require('axios');

async function cleanupAndFixEnvVars() {
  const coolifyUrl = 'http://148.116.104.222:8000';
  const apiToken = '1|6PdqwcucWGKSKnK9bykViP4ArSmuXPv8wArWFPBq5b5ba9b0';
  const appUuid = 'tpu9apsacq91bw8ap1iswjwu';

  console.log('[Step 1: Delete ALL env vars to start clean]...');
  try {
    const envsRes = await axios.get(`${coolifyUrl}/api/v1/applications/${appUuid}/envs`, {
      headers: { Authorization: `Bearer ${apiToken}` },
    });

    for (const env of envsRes.data) {
      await axios.delete(`${coolifyUrl}/api/v1/applications/${appUuid}/envs/${env.uuid}`, {
        headers: { Authorization: `Bearer ${apiToken}` },
      });
      console.log(`  Deleted: ${env.key} (${env.uuid})`);
    }
  } catch (err) {
    console.error('[Cleanup Error]:', err.response?.data || err.message);
  }

  console.log('\n[Step 2: Add clean env vars (no duplicates)]...');
  const envVars = [
    { key: 'PORT', value: '4500' },
    { key: 'NODE_ENV', value: 'production' },
    { key: 'JWT_SECRET', value: 'Agro1280@' },
    { key: 'DATABASE_URL', value: 'postgresql://postgres:doPMydibkn0W9afaxFMSSwc4Krhi1IZt@supabase-db:5432/postgres?schema=danmax_wa' },
    { key: 'OPENWA_API_URL', value: 'https://whatsapp-autopublicaciones.agrolara.dedyn.io' },
    { key: 'OPENWA_ADMIN_KEY', value: 'danmax_openwa_admin_key' },
    { key: 'WEBHOOK_PUBLIC_URL', value: 'https://crm-danmax-wa.agrolara.dedyn.io' },
  ];

  for (const env of envVars) {
    try {
      const res = await axios.post(
        `${coolifyUrl}/api/v1/applications/${appUuid}/envs`,
        { key: env.key, value: env.value },
        { headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' } }
      );
      console.log(`  ✅ ${env.key} -> ${res.data.uuid}`);
    } catch (err) {
      console.error(`  ❌ ${env.key}: ${err.response?.data?.message || err.message}`);
    }
  }

  console.log('\n[Step 3: Connect app to Supabase Docker network (coolify)]...');
  try {
    // Check if connect_to_docker_network option exists
    const appRes = await axios.get(`${coolifyUrl}/api/v1/applications/${appUuid}`, {
      headers: { Authorization: `Bearer ${apiToken}` },
    });
    console.log('  Current docker networks:', appRes.data.custom_docker_run_options);
    
    // Try to add the app to the coolify network via custom_docker_run_options
    await axios.patch(
      `${coolifyUrl}/api/v1/applications/${appUuid}`,
      { custom_docker_run_options: '--network=coolify' },
      { headers: { Authorization: `Bearer ${apiToken}` } }
    );
    console.log('  ✅ Added --network=coolify');
  } catch (err) {
    console.error('  Network error:', err.response?.data || err.message);
  }

  console.log('\n[Step 4: Restart app]...');
  try {
    const res = await axios.post(
      `${coolifyUrl}/api/v1/applications/${appUuid}/restart`,
      {},
      { headers: { Authorization: `Bearer ${apiToken}` } }
    );
    console.log('[Restart Triggered]:', res.data);
  } catch (err) {
    console.error('[Restart Error]:', err.response?.data || err.message);
  }
}

cleanupAndFixEnvVars();
