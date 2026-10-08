import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, differenceInDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { AppSettings } from '../types';
import { parseDate } from './utils';

interface PDFOptions {
  title: string;
  filename: string;
  columns: string[];
  rows: any[][];
  settings?: AppSettings | null;
  orientation?: 'p' | 'l';
}

export const generatePDF = ({ title, filename, columns, rows, settings, orientation = 'p' }: PDFOptions) => {
  const doc = new jsPDF({
    orientation,
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;

  // Add Logo if available
  if (settings?.logoUrl) {
    doc.setFontSize(22);
    doc.setTextColor(26, 139, 140); // Primary color #1A8B8C
    doc.setFont('helvetica', 'bold');
    doc.text(settings.hotelName || 'Résidence HQ', margin, 20);
  } else {
    doc.setFontSize(22);
    doc.setTextColor(26, 139, 140);
    doc.setFont('helvetica', 'bold');
    doc.text(settings?.hotelName || 'Résidence HQ', margin, 20);
  }

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.setFont('helvetica', 'normal');
  doc.text('Hôtel • Restaurant • Bar', margin, 26);

  // Add Report Title
  doc.setFontSize(18);
  doc.setTextColor(43, 35, 33); // Dark color #2B2321
  doc.setFont('helvetica', 'bold');
  doc.text(title, pageWidth / 2, 45, { align: 'center' });

  // Add Date Info
  doc.setFontSize(9);
  doc.setTextColor(150);
  doc.setFont('helvetica', 'italic');
  doc.text(`Généré le : ${format(new Date(), 'dd MMMM yyyy à HH:mm', { locale: fr })}`, pageWidth - margin, 20, { align: 'right' });

  // Add Confidential Mention
  doc.setFontSize(8);
  doc.setTextColor(200, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.text('DOCUMENT CONFIDENTIEL - USAGE INTERNE UNIQUEMENT', pageWidth / 2, 52, { align: 'center' });

  // Add Table
  autoTable(doc, {
    startY: 60,
    head: [columns],
    body: rows,
    theme: 'striped',
    headStyles: {
      fillColor: [26, 139, 140] as [number, number, number],
      textColor: [255, 255, 255] as [number, number, number],
      fontSize: 10,
      fontStyle: 'bold',
      halign: 'center',
    },
    bodyStyles: {
      fontSize: 9,
      textColor: [43, 35, 33] as [number, number, number],
    },
    alternateRowStyles: {
      fillColor: [253, 251, 247] as [number, number, number],
    },
    margin: { top: 60, left: margin, right: margin, bottom: 20 },
    didDrawPage: (data) => {
      // Footer
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(
        `Page ${data.pageNumber} | © 2026 Empreintes Technologies - ${settings?.hotelName || 'Résidence HQ'}`,
        pageWidth / 2,
        pageHeight - 10,
        { align: 'center' }
      );
    },
  });

  doc.save(`${filename}_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`);
};

export const exportReportToPDF = (
  reportData: any,
  startDate: string,
  endDate: string,
  settings: AppSettings | null
) => {
  const doc = new jsPDF({
    orientation: 'p',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - 2 * margin;

  // Primary colors
  const primaryColor: [number, number, number] = [13, 92, 83]; // #0D5C53 Deep Emerald
  const darkTextColor: [number, number, number] = [28, 35, 33];  // #1C2321 Warm Dark
  const secondaryColor: [number, number, number] = [197, 160, 89]; // #C5A059 Champagne Gold
  const mutedTextColor: [number, number, number] = [100, 100, 100];

  // Helper for computing metrics
  const totalDays = differenceInDays(new Date(endDate), new Date(startDate)) + 1;
  const totalRoomNightsAvailable = reportData.rooms.length * totalDays;
  const totalRoomNightsOccupied = reportData.bookings.reduce((acc: number, b: any) => acc + b.totalNights, 0);
  const occupancyRate = totalRoomNightsAvailable > 0 ? (totalRoomNightsOccupied / totalRoomNightsAvailable) * 100 : 0;
  const roomRevenue = reportData.bookings.reduce((acc: number, b: any) => acc + b.roomCharge, 0);
  const posRevenue = reportData.sales.reduce((acc: number, s: any) => acc + s.totalPrice, 0) + 
                     reportData.bookings.reduce((acc: number, b: any) => acc + b.posCharges, 0);
  const poolRevenue = 0;
  const totalRevenue = roomRevenue + posRevenue;
  const adr = totalRoomNightsOccupied > 0 ? roomRevenue / totalRoomNightsOccupied : 0;
  const revpar = totalRoomNightsAvailable > 0 ? roomRevenue / totalRoomNightsAvailable : 0;
  const totalExpenses = reportData.expenses.reduce((acc: number, e: any) => acc + e.amount, 0);
  const netProfit = totalRevenue - totalExpenses;
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  // Fiscal Calculations
  const roomNights = reportData.bookings.reduce((sum: number, b: any) => sum + b.totalNights, 0);
  const taxeSejourTotalLocal = roomNights * 1000;
  const roomBaseTTClocal = Math.max(0, roomRevenue - taxeSejourTotalLocal);
  const roomHTlocal = roomBaseTTClocal / 1.189;
  const roomTVALocal = roomHTlocal * 0.18;
  const roomCCALocal = roomHTlocal * 0.009;

  const posHTlocal = posRevenue / 1.189;
  const posTVALocal = posHTlocal * 0.18;
  const posCCALocal = posHTlocal * 0.009;

  const poolHTlocal = poolRevenue / 1.189;
  const poolTVALocal = poolHTlocal * 0.18;
  const poolCCALocal = poolHTlocal * 0.009;

  const grandTTClocal = roomRevenue + posRevenue + poolRevenue;
  const grandHTlocal = roomHTlocal + posHTlocal + poolHTlocal;
  const grandTVALocal = roomTVALocal + posTVALocal + poolTVALocal;
  const grandCCALocal = roomCCALocal + posCCALocal + poolCCALocal;

  // Review Calculations
  const averageRating = reportData.reviews.length > 0 
    ? reportData.reviews.reduce((acc: number, r: any) => acc + r.rating, 0) / reportData.reviews.length 
    : 0;
  const promoters = reportData.reviews.filter((r: any) => r.rating >= 4).length;
  const detractors = reportData.reviews.filter((r: any) => r.rating <= 2).length;
  const nps = reportData.reviews.length > 0 
    ? ((promoters - detractors) / reportData.reviews.length) * 100 
    : 0;

  // Page tracking & styling helpers
  let currentPage = 1;
  const totalPages = 5;

  const addPageHeaderAndFooter = (sectionTitle: string) => {
    // Header
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.setFont('helvetica', 'normal');
    doc.text(settings?.hotelName || 'Résidence HQ', margin, 10);
    doc.text(`Période : ${format(new Date(startDate), 'dd/MM/yyyy')} au ${format(new Date(endDate), 'dd/MM/yyyy')}`, pageWidth - margin, 10, { align: 'right' });
    
    doc.setDrawColor(220);
    doc.setLineWidth(0.2);
    doc.line(margin, 12, pageWidth - margin, 12);

    // Footer
    doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);
    doc.text(`Document Confidentiel - Résidence HQ Massissia, Brazzaville`, margin, pageHeight - 10);
    doc.text(`Page ${currentPage} sur ${totalPages}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
  };

  // -------------------------------------------------------------
  // PAGE 1: COVER & EXECUTIVE SUMMARY
  // -------------------------------------------------------------
  
  // Hotel Brand Block
  doc.setFontSize(24);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.text(settings?.hotelName || 'RÉSIDENCE HQ', margin, 25);

  doc.setFontSize(9);
  doc.setTextColor(darkTextColor[0], darkTextColor[1], darkTextColor[2]);
  doc.setFont('helvetica', 'normal');
  doc.text("02 rue Daniel Mayinguidi, Massissia (derrière l'usine GO Fresh, Brazzaville)", margin, 31);
  doc.text("Tél: 05 201 8181 | www.residence-hq.com", margin, 36);

  // Line Separator
  doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setLineWidth(1);
  doc.line(margin, 40, pageWidth - margin, 40);

  // Report Title
  doc.setFontSize(16);
  doc.setTextColor(darkTextColor[0], darkTextColor[1], darkTextColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.text("RAPPORT DE PERFORMANCE ET DE GESTION HÔTELIÈRE", margin, 52);

  doc.setFontSize(10);
  doc.setTextColor(mutedTextColor[0], mutedTextColor[1], mutedTextColor[2]);
  doc.setFont('helvetica', 'normal');
  doc.text(`Période d'analyse : du ${format(new Date(startDate), 'dd MMMM yyyy', { locale: fr })} au ${format(new Date(endDate), 'dd MMMM yyyy', { locale: fr })}`, margin, 58);
  doc.text(`Généré le : ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: fr })} par l'administration`, margin, 63);

  // Table 1: Synthèse Financière Global (TTC)
  doc.setFontSize(12);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.text("1. Résumé Exécutif & Indicateurs Clés", margin, 75);

  const kpiData = [
    ["Chiffre d'Affaires Hébergement (TTC)", `${roomRevenue.toLocaleString()} FCFA`, "Revenus des nuitées et séjours"],
    ["Chiffre d'Affaires Restauration / POS (TTC)", `${posRevenue.toLocaleString()} FCFA`, "Ventes terrasse, VIP, bar, restaurant"],
    ["CHIFFRE D'AFFAIRES TOTAL", `${totalRevenue.toLocaleString()} FCFA`, "Somme de tous les revenus"],
    ["Charges d'Exploitation (Dépenses)", `${totalExpenses.toLocaleString()} FCFA`, "Dépenses d'exploitation globales"],
    ["RÉSULTAT NET ESTIMÉ", `${netProfit.toLocaleString()} FCFA`, `${netProfit >= 0 ? 'Bénéfice net consolidé' : 'Perte consolidée'}`],
    ["Marge Bénéficiaire", `${profitMargin.toFixed(2)} %`, "Ratio Résultat Net / Revenus"],
    ["Taux d'Occupation Moyen", `${occupancyRate.toFixed(2)} %`, `${totalRoomNightsOccupied} nuitées sur ${totalRoomNightsAvailable} disponibles`],
    ["Prix Moyen Journalier (ADR)", `${Math.round(adr).toLocaleString()} FCFA`, "Revenu moyen par chambre louée"],
    ["RevPAR", `${Math.round(revpar).toLocaleString()} FCFA`, "Revenu moyen par chambre disponible"],
  ];

  autoTable(doc, {
    startY: 80,
    head: [["Indicateur Clé", "Valeur Périodique", "Description / Analyse"]],
    body: kpiData,
    theme: 'striped',
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255] as [number, number, number],
      fontStyle: 'bold',
      fontSize: 9,
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: darkTextColor,
    },
    alternateRowStyles: {
      fillColor: [253, 251, 247] as [number, number, number],
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 65 },
      1: { fontStyle: 'bold', textColor: primaryColor, cellWidth: 45, halign: 'right' },
      2: { cellWidth: 70 },
    },
    margin: { left: margin, right: margin },
  });

  // Footer for Page 1
  addPageHeaderAndFooter("Résumé Exécutif");

  // -------------------------------------------------------------
  // PAGE 2: PERFORMANCE HÔTELIÈRE & RÉSERVATIONS
  // -------------------------------------------------------------
  doc.addPage();
  currentPage++;
  addPageHeaderAndFooter("Performance Hôtelière");

  doc.setFontSize(12);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.text("2. Performance Hébergement & Réservations", margin, 25);

  // Mini summary block text
  doc.setFontSize(9);
  doc.setTextColor(darkTextColor[0], darkTextColor[1], darkTextColor[2]);
  doc.setFont('helvetica', 'normal');
  doc.text(`Pendant cette période de ${totalDays} jours, l'établissement a enregistré un total de ${totalRoomNightsOccupied} nuitées vendues sur un potentiel de ${totalRoomNightsAvailable} nuitées disponibles, soit un taux d'occupation de ${occupancyRate.toFixed(2)}%.`, margin, 32, { maxWidth: contentWidth });

  // Table 2.1: Répartition par Type de Chambre
  doc.setFontSize(10);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.text("Répartition de l'Occupation par Type de Chambre", margin, 45);

  const roomTypes = ['Résidence 3 chambres', 'Résidence 2 chambres', 'Appartement 1 ch. + salon', 'Chambre de Luxe', 'Chambre Standard'];
  const roomTypeRows = roomTypes.map(type => {
    const roomsOfType = reportData.rooms.filter((r: any) => r.type === type);
    const bookingsOfType = reportData.bookings.filter((b: any) => {
      const room = reportData.rooms.find((r: any) => r.id === b.roomId);
      return room && room.type === type;
    });
    
    const count = roomsOfType.length;
    const sold = bookingsOfType.reduce((sum: number, b: any) => sum + b.totalNights, 0);
    const avail = count * totalDays;
    const occ = avail > 0 ? (sold / avail) * 100 : 0;
    const rev = bookingsOfType.reduce((sum: number, b: any) => sum + b.roomCharge, 0);

    return [
      type,
      `${count} chambres`,
      `${sold} / ${avail}`,
      `${occ.toFixed(1)} %`,
      `${rev.toLocaleString()} FCFA`
    ];
  });

  autoTable(doc, {
    startY: 49,
    head: [["Type de Chambre", "Parc Existant", "Nuitées (Louées/Dispo)", "Taux d'Occupation", "Chiffre d'Affaires"]],
    body: roomTypeRows,
    theme: 'grid',
    headStyles: { fillColor: primaryColor, textColor: [255, 255, 255] as [number, number, number], fontSize: 8.5 },
    bodyStyles: { fontSize: 8, textColor: darkTextColor },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 55 },
      1: { halign: 'center' },
      2: { halign: 'center' },
      3: { fontStyle: 'bold', halign: 'center', textColor: primaryColor },
      4: { fontStyle: 'bold', halign: 'right' }
    },
    margin: { left: margin, right: margin }
  });

  // Table 2.2: Liste des Réservations/Séjours Récents
  const nextY = (doc as any).lastAutoTable.finalY + 10;
  doc.setFontSize(10);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.text("Détails des Réservations et Séjours Récents", margin, nextY);

  const bookingRows = reportData.bookings.slice(0, 8).map((b: any) => {
    return [
      b.roomNumber || '-',
      b.guestName || 'Client',
      format(parseDate(b.checkInDate), 'dd/MM/yyyy'),
      format(parseDate(b.expectedCheckOutDate), 'dd/MM/yyyy'),
      `${b.totalNights} nuits`,
      `${b.roomCharge.toLocaleString()} FCFA`,
      b.posCharges > 0 ? `${b.posCharges.toLocaleString()} FCFA` : '-'
    ];
  });

  autoTable(doc, {
    startY: nextY + 4,
    head: [["N° Ch.", "Client", "Arrivée", "Départ", "Durée", "Revenu Chambre", "Suppléments POS"]],
    body: bookingRows.length > 0 ? bookingRows : [["-", "Aucun séjour sur cette période", "-", "-", "-", "-", "-"]],
    theme: 'striped',
    headStyles: { fillColor: [80, 80, 80] as [number, number, number], textColor: [255, 255, 255] as [number, number, number], fontSize: 8 },
    bodyStyles: { fontSize: 7.5, textColor: darkTextColor },
    columnStyles: {
      0: { fontStyle: 'bold', halign: 'center' },
      5: { fontStyle: 'bold', halign: 'right' },
      6: { halign: 'right' }
    },
    margin: { left: margin, right: margin }
  });

  // -------------------------------------------------------------
  // PAGE 3: RESTAURATION & ACTIVITÉS (POS)
  // -------------------------------------------------------------
  doc.addPage();
  currentPage++;
  addPageHeaderAndFooter("Restauration & Activités");

  doc.setFontSize(12);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.text("3. Ventes Point de Vente (POS) & Activités", margin, 25);

  // Summary Text
  doc.setFontSize(9);
  doc.setTextColor(darkTextColor[0], darkTextColor[1], darkTextColor[2]);
  doc.setFont('helvetica', 'normal');
  doc.text(`Les ventes annexes consolident les activités du restaurant, du bar VIP et de la terrasse. Le total généré s'élève à ${posRevenue.toLocaleString()} FCFA.`, margin, 32, { maxWidth: contentWidth });

  // Table 3.1: Ventes par Point de Vente (Emplacements)
  doc.setFontSize(10);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.text("Chiffre d'Affaires par Point de Vente", margin, 45);

  const locations = ['Terrasse', 'VIP', 'Réception', 'Restaurant', 'Autre'];
  const locRows = locations.map(loc => {
    const salesInLoc = reportData.sales.filter((s: any) => s.location === loc || (loc === 'Autre' && !s.location));
    const total = salesInLoc.reduce((sum: number, s: any) => sum + s.totalPrice, 0);
    const count = salesInLoc.length;
    return [
      loc,
      `${count} ventes`,
      `${total.toLocaleString()} FCFA`,
      totalRevenue > 0 ? `${((total / totalRevenue) * 100).toFixed(1)} % du CA Global` : '-'
    ];
  });

  autoTable(doc, {
    startY: 49,
    head: [["Emplacement", "Nombre de Commandes", "Volume d'Affaires (TTC)", "Part relative"]],
    body: locRows,
    theme: 'grid',
    headStyles: { fillColor: primaryColor, textColor: [255, 255, 255] as [number, number, number], fontSize: 8.5 },
    bodyStyles: { fontSize: 8, textColor: darkTextColor },
    columnStyles: {
      0: { fontStyle: 'bold' },
      1: { halign: 'center' },
      2: { fontStyle: 'bold', halign: 'right', textColor: primaryColor },
      3: { halign: 'center' }
    },
    margin: { left: margin, right: margin }
  });

  // Table 3.2: Locations de Salles de Réception
  const nextY3 = (doc as any).lastAutoTable.finalY + 10;
  doc.setFontSize(10);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.text("Locations de Salles & Événements", margin, nextY3);

  const activitiesRows = [
    ["Location Salles de Fête / Conférence", `${(reportData.halls || []).filter((h: any) => h.status === 'Occupied').length} salles louées`, `${reportData.sales.filter((s: any) => s.items.some((i: any) => i.type === 'hall')).reduce((acc: number, s: any) => acc + s.totalPrice, 0).toLocaleString()} FCFA`, "Usage séminaires et événements"],
  ];

  autoTable(doc, {
    startY: nextY3 + 4,
    head: [["Activité / Service", "Volume d'Usage", "Chiffre d'Affaires", "Observations"]],
    body: activitiesRows,
    theme: 'striped',
    headStyles: { fillColor: [80, 80, 80] as [number, number, number], textColor: [255, 255, 255] as [number, number, number], fontSize: 8 },
    bodyStyles: { fontSize: 7.5, textColor: darkTextColor },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 50 },
      1: { halign: 'center', cellWidth: 35 },
      2: { fontStyle: 'bold', halign: 'right', cellWidth: 40 },
      3: { cellWidth: 55 }
    },
    margin: { left: margin, right: margin }
  });

  // -------------------------------------------------------------
  // PAGE 4: FINANCES & DECLARATION FISCALE CONGOLAISE (DGI)
  // -------------------------------------------------------------
  doc.addPage();
  currentPage++;
  addPageHeaderAndFooter("Finances & Fiscalité");

  doc.setFontSize(12);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.text("4. Comptabilité, Trésorerie & Fiscalité (Congo)", margin, 25);

  doc.setFontSize(9);
  doc.setTextColor(darkTextColor[0], darkTextColor[1], darkTextColor[2]);
  doc.setFont('helvetica', 'normal');
  doc.text("Ce volet présente l'évaluation fiscale selon la législation de la République du Congo (DGI). Les taxes obligatoires sont collectées sur l'hébergement et la restauration.", margin, 32, { maxWidth: contentWidth });

  // Table 4.1: Synthèse des Taxes DGI
  doc.setFontSize(10);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.text("Déclaration de TVA & Surtaxes Associées (DGI Congo)", margin, 45);

  const fiscalSummaryRows = [
    [
      "Hébergement / Chambres",
      `${Math.round(roomHTlocal).toLocaleString()} FCFA`,
      `${Math.round(roomTVALocal).toLocaleString()} FCFA`,
      `${Math.round(roomCCALocal).toLocaleString()} FCFA`,
      `${taxeSejourTotalLocal.toLocaleString()} FCFA`,
      `${roomRevenue.toLocaleString()} FCFA`
    ],
    [
      "Restauration / POS",
      `${Math.round(posHTlocal).toLocaleString()} FCFA`,
      `${Math.round(posTVALocal).toLocaleString()} FCFA`,
      `${Math.round(posCCALocal).toLocaleString()} FCFA`,
      "- FCFA",
      `${posRevenue.toLocaleString()} FCFA`
    ],
    [
      "TOTAL GÉNÉRAL CONSOLIDÉ",
      `${Math.round(grandHTlocal).toLocaleString()} FCFA`,
      `${Math.round(grandTVALocal).toLocaleString()} FCFA`,
      `${Math.round(grandCCALocal).toLocaleString()} FCFA`,
      `${taxeSejourTotalLocal.toLocaleString()} FCFA`,
      `${grandTTClocal.toLocaleString()} FCFA`
    ]
  ];

  autoTable(doc, {
    startY: 49,
    head: [["Secteur", "Base HT", "TVA (18%)", "CCA (0.9%)", "Taxe Séjour", "Total TTC"]],
    body: fiscalSummaryRows,
    theme: 'grid',
    headStyles: { fillColor: primaryColor, textColor: [255, 255, 255] as [number, number, number], fontSize: 8 },
    bodyStyles: { fontSize: 7.5, textColor: darkTextColor },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 35 },
      1: { halign: 'right' },
      2: { halign: 'right', textColor: primaryColor },
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { fontStyle: 'bold', halign: 'right' }
    },
    margin: { left: margin, right: margin }
  });

  // Table 4.2: Ventilation des Dépenses par Catégorie
  const nextY4 = (doc as any).lastAutoTable.finalY + 10;
  doc.setFontSize(10);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.text("Analyse des Dépenses & Sorties de Caisse", margin, nextY4);

  // Group expenses by category
  const expensesByCat = reportData.expenses.reduce((acc: Record<string, number>, e: any) => {
    const cat = e.category || 'Général';
    acc[cat] = (acc[cat] || 0) + e.amount;
    return acc;
  }, {});

  const expensesRows = Object.entries(expensesByCat).map(([cat, amount]) => {
    return [
      cat,
      `${(amount as number).toLocaleString()} FCFA`,
      totalExpenses > 0 ? `${(((amount as number) / totalExpenses) * 100).toFixed(1)} %` : '0 %'
    ];
  });

  autoTable(doc, {
    startY: nextY4 + 4,
    head: [["Catégorie de Dépense", "Montant Total (TTC)", "Part relative"]],
    body: expensesRows.length > 0 ? expensesRows : [["Aucune dépense enregistrée", "0 FCFA", "0 %"]],
    theme: 'striped',
    headStyles: { fillColor: [120, 40, 40] as [number, number, number], textColor: [255, 255, 255] as [number, number, number], fontSize: 8 },
    bodyStyles: { fontSize: 8, textColor: darkTextColor },
    columnStyles: {
      0: { fontStyle: 'bold' },
      1: { fontStyle: 'bold', halign: 'right' },
      2: { halign: 'center' }
    },
    margin: { left: margin, right: margin }
  });

  // -------------------------------------------------------------
  // PAGE 5: OPÉRATIONS, PROPRETÉ & EXPÉRIENCE CLIENT
  // -------------------------------------------------------------
  doc.addPage();
  currentPage++;
  addPageHeaderAndFooter("Opérations & Qualité");

  doc.setFontSize(12);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.text("5. Opérations, Maintenance, Propreté & Avis Clients", margin, 25);

  doc.setFontSize(9);
  doc.setTextColor(darkTextColor[0], darkTextColor[1], darkTextColor[2]);
  doc.setFont('helvetica', 'normal');
  doc.text("Le suivi opérationnel inclut le statut des tâches de nettoyage (valets de chambre), la résolution des pannes de maintenance ainsi que le feedback de satisfaction de nos clients.", margin, 32, { maxWidth: contentWidth });

  // Table 5.1: Statut des Tâches Opérationnelles
  doc.setFontSize(10);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.text("Statut des Tâches Opérationnelles", margin, 45);

  const cleaningsCount = reportData.cleaningTasks.length;
  const validatedCleanings = reportData.cleaningTasks.filter((t: any) => t.status === 'Validated').length;
  const pendingCleanings = reportData.cleaningTasks.filter((t: any) => t.status === 'Pending').length;

  const maintenanceCount = reportData.maintenanceTasks.length;
  const resolvedMaintenance = reportData.maintenanceTasks.filter((t: any) => t.status === 'Validated').length;
  const pendingMaintenance = reportData.maintenanceTasks.filter((t: any) => ['Pending', 'Accepted', 'NeedSubmitted'].includes(t.status)).length;
  const totalMaintenanceExpenses = reportData.maintenanceTasks.reduce((sum: number, rx: any) => sum + (rx.cost || 0), 0);

  const operationsRows = [
    ["Tâches de Propreté (Chambres & Salles)", `${cleaningsCount} assignées`, `${validatedCleanings} validées`, `${pendingCleanings} en attente`, "Réalisé par l'équipe de ménage"],
    ["Fiches de Maintenance (Technique)", `${maintenanceCount} signalées`, `${resolvedMaintenance} résolues`, `${pendingMaintenance} en attente`, `Coût : ${totalMaintenanceExpenses.toLocaleString()} FCFA`],
    ["Effectifs Actifs", `${reportData.users.length} collaborateurs`, "-", "-", "Toutes fonctions confondues"]
  ];

  autoTable(doc, {
    startY: 49,
    head: [["Département", "Volume total", "Réalisé / Résolu", "En attente / Reste", "Observations / Coût"]],
    body: operationsRows,
    theme: 'grid',
    headStyles: { fillColor: primaryColor, textColor: [255, 255, 255] as [number, number, number], fontSize: 8.5 },
    bodyStyles: { fontSize: 8, textColor: darkTextColor },
    columnStyles: {
      0: { fontStyle: 'bold' },
      1: { halign: 'center' },
      2: { halign: 'center' },
      3: { halign: 'center' }
    },
    margin: { left: margin, right: margin }
  });

  // Table 5.2: Feedback Client & Score NPS
  const nextY5 = (doc as any).lastAutoTable.finalY + 10;
  doc.setFontSize(10);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.text("Qualité de Service & Avis Clients", margin, nextY5);

  const ratingRows = [
    ["Nombre total d'avis collectés", `${reportData.reviews.length} avis`, "Base d'évaluation client"],
    ["Note moyenne de satisfaction", `${averageRating.toFixed(2)} / 5`, `${averageRating >= 4 ? 'Très Satisfaisant' : 'À améliorer'}`],
    ["Taux NPS (Net Promoter Score)", `${nps.toFixed(1)} %`, `Promoteurs : ${promoters} | Détracteurs : ${detractors}`]
  ];

  autoTable(doc, {
    startY: nextY5 + 4,
    head: [["Indicateur Qualité", "Score / Valeur", "Interprétation"]],
    body: ratingRows,
    theme: 'striped',
    headStyles: { fillColor: [80, 80, 80] as [number, number, number], textColor: [255, 255, 255] as [number, number, number], fontSize: 8 },
    bodyStyles: { fontSize: 8, textColor: darkTextColor },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 60 },
      1: { fontStyle: 'bold', textColor: primaryColor, halign: 'center', cellWidth: 45 },
      2: { cellWidth: 75 }
    },
    margin: { left: margin, right: margin }
  });

  // Client Verbatims summary
  const nextY5_2 = (doc as any).lastAutoTable.finalY + 8;
  doc.setFontSize(9);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.text("Extraits d'Avis Clients Marquants :", margin, nextY5_2);

  let currentTextY = nextY5_2 + 5;
  const recentReviews = reportData.reviews.slice(0, 3);
  if (recentReviews.length > 0) {
    recentReviews.forEach((r: any) => {
      doc.setFontSize(8);
      doc.setTextColor(darkTextColor[0], darkTextColor[1], darkTextColor[2]);
      doc.setFont('helvetica', 'italic');
      doc.text(`"${r.comment || 'Sans commentaire'}" - Note: ${r.rating}/5 par ${r.guestName || 'Anonyme'}`, margin + 5, currentTextY, { maxWidth: contentWidth - 10 });
      currentTextY += 5;
    });
  } else {
    doc.setFontSize(8);
    doc.setTextColor(mutedTextColor[0], mutedTextColor[1], mutedTextColor[2]);
    doc.text("Aucun commentaire client enregistré sur cette période.", margin + 5, currentTextY);
  }

  // Save the structured PDF with a clean timestamped filename
  const filename = `Rapport_Gestion_${format(new Date(startDate), 'yyyyMMdd')}_${format(new Date(endDate), 'yyyyMMdd')}`;
  doc.save(`${filename}.pdf`);
};

