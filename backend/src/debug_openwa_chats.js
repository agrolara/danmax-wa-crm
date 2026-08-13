const axios = require('axios');

async function debugOpenWAChats() {
  const url = 'https://whatsapp-autopublicaciones.agrolara.dedyn.io';
  const key = 'Agro1280@'; // or master key

  console.log('[1. Fetching all active sessions from OpenWA]...');
  try {
    const sessionsRes = await axios.get(`${url}/api/sessions`, {
      headers: { 'X-API-Key': key },
    });
    console.log('[Sessions Found]:', JSON.stringify(sessionsRes.data, null, 2));

    const sessions = Array.isArray(sessionsRes.data)
      ? sessionsRes.data
      : Array.isArray(sessionsRes.data?.data)
      ? sessionsRes.data.data
      : [];

    if (sessions.length === 0) {
      console.log('⚠️ No active sessions found in OpenWA.');
      return;
    }

    for (const session of sessions) {
      console.log(`\n[2. Fetching chats for session "${session.name}" (ID/UUID: ${session.id})]...`);
      try {
        const chatsRes = await axios.get(`${url}/api/sessions/${session.id}/chats`, {
          headers: { 'X-API-Key': key },
        });

        console.log(`[Chats Count for ${session.name}]:`, chatsRes.data?.length || chatsRes.data?.data?.length || 0);

        const chats = Array.isArray(chatsRes.data)
          ? chatsRes.data
          : Array.isArray(chatsRes.data?.data)
          ? chatsRes.data.data
          : [];

        if (chats.length > 0) {
          console.log('[Sample Chat Object 1]:', JSON.stringify(chats[0], null, 2));
          if (chats.length > 1) {
            console.log('[Sample Chat Object 2]:', JSON.stringify(chats[1], null, 2));
          }

          const groupChats = chats.filter((c) => c.isGroup || c.id?.includes('@g.us') || c.jid?.includes('@g.us'));
          console.log(`[Group Chats Found]: ${groupChats.length}`);
          if (groupChats.length > 0) {
            console.log('[Sample Group Object]:', JSON.stringify(groupChats[0], null, 2));
          }
        }
      } catch (err2) {
        console.error(`[Error fetching chats for ${session.id}]:`, err2.response?.data || err2.message);
      }
    }
  } catch (err) {
    console.error('[Error fetching sessions]:', err.response?.data || err.message);
  }
}

debugOpenWAChats();
