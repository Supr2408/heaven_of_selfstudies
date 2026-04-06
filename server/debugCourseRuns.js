const axios = require('axios');
const vm = require('vm');

const extractArray = (text, marker) => {
  const start = text.indexOf(marker);
  if (start === -1) return null;
  let idx = start + marker.length;
  let depth = 1;
  while (idx < text.length && depth > 0) {
    const ch = text[idx];
    if (ch === '[') depth += 1;
    else if (ch === ']') depth -= 1;
    idx += 1;
  }
  if (depth !== 0) return null;
  return text.slice(start + marker.length, idx - 1);
};

(async () => {
  const id = process.argv[2] || '106105158';
  const { data } = await axios.get(`https://nptel.ac.in/courses/${id}`);
  const scripts = [...data.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  const target = scripts.find((s) => s.includes('courseStats') || s.includes('noc'));
  console.log('scripts', scripts.length, 'found target', !!target, 'has courseStats', target?.includes('courseStats'));
  if (!target) return;
  console.log('target head:', target.slice(0, 1200));
  const runMatches = target.match(/noc\d{2}_[a-z0-9]+/gi) || [];
  console.log('run matches', Array.from(new Set(runMatches)).slice(0, 10));
  const arrayText = extractArray(target, 'courseStats:[');
  if (!arrayText) {
    console.log('no courseStats array');
    return;
  }
  const stats = vm.runInNewContext(`[${arrayText}]`, {}, { timeout: 2000 });
  console.log('courseStats length', Array.isArray(stats) ? stats.length : typeof stats);
  console.log(stats.slice(-10));
})();
