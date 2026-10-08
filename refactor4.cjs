const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf8');

// Fix the splash screen
content = content.replace(/bg-black flex flex-col/g, 'bg-indigo-600 flex flex-col');
content = content.replace(/text-6xl font-black italic tracking-tighter mb-4/g, 'text-6xl font-bold tracking-tight mb-4');

// Fix the loader
content = content.replace(/text-black/g, 'text-indigo-600');

// Fix the login screen
content = content.replace(/text-4xl font-black tracking-tighter italic mb-2/g, 'text-4xl font-bold tracking-tight text-slate-900 mb-2');

// Fix the receipt modal
content = content.replace(/font-black italic tracking-tighter/g, 'font-bold tracking-tight');

fs.writeFileSync('src/App.tsx', content);
