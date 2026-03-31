const axios = require('axios');

// Try common Data Mining NOC codes based on NPTEL patterns
// Typical pattern: nocYY_(abbreviation)(number)
const dmCodes = [
  'noc24_dm77',
  'noc25_dm77',
  'noc26_dm77',
  'noc23_dm77',
  'noc25_cs51',  // example to test
  'noc24_cs51',
];

(async () => {
  console.log('Testing NOC codes...\n');
  for (const code of dmCodes) {
    const url = `https://onlinecourses.nptel.ac.in/${code}/announcements`;
    try {
      const { data } = await axios.get(url, {
        timeout: 5000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      if (data && data.length > 100) {
        console.log(`✅ FOUND: ${code}`);
        // Check for actual content
        if (data.includes('Data Mining') || data.includes('Pabitra')) {
          console.log('   Contains Data Mining course info');
        }
      }
    } catch (err) {
      // 404 or timeout - code doesn't exist
    }
  }
})();
