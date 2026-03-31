const axios = require('axios');
const vm = require('vm');

// Extract the text between the first "courses:[" and its matching closing bracket
const extractCoursesArray = (scriptText) => {
  const marker = 'courses:[';
  const start = scriptText.indexOf(marker);
  if (start === -1) return null;
  let idx = start + marker.length;
  let depth = 1; // starts after the opening [
  while (idx < scriptText.length && depth > 0) {
    const ch = scriptText[idx];
    if (ch === '[') depth += 1;
    else if (ch === ']') depth -= 1;
    idx += 1;
  }
  if (depth !== 0) return null;
  return scriptText.slice(start + marker.length, idx - 1); // content inside []
};

(async () => {
  const { data } = await axios.get('https://nptel.ac.in/courses');
  const scripts = [...data.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  const target = scripts.find(s => s.includes('courses:['));
  if (!target) {
    console.log('no target');
    return;
  }

  const arrayText = extractCoursesArray(target);
  if (!arrayText) {
    console.log('no arrayText');
    return;
  }

  try {
    console.log('arrayText length', arrayText.length);
    const res = vm.runInNewContext(`[${arrayText}]`, {}, { timeout: 2000 });
    if (Array.isArray(res)) {
      console.log('courses length', res.length);
      const matches = res.filter(c => c.title && c.title.toLowerCase().includes('natural language processing'));
      console.log(matches.slice(0, 10));
    } else {
      console.log('res type', typeof res);
    }
  } catch (e) {
    console.error('eval error', e.message);
  }
})();
