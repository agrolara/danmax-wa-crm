const axios = require('axios');

async function getSupabaseDetails() {
  const coolifyUrl = 'http://148.116.104.222:8000';
  const apiToken = '1|6PdqwcucWGKSKnK9bykViP4ArSmuXPv8wArWFPBq5b5ba9b0';
  const supabaseUuid = 'obeeeqjmzidubyprkz8g7dew';

  try {
    const res = await axios.get(`${coolifyUrl}/api/v1/services/${supabaseUuid}`, {
      headers: { Authorization: `Bearer ${apiToken}` },
    });

    console.log('[Supabase Service Details]:');
    console.log('  Name:', res.data.name);
    console.log('  Status:', res.data.status);
    console.log('  Type:', res.data.type);

    // Look for database connection info in environment variables
    if (res.data.environment_variables) {
      console.log('\n[Supabase ENV Vars]:');
      res.data.environment_variables.forEach((e) => {
        if (e.key.includes('POSTGRES') || e.key.includes('DB') || e.key.includes('DATABASE') || e.key.includes('PORT') || e.key.includes('HOST')) {
          console.log(`  ${e.key} = ${e.value}`);
        }
      });
    }

    // Check for compose file or service-level details
    if (res.data.docker_compose) {
      console.log('\n[Docker Compose (first 500 chars)]:', res.data.docker_compose?.substring(0, 500));
    }

    // Look for internal domains
    if (res.data.applications) {
      console.log('\n[Supabase Sub-Applications]:');
      res.data.applications.forEach((app) => {
        console.log(`  - ${app.name} (FQDN: ${app.fqdn})`);
      });
    }

    // Print all top-level keys for inspection
    console.log('\n[Top-Level Keys]:', Object.keys(res.data));
  } catch (err) {
    console.error('[Error]:', err.response?.data || err.message);
  }
}

getSupabaseDetails();
