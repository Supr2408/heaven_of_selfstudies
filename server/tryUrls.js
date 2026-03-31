const axios = require('axios');

(async () => {
  // Try different URLs for Data Mining
  const urls = [
    'https://nptel.ac.in/courses/106105174/',
    'https://nptel.ac.in/courses/106105174',
    'https://onlinecourses.nptel.ac.in/noc25_cs51/announcements',  // example
    'https://nptel.ac.in/nocs/noc25',
  ];

  for (const url of urls) {
    try {
      console.log(`\nFetching: ${url}`);
      const { data } = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 5000
      });
      console.log(`Status: OK, Length: ${data.length}`);
      // Look for noc patterns
      const nocMatches = data.match(/noc\d+[_-]?[a-z]+\d+/gi) || [];
      if (nocMatches.length > 0) {
        console.log('NOC codes:', [...new Set(nocMatches)].slice(0, 5));
      }
    } catch (err) {
      console.log(`Error: ${err.response?.status || err.message}`);
    }
  }
})();
