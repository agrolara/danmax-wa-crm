const axios = require('axios');

async function inspectOpenWASwagger() {
  const url = 'https://whatsapp-autopublicaciones.agrolara.dedyn.io';
  const key = 'Agro1280@';

  const docPaths = [
    '/api/docs-json',
    '/api-json',
    '/api/docs',
    '/docs',
    '/swagger.json',
    '/api/swagger.json',
    '/api/sessions/779adf86-4cd8-4f8b-a1ce-ecc369888133',
  ];

  for (const p of docPaths) {
    try {
      const res = await axios.get(`${url}${p}`, {
        headers: { 'X-API-Key': key },
        timeout: 4000,
      });
      console.log(`[FOUND ${p}]:`, typeof res.data === 'object' ? Object.keys(res.data) : res.data?.slice?.(0, 200));
      if (res.data?.paths) {
        console.log('[API PATHS IN SWAGGER]:', Object.keys(res.data.paths));
      }
    } catch (e) {
      // ignore 404
    }
  }
}

inspectOpenWASwagger();
