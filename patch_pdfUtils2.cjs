const fs = require('fs');
let content = fs.readFileSync('src/lib/pdfUtils.ts', 'utf8');

const targetRegex = /  const paymentRows = \[[\s\S]*?  doc\.setFontSize\(10\.5\);/;

if (targetRegex.test(content)) {
  const replacement = `  const paymentRows = [
    ['Espèces', \`\${formatNum(closureReport.cashSales)} FCFA\`],
    ['Carte Bancaire', \`\${formatNum(closureReport.cardSales)} FCFA\`],
    ['Mobile Money', \`\${formatNum(closureReport.mobileSales)} FCFA\`],
    ['Charges Chambres (Crédit)', \`\${formatNum(closureReport.roomSales)} FCFA\`],
    [{ content: 'TOTAL DU CHIFFRE D\\'AFFAIRES', styles: { fontStyle: 'bold' as const } }, { content: \`\${formatNum(closureReport.totalSales)} FCFA\`, styles: { fontStyle: 'bold' as const, textColor: primaryColor as any } }]
  ];

  autoTable(doc, {
    startY: y,
    head: [['Mode de Paiement', 'Montant Total (FCFA)']],
    body: paymentRows,
    margin: { left: margin, right: margin },
    theme: 'striped',
    headStyles: { fillColor: primaryColor as any, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
    bodyStyles: { fontSize: 8 },
    columnStyles: { 0: { cellWidth: 100 }, 1: { halign: 'right' } }
  });

  y = (doc as any).lastAutoTable.finalY + 7;

  if (closureReport.location === 'Tous' && closureReport.salesByLocation) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text("1.B RÉCAPITULATIF DES VENTES PAR POINT DE VENTE", margin, y);
    y += 3;

    const locRows = Object.entries(closureReport.salesByLocation).map(([loc, amt]) => [
      loc, \`\${formatNum(amt as number)} FCFA\`
    ]);
    locRows.push([{ content: 'TOTAL DU CHIFFRE D\\'AFFAIRES', styles: { fontStyle: 'bold' as const } } as any, { content: \`\${formatNum(closureReport.totalSales)} FCFA\`, styles: { fontStyle: 'bold' as const, textColor: primaryColor as any } } as any]);

    autoTable(doc, {
      startY: y,
      head: [['Point de Vente', 'Montant (FCFA)']],
      body: locRows,
      margin: { left: margin, right: margin },
      theme: 'grid',
      headStyles: { fillColor: [240, 240, 240], textColor: darkColor as any, fontStyle: 'bold', fontSize: 8.5 },
      bodyStyles: { fontSize: 8 },
      columnStyles: { 0: { cellWidth: 100 }, 1: { halign: 'right' } }
    });
    
    y = (doc as any).lastAutoTable.finalY + 7;
  }

  // Section 2: Cash Audit / Discrepancy
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);`;

  content = content.replace(targetRegex, replacement);
  fs.writeFileSync('src/lib/pdfUtils.ts', content, 'utf8');
  console.log("pdfUtils Patched successfully!");
} else {
  console.log("Could not match the regex for pdfUtils.");
}
