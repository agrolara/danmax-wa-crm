const axios = require('axios');

async function debugContactPhone() {
  const url = 'https://whatsapp-autopublicaciones.agrolara.dedyn.io';
  const key = 'Agro1280@';

  const sessionsRes = await axios.get(`${url}/api/sessions`, {
    headers: { 'X-API-Key': key },
  });

  const readySession = sessionsRes.data.find((s) => s.status === 'ready' || s.status === 'CONNECTED');
  if (!readySession) return;

  const chatsRes = await axios.get(`${url}/api/sessions/${readySession.id}/chats`, {
    headers: { 'X-API-Key': key },
  });

  const chats = chatsRes.data;
  const targetChat = chats.find((c) => c.name?.includes('PIZZERIA DEL VALLE') || c.id?.includes('198767009644574'));

  console.log('[Target Chat Full Keys & Object]:');
  console.log(JSON.stringify(targetChat, null, 2));
}

debugContactPhone();
