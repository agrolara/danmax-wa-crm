const axios = require('axios');

async function inspectSendTextSchema() {
  const url = 'https://whatsapp-autopublicaciones.agrolara.dedyn.io';
  const key = 'Agro1280@';

  const res = await axios.get(`${url}/api/docs-json`, {
    headers: { 'X-API-Key': key },
  });

  const pathObj = res.data?.paths?.['/api/sessions/{sessionId}/messages/send-text'];
  console.log('[POST /api/sessions/{sessionId}/messages/send-text Schema]:');
  console.log(JSON.stringify(pathObj, null, 2));
}

inspectSendTextSchema();
