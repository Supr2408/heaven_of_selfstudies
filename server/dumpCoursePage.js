const axios = require('axios');
const cheerio = require('cheerio');

(async () => {
  const courseId = 106105174;
  const courseUrl = `https://nptel.ac.in/courses/${courseId}`;
  
  const { data } = await axios.get(courseUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });

  const $ = cheerio.load(data);
  
  // Dump the first 2000 characters of each script
  $('script').each((idx, script) => {
    const content = $(script).html() || '';
    if (content.length > 100) {
      console.log(`\n=== SCRIPT ${idx} (first 1000 chars) ===`);
      console.log(content.slice(0, 1000));
      console.log('...');
    }
  });

  // Also check for any visible text with "run" or "noc"
  const text = $.text().toLowerCase();
  const hasRun = text.includes('run');
  const hasNoc = text.includes('noc');
  console.log(`\nPage contains 'run': ${hasRun}`);
  console.log(`Page contains 'noc': ${hasNoc}`);
})();
