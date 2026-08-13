const axios = require('axios');

async function listAllApps() {
  const coolifyUrl = 'http://148.116.104.222:8000';
  const apiToken = '1|6PdqwcucWGKSKnK9bykViP4ArSmuXPv8wArWFPBq5b5ba9b0';

  try {
    const res = await axios.get(`${coolifyUrl}/api/v1/applications`, {
      headers: { Authorization: `Bearer ${apiToken}` },
    });

    console.log('[Coolify Applications List]:');
    res.data.forEach((app) => {
      console.log(`- ${app.name} (UUID: ${app.uuid}, FQDN: ${app.fqdn})`);
    });
  } catch (err) {
    console.error(err.response?.data || err.message);
  }
}

listAllApps();
