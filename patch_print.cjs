const fs = require('fs');
let content = fs.readFileSync('src/components/POS.tsx', 'utf8');

const targetRegex = /<div className="space-y-1 text-\[10px\]">\s*<p className="font-bold uppercase tracking-wider text-center text-xs pb-1">Ventes par paiement<\/p>[\s\S]*?<span>\{savedClosureReport\.salesCount\}<\/span>\s*<\/div>\s*<\/div>/;

if (targetRegex.test(content)) {
  const replacement = `{savedClosureReport.location === 'Tous' ? (
                  <div className="space-y-1 text-[10px]">
                    <p className="font-bold uppercase tracking-wider text-center text-xs pb-1">Ventes par point de vente</p>
                    {savedClosureReport.salesByLocation && Object.entries(savedClosureReport.salesByLocation).map(([loc, amount]) => (
                      <div key={loc} className="flex justify-between">
                        <span>{loc.toUpperCase()} :</span>
                        <span>{amount.toLocaleString()} FCFA</span>
                      </div>
                    ))}
                    <div className="h-px bg-[#2B2321]/10 my-1" />
                    <div className="flex justify-between font-bold text-xs pt-1">
                      <span>TOTAL VENTES :</span>
                      <span>{savedClosureReport.totalSales.toLocaleString()} FCFA</span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1 text-[10px]">
                    <p className="font-bold uppercase tracking-wider text-center text-xs pb-1">Ventes par paiement</p>
                    <div className="flex justify-between">
                      <span>ESPÈCES :</span>
                      <span>{savedClosureReport.cashSales.toLocaleString()} FCFA</span>
                    </div>
                    <div className="flex justify-between">
                      <span>CARTE BANCAIRE :</span>
                      <span>{savedClosureReport.cardSales.toLocaleString()} FCFA</span>
                    </div>
                    <div className="flex justify-between">
                      <span>MOBILE MONEY :</span>
                      <span>{savedClosureReport.mobileSales.toLocaleString()} FCFA</span>
                    </div>
                    <div className="flex justify-between">
                      <span>CHARGES CHAMBRES :</span>
                      <span>{savedClosureReport.roomSales.toLocaleString()} FCFA</span>
                    </div>
                    <div className="h-px bg-[#2B2321]/10 my-1" />
                    <div className="flex justify-between font-bold text-xs pt-1">
                      <span>TOTAL VENTES :</span>
                      <span>{savedClosureReport.totalSales.toLocaleString()} FCFA</span>
                    </div>
                    <div className="flex justify-between text-[9px] text-[#2B2321]/60">
                      <span>Nbre Transactions :</span>
                      <span>{savedClosureReport.salesCount}</span>
                    </div>
                  </div>
                )}`;

  content = content.replace(targetRegex, replacement);
  fs.writeFileSync('src/components/POS.tsx', content, 'utf8');
  console.log("Print Patched successfully!");
} else {
  console.log("Could not match the regex for the print replacement.");
}
