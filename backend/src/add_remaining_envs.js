const axios = require('axios');

async function addAllEnvVars() {
  const coolifyUrl = 'http://148.116.104.222:8000';
  const apiToken = '1|6PdqwcucWGKSKnK9bykViP4ArSmuXPv8wArWFPBq5b5ba9b0';
  const appUuid = 'tpu9apsacq91bw8ap1iswjwu';

  // PORT already added (uuid l12711l4v2yan3b3jnneoynd)
  const envVars = [
    { key: 'NODE_ENV', value: 'production' },
    { key: 'JWT_SECRET', value: 'danmax_wa_prod_jwt_secret_2026_xK9mPqR7' },
    { key: 'DATABASE_URL', value: 'postgresql://postgres:postgres@host.docker.internal:5432/crm_danmax_wa?schema=public' },
    { key: 'OPENWA_API_URL', value: 'https://whatsapp-autopublicaciones.agrolara.dedyn.io' },
    { key: 'OPENWA_ADMIN_KEY', value: 'danmax_openwa_admin_key' },
    { key: 'WEBHOOK_PUBLIC_URL', value: 'https://crm-danmax-wa.agrolara.dedyn.io' },
  ];

  console.log(`[Adding ${envVars.length} remaining env vars]...\n`);

  for (const env of envVars) {
    try {
      const res = await axios.post(
        `${coolifyUrl}/api/v1/applications/${appUuid}/envs`,
        { key: env.key, value: env.value },
        { headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' } }
      );
      console.log(`  ✅ ${env.key} -> ${res.data.uuid}`);
    } catch (err) {
      console.error(`  ❌ ${env.key}: ${JSON.stringify(err.response?.data)}`);
    }
  }

  // Restart the app so it picks up the new env vars
  console.log('\n[Restarting app with new env vars]...');
  try {
    const res = await axios.post(
      `${coolifyUrl}/api/v1/applications/${appUuid}/restart`,
      {},
      { headers: { Authorization: `Bearer ${apiToken}` } }
    );
    console.log('[Restart Result]:', res.data);
  } catch (err) {
    // If restart endpoint doesn't exist, redeploy instead
    console.log('[Restart not available, redeploying...]');
    try {
      const deployRes = await axios.post(
        `${coolifyUrl}/api/v1/deploy`,
        { uuid: appUuid },
        { headers: { Authorization: `Bearer ${apiToken}` } }
      );
      console.log('[Redeploy Triggered!]:', deployRes.data);
    } catch (err2) {
      console.error('[Redeploy Error]:', err2.response?.data || err2.message);
    }
  }
}

addAllEnvVars();
