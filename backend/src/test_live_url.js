const axios = require('axios');

async function testLiveUrl() {
  const url = 'https://crm-danmax-wa.agrolara.dedyn.io';

  console.log(`[Testing connection to ${url}]...`);

  try {
    const healthRes = await axios.get(`${url}/health`, { timeout: 10000 });
    console.log('[Health Endpoint Success!]:', healthRes.data);
  } catch (err) {
    console.log('[Health Endpoint Warning]:', err.message);
  }

  try {
    const mainRes = await axios.get(url, { timeout: 10000 });
    console.log('[Main Site Success!]: Status Code:', mainRes.status, 'Content-Length:', mainRes.data?.length);
  } catch (err) {
    console.error('[Main Site Error]:', err.message);
  }
}

testLiveUrl();
