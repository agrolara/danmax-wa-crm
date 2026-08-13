const axios = require('axios');

async function getFullDeployLog() {
  const coolifyUrl = 'http://148.116.104.222:8000';
  const apiToken = '1|6PdqwcucWGKSKnK9bykViP4ArSmuXPv8wArWFPBq5b5ba9b0';
  const deployUuid = 'yol33nr0szdm85mcdkaqe36y';

  try {
    const res = await axios.get(`${coolifyUrl}/api/v1/deployments/${deployUuid}`, {
      headers: { Authorization: `Bearer ${apiToken}` },
    });

    console.log('[Full Coolify Deploy Logs]:');
    console.log(res.data?.logs);
  } catch (err) {
    console.error('[Deploy Status Error]:', err.response?.data || err.message);
  }
}

getFullDeployLog();
