const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(/text-2xl font-black italic tracking-tighter/g, 'text-2xl font-bold tracking-tight text-slate-900');
content = content.replace(/text-sm font-medium uppercase tracking-wider text-slate-500 opacity-50/g, 'text-xs font-medium uppercase tracking-wider text-slate-500');

// Fix the receipt modal
content = content.replace(/className="w-full max-w-xs bg-white p-6 shadow-2xl font-medium text-sm text-black"/g, 'className="w-full max-w-xs bg-white p-6 shadow-2xl rounded-2xl font-mono text-sm text-slate-800"');

// Fix the pool ticket modal
content = content.replace(/className="w-full max-w-md bg-white border border-slate-200 shadow-xl shadow-slate-200\/50 rounded-2xl p-8"/g, 'className="w-full max-w-md bg-white border border-slate-200 shadow-xl shadow-slate-200/50 rounded-2xl p-8"');

fs.writeFileSync('src/App.tsx', content);
