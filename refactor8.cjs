const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(/font-black italic mb-6 uppercase tracking-tighter/g, 'font-bold tracking-tight text-slate-900 mb-6');
content = content.replace(/font-black italic mb-8 uppercase tracking-tighter/g, 'font-bold tracking-tight text-slate-900 mb-8');
content = content.replace(/font-black tracking-tighter/g, 'font-bold tracking-tight');
content = content.replace(/tracking-tighter/g, 'tracking-tight');
content = content.replace(/group-hover:italic/g, '');

fs.writeFileSync('src/App.tsx', content);
