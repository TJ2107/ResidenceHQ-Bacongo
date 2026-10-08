const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(/bg-black flex items-center justify-center text-white font-black italic/g, 'bg-indigo-600 flex items-center justify-center text-white font-bold rounded-full');

fs.writeFileSync('src/App.tsx', content);
