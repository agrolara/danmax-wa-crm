const axios = require('axios');

async function getCoolifyServers() {
  const coolifyUrl = 'http://148.116.104.222:8000';
  const apiToken = '1|6PdqwcucWGKSKnK9bykViP4ArSmuXPv8wArWFPBq5b5ba9b0';

  try {
    const res = await axios.get(`${coolifyUrl}/api/v1/servers`, {
      headers: { Authorization: `Bearer ${apiToken}` },
    });

    console.log('[Coolify Servers]:', res.data);
  } catch (err) {
    console.error('[Coolify Error]:', err.response?.data || err.message);
  }
}

getCoolifyServers();
