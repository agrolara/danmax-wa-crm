const axios = require('axios');

async function discoverOpenWARoutes() {
  const url = 'https://whatsapp-autopublicaciones.agrolara.dedyn.io';
  const key = 'Agro1280@';

  const sessionsRes = await axios.get(`${url}/api/sessions`, {
    headers: { 'X-API-Key': key },
  });

  const readySession = sessionsRes.data.find((s) => s.status === 'ready' || s.status === 'CONNECTED');
  const uuid = readySession.id;

  console.log(`[Discovering Message Routes for Session UUID: ${uuid}]...`);

  const candidates = [
    { method: 'post', path: `/api/sessions/${uuid}/sendText` },
    { method: 'post', path: `/api/sessions/${uuid}/send-text` },
    { method: 'post', path: `/api/sessions/${uuid}/sendText` },
    { method: 'post', path: `/api/sessions/${uuid}/send-message` },
    { method: 'post', path: `/api/sessions/${uuid}/sendMessage` },
    { method: 'post', path: `/api/sessions/${uuid}/chat/send` },
    { method: 'post', path: `/api/sessions/${uuid}/chats/send-message` },
    { method: 'post', path: `/api/sessions/${uuid}/messages/send` },
    { method: 'post', path: `/api/sessions/${uuid}/messages` },
    { method: 'post', path: `/api/sessions/${uuid}/chats/120363027909877164@g.us/messages` },
    { method: 'post', path: `/api/sessions/${uuid}/chats/120363027909877164@g.us/send` },
    { method: 'post', path: `/api/sessions/${uuid}/chats/120363027909877164@g.us/text` },
    { method: 'post', path: `/api/messages` },
    { method: 'post', path: `/api/messages/send` },
    { method: 'post', path: `/api/chats/send` },
  ];

  for (const c of candidates) {
    try {
      const res = await axios({
        method: c.method,
        url: `${url}${c.path}`,
        headers: { 'X-API-Key': key, 'Content-Type': 'application/json' },
        data: {
          to: '120363027909877164@g.us',
          chatId: '120363027909877164@g.us',
          text: 'Test probe',
          message: 'Test probe',
          content: 'Test probe',
          sessionId: uuid,
        },
        timeout: 5000,
      });

      console.log(`🎉 SUCCESS ROUTE FOUND! [${c.method.toUpperCase()} ${c.path}]:`, res.status, JSON.stringify(res.data));
    } catch (err) {
      if (err.response?.status !== 404) {
        console.log(`💡 ROUTE EXISTS! (Status ${err.response?.status}) [${c.method.toUpperCase()} ${c.path}]:`, JSON.stringify(err.response?.data || err.message));
      }
    }
  }
}

discoverOpenWARoutes();
