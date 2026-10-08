const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(/font-medium font-bold/g, 'font-bold');

fs.writeFileSync('src/App.tsx', content);
