const axios = require('axios');

async function inspectAppStatus() {
  const coolifyUrl = 'http://148.116.104.222:8000';
  const apiToken = '1|6PdqwcucWGKSKnK9bykViP4ArSmuXPv8wArWFPBq5b5ba9b0';
  const appUuid = 'tpu9apsacq91bw8ap1iswjwu';

  try {
    const res = await axios.get(`${coolifyUrl}/api/v1/applications/${appUuid}`, {
      headers: { Authorization: `Bearer ${apiToken}` },
    });

    console.log('[App Status Details]:', {
      name: res.data.name,
      status: res.data.status,
      ports_exposes: res.data.ports_exposes,
      ports_mappings: res.data.ports_mappings,
      fqdn: res.data.fqdn,
    });

    if (res.data.custom_labels) {
      const labels = Buffer.from(res.data.custom_labels, 'base64').toString('utf-8');
      console.log('[Raw Custom Labels]:\n', labels);
    }
  } catch (err) {
    console.error(err.response?.data || err.message);
  }
}

inspectAppStatus();
