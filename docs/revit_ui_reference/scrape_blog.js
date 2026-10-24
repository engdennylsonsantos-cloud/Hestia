const https = require('https');
const fs = require('fs');
const url = 'https://blogs.autodesk.com/aec/2023/04/04/whats-new-in-autodesk-revit-2024/';

https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const matches = data.match(/https:\/\/[^"'\s]+?\.(png|jpg|jpeg)/gi) || [];
    const unique = [...new Set(matches)].filter(u => !u.includes('logo') && !u.includes('avatar') && !u.includes('icon'));
    fs.writeFileSync('docs/revit_ui_reference/blog_images.json', JSON.stringify(unique, null, 2));
    console.log('Saved images count:', unique.length);
  });
}).on('error', err => console.error(err.message));
