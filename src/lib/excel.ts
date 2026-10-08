import * as XLSX from 'xlsx';
import { Product, Sale } from '../types';
import { format } from 'date-fns';
import { parseDate } from './utils';

export const exportDailySales = (sales: Sale[]) => {
  const today = format(new Date(), 'yyyy-MM-dd');
  const dailySales = sales.filter(s => format(parseDate(s.timestamp), 'yyyy-MM-dd') === today);

  const data = dailySales.map(sale => ({
    'Date': format(parseDate(sale.timestamp), 'dd/MM/yyyy HH:mm'),
    'Vendeur': `${sale.sellerName}${sale.sellerRole ? ` (${sale.sellerRole})` : ''}`,
    'Articles': sale.items?.map(i => `${i.productName} (x${i.quantity})`).join(', ') || 'N/A',
    'Total (FCFA)': sale.totalPrice
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Ventes du jour');
  XLSX.writeFile(wb, `Rapport_Ventes_${today}.xlsx`);
};

export const exportInventory = (products: Product[]) => {
  const data = products.map(product => ({
    'Nom': product.name,
    'Catégorie': product.category,
    'Prix (FCFA)': product.price,
    'Stock': product.stock
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Inventaire');
  XLSX.writeFile(wb, `Inventaire_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
};
