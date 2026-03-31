const axios = require('axios');

// Try a wider range for Data Mining
// Pattern: nocYY_(dm|data_mining|datamining)(numbers)
(async () => {
  const codes = [];
  
  // Test years 22-26 and common patterns
  for (let year = 22; year <= 26; year++) {
    for (let abbr of ['dm', 'dm7', 'dm77', 'dm70', 'dm80']) {
      codes.push(`noc${year}_${abbr}`);
    }
    // Also test without numbers
    for (let num = 70; num <= 90; num++) {
      codes.push(`noc${year}_dm${num}`);
    }
  }

  console.log(`Testing ${codes.length} codes...\n`);
  const found = [];

  for (const code of codes) {
    const url = `https://onlinecourses.nptel.ac.in/${code}/announcements`;
    try {
      const { data, status } = await axios.get(url, {
        timeout: 4000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      if (status === 200 && data && data.length > 100) {
        if (!data.includes('404') && !data.includes('not found')) {
          found.push(code);
          console.log(`✅ ${code}`);
        }
      }
    } catch (err) {
      // Ignore
    }
  }

  console.log(`\nFound ${found.length} working codes:`, found);
})();
