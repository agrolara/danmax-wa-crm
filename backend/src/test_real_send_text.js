const axios = require('axios');

async function testRealSendText() {
  const url = 'https://whatsapp-autopublicaciones.agrolara.dedyn.io';
  const key = 'Agro1280@';

  const sessionsRes = await axios.get(`${url}/api/sessions`, {
    headers: { 'X-API-Key': key },
  });

  const readySession = sessionsRes.data.find((s) => s.status === 'ready' || s.status === 'CONNECTED');
  if (!readySession) {
    console.log('No ready session');
    return;
  }

  console.log(`[Testing Real Send Text on Session "${readySession.name}" (${readySession.id})]...`);

  // Test sending to group "120363027909877164@g.us" or contact
  const testChatId = '120363027909877164@g.us';
  const testText = '💬 Prueba de conexión directa desde CRM DanMax WA en vivo';

  try {
    const res = await axios.post(
      `${url}/api/sessions/${readySession.id}/messages/send-text`,
      {
        chatId: testChatId,
        text: testText,
      },
      {
        headers: {
          'X-API-Key': key,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );

    console.log('🎉 SUCCESS! MESSAGE SENT TO WHATSAPP REAL! Result:', JSON.stringify(res.data, null, 2));
  } catch (err) {
    console.error('❌ Error sending message:', err.response?.status, JSON.stringify(err.response?.data || err.message));
  }
}

testRealSendText();
