const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(/zinc-50/g, 'slate-50');
content = content.replace(/zinc-100/g, 'slate-100');
content = content.replace(/zinc-600/g, 'slate-600');

fs.writeFileSync('src/App.tsx', content);
