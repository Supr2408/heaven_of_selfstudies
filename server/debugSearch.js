const axios = require('axios');
const cheerio = require('cheerio');

(async () => {
  const url = 'https://nptel.ac.in/courses?search=' + encodeURIComponent('Natural Language Processing');
  const { data } = await axios.get(url);
  const $ = cheerio.load(data);
  const results = [];
  $("a[href*='/courses/']").each((_, el) => {
    const href = $(el).attr('href');
    const title = $(el).text().trim();
    const ctx = $(el).closest('div').text().trim().slice(0, 200);
    results.push({ href, title, ctx });
  });
  console.log(results.slice(0, 10));
})();
