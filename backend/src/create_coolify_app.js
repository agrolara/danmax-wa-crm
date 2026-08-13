const axios = require('axios');

async function createCoolifyApplication() {
  const coolifyUrl = 'http://148.116.104.222:8000';
  const apiToken = '1|6PdqwcucWGKSKnK9bykViP4ArSmuXPv8wArWFPBq5b5ba9b0';
  const projectUuid = 'j14368aqnfema32im3jg4r30';
  const serverUuid = 'qn2r9xg919nevpdzr3fpu5zk';
  const environmentName = 'production';
  const repo = 'https://github.com/agrolara/danmax-wa-crm.git';
  const branch = 'master';
  const fqdn = 'https://danmax-crm.agrolara.dedyn.io';

  console.log('[Creating Coolify Application for DanMax WA]...');

  try {
    const res = await axios.post(
      `${coolifyUrl}/api/v1/applications/public`,
      {
        project_uuid: projectUuid,
        server_uuid: serverUuid,
        environment_name: environmentName,
        git_repository: repo,
        git_branch: branch,
        build_pack: 'dockerfile',
        ports_exposes: '3000,4000',
      },
      {
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('[Coolify App Created Successfully!]:', res.data);
    const appUuid = res.data?.uuid;

    if (appUuid) {
      console.log(`[Updating FQDN to ${fqdn}]...`);
      try {
        await axios.patch(
          `${coolifyUrl}/api/v1/applications/${appUuid}`,
          { fqdn },
          {
            headers: { Authorization: `Bearer ${apiToken}` },
          }
        );
        console.log('[FQDN updated successfully!]');
      } catch (fqdnErr) {
        console.warn('[FQDN Patch Warning]:', fqdnErr.response?.data || fqdnErr.message);
      }

      console.log(`[Deploying App UUID: ${appUuid}]...`);
      const deployRes = await axios.post(
        `${coolifyUrl}/api/v1/deploy`,
        { uuid: appUuid },
        {
          headers: { Authorization: `Bearer ${apiToken}` },
        }
      );
      console.log('[Deployment Triggered!]:', deployRes.data);
    }
  } catch (err) {
    console.error('[Coolify App Creation Error]:', err.response?.data || err.message);
  }
}

createCoolifyApplication();
