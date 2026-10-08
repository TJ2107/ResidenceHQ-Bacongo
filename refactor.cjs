const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf8');

// Backgrounds
content = content.replace(/bg-\[\#E4E3E0\]/g, 'bg-slate-50');

// Shadows & Borders (Large)
content = content.replace(/border border-black shadow-\[8px_8px_0px_0px_rgba\(0,0,0,1\)\]/g, 'border border-slate-200 shadow-xl shadow-slate-200/50 rounded-2xl');

// Shadows & Borders (Small)
content = content.replace(/border border-black shadow-\[4px_4px_0px_0px_rgba\(0,0,0,1\)\]/g, 'border border-slate-200 shadow-sm hover:shadow-md transition-shadow rounded-xl');

// Typography
content = content.replace(/font-black tracking-tighter italic/g, 'font-semibold tracking-tight text-slate-900');
content = content.replace(/font-mono uppercase tracking-widest/g, 'text-xs font-medium uppercase tracking-wider text-slate-500');
content = content.replace(/font-mono uppercase tracking-tighter/g, 'text-xs font-medium uppercase tracking-wider text-slate-500');
content = content.replace(/font-mono/g, 'font-medium'); // General fallback

// Buttons (Primary)
content = content.replace(/bg-black text-white hover:bg-zinc-800/g, 'bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl shadow-sm');
content = content.replace(/bg-black text-white/g, 'bg-indigo-600 text-white rounded-xl shadow-sm');

// Buttons (Secondary/Outline)
content = content.replace(/border border-black hover:bg-zinc-100/g, 'border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-xl shadow-sm');

// Inputs
content = content.replace(/border border-black p-3/g, 'border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all');
content = content.replace(/border border-black p-2/g, 'border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all');

// Sidebar specific
content = content.replace(/border-r border-black/g, 'border-r border-slate-200');
content = content.replace(/border-b border-black/g, 'border-b border-slate-200');
content = content.replace(/border-t border-black/g, 'border-t border-slate-200');
content = content.replace(/border-l border-black/g, 'border-l border-slate-200');

// Tables
content = content.replace(/border border-black/g, 'border border-slate-200 rounded-xl');
content = content.replace(/border-b border-black/g, 'border-b border-slate-200');

// Specific fixes for the active state in sidebar
content = content.replace(/bg-black text-white shadow-\[4px_4px_0px_0px_rgba\(0,0,0,1\)\]/g, 'bg-indigo-50 text-indigo-700 shadow-sm rounded-xl');

// Fix text colors
content = content.replace(/text-zinc-500/g, 'text-slate-500');

fs.writeFileSync('src/App.tsx', content);
console.log('Refactoring complete.');
