import React, { useState, useEffect } from 'react';
import { Sale, Expense, Booking, AppSettings, ShishaSale } from '../types';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval, subMonths } from 'date-fns';
import { 
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, PieChart, Pie, Cell, Legend 
} from 'recharts';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { fr } from 'date-fns/locale';
import { 
  TrendingUp, TrendingDown, DollarSign, FileText, Download, Calendar, 
  Hotel, Utensils, Wine, Waves, Flame, Car, BarChart3, PieChart as PieIcon,
  ArrowUpRight, ArrowDownRight, Sparkles, Layers, CheckCircle2,
  Trophy, Medal, Award, Search, ArrowUpDown, SlidersHorizontal, Package, Eye
} from 'lucide-react';
import { handleFirestoreError, OperationType, parseDate } from '../lib/utils';
import { generatePDF } from '../lib/pdfUtils';
import * as XLSX from 'xlsx';

interface DepartmentConfig {
  id: 'hotel' | 'bar' | 'kitchen' | 'chicha';
  name: string;
  subtitle: string;
  icon: any;
  color: string;
  badgeBg: string;
  badgeText: string;
  border: string;
}

const DEPARTMENTS: DepartmentConfig[] = [
  {
    id: 'hotel',
    name: 'Hôtel & Résidences',
    subtitle: 'Chambres, Séjours & Salles',
    icon: Hotel,
    color: '#4F46E5', // Indigo
    badgeBg: 'bg-indigo-50',
    badgeText: 'text-indigo-700',
    border: 'border-indigo-200'
  },
  {
    id: 'bar',
    name: 'Bar & Boissons',
    subtitle: 'Terrasse, VIP & Comptoir',
    icon: Wine,
    color: '#D97706', // Amber
    badgeBg: 'bg-amber-50',
    badgeText: 'text-amber-700',
    border: 'border-amber-200'
  },
  {
    id: 'kitchen',
    name: 'Cuisine & Restaurant',
    subtitle: 'Nourriture & Repas',
    icon: Utensils,
    color: '#EA580C', // Orange
    badgeBg: 'bg-orange-50',
    badgeText: 'text-orange-700',
    border: 'border-orange-200'
  },
  {
    id: 'chicha',
    name: 'Espace Chicha VIP',
    subtitle: 'Narguilés & Recharges',
    icon: Flame,
    color: '#DC2626', // Red
    badgeBg: 'bg-red-50',
    badgeText: 'text-red-700',
    border: 'border-red-200'
  },
];

