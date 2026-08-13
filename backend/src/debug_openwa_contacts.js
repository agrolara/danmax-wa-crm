const axios = require('axios');

async function debugOpenWAContacts() {
  const url = 'https://whatsapp-autopublicaciones.agrolara.dedyn.io';
  const key = 'Agro1280@';

  const sessionsRes = await axios.get(`${url}/api/sessions`, {
    headers: { 'X-API-Key': key },
  });

  const readySession = sessionsRes.data.find((s) => s.status === 'ready' || s.status === 'CONNECTED');
  if (!readySession) return;

  console.log(`[Fetching contacts for session "${readySession.name}" (${readySession.id})]...`);

  try {
    const contactsRes = await axios.get(`${url}/api/sessions/${readySession.id}/contacts`, {
      headers: { 'X-API-Key': key },
    });

    console.log('[Contacts Count]:', contactsRes.data?.length || 0);

    const contacts = Array.isArray(contactsRes.data) ? contactsRes.data : [];
    const targetContact = contacts.find(
      (c) => c.id?.includes('198767009644574') || c.name?.includes('PIZZERIA DEL VALLE') || c.pushname?.includes('PIZZERIA DEL VALLE')
    );

    if (targetContact) {
      console.log('[Target Contact Found]:', JSON.stringify(targetContact, null, 2));
    } else {
      console.log('[First 3 Contacts Sample]:', JSON.stringify(contacts.slice(0, 3), null, 2));
    }
  } catch (err) {
    console.error('[Error fetching contacts]:', err.response?.data || err.message);
  }
}

debugOpenWAContacts();
