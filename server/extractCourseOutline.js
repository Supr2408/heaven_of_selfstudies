const axios = require('axios');
const cheerio = require('cheerio');
const vm = require('vm');

const extractSvelteCourseData = (html) => {
  const scripts = html.match(/<script[^>]*>([\s\S]*?)<\/script>/g) || [];
  for (const script of scripts) {
    if (script.includes('courseOutline')) {
      // Extract the courseOutline object from the Svelte data
      const match = script.match(/courseOutline:\{[^}]*\{[^}]*\}/);
      if (match) {
        // This is complex to parse - try to find the JSON structure
        const contextStr = script.slice(0, script.indexOf('courseOutline') + 5000);
        const dataStart = contextStr.lastIndexOf('{');
        try {
          // Try to extract JSON safely
          let braceCount = 0;
          let jsonStr = '';
          let inString = false;
          let escaped = false;
          
          for (let i = dataStart; i < script.length; i++) {
            const char = script[i];
            if (escaped) {
              jsonStr +=char;
              escaped = false;
              continue;
            }
            if (char === '\\') {
              escaped = true;
              jsonStr += char;
              continue;
            }
            if (char === '"' && !escaped) {
              inString = !inString;
            }
            if (!inString) {
              if (char === '{') braceCount++;
              if (char === '}') braceCount--;
            }
            jsonStr += char;
            if (braceCount === 0 && braceCount > 0) break;
          }
          
          const parsed = JSON.parse(jsonStr);
          return parsed;
        } catch (err) {
          console.log('Failed to parse Svelte JSON:', err.message.slice(0, 50));
        }
      }
    }
  }
  return null;
};

(async () => {
  const courseId = 106105174; // Data Mining
  const url = `https://nptel.ac.in/courses/${courseId}`;
  
  console.log('Fetching course page:', url);
  const { data: html } = await axios.get(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
  });

  // Look for courseOutline in script
  const match = html.match(/courseOutline:\{[^]*?units:\[\{[^]*?\}\]/);
  if (match) {
    console.log('Found courseOutline');
    const outlineStr = match[0];
    console.log(outlineStr.slice(0, 500));
  } else {
    console.log('courseOutline not found in simple pattern');
  }

  // Try another approach - extract JSON strings from script
  const scripts = html.match(/<script[^>]*>([\s\S]*?)<\/script>/g) || [];
  for (const script of scripts) {
    if (script.includes('"Data Mining"')) {
      console.log('\nFound Data Mining script');
      // Look for units array
      const unitsMatch = script.match(/units:\[\{[^]*?\{[^]*?\}\]/);
      if (unitsMatch) {
        console.log('Found units array:');
        console.log(unitsMatch[0].slice(0, 300));
      }
    }
  }
})();
