const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

const url = (process.env.OPENWA_API_URL || 'https://whatsapp-autopublicaciones.agrolara.dedyn.io').replace(/\/$/, '');
const adminKey = process.env.OPENWA_ADMIN_KEY;

async function checkAll() {
  console.log('--- DEBUG ALL SESSIONS & CHATS ---');

  try {
    // 1. Get all sessions
    const sessionsRes = await axios.get(`${url}/api/sessions`, {
      headers: { 'X-API-Key': adminKey }
    });
    console.log('ACTIVE SESSIONS ON OPENWA:', JSON.stringify(sessionsRes.data, null, 2));

    for (const session of sessionsRes.data) {
      console.log(`\n========================================`);
      console.log(`Checking Session: ID=${session.id}, Name=${session.name}, Status=${session.status}, Phone=${session.phone}`);

      // Try GET /api/sessions/:id/chats
      try {
        const chatsRes = await axios.get(`${url}/api/sessions/${session.id}/chats`, {
          headers: { 'X-API-Key': adminKey }
        });
        console.log(`Chats for ${session.name}:`, JSON.stringify(chatsRes.data, null, 2));
      } catch (e) {
        console.log(`GET /chats error for ${session.name}:`, e.response?.data || e.message);
      }

      // Try GET /api/sessions/:id/messages
      try {
        const msgsRes = await axios.get(`${url}/api/sessions/${session.id}/messages`, {
          headers: { 'X-API-Key': adminKey }
        });
        const msgList = Array.isArray(msgsRes.data?.data) ? msgsRes.data.data : Array.isArray(msgsRes.data) ? msgsRes.data : [];
        console.log(`Messages count for ${session.name}: ${msgList.length}`);
        if (msgList.length > 0) {
          console.log(`Sample Message:`, JSON.stringify(msgList[msgList.length - 1], null, 2));
        }
      } catch (e) {
        console.log(`GET /messages error for ${session.name}:`, e.response?.data || e.message);
      }
    }
  } catch (err) {
    console.error('Error listing sessions:', err.response?.data || err.message);
  }
}

checkAll();
