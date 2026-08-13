const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

const url = (process.env.OPENWA_API_URL || 'https://whatsapp-autopublicaciones.agrolara.dedyn.io').replace(/\/$/, '');
const adminKey = process.env.OPENWA_ADMIN_KEY;

async function testFullFlow() {
  console.log('--- TESTING FULL NESTJS OPENWA API FLOW ---');
  const sessionId = '78146919-6c52-4c31-b9e9-a4734b7355b8';

  console.log(`1. Calling POST /api/sessions/${sessionId}/start ...`);
  try {
    const resStart = await axios.post(`${url}/api/sessions/${sessionId}/start`, {}, {
      headers: { 'X-API-Key': adminKey }
    });
    console.log('START SUCCESS:', JSON.stringify(resStart.data, null, 2));
  } catch (e) {
    console.log('START FAIL:', e.response?.status, e.response?.data || e.message);
  }

  // Wait 2 seconds for QR to generate
  await new Promise(r => setTimeout(r, 2000));

  console.log(`\n2. Calling GET /api/sessions/${sessionId}/qr ...`);
  try {
    const resQr = await axios.get(`${url}/api/sessions/${sessionId}/qr`, {
      headers: { 'X-API-Key': adminKey }
    });
    console.log('GET QR SUCCESS:', JSON.stringify(resQr.data, null, 2));
  } catch (e) {
    console.log('GET QR FAIL:', e.response?.status, e.response?.data || e.message);
  }
}

testFullFlow();
