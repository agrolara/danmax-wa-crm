const axios = require('axios');

async function getSupabaseDBInfo() {
  const coolifyUrl = 'http://148.116.104.222:8000';
  const apiToken = '1|6PdqwcucWGKSKnK9bykViP4ArSmuXPv8wArWFPBq5b5ba9b0';
  const supabaseUuid = 'obeeeqjmzidubyprkz8g7dew';

  try {
    const res = await axios.get(`${coolifyUrl}/api/v1/services/${supabaseUuid}`, {
      headers: { Authorization: `Bearer ${apiToken}` },
    });

    // Check databases array
    if (res.data.databases && res.data.databases.length > 0) {
      console.log('[Supabase Databases]:');
      res.data.databases.forEach((db) => {
        console.log(`  - Name: ${db.name}`);
        console.log(`    Image: ${db.image}`);
        console.log(`    FQDN: ${db.fqdn}`);
        console.log(`    Internal Host: ${db.internal_host || 'N/A'}`);
        console.log(`    Ports: ${db.ports_mappings || 'N/A'}`);
        console.log(`    Public Port: ${db.public_port || 'N/A'}`);
        console.log('');
      });
    }

    // Extract env vars from compose
    const compose = res.data.docker_compose || '';
    const pgLines = compose.split('\n').filter(l =>
      l.includes('POSTGRES') || l.includes('5432') || l.includes('password') || l.includes('SERVICE_PASSWORD')
    );
    console.log('[PostgreSQL-related compose lines]:');
    pgLines.forEach(l => console.log(' ', l.trim()));

    // Check service env vars
    console.log('\n[Checking service-level envs via /envs endpoint]...');
    try {
      const envsRes = await axios.get(`${coolifyUrl}/api/v1/services/${supabaseUuid}/envs`, {
        headers: { Authorization: `Bearer ${apiToken}` },
      });
      const pgEnvs = envsRes.data?.filter(e =>
        e.key?.includes('POSTGRES') || e.key?.includes('PASSWORD') || e.key?.includes('DB') || e.key?.includes('DATABASE')
      ) || [];
      console.log('[DB-related service envs]:');
      pgEnvs.forEach(e => console.log(`  ${e.key} = ${e.value}`));
    } catch (err2) {
      console.log('[No /envs endpoint]:', err2.response?.status);
    }

  } catch (err) {
    console.error('[Error]:', err.response?.data || err.message);
  }
}

getSupabaseDBInfo();
