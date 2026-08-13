const axios = require('axios');

async function updateCoolifyDomainV2() {
  const coolifyUrl = 'http://148.116.104.222:8000';
  const apiToken = '1|6PdqwcucWGKSKnK9bykViP4ArSmuXPv8wArWFPBq5b5ba9b0';
  const appUuid = 'b12vfxigz7vkx0u20cawbvxj';
  const newDomain = 'https://crm-danmax-wa.agrolara.dedyn.io';

  try {
    const res = await axios.post(
      `${coolifyUrl}/api/v1/applications/${appUuid}`,
      { fqdn: newDomain },
      {
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('[Domain Update POST Result]:', res.data);
  } catch (err) {
    console.error('[Domain Update Error]:', err.response?.data || err.message);
  }
}

updateCoolifyDomainV2();
