const fs = require('fs');
const content = fs.readFileSync('src/components/POS.tsx', 'utf8');
const target = `      let cash = 0;
      let card = 0;
      let mobile = 0;
      let room = 0;
      let totalSales = 0;

      combinedSales.forEach(sale => {
        const price = sale.totalPrice || 0;
        const method = sale.paymentMethod;

        totalSales += price;

        if (method === 'Cash') cash += price;
        else if (method === 'Card') card += price;
        else if (method === 'Mobile Money') mobile += price;
        else if (method === 'Room Charge') room += price;
      });`;

const targetRegex = /let cash = 0;[\s\S]*?room \+= price;\s*\}\);/;

if (targetRegex.test(content)) {
  const newContent = content.replace(targetRegex, `let cash = 0;
      let card = 0;
      let mobile = 0;
      let room = 0;
      let totalSales = 0;
      const salesByLocation: { [key: string]: number } = {};

      combinedSales.forEach(sale => {
        const price = sale.totalPrice || 0;
        const method = sale.paymentMethod;
        const saleLocation = sale.location || 'Inconnu';

        totalSales += price;
        salesByLocation[saleLocation] = (salesByLocation[saleLocation] || 0) + price;

        if (method === 'Cash') cash += price;
        else if (method === 'Card') card += price;
        else if (method === 'Mobile Money') mobile += price;
        else if (method === 'Room Charge') room += price;
      });`);
  fs.writeFileSync('src/components/POS.tsx', newContent, 'utf8');
  console.log("Patched!");
} else {
  console.log("Could not find regex!");
}
