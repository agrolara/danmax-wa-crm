const axios = require('axios');

async function redeployApp() {
  const coolifyUrl = 'http://148.116.104.222:8000';
  const apiToken = '1|6PdqwcucWGKSKnK9bykViP4ArSmuXPv8wArWFPBq5b5ba9b0';
  const appUuid = 'b12vfxigz7vkx0u20cawbvxj';

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

redeployApp();
