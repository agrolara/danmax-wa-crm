const axios = require('axios');

async function updateCoolifyDomain() {
  const coolifyUrl = 'http://148.116.104.222:8000';
  const apiToken = '1|6PdqwcucWGKSKnK9bykViP4ArSmuXPv8wArWFPBq5b5ba9b0';
  const appUuid = 'b12vfxigz7vkx0u20cawbvxj';
  const newDomain = 'https://crm-danmax-wa.agrolara.dedyn.io';

  console.log(`[Updating Domain in Coolify for App ${appUuid} to ${newDomain}]...`);

  try {
    // 1. Get application details first
    const appRes = await axios.get(`${coolifyUrl}/api/v1/applications/${appUuid}`, {
      headers: { Authorization: `Bearer ${apiToken}` },
    });

    console.log('[App Details]:', { id: appRes.data?.id, fqdn: appRes.data?.fqdn, uuid: appRes.data?.uuid });

    // 2. Patch application
    const patchRes = await axios.patch(
      `${coolifyUrl}/api/v1/applications/${appUuid}`,
      { fqdn: newDomain },
      {
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('[Domain Update Response]:', patchRes.data);
  } catch (err) {
    console.error('[Domain Update Error]:', err.response?.data || err.message);
  }
}

updateCoolifyDomain();
