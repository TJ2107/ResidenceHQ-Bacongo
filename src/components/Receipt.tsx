import React, { useState } from 'react';
import { motion } from 'motion/react';
import { format } from 'date-fns';
import { Printer } from 'lucide-react';
import { AppSettings } from '../types';
import { cn } from '../lib/utils';

export const Receipt = ({ sale, onClose, settings, type = 'invoice' }: { sale: any, onClose: () => void, settings?: AppSettings | null, type?: 'invoice' | 'order' }) => {
  const [paperSize, setPaperSize] = useState<'80mm' | '58mm' | 'standard'>('80mm');

  const printReceipt = () => {
    const printElement = document.getElementById('printable-receipt');
    
    // Create or reuse hidden print iframe for reliable cross-browser / iframe printing
    let printFrame = document.getElementById('receipt-print-iframe') as HTMLIFrameElement;
    if (!printFrame) {
      printFrame = document.createElement('iframe');
      printFrame.id = 'receipt-print-iframe';
      printFrame.style.position = 'fixed';
      printFrame.style.right = '0';
      printFrame.style.bottom = '0';
      printFrame.style.width = '0px';
      printFrame.style.height = '0px';
      printFrame.style.border = 'none';
      printFrame.style.visibility = 'hidden';
      document.body.appendChild(printFrame);
    }

    const widthCss = paperSize === 'standard' ? '100%' : paperSize === '80mm' ? '80mm' : '58mm';
    const fontSizeCss = paperSize === 'standard' ? '13px' : paperSize === '80mm' ? '11px' : '9px';
    const paddingCss = paperSize === 'standard' ? '10mm' : paperSize === '80mm' ? '4mm' : '2mm';

    if (printElement && printFrame.contentWindow) {
      const clone = printElement.cloneNode(true) as HTMLElement;
      // Strip control sections marked with no-print
      const noPrintEls = clone.querySelectorAll('.no-print');
      noPrintEls.forEach(el => el.remove());

      const doc = printFrame.contentWindow.document;
      doc.open();
      doc.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Impression Facture</title>
            <style>
              @page {
                size: ${paperSize === 'standard' ? 'A4' : paperSize === '80mm' ? '80mm auto' : '58mm auto'};
                margin: 0;
              }
              html, body {
                margin: 0 !important;
                padding: 0 !important;
                background: #ffffff !important;
                color: #000000 !important;
                font-family: monospace, Courier, monospace !important;
              }
              body {
                width: ${widthCss} !important;
                max-width: ${widthCss} !important;
                margin: 0 auto !important;
                padding: ${paddingCss} !important;
                font-size: ${fontSizeCss} !important;
                line-height: 1.3 !important;
              }
              * {
                box-sizing: border-box !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              .no-print { display: none !important; }
              .flex { display: flex !important; }
              .grid { display: grid !important; }
              .grid-cols-12 { display: grid !important; grid-template-columns: repeat(12, minmax(0, 1fr)) !important; }
              .col-span-1 { grid-column: span 1 / span 1 !important; }
              .col-span-2 { grid-column: span 2 / span 2 !important; }
              .col-span-3 { grid-column: span 3 / span 3 !important; }
              .col-span-4 { grid-column: span 4 / span 4 !important; }
              .col-span-5 { grid-column: span 5 / span 5 !important; }
              .col-span-6 { grid-column: span 6 / span 6 !important; }
              .col-span-7 { grid-column: span 7 / span 7 !important; }
              .col-span-8 { grid-column: span 8 / span 8 !important; }
              .col-span-9 { grid-column: span 9 / span 9 !important; }
              .col-span-10 { grid-column: span 10 / span 10 !important; }
              .col-span-12 { grid-column: span 12 / span 12 !important; }
              .gap-1 { gap: 4px !important; }
              .gap-x-2 { column-gap: 8px !important; }
              .gap-y-1 { row-gap: 4px !important; }
              .flex-wrap { flex-wrap: wrap !important; }
              .whitespace-nowrap { white-space: nowrap !important; }
              .px-1 { padding-left: 4px !important; padding-right: 4px !important; }
              .px-2 { padding-left: 8px !important; padding-right: 8px !important; }
              .py-1 { padding-top: 4px !important; padding-bottom: 4px !important; }
              .py-1\.5 { padding-top: 6px !important; padding-bottom: 6px !important; }
              .py-0\.5 { padding-top: 2px !important; padding-bottom: 2px !important; }
              .font-mono { font-family: monospace, Courier, monospace !important; }
              .font-extrabold { font-weight: 800 !important; }
              .justify-between { justify-content: space-between !important; }
              .justify-center { justify-content: center !important; }
              .items-center { align-items: center !important; }
              .text-center { text-align: center !important; }
              .text-left { text-align: left !important; }
              .text-right { text-align: right !important; }
              .font-bold { font-weight: bold !important; }
              .uppercase { text-transform: uppercase !important; }
              .truncate { overflow: hidden !important; text-overflow: ellipsis !important; white-space: nowrap !important; }
              .border-b { border-bottom: 1px dashed #000000 !important; }
              .border-t { border-top: 1px dashed #000000 !important; }
              .border { border: none !important; }
              .border-dashed { border-style: dashed !important; }
              .space-y-0\.5 > * + * { margin-top: 2px !important; }
              .space-y-1 > * + * { margin-top: 4px !important; }
              .space-y-1\.5 > * + * { margin-top: 6px !important; }
              .space-y-2 > * + * { margin-top: 8px !important; }
              .space-y-3 > * + * { margin-top: 12px !important; }
              .space-y-4 > * + * { margin-top: 16px !important; }
              .space-y-6 > * + * { margin-top: 24px !important; }
              .pb-6 { padding-bottom: 16px !important; }
              .mb-4 { margin-bottom: 16px !important; }
              .mb-6 { margin-bottom: 24px !important; }
              .mb-8 { margin-bottom: 32px !important; }
              .mt-1 { margin-top: 4px !important; }
              .mt-2 { margin-top: 8px !important; }
              .mt-2\.5 { margin-top: 10px !important; }
              .mt-3 { margin-top: 12px !important; }
              .pt-2 { padding-top: 8px !important; }
              .pt-4 { padding-top: 16px !important; }
              .pt-6 { padding-top: 24px !important; }
              .w-16 { width: 64px !important; }
              .h-16 { height: 64px !important; }
              .max-w-\[65\%\] { max-width: 65% !important; }
              img { max-width: 100% !important; height: auto !important; }
            </style>
          </head>
          <body>
            ${clone.outerHTML}
          </body>
        </html>
      `);
      doc.close();

      setTimeout(() => {
        try {
          printFrame.contentWindow?.focus();
          printFrame.contentWindow?.print();
        } catch {
          window.print();
        }
      }, 300);
    } else {
      window.print();
    }
  };

  const isOrder = type === 'order';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#2B2321]/60 backdrop-blur-sm print-overlay-container">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className={cn(
          "bg-[#FDFBF7] shadow-2xl shadow-[#1A8B8C]/20 rounded-3xl font-mono text-[#2B2321] border border-[#E5C198]/30 transition-all duration-300 max-h-[90vh] overflow-y-auto hide-scrollbar",
          paperSize === '80mm' 
            ? "w-[320px] p-5 text-[11px]" 
            : paperSize === '58mm' 
              ? "w-[240px] p-4 text-[9px]" 
              : "w-full max-w-xs p-8 text-sm"
        )}
        id="printable-receipt"
      >
        {sale.isTestPage ? (
          <div className="space-y-4">
            <div className="text-center border-b border-dashed border-[#1A8B8C]/30 pb-6 mb-4">
              <h2 className="font-bold tracking-widest text-[#1A8B8C] uppercase text-sm">
                RAPPORT DE DIAGNOSTIC
              </h2>
              <p className="font-bold text-[9px] bg-[#1A8B8C]/15 text-[#1A8B8C] py-1 px-2 rounded-lg mt-2 uppercase tracking-widest inline-block">
                PAGE DE TEST IMPRIMANTE
              </p>
              <p className="text-[10px] mt-2 text-[#2B2321]/60">Modèle ciblé: TP200 Thermal / Roll</p>
              <p className="text-[8px] text-[#2B2321]/40 uppercase tracking-widest">Type: POS Diagnostic Print</p>
              <p className="text-[9px] mt-1 text-[#2B2321]/60">{format(new Date(), 'dd/MM/yyyy HH:mm:ss')}</p>
            </div>

            <div className="space-y-4 mb-6 text-left">
              <div>
                <p className="font-bold text-[9px] text-[#1A8B8C] uppercase tracking-widest mb-1.5">1. Test d'Alignement</p>
                <div className="border border-dashed border-[#2B2321]/30 p-2 text-[9px] space-y-1 bg-white">
                  <p className="text-left">[GAUCHE] -----------------</p>
                  <p className="text-center">-- [CENTRE] --</p>
                  <p className="text-right">----------------- [DROITE]</p>
                </div>
              </div>

              <div>
                <p className="font-bold text-[9px] text-[#1A8B8C] uppercase tracking-widest mb-1.5">2. Tailles de police</p>
                <div className="space-y-1">
                  <p className="text-[8px]">Texte Petite taille [8px]</p>
                  <p className="text-xs">Texte Taille standard [12px]</p>
                  <p className="text-sm font-bold">Texte Taille Moyenne [14px]</p>
                  <p className="text-base font-bold">Texte Grande taille [16px]</p>
                </div>
              </div>

              <div>
                <p className="font-bold text-[9px] text-[#1A8B8C] uppercase tracking-widest mb-1.5">3. Encodage et Caractères</p>
                <div className="bg-[#2B2321]/5 p-2 rounded-lg font-mono text-[9px] space-y-1 leading-relaxed">
                  <p>Accents: é è à ç ù ô û î ï ë</p>
                  <p>Devises: FCFA, EUR €, USD $</p>
                  <p>Spéciaux: * / + = % @ & # [ ] _</p>
                  <p>Chiffres: 0123456789</p>
                </div>
              </div>

              <div>
                <p className="font-bold text-[9px] text-[#1A8B8C] uppercase tracking-widest mb-1.5">4. Zone physique de découpe</p>
                <div className="border border-solid border-[#2B2321]/20 p-2 text-center text-[8px] bg-white text-[#2B2321]/60">
                  |&lt;------------- 80mm ou 58mm -------------&gt;|
                </div>
                <div className="text-center font-bold text-[9px] text-[#1A8B8C] mt-3 border border-dashed border-[#1A8B8C]/40 py-2 rounded-lg bg-[#1A8B8C]/10 uppercase tracking-widest">
                  ✓ Communication OK (Pilote testé)
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="text-center border-b border-dashed border-[#1A8B8C]/30 pb-6 mb-6">
              {settings?.logoUrl && !isOrder && (
                <div className="flex justify-center mb-4">
                  <img src={settings.logoUrl} alt="Logo" className="w-16 h-16 object-contain" onError={(e) => { e.currentTarget.src = '/logo.png'; }} />
                </div>
              )}
              <h2 className={cn(
                "font-bold tracking-widest text-[#1A8B8C] uppercase",
                paperSize === '58mm' ? "text-sm" : paperSize === '80mm' ? "text-lg" : "text-2xl"
              )}>
                {isOrder ? 'BON DE COMMANDE' : (settings?.hotelName || 'LE RÉTRO')}
              </h2>
              {!isOrder && <p className={cn("uppercase tracking-widest mt-2 text-[#2B2321]/60", paperSize === '58mm' ? "text-[8px]" : "text-[10px]")}>Hôtel - Restaurant</p>}
              {!isOrder && (
                <div className={cn("mt-1 text-[#2B2321]/70 leading-normal space-y-0.5", paperSize === '58mm' ? "text-[7px]" : "text-[9px]")}>
                  <p>02 rue Daniel Mayinguidi, Massissia</p>
                  <p>(derrière l'usine GO Fresh, Brazzaville)</p>
                  <p className="font-bold">Tél: 05 201 8181 | www.residence-hq.com</p>
                </div>
              )}
              <p className={cn("mt-1 text-[#2B2321]/60", paperSize === '58mm' ? "text-[8px]" : "text-[10px]")}>
                {format(sale.timestamp ? (sale.timestamp.seconds ? new Date(sale.timestamp.seconds * 1000) : new Date(sale.timestamp)) : new Date(), 'dd/MM/yyyy HH:mm')}
              </p>
              {sale.id && <p className="text-[8px] mt-1 text-[#2B2321]/40 uppercase tracking-widest">N°: {sale.id.slice(-8).toUpperCase()}</p>}

              {/* Client & Table Information */}
              <div className={cn(
                "mt-2.5 pt-2 border-t border-dashed border-[#1A8B8C]/30 text-left space-y-1.5",
                paperSize === '58mm' ? "text-[8px]" : "text-[10px]"
              )}>
                <div className="flex items-center justify-between gap-1 flex-wrap">
                  <span className="font-bold uppercase tracking-wider text-[#2B2321]">
                    Client : <span className="text-[#1A8B8C] font-extrabold">{sale.guestName || 'Comptant'}</span>
                  </span>
                  {sale.tableNumber && (
                    <span className={cn(
                      "font-extrabold uppercase bg-[#1A8B8C]/15 text-[#1A8B8C] px-2 py-0.5 rounded-md border border-[#1A8B8C]/30 whitespace-nowrap",
                      paperSize === '58mm' ? "text-[8px]" : "text-[10px]"
                    )}>
                      Table N° {sale.tableNumber}
                    </span>
                  )}
                  {!sale.tableNumber && sale.roomId && (
                    <span className={cn(
                      "font-extrabold uppercase bg-[#1A8B8C]/15 text-[#1A8B8C] px-2 py-0.5 rounded-md border border-[#1A8B8C]/30 whitespace-nowrap",
                      paperSize === '58mm' ? "text-[8px]" : "text-[10px]"
                    )}>
                      Ch. {sale.roomId}
                    </span>
                  )}
                </div>
                {sale.location && (
                  <p className="text-[#2B2321]/70 font-semibold uppercase tracking-wider">
                    Lieu : <span className="font-bold text-[#2B2321]">{sale.location}</span>
                  </p>
                )}
                {isOrder && (
                  <div className="mt-1 pt-1 border-t border-dashed border-[#1A8B8C]/20 text-center">
                    <p className="font-extrabold text-[9px] text-[#1A8B8C] uppercase tracking-wider">
                      ✓ Déjà Encaissé au Point de Vente ({sale.originalLocation || sale.location || 'POS'})
                    </p>
                    <p className="text-[8px] text-[#2B2321]/70 font-bold uppercase mt-0.5">
                      Bon de cuisine uniquement — Ne pas réclamer de paiement
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="mb-6 text-left">
              {/* Table Header */}
              <div className={cn(
                "grid grid-cols-12 gap-1 font-bold text-[#1A8B8C] uppercase tracking-widest border-b border-dashed border-[#1A8B8C]/30 pb-1.5 mb-2",
                paperSize === '58mm' ? "text-[8px]" : "text-[10px]"
              )}>
                <span className={isOrder ? "col-span-9 text-left" : "col-span-6 text-left"}>Article</span>
                <span className={isOrder ? "col-span-3 text-right" : "col-span-2 text-center"}>Qté</span>
                {!isOrder && <span className="col-span-4 text-right">Prix</span>}
              </div>

              {/* Items List with strictly aligned quantities */}
              <div className="space-y-1.5">
                {sale.items?.map((item: any, index: number) => (
                  <div 
                    key={index} 
                    className={cn(
                      "grid grid-cols-12 gap-1 items-center border-b border-dashed border-[#2B2321]/10 pb-1", 
                      paperSize === '58mm' ? "text-[9px]" : "text-xs"
                    )}
                  >
                    <span className={cn("font-bold truncate text-left", isOrder ? "col-span-9" : "col-span-6")}>
                      {item.productName}
                    </span>
                    <span className={cn(
                      "font-bold font-mono text-center text-[#1A8B8C] bg-[#1A8B8C]/5 py-0.5 rounded", 
                      isOrder ? "col-span-3 text-right bg-transparent text-[#2B2321]" : "col-span-2"
                    )}>
                      {isOrder ? `x${item.quantity}` : item.quantity}
                    </span>
                    {!isOrder && (
                      <span className="col-span-4 text-right font-bold font-mono text-[#2B2321]">
                        {(item.price * item.quantity).toLocaleString()} F
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {!isOrder && (
              <div className="border-t border-dashed border-[#1A8B8C]/30 pt-6 mb-8">
                <div className={cn(
                  "flex justify-between font-bold text-[#1A8B8C]",
                  paperSize === '58mm' ? "text-sm" : "text-lg"
                )}>
                  <span>TOTAL</span>
                  <span>{(sale.totalPrice || 0).toLocaleString()} FCFA</span>
                </div>
                {sale.paymentMethod && (
                  <div className={cn(
                    "flex justify-between font-bold text-[#2B2321]/60 mt-2 uppercase tracking-widest",
                    paperSize === '58mm' ? "text-[8px]" : "text-[10px]"
                  )}>
                    <span>Mode de paiement</span>
                    <span>{sale.paymentMethod}</span>
                  </div>
                )}
              </div>
            )}

            <div className={cn(
              "text-center uppercase tracking-widest space-y-1 opacity-60 mb-8",
              paperSize === '58mm' ? "text-[8px] mb-4" : "text-[10px]"
            )}>
              {isOrder ? (
                <p className="font-bold">À PRÉPARER IMMÉDIATEMENT</p>
              ) : (
                <>
                  <p>Merci de votre visite !</p>
                  <p>À très bientôt</p>
                </>
              )}
              <p className="pt-4 text-[8px] opacity-40">© 2026 Empreintes Technologies</p>
            </div>
          </>
        )}

        {/* Paper Format Selector */}
        <div className="mb-4 p-2 bg-secondary/5 rounded-xl border border-secondary/10 no-print text-center">
          <p className="text-[9px] font-bold uppercase tracking-widest text-[#2B2321]/60 mb-2">Format de Papier</p>
          <div className="grid grid-cols-3 gap-1">
            {(['80mm', '58mm', 'standard'] as const).map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => setPaperSize(size)}
                className={cn(
                  "py-1 px-1 rounded-lg text-[8px] font-bold uppercase tracking-wider transition-all",
                  paperSize === size 
                    ? "bg-[#1A8B8C] text-white shadow-xs" 
                    : "bg-white text-[#2B2321]/70 hover:bg-white/80 border border-secondary/15"
                )}
              >
                {size === '80mm' ? '80mm (TP200)' : size === '58mm' ? '58mm' : 'A4/Standard'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3 no-print">
          <button 
            onClick={printReceipt}
            className="flex-1 py-3 bg-[#1A8B8C] text-white rounded-2xl shadow-lg shadow-[#1A8B8C]/20 font-bold flex items-center justify-center gap-2 hover:bg-[#157071] transition-colors uppercase tracking-widest text-[10px]"
          >
            <Printer className="w-4 h-4" /> Imprimer
          </button>
          <button 
            onClick={onClose}
            className="px-6 py-3 border border-[#E5C198]/50 rounded-2xl font-bold text-[#2B2321] hover:bg-white transition-colors uppercase tracking-widest text-[10px]"
          >
            Fermer
          </button>
        </div>
      </motion.div>

      <style>{`
        @media print {
          /* Force standard colors and layouts for thermal roll printing */
          html, body {
            background: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
            width: ${paperSize === 'standard' ? 'auto' : paperSize === '80mm' ? '80mm' : '58mm'} !important;
          }
          
          body * { 
            visibility: hidden !important; 
          }
          
          #printable-receipt, #printable-receipt * { 
            visibility: visible !important; 
          }
          
          #printable-receipt { 
            position: absolute !important; 
            left: 0 !important; 
            top: 0 !important; 
            width: ${paperSize === 'standard' ? '100%' : paperSize === '80mm' ? '80mm' : '58mm'} !important;
            max-width: ${paperSize === 'standard' ? 'none' : paperSize === '80mm' ? '80mm' : '58mm'} !important;
            box-shadow: none !important;
            border: none !important;
            margin: 0 !important;
            padding: ${paperSize === 'standard' ? '10mm' : paperSize === '80mm' ? '4mm' : '2mm'} !important;
            background: #ffffff !important;
            color: #000000 !important;
            border-radius: 0 !important;
            font-family: monospace, Courier, monospace !important;
            font-size: ${paperSize === 'standard' ? '14px' : paperSize === '80mm' ? '12px' : '9px'} !important;
            line-height: 1.3 !important;
          }

          /* Strip elements styles dynamically for raw printing */
          * {
            background-color: transparent !important;
            color: #000000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Remove unwanted box/pill borders */
          .bg-\[\#1A8B8C\]\/15, span[class*="border"], div[class*="border"] {
            border: none !important;
          }

          .border-b {
            border-bottom: 1px dashed #000000 !important;
          }
          .border-t {
            border-top: 1px dashed #000000 !important;
          }

          /* Page size setup */
          @page {
            size: ${paperSize === 'standard' ? 'auto' : paperSize === '80mm' ? '80mm auto' : '58mm auto'} !important;
            margin: 0 !important;
          }
          
          .print-overlay-container {
            background: transparent !important;
            backdrop-filter: none !important;
            position: static !important;
            padding: 0 !important;
            margin: 0 !important;
            width: auto !important;
            height: auto !important;
            display: block !important;
          }

          .no-print { 
            display: none !important; 
            visibility: hidden !important;
            height: 0 !important;
            width: 0 !important;
          }
        }
      `}</style>
    </div>
  );
};
