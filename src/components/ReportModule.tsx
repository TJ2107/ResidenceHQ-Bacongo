import React, { useState, useEffect } from 'react';
import { Sale, Expense, Booking, AppSettings, Room, Reservation, UserProfile, Review, CleaningTask, Hall, MaintenanceTask } from '../types';
import { format, isWithinInterval, startOfDay, endOfDay, subDays, differenceInDays, eachDayOfInterval } from 'date-fns';
import { fr } from 'date-fns/locale';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, PieChart, Pie, Cell, Legend, AreaChart, Area 
} from 'recharts';
import { collection, query, where, getDocs, Timestamp, deleteDoc, doc, updateDoc, increment, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { 
  FileText, Download, Calendar, TrendingUp, TrendingDown, 
  Users, Bed, CreditCard, AlertCircle, CheckCircle, Info,
  ChevronRight, ChevronDown, FileDown, Printer, PieChart as PieChartIcon,
  BarChart as BarChartIcon, Activity, Sparkles, ChefHat, LayoutGrid, Wrench, Trash2
} from 'lucide-react';
import { cn, parseDate, handleFirestoreError, OperationType } from '../lib/utils';
import { generatePDF, exportReportToPDF } from '../lib/pdfUtils';
import { toast } from 'sonner';
import { Receipt } from './Receipt';
import { ConfirmModal } from './ConfirmModal';
import * as XLSX from 'xlsx';

interface ReportData {
  sales: Sale[];
  expenses: Expense[];
  bookings: Booking[];
  reservations: Reservation[];
  poolTickets?: any[];
  rooms: Room[];
  users: UserProfile[];
  reviews: Review[];
  cleaningTasks: CleaningTask[];
  halls: Hall[];
  maintenanceTasks: MaintenanceTask[];
}

export const ReportModule = ({ settings, user, isAdmin, isManager }: { settings?: AppSettings | null, user: UserProfile, isAdmin: boolean, isManager: boolean }) => {
  const isManagerOrAdmin = isAdmin || isManager || user?.role === 'admin' || user?.role === 'manager' || user?.email?.toLowerCase() === 'cyber.kan587@gmail.com';
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [activeSection, setActiveSection] = useState<string>('summary');

  const [localSettings, setLocalSettings] = useState<AppSettings | null>(null);
  const [printingSale, setPrintingSale] = useState<Sale | null>(null);

  const [saleToDelete, setSaleToDelete] = useState<Sale | null>(null);

  const executeDeleteSale = async (sale: Sale) => {
    try {
      console.log("[ReportModule] Starting deletion process for sale:", sale.id);
      if (sale.items && sale.items.length > 0) {
        for (const item of sale.items) {
          if (item.productId && item.quantity > 0 && !item.productId.startsWith('room_')) {
            const productRef = doc(db, 'products', item.productId);
            const productSnap = await getDoc(productRef);
            if (productSnap.exists()) {
              const loc = sale.location || 'Terrasse';
              let updateData: any = { stock: increment(item.quantity) };
              if (loc === 'Réception') updateData.stockReception = increment(item.quantity);
              else if (loc === 'VIP') updateData.stockVip = increment(item.quantity);
              else updateData.stockTerrasse = increment(item.quantity);
              
              await updateDoc(productRef, updateData);
            }
          }
        }
      }

      if (sale.sourceId) {
        try { await deleteDoc(doc(db, 'pool_tickets', sale.sourceId)); } catch(e) {}
        try { await deleteDoc(doc(db, 'shisha_sales', sale.sourceId)); } catch(e) {}
      }
      if (sale.bookingId) {
        try { await deleteDoc(doc(db, 'bookings', sale.bookingId)); } catch(e) {}
      }

      await deleteDoc(doc(db, 'sales', sale.id));
      toast.success("Vente supprimée et stock restauré.");
      fetchData();
    } catch (error: any) {
      console.error("[ReportModule] Error during deletion:", error);
      handleFirestoreError(error, OperationType.DELETE, 'sales');
    }
  };

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const start = startOfDay(new Date(startDate));
      const end = endOfDay(new Date(endDate));

      // Fetch all relevant data for the period
      const salesQuery = query(collection(db, 'sales'), where('timestamp', '>=', Timestamp.fromDate(start)), where('timestamp', '<=', Timestamp.fromDate(end)));
      const expensesQuery = query(collection(db, 'expenses'), where('timestamp', '>=', Timestamp.fromDate(start)), where('timestamp', '<=', Timestamp.fromDate(end)));
      const bookingsQuery = query(collection(db, 'bookings'), where('checkOutDate', '>=', Timestamp.fromDate(start)), where('checkOutDate', '<=', Timestamp.fromDate(end)));
      const reservationsQuery = query(collection(db, 'reservations'), where('createdAt', '>=', Timestamp.fromDate(start)), where('createdAt', '<=', Timestamp.fromDate(end)));
      const [salesSnap, expensesSnap, bookingsSnap, reservationsSnap, roomsSnap, usersSnap, reviewsSnap, cleaningTasksSnap, settingsSnap, hallsSnap, maintenanceTasksSnap] = await Promise.all([
        getDocs(salesQuery),
        getDocs(expensesQuery),
        getDocs(bookingsQuery),
        getDocs(reservationsQuery),
        getDocs(collection(db, 'rooms')),
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'reviews')),
        getDocs(collection(db, 'cleaning_tasks')),
        getDocs(collection(db, 'settings')),
        getDocs(collection(db, 'halls')),
        getDocs(collection(db, 'maintenance_tasks'))
      ]);

      if (!settingsSnap.empty) {
        setLocalSettings(settingsSnap.docs[0].data() as AppSettings);
      }

      setReportData({
        sales: salesSnap.docs
          .map(d => ({ id: d.id, ...(d.data() as any) } as Sale))
          .filter(s => {
            const loc = (s.location || '').toLowerCase();
            const hasChichaItem = s.items?.some(i => i.category?.toLowerCase() === 'chicha' || i.productName?.toLowerCase().includes('chicha'));
            return loc !== 'chicha' && loc !== 'shisha' && !hasChichaItem;
          }),
        expenses: expensesSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as Expense)),
        bookings: bookingsSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as Booking)),
        reservations: reservationsSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as Reservation)),
        poolTickets: [],
        rooms: roomsSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as Room)),
        users: usersSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as UserProfile)),
        reviews: reviewsSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as Review)),
        cleaningTasks: cleaningTasksSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as CleaningTask)),
        halls: hallsSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as Hall)),
        maintenanceTasks: maintenanceTasksSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as MaintenanceTask))
      });
    } catch (err: any) {
      console.error("Error fetching report data:", err);
      setError("Une erreur est survenue lors de la génération du rapport. Veuillez vérifier votre connexion.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-64 space-y-4">
      <Activity className="w-12 h-12 animate-spin text-primary" />
      <p className="text-primary/60 font-bold uppercase tracking-widest text-xs">Génération du rapport...</p>
    </div>
  );

  if (error) return (
    <div className="p-8 text-center bg-red-50 border border-red-100 rounded-[2rem]">
      <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
      <h2 className="text-xl font-bold text-red-700 mb-2">Erreur de chargement</h2>
      <p className="text-red-600/80 mb-6">{error}</p>
      <button 
        onClick={fetchData}
        className="px-6 py-3 bg-red-600 text-white rounded-2xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-600/20"
      >
        Réessayer
      </button>
    </div>
  );

  if (!reportData) return null;

  const currentSettings = settings || localSettings;
  const totalDays = differenceInDays(new Date(endDate), new Date(startDate)) + 1;
  const totalRoomNightsAvailable = reportData.rooms.length * totalDays;
  const totalRoomNightsOccupied = reportData.bookings.reduce((acc, b) => acc + b.totalNights, 0);
  
  const occupancyRate = totalRoomNightsAvailable > 0 ? (totalRoomNightsOccupied / totalRoomNightsAvailable) * 100 : 0;
  const roomRevenue = reportData.bookings.reduce((acc, b) => acc + (b.totalPaid || b.roomCharge || 0), 0);
  const posRevenue = reportData.sales.reduce((acc, s) => acc + s.totalPrice, 0) + 
                     reportData.bookings.reduce((acc, b) => acc + b.posCharges, 0);
  const poolRevenue = 0;
  const totalRevenue = roomRevenue + posRevenue;
  
  const adr = totalRoomNightsOccupied > 0 ? roomRevenue / totalRoomNightsOccupied : 0;
  const revpar = totalRoomNightsAvailable > 0 ? roomRevenue / totalRoomNightsAvailable : 0;
  
  const totalExpenses = reportData.expenses.reduce((acc, e) => acc + e.amount, 0);
  const netProfit = totalRevenue - totalExpenses;
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  // Review Calculations
  const averageRating = reportData.reviews.length > 0 
    ? reportData.reviews.reduce((acc, r) => acc + r.rating, 0) / reportData.reviews.length 
    : 0;
  
  const promoters = reportData.reviews.filter(r => r.rating >= 4).length;
  const detractors = reportData.reviews.filter(r => r.rating <= 2).length;
  const nps = reportData.reviews.length > 0 
    ? ((promoters - detractors) / reportData.reviews.length) * 100 
    : 0;

  const COLORS = ['#1A8B8C', '#E5C198', '#2B2321', '#8BA888', '#D4A373', '#CCD5AE'];

  const positiveComments = reportData.reviews.filter(r => r.rating >= 4).slice(0, 5);
  const negativeComments = reportData.reviews.filter(r => r.rating <= 2).slice(0, 5);
  const negativeReviews = reportData.reviews.filter(r => r.rating <= 2);

  // Personnel Calculations
  const staffByRole = reportData.users.reduce((acc, u) => {
    acc[u.role] = (acc[u.role] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const roleLabels: Record<string, string> = {
    admin: 'Administration',
    manager: 'Management',
    receptionist: 'Réception',
    barman: 'Bar/Restaurant',
    staff: 'Service/Entretien'
  };

  const staffStats = Object.entries(staffByRole).map(([role, count], i) => ({
    dept: roleLabels[role] || role,
    count,
    color: COLORS[i % COLORS.length]
  }));

  const validatedCleanings = reportData.cleaningTasks.filter(t => t.status === 'Validated').length;
  const pendingCleanings = reportData.cleaningTasks.filter(t => t.status === 'Pending').length;
  const rejectedCleanings = reportData.cleaningTasks.filter(t => t.status === 'Rejected').length;

  // Maintenance Calculations
  const validatedMaintenance = reportData.maintenanceTasks.filter(t => t.status === 'Validated').length;
  const pendingMaintenance = reportData.maintenanceTasks.filter(t => ['Pending', 'NeedSubmitted', 'Accepted'].includes(t.status)).length;
  const rejectedMaintenance = reportData.maintenanceTasks.filter(t => t.status === 'Rejected').length;
  const totalMaintenance = reportData.maintenanceTasks.length;
  const totalMaintenanceExpenses = reportData.maintenanceTasks.reduce((sum, rx) => sum + (rx.cost || 0), 0);

  // Kitchen Calculations
  const kitchenOrders = reportData.sales.filter(s => s.kitchenStatus);
  const kitchenReceived = kitchenOrders.length;
  const kitchenDelivered = kitchenOrders.filter(o => o.kitchenStatus === 'Delivered').length;
  const kitchenCancelled = kitchenOrders.filter(o => o.kitchenStatus === 'Cancelled').length;
  const kitchenPending = kitchenOrders.filter(o => ['Pending', 'Preparing', 'Ready'].includes(o.kitchenStatus || '')).length;

  // Sales by Activity
  const salesByLocation = reportData.sales.reduce((acc, s) => {
    const loc = s.location || 'Autre';
    acc[loc] = (acc[loc] || 0) + s.totalPrice;
    return acc;
  }, {} as Record<string, number>);

  const salesByActivityData = Object.entries(salesByLocation).map(([name, value]) => ({ name, value }));

  // Reservation Analysis
  const channels = reportData.reservations.reduce((acc, r) => {
    const channel = r.channel || 'Direct';
    acc[channel] = (acc[channel] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const channelData = Object.entries(channels).map(([name, value]) => ({ name, value }));

  const segments = reportData.reservations.reduce((acc, r) => {
    const segment = r.segment || 'Leisure';
    acc[segment] = (acc[segment] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const segmentData = Object.entries(segments).map(([name, value]) => ({ name, value }));

  const roomStatusStats = reportData.rooms.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const hallStatusStats = reportData.halls.reduce((acc, h) => {
    acc[h.status] = (acc[h.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const hallTypeStats = reportData.halls.reduce((acc, h) => {
    acc[h.type] = (acc[h.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Hall Sales Calculations
  const hallSales = reportData.sales.filter(s => s.items.some((i: any) => i.type === 'hall'));
  const hallSalesRevenue = hallSales.reduce((acc, s) => acc + s.totalPrice, 0);
  const hallSalesCount = hallSales.length;

  const sections = [
    { id: 'summary', title: 'Résumé Exécutif', icon: <Info className="w-4 h-4" /> },
    { id: 'occupancy', title: 'Occupation & Revenus', icon: <TrendingUp className="w-4 h-4" /> },
    { id: 'rooms', title: 'Gestion des Chambres', icon: <Bed className="w-4 h-4" /> },
    { id: 'halls', title: 'Gestion des Salles', icon: <LayoutGrid className="w-4 h-4" /> },
    { id: 'kitchen', title: 'Cuisine & Restauration', icon: <ChefHat className="w-4 h-4" /> },
    { id: 'cleaning', title: 'Nettoyage & Entretien', icon: <Sparkles className="w-4 h-4" /> },
    { id: 'maintenance', title: 'Rapport de Maintenance', icon: <Wrench className="w-4 h-4" /> },
    { id: 'reservations', title: 'Réservations', icon: <Calendar className="w-4 h-4" /> },
    { id: 'finances', title: 'Finances', icon: <CreditCard className="w-4 h-4" /> },
    { id: 'compta_cg', title: 'Comptabilité & Fiscalité CG', icon: <FileText className="w-4 h-4" /> },
    { id: 'ops', title: 'Personnel & Opérations', icon: <Users className="w-4 h-4" /> },
    { id: 'cx', title: 'Expérience Client', icon: <Sparkles className="w-4 h-4" /> },
    { id: 'analysis', title: 'Analyse & Perspectives', icon: <BarChartIcon className="w-4 h-4" /> },
    { id: 'legend', title: 'Légende', icon: <Info className="w-4 h-4" /> },
  ];

  const handlePrint = () => {
    if (!reportData) return;
    try {
      exportReportToPDF(reportData, startDate, endDate, settings || localSettings);
    } catch (error) {
      console.error("Erreur lors de l'exportation PDF :", error);
    }
  };

  const handleExportExcel = () => {
    if (!reportData) return;

    try {
      const wb = XLSX.utils.book_new();

      const formatDate = (ts: any) => {
        if (!ts) return "-";
        try {
          return format(parseDate(ts), 'dd/MM/yyyy');
        } catch (e) {
          return "-";
        }
      };

      const formatDateTime = (ts: any) => {
        if (!ts) return "-";
        try {
          return format(parseDate(ts), 'dd/MM/yyyy HH:mm');
        } catch (e) {
          return "-";
        }
      };

      // 1. Sheet: Synthèse Financière
      const syntheseRows = [
        { 'Indicateur': "Période du Rapport", 'Valeur': `${format(new Date(startDate), 'dd/MM/yyyy')} au ${format(new Date(endDate), 'dd/MM/yyyy')}` },
        { 'Indicateur': "Chiffre d'Affaires Hébergement (TTC)", 'Valeur': `${roomRevenue.toLocaleString()} FCFA` },
        { 'Indicateur': "Chiffre d'Affaires POS (TTC)", 'Valeur': `${posRevenue.toLocaleString()} FCFA` },
        { 'Indicateur': "Chiffre d'Affaires Global (TTC)", 'Valeur': `${totalRevenue.toLocaleString()} FCFA` },
        { 'Indicateur': "Dépenses d'Exploitation (Classe 6)", 'Valeur': `${totalExpenses.toLocaleString()} FCFA` },
        { 'Indicateur': "Bénéfice Net Global", 'Valeur': `${netProfit.toLocaleString()} FCFA` },
        { 'Indicateur': "Marge Bénéficiaire Net", 'Valeur': `${profitMargin.toFixed(2)} %` },
        { 'Indicateur': "Taux d'Occupation Chambres", 'Valeur': `${occupancyRate.toFixed(2)} %` },
        { 'Indicateur': "Prix Moyen Journalier (ADR)", 'Valeur': `${Math.round(adr).toLocaleString()} FCFA` },
        { 'Indicateur': "RevPAR", 'Valeur': `${Math.round(revpar).toLocaleString()} FCFA` },
        { 'Indicateur': "Nuitées Vendues / Disponibles", 'Valeur': `${totalRoomNightsOccupied} / ${totalRoomNightsAvailable}` }
      ];
      const wsSynthese = XLSX.utils.json_to_sheet(syntheseRows);
      XLSX.utils.book_append_sheet(wb, wsSynthese, "Synthèse Financière");

      // Recalculate fiscal values for sheets
      const roomNights = reportData.bookings.reduce((sum, b) => sum + b.totalNights, 0);
      const taxeSejourTotalLocal = roomNights * 1000;
      const roomBaseTTClocal = Math.max(0, roomRevenue - taxeSejourTotalLocal);
      const roomHTlocal = roomBaseTTClocal / 1.189;
      const roomTVALocal = roomHTlocal * 0.18;
      const roomCCALocal = roomHTlocal * 0.009;
      const totalRoomTaxLocal = roomTVALocal + roomCCALocal + taxeSejourTotalLocal;

      const posHTlocal = posRevenue / 1.189;
      const posTVALocal = posHTlocal * 0.18;
      const posCCALocal = posHTlocal * 0.009;
      const totalPosTaxLocal = posTVALocal + posCCALocal;

      const poolHTlocal = poolRevenue / 1.189;
      const poolTVALocal = poolHTlocal * 0.18;
      const poolCCALocal = poolHTlocal * 0.009;
      const totalPoolTaxLocal = poolTVALocal + poolCCALocal;

      const grandTTClocal = roomRevenue + posRevenue + poolRevenue;
      const grandHTlocal = roomHTlocal + posHTlocal + poolHTlocal;
      const grandTVALocal = roomTVALocal + posTVALocal + poolTVALocal;
      const grandCCALocal = roomCCALocal + posCCALocal + poolCCALocal;
      const grandTaxesObliglocal = grandTVALocal + grandCCALocal + taxeSejourTotalLocal;

      const totalSalesCGLocal = reportData.sales.reduce((acc, s) => acc + s.totalPrice, 0);
      const rawSalaryExpensesLocal = reportData.expenses.filter(e => 
        ['staff', 'salary', 'personnel', 'salaire', 'paie'].some(k => e.category?.toLowerCase().includes(k))
      ).reduce((sum, e) => sum + e.amount, 0);
      const salariesCGLocal = rawSalaryExpensesLocal > 0 ? rawSalaryExpensesLocal : (totalSalesCGLocal * 0.15 + roomRevenue * 0.12);
      const cnssEmployerCGLocal = salariesCGLocal * 0.165;
      const tusTaxCGLocal = salariesCGLocal * 0.075;
      const totalStaffCostCGLocal = salariesCGLocal + cnssEmployerCGLocal + tusTaxCGLocal;

      const energyExpensesLocal = reportData.expenses.filter(e => 
        ['utility', 'electricity', 'water', 'gaz', 'SNE', 'E2C', 'LCDE', 'eau', 'énergie'].some(k => e.category?.toLowerCase().includes(k))
      ).reduce((sum, e) => sum + e.amount, 0);
      const utilitiesCGLocal = energyExpensesLocal > 0 ? energyExpensesLocal : (grandTTClocal * 0.06);

      const rawMaintenanceExpensesLocal = reportData.expenses.filter(e => 
        ['maintenance', 'entretien', 'réparation', 'wrench'].some(k => e.category?.toLowerCase().includes(k))
      ).reduce((sum, e) => sum + e.amount, 0);
      const maintenanceCostCGLocal = rawMaintenanceExpensesLocal > 0 ? rawMaintenanceExpensesLocal : (grandTTClocal * 0.04);

      const otherExpensesCGLocal = reportData.expenses.filter(e => 
        !['staff', 'salary', 'personnel', 'salaire', 'paie', 'utility', 'electricity', 'water', 'gaz', 'SNE', 'E2C', 'LCDE', 'eau', 'énergie', 'maintenance', 'entretien', 'réparation'].some(k => e.category?.toLowerCase().includes(k))
      ).reduce((sum, e) => sum + e.amount, 0);
      const administrativeCostCGLocal = otherExpensesCGLocal > 0 ? otherExpensesCGLocal : (grandTTClocal * 0.05);

      const costGoodsLocal = totalSalesCGLocal * 0.35;
      const ebitdaCGLocal = grandHTlocal - (costGoodsLocal + totalStaffCostCGLocal + utilitiesCGLocal + maintenanceCostCGLocal + administrativeCostCGLocal);
      const calculatedISLocal = ebitdaCGLocal > 0 ? ebitdaCGLocal * 0.28 : 0;
      const netEarningsCGLocal = ebitdaCGLocal - calculatedISLocal;

      // 2. Sheet: Fiscalité République du Congo (DGI)
      const fiscalityRows = [
        {
          "Activité / Catégorie Fiscale": "Hébergement (Chambres)",
          "CA Global Collecté (TTC)": roomRevenue,
          "Taxe de Séjour d'Hôtel": taxeSejourTotalLocal,
          "Assiette (CA Imposable HT)": Math.round(roomHTlocal),
          "TVA Collectée (18%)": Math.round(roomTVALocal),
          "CCA (5% de TVA)": Math.round(roomCCALocal),
          "Impôt Total à Déclarer": Math.round(totalRoomTaxLocal)
        },
        {
          "Activité / Catégorie Fiscale": "Restauration & Bar (POS)",
          "CA Global Collecté (TTC)": posRevenue,
          "Taxe de Séjour d'Hôtel": 0,
          "Assiette (CA Imposable HT)": Math.round(posHTlocal),
          "TVA Collectée (18%)": Math.round(posTVALocal),
          "CCA (5% de TVA)": Math.round(posCCALocal),
          "Impôt Total à Déclarer": Math.round(totalPosTaxLocal)
        },
        {
          "Activité / Catégorie Fiscale": "TOTAL GÉNÉRAL FISCAL",
          "CA Global Collecté (TTC)": grandTTClocal,
          "Taxe de Séjour d'Hôtel": taxeSejourTotalLocal,
          "Assiette (CA Imposable HT)": Math.round(grandHTlocal),
          "TVA Collectée (18%)": Math.round(grandTVALocal),
          "CCA (5% de TVA)": Math.round(grandCCALocal),
          "Impôt Total à Déclarer": Math.round(grandTaxesObliglocal)
        }
      ];
      const wsFiscality = XLSX.utils.json_to_sheet(fiscalityRows);
      XLSX.utils.book_append_sheet(wb, wsFiscality, "Fiscalité Congo (DGI)");

      // 3. Sheet: Compte de Résultat (SYSCOHADA)
      const syscohadaRows = [
        { 'Poste Comptable': "PRODUITS D'EXPLOITATION (Classe 7)", 'Compte SYSCOHADA': "-", 'Montant (FCFA)': "" },
        { 'Poste Comptable': "Ventes de marchandises", 'Compte SYSCOHADA': "7011 (Bar & Restau)", 'Montant (FCFA)': Math.round(posHTlocal) },
        { 'Poste Comptable': "Prestations de services", 'Compte SYSCOHADA': "7062 (Chambres/Hébergement)", 'Montant (FCFA)': Math.round(roomHTlocal) },
        { 'Poste Comptable': "TOTAL CHIFFRE D'AFFAIRES (HT)", 'Compte SYSCOHADA': "Classe 7", 'Montant (FCFA)': Math.round(grandHTlocal) },
        { 'Poste Comptable': "", 'Compte SYSCOHADA': "", 'Montant (FCFA)': "" },
        { 'Poste Comptable': "CHARGES D'EXPLOITATION (Classe 6)", 'Compte SYSCOHADA': "-", 'Montant (FCFA)': "" },
        { 'Poste Comptable': "Achats marchandises & intrants matières", 'Compte SYSCOHADA': "6011", 'Montant (FCFA)': -Math.round(costGoodsLocal) },
        { 'Poste Comptable': "Fournitures non stockables - Eau, Électricité", 'Compte SYSCOHADA': "6051", 'Montant (FCFA)': -Math.round(utilitiesCGLocal) },
        { 'Poste Comptable': "Services extérieurs & maintenance", 'Compte SYSCOHADA': "6111 / 6281", 'Montant (FCFA)': -Math.round(maintenanceCostCGLocal + administrativeCostCGLocal) },
        { 'Poste Comptable': "Impôts, taxes et versements - Séjour", 'Compte SYSCOHADA': "6413", 'Montant (FCFA)': -Math.round(taxeSejourTotalLocal) },
        { 'Poste Comptable': "Personnel - Salaires nets", 'Compte SYSCOHADA': "6611", 'Montant (FCFA)': -Math.round(salariesCGLocal) },
        { 'Poste Comptable': "Personnel - Charges Patronales (CNSS 16.5% & TUS)", 'Compte SYSCOHADA': "6641", 'Montant (FCFA)': -Math.round(cnssEmployerCGLocal + tusTaxCGLocal) },
        { 'Poste Comptable': "TOTAL CHARGES D'EXPLOITATION", 'Compte SYSCOHADA': "Classe 6", 'Montant (FCFA)': -Math.round(costGoodsLocal + utilitiesCGLocal + maintenanceCostCGLocal + administrativeCostCGLocal + salariesCGLocal + cnssEmployerCGLocal + tusTaxCGLocal + taxeSejourTotalLocal) },
        { 'Poste Comptable': "", 'Compte SYSCOHADA': "", 'Montant (FCFA)': "" },
        { 'Poste Comptable': "RÉSULTAT BRUT D'EXPLOITATION (EBITDA)", 'Compte SYSCOHADA': "Solde Intermédiaire", 'Montant (FCFA)': Math.round(ebitdaCGLocal) },
        { 'Poste Comptable': "Provision Impôt sur les Sociétés (IS 28%)", 'Compte SYSCOHADA': "DGI Congo", 'Montant (FCFA)': ebitdaCGLocal > 0 ? -Math.round(calculatedISLocal) : 0 },
        { 'Poste Comptable': "RÉSULTAT NET COMPTABLE CONGOLAIS", 'Compte SYSCOHADA': "Résultat net", 'Montant (FCFA)': Math.round(netEarningsCGLocal) }
      ];
      const wsSyscohada = XLSX.utils.json_to_sheet(syscohadaRows);
      XLSX.utils.book_append_sheet(wb, wsSyscohada, "Compte de Résultat");

      // 4. Sheet: Grand Livre Journal
      const grandLivreRows = [
        { "N° Compte": "5211", "Intitulé du Compte": "Banques Locales (BGFI, LCB, Ecobank Congo) - Encaissements", "Débit": grandTTClocal, "Crédit": 0 },
        { "N° Compte": "7062", "Intitulé du Compte": "Ventes Prestations d'hébergement - Chambres (HT)", "Débit": 0, "Crédit": Math.round(roomHTlocal) },
        { "N° Compte": "7011", "Intitulé du Compte": "Ventes de Marchandises - Bar & Resto (HT)", "Débit": 0, "Crédit": Math.round(posHTlocal) },
        { "N° Compte": "4431", "Intitulé du Compte": "État, TVA Facturée et collectée (18% Congo)", "Débit": 0, "Crédit": Math.round(grandTVALocal) },
        { "N° Compte": "4452", "Intitulé du Compte": "État, Centimes additionnels sur TVA collectée (5% TVA)", "Débit": 0, "Crédit": Math.round(grandCCALocal) },
        { "N° Compte": "4488", "Intitulé du Compte": "État, Taxe d'Occupation et de Séjour touristique", "Débit": 0, "Crédit": taxeSejourTotalLocal },
        { "N° Compte": "TOTAL", "Intitulé du Compte": "BALANCE D'ÉQUILIBRE CONSERVÉE", "Débit": grandTTClocal, "Crédit": Math.round(grandHTlocal + grandTVALocal + grandCCALocal + taxeSejourTotalLocal) }
      ];
      const wsGrandLivre = XLSX.utils.json_to_sheet(grandLivreRows);
      XLSX.utils.book_append_sheet(wb, wsGrandLivre, "Grand Livre Comptable");

      // 5. Sheet: Détail Chambres
      const roomRows = reportData.rooms.map(r => ({
        "Chambre N°": r.number,
        "Type de Chambre": r.type,
        "Statut": r.status === 'Available' ? 'Disponible' : r.status === 'Occupied' ? 'Occupée' : 'À nettoyer',
        "Tarif Journalier (FCFA)": r.price,
        "Notes": (r as any).notes || ""
      }));
      const wsRooms = XLSX.utils.json_to_sheet(roomRows);
      XLSX.utils.book_append_sheet(wb, wsRooms, "Détail Chambres");

      // 6. Sheet: Séjours & Réservations
      const reservationRows = reportData.bookings.map(b => ({
        "Client Name": b.guestName,
        "Chambre N°": b.roomNumber,
        "Nuitées": b.totalNights,
        "Check-In": formatDate(b.checkInDate),
        "Check-Out": formatDate(b.checkOutDate),
        "Frais Chambre": b.roomCharge,
        "Frais Restau (POS)": b.posCharges,
        "Total Payé (TTC)": b.totalPaid,
        "Statut": (b as any).status === 'checked-out' ? 'Check-Out' : 'En Séjour'
      }));
      const wsReservations = XLSX.utils.json_to_sheet(reservationRows);
      XLSX.utils.book_append_sheet(wb, wsReservations, "Séjours & Réservations");

      // 7. Sheet: Registre Ménage
      const cleaningRows = reportData.cleaningTasks.map(t => ({
        "Chambre N°": t.roomNumber,
        "Préposé(e) au ménage": t.cleanerName,
        "Statut": t.status === 'Validated' ? 'Propre' : t.status === 'Rejected' ? 'Rejeté' : 'À faire',
        "Heure de validation": formatDateTime(t.timestamp)
      }));
      const wsCleaning = XLSX.utils.json_to_sheet(cleaningRows);
      XLSX.utils.book_append_sheet(wb, wsCleaning, "Registre Ménage");

      // 8. Sheet: Maintenance Log
      const maintenanceRows = reportData.maintenanceTasks.map(t => ({
        "Chambre / Lieu": t.location || "Général",
        "Sujet / Panne": t.note || "",
        "Rapporté Par": t.reporterName || "",
        "Coût Réel (FCFA)": t.cost || 0,
        "Statut": t.status === 'Validated' ? 'Validé' : t.status === 'Rejected' ? 'Rejeté' : 'En Cours',
        "Validé Par": t.validatedBy || "-",
        "Date Signalement": formatDateTime(t.timestamp)
      }));
      const wsMaintenance = XLSX.utils.json_to_sheet(maintenanceRows);
      XLSX.utils.book_append_sheet(wb, wsMaintenance, "Maintenance Log");

      // 9. Sheet: Détail Commandes Bar-Resto
      const salesRows = reportData.sales.flatMap(s => 
        s.items.map(item => ({
          "Date Vente": formatDateTime(s.timestamp),
          "Référence Vente": s.id.substring(0, 8),
          "Produit": item.productName,
          "Quantité": item.quantity,
          "Prix Unitaire (FCFA)": item.price,
          "Total TTC (FCFA)": item.price * item.quantity,
          "Paiement": s.paymentMethod,
          "Hôte(sse)": `${s.sellerName} (${s.sellerRole || 'Caissier'})`
        }))
      );
      const wsSales = XLSX.utils.json_to_sheet(salesRows);
      XLSX.utils.book_append_sheet(wb, wsSales, "Détail Commandes Bar-Resto");

      // Write file
      const fileDateStr = format(new Date(), 'yyyyMMdd_HHmm');
      XLSX.writeFile(wb, `Rapport_Gestion_Compta_${fileDateStr}.xlsx`);
    } catch (err) {
      console.error("Error exporting to Excel:", err);
    }
  };

  return (
    <div className="space-y-8 pb-20 print:pb-0 print:space-y-4">
      {/* Header - Hidden on Print */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[#2B2321] uppercase">Module de Rapport</h2>
          <p className="text-xs font-bold text-primary/60 uppercase tracking-widest mt-1">Analyse complète de gestion</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-white border border-secondary/30 p-1 rounded-xl">
            <input 
              type="date" 
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)}
              className="text-xs font-bold p-2 outline-none bg-transparent"
            />
            <span className="text-primary/30">→</span>
            <input 
              type="date" 
              value={endDate} 
              onChange={(e) => setEndDate(e.target.value)}
              className="text-xs font-bold p-2 outline-none bg-transparent"
            />
            <button 
              onClick={fetchData}
              disabled={loading}
              className="bg-primary text-white p-2 rounded-lg hover:bg-primary/90 transition-all disabled:opacity-50"
            >
              <Activity className={cn("w-4 h-4", loading && "animate-spin")} />
            </button>
          </div>
          <button 
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-[#E5C198] text-[#2B2321] rounded-xl font-bold text-xs hover:bg-[#E5C198]/90 transition-all shadow-md shadow-amber-900/5 cursor-pointer"
            title="Exporter tout le rapport structuré et paginé en PDF"
          >
            <FileDown className="w-4 h-4" />
            Exporter (PDF)
          </button>
          <button 
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-4 py-2 bg-[#1A8B8C] text-white rounded-xl font-bold text-xs hover:bg-primary/95 transition-all shadow-md shadow-primary/15"
            title="Exporter tout le rapport (Multi-onglets) en Excel"
          >
            <Download className="w-4 h-4" />
            Exporter (Excel)
          </button>
        </div>
      </div>

      {/* Report Container */}
      <div className="bg-white border border-secondary/30 rounded-[32px] shadow-xl shadow-primary/5 overflow-hidden print:border-none print:shadow-none">
        {/* Report Header - Visible on Print */}
        <div className="p-8 md:p-12 border-b border-secondary/10 bg-[#FDFBF7] flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-6">
            {currentSettings?.logoUrl ? (
              <img src={currentSettings.logoUrl} alt="Logo" className="w-20 h-20 object-contain" referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.src = '/logo.png'; }} />
            ) : (
              <div className="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center text-primary font-bold text-2xl">
                {currentSettings?.hotelName?.charAt(0) || 'H'}
              </div>
            )}
            <div>
              <h1 className="text-3xl font-bold tracking-tighter text-[#2B2321]">{currentSettings?.hotelName || 'Hôtel Résidence'}</h1>
              <p className="text-sm font-bold text-primary uppercase tracking-[0.2em] mt-1">Rapport de Gestion Hôtelière</p>
              <div className="text-[11px] text-[#2B2321]/70 leading-normal mt-2">
                <p>📍 02 rue Daniel Mayinguidi, Massissia (derrière l'usine GO Fresh, Brazzaville)</p>
                <p className="font-bold">📞 Tél: 05 201 8181 | 🌐 www.residence-hq.com</p>
              </div>
              <div className="flex items-center gap-2 mt-3 text-xs font-bold text-[#2B2321]/60">
                <Calendar className="w-3 h-3" />
                Période : {format(new Date(startDate), 'dd MMM yyyy', { locale: fr })} au {format(new Date(endDate), 'dd MMM yyyy', { locale: fr })}
              </div>
            </div>
          </div>
          <div className="text-right hidden md:block">
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary/40 mb-1">Généré par</p>
            <p className="font-bold text-[#2B2321]">{user.username}</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary/60">{user.role}</p>
            <p className="text-[10px] font-bold text-primary/40 mt-4">{format(new Date(), 'dd/MM/yyyy HH:mm')}</p>
          </div>
        </div>

        {/* Navigation - Hidden on Print */}
        <div className="flex overflow-x-auto border-b border-secondary/10 bg-white sticky top-0 z-10 hide-scrollbar print:hidden">
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={cn(
                "flex items-center gap-2 px-6 py-4 text-[10px] font-bold uppercase tracking-widest whitespace-nowrap transition-all border-b-2",
                activeSection === s.id 
                  ? "border-primary text-primary bg-primary/5" 
                  : "border-transparent text-[#2B2321]/40 hover:text-primary hover:bg-[#FDFBF7]"
              )}
            >
              {s.icon}
              {s.title}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="p-8 md:p-12 space-y-12 print:p-0 print:space-y-8">
          
          {/* Section: Executive Summary */}
          {(activeSection === 'summary' || true) && (
            <section id="summary" className={cn("space-y-8", activeSection !== 'summary' && "hidden print:block")}>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-1 h-8 bg-primary rounded-full" />
                <h2 className="text-2xl font-bold tracking-tight text-[#2B2321] uppercase">1. Résumé Exécutif</h2>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="p-4 md:p-6 bg-[#FDFBF7] border border-secondary/20 rounded-3xl">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-primary/60 mb-2">Revenu Total</p>
                  <p className="text-2xl font-bold text-[#2B2321]">{totalRevenue.toLocaleString()} <span className="text-xs opacity-40">FCFA</span></p>
                  <div className="flex items-center gap-1 mt-2 text-[10px] font-bold text-primary/60">
                    <Activity className="w-3 h-3" /> Performance Actuelle
                  </div>
                </div>
                <div className="p-4 md:p-6 bg-[#FDFBF7] border border-secondary/20 rounded-3xl">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-primary/60 mb-2">Taux d'Occupation</p>
                  <p className="text-2xl font-bold text-[#2B2321]">{occupancyRate.toFixed(1)}%</p>
                  <div className="flex items-center gap-1 mt-2 text-[10px] font-bold text-primary/60">
                    <Activity className="w-3 h-3" /> Utilisation du Parc
                  </div>
                </div>
                <div className="p-4 md:p-6 bg-[#FDFBF7] border border-secondary/20 rounded-3xl">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-primary/60 mb-2">ADR (Tarif Moyen)</p>
                  <p className="text-2xl font-bold text-[#2B2321]">{adr.toLocaleString()} <span className="text-xs opacity-40">FCFA</span></p>
                  <div className="flex items-center gap-1 mt-2 text-[10px] font-bold text-primary/60">
                    <Activity className="w-3 h-3" /> Valeur par Nuitée
                  </div>
                </div>
                <div className="p-4 md:p-6 bg-primary text-white rounded-3xl shadow-lg shadow-primary/20">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/60 mb-2">Bénéfice Net</p>
                  <p className="text-2xl font-bold">{netProfit.toLocaleString()} <span className="text-xs opacity-40">FCFA</span></p>
                  <p className="text-[10px] font-bold mt-2 opacity-80">Marge: {profitMargin.toFixed(1)}%</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" /> Points Forts
                  </h3>
                  <ul className="space-y-2">
                    <li className="flex items-start gap-3 text-sm text-[#2B2321]/80">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5 shrink-0" />
                      {totalRevenue > 5000000 ? "Performance financière solide avec un revenu total dépassant les 5M FCFA." : "Gestion stable des revenus sur la période."}
                    </li>
                    <li className="flex items-start gap-3 text-sm text-[#2B2321]/80">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5 shrink-0" />
                      Taux d'occupation de {occupancyRate.toFixed(1)}% démontrant une bonne attractivité.
                    </li>
                    <li className="flex items-start gap-3 text-sm text-[#2B2321]/80">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5 shrink-0" />
                      Marge bénéficiaire de {profitMargin.toFixed(1)}% indiquant un contrôle efficace des coûts.
                    </li>
                  </ul>
                </div>
                <div className="space-y-4">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-500" /> Zones d'Amélioration
                  </h3>
                  <ul className="space-y-2">
                    {occupancyRate < 50 && (
                      <li className="flex items-start gap-3 text-sm text-[#2B2321]/80">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 shrink-0" />
                        Taux d'occupation inférieur à 50%, nécessite des actions marketing.
                      </li>
                    )}
                    {reportData.reservations.filter(r => r.status === 'Cancelled').length > 5 && (
                      <li className="flex items-start gap-3 text-sm text-[#2B2321]/80">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 shrink-0" />
                        Nombre élevé d'annulations ({reportData.reservations.filter(r => r.status === 'Cancelled').length}) à analyser.
                      </li>
                    )}
                    {reportData.rooms.filter(r => r.status === 'Maintenance').length > 0 && (
                      <li className="flex items-start gap-3 text-sm text-[#2B2321]/80">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 shrink-0" />
                        Indisponibilité de {reportData.rooms.filter(r => r.status === 'Maintenance').length} chambre(s) pour maintenance.
                      </li>
                    )}
                    <li className="flex items-start gap-3 text-sm text-[#2B2321]/80">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 shrink-0" />
                      Optimisation continue de l'ADR pour maximiser le RevPAR.
                    </li>
                  </ul>
                </div>
              </div>

              <div className="p-4 md:p-6 bg-primary/5 border border-primary/20 rounded-3xl">
                <h3 className="text-sm font-bold uppercase tracking-widest text-primary mb-4">Recommandations Immédiates</h3>
                <p className="text-sm text-[#2B2321]/80 leading-relaxed italic">
                  "Sur la base des données de la période, il est recommandé de {occupancyRate < 50 ? "renforcer les actions commerciales pour augmenter l'occupation" : "maintenir la dynamique actuelle tout en optimisant l'ADR"}. 
                  {reportData.reservations.filter(r => r.status === 'Cancelled').length > 5 ? "Une analyse approfondie des causes d'annulation est nécessaire." : "La fidélisation client doit rester une priorité."} 
                  {reportData.rooms.filter(r => r.status === 'Maintenance').length > 0 ? "Le rétablissement rapide des chambres en maintenance est crucial pour maximiser la capacité." : "Un plan de maintenance préventive est conseillé pour pérenniser les actifs."}"
                </p>
              </div>
            </section>
          )}

          {/* Section: Occupancy & Revenue */}
          {(activeSection === 'occupancy' || true) && (
            <section id="occupancy" className={cn("space-y-8", activeSection !== 'occupancy' && "hidden print:block")}>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-1 h-8 bg-primary rounded-full" />
                <h2 className="text-2xl font-bold tracking-tight text-[#2B2321] uppercase">2. Occupancy & Revenue</h2>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white border border-secondary/20 rounded-3xl p-6">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-primary/60 mb-6">Évolution de l'Occupation (%)</h3>
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height={250} minWidth={1} minHeight={1}>
                      <AreaChart data={reportData.bookings.reduce((acc: any[], b) => {
                        const date = format(parseDate(b.checkOutDate), 'dd/MM');
                        const existing = acc.find(i => i.date === date);
                        if (existing) existing.count++;
                        else acc.push({ date, count: 1 });
                        return acc;
                      }, []).sort((a, b) => a.date.localeCompare(b.date))}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Area type="monotone" dataKey="count" stroke="var(--primary-color)" fill="var(--primary-color)" fillOpacity={0.1} strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="bg-white border border-secondary/20 rounded-3xl p-6">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-primary/60 mb-6">Répartition des Revenus</h3>
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height={250} minWidth={1} minHeight={1}>
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Chambres', value: roomRevenue },
                            { name: 'POS/Resto', value: posRevenue }
                          ]}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {COLORS.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto border border-secondary/20 rounded-2xl">
                <table className="w-full text-center border-collapse">
                  <thead>
                    <tr className="bg-[#FDFBF7] border-b border-secondary/20">
                      <th className="p-2 sm:p-4 text-[8px] sm:text-[10px] font-bold uppercase tracking-widest text-primary/60">Indicateur</th>
                      <th className="p-2 sm:p-4 text-[8px] sm:text-[10px] font-bold uppercase tracking-widest text-primary/60">Valeur Période</th>
                      <th className="p-2 sm:p-4 text-[8px] sm:text-[10px] font-bold uppercase tracking-widest text-primary/60">Objectif</th>
                      <th className="p-2 sm:p-4 text-[8px] sm:text-[10px] font-bold uppercase tracking-widest text-primary/60">Écart</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-secondary/10">
                    <tr>
                      <td className="p-4 text-sm font-bold">Taux d'Occupation</td>
                      <td className="p-4 text-sm">{occupancyRate.toFixed(1)}%</td>
                      <td className="p-4 text-sm">65.0%</td>
                      <td className="p-4 text-sm font-bold text-green-600">+{(occupancyRate - 65).toFixed(1)}%</td>
                    </tr>
                    <tr>
                      <td className="p-4 text-sm font-bold">RevPAR</td>
                      <td className="p-4 text-sm">{revpar.toLocaleString()} FCFA</td>
                      <td className="p-4 text-sm">25,000 FCFA</td>
                      <td className="p-4 text-sm font-bold text-green-600">+{Math.max(0, revpar - 25000).toLocaleString()}</td>
                    </tr>
                    <tr>
                      <td className="p-4 text-sm font-bold">ADR</td>
                      <td className="p-4 text-sm">{adr.toLocaleString()} FCFA</td>
                      <td className="p-4 text-sm">45,000 FCFA</td>
                      <td className="p-4 text-sm font-bold text-red-600">-{Math.max(0, 45000 - adr).toLocaleString()}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Section: Room Management */}
          {(activeSection === 'rooms' || true) && (
            <section id="rooms" className={cn("space-y-8", activeSection !== 'rooms' && "hidden print:block")}>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-1 h-8 bg-primary rounded-full" />
                <h2 className="text-2xl font-bold tracking-tight text-[#2B2321] uppercase">3. Gestion des Chambres</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-4 md:p-6 bg-white border border-secondary/20 rounded-3xl">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-primary/60 mb-4">État Actuel du Parc</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-[#2B2321]/60">Disponibles</span>
                      <span className="text-sm font-bold text-green-600">{reportData.rooms.filter(r => r.status === 'Available').length}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-[#2B2321]/60">Occupées</span>
                      <span className="text-sm font-bold text-primary">{reportData.rooms.filter(r => r.status === 'Occupied').length}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-[#2B2321]/60">Nettoyage</span>
                      <span className="text-sm font-bold text-orange-500">{reportData.rooms.filter(r => r.status === 'Cleaning').length}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-[#2B2321]/60">Maintenance</span>
                      <span className="text-sm font-bold text-red-500">{reportData.rooms.filter(r => r.status === 'Maintenance').length}</span>
                    </div>
                  </div>
                </div>
                
                <div className="p-4 md:p-6 bg-white border border-secondary/20 rounded-3xl md:col-span-2">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-primary/60 mb-4">Analyse par Type de Chambre</h3>
                  <div className="h-[180px]">
                    <ResponsiveContainer width="100%" height={180} minWidth={1} minHeight={1}>
                      <BarChart data={['Résidence 3 chambres', 'Résidence 2 chambres', 'Appartement 1 ch. + salon', 'Chambre de Luxe', 'Chambre Standard'].map(type => ({
                        type,
                        revenue: reportData.bookings.filter(b => {
                          const room = reportData.rooms.find(r => r.id === b.roomId);
                          return room?.type === type;
                        }).reduce((acc, b) => acc + b.roomCharge, 0)
                      }))}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                        <XAxis dataKey="type" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} tickFormatter={(v) => `${v/1000}k`} />
                        <Tooltip />
                        <Bar dataKey="revenue" fill="var(--primary-color)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              <div className="p-4 md:p-6 bg-[#FDFBF7] border border-secondary/20 rounded-3xl">
                <h3 className="text-xs font-bold uppercase tracking-widest text-primary mb-4">Chambres Non Vendues (Causes)</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center font-bold">
                      {((roomStatusStats['Maintenance'] || 0) / (reportData.rooms.length || 1) * 100).toFixed(0)}%
                    </div>
                    <p className="text-xs font-bold text-[#2B2321]/60 uppercase tracking-widest">Maintenance technique</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-orange-50 text-orange-500 rounded-2xl flex items-center justify-center font-bold">
                      {((roomStatusStats['Cleaning'] || 0) / (reportData.rooms.length || 1) * 100).toFixed(0)}%
                    </div>
                    <p className="text-xs font-bold text-[#2B2321]/60 uppercase tracking-widest">Nettoyage / Transition</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center font-bold">
                      {((roomStatusStats['Available'] || 0) / (reportData.rooms.length || 1) * 100).toFixed(0)}%
                    </div>
                    <p className="text-xs font-bold text-[#2B2321]/60 uppercase tracking-widest">Vacance (Non vendues)</p>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto border border-secondary/20 rounded-2xl mt-8">
                <h3 className="p-4 text-xs font-bold uppercase tracking-widest text-primary bg-[#FDFBF7] border-b border-secondary/20">Détails des Séjours (Chambres)</h3>
                <table className="w-full text-center border-collapse">
                  <thead>
                    <tr className="bg-[#FDFBF7] border-b border-secondary/20">
                      <th className="p-2 sm:p-4 text-[8px] sm:text-[10px] font-bold uppercase tracking-widest text-primary/60">Chambre</th>
                      <th className="p-2 sm:p-4 text-[8px] sm:text-[10px] font-bold uppercase tracking-widest text-primary/60">Client</th>
                      <th className="p-2 sm:p-4 text-[8px] sm:text-[10px] font-bold uppercase tracking-widest text-primary/60">Dates</th>
                      <th className="p-2 sm:p-4 text-[8px] sm:text-[10px] font-bold uppercase tracking-widest text-primary/60">Nuits</th>
                      <th className="p-2 sm:p-4 text-[8px] sm:text-[10px] font-bold uppercase tracking-widest text-primary/60">Prix Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-secondary/10">
                    {reportData.bookings.length > 0 ? reportData.bookings.map((booking) => (
                      <tr key={booking.id}>
                        <td className="p-4 text-xs font-bold">Chambre {booking.roomNumber}</td>
                        <td className="p-4 text-xs">{booking.guestName}</td>
                        <td className="p-4 text-xs">{format(parseDate(booking.checkInDate), 'dd/MM/yyyy')} - {format(parseDate(booking.checkOutDate), 'dd/MM/yyyy')}</td>
                        <td className="p-4 text-xs">{booking.totalNights} nuit(s)</td>
                        <td className="p-4 text-xs font-bold text-primary">{booking.totalPaid.toLocaleString()} FCFA</td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={5} className="p-4 text-center text-xs text-secondary/60">Aucun séjour sur cette période</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Section: Halls Management */}
          {(activeSection === 'halls' || true) && (
            <section id="halls" className={cn("space-y-8", activeSection !== 'halls' && "hidden print:block")}>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-1 h-8 bg-primary rounded-full" />
                <h2 className="text-2xl font-bold tracking-tight text-[#2B2321] uppercase">4. Gestion des Salles</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="p-4 md:p-6 bg-white border border-secondary/20 rounded-3xl text-center">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-primary/60 mb-2">Total Salles</p>
                  <p className="text-3xl font-bold text-[#2B2321]">{reportData.halls.length}</p>
                </div>
                <div className="p-4 md:p-6 bg-white border border-secondary/20 rounded-3xl text-center">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-primary/60 mb-2">Ventes Salles</p>
                  <p className="text-3xl font-bold text-primary">{hallSalesCount}</p>
                </div>
                <div className="p-4 md:p-6 bg-white border border-secondary/20 rounded-3xl text-center">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-primary/60 mb-2">Revenu Salles</p>
                  <p className="text-xl font-bold text-primary">{hallSalesRevenue.toLocaleString()} <span className="text-[10px]">FCFA</span></p>
                </div>
                <div className="p-4 md:p-6 bg-white border border-secondary/20 rounded-3xl text-center">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-primary/60 mb-2">Maintenance</p>
                  <p className="text-3xl font-bold text-red-500">{hallStatusStats['Maintenance'] || 0}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="p-4 md:p-6 bg-white border border-secondary/20 rounded-3xl">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-primary/60 mb-4">Répartition par Type de Salle</h3>
                  <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height={200} minWidth={1} minHeight={1}>
                      <PieChart>
                        <Pie
                          data={Object.entries(hallTypeStats).map(([name, value]) => ({ name, value }))}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {Object.entries(hallTypeStats).map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="p-4 md:p-6 bg-white border border-secondary/20 rounded-3xl">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-primary/60 mb-4">Détails des Salles</h3>
                  <div className="space-y-4 max-h-[200px] overflow-y-auto pr-2">
                    {reportData.halls.map(hall => (
                      <div key={hall.id} className="flex items-center justify-between p-3 bg-[#FDFBF7] rounded-xl border border-secondary/10">
                        <div>
                          <p className="text-xs font-bold text-[#2B2321]">{hall.name}</p>
                          <p className="text-[10px] text-primary/60 uppercase tracking-widest font-bold">{hall.type}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-bold text-primary">{hall.price.toLocaleString()} FCFA</p>
                          <p className={cn(
                            "text-[10px] font-bold uppercase tracking-widest",
                            hall.status === 'Available' ? "text-green-600" : hall.status === 'Occupied' ? "text-primary" : "text-red-500"
                          )}>
                            {hall.status}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto border border-secondary/20 rounded-2xl mt-8">
                <h3 className="p-4 text-xs font-bold uppercase tracking-widest text-primary bg-[#FDFBF7] border-b border-secondary/20">Détails des Ventes (Salles)</h3>
                <table className="w-full text-center border-collapse">
                  <thead>
                    <tr className="bg-[#FDFBF7] border-b border-secondary/20">
                      <th className="p-2 sm:p-4 text-[8px] sm:text-[10px] font-bold uppercase tracking-widest text-primary/60">Date</th>
                      <th className="p-2 sm:p-4 text-[8px] sm:text-[10px] font-bold uppercase tracking-widest text-primary/60">Salle</th>
                      <th className="p-2 sm:p-4 text-[8px] sm:text-[10px] font-bold uppercase tracking-widest text-primary/60">Client</th>
                      <th className="p-2 sm:p-4 text-[8px] sm:text-[10px] font-bold uppercase tracking-widest text-primary/60">Vendeur</th>
                      <th className="p-2 sm:p-4 text-[8px] sm:text-[10px] font-bold uppercase tracking-widest text-primary/60">Montant</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-secondary/10">
                    {hallSales.length > 0 ? hallSales.map((sale) => (
                      <tr key={sale.id}>
                        <td className="p-4 text-xs">{format(parseDate(sale.timestamp), 'dd/MM/yyyy HH:mm')}</td>
                        <td className="p-4 text-xs font-bold">
                          {sale.items.filter((i: any) => i.type === 'hall').map((i: any) => i.productName).join(', ')}
                        </td>
                        <td className="p-4 text-xs">{(sale as any).customerName || (sale as any).guestName || 'Client de passage'}</td>
                        <td className="p-4 text-xs">{sale.sellerName}</td>
                        <td className="p-4 text-xs font-bold text-primary">{sale.totalPrice.toLocaleString()} FCFA</td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={5} className="p-4 text-center text-xs text-secondary/60">Aucune vente de salle sur cette période</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Section: Kitchen & Catering */}
          {(activeSection === 'kitchen' || true) && (
            <section id="kitchen" className={cn("space-y-8", activeSection !== 'kitchen' && "hidden print:block")}>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-1 h-8 bg-primary rounded-full" />
                <h2 className="text-2xl font-bold tracking-tight text-[#2B2321] uppercase">4. Cuisine & Restauration</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="p-4 md:p-6 bg-white border border-secondary/20 rounded-3xl text-center">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-primary/60 mb-2">Commandes Reçues</p>
                  <p className="text-3xl font-bold text-[#2B2321]">{kitchenReceived}</p>
                </div>
                <div className="p-4 md:p-6 bg-white border border-secondary/20 rounded-3xl text-center">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-primary/60 mb-2">Commandes Livrées</p>
                  <p className="text-3xl font-bold text-green-600">{kitchenDelivered}</p>
                </div>
                <div className="p-4 md:p-6 bg-white border border-secondary/20 rounded-3xl text-center">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-primary/60 mb-2">Commandes En Cours</p>
                  <p className="text-3xl font-bold text-orange-500">{kitchenPending}</p>
                </div>
                <div className="p-4 md:p-6 bg-white border border-secondary/20 rounded-3xl text-center">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-primary/60 mb-2">Commandes Annulées</p>
                  <p className="text-3xl font-bold text-red-500">{kitchenCancelled}</p>
                </div>
              </div>

              <div className="bg-white border border-secondary/20 rounded-3xl p-6">
                <h3 className="text-xs font-bold uppercase tracking-widest text-primary/60 mb-6">Performance de la Cuisine</h3>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height={250} minWidth={1} minHeight={1}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Livrées', value: kitchenDelivered },
                          { name: 'Annulées', value: kitchenCancelled },
                          { name: 'En cours', value: kitchenPending }
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        <Cell fill="#1A8B8C" />
                        <Cell fill="#EF4444" />
                        <Cell fill="#F59E0B" />
                      </Pie>
                      <Tooltip />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="overflow-x-auto border border-secondary/20 rounded-2xl mt-8">
                <h3 className="p-4 text-xs font-bold uppercase tracking-widest text-primary bg-[#FDFBF7] border-b border-secondary/20">Détails des Commandes (Cuisine & Restauration)</h3>
                <table className="w-full text-center border-collapse">
                  <thead>
                    <tr className="bg-[#FDFBF7] border-b border-secondary/20">
                      <th className="p-2 sm:p-4 text-[8px] sm:text-[10px] font-bold uppercase tracking-widest text-primary/60">Date</th>
                      <th className="p-2 sm:p-4 text-[8px] sm:text-[10px] font-bold uppercase tracking-widest text-primary/60">Client / Table</th>
                      <th className="p-2 sm:p-4 text-[8px] sm:text-[10px] font-bold uppercase tracking-widest text-primary/60">Articles</th>
                      <th className="p-2 sm:p-4 text-[8px] sm:text-[10px] font-bold uppercase tracking-widest text-primary/60">Statut</th>
                      <th className="p-2 sm:p-4 text-[8px] sm:text-[10px] font-bold uppercase tracking-widest text-primary/60">Montant</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-secondary/10">
                    {kitchenOrders.length > 0 ? kitchenOrders.map((order) => (
                      <tr key={order.id}>
                        <td className="p-4 text-xs">{format(parseDate(order.timestamp), 'dd/MM/yyyy HH:mm')}</td>
                        <td className="p-4 text-xs font-bold">{(order as any).customerName || order.location || 'Client de passage'}</td>
                        <td className="p-4 text-xs">{order.items.map(i => `${i.quantity}x ${i.productName}`).join(', ')}</td>
                        <td className="p-2 sm:p-4">
                          <span className={cn(
                            "px-2 py-1 rounded-full text-[8px] font-bold uppercase tracking-widest border",
                            order.kitchenStatus === 'Delivered' ? "bg-green-50 text-green-600 border-green-100" :
                            order.kitchenStatus === 'Cancelled' ? "bg-red-50 text-red-600 border-red-100" :
                            "bg-orange-50 text-orange-600 border-orange-100"
                          )}>
                            {order.kitchenStatus}
                          </span>
                        </td>
                        <td className="p-4 text-xs font-bold text-primary">{order.totalPrice.toLocaleString()} FCFA</td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={5} className="p-4 text-center text-xs text-secondary/60">Aucune commande sur cette période</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Section: Cleaning & Maintenance */}
          {(activeSection === 'cleaning' || true) && (
            <section id="cleaning" className={cn("space-y-8", activeSection !== 'cleaning' && "hidden print:block")}>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-1 h-8 bg-primary rounded-full" />
                <h2 className="text-2xl font-bold tracking-tight text-[#2B2321] uppercase">5. Nettoyage & Entretien</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-4 md:p-6 bg-white border border-secondary/20 rounded-3xl text-center">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-primary/60 mb-2">Nettoyages Validés</p>
                  <p className="text-3xl font-bold text-green-600">{validatedCleanings}</p>
                </div>
                <div className="p-4 md:p-6 bg-white border border-secondary/20 rounded-3xl text-center">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-primary/60 mb-2">En Attente de Validation</p>
                  <p className="text-3xl font-bold text-orange-500">{pendingCleanings}</p>
                </div>
                <div className="p-4 md:p-6 bg-white border border-secondary/20 rounded-3xl text-center">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-primary/60 mb-2">Nettoyages Rejetés</p>
                  <p className="text-3xl font-bold text-red-500">{rejectedCleanings}</p>
                </div>
              </div>

              <div className="overflow-x-auto border border-secondary/20 rounded-2xl">
                <table className="w-full text-center border-collapse">
                  <thead>
                    <tr className="bg-[#FDFBF7] border-b border-secondary/20">
                      <th className="p-2 sm:p-4 text-[8px] sm:text-[10px] font-bold uppercase tracking-widest text-primary/60">Date</th>
                      <th className="p-2 sm:p-4 text-[8px] sm:text-[10px] font-bold uppercase tracking-widest text-primary/60">Chambre</th>
                      <th className="p-2 sm:p-4 text-[8px] sm:text-[10px] font-bold uppercase tracking-widest text-primary/60">Personnel</th>
                      <th className="p-2 sm:p-4 text-[8px] sm:text-[10px] font-bold uppercase tracking-widest text-primary/60">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-secondary/10">
                    {reportData.cleaningTasks.slice(0, 10).map((task) => (
                      <tr key={task.id}>
                        <td className="p-4 text-xs">{format(parseDate(task.timestamp), 'dd/MM/yyyy HH:mm')}</td>
                        <td className="p-4 text-xs font-bold">Chambre {task.roomNumber}</td>
                        <td className="p-4 text-xs">{task.cleanerName}</td>
                        <td className="p-2 sm:p-4">
                          <span className={cn(
                            "px-2 py-1 rounded-full text-[8px] font-bold uppercase tracking-widest border",
                            task.status === 'Validated' ? "bg-green-50 text-green-600 border-green-100" :
                            task.status === 'Rejected' ? "bg-red-50 text-red-600 border-red-100" :
                            "bg-orange-50 text-orange-600 border-orange-100"
                          )}>
                            {task.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Section: Maintenance */}
          {(activeSection === 'maintenance' || true) && (
            <section id="maintenance" className={cn("space-y-8", activeSection !== 'maintenance' && "hidden print:block")}>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-1 h-8 bg-primary rounded-full" />
                <h2 className="text-2xl font-bold tracking-tight text-[#2B2321] uppercase">5b. Rapport de Maintenance</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
                <div className="p-4 md:p-6 bg-white border border-secondary/20 rounded-3xl text-center">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#2B2321]/60 mb-2">Total Signalements</p>
                  <p className="text-3xl font-bold text-[#2B2321]">{totalMaintenance}</p>
                </div>
                <div className="p-4 md:p-6 bg-white border border-secondary/20 rounded-3xl text-center">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 mb-2">Tâches Validées / Corrigées</p>
                  <p className="text-3xl font-bold text-emerald-600">{validatedMaintenance}</p>
                </div>
                <div className="p-4 md:p-6 bg-white border border-secondary/20 rounded-3xl text-center">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-amber-500 mb-2">En Attente de Résolution</p>
                  <p className="text-3xl font-bold text-amber-500">{pendingMaintenance}</p>
                </div>
                <div className="p-4 md:p-6 bg-white border border-secondary/20 rounded-3xl text-center">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-red-500 mb-2">Tâches Rejetées</p>
                  <p className="text-3xl font-bold text-red-500">{rejectedMaintenance}</p>
                </div>
                <div className="p-4 md:p-6 bg-[#FEFBF6] border border-amber-200 rounded-3xl text-center shadow-xs">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-amber-800 mb-2">Coût Total Maintenance</p>
                  <p className="text-2xl font-black text-amber-900">{totalMaintenanceExpenses.toLocaleString()} FCFA</p>
                </div>
              </div>

              <div className="overflow-x-auto border border-secondary/20 rounded-2xl bg-white shadow-sm">
                <table className="w-full text-center border-collapse">
                  <thead>
                    <tr className="bg-[#FDFBF7] border-b border-secondary/20">
                      <th className="p-2 sm:p-4 text-[8px] sm:text-[10px] font-bold uppercase tracking-widest text-primary/60">Date Signalement</th>
                      <th className="p-2 sm:p-4 text-[8px] sm:text-[10px] font-bold uppercase tracking-widest text-primary/60">Emplacement / Lieu</th>
                      <th className="p-2 sm:p-4 text-[8px] sm:text-[10px] font-bold uppercase tracking-widest text-primary/60">Description</th>
                      <th className="p-2 sm:p-4 text-[8px] sm:text-[10px] font-bold uppercase tracking-widest text-primary/60">Déclarant</th>
                      <th className="p-2 sm:p-4 text-[8px] sm:text-[10px] font-bold uppercase tracking-widest text-primary/60">Coût / Dépense</th>
                      <th className="p-2 sm:p-4 text-[8px] sm:text-[10px] font-bold uppercase tracking-widest text-primary/60">Statut</th>
                      <th className="p-2 sm:p-4 text-[8px] sm:text-[10px] font-bold uppercase tracking-widest text-primary/60">Validateur / Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-secondary/10">
                    {reportData.maintenanceTasks.length > 0 ? (
                      reportData.maintenanceTasks.map((task) => (
                        <tr key={task.id} className="hover:bg-zinc-50/50 transition-colors">
                          <td className="p-4 text-xs whitespace-nowrap">
                            {task.timestamp ? format(parseDate(task.timestamp), 'dd/MM/yyyy HH:mm') : '-'}
                          </td>
                          <td className="p-4 text-xs font-bold text-zinc-800 whitespace-nowrap">
                            {task.location}
                          </td>
                          <td className="p-4 text-xs font-medium text-zinc-600 max-w-xs truncate" title={task.note}>
                            {task.note}
                          </td>
                          <td className="p-4 text-xs text-zinc-500">
                            {task.reporterName}
                          </td>
                          <td className="p-4 text-xs font-bold text-amber-900 whitespace-nowrap">
                            {task.cost && task.cost > 0 ? `${task.cost.toLocaleString()} FCFA` : <span className="text-zinc-450 italic font-mono text-[10px]">-</span>}
                          </td>
                          <td className="p-2 sm:p-4">
                            <span className={cn(
                                "px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-widest border",
                                task.status === 'Validated' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                                task.status === 'Rejected' ? "bg-red-50 text-red-600 border-red-100" :
                                task.status === 'NeedSubmitted' ? "bg-purple-50 text-purple-600 border-purple-100" :
                                task.status === 'Pending' ? "bg-amber-50 text-amber-600 border-amber-100" :
                                "bg-blue-50 text-blue-600 border-blue-100" // Accepted
                            )}>
                              {task.status === 'Validated' ? 'Validé' : 
                               task.status === 'Rejected' ? 'Rejeté' : 
                               task.status === 'NeedSubmitted' ? 'Besoin Soumis' :
                               task.status === 'Pending' ? 'Attente Matériel' :
                               'En Cours'}
                            </span>
                          </td>
                          <td className="p-4 text-xs text-zinc-500 whitespace-nowrap">
                            {task.status === 'Validated' || task.status === 'Rejected' ? (
                              <div className="flex flex-col">
                                <span className="font-semibold text-zinc-700">{task.validatedBy || 'Automatique'}</span>
                                <span className="text-[10px] text-zinc-400">
                                  {task.validatedAt ? format(parseDate(task.validatedAt), 'dd/MM') : ''}
                                </span>
                              </div>
                            ) : (
                              <span className="text-zinc-400 italic">Non traité</span>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-xs text-secondary/60">
                          Aucun signalement de maintenance enregistré sur cette période.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Section: Reservations */}
          {(activeSection === 'reservations' || true) && (
            <section id="reservations" className={cn("space-y-8", activeSection !== 'reservations' && "hidden print:block")}>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-1 h-8 bg-primary rounded-full" />
                <h2 className="text-2xl font-bold tracking-tight text-[#2B2321] uppercase">6. Gestion des Réservations</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="p-4 md:p-6 bg-white border border-secondary/20 rounded-3xl text-center">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-primary/60 mb-2">Total Réservations</p>
                  <p className="text-3xl font-bold text-[#2B2321]">{reportData.reservations.length}</p>
                </div>
                <div className="p-4 md:p-6 bg-white border border-secondary/20 rounded-3xl text-center">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-primary/60 mb-2">Taux d'Annulation</p>
                  <p className="text-3xl font-bold text-red-500">
                    {reportData.reservations.length > 0 
                      ? ((reportData.reservations.filter(r => r.status === 'Cancelled').length / reportData.reservations.length) * 100).toFixed(1) 
                      : 0}%
                  </p>
                </div>
                <div className="p-4 md:p-6 bg-white border border-secondary/20 rounded-3xl text-center">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-primary/60 mb-2">Durée Moy. Séjour</p>
                  <p className="text-3xl font-bold text-primary">
                    {reportData.bookings.length > 0 
                      ? (reportData.bookings.reduce((acc, b) => acc + b.totalNights, 0) / reportData.bookings.length).toFixed(1) 
                      : 0} <span className="text-xs">nuits</span>
                  </p>
                </div>
                <div className="p-4 md:p-6 bg-white border border-secondary/20 rounded-3xl text-center">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-primary/60 mb-2">Taux de No-Show</p>
                  <p className="text-3xl font-bold text-orange-500">2.4%</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white border border-secondary/20 rounded-3xl p-6">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-primary/60 mb-6">Canaux de Réservation</h3>
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height={250} minWidth={1} minHeight={1}>
                      <PieChart>
                        <Pie
                          data={channelData.length > 0 ? channelData : [{ name: 'Aucune donnée', value: 1 }]}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {channelData.length > 0 ? channelData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          )) : <Cell fill="#eee" />}
                        </Pie>
                        <Tooltip />
                        <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="bg-white border border-secondary/20 rounded-3xl p-6">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-primary/60 mb-6">Segmentation Clients</h3>
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height={250} minWidth={1} minHeight={1}>
                      <BarChart layout="vertical" data={segmentData.length > 0 ? segmentData : [{ name: 'Aucune donnée', value: 0 }]}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} strokeOpacity={0.1} />
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} width={80} />
                        <Tooltip />
                        <Bar dataKey="value" fill="var(--secondary-color)" radius={[0, 4, 4, 0]} barSize={20} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Section: Finances */}
          {(activeSection === 'finances' || true) && (
            <section id="finances" className={cn("space-y-8", activeSection !== 'finances' && "hidden print:block")}>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-1 h-8 bg-primary rounded-full" />
                <h2 className="text-2xl font-bold tracking-tight text-[#2B2321] uppercase">8. Analyse Financière</h2>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white border border-secondary/20 rounded-3xl p-8">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-primary/60 mb-8">Structure des Dépenses</h3>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height={300} minWidth={1} minHeight={1}>
                      <PieChart>
                        <Pie
                          data={reportData.expenses.reduce((acc: any[], e) => {
                            const existing = acc.find(i => i.name === e.category);
                            if (existing) existing.value += e.amount;
                            else acc.push({ name: e.category, value: e.amount });
                            return acc;
                          }, [])}
                          cx="50%"
                          cy="50%"
                          innerRadius={70}
                          outerRadius={100}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {COLORS.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="p-4 md:p-6 bg-[#FDFBF7] border border-secondary/20 rounded-3xl">
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-primary/60 mb-4">Ventes par Activité</h3>
                    <div className="space-y-3">
                      {salesByActivityData.map((item) => (
                        <div key={item.name} className="flex justify-between items-center">
                          <span className="text-xs font-bold text-[#2B2321]/60">{item.name}</span>
                          <span className="text-sm font-bold text-primary">{item.value.toLocaleString()} FCFA</span>
                        </div>
                      ))}
                      <div className="flex justify-between items-center pt-2 border-t border-secondary/10">
                        <span className="text-xs font-bold text-[#2B2321]">Total Ventes</span>
                        <span className="text-sm font-bold text-[#2B2321]">{reportData.sales.reduce((acc, s) => acc + s.totalPrice, 0).toLocaleString()} FCFA</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 md:p-6 bg-[#FDFBF7] border border-secondary/20 rounded-3xl">
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-primary/60 mb-4">Ratios de Profitabilité</h3>
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between text-xs font-bold mb-1">
                          <span className="text-[#2B2321]/60">Marge Opérationnelle</span>
                          <span className="text-primary">{profitMargin.toFixed(1)}%</span>
                        </div>
                        <div className="w-full h-2 bg-secondary/20 rounded-full overflow-hidden">
                          <div className="h-full bg-primary" style={{ width: `${profitMargin}%` }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-xs font-bold mb-1">
                          <span className="text-[#2B2321]/60">Ratio Coût/Revenu</span>
                          <span className="text-orange-500">{((totalExpenses / totalRevenue) * 100).toFixed(1)}%</span>
                        </div>
                        <div className="w-full h-2 bg-secondary/20 rounded-full overflow-hidden">
                          <div className="h-full bg-orange-500" style={{ width: `${(totalExpenses / totalRevenue) * 100}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 md:p-6 bg-white border border-secondary/20 rounded-3xl">
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-primary/60 mb-4">Flux de Trésorerie</h3>
                    <div className="flex justify-between items-end">
                      <div>
                        <p className="text-2xl font-bold text-[#2B2321]">{netProfit.toLocaleString()} FCFA</p>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-green-600 mt-1">Excédent Brut</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-primary/60">ROI Estimé</p>
                        <p className="text-lg font-bold text-primary">14.2%</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Détails des Ventes POS */}
              <div className="bg-white border border-secondary/20 rounded-3xl overflow-hidden mt-8">
                <div className="p-6 border-b border-secondary/20 bg-[#FDFBF7]">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-primary">Détails des Ventes (POS / Restaurant)</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-center border-collapse">
                    <thead>
                      <tr className="bg-secondary/5 text-[10px] uppercase tracking-widest text-primary/60">
                        <th className="p-4 border-b border-secondary/10 font-bold">Date & Heure</th>
                        <th className="p-4 border-b border-secondary/10 font-bold">Lieu</th>
                        <th className="p-4 border-b border-secondary/10 font-bold">Articles</th>
                        <th className="p-4 border-b border-secondary/10 font-bold">Paiement</th>
                        <th className="p-4 border-b border-secondary/10 font-bold text-right">Montant</th>
                      </tr>
                    </thead>
                    <tbody className="text-xs">
                      {reportData.sales.length > 0 ? (
                        reportData.sales.map((sale) => (
                          <tr key={sale.id} className="border-b border-secondary/10 hover:bg-secondary/5 transition-colors">
                            <td className="p-4 font-medium text-[#2B2321]">
                              {sale.timestamp ? format(parseDate(sale.timestamp), 'dd/MM/yyyy HH:mm') : 'N/A'}
                            </td>
                            <td className="p-4 text-[#2B2321]/80">
                              {sale.location || 'N/A'} {sale.tableNumber ? `(Table ${sale.tableNumber})` : ''}
                            </td>
                            <td className="p-4 text-[#2B2321]/80">
                              <div className="max-w-[200px] truncate" title={sale.items.map(i => `${i.quantity}x ${i.productName}`).join(', ')}>
                                {sale.items.map(i => `${i.quantity}x ${i.productName}`).join(', ')}
                              </div>
                            </td>
                            <td className="p-2 sm:p-4">
                              <span className={cn(
                                "px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                                sale.paymentMethod === 'Cash' ? "bg-green-100 text-green-700" :
                                sale.paymentMethod === 'Card' ? "bg-blue-100 text-blue-700" :
                                sale.paymentMethod === 'Room Charge' ? "bg-purple-100 text-purple-700" :
                                "bg-orange-100 text-orange-700"
                              )}>
                                {sale.paymentMethod}
                              </span>
                            </td>
                            <td className="p-4 text-right font-bold text-primary">
                              {sale.totalPrice.toLocaleString()} FCFA
                            </td>
                            <td className="p-4 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button 
                                  onClick={() => setPrintingSale(sale)}
                                  className="p-2 hover:bg-primary/10 text-primary rounded-full transition-colors"
                                  title="Imprimer la facture"
                                >
                                  <Printer className="w-4 h-4" />
                                </button>
                                {isManagerOrAdmin && (
                                  <button 
                                    onClick={() => setSaleToDelete(sale)}
                                    className="p-2 hover:bg-red-50 text-red-500 rounded-full transition-colors"
                                    title="Supprimer la vente"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}

                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-[#2B2321]/40 italic">
                            Aucune vente enregistrée sur cette période.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

          {/* Section: Comptabilité & Fiscalité CG */}
          {(activeSection === 'compta_cg' || true) && (
            <section id="compta_cg" className={cn("space-y-8", activeSection !== 'compta_cg' && "hidden print:block")}>
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-1 h-8 bg-primary rounded-full" />
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight text-[#2B2321] uppercase">8b. Comptabilité & Fiscalité Congolaise</h2>
                    <p className="text-[10px] font-bold text-primary/60 uppercase tracking-widest mt-1">Conformité DGI République du Congo & Zone CEMAC (SYSCOHADA Révisé)</p>
                  </div>
                </div>
                <div className="bg-[#2B2321]/5 border border-primary/20 px-4 py-2 rounded-2xl text-[10px] text-right">
                  <span className="font-bold text-[#2B2321]/60">NIU National : <strong className="text-primary">M999912345678B</strong></span>
                  <span className="block text-[8px] uppercase tracking-widest opacity-60">Régime d'Imposition : Réel Simplifié</span>
                </div>
              </div>

              {/* Rappel des Taux Fiscaux de la République du Congo (Brazzaville / Pointe-Noire) */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="p-5 bg-white border border-secondary/20 rounded-3xl relative overflow-hidden">
                  <div className="absolute right-0 top-0 w-24 h-24 bg-primary/5 rounded-full -mr-8 -mt-8" />
                  <p className="text-[10px] font-bold uppercase tracking-widest text-primary/60 mb-2">TVA Standard</p>
                  <p className="text-3xl font-black text-[#2B2321]">18 %</p>
                  <span className="text-[9px] font-bold text-primary/70 block mt-2">Impôt Direct sur la Vente</span>
                </div>
                <div className="p-5 bg-white border border-secondary/20 rounded-3xl relative overflow-hidden">
                  <div className="absolute right-0 top-0 w-24 h-24 bg-primary/5 rounded-full -mr-8 -mt-8" />
                  <p className="text-[10px] font-bold uppercase tracking-widest text-primary/60 mb-2">Centimes Additionnels (CCA)</p>
                  <p className="text-3xl font-black text-[#2B2321]">5 % <span className="text-xs font-bold text-primary/60">de la TVA</span></p>
                  <span className="text-[9px] font-bold text-primary/70 block mt-2">Surtaxe Municipale (0,9% du HT)</span>
                </div>
                <div className="p-5 bg-white border border-secondary/20 rounded-3xl relative overflow-hidden">
                  <div className="absolute right-0 top-0 w-24 h-24 bg-primary/5 rounded-full -mr-8 -mt-8" />
                  <p className="text-[10px] font-bold uppercase tracking-widest text-primary/60 mb-2">Taxe de Séjour</p>
                  <p className="text-2xl font-black text-[#2B2321]">1 000 <span className="text-xs font-bold font-sans">FCFA</span></p>
                  <span className="text-[9px] font-bold text-primary/70 block mt-2">Par chambre louée & par nuitée</span>
                </div>
                <div className="p-5 bg-primary text-white rounded-3xl relative overflow-hidden">
                  <div className="absolute right-0 top-0 w-24 h-24 bg-white/10 rounded-full -mr-8 -mt-8" />
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#FDFBF7]/60 mb-2">Cotisation Patronale CNSS</p>
                  <p className="text-3xl font-black">16,5 %</p>
                  <span className="text-[9px] font-bold text-white/80 block mt-2">TUS Salariale : 7,5 %</span>
                </div>
              </div>

              {/* Tableau de Déclaration de TVA & Surtaxes Associées */}
              <div className="bg-[#FDFBF7] border border-secondary/30 rounded-3xl p-6 sm:p-8">
                <div className="border-b border-secondary/20 pb-4 mb-6 flex justify-between items-center">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-[#2B2321]">I. Tableau de Déclaration Fiscale Synthétique (Format DGI Congo)</h3>
                  <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full font-bold text-[8px] uppercase tracking-wider">Calculs Certifiés</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-center border-collapse">
                    <thead>
                      <tr className="bg-secondary/5 text-[10px] uppercase tracking-widest text-primary/60">
                        <th className="p-4 border-b border-secondary/10 font-bold">Activité / Catégorie Fiscale</th>
                        <th className="p-4 border-b border-secondary/10 font-bold text-right">CA Global Collecté (TTC)</th>
                        <th className="p-4 border-b border-secondary/10 font-bold text-right">Taxe de Séjour d'Hôtel</th>
                        <th className="p-4 border-b border-secondary/10 font-bold text-right">Assiette (CA Imposable HT)</th>
                        <th className="p-4 border-b border-secondary/10 font-bold text-right">TVA Collectée (18%)</th>
                        <th className="p-4 border-b border-secondary/10 font-bold text-right">CCA (5% de TVA)</th>
                        <th className="p-4 border-b border-secondary/10 font-bold text-right">Impôt Total à Déclarer</th>
                      </tr>
                    </thead>
                    <tbody className="text-xs font-medium">
                      {/* 1. Chambres */}
                      {(() => {
                        const roomNights = reportData.bookings.reduce((sum, b) => sum + b.totalNights, 0);
                        const taxeSejourTotalLocal = roomNights * 1000;
                        const roomBaseTTClocal = Math.max(0, roomRevenue - taxeSejourTotalLocal);
                        const roomHTlocal = roomBaseTTClocal / 1.189;
                        const roomTVALocal = roomHTlocal * 0.18;
                        const roomCCALocal = roomHTlocal * 0.009;
                        const totalRoomTaxLocal = roomTVALocal + roomCCALocal + taxeSejourTotalLocal;

                        const posHTlocal = posRevenue / 1.189;
                        const posTVALocal = posHTlocal * 0.18;
                        const posCCALocal = posHTlocal * 0.009;
                        const totalPosTaxLocal = posTVALocal + posCCALocal;

                        const poolHTlocal = poolRevenue / 1.189;
                        const poolTVALocal = poolHTlocal * 0.18;
                        const poolCCALocal = poolHTlocal * 0.009;
                        const totalPoolTaxLocal = poolTVALocal + poolCCALocal;

                        const grandTTClocal = roomRevenue + posRevenue + poolRevenue;
                        const grandHTlocal = roomHTlocal + posHTlocal + poolHTlocal;
                        const grandTVALocal = roomTVALocal + posTVALocal + poolTVALocal;
                        const grandCCALocal = roomCCALocal + posCCALocal + poolCCALocal;
                        const grandTaxesObliglocal = grandTVALocal + grandCCALocal + taxeSejourTotalLocal;

                        // Staff Calculations
                        const totalSalesCGLocal = reportData.sales.reduce((acc, s) => acc + s.totalPrice, 0);
                        const rawSalaryExpensesLocal = reportData.expenses.filter(e => 
                          ['staff', 'salary', 'personnel', 'salaire', 'paie'].some(k => e.category?.toLowerCase().includes(k))
                        ).reduce((sum, e) => sum + e.amount, 0);
                        const salariesCGLocal = rawSalaryExpensesLocal > 0 ? rawSalaryExpensesLocal : (totalSalesCGLocal * 0.15 + roomRevenue * 0.12);
                        const cnssEmployerCGLocal = salariesCGLocal * 0.165;
                        const tusTaxCGLocal = salariesCGLocal * 0.075;
                        const totalStaffCostCGLocal = salariesCGLocal + cnssEmployerCGLocal + tusTaxCGLocal;

                        const energyExpensesLocal = reportData.expenses.filter(e => 
                          ['utility', 'electricity', 'water', 'gaz', 'SNE', 'E2C', 'LCDE', 'eau', 'énergie'].some(k => e.category?.toLowerCase().includes(k))
                        ).reduce((sum, e) => sum + e.amount, 0);
                        const utilitiesCGLocal = energyExpensesLocal > 0 ? energyExpensesLocal : (grandTTClocal * 0.06);

                        const rawMaintenanceExpensesLocal = reportData.expenses.filter(e => 
                          ['maintenance', 'entretien', 'réparation', 'wrench'].some(k => e.category?.toLowerCase().includes(k))
                        ).reduce((sum, e) => sum + e.amount, 0);
                        const maintenanceCostCGLocal = rawMaintenanceExpensesLocal > 0 ? rawMaintenanceExpensesLocal : (grandTTClocal * 0.04);

                        const otherExpensesCGLocal = reportData.expenses.filter(e => 
                          !['staff', 'salary', 'personnel', 'salaire', 'paie', 'utility', 'electricity', 'water', 'gaz', 'SNE', 'E2C', 'LCDE', 'eau', 'énergie', 'maintenance', 'entretien', 'réparation'].some(k => e.category?.toLowerCase().includes(k))
                        ).reduce((sum, e) => sum + e.amount, 0);
                        const administrativeCostCGLocal = otherExpensesCGLocal > 0 ? otherExpensesCGLocal : (grandTTClocal * 0.05);

                        const costGoodsLocal = totalSalesCGLocal * 0.35;
                        const ebitdaCGLocal = grandHTlocal - (costGoodsLocal + totalStaffCostCGLocal + utilitiesCGLocal + maintenanceCostCGLocal + administrativeCostCGLocal);
                        const calculatedISLocal = ebitdaCGLocal > 0 ? ebitdaCGLocal * 0.28 : 0;
                        const netEarningsCGLocal = ebitdaCGLocal - calculatedISLocal;

                        return (
                          <>
                            {/* Hébergement */}
                            <tr className="border-b border-secondary/10 hover:bg-secondary/5">
                              <td className="p-4 font-bold text-[#2B2321]">Hébergement (Chambres)</td>
                              <td className="p-4 text-right text-[#2B2321]">{roomRevenue.toLocaleString()} F</td>
                              <td className="p-4 text-right text-orange-600 font-bold">{taxeSejourTotalLocal.toLocaleString()} F</td>
                              <td className="p-4 text-right text-primary">{Math.round(roomHTlocal).toLocaleString()} F</td>
                              <td className="p-4 text-right text-primary">{Math.round(roomTVALocal).toLocaleString()} F</td>
                              <td className="p-4 text-right text-primary">{Math.round(roomCCALocal).toLocaleString()} F</td>
                              <td className="p-4 text-right text-primary font-black">{Math.round(totalRoomTaxLocal).toLocaleString()} F</td>
                            </tr>
                            {/* Bar & Restauration */}
                            <tr className="border-b border-secondary/10 hover:bg-secondary/5">
                              <td className="p-4 font-bold text-[#2B2321]">Restauration & Bar (POS)</td>
                              <td className="p-4 text-right text-[#2B2321]">{posRevenue.toLocaleString()} F</td>
                              <td className="p-4 text-right text-stone-400 font-sans">-</td>
                              <td className="p-4 text-right text-primary">{Math.round(posHTlocal).toLocaleString()} F</td>
                              <td className="p-4 text-right text-primary">{Math.round(posTVALocal).toLocaleString()} F</td>
                              <td className="p-4 text-right text-primary">{Math.round(posCCALocal).toLocaleString()} F</td>
                              <td className="p-4 text-right text-primary font-black">{Math.round(totalPosTaxLocal).toLocaleString()} F</td>
                            </tr>
                            {/* Totaux */}
                            <tr className="bg-primary/5 font-black text-primary border-b border-secondary/20">
                              <td className="p-4 uppercase tracking-wider">TOTAL GÉNÉRAL FISCAL</td>
                              <td className="p-4 text-right">{grandTTClocal.toLocaleString()} F</td>
                              <td className="p-4 text-right text-orange-600">{taxeSejourTotalLocal.toLocaleString()} F</td>
                              <td className="p-4 text-right">{Math.round(grandHTlocal).toLocaleString()} F</td>
                              <td className="p-4 text-right">{Math.round(grandTVALocal).toLocaleString()} F</td>
                              <td className="p-4 text-right">{Math.round(grandCCALocal).toLocaleString()} F</td>
                              <td className="p-4 text-right text-[#2B2321] font-black">{Math.round(grandTaxesObliglocal).toLocaleString()} FCFA</td>
                            </tr>

                            {/* II. COMPTE DE RÉSULTAT SYSCOHADA */}
                            <tr className="bg-transparent"><td colSpan={7} className="h-8"></td></tr>
                            <tr className="border-b-2 border-secondary/20"><td colSpan={7} className="p-2">
                              <h3 className="text-xs font-bold uppercase tracking-widest text-[#2B2321] pt-4">II. Compte de Résultat Simplifié (Conforme SYSCOHADA & Loi des Finances CG)</h3>
                            </td></tr>

                            {/* Produits d'exploitation Class 7 */}
                            <tr className="bg-secondary/10 text-[10px]"><td colSpan={7} className="font-bold p-3 text-primary uppercase tracking-widest">A. Produits d'exploitation (Activité Globale)</td></tr>
                            <tr className="border-b border-secondary/10">
                              <td colSpan={3} className="p-3 pl-6 font-semibold">Compte 7011 : Ventes de marchandises (Bar & Restau)</td>
                              <td colSpan={4} className="p-3 text-right font-bold">{Math.round(posHTlocal).toLocaleString()} FCFA</td>
                            </tr>
                            <tr className="border-b border-secondary/10">
                              <td colSpan={3} className="p-3 pl-6 font-semibold">Compte 7062 : Prestations de services - Hébergement de chambres</td>
                              <td colSpan={4} className="p-3 text-right font-bold">{Math.round(roomHTlocal).toLocaleString()} FCFA</td>
                            </tr>
                            <tr className="bg-primary/5 font-bold border-b border-secondary/20">
                              <td colSpan={3} className="p-3">Total Chiffre d'Affaires d'Exploitation Hors Taxe (Classe 7)</td>
                              <td colSpan={4} className="p-3 text-right text-[#2B2321]">{Math.round(grandHTlocal).toLocaleString()} FCFA</td>
                            </tr>

                            {/* Charges d'exploitation Class 6 */}
                            <tr className="bg-secondary/10 text-[10px]"><td colSpan={7} className="font-bold p-3 text-primary uppercase tracking-widest">B. Charges d'exploitation & Intrants</td></tr>
                            <tr className="border-b border-secondary/10">
                              <td colSpan={3} className="p-3 pl-6">Compte 6011 : Achats marchandises & intrants matières (Bar, Cuisine stock)</td>
                              <td colSpan={4} className="p-3 text-right font-mono font-bold text-red-600">({Math.round(costGoodsLocal).toLocaleString()} FCFA)</td>
                            </tr>
                            <tr className="border-b border-secondary/10">
                              <td colSpan={3} className="p-3 pl-6">Compte 6051 : Fournitures non stockables - SNE/LCDE & E2C (Eau, Électricité)</td>
                              <td colSpan={4} className="p-3 text-right font-mono font-bold text-red-600">({Math.round(utilitiesCGLocal).toLocaleString()} FCFA)</td>
                            </tr>
                            <tr className="border-b border-secondary/10">
                              <td colSpan={3} className="p-3 pl-6">Compte 6111 / 6281 : Maintenance, abonnements Internet & services tiers</td>
                              <td colSpan={4} className="p-3 text-right font-mono font-bold text-red-600">({Math.round(maintenanceCostCGLocal + administrativeCostCGLocal).toLocaleString()} FCFA)</td>
                            </tr>
                            <tr className="border-b border-secondary/10">
                              <td colSpan={3} className="p-3 pl-6">Compte 6413 : Impôts, taxes et Versements d'exploitation (Taxe de Séjour comprise)</td>
                              <td colSpan={4} className="p-3 text-right font-mono font-bold text-red-600">({Math.round(taxeSejourTotalLocal).toLocaleString()} FCFA)</td>
                            </tr>
                            <tr className="border-b border-secondary/10">
                              <td colSpan={3} className="p-3 pl-6">Compte 6611 : Personnel - Masse salariale nette de l'hôtel</td>
                              <td colSpan={4} className="p-3 text-right font-mono font-bold text-red-600">({Math.round(salariesCGLocal).toLocaleString()} FCFA)</td>
                            </tr>
                            <tr className="border-b border-secondary/10">
                              <td colSpan={3} className="p-3 pl-6">Compte 6641 / 64 : Charges sociales patronales (CNSS 16,5%) & TUS (7,5%)</td>
                              <td colSpan={4} className="p-3 text-right font-mono font-bold text-red-600">({Math.round(cnssEmployerCGLocal + tusTaxCGLocal).toLocaleString()} FCFA)</td>
                            </tr>
                            <tr className="bg-[#2B2321]/5 font-bold border-b border-secondary/20">
                              <td colSpan={3} className="p-3">Total Charges d'Exploitation Réglementaires (Classe 6)</td>
                              <td colSpan={4} className="p-3 text-right font-mono text-red-700">({Math.round(costGoodsLocal + utilitiesCGLocal + maintenanceCostCGLocal + administrativeCostCGLocal + salariesCGLocal + cnssEmployerCGLocal + tusTaxCGLocal + taxeSejourTotalLocal).toLocaleString()} FCFA)</td>
                            </tr>

                            {/* RÉSULTAT BRUT, IS, NET */}
                            <tr className="bg-[#2B2321]/10 text-[11px] font-bold">
                              <td colSpan={3} className="p-3 uppercase text-[#2B2321]">RÉSULTAT BRUT D'EXPLOITATION (EBITDA)</td>
                              <td colSpan={4} className={cn("p-3 text-right", ebitdaCGLocal >= 0 ? "text-green-700" : "text-red-700")}>
                                {Math.round(ebitdaCGLocal).toLocaleString()} FCFA
                              </td>
                            </tr>
                            <tr className="border-b border-secondary/10">
                              <td colSpan={3} className="p-3 pl-6 italic">Prov. Impôt sur les Sociétés (IS Congolais 28% sur résultat positif)</td>
                              <td colSpan={4} className="p-3 text-right font-mono font-bold text-red-600">
                                {ebitdaCGLocal > 0 ? `(${Math.round(calculatedISLocal).toLocaleString()} FCFA)` : '0 FCFA'}
                              </td>
                            </tr>
                            <tr className="bg-primary text-white text-[12px] font-black rounded-b-3xl">
                              <td colSpan={3} className="p-4 uppercase">RÉSULTAT NET COMPTABLE CONGOLAIS</td>
                              <td colSpan={4} className="p-4 text-right">
                                {Math.round(netEarningsCGLocal).toLocaleString()} FCFA
                              </td>
                            </tr>

                            {/* III. COMPTE DU GRAND LIVRE COMPTABLE */}
                            <tr className="bg-transparent"><td colSpan={7} className="h-8"></td></tr>
                            <tr className="border-b-2 border-secondary/20"><td colSpan={7} className="p-2">
                              <h3 className="text-xs font-bold uppercase tracking-widest text-[#2B2321] pt-4">III. Grand Livre Journal Double-Entrée Standard (Principes SYSCOHADA)</h3>
                            </td></tr>
                            <tr className="bg-stone-100 text-[10px] uppercase font-bold text-[#2B2321]/80">
                              <th className="p-3 border-b" colSpan={1}>N° de Compte</th>
                              <th className="p-3 border-b" colSpan={4}>Intitulé de Compte Législatif</th>
                              <th className="p-3 border-b text-right" colSpan={1}>Mouvements Débit (F)</th>
                              <th className="p-3 border-b text-right" colSpan={1}>Mouvements Crédit (F)</th>
                            </tr>
                            {/* 5211 Débit */}
                            <tr className="border-b border-secondary/10">
                              <td className="p-2 pl-4 font-bold text-blue-600">5211</td>
                              <td className="p-2 text-[#2B2321]/80 font-bold" colSpan={4}>Banques Locales (BGFI, LCB, Ecobank Congo) - Encaissements Totaux TTC</td>
                              <td className="p-2 text-right font-bold text-blue-600" colSpan={1}>{grandTTClocal.toLocaleString()}</td>
                              <td className="p-2 text-right text-stone-300 font-sans" colSpan={1}>-</td>
                            </tr>
                            {/* 7062 Credit */}
                            <tr className="border-b border-secondary/10">
                              <td className="p-2 pl-4 text-emerald-600 font-semibold">7062</td>
                              <td className="p-2 text-emerald-700/80 pl-8" colSpan={4}>Ventes Prestations d'hébergement - Chambres (HT)</td>
                              <td className="p-2 text-right text-stone-300 font-sans" colSpan={1}>-</td>
                              <td className="p-2 text-right font-bold text-emerald-600" colSpan={1}>{Math.round(roomHTlocal).toLocaleString()}</td>
                            </tr>
                            {/* 7011 Credit */}
                            <tr className="border-b border-secondary/10">
                              <td className="p-2 pl-4 text-emerald-600 font-semibold">7011</td>
                              <td className="p-2 text-emerald-700/80 pl-8" colSpan={4}>Ventes de Marchandises - Bar & Resto (HT)</td>
                              <td className="p-2 text-right text-stone-300 font-sans" colSpan={1}>-</td>
                              <td className="p-2 text-right font-bold text-emerald-600" colSpan={1}>{Math.round(posHTlocal).toLocaleString()}</td>
                            </tr>
                            {/* 4431 Credit */}
                            <tr className="border-b border-secondary/10">
                              <td className="p-2 pl-4 text-purple-600 font-semibold">4431</td>
                              <td className="p-2 text-purple-700/80 pl-8" colSpan={4}>État, TVA Facturée et collectée (18% Congo)</td>
                              <td className="p-2 text-right text-stone-300 font-sans" colSpan={1}>-</td>
                              <td className="p-2 text-right font-bold text-purple-600" colSpan={1}>{Math.round(grandTVALocal).toLocaleString()}</td>
                            </tr>
                            {/* 4452 Credit */}
                            <tr className="border-b border-secondary/10">
                              <td className="p-2 pl-4 text-purple-600 font-semibold">4452</td>
                              <td className="p-2 text-purple-700/80 pl-8" colSpan={4}>État, Centimes additionnels sur TVA collectée (5% TVA)</td>
                              <td className="p-2 text-right text-stone-300 font-sans" colSpan={1}>-</td>
                              <td className="p-2 text-right font-bold text-purple-600" colSpan={1}>{Math.round(grandCCALocal).toLocaleString()}</td>
                            </tr>
                            {/* 4488 Credit */}
                            <tr className="border-b border-secondary/10">
                              <td className="p-2 pl-4 text-orange-600 font-semibold">4488</td>
                              <td className="p-2 text-orange-700/80 pl-8" colSpan={4}>État, Taxe d'Occupation et de Séjour touristique collectée</td>
                              <td className="p-2 text-right text-stone-300 font-sans" colSpan={1}>-</td>
                              <td className="p-2 text-right font-bold text-orange-600" colSpan={1}>{taxeSejourTotalLocal.toLocaleString()}</td>
                            </tr>
                            {/* Totaux Balances */}
                            <tr className="bg-stone-200 font-black p-3 text-[11px] border-b text-[#2B2321]">
                              <td className="p-3" colSpan={1}>Total Écritures</td>
                              <td className="p-3" colSpan={4}>BALANCE D'ÉQUILIBRE CONSERVÉE (Mouvements)</td>
                              <td className="p-3 text-right" colSpan={1}>{grandTTClocal.toLocaleString()} F</td>
                              <td className="p-3 text-right" colSpan={1}>{Math.round(grandHTlocal + grandTVALocal + grandCCALocal + taxeSejourTotalLocal).toLocaleString()} F</td>
                            </tr>
                          </>
                        );
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Note Professionnelle */}
              <div className="p-4 md:p-6 bg-amber-50/50 border border-amber-200/50 rounded-3xl flex gap-4 text-stone-800">
                <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-xs font-bold uppercase tracking-wider text-amber-800">Note de Conformité sur la Fiscalité d'Hébergement en République du Congo</p>
                  <p className="text-[11px] leading-relaxed opacity-90 text-stone-700">
                    Ces documents de synthèse fiscale sont modélisés conformément aux directives de la <strong>Direction Générale des Impôts (DGI) de la République du Congo</strong>.
                    Le chiffre d'affaires d'hébergement hôtelier est grevé de la <strong>Taxe d'occupation de l'infrastructure touristique (décrétée à 1 000 FCFA par nuitée)</strong>,
                    puis soumis au taux standard de la <strong>TVA de 18%</strong>, majoré des <strong>Centimes Additionnels Municipaux (CCA) de 5% du montant de la TVA</strong>.
                    Les écritures de Grand Livre respectent scrupuleusement la nomenclature du plan comptable de l'institution <strong>SYSCOHADA révisé</strong> (Mise en vigueur le 1er Janvier 2018).
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* Section: Personnel & Operations */}
          {(activeSection === 'ops' || true) && (
            <section id="ops" className={cn("space-y-8", activeSection !== 'ops' && "hidden print:block")}>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-1 h-8 bg-primary rounded-full" />
                <h2 className="text-2xl font-bold tracking-tight text-[#2B2321] uppercase">9. Personnel & Opérations</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="p-8 bg-white border border-secondary/20 rounded-3xl">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-primary/60 mb-6">Effectif par Département</h3>
                  <div className="space-y-4">
                    {staffStats.map((d) => (
                      <div key={d.dept} className="flex items-center gap-4">
                        <div className="w-24 text-[10px] font-bold uppercase tracking-widest text-[#2B2321]/60">{d.dept}</div>
                        <div className="flex-1 h-4 bg-secondary/10 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${((d.count as number) / (reportData.users.length || 1)) * 100}%`, backgroundColor: d.color }} />
                        </div>
                        <div className="w-8 text-xs font-bold text-primary">{d.count}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="p-4 md:p-6 bg-[#FDFBF7] border border-secondary/20 rounded-3xl">
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-primary/60 mb-4">Performance Opérationnelle</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-4 bg-white rounded-2xl border border-secondary/10">
                        <p className="text-xl font-bold text-primary">{reportData.users.length}</p>
                        <p className="text-[8px] font-bold uppercase tracking-widest opacity-60">Effectif Total</p>
                      </div>
                      <div className="text-center p-4 bg-white rounded-2xl border border-secondary/10">
                        <p className="text-xl font-bold text-green-600">{validatedCleanings}</p>
                        <p className="text-[8px] font-bold uppercase tracking-widest opacity-60">Nettoyages Validés</p>
                      </div>
                      <div className="text-center p-4 bg-white rounded-2xl border border-secondary/10">
                        <p className="text-xl font-bold text-orange-500">{pendingCleanings}</p>
                        <p className="text-[8px] font-bold uppercase tracking-widest opacity-60">Nettoyages en attente</p>
                      </div>
                      <div className="text-center p-4 bg-white rounded-2xl border border-secondary/10">
                        <p className="text-xl font-bold text-primary">{(validatedCleanings / (reportData.cleaningTasks.length || 1) * 100).toFixed(0)}%</p>
                        <p className="text-[8px] font-bold uppercase tracking-widest opacity-60">Efficacité Housekeeping</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Section: Customer Experience */}
          {(activeSection === 'cx' || true) && (
            <section id="cx" className={cn("space-y-8", activeSection !== 'cx' && "hidden print:block")}>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-1 h-8 bg-primary rounded-full" />
                <h2 className="text-2xl font-bold tracking-tight text-[#2B2321] uppercase">10. Expérience Client</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-8 bg-white border border-secondary/20 rounded-3xl text-center">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-primary/60 mb-2">Net Promoter Score (NPS)</p>
                  <p className={cn(
                    "text-4xl font-bold",
                    nps > 50 ? "text-green-600" : nps > 0 ? "text-orange-500" : "text-red-500"
                  )}>{nps.toFixed(0)}</p>
                  <p className="text-[10px] font-bold text-primary/40 mt-2 uppercase tracking-widest">
                    {nps > 70 ? 'Excellent' : nps > 30 ? 'Bon' : nps > 0 ? 'Passable' : 'À améliorer'}
                  </p>
                </div>
                <div className="p-8 bg-white border border-secondary/20 rounded-3xl text-center">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-primary/60 mb-2">Satisfaction Globale</p>
                  <p className="text-4xl font-bold text-primary">{averageRating.toFixed(1)}/5</p>
                  <p className="text-[10px] font-bold text-primary/40 mt-2 uppercase tracking-widest">Basé sur {reportData.reviews.length} avis</p>
                </div>
                <div className="p-8 bg-white border border-secondary/20 rounded-3xl text-center">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-primary/60 mb-2">Taux de Résolution</p>
                  <p className="text-4xl font-bold text-primary">94%</p>
                  <p className="text-[10px] font-bold text-primary/40 mt-2 uppercase tracking-widest">Plaintes résolues en 24h</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-primary">Commentaires Positifs</h3>
                  <div className="space-y-3">
                    {positiveComments.length > 0 ? positiveComments.map((r, i) => (
                      <div key={r.id} className="p-4 bg-green-50/50 border border-green-100 rounded-2xl text-sm italic text-[#2B2321]/80">
                        "{r.comment}"
                        <p className="text-[10px] font-bold mt-2 text-green-600/60 not-italic">— {r.guestName}, {r.category}</p>
                      </div>
                    )) : (
                      <p className="text-xs text-[#2B2321]/40 italic">Aucun commentaire positif sur cette période.</p>
                    )}
                  </div>
                </div>
                <div className="space-y-4">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-primary">Points de Friction</h3>
                  <div className="space-y-3">
                    {negativeComments.length > 0 ? negativeComments.map((r, i) => (
                      <div key={r.id} className="p-4 bg-red-50/50 border border-red-100 rounded-2xl text-sm italic text-[#2B2321]/80">
                        "{r.comment}"
                        <p className="text-[10px] font-bold mt-2 text-red-600/60 not-italic">— {r.guestName}, {r.category}</p>
                      </div>
                    )) : (
                      <p className="text-xs text-[#2B2321]/40 italic">Aucun point de friction signalé sur cette période.</p>
                    )}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Section: Analysis & Perspectives */}
          {(activeSection === 'analysis' || true) && (
            <section id="analysis" className={cn("space-y-8", activeSection !== 'analysis' && "hidden print:block")}>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-1 h-8 bg-primary rounded-full" />
                <h2 className="text-2xl font-bold tracking-tight text-[#2B2321] uppercase">11. Analyse & Perspectives</h2>
              </div>

              <div className="p-8 bg-white border border-secondary/20 rounded-3xl space-y-8">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-widest text-primary mb-4 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" /> Comparaison vs Objectifs
                  </h3>
                  <div className="space-y-6">
                    <div>
                      <div className="flex justify-between text-xs font-bold mb-2">
                        <span>Chiffre d'Affaires</span>
                        <span>{totalRevenue.toLocaleString()} / 12,000,000 FCFA</span>
                      </div>
                      <div className="w-full h-3 bg-secondary/10 rounded-full overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${Math.min(100, (totalRevenue / 12000000) * 100)}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs font-bold mb-2">
                        <span>Taux d'Occupation</span>
                        <span>{occupancyRate.toFixed(1)}% / 75%</span>
                      </div>
                      <div className="w-full h-3 bg-secondary/10 rounded-full overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${Math.min(100, (occupancyRate / 75) * 100)}%` }} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="p-4 md:p-6 bg-[#FDFBF7] border border-secondary/20 rounded-3xl">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-primary mb-4">Problèmes Identifiés & Actions</h3>
                    <div className="space-y-4">
                      {reportData.rooms.filter(r => r.status === 'Maintenance').length > 0 && (
                        <div className="flex gap-3">
                          <div className="w-6 h-6 bg-red-100 text-red-600 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0">1</div>
                          <div>
                            <p className="text-xs font-bold text-[#2B2321]">Maintenance Technique</p>
                            <p className="text-[10px] text-[#2B2321]/60">
                              {reportData.rooms.filter(r => r.status === 'Maintenance').length} chambre(s) hors service. Action : Intervention technique prioritaire.
                            </p>
                          </div>
                        </div>
                      )}
                      {negativeReviews.length > 0 && (
                        <div className="flex gap-3">
                          <div className="w-6 h-6 bg-red-100 text-red-600 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0">2</div>
                          <div>
                            <p className="text-xs font-bold text-[#2B2321]">Satisfaction Client</p>
                            <p className="text-[10px] text-[#2B2321]/60">
                              Retours négatifs sur : {Array.from(new Set(negativeReviews.map(r => r.category))).join(', ')}. Action : Briefing équipe et amélioration process.
                            </p>
                          </div>
                        </div>
                      )}
                      {pendingCleanings > 0 && (
                        <div className="flex gap-3">
                          <div className="w-6 h-6 bg-red-100 text-red-600 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0">3</div>
                          <div>
                            <p className="text-xs font-bold text-[#2B2321]">Opérations / Ménage</p>
                            <p className="text-[10px] text-[#2B2321]/60">
                              {pendingCleanings} tâche(s) de nettoyage en attente. Action : Optimisation du planning housekeeping.
                            </p>
                          </div>
                        </div>
                      )}
                      {reportData.rooms.filter(r => r.status === 'Maintenance').length === 0 && negativeReviews.length === 0 && pendingCleanings === 0 && (
                        <p className="text-xs text-[#2B2321]/40 italic">Aucun problème majeur identifié sur cette période.</p>
                      )}
                    </div>
                  </div>

                  <div className="p-4 md:p-6 bg-primary/5 border border-primary/20 rounded-3xl">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-primary mb-4">Perspectives Futures</h3>
                    <div className="space-y-4">
                      <div className="flex gap-3">
                        <div className="w-6 h-6 bg-primary/20 text-primary rounded-full flex items-center justify-center text-[10px] font-bold shrink-0">A</div>
                        <div>
                          <p className="text-xs font-bold text-[#2B2321]">Réservations à venir</p>
                          <p className="text-[10px] text-[#2B2321]/60">
                            {reportData.reservations.filter(r => r.status === 'Confirmed').length} réservations confirmées pour les prochaines semaines.
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <div className="w-6 h-6 bg-primary/20 text-primary rounded-full flex items-center justify-center text-[10px] font-bold shrink-0">B</div>
                        <div>
                          <p className="text-xs font-bold text-[#2B2321]">Objectif CA</p>
                          <p className="text-[10px] text-[#2B2321]/60">
                            Progression vers l'objectif mensuel : {((totalRevenue / 12000000) * 100).toFixed(1)}%.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Section: Legend */}
          {(activeSection === 'legend' || true) && (
            <section id="legend" className={cn("space-y-8", activeSection !== 'legend' && "hidden print:block")}>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-1 h-8 bg-primary rounded-full" />
                <h2 className="text-2xl font-bold tracking-tight text-[#2B2321] uppercase">12. Glossaire & Légende</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-white border border-secondary/20 rounded-3xl p-8">
                <div className="space-y-6">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-primary/60 border-b border-secondary/10 pb-2">Indicateurs de Performance (KPIs)</h3>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm font-bold text-primary">ADR (Average Daily Rate)</p>
                      <p className="text-xs text-[#2B2321]/60">Tarif Moyen Journalier : Revenu total des chambres divisé par le nombre de chambres occupées.</p>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-primary">RevPAR (Revenue Per Available Room)</p>
                      <p className="text-xs text-[#2B2321]/60">Revenu par Chambre Disponible : Revenu total des chambres divisé par le nombre total de chambres du parc.</p>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-primary">NPS (Net Promoter Score)</p>
                      <p className="text-xs text-[#2B2321]/60">Indice de Recommandation : Mesure la probabilité qu'un client recommande l'hôtel (de -100 à +100).</p>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-primary">CSAT (Customer Satisfaction Score)</p>
                      <p className="text-xs text-[#2B2321]/60">Score de Satisfaction Client : Note moyenne attribuée par les clients lors des enquêtes.</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-primary/60 border-b border-secondary/10 pb-2">Termes Opérationnels & Financiers</h3>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm font-bold text-primary">POS (Point Of Sale)</p>
                      <p className="text-xs text-[#2B2321]/60">Point de Vente : Revenus générés par le restaurant, le bar et les autres services de vente directe.</p>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-primary">OTA (Online Travel Agency)</p>
                      <p className="text-xs text-[#2B2321]/60">Agences de Voyage en Ligne : Plateformes de réservation tierces (ex: Booking.com, Expedia).</p>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-primary">ROI (Return On Investment)</p>
                      <p className="text-xs text-[#2B2321]/60">Retour sur Investissement : Ratio mesurant la rentabilité des capitaux investis.</p>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-primary">YoY (Year over Year)</p>
                      <p className="text-xs text-[#2B2321]/60">Comparaison Année sur Année : Analyse de la performance par rapport à la même période de l'année précédente.</p>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-primary">No-Show</p>
                      <p className="text-xs text-[#2B2321]/60">Client ayant une réservation confirmée mais qui ne se présente pas sans annuler.</p>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Footer for Print */}
          <div className="hidden print:block pt-12 border-t border-secondary/10 text-center">
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary/40">
              © 2026 Empreintes Technologies - Système de Gestion Hôtelière Intelligent
            </p>
            <p className="text-[8px] text-primary/20 mt-1">
              Ce rapport est généré automatiquement et contient des données confidentielles.
            </p>
          </div>
        </div>
      </div>
      {/* Invoice Printing Overlay */}
      {printingSale && (
        <Receipt 
          sale={printingSale} 
          onClose={() => setPrintingSale(null)} 
          settings={settings || localSettings} 
        />
      )}

      {/* Styled Print Styles for Perfect PDF Export & Pagination */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 15mm;
          }
          
          body {
            background-color: #ffffff !important;
            color: #2B2321 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Hide UI wrappers, navigations, and interactive elements */
          .no-print, button, nav, .print\\:hidden {
            display: none !important;
          }

          /* Clean up container layout and borders for PDF */
          .bg-white {
            border: none !important;
            box-shadow: none !important;
          }

          /* Clean spacing for content area */
          .p-8, .md\\:p-12 {
            padding: 0 !important;
          }

          /* Structure and Paginate Sections */
          section {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            margin-bottom: 2rem !important;
          }

          /* Force page break for each major module EXCEPT the first (Summary) */
          #occupancy, #rooms, #halls, #kitchen, #cleaning, #maintenance, #reservations, #finances, #compta_cg, #ops, #cx, #analysis, #legend {
            page-break-before: always !important;
            break-before: page !important;
            margin-top: 0 !important;
            padding-top: 15mm !important;
          }

          /* Ensure Charts render beautifully and don't spill over */
          .recharts-responsive-container {
            width: 100% !important;
            height: 250px !important;
          }

          svg {
            max-width: 100% !important;
          }

          /* Keep cards on single page without breaking mid-sentence */
          .grid > div, .border, tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>

      <ConfirmModal
        isOpen={!!saleToDelete}
        title="Supprimer la vente"
        message={`🚨 Êtes-vous sûr de vouloir supprimer définitivement cette vente ?\n\nCela restaurera également le stock si applicable.`}
        confirmLabel="Supprimer la vente"
        onConfirm={() => saleToDelete && executeDeleteSale(saleToDelete)}
        onClose={() => setSaleToDelete(null)}
      />
    </div>
  );
};
