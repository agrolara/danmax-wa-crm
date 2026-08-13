const axios = require('axios');
const fs = require('fs');

async function deployToCoolify() {
  const coolifyUrl = 'http://148.116.104.222:8000';
  const apiToken = '1|6PdqwcucWGKSKnK9bykViP4ArSmuXPv8wArWFPBq5b5ba9b0';
  const gitRepo = 'agrolara/danmax-wa-crm';
  const fqdn = 'http://crm-danmax.agrolara.dedyn.io';

  console.log(`[Coolify Deploy Script] Initiating connection to ${coolifyUrl}...`);

  try {
    // 1. Get projects from Coolify
    const projectsRes = await axios.get(`${coolifyUrl}/api/v1/projects`, {
      headers: { Authorization: `Bearer ${apiToken}` },
      timeout: 10000,
    });

    console.log('[Coolify Projects Fetched]:', projectsRes.data);

    // 2. Get applications or create application
    const appsRes = await axios.get(`${coolifyUrl}/api/v1/applications`, {
      headers: { Authorization: `Bearer ${apiToken}` },
      timeout: 10000,
    });

    console.log('[Coolify Applications Fetched]:', appsRes.data?.length || 0, 'apps found.');

    fs.writeFileSync(
      'deploy_status.json',
      JSON.stringify(
        {
          coolifyOnline: true,
          projectsCount: projectsRes.data?.length || 0,
          appsCount: appsRes.data?.length || 0,
          repo: gitRepo,
          targetDomain: fqdn,
        },
        null,
        2
      )
    );
  } catch (error) {
    console.error('[Coolify API Error]:', error.response?.data || error.message);
    fs.writeFileSync('deploy_status.json', JSON.stringify({ coolifyOnline: false, error: error.message }, null, 2));
  }
}

deployToCoolify();
