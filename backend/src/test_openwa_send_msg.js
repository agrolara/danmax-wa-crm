const axios = require('axios');

async function testOpenWASendMsg() {
  const url = 'https://whatsapp-autopublicaciones.agrolara.dedyn.io';
  const key = 'Agro1280@';

  console.log('[1. Fetching active sessions]...');
  const sessionsRes = await axios.get(`${url}/api/sessions`, {
    headers: { 'X-API-Key': key },
  });

  const readySession = sessionsRes.data.find((s) => s.status === 'ready' || s.status === 'CONNECTED');
  if (!readySession) {
    console.log('No ready session');
    return;
  }

  console.log(`[Ready Session]: ID: ${readySession.id}, Name: ${readySession.name}`);

  // Test target chat ID: "120363027909877164@g.us" or "198767009644574@lid" or phone
  const testEndpoints = [
    `/api/sessions/${readySession.id}/message/text`,
    `/api/sessions/${readySession.id}/messages/text`,
    `/api/sessions/${readySession.id}/messages`,
    `/api/sessions/${readySession.id}/send-text`,
    `/api/sessions/${readySession.id}/chats/send`,
  ];

  const targetRecipient = '120363027909877164@g.us'; // group
  const sampleText = 'Prueba de envio desde CRM DanMax WA';

  for (const ep of testEndpoints) {
    console.log(`\nTesting POST ${url}${ep}...`);
    try {
      const res = await axios.post(
        `${url}${ep}`,
        { to: targetRecipient, text: sampleText, content: sampleText, message: sampleText, chatId: targetRecipient },
        {
          headers: { 'X-API-Key': key, 'Content-Type': 'application/json' },
          timeout: 8000,
        }
      );
      console.log(`✅ SUCCESS on ${ep}:`, JSON.stringify(res.data, null, 2));
      break;
    } catch (err) {
      console.log(`❌ FAILED on ${ep}: Status ${err.response?.status} -`, JSON.stringify(err.response?.data || err.message));
    }
  }
}

testOpenWASendMsg();
