const axios = require('axios');

async function testOpenWARoutes() {
  const url = 'https://whatsapp-autopublicaciones.agrolara.dedyn.io';
  const key = 'danmax_openwa_admin_key'; // or check ENV

  console.log(`[Testing OpenWA endpoints at ${url}]...`);

  // 1. Test GET /api/sessions
  try {
    const res = await axios.get(`${url}/api/sessions`, {
      headers: { 'X-API-Key': key },
    });
    console.log('[GET /api/sessions Success]:', res.data);
  } catch (err) {
    console.error('[GET /api/sessions Error]:', err.response?.data || err.message);
  }

  // 2. Test POST /api/sessions with body { name: "pizzeria" }
  try {
    const res = await axios.post(
      `${url}/api/sessions`,
      { name: 'pizzeria' },
      { headers: { 'X-API-Key': key, 'Content-Type': 'application/json' } }
    );
    console.log('[POST /api/sessions Success]:', res.data);
  } catch (err) {
    console.error('[POST /api/sessions Error]:', err.response?.data || err.message);
  }

  // 3. Test POST /api/sessions/pizzeria/start
  try {
    const res = await axios.post(
      `${url}/api/sessions/pizzeria/start`,
      {},
      { headers: { 'X-API-Key': key } }
    );
    console.log('[POST /api/sessions/pizzeria/start Success]:', res.data);
  } catch (err) {
    console.error('[POST /api/sessions/pizzeria/start Error]:', err.response?.data || err.message);
  }
}

testOpenWARoutes();
