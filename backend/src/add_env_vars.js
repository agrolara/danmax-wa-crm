const axios = require('axios');

async function addEnvVars() {
  const coolifyUrl = 'http://148.116.104.222:8000';
  const apiToken = '1|6PdqwcucWGKSKnK9bykViP4ArSmuXPv8wArWFPBq5b5ba9b0';
  const appUuid = 'tpu9apsacq91bw8ap1iswjwu';

  const envVars = [
    { key: 'PORT', value: '4500', is_build_time: false, is_preview: false },
    { key: 'NODE_ENV', value: 'production', is_build_time: false, is_preview: false },
    { key: 'JWT_SECRET', value: 'danmax_wa_prod_jwt_secret_2026_xK9mPqR7', is_build_time: false, is_preview: false },
    { key: 'DATABASE_URL', value: 'postgresql://postgres:postgres@host.docker.internal:5432/crm_danmax_wa?schema=public', is_build_time: false, is_preview: false },
    { key: 'OPENWA_API_URL', value: 'https://whatsapp-autopublicaciones.agrolara.dedyn.io', is_build_time: false, is_preview: false },
    { key: 'OPENWA_ADMIN_KEY', value: 'danmax_openwa_admin_key', is_build_time: false, is_preview: false },
    { key: 'WEBHOOK_PUBLIC_URL', value: 'https://crm-danmax-wa.agrolara.dedyn.io', is_build_time: false, is_preview: false },
  ];

  console.log(`[Adding ${envVars.length} Environment Variables to Coolify App ${appUuid}]...\n`);

  for (const env of envVars) {
    try {
      const res = await axios.post(
        `${coolifyUrl}/api/v1/applications/${appUuid}/envs`,
        env,
        { headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' } }
      );
      console.log(`  ✅ ${env.key} = ${env.value.substring(0, 30)}...  -> ${JSON.stringify(res.data)}`);
    } catch (err) {
      console.error(`  ❌ ${env.key}: ${err.response?.data?.message || err.message}`);
    }
  }

  // Now check if there's a PostgreSQL database we can use or if we need to create the DB
  console.log('\n[Checking existing databases on Coolify]...');
  try {
    const dbRes = await axios.get(`${coolifyUrl}/api/v1/databases`, {
      headers: { Authorization: `Bearer ${apiToken}` },
    });
    console.log('[Databases Found]:', dbRes.data?.length || 0);
    if (dbRes.data && dbRes.data.length > 0) {
      dbRes.data.forEach((db) => {
        console.log(`  - ${db.name} (UUID: ${db.uuid}, Type: ${db.type}, Status: ${db.status})`);
      });
    }
  } catch (err) {
    console.error('[DB Check Error]:', err.response?.data || err.message);
  }

  // Redeploy with env vars
  console.log('\n[Redeploying with environment variables]...');
  try {
    const deployRes = await axios.post(
      `${coolifyUrl}/api/v1/deploy`,
      { uuid: appUuid },
      { headers: { Authorization: `Bearer ${apiToken}` } }
    );
    console.log('[Redeploy Triggered!]:', deployRes.data);
  } catch (err) {
    console.error('[Redeploy Error]:', err.response?.data || err.message);
  }
}

addEnvVars();
