const axios = require('axios');

async function redeploy() {
  const coolifyUrl = 'http://148.116.104.222:8000';
  const apiToken = '1|6PdqwcucWGKSKnK9bykViP4ArSmuXPv8wArWFPBq5b5ba9b0';
  const appUuid = 'tpu9apsacq91bw8ap1iswjwu';

  try {
    const res = await axios.post(
      `${coolifyUrl}/api/v1/deploy`,
      { uuid: appUuid },
      { headers: { Authorization: `Bearer ${apiToken}` } }
    );
    console.log('[Redeploy Triggered!]:', res.data);
  } catch (err) {
    console.error('[Error]:', err.response?.data || err.message);
  }
}

redeploy();
