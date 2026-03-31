const axios = require('axios');
const vm = require('vm');

const extractCoursesArray = (scriptText = '') => {
  const marker = 'courses:[';
  const start = scriptText.indexOf(marker);
  if (start === -1) return null;
  let idx = start + marker.length;
  let depth = 1;
  while (idx < scriptText.length && depth > 0) {
    const ch = scriptText[idx];
    if (ch === '[') depth += 1;
    else if (ch === ']') depth -= 1;
    idx += 1;
  }
  if (depth !== 0) return null;
  return scriptText.slice(start + marker.length, idx - 1);
};

(async () => {
  console.log('Fetching NPTEL courses catalog...');
  const html = await axios.get('https://nptel.ac.in/courses').then(r => r.data);
  const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  const target = scripts.find(s => s.includes('courses:['));
  
  if (!target) {
    console.log('No catalog found');
    process.exit(1);
  }

  const arrayText = extractCoursesArray(target);
  const catalog = vm.runInNewContext(`[${arrayText}]`, {}, { timeout: 2000 });
  
  const dataMining = catalog.filter(c => c.title.toLowerCase().includes('data mining'));
  console.log('\nData Mining courses found:');
  dataMining.forEach((c, i) => {
    console.log(`${i + 1}. ${c.title}`);
    console.log(`   Institute: ${c.instituteName}`);
    console.log(`   Professor: ${c.professor}`);
    console.log(`   ID: ${c.id}`);
    console.log('');
  });
})();
