const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

const url = (process.env.OPENWA_API_URL || 'https://whatsapp-autopublicaciones.agrolara.dedyn.io').replace(/\/$/, '');
const adminKey = process.env.OPENWA_ADMIN_KEY;

console.log('--- OPENWA DIAGNOSTIC SCRIPT ---');
console.log('Target URL:', url);
console.log('Admin Key Present:', !!adminKey);

async function run() {
  try {
    console.log('\n1. Testing GET /api/sessions ...');
    const resSessions = await axios.get(`${url}/api/sessions`, {
      headers: { 'X-API-Key': adminKey },
    });
    console.log('Sessions Result:', JSON.stringify(resSessions.data, null, 2));

    console.log('\n2. Testing POST /api/sessions/start ...');
    const resStart = await axios.post(
      `${url}/api/sessions/start`,
      { sessionId: 'test_tenant_diag', webhook: 'http://localhost:4000/api/webhooks/whatsapp' },
      { headers: { 'X-API-Key': adminKey } }
    );
    console.log('Start Result:', JSON.stringify(resStart.data, null, 2));

    console.log('\n3. Testing GET /api/sessions/test_tenant_diag/qr ...');
    try {
      const resQr = await axios.get(`${url}/api/sessions/test_tenant_diag/qr`, {
        headers: { 'X-API-Key': adminKey },
      });
      console.log('QR Result:', JSON.stringify(resQr.data, null, 2));
    } catch (e) {
      console.log('QR GET Error:', e.response?.data || e.message);
    }
  } catch (err) {
    console.error('Diagnostic Error:', err.response?.data || err.message);
  }
}

run();