export const Stats = ({ sales, settings }: { sales: Sale[], settings?: AppSettings | null }) => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [shishaSales, setShishaSales] = useState<ShishaSale[]>([]);

  const [activeTab, setActiveTab] = useState<'comparative' | 'overview' | 'top_products'>('comparative');
  const [isDownloading, setIsDownloading] = useState(false);
  const [timeframe, setTimeframe] = useState<'day' | 'week' | 'month'>('month');
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  
  // Comparative Month Selection (YYYY-MM)
  const [comparisonMonth, setComparisonMonth] = useState<string>(format(new Date(), 'yyyy-MM'));

  // Top Products Filter States
  const [productPeriod, setProductPeriod] = useState<'day' | 'week' | 'month' | 'all'>('month');
  const [productMonth, setProductMonth] = useState<string>(format(new Date(), 'yyyy-MM'));
  const [productDate, setProductDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [productCategory, setProductCategory] = useState<string>('all');
  const [productSortBy, setProductSortBy] = useState<'quantity' | 'revenue'>('quantity');
  const [productSearch, setProductSearch] = useState<string>('');

  useEffect(() => {
    const expensesUnsub = onSnapshot(collection(db, 'expenses'), (snap) => {
      setExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() } as Expense)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'expenses'));

    const bookingsUnsub = onSnapshot(collection(db, 'bookings'), (snap) => {
      setBookings(snap.docs.map(d => ({ id: d.id, ...d.data() } as Booking)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'bookings'));

    const shishaUnsub = onSnapshot(collection(db, 'shisha_sales'), (snap) => {
      setShishaSales(snap.docs.map(d => ({ id: d.id, ...d.data() } as ShishaSale)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'shisha_sales'));

    return () => {
      expensesUnsub();
      bookingsUnsub();
      shishaUnsub();
    };
  }, []);

  // --- OVERVIEW CALCULATIONS ---
  const referenceDate = new Date(selectedDate);
  let periodStart = startOfMonth(referenceDate);
  let periodEnd = endOfMonth(referenceDate);
  let periodLabel = format(referenceDate, 'MMMM yyyy', { locale: fr });
  
  if (timeframe === 'day') {
    periodStart = startOfDay(referenceDate);
    periodEnd = endOfDay(referenceDate);
    periodLabel = format(referenceDate, 'EEEE d MMMM yyyy', { locale: fr });
  } else if (timeframe === 'week') {
    periodStart = startOfWeek(referenceDate, { weekStartsOn: 1 });
    periodEnd = endOfWeek(referenceDate, { weekStartsOn: 1 });
    periodLabel = `Du ${format(periodStart, 'dd/MM')} au ${format(periodEnd, 'dd/MM/yyyy')}`;
  }

  const periodSales = sales.filter(s => isWithinInterval(parseDate(s.timestamp), { start: periodStart, end: periodEnd }));
  const periodExpenses = expenses.filter(e => e.timestamp && isWithinInterval(parseDate(e.timestamp), { start: periodStart, end: periodEnd }));
  const periodBookings = bookings.filter(b => isWithinInterval(parseDate(b.checkOutDate || b.checkInDate || b.timestamp), { start: periodStart, end: periodEnd }));

  const salesBookingIds = new Set(sales.filter(s => s.bookingId).map(s => s.bookingId));
  const unrecordedPeriodBookings = periodBookings.filter(b => !salesBookingIds.has(b.id));

  const totalRevenue = periodSales.reduce((acc, s) => acc + s.totalPrice, 0) + 
                       unrecordedPeriodBookings.reduce((acc, b) => acc + (b.totalPaid || 0), 0);
  const totalExpenses = periodExpenses.reduce((acc, e) => acc + e.amount, 0);
  const netProfit = totalRevenue - totalExpenses;

  const salesByDate = [...periodSales, ...unrecordedPeriodBookings.map(b => ({ totalPrice: b.totalPaid || 0, timestamp: b.checkOutDate || b.timestamp }))].reduce((acc: any, item) => {
    const date = format(parseDate(item.timestamp), 'dd/MM');
    acc[date] = (acc[date] || 0) + item.totalPrice;
    return acc;
  }, {});

  const chartData = Object.entries(salesByDate)
    .map(([date, total]) => ({ date, total }))
    .sort((a: any, b: any) => a.date.localeCompare(b.date))
    .slice(-15);

  const paymentMethodData = [...periodSales, ...unrecordedPeriodBookings].reduce((acc: any, item: any) => {
    const method = item.paymentMethod || 'Cash';
    acc[method] = (acc[method] || 0) + (item.totalPrice || item.totalPaid || 0);
    return acc;
  }, {});

  const pieData = Object.entries(paymentMethodData).map(([name, value]) => ({ name, value }));

  // --- COMPARATIVE DEPARTMENTAL CALCULATIONS ---
  const currentMonthDate = new Date(`${comparisonMonth}-01T00:00:00`);
  const previousMonthDate = subMonths(currentMonthDate, 1);

  const currentMonthStart = startOfMonth(currentMonthDate);
  const currentMonthEnd = endOfMonth(currentMonthDate);

  const previousMonthStart = startOfMonth(previousMonthDate);
  const previousMonthEnd = endOfMonth(previousMonthDate);

  const currentMonthLabel = format(currentMonthDate, 'MMMM yyyy', { locale: fr });
  const previousMonthLabel = format(previousMonthDate, 'MMMM yyyy', { locale: fr });

  const getDepartmentTotals = (start: Date, end: Date) => {
    let hotel = 0;
    let bar = 0;
    let kitchen = 0;
    let chicha = 0;

    // 1. Hotel Bookings: Only count bookings that do not already have a checkout sale in the sales collection
    const deptSalesBookingIds = new Set(sales.filter(s => s.bookingId).map(s => s.bookingId));
    bookings.forEach(b => {
      if (!deptSalesBookingIds.has(b.id)) {
        const d = parseDate(b.checkOutDate || b.checkInDate || b.timestamp);
        if (isWithinInterval(d, { start, end })) {
          hotel += (b.totalPaid || 0);
        }
      }
    });

    // Track sourceIds to avoid double counting if mirror sales exist in sales collection
    const salesSourceIds = new Set(sales.filter(s => s.sourceId).map(s => s.sourceId));

    // 2. Shisha Sales
    shishaSales.forEach(ss => {
      if (!salesSourceIds.has(ss.id)) {
        const d = parseDate(ss.timestamp);
        if (isWithinInterval(d, { start, end })) {
          chicha += (ss.totalAmount || 0);
        }
      }
    });

    // 3. Global Sales breakdown
    sales.forEach(s => {
      const d = parseDate(s.timestamp);
      if (!isWithinInterval(d, { start, end })) return;

      if (s.items && s.items.length > 0) {
        s.items.forEach(item => {
          const amount = (item.price * item.quantity) || item.total || 0;
          const cat = (item.category || '').toLowerCase();
          const pName = (item.productName || '').toLowerCase();
          const loc = (s.location || '').toLowerCase();

          if (loc === 'chicha' || cat === 'chicha' || pName.includes('chicha') || pName.includes('shisha')) {
            chicha += amount;
          } else if (cat === 'cuisine' || cat === 'nourriture' || loc === 'restaurant' || s.kitchenStatus) {
            kitchen += amount;
          } else if (cat === 'boisson' || cat === 'bar' || loc === 'terrasse' || loc === 'vip' || loc === 'bar') {
            bar += amount;
          } else if (loc === 'réception' || cat === 'hôtel' || cat === 'salle' || pName.includes('chambre') || pName.includes('salle')) {
            hotel += amount;
          } else {
            bar += amount;
          }
        });
      } else {
        const amount = s.totalPrice || 0;
        const loc = (s.location || '').toLowerCase();
        if (loc === 'chicha') chicha += amount;
        else if (loc === 'restaurant') kitchen += amount;
        else if (loc === 'réception') hotel += amount;
        else bar += amount;
      }
    });

    return { hotel, bar, kitchen, chicha };
  };

  const currentMonthTotals = getDepartmentTotals(currentMonthStart, currentMonthEnd);
  const previousMonthTotals = getDepartmentTotals(previousMonthStart, previousMonthEnd);

  const totalRevenueCurrentMonth = Object.values(currentMonthTotals).reduce((a, b) => a + b, 0);
  const totalRevenuePreviousMonth = Object.values(previousMonthTotals).reduce((a, b) => a + b, 0);

  const globalDiff = totalRevenueCurrentMonth - totalRevenuePreviousMonth;
  const globalGrowthPercent = totalRevenuePreviousMonth === 0 
    ? (totalRevenueCurrentMonth > 0 ? 100 : 0)
    : Math.round(((totalRevenueCurrentMonth - totalRevenuePreviousMonth) / totalRevenuePreviousMonth) * 100);

  const departmentComparisonList = DEPARTMENTS.map(dept => {
    const cur = currentMonthTotals[dept.id] || 0;
    const prev = previousMonthTotals[dept.id] || 0;
    const diff = cur - prev;
    
    let growth = 0;
    if (prev === 0) {
      growth = cur > 0 ? 100 : 0;
    } else {
      growth = Math.round(((cur - prev) / prev) * 100);
    }

    const share = totalRevenueCurrentMonth > 0 ? Math.round((cur / totalRevenueCurrentMonth) * 100) : 0;

    return {
      ...dept,
      currentRevenue: cur,
      previousRevenue: prev,
      diff,
      growthPercent: growth,
      sharePercent: share
    };
  });

  // Data for Recharts Grouped Bar Chart
  const barChartData = departmentComparisonList.map(d => ({
    name: d.name.split(' ')[0],
    deptName: d.name,
    [currentMonthLabel]: d.currentRevenue,
    [previousMonthLabel]: d.previousRevenue
  }));

  // Data for Department Revenue Share Donut Chart
  const deptPieData = departmentComparisonList
    .filter(d => d.currentRevenue > 0)
    .map(d => ({
      name: d.name,
      value: d.currentRevenue,
      color: d.color
    }));

  // --- TOP PRODUCTS ANALYSIS CALCULATIONS ---
  let prodStart: Date;
  let prodEnd: Date;
  let prodPeriodLabel: string;

  const productRefDate = new Date(productDate);
  if (productPeriod === 'day') {
    prodStart = startOfDay(productRefDate);
    prodEnd = endOfDay(productRefDate);
    prodPeriodLabel = format(productRefDate, 'd MMMM yyyy', { locale: fr });
  } else if (productPeriod === 'week') {
    prodStart = startOfWeek(productRefDate, { weekStartsOn: 1 });
    prodEnd = endOfWeek(productRefDate, { weekStartsOn: 1 });
    prodPeriodLabel = `Semaine du ${format(prodStart, 'dd/MM')} au ${format(prodEnd, 'dd/MM/yyyy')}`;
  } else if (productPeriod === 'month') {
    const d = new Date(`${productMonth}-01T00:00:00`);
    prodStart = startOfMonth(d);
    prodEnd = endOfMonth(d);
    prodPeriodLabel = format(d, 'MMMM yyyy', { locale: fr });
  } else {
    // 'all'
    prodStart = new Date(2020, 0, 1);
    prodEnd = new Date(2035, 11, 31);
    prodPeriodLabel = "Tout l'historique";
  }

  const productStatsMap = new Map<string, {
    id: string;
    name: string;
    category: string;
    quantitySold: number;
    totalRevenue: number;
    orderCount: number;
    locations: Record<string, number>;
  }>();

  sales.forEach(sale => {
    const saleDate = parseDate(sale.timestamp);
    if (productPeriod !== 'all' && !isWithinInterval(saleDate, { start: prodStart, end: prodEnd })) {
      return;
    }

    const loc = sale.location || 'Terrasse';

    if (sale.items && sale.items.length > 0) {
      sale.items.forEach(item => {
        const cat = (item.category || 'Général').trim();
        const lowerCat = cat.toLowerCase();
        const pName = (item.productName || 'Article').trim();
        const lowerName = pName.toLowerCase();
        const pId = item.productId || pName;

        // Exclure formellement la catégorie "Hébergement" (nuitées, chambres, séjours) de l'analyse des produits vendus
        if (
          lowerCat === 'hébergement' ||
          lowerCat === 'hebergement' ||
          lowerCat.includes('héberg') ||
          lowerCat.includes('heberg') ||
          pId === 'room_stay' ||
          pId === 'room_advance' ||
          lowerName.includes('séjour chambre') ||
          lowerName.includes('sejour chambre') ||
          lowerName.includes('avance hébergement') ||
          lowerName.includes('avance hebergement') ||
          lowerName.startsWith('chambre #') ||
          lowerName.startsWith('chambre n°')
        ) {
          return;
        }

        const qty = Number(item.quantity || 1);
        const price = Number(item.price || 0);
        const rev = (price * qty) || Number(item.total || 0);

        const existing = productStatsMap.get(pName) || {
          id: pId,
          name: pName,
          category: cat,
          quantitySold: 0,
          totalRevenue: 0,
          orderCount: 0,
          locations: {}
        };

        existing.quantitySold += qty;
        existing.totalRevenue += rev;
        existing.orderCount += 1;
        existing.locations[loc] = (existing.locations[loc] || 0) + qty;
        if (existing.category === 'Général' && cat !== 'Général') {
          existing.category = cat;
        }

        productStatsMap.set(pName, existing);
      });
    }
  });

  const allProductStatsList = Array.from(productStatsMap.values());
  const totalTopProductsQuantity = allProductStatsList.reduce((acc, p) => acc + p.quantitySold, 0);
  const totalTopProductsRevenue = allProductStatsList.reduce((acc, p) => acc + p.totalRevenue, 0);

  const enrichedProductStats = allProductStatsList.map(p => {
    let primaryLoc = 'Terrasse';
    let maxQty = 0;
    Object.entries(p.locations).forEach(([l, q]) => {
      if (q > maxQty) {
        maxQty = q;
        primaryLoc = l;
      }
    });

    return {
      ...p,
      averagePrice: p.quantitySold > 0 ? Math.round(p.totalRevenue / p.quantitySold) : 0,
      revenueSharePercent: totalTopProductsRevenue > 0 ? Number(((p.totalRevenue / totalTopProductsRevenue) * 100).toFixed(1)) : 0,
      volumeSharePercent: totalTopProductsQuantity > 0 ? Number(((p.quantitySold / totalTopProductsQuantity) * 100).toFixed(1)) : 0,
      primaryLocation: primaryLoc
    };
  });

  const availableProductCategories = Array.from(new Set(allProductStatsList.map(p => p.category)))
    .filter(cat => {
      if (!cat) return false;
      const lower = cat.toLowerCase();
      return !lower.includes('héberg') && !lower.includes('heberg');
    });

  const filteredTopProducts = enrichedProductStats
    .filter(p => {
      const pCat = p.category.toLowerCase();
      if (pCat.includes('héberg') || pCat.includes('heberg')) {
        return false;
      }
      if (productCategory !== 'all' && p.category.toLowerCase() !== productCategory.toLowerCase()) {
        return false;
      }
      if (productSearch.trim()) {
        const q = productSearch.toLowerCase();
        return p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q);
      }
      return true;
    })
    .sort((a, b) => {
      if (productSortBy === 'quantity') {
        return b.quantitySold - a.quantitySold;
      } else {
        return b.totalRevenue - a.totalRevenue;
      }
    });

  const top10ProductChartData = filteredTopProducts.slice(0, 10).map(p => ({
    name: p.name.length > 16 ? p.name.slice(0, 14) + '…' : p.name,
    fullName: p.name,
    quantite: p.quantitySold,
    revenu: p.totalRevenue,
    category: p.category
  }));

  const maxProductQuantity = filteredTopProducts.length > 0 ? Math.max(...filteredTopProducts.map(p => p.quantitySold)) : 1;

  const top1Product = filteredTopProducts[0];
  const top2Product = filteredTopProducts[1];
  const top3Product = filteredTopProducts[2];

  // --- PDF & EXCEL EXPORTS ---
  const handleDownloadPDF = () => {
    setIsDownloading(true);
    try {
      if (activeTab === 'comparative') {
        const columns = ['Département', `CA ${previousMonthLabel} (FCFA)`, `CA ${currentMonthLabel} (FCFA)`, 'Écart (FCFA)', 'Variation (%)', 'Part du CA'];
        const rows = departmentComparisonList.map(d => [
          d.name,
          d.previousRevenue.toLocaleString(),
          d.currentRevenue.toLocaleString(),
          (d.diff >= 0 ? `+${d.diff.toLocaleString()}` : d.diff.toLocaleString()),
          `${d.growthPercent >= 0 ? '+' : ''}${d.growthPercent}%`,
          `${d.sharePercent}%`
        ]);

        rows.push([
          'TOTAL GÉNÉRAL',
          totalRevenuePreviousMonth.toLocaleString(),
          totalRevenueCurrentMonth.toLocaleString(),
          (globalDiff >= 0 ? `+${globalDiff.toLocaleString()}` : globalDiff.toLocaleString()),
          `${globalGrowthPercent >= 0 ? '+' : ''}${globalGrowthPercent}%`,
          '100%'
        ]);

        generatePDF({
          title: `Comparatif du Chiffre d'Affaires par Département (${currentMonthLabel} vs ${previousMonthLabel})`,
          filename: `Comparatif_CA_${comparisonMonth}`,
          columns,
          rows,
          settings,
          orientation: 'l'
        });
      } else if (activeTab === 'top_products') {
        const columns = ['Rang', 'Produit', 'Catégorie', 'Qté Vendue', 'Prix Moyen', 'CA (FCFA)', 'Part du CA'];
        const rows = filteredTopProducts.slice(0, 30).map((p, idx) => [
          `#${idx + 1}`,
          p.name,
          p.category,
          p.quantitySold.toString(),
          `${p.averagePrice.toLocaleString()} FCFA`,
          `${p.totalRevenue.toLocaleString()} FCFA`,
          `${p.revenueSharePercent}%`
        ]);

        generatePDF({
          title: `Palmarès des Produits les Plus Vendus (${prodPeriodLabel})`,
          filename: `Top_Produits_${productMonth}`,
          columns,
          rows,
          settings
        });
      } else {
        const columns = ['Catégorie', 'Détails', 'Montant (FCFA)'];
        const rows = [
          ['Revenus Ventes', `${periodSales.length} ventes`, periodSales.reduce((acc, s) => acc + s.totalPrice, 0).toLocaleString()],
          ['Revenus Hôtel', `${periodBookings.length} séjours`, periodBookings.reduce((acc, b) => acc + b.totalPaid, 0).toLocaleString()],
          ['Dépenses Totales', `${periodExpenses.length} transactions`, totalExpenses.toLocaleString()],
          ['Bénéfice Net', '-', netProfit.toLocaleString()]
        ];

        generatePDF({
          title: `Rapport Financier - ${periodLabel}`,
          filename: 'Rapport_Financier',
          columns,
          rows,
          settings
        });
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  const exportSalesToExcel = () => {
    if (activeTab === 'comparative') {
      const data = departmentComparisonList.map(d => ({
        'Département': d.name,
        [`CA ${previousMonthLabel} (FCFA)`]: d.previousRevenue,
        [`CA ${currentMonthLabel} (FCFA)`]: d.currentRevenue,
        'Écart (FCFA)': d.diff,
        'Variation (%)': `${d.growthPercent}%`,
        'Part du CA (%)': `${d.sharePercent}%`
      }));

      data.push({
        'Département': 'TOTAL GÉNÉRAL',
        [`CA ${previousMonthLabel} (FCFA)`]: totalRevenuePreviousMonth,
        [`CA ${currentMonthLabel} (FCFA)`]: totalRevenueCurrentMonth,
        'Écart (FCFA)': globalDiff,
        'Variation (%)': `${globalGrowthPercent}%`,
        'Part du CA (%)': '100%'
      });

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Comparatif Départements");
      XLSX.writeFile(wb, `Comparatif_CA_${comparisonMonth}.xlsx`);
    } else if (activeTab === 'top_products') {
      const data = filteredTopProducts.map((p, idx) => ({
        'Rang': idx + 1,
        'Produit': p.name,
        'Catégorie': p.category,
        'Quantité Vendue': p.quantitySold,
        'Prix Moyen (FCFA)': p.averagePrice,
        'Chiffre d\'Affaires (FCFA)': p.totalRevenue,
        'Part du CA (%)': `${p.revenueSharePercent}%`,
        'Part du Volume (%)': `${p.volumeSharePercent}%`,
        'Commandes / Tickets': p.orderCount,
        'Lieu Principal': p.primaryLocation
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Top Produits");
      XLSX.writeFile(wb, `Top_Produits_${productMonth}.xlsx`);
    } else {
      const data = periodSales.flatMap(s => 
        s.items.map(item => ({
          'Date': format(parseDate(s.timestamp), 'dd/MM/yyyy HH:mm'),
          'Produit': item.productName,
          'Quantité': item.quantity,
          'Prix Unitaire': item.price,
          'Total Item': item.price * item.quantity,
          'Paiement': s.paymentMethod,
          'Vendeur': `${s.sellerName}${s.sellerRole ? ` (${s.sellerRole})` : ''}`
        }))
      );
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Ventes");
      XLSX.writeFile(wb, `Ventes_${format(new Date(), 'MMMM_yyyy')}.xlsx`);
    }
  };

  const COLORS = ['var(--primary-color)', 'var(--secondary-color)', '#2B2321', '#8BA888', 'var(--accent-color)'];

  return (
    <div className="space-y-8">
      {/* Header & Main Navigation Tabs */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 border-b border-secondary/20 pb-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[#2B2321] uppercase flex items-center gap-3">
            <BarChart3 className="w-7 h-7 text-primary" />
            Analyse Financière & Statistiques
          </h2>
          <p className="text-xs text-[#2B2321]/60 mt-1">
            Indicateurs de performance, comparaison inter-départements et chiffre d'affaires
          </p>
        </div>

        {/* Sub-Tabs Switcher */}
        <div className="flex bg-[#FDFBF7] p-1.5 rounded-2xl border border-secondary/30 shadow-xs flex-wrap gap-1">
          <button
            onClick={() => setActiveTab('comparative')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === 'comparative' 
                ? 'bg-primary text-white shadow-md shadow-primary/20 font-black' 
                : 'text-primary/70 hover:text-primary hover:bg-white/50'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Comparatif Départements</span>
          </button>
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === 'overview' 
                ? 'bg-primary text-white shadow-md shadow-primary/20 font-black' 
                : 'text-primary/70 hover:text-primary hover:bg-white/50'
            }`}
          >
            <PieIcon className="w-4 h-4" />
            <span>Vue Financière Globale</span>
          </button>
          <button
            onClick={() => setActiveTab('top_products')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === 'top_products' 
                ? 'bg-primary text-white shadow-md shadow-primary/20 font-black' 
                : 'text-primary/70 hover:text-primary hover:bg-white/50'
            }`}
          >
            <Trophy className={`w-4 h-4 ${activeTab === 'top_products' ? 'text-amber-300' : 'text-amber-500'}`} />
            <span>Produits les Plus Vendus</span>
          </button>
        </div>
      </div>

      {/* TAB 1: COMPARATIF DU CHIFFRE D'AFFAIRES PAR DÉPARTEMENT */}
      {activeTab === 'comparative' && (
        <div className="space-y-8">
          {/* Controls Bar */}
          <div className="bg-white border border-secondary/30 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 text-primary rounded-2xl">
                <Calendar className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-primary/60">Mois de Référence à Comparer</p>
                <input 
                  type="month"
                  value={comparisonMonth}
                  onChange={(e) => e.target.value && setComparisonMonth(e.target.value)}
                  className="mt-1 font-extrabold text-lg text-[#2B2321] bg-[#FDFBF7] border border-secondary/30 rounded-xl px-3 py-1.5 outline-none focus:border-primary cursor-pointer"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                <span className="text-xs font-bold text-amber-900">
                  Comparaison : <strong className="uppercase">{currentMonthLabel}</strong> 🆚 <strong className="uppercase">{previousMonthLabel}</strong>
                </span>
              </div>

              <button 
                onClick={handleDownloadPDF}
                disabled={isDownloading}
                className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl font-bold text-xs hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
              >
                {isDownloading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <FileText className="w-4 h-4" />
                )}
                Rapport PDF
              </button>

              <button 
                onClick={exportSalesToExcel}
                className="flex items-center gap-2 px-4 py-2.5 bg-white border border-secondary/30 text-emerald-600 rounded-xl font-bold text-xs hover:bg-emerald-50/50 transition-all shadow-xs"
              >
                <Download className="w-4 h-4" />
                Excel
              </button>
            </div>
          </div>

          {/* Executive Global Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 bg-white border border-secondary/30 rounded-3xl shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-widest text-primary/60 mb-2">
                CA Total - {currentMonthLabel}
              </p>
              <p className="text-2xl sm:text-3xl font-black text-[#2B2321]">
                {totalRevenueCurrentMonth.toLocaleString()} <span className="text-xs opacity-60">FCFA</span>
              </p>
              <p className="text-[10px] text-primary/60 font-bold mt-2">
                Somme de tous les départements pour le mois en cours
              </p>
            </div>

            <div className="p-6 bg-white border border-secondary/30 rounded-3xl shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-widest text-primary/60 mb-2">
                CA Total - {previousMonthLabel}
              </p>
              <p className="text-2xl sm:text-3xl font-black text-[#2B2321]/80">
                {totalRevenuePreviousMonth.toLocaleString()} <span className="text-xs opacity-60">FCFA</span>
              </p>
              <p className="text-[10px] text-primary/60 font-bold mt-2">
                Chiffre d'affaires réalisé le mois précédent
              </p>
            </div>

            <div className={`p-6 rounded-3xl border shadow-xl text-white ${
              globalDiff >= 0 
                ? 'bg-gradient-to-br from-emerald-700 to-emerald-900 border-emerald-600 shadow-emerald-900/20' 
                : 'bg-gradient-to-br from-red-700 to-red-900 border-red-600 shadow-red-900/20'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Variation Inter-Mois Global</p>
                {globalDiff >= 0 ? (
                  <span className="px-2.5 py-1 bg-white/20 text-white rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                    <ArrowUpRight className="w-3.5 h-3.5" /> Progression
                  </span>
                ) : (
                  <span className="px-2.5 py-1 bg-white/20 text-white rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                    <ArrowDownRight className="w-3.5 h-3.5" /> Recul
                  </span>
                )}
              </div>
              <p className="text-2xl sm:text-3xl font-black">
                {globalDiff >= 0 ? `+${globalDiff.toLocaleString()}` : globalDiff.toLocaleString()} <span className="text-xs opacity-80">FCFA</span>
              </p>
              <p className="text-xs font-black mt-2 opacity-90">
                Taux de croissance global : {globalGrowthPercent >= 0 ? `+${globalGrowthPercent}%` : `${globalGrowthPercent}%`}
              </p>
            </div>
          </div>

          {/* Department Cards Grid (6 Departments) */}
          <div className="space-y-4">
            <h3 className="text-lg font-extrabold text-[#2B2321] uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-5 h-5 text-primary" />
              Chiffre d'Affaires par Département (Mois M vs Mois M-1)
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {departmentComparisonList.map((dept) => {
                const Icon = dept.icon;
                const isPositive = dept.diff >= 0;

                return (
                  <div 
                    key={dept.id}
                    className="bg-white border border-secondary/30 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-5"
                  >
                    <div>
                      {/* Department Header */}
                      <div className="flex items-start justify-between gap-3 border-b border-secondary/15 pb-4">
                        <div className="flex items-center gap-3">
                          <div className={`p-3 rounded-2xl ${dept.badgeBg} text-slate-800`}>
                            <Icon className="w-6 h-6" style={{ color: dept.color }} />
                          </div>
                          <div>
                            <h4 className="font-black text-base text-[#2B2321]">{dept.name}</h4>
                            <p className="text-[10px] text-primary/60 font-bold uppercase tracking-wider">{dept.subtitle}</p>
                          </div>
                        </div>

                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1 border ${
                          isPositive 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                            : 'bg-red-50 text-red-700 border-red-200'
                        }`}>
                          {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {isPositive ? `+${dept.growthPercent}%` : `${dept.growthPercent}%`}
                        </span>
                      </div>

                      {/* Financial Metrics */}
                      <div className="mt-4 space-y-3">
                        <div className="p-3 bg-[#FDFBF7] rounded-2xl border border-secondary/20 flex justify-between items-center">
                          <div>
                            <p className="text-[9px] font-black uppercase tracking-wider text-primary/60">
                              {currentMonthLabel} (M)
                            </p>
                            <p className="font-extrabold text-lg text-[#2B2321] mt-0.5">
                              {dept.currentRevenue.toLocaleString()} <span className="text-[10px] opacity-60">FCFA</span>
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-[9px] font-black uppercase tracking-wider text-primary/60">
                              {previousMonthLabel} (M-1)
                            </p>
                            <p className="font-bold text-sm text-[#2B2321]/70 mt-0.5">
                              {dept.previousRevenue.toLocaleString()} <span className="text-[10px] opacity-60">FCFA</span>
                            </p>
                          </div>
                        </div>

                        {/* Difference row */}
                        <div className="flex justify-between items-center px-1 text-xs font-bold">
                          <span className="text-primary/60 uppercase tracking-wider text-[10px]">Écart Absolu (FCFA) :</span>
                          <span className={`font-black ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
                            {isPositive ? `+${dept.diff.toLocaleString()}` : dept.diff.toLocaleString()} FCFA
                          </span>
                        </div>

                        {/* Share of Total Revenue Bar */}
                        <div className="space-y-1 pt-1">
                          <div className="flex justify-between items-center text-[10px] font-bold">
                            <span className="text-primary/60 uppercase tracking-wider">Part du CA Global :</span>
                            <span className="text-primary font-black">{dept.sharePercent}%</span>
                          </div>
                          <div className="w-full bg-secondary/20 h-2 rounded-full overflow-hidden">
                            <div 
                              className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${dept.sharePercent}%`, backgroundColor: dept.color }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="text-[10px] font-bold text-primary/50 text-center uppercase tracking-widest pt-2 border-t border-secondary/10">
                      {dept.currentRevenue > dept.previousRevenue 
                        ? `En hausse de ${dept.diff.toLocaleString()} FCFA par rapport à ${previousMonthLabel}`
                        : dept.currentRevenue === dept.previousRevenue
                          ? 'Stabilité parfaite par rapport au mois dernier'
                          : `En baisse de ${Math.abs(dept.diff).toLocaleString()} FCFA par rapport à ${previousMonthLabel}`
                      }
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Visual Charts: Bar Comparison & Pie Share */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Grouped Bar Chart */}
            <div className="lg:col-span-2 p-6 bg-white border border-secondary/30 shadow-sm rounded-3xl space-y-4">
              <div className="flex justify-between items-center border-b border-secondary/15 pb-4">
                <div>
                  <h3 className="text-base font-extrabold text-[#2B2321] uppercase tracking-wider">
                    Comparaison Visuelle par Département
                  </h3>
                  <p className="text-[10px] text-primary/60 font-bold uppercase tracking-wider">
                    Analyse côte à côte : {currentMonthLabel} vs {previousMonthLabel}
                  </p>
                </div>
              </div>

              <div className="w-full" style={{ minHeight: 300 }}>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={barChartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--secondary-color)" strokeOpacity={0.3} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#2B2321', fontWeight: 'bold' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: 'var(--primary-color)' }} tickFormatter={(v) => `${v/1000}k`} />
                    <Tooltip 
                      formatter={(value: any) => [`${Number(value).toLocaleString()} FCFA`, '']}
                      contentStyle={{ border: 'none', borderRadius: '16px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.15)', fontSize: '11px', fontWeight: 'bold' }} 
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 'bold', paddingTop: '10px' }} />
                    <Bar dataKey={currentMonthLabel} fill="var(--primary-color)" radius={[8, 8, 0, 0]} name={`${currentMonthLabel} (M)`} />
                    <Bar dataKey={previousMonthLabel} fill="#D97706" radius={[8, 8, 0, 0]} name={`${previousMonthLabel} (M-1)`} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Department Revenue Share Donut Chart */}
            <div className="p-6 bg-white border border-secondary/30 shadow-sm rounded-3xl space-y-4 flex flex-col justify-between">
              <div>
                <h3 className="text-base font-extrabold text-[#2B2321] uppercase tracking-wider">
                  Répartition du CA ({currentMonthLabel})
                </h3>
                <p className="text-[10px] text-primary/60 font-bold uppercase tracking-wider">
                  Contribution de chaque pôle d'activité
                </p>

                <div className="w-full mt-4" style={{ minHeight: 220 }}>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={deptPieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {deptPieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: any) => `${Number(v).toLocaleString()} FCFA`} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-secondary/15">
                {deptPieData.map(item => (
                  <div key={item.name} className="flex items-center justify-between text-xs font-bold">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="text-[#2B2321] text-[11px] truncate max-w-[130px]">{item.name}</span>
                    </div>
                    <span className="text-primary font-black">{item.value.toLocaleString()} FCFA</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Detailed Summary Table */}
          <div className="bg-white border border-secondary/30 shadow-sm rounded-3xl overflow-hidden">
            <div className="p-6 bg-[#FDFBF7] border-b border-secondary/30 flex justify-between items-center">
              <div>
                <h3 className="font-black text-base text-[#2B2321] uppercase tracking-wider">
                  Tableau Synthétique Comparatif par Département
                </h3>
                <p className="text-[10px] text-primary/60 font-bold uppercase tracking-wider mt-0.5">
                  Bilan comparatif chiffré ({currentMonthLabel} vs {previousMonthLabel})
                </p>
              </div>

              <span className="px-3 py-1 bg-primary/10 text-primary font-bold text-xs rounded-xl uppercase tracking-wider">
                {departmentComparisonList.length} Départements
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-[#FDFBF7]/60 text-primary/70 border-b border-secondary/20 text-[10px] uppercase font-black tracking-widest">
                    <th className="p-4">Département</th>
                    <th className="p-4 text-right">CA {previousMonthLabel} (M-1)</th>
                    <th className="p-4 text-right">CA {currentMonthLabel} (M)</th>
                    <th className="p-4 text-right">Écart Absolu (FCFA)</th>
                    <th className="p-4 text-center">Croissance (%)</th>
                    <th className="p-4 text-center">Part du CA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-secondary/10 font-bold text-[#2B2321]">
                  {departmentComparisonList.map((d) => (
                    <tr key={d.id} className="hover:bg-[#FDFBF7] transition-colors">
                      <td className="p-4 flex items-center gap-3">
                        <div className={`p-2 rounded-xl ${d.badgeBg}`}>
                          <d.icon className="w-4 h-4" style={{ color: d.color }} />
                        </div>
                        <div>
                          <p className="font-extrabold text-sm">{d.name}</p>
                          <p className="text-[9px] text-primary/60 font-bold uppercase">{d.subtitle}</p>
                        </div>
                      </td>
                      <td className="p-4 text-right text-primary/80 font-bold">
                        {d.previousRevenue.toLocaleString()} FCFA
                      </td>
                      <td className="p-4 text-right text-primary font-black text-sm">
                        {d.currentRevenue.toLocaleString()} FCFA
                      </td>
                      <td className={`p-4 text-right font-black ${d.diff >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {d.diff >= 0 ? `+${d.diff.toLocaleString()}` : d.diff.toLocaleString()} FCFA
                      </td>
                      <td className="p-4 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1 border ${
                          d.diff >= 0 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                            : 'bg-red-50 text-red-700 border-red-200'
                        }`}>
                          {d.diff >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {d.diff >= 0 ? `+${d.growthPercent}%` : `${d.growthPercent}%`}
                        </span>
                      </td>
                      <td className="p-4 text-center font-black text-primary">
                        {d.sharePercent}%
                      </td>
                    </tr>
                  ))}
                  {/* Total Row */}
                  <tr className="bg-primary/5 font-black text-[#2B2321] border-t-2 border-primary/20 text-sm">
                    <td className="p-4 uppercase tracking-wider">TOTAL GÉNÉRAL INTER-DÉPARTEMENTS</td>
                    <td className="p-4 text-right text-primary/80">{totalRevenuePreviousMonth.toLocaleString()} FCFA</td>
                    <td className="p-4 text-right text-primary font-black text-base">{totalRevenueCurrentMonth.toLocaleString()} FCFA</td>
                    <td className={`p-4 text-right ${globalDiff >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                      {globalDiff >= 0 ? `+${globalDiff.toLocaleString()}` : globalDiff.toLocaleString()} FCFA
                    </td>
                    <td className="p-4 text-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider inline-flex items-center gap-1 border ${
                        globalDiff >= 0 
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
                          : 'bg-red-100 text-red-800 border-red-300'
                      }`}>
                        {globalGrowthPercent >= 0 ? `+${globalGrowthPercent}%` : `${globalGrowthPercent}%`}
                      </span>
                    </td>
                    <td className="p-4 text-center font-black">100%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: VUE FINANCIÈRE GLOBALE (OVERVIEW) */}
      {activeTab === 'overview' && (
        <div className="space-y-8">
          <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-white border border-secondary/30 rounded-3xl p-6 shadow-sm">
            <div>
              <h3 className="text-lg font-bold text-[#2B2321] uppercase">Aperçu Financier Global</h3>
              <p className="text-xs text-[#2B2321]/60 mt-1">Solde des revenus, dépenses et bénéfice net par période</p>
            </div>

            <div className="flex flex-wrap items-center gap-2 md:gap-4">
              <div className="flex items-center bg-[#FDFBF7] border border-secondary/30 rounded-xl px-3 h-[38px]">
                <Calendar className="w-4 h-4 text-primary/60 mr-2" />
                <input 
                  type="date" 
                  value={selectedDate} 
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="bg-transparent text-xs font-bold text-[#2B2321] outline-none"
                />
              </div>

              <div className="flex bg-[#FDFBF7] border border-secondary/20 rounded-xl p-1">
                <button
                  onClick={() => setTimeframe('day')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors ${timeframe === 'day' ? 'bg-primary text-white shadow-sm' : 'text-primary/60 hover:text-primary'}`}
                >
                  Jour
                </button>
                <button
                  onClick={() => setTimeframe('week')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors ${timeframe === 'week' ? 'bg-primary text-white shadow-sm' : 'text-primary/60 hover:text-primary'}`}
                >
                  Semaine
                </button>
                <button
                  onClick={() => setTimeframe('month')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors ${timeframe === 'month' ? 'bg-primary text-white shadow-sm' : 'text-primary/60 hover:text-primary'}`}
                >
                  Mois
                </button>
              </div>

              <button 
                onClick={handleDownloadPDF}
                disabled={isDownloading}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl font-bold text-xs hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 disabled:opacity-50 h-[38px]"
                title="Exporter en PDF"
              >
                {isDownloading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <FileText className="w-4 h-4" />
                )}
                <span>PDF</span>
              </button>

              <button 
                onClick={exportSalesToExcel}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-secondary/30 text-emerald-600 rounded-xl font-bold text-xs hover:bg-[#FDFBF7] transition-all h-[38px]"
                title="Exporter Ventes en Excel"
              >
                <Download className="w-4 h-4" />
                <span>Excel</span>
              </button>
            </div>
          </div>

          {/* Top 3 Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            <div className="p-4 sm:p-6 bg-white border border-secondary/30 rounded-3xl shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-green-50 text-green-600 rounded-lg">
                  <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <h3 className="text-[7px] sm:text-[10px] font-bold uppercase tracking-widest text-primary/60">Revenu Total</h3>
              </div>
              <p className="text-base sm:text-3xl font-bold text-[#2B2321]">{totalRevenue.toLocaleString()} <span className="text-[8px] sm:text-xs opacity-60">FCFA</span></p>
            </div>

            <div className="p-4 sm:p-6 bg-white border border-secondary/30 rounded-3xl shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-red-50 text-red-600 rounded-lg">
                  <TrendingDown className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <h3 className="text-[7px] sm:text-[10px] font-bold uppercase tracking-widest text-primary/60">Dépenses Totales</h3>
              </div>
              <p className="text-base sm:text-3xl font-bold text-[#2B2321]">{totalExpenses.toLocaleString()} <span className="text-[8px] sm:text-xs opacity-60">FCFA</span></p>
            </div>

            <div className="p-4 sm:p-6 bg-primary text-white border border-primary/30 rounded-3xl shadow-xl shadow-primary/20">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-white/20 text-white rounded-lg">
                  <DollarSign className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <h3 className="text-[7px] sm:text-[10px] font-bold uppercase tracking-widest text-white/60">Bénéfice Net</h3>
              </div>
              <p className="text-base sm:text-3xl font-bold">{netProfit.toLocaleString()} <span className="text-[8px] sm:text-xs opacity-60">FCFA</span></p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8">
            <div className="p-4 sm:p-8 bg-white border border-secondary/30 shadow-sm rounded-3xl">
              <h3 className="text-sm sm:text-lg font-bold tracking-tight text-[#2B2321] mb-4 sm:mb-8">Évolution des Revenus</h3>
              <div className="w-full" style={{ minHeight: 220 }}>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--primary-color)" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="var(--primary-color)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--secondary-color)" strokeOpacity={0.3} />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 8, fill: 'var(--primary-color)' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 8, fill: 'var(--primary-color)' }} tickFormatter={(v) => `${v/1000}k`} />
                    <Tooltip contentStyle={{ border: 'none', borderRadius: '16px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '10px' }} />
                    <Area type="monotone" dataKey="total" stroke="var(--primary-color)" fillOpacity={1} fill="url(#colorTotal)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="p-4 sm:p-8 bg-white border border-secondary/30 shadow-sm rounded-3xl">
              <h3 className="text-sm sm:text-lg font-bold tracking-tight text-[#2B2321] mb-4 sm:mb-8">Répartition par Mode de Paiement</h3>
              <div className="w-full" style={{ minHeight: 220 }}>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ border: 'none', borderRadius: '16px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '10px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4">
                {pieData.map((item: any, i) => (
                  <div key={item.name} className="flex items-center justify-between p-2 sm:p-3 bg-[#FDFBF7] rounded-xl border border-secondary/20">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                      <span className="text-[7px] sm:text-[10px] font-bold uppercase tracking-widest text-primary/60">{item.name}</span>
                    </div>
                    <span className="font-bold text-[8px] sm:text-xs text-[#2B2321]">{item.value.toLocaleString()} FCFA</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Executive Overview: Top 5 Best Sellers Preview */}
          <div className="bg-white border border-secondary/30 rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-secondary/15 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                  <Trophy className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <h4 className="font-bold text-base text-[#2B2321]">Top 5 des Produits les Plus Vendus</h4>
                  <p className="text-xs text-gray-500">Aperçu rapide des meilleures ventes sur la période sélectionnée</p>
                </div>
              </div>

              <button
                onClick={() => setActiveTab('top_products')}
                className="text-xs text-primary font-bold hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Voir le classement complet ({filteredTopProducts.length} articles)</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {filteredTopProducts.slice(0, 5).map((prod, idx) => (
                <div 
                  key={prod.id || prod.name}
                  onClick={() => setActiveTab('top_products')}
                  className="p-3.5 bg-[#FDFBF7] rounded-2xl border border-secondary/20 hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer flex flex-col justify-between space-y-2 group"
                >
                  <div className="flex items-center justify-between">
                    <span className={`w-6 h-6 rounded-lg text-xs font-black flex items-center justify-center ${
                      idx === 0 ? 'bg-amber-400 text-amber-950 shadow-xs' :
                      idx === 1 ? 'bg-slate-300 text-slate-900' :
                      idx === 2 ? 'bg-amber-700/80 text-white' : 'bg-gray-100 text-gray-700'
                    }`}>
                      #{idx + 1}
                    </span>
                    <span className="text-[10px] font-bold text-primary/70 truncate max-w-[100px]">{prod.category}</span>
                  </div>

                  <div>
                    <p className="font-bold text-xs text-[#2B2321] truncate group-hover:text-primary transition-colors" title={prod.name}>
                      {prod.name}
                    </p>
                    <p className="font-serif font-black text-sm text-[#1C2321] mt-0.5">
                      {prod.totalRevenue.toLocaleString()} <span className="text-[9px] font-sans font-normal text-gray-400">FCFA</span>
                    </p>
                  </div>

                  <div className="pt-2 border-t border-black/5 flex items-center justify-between text-[10px] font-bold text-gray-600">
                    <span>{prod.quantitySold} unités</span>
                    <span className="text-primary">{prod.revenueSharePercent}% CA</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PALMARÈS & ANALYSE DÉTAILLÉE DES PRODUITS LES PLUS VENDUS */}
      {activeTab === 'top_products' && (
        <div className="space-y-8">
          {/* Controls Bar for Top Products */}
          <div className="bg-white border border-secondary/30 rounded-3xl p-6 shadow-sm flex flex-col xl:flex-row items-start xl:items-center justify-between gap-6">
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-[#2B2321] uppercase flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-500" />
                Palmarès des Produits les Plus Vendus
              </h3>
              <p className="text-xs text-[#2B2321]/60">
                Période analysée : <strong className="text-[#1C2321]">{prodPeriodLabel}</strong> ({filteredTopProducts.length} référence{filteredTopProducts.length > 1 ? 's' : ''} active{filteredTopProducts.length > 1 ? 's' : ''})
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 w-full xl:w-auto">
              {/* Period Type Switcher */}
              <div className="flex bg-[#FDFBF7] border border-secondary/20 rounded-xl p-1 shrink-0">
                <button
                  onClick={() => setProductPeriod('day')}
                  className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${productPeriod === 'day' ? 'bg-primary text-white shadow-2xs' : 'text-primary/60 hover:text-primary'}`}
                >
                  Jour
                </button>
                <button
                  onClick={() => setProductPeriod('week')}
                  className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${productPeriod === 'week' ? 'bg-primary text-white shadow-2xs' : 'text-primary/60 hover:text-primary'}`}
                >
                  Semaine
                </button>
                <button
                  onClick={() => setProductPeriod('month')}
                  className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${productPeriod === 'month' ? 'bg-primary text-white shadow-2xs' : 'text-primary/60 hover:text-primary'}`}
                >
                  Mois
                </button>
                <button
                  onClick={() => setProductPeriod('all')}
                  className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${productPeriod === 'all' ? 'bg-primary text-white shadow-2xs' : 'text-primary/60 hover:text-primary'}`}
                >
                  Tout
                </button>
              </div>

              {/* Month or Date selector */}
              {productPeriod === 'month' && (
                <div className="flex items-center bg-[#FDFBF7] border border-secondary/30 rounded-xl px-2.5 h-[38px]">
                  <Calendar className="w-3.5 h-3.5 text-primary/60 mr-1.5" />
                  <input
                    type="month"
                    value={productMonth}
                    onChange={(e) => e.target.value && setProductMonth(e.target.value)}
                    className="bg-transparent text-xs font-bold text-[#2B2321] outline-none cursor-pointer"
                  />
                </div>
              )}

              {(productPeriod === 'day' || productPeriod === 'week') && (
                <div className="flex items-center bg-[#FDFBF7] border border-secondary/30 rounded-xl px-2.5 h-[38px]">
                  <Calendar className="w-3.5 h-3.5 text-primary/60 mr-1.5" />
                  <input
                    type="date"
                    value={productDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="bg-transparent text-xs font-bold text-[#2B2321] outline-none cursor-pointer"
                  />
                </div>
              )}

              {/* Category Filter */}
              <div className="flex items-center bg-[#FDFBF7] border border-secondary/30 rounded-xl px-2.5 h-[38px]">
                <SlidersHorizontal className="w-3.5 h-3.5 text-primary/60 mr-1.5" />
                <select
                  value={productCategory}
                  onChange={(e) => setProductCategory(e.target.value)}
                  className="bg-transparent text-xs font-bold text-[#2B2321] outline-none cursor-pointer"
                >
                  <option value="all">Toutes Catégories</option>
                  {availableProductCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Sort By Toggle */}
              <div className="flex bg-[#FDFBF7] border border-secondary/20 rounded-xl p-1 shrink-0">
                <button
                  onClick={() => setProductSortBy('quantity')}
                  className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${productSortBy === 'quantity' ? 'bg-[#1C2321] text-white shadow-2xs' : 'text-gray-600 hover:text-black'}`}
                  title="Trier par volume d'unités vendues"
                >
                  Par Quantité
                </button>
                <button
                  onClick={() => setProductSortBy('revenue')}
                  className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${productSortBy === 'revenue' ? 'bg-[#1C2321] text-white shadow-2xs' : 'text-gray-600 hover:text-black'}`}
                  title="Trier par chiffre d'affaires généré"
                >
                  Par Revenu (FCFA)
                </button>
              </div>

              {/* Export Buttons */}
              <button 
                onClick={handleDownloadPDF}
                disabled={isDownloading}
                className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white rounded-xl font-bold text-xs hover:bg-primary/90 transition-all shadow-md shadow-primary/20 disabled:opacity-50 h-[38px] cursor-pointer"
                title="Exporter le palmarès en PDF"
              >
                {isDownloading ? (
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <FileText className="w-3.5 h-3.5" />
                )}
                <span>PDF</span>
              </button>

              <button 
                onClick={exportSalesToExcel}
                className="flex items-center gap-1.5 px-3 py-2 bg-white border border-secondary/30 text-emerald-600 rounded-xl font-bold text-xs hover:bg-[#FDFBF7] transition-all h-[38px] cursor-pointer"
                title="Exporter le palmarès en Excel"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Excel</span>
              </button>
            </div>
          </div>

          {/* Top Key Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            <div className="p-5 bg-white border border-secondary/30 rounded-3xl shadow-sm space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-primary/60">Volume Total Écoulé</span>
              <p className="text-2xl sm:text-3xl font-black font-serif text-[#1C2321]">
                {totalTopProductsQuantity.toLocaleString()} <span className="text-xs font-sans font-normal text-gray-500">unités</span>
              </p>
              <p className="text-[10px] text-gray-500 font-medium">Articles vendus sur la période</p>
            </div>

            <div className="p-5 bg-white border border-secondary/30 rounded-3xl shadow-sm space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-primary/60">Chiffre d'Affaires Produits</span>
              <p className="text-2xl sm:text-3xl font-black font-serif text-[#1C2321]">
                {totalTopProductsRevenue.toLocaleString()} <span className="text-xs font-sans font-normal text-gray-500">FCFA</span>
              </p>
              <p className="text-[10px] text-emerald-700 font-medium">Recettes directes des articles</p>
            </div>

            <div className="p-5 bg-white border border-secondary/30 rounded-3xl shadow-sm space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-primary/60">Produit #1 Star</span>
              <p className="text-xl sm:text-2xl font-black text-[#1C2321] truncate font-serif" title={top1Product?.name || 'Aucun'}>
                {top1Product?.name || 'Aucun'}
              </p>
              <p className="text-[10px] text-amber-700 font-bold">
                {top1Product ? `${top1Product.quantitySold} unités (${top1Product.totalRevenue.toLocaleString()} FCFA)` : 'Aucune vente'}
              </p>
            </div>

            <div className="p-5 bg-white border border-secondary/30 rounded-3xl shadow-sm space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-primary/60">Références Différentes</span>
              <p className="text-2xl sm:text-3xl font-black font-serif text-[#1C2321]">
                {filteredTopProducts.length} <span className="text-xs font-sans font-normal text-gray-500">articles</span>
              </p>
              <p className="text-[10px] text-blue-700 font-medium">Ayant enregistré au moins une vente</p>
            </div>
          </div>

          {/* Podium of Top 3 Best-Sellers */}
          {filteredTopProducts.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                <Medal className="w-4 h-4 text-amber-500" />
                Podium des Meilleures Ventes
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
                {/* 1st Place - Gold */}
                {top1Product && (
                  <div className="p-6 bg-gradient-to-br from-amber-500/15 via-amber-100/30 to-amber-500/5 border-2 border-amber-400 rounded-3xl shadow-md relative overflow-hidden flex flex-col justify-between space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-9 h-9 rounded-2xl bg-amber-400 text-amber-950 font-black text-sm flex items-center justify-center shadow-xs">
                          🥇 1
                        </span>
                        <div>
                          <span className="text-[9px] font-black uppercase tracking-widest text-amber-800">Meilleure Vente Absolue</span>
                          <h4 className="font-bold text-base text-[#1C2321] line-clamp-1" title={top1Product.name}>{top1Product.name}</h4>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                        {top1Product.category}
                      </span>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-baseline">
                        <span className="text-xs text-gray-600 font-medium">Quantité Écoulée :</span>
                        <span className="text-xl font-black text-[#1C2321]">{top1Product.quantitySold} unités</span>
                      </div>
                      <div className="flex justify-between items-baseline">
                        <span className="text-xs text-gray-600 font-medium">Chiffre d'Affaires :</span>
                        <span className="text-lg font-black font-serif text-emerald-800">{top1Product.totalRevenue.toLocaleString()} FCFA</span>
                      </div>
                      <div className="flex justify-between items-baseline text-xs">
                        <span className="text-gray-500">Contribution au CA :</span>
                        <span className="font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded-full">{top1Product.revenueSharePercent}%</span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-amber-300/60 flex items-center justify-between text-[10px] text-amber-900 font-medium">
                      <span>Lieu principal : {top1Product.primaryLocation}</span>
                      <span>Prix moyen : {top1Product.averagePrice.toLocaleString()} FCFA</span>
                    </div>
                  </div>
                )}

                {/* 2nd Place - Silver */}
                {top2Product ? (
                  <div className="p-6 bg-gradient-to-br from-slate-200/40 via-gray-100/40 to-slate-200/20 border-2 border-slate-300 rounded-3xl shadow-sm relative overflow-hidden flex flex-col justify-between space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-9 h-9 rounded-2xl bg-slate-300 text-slate-800 font-black text-sm flex items-center justify-center shadow-xs">
                          🥈 2
                        </span>
                        <div>
                          <span className="text-[9px] font-black uppercase tracking-widest text-slate-700">2ème Meilleure Vente</span>
                          <h4 className="font-bold text-base text-[#1C2321] line-clamp-1" title={top2Product.name}>{top2Product.name}</h4>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-300">
                        {top2Product.category}
                      </span>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-baseline">
                        <span className="text-xs text-gray-600 font-medium">Quantité Écoulée :</span>
                        <span className="text-xl font-black text-[#1C2321]">{top2Product.quantitySold} unités</span>
                      </div>
                      <div className="flex justify-between items-baseline">
                        <span className="text-xs text-gray-600 font-medium">Chiffre d'Affaires :</span>
                        <span className="text-lg font-black font-serif text-emerald-800">{top2Product.totalRevenue.toLocaleString()} FCFA</span>
                      </div>
                      <div className="flex justify-between items-baseline text-xs">
                        <span className="text-gray-500">Contribution au CA :</span>
                        <span className="font-bold text-slate-800 bg-slate-200 px-2 py-0.5 rounded-full">{top2Product.revenueSharePercent}%</span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-300/60 flex items-center justify-between text-[10px] text-slate-700 font-medium">
                      <span>Lieu principal : {top2Product.primaryLocation}</span>
                      <span>Prix moyen : {top2Product.averagePrice.toLocaleString()} FCFA</span>
                    </div>
                  </div>
                ) : (
                  <div className="p-6 bg-gray-50 border border-dashed border-gray-200 rounded-3xl flex items-center justify-center text-xs text-gray-400">
                    Pas de 2ème produit sur cette période
                  </div>
                )}

                {/* 3rd Place - Bronze */}
                {top3Product ? (
                  <div className="p-6 bg-gradient-to-br from-amber-800/10 via-amber-700/5 to-amber-900/10 border-2 border-amber-600/40 rounded-3xl shadow-sm relative overflow-hidden flex flex-col justify-between space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-9 h-9 rounded-2xl bg-amber-700/80 text-white font-black text-sm flex items-center justify-center shadow-xs">
                          🥉 3
                        </span>
                        <div>
                          <span className="text-[9px] font-black uppercase tracking-widest text-amber-900">3ème Meilleure Vente</span>
                          <h4 className="font-bold text-base text-[#1C2321] line-clamp-1" title={top3Product.name}>{top3Product.name}</h4>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                        {top3Product.category}
                      </span>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-baseline">
                        <span className="text-xs text-gray-600 font-medium">Quantité Écoulée :</span>
                        <span className="text-xl font-black text-[#1C2321]">{top3Product.quantitySold} unités</span>
                      </div>
                      <div className="flex justify-between items-baseline">
                        <span className="text-xs text-gray-600 font-medium">Chiffre d'Affaires :</span>
                        <span className="text-lg font-black font-serif text-emerald-800">{top3Product.totalRevenue.toLocaleString()} FCFA</span>
                      </div>
                      <div className="flex justify-between items-baseline text-xs">
                        <span className="text-gray-500">Contribution au CA :</span>
                        <span className="font-bold text-amber-950 bg-amber-200 px-2 py-0.5 rounded-full">{top3Product.revenueSharePercent}%</span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-amber-300/60 flex items-center justify-between text-[10px] text-amber-900 font-medium">
                      <span>Lieu principal : {top3Product.primaryLocation}</span>
                      <span>Prix moyen : {top3Product.averagePrice.toLocaleString()} FCFA</span>
                    </div>
                  </div>
                ) : (
                  <div className="p-6 bg-gray-50 border border-dashed border-gray-200 rounded-3xl flex items-center justify-center text-xs text-gray-400">
                    Pas de 3ème produit sur cette période
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Interactive Recharts Top 10 Chart */}
          {top10ProductChartData.length > 0 && (
            <div className="p-6 bg-white border border-secondary/30 shadow-sm rounded-3xl space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div>
                  <h3 className="text-base sm:text-lg font-bold tracking-tight text-[#2B2321]">
                    Top 10 des Produits les Plus Vendus
                  </h3>
                  <p className="text-xs text-gray-500">
                    {productSortBy === 'quantity' ? "Classement par volumes d'unités vendues" : "Classement par chiffre d'affaires total généré (FCFA)"}
                  </p>
                </div>

                <span className="px-3 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/20">
                  {productSortBy === 'quantity' ? '📊 Indicateur : Unités vendues' : '💰 Indicateur : CA en FCFA'}
                </span>
              </div>

              <div className="w-full" style={{ minHeight: 280 }}>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={top10ProductChartData} margin={{ top: 10, right: 10, left: 10, bottom: 25 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--secondary-color)" strokeOpacity={0.25} />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 9, fill: '#1C2321', fontWeight: 600 }}
                      interval={0}
                      angle={-20}
                      textAnchor="end"
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 9, fill: '#1C2321' }}
                      tickFormatter={(v) => productSortBy === 'quantity' ? `${v}` : `${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`}
                    />
                    <Tooltip 
                      contentStyle={{ border: 'none', borderRadius: '16px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '11px' }}
                      formatter={(value: any) => [
                        productSortBy === 'quantity' 
                          ? `${Number(value).toLocaleString()} unités vendues`
                          : `${Number(value).toLocaleString()} FCFA de recettes`,
                        productSortBy === 'quantity' ? 'Volume' : 'Revenu'
                      ]}
                      labelFormatter={(_label, payload) => {
                        const item = payload?.[0]?.payload;
                        return item ? `${item.fullName} (${item.category})` : _label;
                      }}
                    />
                    <Bar 
                      dataKey={productSortBy === 'quantity' ? 'quantite' : 'revenu'} 
                      fill="var(--primary-color)" 
                      radius={[8, 8, 0, 0]} 
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Complete Detailed Products Table with Search */}
          <div className="bg-white border border-secondary/30 rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h4 className="font-bold text-base text-[#2B2321]">Tableau Exhaustif des Ventes par Produit</h4>
                <p className="text-xs text-gray-500">Analyse détaillée de chaque référence enregistrée</p>
              </div>

              {/* Quick Search in Table */}
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Rechercher un produit..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-[#FDFBF7] rounded-xl border border-secondary/30 text-xs text-[#1C2321] outline-none focus:border-primary transition-all"
                />
              </div>
            </div>

            {filteredTopProducts.length > 0 ? (
              <div className="overflow-x-auto border border-gray-100 rounded-2xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-gray-50/80 border-b border-gray-200 text-gray-500 font-bold uppercase tracking-wider text-[10px]">
                      <th className="p-3 pl-4">Rang</th>
                      <th className="p-3">Produit & Référence</th>
                      <th className="p-3">Catégorie</th>
                      <th className="p-3 text-center">Quantité Vendue</th>
                      <th className="p-3 text-right">Prix Moyen</th>
                      <th className="p-3 text-right">Chiffre d'Affaires</th>
                      <th className="p-3 text-center">Part du CA</th>
                      <th className="p-3 text-center">Commandes</th>
                      <th className="p-3 pr-4 text-center">Lieu Principal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredTopProducts.map((p, idx) => {
                      const relativeWidth = Math.min(100, Math.round((p.quantitySold / maxProductQuantity) * 100));

                      return (
                        <tr key={p.id || p.name} className="hover:bg-gray-50/70 transition-colors">
                          <td className="p-3 pl-4 whitespace-nowrap">
                            <span className={`w-6 h-6 rounded-lg text-xs font-black inline-flex items-center justify-center ${
                              idx === 0 ? 'bg-amber-400 text-amber-950 shadow-xs' :
                              idx === 1 ? 'bg-slate-300 text-slate-900' :
                              idx === 2 ? 'bg-amber-700/80 text-white' : 'bg-gray-100 text-gray-700'
                            }`}>
                              #{idx + 1}
                            </span>
                          </td>

                          <td className="p-3 font-bold text-[#1C2321] whitespace-nowrap">
                            {p.name}
                          </td>

                          <td className="p-3 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
                              {p.category}
                            </span>
                          </td>

                          <td className="p-3 text-center whitespace-nowrap">
                            <div className="space-y-1 inline-block min-w-[70px]">
                              <span className="font-black text-xs text-[#1C2321]">{p.quantitySold}</span>
                              <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-primary rounded-full" 
                                  style={{ width: `${relativeWidth}%` }} 
                                />
                              </div>
                            </div>
                          </td>

                          <td className="p-3 text-right font-serif font-bold text-gray-600 whitespace-nowrap">
                            {p.averagePrice.toLocaleString()} FCFA
                          </td>

                          <td className="p-3 text-right font-black font-serif text-[#1C2321] whitespace-nowrap">
                            {p.totalRevenue.toLocaleString()} <span className="text-[10px] font-sans font-normal text-gray-400">FCFA</span>
                          </td>

                          <td className="p-3 text-center whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded-full font-bold text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200">
                              {p.revenueSharePercent}%
                            </span>
                          </td>

                          <td className="p-3 text-center font-bold text-gray-600 whitespace-nowrap">
                            {p.orderCount}
                          </td>

                          <td className="p-3 pr-4 text-center whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-gray-100 text-gray-700">
                              {p.primaryLocation}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-12 text-center text-gray-400 text-xs italic bg-[#FDFBF7] rounded-2xl border border-dashed border-secondary/30">
                Aucun produit vendu correspondant aux critères de recherche pour cette période ({prodPeriodLabel}).
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