export const exportUserGuideToPDF = (guideSections: any[], settings: AppSettings | null) => {
  const doc = new jsPDF({
    orientation: 'p',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - (2 * margin);

  const primaryColor: [number, number, number] = [13, 92, 83]; // #0D5C53 Deep Emerald
  const darkTextColor: [number, number, number] = [28, 35, 33];  // #1C2321 Warm Dark
  const secondaryColor: [number, number, number] = [197, 160, 89]; // #C5A059 Champagne Gold
  const mutedTextColor: [number, number, number] = [100, 100, 100];

  // -------------------------------------------------------------
  // PAGE 1: COVER PAGE
  // -------------------------------------------------------------
  
  // Top Banner
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(margin, 20, contentWidth, 12, 'F');
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text("MANUEL DE REFERENCE TECHNIQUE & GUIDE D'UTILISATION", pageWidth / 2, 27.5, { align: 'center' });

  // Hotel Name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  doc.setTextColor(darkTextColor[0], darkTextColor[1], darkTextColor[2]);
  doc.text(settings?.hotelName || 'RÉSIDENCE HQ', pageWidth / 2, 48, { align: 'center' });

  // Subtitle
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text("Hôtel • Restaurant • Terrasse VIP • Salles d'Événements", pageWidth / 2, 54, { align: 'center' });

  // Main Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(darkTextColor[0], darkTextColor[1], darkTextColor[2]);
  doc.text("GUIDE TECHNIQUE DES MODULES & PROCÉDURES", pageWidth / 2, 72, { align: 'center' });

  // Divider
  doc.setDrawColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.setLineWidth(0.6);
  doc.line(margin + 20, 78, pageWidth - margin - 20, 78);

  // Metadata block
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8.5);
  doc.setTextColor(mutedTextColor[0], mutedTextColor[1], mutedTextColor[2]);
  doc.text(`Document généré le : ${format(new Date(), 'dd MMMM yyyy à HH:mm', { locale: fr })}`, pageWidth / 2, 84, { align: 'center' });
  doc.text("Auteur : Administration des Systèmes • Editeur : Empreintes Technologies", pageWidth / 2, 88, { align: 'center' });

  // Frame Box for Description
  doc.setFillColor(253, 251, 247);
  doc.setDrawColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, 95, contentWidth, 38, 2, 2, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(darkTextColor[0], darkTextColor[1], darkTextColor[2]);
  
  const introText = [
    "Ce manuel technique rassemble l'intégralité des procédures d'utilisation de l'application de gestion.",
    "Il a été conçu pour former les nouveaux collaborateurs, standardiser les tâches quotidiennes et",
    "garantir une traçabilité comptable et opérationnelle rigoureuse de l'établissement.",
    "Chaque fiche technique détaille les fonctionnalités du module, la marche à suivre pas-à-pas",
    "et les niveaux d'autorisation nécessaires pour préserver l'intégrité de vos données."
  ];
  
  let introY = 101;
  introText.forEach(line => {
    doc.text(line, pageWidth / 2, introY, { align: 'center' });
    introY += 5.5;
  });

  // Table of Contents title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text("TABLE DES MATIÈRES & CODES D'ACCÈS DES COLLABORATEURS", margin, 144);

  // Table of Contents using autoTable
  const tocRows = guideSections.map((s, idx) => [
    `${idx + 1}`,
    s.title,
    s.role
  ]);

  autoTable(doc, {
    startY: 148,
    head: [["Code", "Module Applicatif", "Rôles & Personnel Autorisé"]],
    body: tocRows,
    theme: 'striped',
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontSize: 8.5,
      fontStyle: 'bold',
    },
    bodyStyles: {
      fontSize: 8,
      textColor: darkTextColor,
      cellPadding: 1.5,
    },
    alternateRowStyles: {
      fillColor: [253, 251, 247],
    },
    columnStyles: {
      0: { fontStyle: 'bold', halign: 'center', cellWidth: 15 },
      1: { fontStyle: 'bold', cellWidth: 65 },
      2: { cellWidth: 90 },
    },
    margin: { left: margin, right: margin },
  });

  // -------------------------------------------------------------
  // PAGE 2+: INDIVIDUAL MODULE DETAILS CARD LAYOUT
  // -------------------------------------------------------------
  doc.addPage();
  let currentY = 20;

  guideSections.forEach((section, index) => {
    // 1. Pre-calculate heights to handle page breaking perfectly
    const wrappedDesc = doc.splitTextToSize(section.description, contentWidth - 16);
    
    // Calculate total steps lines
    const stepLines: string[][] = [];
    let stepsHeight = 0;
    section.steps.forEach((step: string, sIdx: number) => {
      const lines = doc.splitTextToSize(`${sIdx + 1}. ${step}`, contentWidth - 24);
      stepLines.push(lines);
      stepsHeight += (lines.length * 4.2) + 2.5; // spacing per step
    });

    const cardHeight = 6 + 8 + 3 + (wrappedDesc.length * 4.5) + 4 + stepsHeight + 4 + 8 + 6;

    // Check if the card fits on the current page, if not, add page
    if (currentY + cardHeight > pageHeight - 20) {
      doc.addPage();
      currentY = 20;
    }

    // Draw Card Container
    doc.setFillColor(253, 251, 247);
    doc.setDrawColor(229, 231, 235); // subtle grey
    doc.setLineWidth(0.35);
    doc.roundedRect(margin, currentY, contentWidth, cardHeight, 3, 3, 'FD');

    // Accent left bar inside card
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(margin + 0.35, currentY + 5, 2.5, 9, 'F');

    // Section title & Code
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(`${index + 1}. ${section.title.toUpperCase()}`, margin + 6, currentY + 11.5);

    // Section description
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(darkTextColor[0], darkTextColor[1], darkTextColor[2]);
    
    let descY = currentY + 18;
    wrappedDesc.forEach((line: string) => {
      doc.text(line, margin + 8, descY);
      descY += 4.5;
    });

    // Separator line
    doc.setDrawColor(229, 193, 152);
    doc.setLineWidth(0.2);
    doc.line(margin + 8, descY + 1.5, pageWidth - margin - 8, descY + 1.5);

    // Steps title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(mutedTextColor[0], mutedTextColor[1], mutedTextColor[2]);
    doc.text("PROCÉDURE OPÉRATIONNELLE :", margin + 8, descY + 6);

    // Render each step with elegant bullet background and text wrapping
    let stepY = descY + 10;
    section.steps.forEach((step: string, sIdx: number) => {
      const lines = stepLines[sIdx];
      
      // Step bullet circle/square
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.roundedRect(margin + 8, stepY - 2.5, 5, 4.5, 1, 1, 'F');
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(255, 255, 255);
      doc.text(`${sIdx + 1}`, margin + 10.5, stepY + 0.6, { align: 'center' });

      // Step text
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.2);
      doc.setTextColor(darkTextColor[0], darkTextColor[1], darkTextColor[2]);
      
      lines.forEach((line: string, lIdx: number) => {
        let cleanLine = line;
        if (lIdx === 0 && line.startsWith(`${sIdx + 1}. `)) {
          cleanLine = line.substring(`${sIdx + 1}. `.length);
        }
        doc.text(cleanLine, margin + 16, stepY + (lIdx * 4));
      });

      stepY += (lines.length * 4) + 2.5;
    });

    // Roles block at the bottom of the card
    doc.setFillColor(243, 244, 246); // light grey
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.2);
    doc.roundedRect(margin + 8, stepY + 1, contentWidth - 16, 7.5, 1, 1, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(`RÔLES ET UTILISATEURS AUTORISÉS :  ${section.role.toUpperCase()}`, margin + 12, stepY + 5.8);

    // Update currentY for next section
    currentY = stepY + 1 + 7.5 + 6 + 6; // inner padding + margin
  });

  // -------------------------------------------------------------
  // POST PROCESS: ADD HEADERS & FOOTERS (Total Page Numbers)
  // -------------------------------------------------------------
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Top Header (skip Cover Page)
    if (i > 1) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(150, 150, 150);
      doc.text(settings?.hotelName || 'Résidence HQ', margin, 10);
      doc.text("MANUEL TECHNIQUE & GUIDE DE GESTION", pageWidth - margin, 10, { align: 'right' });

      doc.setDrawColor(230, 230, 230);
      doc.setLineWidth(0.25);
      doc.line(margin, 12, pageWidth - margin, 12);
    }

    // Bottom Footer (all pages)
    doc.setDrawColor(230, 230, 230);
    doc.setLineWidth(0.25);
    doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(160, 160, 160);
    doc.text("DOCUMENT STRICTEMENT CONFIDENTIEL • USAGE INTERNE POUR LA RÉSIDENCE HQ", margin, pageHeight - 8);
    doc.text(`Page ${i} sur ${totalPages}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
  }

  // Save PDF
  const nameSafe = (settings?.hotelName || 'Residence_HQ').replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`Guide_Technique_Gestion_${nameSafe}.pdf`);
};

export interface ClosurePDFData {
  id?: string;
  location: string;
  cashierName: string;
  cashierRole: string;
  timestamp: any;
  cashSales: number;
  cardSales: number;
  mobileSales: number;
  roomSales: number;
  totalSales: number;
  salesCount: number;
  physicalCashCounted: number;
  discrepancy: number;
  notes?: string;
  totalExpenses?: number;
  expensesCount?: number;
  expensesDetails?: any[];
  stockSummary?: {
    totalProductsCount: number;
    totalStockUnits: number;
    totalStockValue: number;
    lowStockCount: number;
  };
  stockDetails?: any[];
  salesByLocation?: { [key: string]: number };
}

const formatNum = (num: number) => {
  if (isNaN(num) || num === undefined || num === null) return '0';
  return Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
};

export const generateClosureReportPDF = ({
  closureReport,
  salesDetails,
  expensesDetails,
  stockDetails,
  settings
}: {
  closureReport: ClosurePDFData;
  salesDetails: any[];
  expensesDetails?: any[];
  stockDetails?: any[];
  settings?: AppSettings | null;
}) => {
  const doc = new jsPDF({
    orientation: 'p',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const primaryColor = [26, 139, 140]; // #1A8B8C
  const darkColor = [28, 35, 33]; // #1C2321

  // Header Banner
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(0, 0, pageWidth, 26, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(settings?.hotelName || 'RÉSIDENCE HOTEL', margin, 12);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('RAPPORT JOURNALIER DE CLÔTURE DE CAISSE', margin, 19);

  const formattedDate = parseDate(closureReport.timestamp);
  const dateStr = format(formattedDate, 'dd/MM/yyyy à HH:mm', { locale: fr });
  doc.text(`Généré le : ${dateStr}`, pageWidth - margin, 19, { align: 'right' });

  let y = 33;

  // Metadata Card (Location, Cashier, Date)
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, pageWidth - 2 * margin, 22, 2, 2, 'FD');

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);

  const locLabel = (!closureReport.location || closureReport.location === 'Tous' || closureReport.location === 'Générale')
    ? 'Clôture Générale (Tous les lieux)'
    : `Point de Vente : ${closureReport.location}`;
  doc.text(`Lieu / Périmètre : ${locLabel}`, margin + 5, y + 7);
  doc.text(`Responsable Caisse : ${closureReport.cashierName} (${closureReport.cashierRole})`, margin + 5, y + 14);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Transactions : ${closureReport.salesCount} vente(s)`, pageWidth - margin - 5, y + 7, { align: 'right' });
  doc.text(`Date Caisse : ${format(formattedDate, 'dd MMMM yyyy', { locale: fr })}`, pageWidth - margin - 5, y + 14, { align: 'right' });

  y += 27;

  // Section 1: Financial Summary Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text("1. RÉCAPITULATIF DES VENTÉS PAR MODE DE PAIEMENT", margin, y);
  y += 3;

  const paymentRows = [
    ['Espèces', `${formatNum(closureReport.cashSales)} FCFA`],
    ['Carte Bancaire', `${formatNum(closureReport.cardSales)} FCFA`],
    ['Mobile Money', `${formatNum(closureReport.mobileSales)} FCFA`],
    ['Charges Chambres (Crédit)', `${formatNum(closureReport.roomSales)} FCFA`],
    [{ content: 'TOTAL DU CHIFFRE D\'AFFAIRES', styles: { fontStyle: 'bold' as const } }, { content: `${formatNum(closureReport.totalSales)} FCFA`, styles: { fontStyle: 'bold' as const, textColor: primaryColor as any } }]
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
      loc, `${formatNum(amt as number)} FCFA`
    ]);
    locRows.push([{ content: 'TOTAL DU CHIFFRE D\'AFFAIRES', styles: { fontStyle: 'bold' as const } } as any, { content: `${formatNum(closureReport.totalSales)} FCFA`, styles: { fontStyle: 'bold' as const, textColor: primaryColor as any } } as any]);

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
  doc.setFontSize(10.5);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text("2. CONTRÔLE ET ÉCART DE CAISSE EN ESPÈCES", margin, y);
  y += 3;

  const diff = closureReport.discrepancy;
  const diffStatus = diff === 0 ? 'Conforme (Aucun écart)' : diff > 0 ? `Excédent (+${formatNum(diff)} FCFA)` : `Déficit (${formatNum(diff)} FCFA)`;

  const auditRows = [
    ['Espèces Théoriques Attendues (Ventes Espèces)', `${formatNum(closureReport.cashSales)} FCFA`],
    ['Espèces Physiques Comptées en Caisse', `${formatNum(closureReport.physicalCashCounted)} FCFA`],
    ['Écart Constaté', `${diffStatus}`]
  ];

  autoTable(doc, {
    startY: y,
    head: [['Indicateur de Contrôle', 'Valeur / Constat']],
    body: auditRows,
    margin: { left: margin, right: margin },
    theme: 'plain',
    headStyles: { fillColor: [43, 35, 33], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
    bodyStyles: { fontSize: 8 },
    columnStyles: { 0: { cellWidth: 110, fontStyle: 'bold' }, 1: { halign: 'right', fontStyle: 'bold' } }
  });

  y = (doc as any).lastAutoTable.finalY + 7;

  // Section 3: Daily Expenses Report (Dépenses du Jour)
  const actualExpenses = closureReport.expensesDetails || [];
  const totExp = closureReport.totalExpenses ?? actualExpenses.reduce((a, b) => a + (b.amount || 0), 0);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text(`3. RAPPORT DES DÉPENSES EFFECTUÉES DU JOUR (${actualExpenses.length} dépense(s))`, margin, y);
  y += 3;

  const expenseTableRows = actualExpenses.map((exp: any) => [
    exp.description || 'Dépense',
    exp.category || 'Autre',
    exp.recordedBy || 'N/A',
    `${formatNum(exp.amount || 0)} FCFA`
  ]);

  if (expenseTableRows.length === 0) {
    expenseTableRows.push(['Aucune dépense enregistrée aujourd\'hui pour ce périmètre', '-', '-', '0 FCFA']);
  } else {
    expenseTableRows.push([
      { content: 'TOTAL DÉPENSES DU JOUR', styles: { fontStyle: 'bold' as const } },
      '',
      '',
      { content: `${formatNum(totExp)} FCFA`, styles: { fontStyle: 'bold' as const, textColor: [220, 38, 38] as any } }
    ]);
  }

  autoTable(doc, {
    startY: y,
    head: [['Description', 'Catégorie', 'Auteur', 'Montant (FCFA)']],
    body: expenseTableRows,
    margin: { left: margin, right: margin },
    theme: 'striped',
    headStyles: { fillColor: [185, 28, 28], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 7.5 },
    columnStyles: {
      0: { cellWidth: 80 },
      1: { cellWidth: 35 },
      2: { cellWidth: 30 },
      3: { cellWidth: 35, halign: 'right', fontStyle: 'bold' }
    }
  });

  y = (doc as any).lastAutoTable.finalY + 7;

  // Section 4: Remaining Stock Report (Stock Restant par Point de Vente - Exclus pour la Clôture Générale)
  if (closureReport.location !== 'Tous') {
    // Check page height before Stock Report
    if (y > pageHeight - 65) {
      doc.addPage();
      y = 20;
    }

    const actualStock = closureReport.stockDetails || [];
    const stockSum = closureReport.stockSummary || {
      totalProductsCount: actualStock.length,
      totalStockUnits: actualStock.reduce((a, b) => a + (b.stock || 0), 0),
      totalStockValue: actualStock.reduce((a, b) => a + ((b.stock || 0) * (b.price || 0)), 0),
      lowStockCount: actualStock.filter((b: any) => (b.stock || 0) <= 5).length
    };

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(`4. RAPPORT DU STOCK RESTANT AU POINT DE VENTE (${stockSum.totalProductsCount} articles)`, margin, y);
    y += 3;

    const stockTableRows = actualStock.map((prod: any) => {
      const isLow = (prod.stock || 0) <= 5;
      return [
        prod.name || 'Produit',
        prod.category || 'Général',
        `${formatNum(prod.price || 0)} F`,
        { content: `${prod.stock || 0} unit. ${isLow ? '(ALERTE BAS)' : ''}`, styles: { fontStyle: isLow ? 'bold' as const : 'normal' as const, textColor: isLow ? [220, 38, 38] as any : [28, 35, 33] as any } },
        `${formatNum((prod.stock || 0) * (prod.price || 0))} F`
      ];
    });

    if (stockTableRows.length === 0) {
      stockTableRows.push(['Aucun article en stock pour ce périmètre', '-', '0 F', '0 unit.', '0 F']);
    } else {
      stockTableRows.push([
        { content: 'TOTAL STOCK RESTANT', styles: { fontStyle: 'bold' as const } },
        '',
        '',
        { content: `${stockSum.totalStockUnits} unités`, styles: { fontStyle: 'bold' as const } },
        { content: `${formatNum(stockSum.totalStockValue)} F`, styles: { fontStyle: 'bold' as const, textColor: primaryColor as any } }
      ]);
    }

    autoTable(doc, {
      startY: y,
      head: [['Nom Article', 'Catégorie', 'Prix Unitaire', 'Stock Restant', 'Valeur Stock']],
      body: stockTableRows,
      margin: { left: margin, right: margin },
      theme: 'grid',
      headStyles: { fillColor: [30, 58, 138], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 7.5 },
      columnStyles: {
        0: { cellWidth: 65 },
        1: { cellWidth: 35 },
        2: { cellWidth: 25, halign: 'right' },
        3: { cellWidth: 25, halign: 'center' },
        4: { cellWidth: 30, halign: 'right', fontStyle: 'bold' }
      }
    });

    y = (doc as any).lastAutoTable.finalY + 7;
  }

  // Check page height before Sales Details
  if (y > pageHeight - 50) {
    doc.addPage();
    y = 20;
  }

  // Section 5: Itemized Sales Details
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text("5. DÉTAILS DES VENTES DU JOUR (JOURNAL DE CAISSE)", margin, y);
  y += 3;

  const salesTableRows = (salesDetails || []).map((sale: any) => {
    const timeStr = format(parseDate(sale.timestamp), 'HH:mm');
    const itemsSummary = sale.items?.map((i: any) => `${i.quantity}x ${i.productName}`).join(', ') || 'Articles divers';
    const locText = sale.location || 'N/A';
    const tableRoomText = sale.tableNumber ? `T.${sale.tableNumber}` : sale.roomId ? `Ch.${sale.roomId}` : '';
    const fullLoc = [locText, tableRoomText].filter(Boolean).join(' ');

    return [
      timeStr,
      sale.sellerName || 'Inconnu',
      fullLoc,
      itemsSummary,
      sale.paymentMethod || 'Espèces',
      `${formatNum(sale.totalPrice || 0)} F`
    ];
  });

  if (salesTableRows.length === 0) {
    salesTableRows.push(['-', '-', '-', 'Aucune vente enregistrée pour ce périmètre', '-', '0 F']);
  }

  autoTable(doc, {
    startY: y,
    head: [['Heure', 'Vendeur', 'Lieu / Ref', 'Détails Articles', 'Paiement', 'Montant']],
    body: salesTableRows,
    margin: { left: margin, right: margin },
    theme: 'grid',
    headStyles: { fillColor: [71, 85, 105], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 7.5 },
    columnStyles: {
      0: { cellWidth: 15 },
      1: { cellWidth: 25 },
      2: { cellWidth: 28 },
      3: { cellWidth: 67 },
      4: { cellWidth: 22 },
      5: { cellWidth: 23, halign: 'right', fontStyle: 'bold' }
    }
  });

  y = (doc as any).lastAutoTable.finalY + 7;

  // Notes Section if any
  if (closureReport.notes) {
    if (y > pageHeight - 40) {
      doc.addPage();
      y = 20;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.text("Observations / Remarques :", margin, y);
    y += 4;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text(closureReport.notes, margin + 2, y, { maxWidth: pageWidth - 2 * margin });
    y += 10;
  }

  // Check remaining page height for signatures
  if (y > pageHeight - 35) {
    doc.addPage();
    y = 20;
  }

  // Signatures
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.text("Signature du Caissier / Agent", margin + 10, y + 5);
  doc.text("Signature du Manager / Direction", pageWidth - margin - 60, y + 5);

  doc.setDrawColor(200);
  doc.setLineWidth(0.3);
  doc.line(margin + 5, y + 20, margin + 65, y + 20);
  doc.line(pageWidth - margin - 65, y + 20, pageWidth - margin - 5, y + 20);

  // Footer Page numbers
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text(`Rapport Journalier de Clôture - ${closureReport.location || 'Générale'}`, margin, pageHeight - 8);
    doc.text(`Page ${i} sur ${totalPages}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
  }

  const cleanLocName = (closureReport.location || 'Generale').replace(/[^a-zA-Z0-9]/g, '_');
  const dateFile = format(formattedDate, 'yyyy-MM-dd_HHmm');
  doc.save(`Rapport_Cloture_${cleanLocName}_${dateFile}.pdf`);
};

export const exportUsersPDF = (users: any[], settings: AppSettings | null) => {
  const doc = new jsPDF({
    orientation: 'p',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;

  // Header
  doc.setFontSize(20);
  doc.setTextColor(26, 139, 140);
  doc.setFont('helvetica', 'bold');
  doc.text(settings?.hotelName || 'Résidence HQ', margin, 20);

  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.setFont('helvetica', 'normal');
  doc.text('Hôtel • Restaurant • Bar • Administration', margin, 26);

  // Title
  doc.setFontSize(14);
  doc.setTextColor(43, 35, 33);
  doc.setFont('helvetica', 'bold');
  doc.text("LISTE DES UTILISATEURS & ACCÈS SYSTÈME", pageWidth / 2, 40, { align: 'center' });

  // Confidential Banner
  doc.setFillColor(239, 68, 68); // Red background
  doc.rect(margin, 46, pageWidth - 2 * margin, 8, 'F');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text("DOCUMENT TRÈS CONFIDENTIEL — USAGE STRICTEMENT INTERNE", pageWidth / 2, 51.5, { align: 'center' });

  // Date
  doc.setFontSize(8.5);
  doc.setTextColor(100);
  doc.setFont('helvetica', 'italic');
  doc.text(`Généré le : ${format(new Date(), 'dd MMMM yyyy à HH:mm', { locale: fr })}`, pageWidth - margin, 20, { align: 'right' });

  const rows = users.map((u, index) => [
    (index + 1).toString(),
    u.username || 'N/A',
    u.email || 'N/A',
    u.role || 'staff',
    u.password || '••••••••'
  ]);

  autoTable(doc, {
    startY: 60,
    head: [['#', "Nom de l'Employé", 'Email', 'Rôle', 'Mot de passe']],
    body: rows,
    theme: 'grid',
    headStyles: {
      fillColor: [26, 139, 140],
      textColor: [255, 255, 255],
      fontSize: 9,
      fontStyle: 'bold',
      halign: 'center'
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: [43, 35, 33]
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 45, fontStyle: 'bold' },
      2: { cellWidth: 50 },
      3: { cellWidth: 35 },
      4: { cellWidth: 40, fontStyle: 'bold', textColor: [13, 92, 83] }
    },
    margin: { left: margin, right: margin, top: 60, bottom: 20 },
    didDrawPage: (data) => {
      const totalPages = doc.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(
        `Page ${data.pageNumber} sur ${totalPages} | Document très confidentiel — ${settings?.hotelName || 'Résidence HQ'}`,
        pageWidth / 2,
        pageHeight - 10,
        { align: 'center' }
      );
    }
  });

  doc.save(`Liste_Utilisateurs_Confidentiel_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`);
};

export interface MaintenancePDFData {
  periodType: 'day' | 'week' | 'month';
  periodValue: string;
  tasks: any[];
  monthlyTasks: any[];
  dailyChecklists: any[];
  settings: AppSettings | null;
}

export const exportMaintenanceReportPDF = ({
  periodType,
  periodValue,
  tasks,
  monthlyTasks,
  dailyChecklists,
  settings
}: MaintenancePDFData) => {
  const doc = new jsPDF({
    orientation: 'p',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;

  const primaryColor: [number, number, number] = [13, 92, 83]; // #0D5C53
  const darkColor: [number, number, number] = [43, 35, 33]; // #2B2321

  // Header
  doc.setFontSize(20);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.text(settings?.hotelName || 'Résidence HQ', margin, 20);

  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.setFont('helvetica', 'normal');
  doc.text('Module Technique, Maintenance & Génie Industriel', margin, 26);

  // Title
  doc.setFontSize(15);
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.setFont('helvetica', 'bold');
  const periodLabel = periodType === 'day' ? `Journée du ${periodValue}` : periodType === 'week' ? `Semaine du ${periodValue}` : `Mois de ${periodValue}`;
  doc.text(`RAPPORT DE MAINTENANCE — ${periodLabel.toUpperCase()}`, pageWidth / 2, 40, { align: 'center' });

  // Confidential Banner
  doc.setFillColor(239, 68, 68);
  doc.rect(margin, 46, pageWidth - 2 * margin, 7, 'F');
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text("DOCUMENT TECHNIQUE INTERNE — SÉCURITÉ & MAINTENANCE", pageWidth / 2, 50.5, { align: 'center' });

  // Generation Date
  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.setFont('helvetica', 'italic');
  doc.text(`Généré le : ${format(new Date(), 'dd MMMM yyyy à HH:mm', { locale: fr })}`, pageWidth - margin, 20, { align: 'right' });

  let y = 60;

  // Statistics Summary Box
  const totalTasks = tasks.length;
  const resolvedTasks = tasks.filter((t: any) => t.status === 'Validated').length;
  const pendingTasks = tasks.filter((t: any) => t.status !== 'Validated' && t.status !== 'Rejected').length;
  const totalCost = tasks.reduce((sum: number, t: any) => sum + (t.cost || 0), 0);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.text("1. SYNTHÈSE DES INTERVENTIONS & INCIDENTS", margin, y);
  y += 6;

  const summaryRows = [
    ['Total Interventions Signalées', totalTasks.toString()],
    ['Interventions Validées / Résolues', resolvedTasks.toString()],
    ['Interventions en Attente / En Cours', pendingTasks.toString()],
    ['Coût Total Interventions', `${totalCost.toLocaleString()} FCFA`],
    ['Checklists Quotidiennes Enregistrées', dailyChecklists.length.toString()],
    ['Tâches de Planning Mensuel Suivies', monthlyTasks.length.toString()]
  ];

  autoTable(doc, {
    startY: y,
    head: [['Indicateur Clé', 'Valeur / Volume']],
    body: summaryRows,
    theme: 'grid',
    headStyles: { fillColor: primaryColor, textColor: [255, 255, 255], fontSize: 8.5, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8.5, textColor: darkColor },
    columnStyles: { 0: { cellWidth: 100 }, 1: { cellWidth: 80, fontStyle: 'bold' } },
    margin: { left: margin, right: margin }
  });

  y = (doc as any).lastAutoTable.finalY + 10;

  // Tickets Table
  if (y > pageHeight - 50) { doc.addPage(); y = 20; }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.text("2. DÉTAIL DES TICKETS & INTERVENTIONS", margin, y);
  y += 6;

  const taskRows = tasks.map((t: any, idx: number) => [
    (idx + 1).toString(),
    t.location || 'N/A',
    t.note || 'N/A',
    t.status === 'Validated' ? 'Résolu' : t.status === 'Pending' ? 'En attente' : t.status === 'Accepted' ? 'En cours' : t.status,
    t.reporterName || 'N/A',
    t.cost ? `${t.cost.toLocaleString()} FCFA` : '0 FCFA'
  ]);

  if (taskRows.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [['#', 'Lieu / Équipement', 'Description / Panne', 'Statut', 'Demandeur', 'Coût']],
      body: taskRows,
      theme: 'grid',
      headStyles: { fillColor: [71, 85, 105], textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fontSize: 7.5, textColor: darkColor },
      margin: { left: margin, right: margin }
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  } else {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(120);
    doc.text("Aucun ticket d'intervention enregistré pour cette période.", margin, y);
    y += 10;
  }

  // Monthly Planning Section
  if (monthlyTasks.length > 0) {
    if (y > pageHeight - 50) { doc.addPage(); y = 20; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.text("3. SUIVI DU PLANNING MENSUEL (CLIMATISEURS, GROUPES, BÂCHES)", margin, y);
    y += 6;

    const monthlyRows = monthlyTasks.map((mt: any, idx: number) => [
      (idx + 1).toString(),
      mt.equipmentType || 'N/A',
      mt.title || 'N/A',
      mt.location || 'N/A',
      mt.scheduledDate || 'N/A',
      mt.status === 'Completed' ? 'Réalisé' : mt.status === 'In_Progress' ? 'En cours' : 'Programmé'
    ]);

    autoTable(doc, {
      startY: y,
      head: [['#', 'Équipement', 'Titre / Intervention', 'Emplacement', 'Date Prévue', 'Statut']],
      body: monthlyRows,
      theme: 'grid',
      headStyles: { fillColor: [71, 85, 105], textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fontSize: 7.5, textColor: darkColor },
      margin: { left: margin, right: margin }
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // Daily Checklists Section
  if (dailyChecklists.length > 0) {
    if (y > pageHeight - 50) { doc.addPage(); y = 20; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.text("4. SYNTHÈSE DES CHECKLISTS JOURNALIÈRES (GROUPES, BÂCHE)", margin, y);
    y += 6;

    const checklistRows = dailyChecklists.map((dc: any, idx: number) => [
      (idx + 1).toString(),
      dc.date || 'N/A',
      dc.technicianName || 'N/A',
      dc.geDataList && dc.geDataList.length > 0
        ? dc.geDataList.map((g: any) => `${g.name || 'GE'}: ${g.fuelLevelPercent}% (${g.engineHours}h)`).join(' | ')
        : (dc.geData ? `Carb: ${dc.geData.fuelLevelPercent}% | Heures: ${dc.geData.engineHours}h` : 'N/A'),
      dc.bacheData ? `Niv: ${dc.bacheData.waterLevelPercent}% | Pres: ${dc.bacheData.pressureBar}b` : 'N/A'
    ]);

    autoTable(doc, {
      startY: y,
      head: [['#', 'Date', 'Technicien', 'Groupe Électrogène', 'Bâche à Eau']],
      body: checklistRows,
      theme: 'grid',
      headStyles: { fillColor: [71, 85, 105], textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fontSize: 7, textColor: darkColor },
      margin: { left: margin, right: margin }
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // Footer Page numbers
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text(`Rapport Technique & Maintenance - ${periodLabel}`, margin, pageHeight - 8);
    doc.text(`Page ${i} sur ${totalPages}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
  }

  const cleanPeriod = periodValue.replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`Rapport_Maintenance_${periodType}_${cleanPeriod}.pdf`);
};

