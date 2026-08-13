const axios = require('axios');

async function testOpenWAUuidFlow() {
  const url = 'https://whatsapp-autopublicaciones.agrolara.dedyn.io';
  // Let's test with the admin key from env or test key
  const key = 'Agro1280@'; // or master key

  console.log('[Testing OpenWA NestJS Session UUID Flow]...');

  try {
    const listRes = await axios.get(`${url}/api/sessions`, {
      headers: { 'X-API-Key': key },
    });
    console.log('[GET /api/sessions]:', listRes.data);
  } catch (err) {
    console.error('[Error GET /api/sessions]:', err.response?.data || err.message);
  }
}

testOpenWAUuidFlow();
