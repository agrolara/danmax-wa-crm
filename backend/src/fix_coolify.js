const axios = require('axios');

async function fixDomainAndPorts() {
  const coolifyUrl = 'http://148.116.104.222:8000';
  const apiToken = '1|6PdqwcucWGKSKnK9bykViP4ArSmuXPv8wArWFPBq5b5ba9b0';
  
  // The app the user is looking at in the UI
  const appUuid = 'tpu9apsacq91bw8ap1iswjwu';
  const newDomain = 'https://crm-danmax-wa.agrolara.dedyn.io';

  console.log('=== Step 1: Try updating domain via "domains" field ===');
  try {
    const res = await axios.patch(
      `${coolifyUrl}/api/v1/applications/${appUuid}`,
      { domains: newDomain },
      { headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' } }
    );
    console.log('[domains update]:', res.data);
  } catch (err) {
    console.error('[domains update error]:', err.response?.data || err.message);
  }

  console.log('\n=== Step 2: Check all patchable fields ===');
  try {
    // Try updating ports to 4500 to avoid conflict
    const res2 = await axios.patch(
      `${coolifyUrl}/api/v1/applications/${appUuid}`,
      { ports_exposes: '4500', name: 'danmax-wa-crm' },
      { headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' } }
    );
    console.log('[ports/name update]:', res2.data);
  } catch (err) {
    console.error('[ports/name update error]:', err.response?.data || err.message);
  }

  console.log('\n=== Step 3: Delete duplicate apps ===');
  const duplicates = ['b12vfxigz7vkx0u20cawbvxj', 'tiyl6gm3hqxz9y3nqr0xev2b'];
  for (const uuid of duplicates) {
    try {
      const del = await axios.delete(`${coolifyUrl}/api/v1/applications/${uuid}`, {
        headers: { Authorization: `Bearer ${apiToken}` },
      });
      console.log(`[Deleted ${uuid}]:`, del.data);
    } catch (err) {
      console.error(`[Delete ${uuid} error]:`, err.response?.data || err.message);
    }
  }

  console.log('\n=== Step 4: Read back app to verify ===');
  try {
    const verify = await axios.get(`${coolifyUrl}/api/v1/applications/${appUuid}`, {
      headers: { Authorization: `Bearer ${apiToken}` },
    });
    console.log('[Current state]:', {
      name: verify.data.name,
      fqdn: verify.data.fqdn,
      ports_exposes: verify.data.ports_exposes,
      status: verify.data.status,
    });
  } catch (err) {
    console.error('[verify error]:', err.response?.data || err.message);
  }
}

fixDomainAndPorts();
