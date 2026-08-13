const axios = require('axios');

async function updateDatabaseUrl() {
  const coolifyUrl = 'http://148.116.104.222:8000';
  const apiToken = '1|6PdqwcucWGKSKnK9bykViP4ArSmuXPv8wArWFPBq5b5ba9b0';
  const appUuid = 'tpu9apsacq91bw8ap1iswjwu';

  // Supabase PostgreSQL connection using Docker internal network
  // Host: supabase-db (internal Docker hostname)
  // Port: 5432
  // User: postgres
  // Password: doPMydibkn0W9afaxFMSSwc4Krhi1IZt
  // Database: postgres (we'll use a schema for isolation)
  const correctDatabaseUrl = 'postgresql://postgres:doPMydibkn0W9afaxFMSSwc4Krhi1IZt@supabase-db:5432/postgres?schema=danmax_wa';

  // First delete the old DATABASE_URL env var
  console.log('[Step 1: Getting current env vars to find DATABASE_URL UUID]...');
  try {
    const envsRes = await axios.get(`${coolifyUrl}/api/v1/applications/${appUuid}/envs`, {
      headers: { Authorization: `Bearer ${apiToken}` },
    });

    console.log('[Current ENV vars]:');
    envsRes.data.forEach(e => console.log(`  ${e.key} = ${e.value?.substring(0, 50)}... (UUID: ${e.uuid})`));

    // Find and delete the old DATABASE_URL
    const dbUrlEnv = envsRes.data.find(e => e.key === 'DATABASE_URL');
    if (dbUrlEnv) {
      console.log(`\n[Step 2: Deleting old DATABASE_URL (${dbUrlEnv.uuid})]...`);
      await axios.delete(`${coolifyUrl}/api/v1/applications/${appUuid}/envs/${dbUrlEnv.uuid}`, {
        headers: { Authorization: `Bearer ${apiToken}` },
      });
      console.log('[Old DATABASE_URL deleted]');
    }

    // Add correct DATABASE_URL
    console.log('\n[Step 3: Adding correct DATABASE_URL]...');
    const res = await axios.post(
      `${coolifyUrl}/api/v1/applications/${appUuid}/envs`,
      { key: 'DATABASE_URL', value: correctDatabaseUrl },
      { headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' } }
    );
    console.log('[New DATABASE_URL added]:', res.data);

    // Restart
    console.log('\n[Step 4: Restarting app]...');
    const restartRes = await axios.post(
      `${coolifyUrl}/api/v1/applications/${appUuid}/restart`,
      {},
      { headers: { Authorization: `Bearer ${apiToken}` } }
    );
    console.log('[Restart Triggered]:', restartRes.data);

  } catch (err) {
    console.error('[Error]:', err.response?.data || err.message);
  }
}

updateDatabaseUrl();
