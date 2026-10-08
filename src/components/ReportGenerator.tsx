import React, { useState } from 'react';
import { Product, Sale, AppSettings } from '../types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { LOW_STOCK_THRESHOLD } from '../constants';
import { generatePDF } from '../lib/pdfUtils';
import { FileText, Printer } from 'lucide-react';
import { parseDate } from '../lib/utils';

interface ReportGeneratorProps {
  products: Product[];
  sales: Sale[];
  onClose: () => void;
  settings?: AppSettings | null;
}

export const ReportGenerator = ({ products, sales, onClose, settings }: ReportGeneratorProps) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const today = new Date();
  const todaySales = sales.filter(s => parseDate(s.timestamp).toDateString() === today.toDateString());
  
  const totalRevenue = todaySales.reduce((acc, sale) => acc + (sale.totalPrice || 0), 0);
  const lowStockProducts = products.filter(p => p.stock < LOW_STOCK_THRESHOLD);
  const todayHallSales = todaySales.filter(s => s.items?.some((i: any) => i.type === 'hall'));
  const hallRevenue = todayHallSales.reduce((acc, s) => acc + s.totalPrice, 0);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = () => {
    setIsDownloading(true);
    try {
      const columns = ['Heure', 'Vendeur', 'Articles', 'Montant (FCFA)'];
      const rows = todaySales.map(s => [
        format(parseDate(s.timestamp), 'HH:mm'),
        `${s.sellerName}${s.sellerRole ? ` (${s.sellerRole})` : ''}`,
        s.items?.map(i => `${i.productName} (x${i.quantity})`).join(', '),
        s.totalPrice.toLocaleString()
      ]);

      generatePDF({
        title: `Rapport d'Activité - ${format(today, 'dd/MM/yyyy')}`,
        filename: 'Rapport_Activite',
        columns,
        rows,
        settings
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto print:p-0 print:bg-white print:static">
      <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] print:max-h-none print:shadow-none print:rounded-none print:w-full">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white sticky top-0 z-10 no-print">
          <h2 className="text-xl font-bold text-[#2B2321]">Aperçu du Rapport Professionnel</h2>
          <div className="flex gap-3">
            <button 
              onClick={onClose}
              className="px-6 py-2 border border-gray-200 rounded-xl font-bold text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Fermer
            </button>
            <button 
              onClick={handleDownloadPDF}
              disabled={isDownloading}
              className="px-6 py-2 bg-accent text-white rounded-xl font-bold hover:bg-accent/90 transition-all shadow-lg shadow-accent/20 flex items-center gap-2 disabled:opacity-50"
            >
              {isDownloading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <FileText className="w-5 h-5" />
              )}
              Télécharger PDF
            </button>
            <button 
              onClick={handlePrint}
              className="px-6 py-2 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20 flex items-center gap-2"
            >
              <Printer className="w-5 h-5" />
              Imprimer
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 bg-gray-50 print:bg-white print:p-0 print:overflow-visible">
          <div 
            id="printable-report" 
            className="bg-white p-12 shadow-sm mx-auto w-full max-w-[210mm] min-h-[297mm] text-[#2B2321] font-serif print:shadow-none print:p-0 print:max-w-none"
          >
            {/* Header */}
            <div className="flex justify-between items-start border-b-2 border-primary pb-8 mb-8">
              <div className="flex items-center gap-4">
                <div className="w-24 h-24 bg-[#FDFBF7] rounded-2xl border border-[#E5C198]/30 flex items-center justify-center overflow-hidden">
                  <img src={settings?.logoUrl || "/logo.png"} alt="Logo" className="w-full h-full object-contain" onError={(e) => {
                    const target = e.currentTarget;
                    if (!target.src.includes('/logo.png')) {
                      target.src = '/logo.png';
                    } else if (target.parentElement) {
                      target.style.display = 'none';
                      target.parentElement.innerHTML = `<span class="text-3xl font-bold text-primary">${settings?.hotelName?.[0] || 'HQ'}</span>`;
                    }
                  }} />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-primary italic font-serif">{settings?.hotelName || 'Résidence HQ'}</h1>
                  <p className="text-sm uppercase tracking-widest opacity-60 font-sans font-bold">Hôtel • Restaurant • Bar</p>
                </div>
              </div>
              <div className="text-right font-sans">
                <h2 className="text-xl font-bold uppercase tracking-tighter text-[#2B2321]">Rapport d'Activité</h2>
                <p className="text-sm opacity-60 font-bold mt-1">{format(today, 'EEEE d MMMM yyyy', { locale: fr })}</p>
                <p className="text-[10px] opacity-40 mt-1 uppercase tracking-widest">Généré le {format(new Date(), 'dd/MM/yyyy HH:mm')}</p>
              </div>
            </div>

            {/* Summary Grid */}
            <div className="grid grid-cols-4 gap-4 mb-12 font-sans">
              <div className="p-4 bg-[#FDFBF7] border border-[#E5C198]/20 rounded-xl">
                <p className="text-[10px] uppercase tracking-widest font-bold text-primary/60 mb-1">Chiffre d'Affaires</p>
                <p className="text-xl font-black text-[#2B2321]">{totalRevenue.toLocaleString()} FCFA</p>
              </div>
              <div className="p-4 bg-[#FDFBF7] border border-[#E5C198]/20 rounded-xl">
                <p className="text-[10px] uppercase tracking-widest font-bold text-primary/60 mb-1">Ventes Salles</p>
                <p className="text-xl font-black text-[#2B2321]">{todayHallSales.length}</p>
              </div>
              <div className="p-4 bg-[#FDFBF7] border border-[#E5C198]/20 rounded-xl">
                <p className="text-[10px] uppercase tracking-widest font-bold text-primary/60 mb-1">Revenu Salles</p>
                <p className="text-xl font-black text-primary">{hallRevenue.toLocaleString()} FCFA</p>
              </div>
              <div className="p-4 bg-[#FDFBF7] border border-[#E5C198]/20 rounded-xl">
                <p className="text-[10px] uppercase tracking-widest font-bold text-primary/60 mb-1">Alertes Stock</p>
                <p className="text-xl font-black text-red-600">{lowStockProducts.length}</p>
              </div>
            </div>

            {/* Sales Table */}
            <div className="mb-12">
              <h3 className="text-lg font-bold mb-4 border-b border-gray-100 pb-2 font-sans uppercase tracking-widest text-primary">Détail des Ventes du Jour</h3>
              <table className="w-full text-left border-collapse font-sans text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="p-3 font-bold uppercase tracking-widest text-[10px]">Heure</th>
                    <th className="p-3 font-bold uppercase tracking-widest text-[10px]">Vendeur</th>
                    <th className="p-3 font-bold uppercase tracking-widest text-[10px]">Articles</th>
                    <th className="p-3 font-bold uppercase tracking-widest text-[10px] text-right">Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {todaySales.length > 0 ? todaySales.map((sale, idx) => (
                    <tr key={sale.id} className="border-b border-gray-100">
                      <td className="p-3 opacity-70 font-mono text-[11px]">{format(parseDate(sale.timestamp), 'dd/MM/yyyy HH:mm')}</td>
                      <td className="p-3 font-bold">{sale.sellerName}{sale.sellerRole ? ` (${sale.sellerRole})` : ''}</td>
                      <td className="p-3 text-xs italic opacity-80">
                        {sale.items?.map(i => `${i.productName} (x${i.quantity})`).join(', ')}
                      </td>
                      <td className="p-3 text-right font-bold text-primary">{sale.totalPrice.toLocaleString()} FCFA</td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={4} className="p-8 text-center opacity-40 italic">Aucune vente enregistrée aujourd'hui</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Inventory Alerts */}
            {lowStockProducts.length > 0 && (
              <div className="mb-12">
                <h3 className="text-lg font-bold mb-4 border-b border-gray-100 pb-2 font-sans uppercase tracking-widest text-red-600">Alertes de Stock Critique</h3>
                <div className="grid grid-cols-2 gap-4 font-sans">
                  {lowStockProducts.map(product => (
                    <div key={product.id} className="flex justify-between items-center p-3 border border-red-100 bg-red-50/30 rounded-lg">
                      <div>
                        <p className="font-bold text-sm">{product.name}</p>
                        <p className="text-[10px] opacity-60 uppercase tracking-widest">{product.category}</p>
                      </div>
                      <p className="font-bold text-red-600 text-sm">Stock: {product.stock}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="mt-auto pt-12 border-t border-gray-100 text-center font-sans">
              <p className="text-xs font-bold text-[#2B2321]/40 uppercase tracking-[0.2em]">
                Document officiel de gestion - {settings?.hotelName || 'Résidence HQ'}
              </p>
              <p className="text-[10px] mt-2 opacity-30">
                © 2026 Empreintes Technologies - Tous droits réservés
              </p>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          body > *:not(.fixed) { display: none !important; }
          .fixed { background: white !important; backdrop-filter: none !important; position: static !important; }
          .no-print { display: none !important; }
          .print-content { 
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
            visibility: visible !important;
          }
          #printable-report { visibility: visible !important; }
        }
      `}</style>
    </div>
  );
};
