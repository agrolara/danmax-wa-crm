const axios = require('axios');

async function resetLabels() {
  const coolifyUrl = 'http://148.116.104.222:8000';
  const apiToken = '1|6PdqwcucWGKSKnK9bykViP4ArSmuXPv8wArWFPBq5b5ba9b0';
  const appUuid = 'tpu9apsacq91bw8ap1iswjwu';

  console.log('[Resetting Custom Labels so Coolify auto-generates clean Traefik config]...');

  try {
    const patchRes = await axios.patch(
      `${coolifyUrl}/api/v1/applications/${appUuid}`,
      { custom_labels: null, ports_exposes: '4500' },
      { headers: { Authorization: `Bearer ${apiToken}` } }
    );
    console.log('[Patch Success]:', patchRes.data);

    // Redeploy
    const deployRes = await axios.post(
      `${coolifyUrl}/api/v1/deploy`,
      { uuid: appUuid },
      { headers: { Authorization: `Bearer ${apiToken}` } }
    );
    console.log('[Redeploy Triggered!]:', deployRes.data);
  } catch (err) {
    console.error('[Error Resetting Labels]:', err.response?.data || err.message);
  }
}

resetLabels();
