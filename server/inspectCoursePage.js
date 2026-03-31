const axios = require('axios');
const cheerio = require('cheerio');

(async () => {
  // Fetch the course page for Data Mining (ID 106105174)
  const courseUrl = 'https://nptel.ac.in/courses/106105174';
  console.log('Fetching:', courseUrl);
  
  const { data } = await axios.get(courseUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    },
    timeout: 10000
  });

  const $ = cheerio.load(data);
  
  // Look for tables with course codes
  console.log('\n=== TABLES FOUND ===');
  $('table').each((tIdx, table) => {
    console.log(`\nTable ${tIdx + 1}:`);
    $(table).find('tr').slice(0, 10).forEach((rIdx, row) => {
      const cells = $(row).find('td, th');
      const rowData = cells.map((_, cell) => $(cell).text().trim().slice(0, 50)).get();
      console.log(rowData.join(' | '));
    });
  });

  // Look for any text with 'noc' codes
  console.log('\n=== NOC CODES IN PAGE ===');
  const bodyText = $.text();
  const nocMatches = bodyText.match(/noc\d+[_-]?[a-z]+\d+/gi) || [];
  console.log('NOC codes found:', [...new Set(nocMatches)].slice(0, 10));
})();
