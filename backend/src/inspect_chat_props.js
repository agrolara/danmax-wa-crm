const axios = require('axios');

async function inspectChatProps() {
  const url = 'https://whatsapp-autopublicaciones.agrolara.dedyn.io';
  const key = 'Agro1280@';

  const sessionsRes = await axios.get(`${url}/api/sessions`, {
    headers: { 'X-API-Key': key },
  });

  const readySession = sessionsRes.data.find((s) => s.status === 'ready' || s.status === 'CONNECTED');
  if (!readySession) {
    console.log('No ready session found');
    return;
  }

  console.log(`[Inspecting chats for READY session "${readySession.name}" (${readySession.id})]...`);

  const chatsRes = await axios.get(`${url}/api/sessions/${readySession.id}/chats`, {
    headers: { 'X-API-Key': key },
  });

  const chats = chatsRes.data;
  console.log('[First 5 Individual Chats]:');
  const individualChats = chats.filter((c) => !c.isGroup && c.kind !== 'group').slice(0, 5);
  individualChats.forEach((c, idx) => {
    console.log(`\nChat ${idx + 1}:`);
    console.log('  id:', c.id);
    console.log('  name:', c.name);
    console.log('  kind:', c.kind);
    console.log('  isGroup:', c.isGroup);
    console.log('  phone / phoneNumber:', c.phone, c.phoneNumber, c.formattedPhone);
    console.log('  contact:', c.contact);
    console.log('  lastMessage:', c.lastMessage);
  });

  console.log('\n[First 5 Group Chats]:');
  const groupChats = chats.filter((c) => c.isGroup || c.kind === 'group' || c.id?.includes('@g.us')).slice(0, 5);
  groupChats.forEach((g, idx) => {
    console.log(`\nGroup ${idx + 1}:`);
    console.log('  id:', g.id);
    console.log('  name:', g.name);
    console.log('  isGroup:', g.isGroup, 'kind:', g.kind);
    console.log('  unreadCount:', g.unreadCount);
  });
}

inspectChatProps();
