const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

const url = (process.env.OPENWA_API_URL || 'https://whatsapp-autopublicaciones.agrolara.dedyn.io').replace(/\/$/, '');
const adminKey = process.env.OPENWA_ADMIN_KEY;
const sessionId = '78146919-6c52-4c31-b9e9-a4734b7355b8'; // Session for pizzeria-crm-tenant

async function testMessages() {
  console.log('--- TESTING OPENWA CHATS & MESSAGES FETCH ---');

  // 1. GET /api/sessions/:id/chats
  try {
    console.log(`1. Calling GET /api/sessions/${sessionId}/chats ...`);
    const resChats = await axios.get(`${url}/api/sessions/${sessionId}/chats`, {
      headers: { 'X-API-Key': adminKey }
    });
    console.log('CHATS SUCCESS:', JSON.stringify(resChats.data, null, 2));
  } catch (e) {
    console.log('CHATS FAIL:', e.response?.status, e.response?.data || e.message);
  }

  // 2. GET /api/sessions/:id/messages
  try {
    console.log(`\n2. Calling GET /api/sessions/${sessionId}/messages ...`);
    const resMsgs = await axios.get(`${url}/api/sessions/${sessionId}/messages`, {
      headers: { 'X-API-Key': adminKey }
    });
    console.log('MESSAGES SUCCESS:', JSON.stringify(resMsgs.data, null, 2));
  } catch (e) {
    console.log('MESSAGES FAIL:', e.response?.status, e.response?.data || e.message);
  }
}

testMessages();
