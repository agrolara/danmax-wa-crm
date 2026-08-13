const axios = require('axios');

async function checkAndCreateDB() {
  const coolifyUrl = 'http://148.116.104.222:8000';
  const apiToken = '1|6PdqwcucWGKSKnK9bykViP4ArSmuXPv8wArWFPBq5b5ba9b0';
  const projectUuid = 'j14368aqnfema32im3jg4r30';
  const serverUuid = 'qn2r9xg919nevpdzr3fpu5zk';

  // Check for existing databases or services
  console.log('[Checking existing services]...');
  try {
    const res = await axios.get(`${coolifyUrl}/api/v1/services`, {
      headers: { Authorization: `Bearer ${apiToken}` },
    });
    console.log('[Services]:', res.data?.length || 0);
    if (res.data && res.data.length > 0) {
      res.data.forEach((svc) => {
        console.log(`  - ${svc.name} (UUID: ${svc.uuid}, Type: ${svc.type})`);
      });
    }
  } catch (err) {
    console.error('[Services Error]:', err.response?.data || err.message);
  }

  // Create PostgreSQL database for DanMax WA
  console.log('\n[Creating PostgreSQL database for DanMax WA]...');
  try {
    const res = await axios.post(
      `${coolifyUrl}/api/v1/databases`,
      {
        server_uuid: serverUuid,
        project_uuid: projectUuid,
        environment_name: 'production',
        type: 'postgresql',
        name: 'danmax-wa-db',
        postgres_user: 'danmax_admin',
        postgres_password: 'DanMax2026SecureDB!',
        postgres_db: 'crm_danmax_wa',
      },
      { headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' } }
    );
    console.log('[PostgreSQL DB Created!]:', res.data);
  } catch (err) {
    console.error('[DB Creation Error]:', JSON.stringify(err.response?.data, null, 2));
  }
}

checkAndCreateDB();
