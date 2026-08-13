const axios = require('axios');

async function updateLabelsAndRedeploy() {
  const coolifyUrl = 'http://148.116.104.222:8000';
  const apiToken = '1|6PdqwcucWGKSKnK9bykViP4ArSmuXPv8wArWFPBq5b5ba9b0';
  const appUuid = 'tpu9apsacq91bw8ap1iswjwu';

  try {
    // Get current labels
    const res = await axios.get(`${coolifyUrl}/api/v1/applications/${appUuid}`, {
      headers: { Authorization: `Bearer ${apiToken}` },
    });

    const rawLabels = Buffer.from(res.data.custom_labels, 'base64').toString('utf-8');
    console.log('[Current Labels]:\n', rawLabels);

    // Replace old UUID-domain with crm-danmax-wa AND port 3000 -> 4500
    const updatedLabels = rawLabels
      .replace(/tpu9apsacq91bw8ap1iswjwu\.agrolara\.dedyn\.io/g, 'crm-danmax-wa.agrolara.dedyn.io')
      .replace(/port=3000/g, 'port=4500')
      .replace(/upstreams 3000/g, 'upstreams 4500');

    const encodedLabels = Buffer.from(updatedLabels, 'utf-8').toString('base64');

    console.log('[Updated Labels]:\n', updatedLabels);

    await axios.patch(
      `${coolifyUrl}/api/v1/applications/${appUuid}`,
      { custom_labels: encodedLabels },
      { headers: { Authorization: `Bearer ${apiToken}` } }
    );
    console.log('[Labels Updated!]');

    // Redeploy
    const deployRes = await axios.post(
      `${coolifyUrl}/api/v1/deploy`,
      { uuid: appUuid },
      { headers: { Authorization: `Bearer ${apiToken}` } }
    );
    console.log('[Redeploy Triggered!]:', deployRes.data);
  } catch (err) {
    console.error('[Error]:', err.response?.data || err.message);
  }
}

updateLabelsAndRedeploy();
