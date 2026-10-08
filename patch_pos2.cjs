const fs = require('fs');
let content = fs.readFileSync('src/components/POS.tsx', 'utf8');

content = content.replace("stockDetails: closureStockList\n                                }", 
"stockDetails: closureStockList,\n                                  salesByLocation: closureData.salesByLocation\n                                }");

content = content.replace("stockSummary: closureData.stockSummary,\n        stockDetails: closureStockList", 
"stockSummary: closureData.stockSummary,\n        stockDetails: closureStockList,\n        salesByLocation: closureData.salesByLocation");

fs.writeFileSync('src/components/POS.tsx', content, 'utf8');
console.log("Patched POS 2!");
