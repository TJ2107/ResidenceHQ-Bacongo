const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(/font-black/g, 'font-bold');

fs.writeFileSync('src/App.tsx', content);
