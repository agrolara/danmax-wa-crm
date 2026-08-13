const axios = require('axios');

async function inspectApp() {
  const coolifyUrl = 'http://148.116.104.222:8000';
  const apiToken = '1|6PdqwcucWGKSKnK9bykViP4ArSmuXPv8wArWFPBq5b5ba9b0';
  const appUuid = 'b12vfxigz7vkx0u20cawbvxj';

  try {
    const res = await axios.get(`${coolifyUrl}/api/v1/applications/${appUuid}`, {
      headers: { Authorization: `Bearer ${apiToken}` },
    });

    console.log('[Full Coolify App Object Keys]:', Object.keys(res.data));
    console.log('[Domains / Labels]:', {
      fqdn: res.data.fqdn,
      domains: res.data.domains,
      custom_labels: res.data.custom_labels,
    });
  } catch (err) {
    console.error(err.response?.data || err.message);
  }
}

inspectApp();
