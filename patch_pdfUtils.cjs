const fs = require('fs');
const content = fs.readFileSync('src/lib/pdfUtils.ts', 'utf8');

const newContent = content.replace(
  "  stockDetails?: any[];\n}",
  "  stockDetails?: any[];\n  salesByLocation?: { [key: string]: number };\n}"
);

fs.writeFileSync('src/lib/pdfUtils.ts', newContent, 'utf8');
console.log("Patched pdfUtils!");
