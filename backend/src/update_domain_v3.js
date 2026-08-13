const axios = require('axios');

async function updateDomainV3() {
  const coolifyUrl = 'http://148.116.104.222:8000';
  const apiToken = '1|6PdqwcucWGKSKnK9bykViP4ArSmuXPv8wArWFPBq5b5ba9b0';
  const appUuid = 'b12vfxigz7vkx0u20cawbvxj';
  const targetFqdn = 'https://crm-danmax-wa.agrolara.dedyn.io';

  console.log(`[Updating FQDN for app ${appUuid} to ${targetFqdn}]...`);

  // Try updating via POST /api/v1/applications with uuid
  try {
    const res = await axios.post(
      `${coolifyUrl}/api/v1/applications`,
      {
        uuid: appUuid,
        fqdn: targetFqdn,
      },
      {
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
    console.log('[Update FQDN Result]:', res.data);
  } catch (err) {
    console.error('[Error v3]:', err.response?.data || err.message);
  }
}

updateDomainV3();
