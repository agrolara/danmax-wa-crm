const axios = require('axios');

async function setCleanTraefikLabels() {
  const coolifyUrl = 'http://148.116.104.222:8000';
  const apiToken = '1|6PdqwcucWGKSKnK9bykViP4ArSmuXPv8wArWFPBq5b5ba9b0';
  const appUuid = 'tpu9apsacq91bw8ap1iswjwu';
  const domain = 'crm-danmax-wa.agrolara.dedyn.io';
  const port = '4500';

  const cleanConfig = [
    'traefik.enable=true',
    'traefik.http.middlewares.gzip.compress=true',
    'traefik.http.middlewares.redirect-to-https.redirectscheme.scheme=https',
    `traefik.http.routers.http-0-${appUuid}.entryPoints=http`,
    `traefik.http.routers.http-0-${appUuid}.middlewares=redirect-to-https`,
    `traefik.http.routers.http-0-${appUuid}.rule=Host(\`${domain}\`) && PathPrefix(\`/\`)`,
    `traefik.http.routers.http-0-${appUuid}.service=http-0-${appUuid}`,
    `traefik.http.routers.https-0-${appUuid}.entryPoints=https`,
    `traefik.http.routers.https-0-${appUuid}.middlewares=gzip`,
    `traefik.http.routers.https-0-${appUuid}.rule=Host(\`${domain}\`) && PathPrefix(\`/\`)`,
    `traefik.http.routers.https-0-${appUuid}.service=https-0-${appUuid}`,
    `traefik.http.routers.https-0-${appUuid}.tls.certresolver=letsencrypt`,
    `traefik.http.routers.https-0-${appUuid}.tls=true`,
    `traefik.http.services.http-0-${appUuid}.loadbalancer.server.port=${port}`,
    `traefik.http.services.https-0-${appUuid}.loadbalancer.server.port=${port}`,
    'caddy_0.encode=zstd gzip',
    `caddy_0.handle_path.0_reverse_proxy={{upstreams ${port}}}`,
    'caddy_0.handle_path=/*',
    'caddy_0.header=-Server',
    'caddy_0.try_files={path} /index.html /index.php',
    `caddy_0=https://${domain}`,
    'caddy_ingress_network=coolify',
  ].join('\n');

  console.log('[Generated Clean Config]:\n', cleanConfig);

  const base64Labels = Buffer.from(cleanConfig, 'utf-8').toString('base64');

  try {
    const res = await axios.patch(
      `${coolifyUrl}/api/v1/applications/${appUuid}`,
      { custom_labels: base64Labels },
      { headers: { Authorization: `Bearer ${apiToken}` } }
    );
    console.log('[Clean Base64 Labels Set Successfully!]:', res.data);

    // Redeploy to apply Traefik / Caddy routing rules
    const deployRes = await axios.post(
      `${coolifyUrl}/api/v1/deploy`,
      { uuid: appUuid },
      { headers: { Authorization: `Bearer ${apiToken}` } }
    );
    console.log('[Redeploy Triggered!]:', deployRes.data);
  } catch (err) {
    console.error('[Error Setting Clean Labels]:', err.response?.data || err.message);
  }
}

setCleanTraefikLabels();
