const axios = require('axios');

(async () => {
  const courseId = 106105174; // Data Mining from IIT Kharagpur
  const courseUrl = `https://nptel.ac.in/courses/${courseId}`;
  
  const { data } = await axios.get(courseUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });

  // Look for any script tags with JSON data
  const scripts = data.match(/<script[^>]*>([\s\S]*?)<\/script>/g) || [];
  console.log(`Found ${scripts.length} script tags\n`);

  let allNocCodes = [];
  let foundData = false;

  scripts.forEach((script, idx) => {
    // Look for NOC codes
    const nocMatches = script.match(/noc\d+[_-]?[a-z]+\d+/gi) || [];
    if (nocMatches.length > 0) {
      console.log(`Script ${idx}: Found NOC codes:`, [...new Set(nocMatches)].slice(0, 5));
      allNocCodes.push(...nocMatches);
      foundData = true;
    }

    // Look for JSON with course info
    if (script.includes('"courseCode"') || script.includes('"noc') || script.includes('runs')) {
      console.log(`Script ${idx}: Contains course data`);
      const jsonMatch = script.match(/"[^"]*":"[^"]*"/);
      if (jsonMatch) {
        console.log(`  Sample JSON: ${jsonMatch[0]}`);
      }
      foundData = true;
    }
  });

  console.log('\nAll NOC codes found:', [...new Set(allNocCodes)].slice(0, 20));

  if (!foundData) {
    console.log('\nNo course data found in scripts. Trying to fetch API directly...');
    const apiUrl = `https://nptel.ac.in/api/course/${courseId}`;
    try {
      const apiRes = await axios.get(apiUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
      });
      console.log('API Response:', JSON.stringify(apiRes.data).slice(0, 500));
    } catch (err) {
      console.log(`API error: ${err.response?.status || err.message}`);
    }
  }
})();