export const generateQuoteInvoicePDF = (docData: any, settings?: AppSettings | null) => {
  const doc = new jsPDF({
    orientation: 'p',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const blueColor: [number, number, number] = [29, 78, 216]; // Blue 700
  const darkColor: [number, number, number] = [30, 41, 59]; // Slate 800
  const grayColor: [number, number, number] = [100, 116, 139]; // Slate 500

  const isQuote = docData.type === 'Quote';
  const docTitle = isQuote ? 'DEVIS PROFORMA' : 'FACTURE DE PRESTATION';

  // Header Background Bar (Top Blue Line)
  doc.setFillColor(blueColor[0], blueColor[1], blueColor[2]);
  doc.rect(0, 0, pageWidth, 6, 'F');

  let y = 18;

  // Hotel Name & Info (Left)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(blueColor[0], blueColor[1], blueColor[2]);
  const hotelName = docData.hotelName || settings?.hotelName || 'Résidence HQ Hôtel';
  doc.text(hotelName, margin, y);
  
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
  
  const hotelAddr = docData.hotelAddress || settings?.address || 'Hôtel - Restaurant - Séjour & Événementiel';
  const hotelPhone = docData.hotelPhone || settings?.phone || 'Tél: +221 33 000 00 00 / +221 77 000 00 00';
  const hotelEmail = docData.hotelEmail || settings?.email || 'Email: contact@hotel-residence.com';
  const hotelNif = docData.hotelNifRccm || settings?.nifRccm || 'NIF / RCCM : SN-DKR-2026-B-12345';

  doc.text(hotelAddr, margin, y);
  y += 4;
  doc.text(`${hotelPhone} | ${hotelEmail}`, margin, y);
  y += 4;
  doc.text(hotelNif, margin, y);

  // Document Badge / Number & Dates (Right)
  const rightX = pageWidth - margin;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(blueColor[0], blueColor[1], blueColor[2]);
  doc.text(docTitle, rightX, 18, { align: 'right' });

  doc.setFontSize(10);
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.text(`N°: ${docData.number}`, rightX, 24, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
  doc.text(`Date d'émission : ${docData.date || format(new Date(), 'dd/MM/yyyy')}`, rightX, 29, { align: 'right' });
  
  if (isQuote && docData.validUntilDate) {
    doc.text(`Valable jusqu'au : ${docData.validUntilDate}`, rightX, 33, { align: 'right' });
  } else if (!isQuote && docData.dueDate) {
    doc.text(`Échéance : ${docData.dueDate}`, rightX, 33, { align: 'right' });
  }

  y += 10;

  // Divider Line
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);

  y += 7;

  // Client Box
  doc.setFillColor(241, 245, 249); // Light slate
  doc.roundedRect(margin, y, pageWidth - (margin * 2), 26, 2, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(blueColor[0], blueColor[1], blueColor[2]);
  doc.text("CLIENT / DESTINATAIRE :", margin + 4, y + 6);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  const clientTitle = docData.clientCompany ? `${docData.clientName} (${docData.clientCompany})` : docData.clientName;
  doc.text(clientTitle || 'Client Général', margin + 4, y + 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
  const clientInfo = [
    docData.clientPhone ? `Tél: ${docData.clientPhone}` : null,
    docData.clientEmail ? `Email: ${docData.clientEmail}` : null,
    docData.clientAddress ? `Adresse: ${docData.clientAddress}` : null,
    docData.clientNifRccm ? `NIF/IFU: ${docData.clientNifRccm}` : null
  ].filter(Boolean).join(' | ');

  doc.text(clientInfo || 'Information client sur fichier', margin + 4, y + 18);

  y += 32;

  // Items Table
  const tableRows = (docData.items || []).map((item: any, idx: number) => [
    (idx + 1).toString(),
    item.description || 'Prestation',
    item.category || 'Général',
    item.quantity.toString(),
    `${(item.unitPrice || 0).toLocaleString()} F`,
    `${(item.total || 0).toLocaleString()} F`
  ]);

  autoTable(doc, {
    startY: y,
    head: [['#', 'Désignation / Description', 'Catégorie', 'Qté', 'Prix Unitaire', 'Montant HT']],
    body: tableRows,
    margin: { left: margin, right: margin },
    theme: 'striped',
    headStyles: { fillColor: blueColor, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
    bodyStyles: { fontSize: 8, textColor: darkColor },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 80 },
      2: { cellWidth: 30 },
      3: { cellWidth: 15, halign: 'center' },
      4: { cellWidth: 22, halign: 'right' },
      5: { cellWidth: 23, halign: 'right', fontStyle: 'bold' }
    }
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  // Financial Summary Box (Right aligned)
  if (y > pageHeight - 65) {
    doc.addPage();
    y = 20;
  }

  const sumBoxWidth = 80;
  const sumBoxX = pageWidth - margin - sumBoxWidth;

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);

  doc.text("Sous-total :", sumBoxX, y);
  doc.text(`${(docData.subtotal || 0).toLocaleString()} FCFA`, rightX, y, { align: 'right' });
  y += 5;

  if (docData.discountAmount > 0) {
    doc.text("Remise :", sumBoxX, y);
    doc.text(`-${(docData.discountAmount || 0).toLocaleString()} FCFA`, rightX, y, { align: 'right' });
    y += 5;
  }

  if (docData.taxRate > 0) {
    doc.text(`TVA (${docData.taxRate}%) :`, sumBoxX, y);
    doc.text(`${(docData.taxAmount || 0).toLocaleString()} FCFA`, rightX, y, { align: 'right' });
    y += 5;
  }

  doc.setDrawColor(226, 232, 240);
  doc.line(sumBoxX, y, rightX, y);
  y += 4;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(blueColor[0], blueColor[1], blueColor[2]);
  doc.text("TOTAL TTC :", sumBoxX, y);
  doc.text(`${(docData.totalAmount || 0).toLocaleString()} FCFA`, rightX, y, { align: 'right' });
  y += 6;

  if (docData.advancePaid > 0) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.text("Acompte versé :", sumBoxX, y);
    doc.text(`${(docData.advancePaid || 0).toLocaleString()} FCFA`, rightX, y, { align: 'right' });
    y += 5;

    const netPayable = Math.max(0, (docData.totalAmount || 0) - (docData.advancePaid || 0));
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(220, 38, 38); // Red
    doc.text("NET À PAYER :", sumBoxX, y);
    doc.text(`${netPayable.toLocaleString()} FCFA`, rightX, y, { align: 'right' });
    y += 6;
  }

  y += 5;

  // Terms and Bank Details Left Block
  if (y > pageHeight - 50) {
    doc.addPage();
    y = 20;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(blueColor[0], blueColor[1], blueColor[2]);
  doc.text("MODALITÉS DE RÈGLEMENT & COORDONNÉES BANCAIRES :", margin, y);
  
  y += 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);

  const bankText = docData.bankDetails || settings?.bankDetails || 'Paiement par Espèces, Chèque, Mobile Money (Orange Money/Wave) ou Virement bancaire.';
  doc.text(bankText, margin, y, { maxWidth: 100 });

  const termsText = docData.paymentTerms || 'Règlement à réception de facture ou selon accord contractuel.';
  doc.text(`Conditions : ${termsText}`, margin, y + 8, { maxWidth: 100 });

  // Stamp and Signature Right Box
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.text("Cachet & Signature de la Direction", pageWidth - margin - 55, y);

  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(pageWidth - margin - 60, y + 3, 60, 20, 2, 2, 'S');

  // Footer
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text(`${docData.hotelName || 'Hôtel'} - ${docTitle} ${docData.number} - Document généré le ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, margin, pageHeight - 8);
    doc.text(`Page ${i} sur ${totalPages}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
  }

  doc.save(`${isQuote ? 'Devis' : 'Facture'}_${docData.number}.pdf`);
};


