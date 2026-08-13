const axios = require('axios');

async function checkDeploymentStatus() {
  const coolifyUrl = 'http://148.116.104.222:8000';
  const apiToken = '1|6PdqwcucWGKSKnK9bykViP4ArSmuXPv8wArWFPBq5b5ba9b0';
  const deployUuid = 'dm934lj21ltav8qtyfehcixo';

  try {
    const res = await axios.get(`${coolifyUrl}/api/v1/deployments/${deployUuid}`, {
      headers: { Authorization: `Bearer ${apiToken}` },
    });

    console.log('[Deployment Status]:', res.data?.status);
    console.log('[Deployment Logs Sample]:');
    console.log(res.data?.logs?.slice(-10));
  } catch (err) {
    console.error('[Deploy Status Error]:', err.response?.data || err.message);
  }
}

checkDeploymentStatus();
