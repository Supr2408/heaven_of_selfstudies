const axios = require('axios');

(async () => {
  const { data } = await axios.get('https://nptel.ac.in/courses');
  const scripts = [...data.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  console.log('scripts:', scripts.length);
  const jsonLike = scripts.find(s => s.trim().startsWith('{') || s.trim().startsWith('['));
  console.log('jsonLike first 500:', jsonLike ? jsonLike.slice(0, 500) : 'none');
})();
