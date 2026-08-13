const axios = require('axios');

async function addEnvVarsV2() {
  const coolifyUrl = 'http://148.116.104.222:8000';
  const apiToken = '1|6PdqwcucWGKSKnK9bykViP4ArSmuXPv8wArWFPBq5b5ba9b0';
  const appUuid = 'tpu9apsacq91bw8ap1iswjwu';

  // Try with different field names based on Coolify v4 API docs
  const envVars = [
    { key: 'PORT', value: '4500' },
    { key: 'NODE_ENV', value: 'production' },
    { key: 'JWT_SECRET', value: 'danmax_wa_prod_jwt_secret_2026_xK9mPqR7' },
    { key: 'DATABASE_URL', value: 'postgresql://postgres:postgres@host.docker.internal:5432/crm_danmax_wa?schema=public' },
    { key: 'OPENWA_API_URL', value: 'https://whatsapp-autopublicaciones.agrolara.dedyn.io' },
    { key: 'OPENWA_ADMIN_KEY', value: 'danmax_openwa_admin_key' },
    { key: 'WEBHOOK_PUBLIC_URL', value: 'https://crm-danmax-wa.agrolara.dedyn.io' },
  ];

  // First try: bulk via PATCH with env array
  console.log('[Attempt 1: POST single env var with verbose error]...');
  try {
    const res = await axios.post(
      `${coolifyUrl}/api/v1/applications/${appUuid}/envs`,
      { key: 'PORT', value: '4500' },
      { headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' } }
    );
    console.log('[Success]:', res.data);
  } catch (err) {
    console.error('[Full Error]:', JSON.stringify(err.response?.data, null, 2));
  }

  // Second try: different payload format
  console.log('\n[Attempt 2: with "name" instead of "key"]...');
  try {
    const res = await axios.post(
      `${coolifyUrl}/api/v1/applications/${appUuid}/envs`,
      { name: 'PORT', value: '4500' },
      { headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' } }
    );
    console.log('[Success]:', res.data);
  } catch (err) {
    console.error('[Full Error]:', JSON.stringify(err.response?.data, null, 2));
  }

  // Third try: bulk update via PATCH on the application
  console.log('\n[Attempt 3: PATCH application with environment_variables]...');
  try {
    const res = await axios.patch(
      `${coolifyUrl}/api/v1/applications/${appUuid}`,
      { 
        environment_variables: envVars
      },
      { headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' } }
    );
    console.log('[Success]:', res.data);
  } catch (err) {
    console.error('[Full Error]:', JSON.stringify(err.response?.data, null, 2));
  }
}

addEnvVarsV2();
