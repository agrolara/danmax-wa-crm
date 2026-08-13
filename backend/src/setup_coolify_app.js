const axios = require('axios');

async function setupCoolifyApp() {
  const coolifyUrl = 'http://148.116.104.222:8000';
  const apiToken = '1|6PdqwcucWGKSKnK9bykViP4ArSmuXPv8wArWFPBq5b5ba9b0';
  const projectUuid = 'j14368aqnfema32im3jg4r30';

  try {
    // 1. Get project details
    const projRes = await axios.get(`${coolifyUrl}/api/v1/projects/${projectUuid}`, {
      headers: { Authorization: `Bearer ${apiToken}` },
    });

    console.log('[Project Environments]:', projRes.data?.environments);

    const envUuid = projRes.data?.environments?.[0]?.uuid || 'production';
    console.log('[Using Environment UUID]:', envUuid);
  } catch (err) {
    console.error('[Coolify Setup Error]:', err.response?.data || err.message);
  }
}

setupCoolifyApp();
