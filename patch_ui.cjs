const fs = require('fs');
let content = fs.readFileSync('src/components/POS.tsx', 'utf8');

const targetRegex = /\{\/\* 4 Cards Overview: Sales, Expenses, Expected Net Cash, Stock \*\/\}[\s\S]*?<div className="border border-secondary\/20 rounded-2xl overflow-hidden bg-white">/;

if (targetRegex.test(content)) {
  const replacement = `{/* Cards Overview */}
                      {closureLocationFilter === 'Tous' ? (
                        <div className="grid grid-cols-1 gap-2 text-xs">
                          <div className="p-3 bg-white rounded-xl border border-secondary/10 space-y-2">
                            <span className="text-primary/60 font-bold uppercase tracking-widest text-[9px] block">Ventes par point de vente</span>
                            <div className="space-y-1">
                              {closureData.salesByLocation && Object.entries(closureData.salesByLocation).map(([loc, amount]) => (
                                <div key={loc} className="flex justify-between items-center text-[11px] font-semibold">
                                  <span>{loc}</span>
                                  <span>{amount.toLocaleString()} FCFA</span>
                                </div>
                              ))}
                              <div className="flex justify-between items-center text-[11px] font-bold border-t border-secondary/10 pt-1 mt-1">
                                <span>TOTAL GÉNÉRAL</span>
                                <span>{closureData.totalSales.toLocaleString()} FCFA</span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="p-3 bg-red-50/50 rounded-xl border border-red-100 space-y-1">
                              <span className="text-red-700 font-bold uppercase tracking-widest text-[9px] block">Dépenses du Jour</span>
                              <p className="font-black text-red-600 text-base">{closureData.totalExpenses.toLocaleString()} FCFA</p>
                              <p className="text-[9px] text-red-600/70 font-semibold">{closureData.expensesCount} bon(s) de sortie</p>
                            </div>
                            <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-100 space-y-1">
                              <span className="text-amber-800 font-bold uppercase tracking-widest text-[9px] block">Espèces Attendues</span>
                              <p className="font-black text-amber-900 text-base">{closureData.cashSales.toLocaleString()} FCFA</p>
                              <p className="text-[9px] text-amber-800/70 font-semibold">(Hors CB/Mobile/Chambres)</p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <>
                          {/* 4 Cards Overview: Sales, Expenses, Expected Net Cash, Stock */}
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="p-3 bg-white rounded-xl border border-secondary/10 space-y-1">
                              <span className="text-primary/60 font-bold uppercase tracking-widest text-[9px] block">Total Ventes</span>
                              <p className="font-black text-primary text-base">{closureData.totalSales.toLocaleString()} FCFA</p>
                              <p className="text-[9px] text-[#2B2321]/60 font-semibold">{closureData.count} transaction(s)</p>
                            </div>
                            <div className="p-3 bg-red-50/50 rounded-xl border border-red-100 space-y-1">
                              <span className="text-red-700 font-bold uppercase tracking-widest text-[9px] block">Dépenses du Jour</span>
                              <p className="font-black text-red-600 text-base">{closureData.totalExpenses.toLocaleString()} FCFA</p>
                              <p className="text-[9px] text-red-600/70 font-semibold">{closureData.expensesCount} bon(s) de sortie</p>
                            </div>
                            <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-100 space-y-1">
                              <span className="text-amber-800 font-bold uppercase tracking-widest text-[9px] block">Espèces Attendues</span>
                              <p className="font-black text-amber-900 text-base">{closureData.cashSales.toLocaleString()} FCFA</p>
                              <p className="text-[9px] text-amber-800/70 font-semibold">(Hors CB/Mobile/Chambres)</p>
                            </div>
                            <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100 space-y-1">
                              <span className="text-blue-800 font-bold uppercase tracking-widest text-[9px] block">Stock Restant</span>
                              <p className="font-black text-blue-900 text-base">{closureData.stockSummary.totalStockUnits} unités</p>
                              <p className="text-[9px] text-blue-800/70 font-semibold">{closureData.stockSummary.totalProductsCount} articles ({closureData.stockSummary.lowStockCount} bas)</p>
                            </div>
                          </div>

                          <div className="h-px bg-secondary/20 my-1" />

                          <div className="grid grid-cols-2 gap-2 text-[10px] text-[#2B2321]/70">
                            <div>Espèces: <span className="font-bold text-[#2B2321]">{closureData.cashSales.toLocaleString()} F</span></div>
                            <div>Carte: <span className="font-bold text-[#2B2321]">{closureData.cardSales.toLocaleString()} F</span></div>
                            <div>Mobile Money: <span className="font-bold text-[#2B2321]">{closureData.mobileSales.toLocaleString()} F</span></div>
                            <div>Chambres: <span className="font-bold text-[#2B2321]">{closureData.roomSales.toLocaleString()} F</span></div>
                          </div>
                        </>
                      )}
                    </div>

                    {closureLocationFilter !== 'Tous' && (
                      <>
                        {/* Accordion 1: Sales Details */}
                        <div className="border border-secondary/20 rounded-2xl overflow-hidden bg-white">`;

  content = content.replace(targetRegex, replacement);
  fs.writeFileSync('src/components/POS.tsx', content, 'utf8');
  console.log("UI Patched successfully!");
} else {
  console.log("Could not match the regex for the UI replacement.");
}
