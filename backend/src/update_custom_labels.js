const axios = require('axios');

async function updateCustomLabels() {
  const coolifyUrl = 'http://148.116.104.222:8000';
  const apiToken = '1|6PdqwcucWGKSKnK9bykViP4ArSmuXPv8wArWFPBq5b5ba9b0';
  const appUuid = 'b12vfxigz7vkx0u20cawbvxj';
  const targetDomain = 'crm-danmax-wa.agrolara.dedyn.io';

  try {
    const res = await axios.get(`${coolifyUrl}/api/v1/applications/${appUuid}`, {
      headers: { Authorization: `Bearer ${apiToken}` },
    });

    const rawLabels = Buffer.from(res.data.custom_labels, 'base64').toString('utf-8');
    console.log('[Original Traefik/Caddy Labels]:\n', rawLabels);

    // Replace old subdomain with new domain crm-danmax-wa.agrolara.dedyn.io
    const updatedLabels = rawLabels
      .replace(/b12vfxigz7vkx0u20cawbvxj\.agrolara\.dedyn\.io/g, targetDomain);

    const encodedNewLabels = Buffer.from(updatedLabels, 'utf-8').toString('base64');

    console.log('[New Labels Generated]:\n', updatedLabels);

    const patchRes = await axios.patch(
      `${coolifyUrl}/api/v1/applications/${appUuid}`,
      { custom_labels: encodedNewLabels },
      {
        headers: { Authorization: `Bearer ${apiToken}` },
      }
    );

    console.log('[Coolify Custom Labels Updated!]:', patchRes.data);

    // Trigger redeploy so Traefik/Caddy applies new SSL cert for crm-danmax-wa.agrolara.dedyn.io
    const deployRes = await axios.post(
      `${coolifyUrl}/api/v1/deploy`,
      { uuid: appUuid },
      {
        headers: { Authorization: `Bearer ${apiToken}` },
      }
    );
    console.log('[Redeploy Triggered with New Domain!]:', deployRes.data);
  } catch (err) {
    console.error('[Update Custom Labels Error]:', err.response?.data || err.message);
  }
}

updateCustomLabels();
