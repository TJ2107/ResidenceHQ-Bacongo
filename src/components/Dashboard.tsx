import React, { useState, useEffect } from 'react';
import { Product, Sale, AppSettings, Room, UserProfile, Booking } from '../types';
import { collection, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { 
  Package, 
  ShoppingCart, 
  TrendingUp, 
  AlertCircle, 
  FileSpreadsheet, 
  FileText, 
  Printer, 
  Utensils, 
  Crown, 
  Bed, 
  Wine, 
  Sun, 
  MapPin, 
  ShieldCheck, 
  Eye, 
  EyeOff,
  Filter,
  Layers,
  ChevronRight,
  Calendar,
  Trash2,
  Waves,
  Flame,
  Car
} from 'lucide-react';
import { cn, parseDate, OperationType, handleFirestoreError, logEvent } from '../lib/utils';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { ConfirmModal } from './ConfirmModal';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { LOW_STOCK_THRESHOLD } from '../constants';
import { exportDailySales, exportInventory } from '../lib/excel';
import { ReportGenerator } from './ReportGenerator';
import { Receipt } from './Receipt';
import { DashboardModuleDetails, DashboardModalType } from './DashboardModuleDetails';

interface DashboardProps {
  products: Product[];
  sales: Sale[];
  isAdmin: boolean;
  settings?: AppSettings | null;
  rooms?: Room[];
  user?: UserProfile;
}

export const LOCATION_CONFIG = [
  { 
    id: 'Terrasse', 
    label: 'Terrasse', 
    icon: Sun, 
    color: 'from-amber-500 to-amber-700', 
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
    iconColor: 'text-amber-600',
    bgColor: 'bg-amber-50/50',
    borderColor: 'border-amber-200/60',
    description: 'Bar extérieur & Terrasse'
  },
  { 
    id: 'Restaurant', 
    label: 'Restaurant', 
    icon: Utensils, 
    color: 'from-emerald-600 to-teal-800', 
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    iconColor: 'text-emerald-600',
    bgColor: 'bg-emerald-50/50',
    borderColor: 'border-emerald-200/60',
    description: 'Salle de restauration'
  },
  { 
    id: 'VIP', 
    label: 'Salon VIP', 
    icon: Crown, 
    color: 'from-purple-600 to-indigo-800', 
    badgeClass: 'bg-purple-50 text-purple-800 border-purple-200',
    iconColor: 'text-purple-600',
    bgColor: 'bg-purple-50/50',
    borderColor: 'border-purple-200/60',
    description: 'Espace privé VIP'
  },
  { 
    id: 'Réception', 
    label: 'Réception', 
    icon: Bed, 
    color: 'from-blue-600 to-sky-800', 
    badgeClass: 'bg-blue-50 text-blue-800 border-blue-200',
    iconColor: 'text-blue-600',
    bgColor: 'bg-blue-50/50',
    borderColor: 'border-blue-200/60',
    description: 'Accueil & Hébergement'
  },
  { 
    id: 'Chicha', 
    label: 'Lounge Chicha', 
    icon: Flame, 
    color: 'from-rose-600 to-red-800', 
    badgeClass: 'bg-rose-50 text-rose-800 border-rose-200',
    iconColor: 'text-rose-600',
    bgColor: 'bg-rose-50/50',
    borderColor: 'border-rose-200/60',
    description: 'Service chicha & Parfums'
  },
];

export const Dashboard = ({ products, sales, isAdmin, settings, rooms, user }: DashboardProps) => {
  const [showReport, setShowReport] = useState(false);
  const [printingSale, setPrintingSale] = useState<Sale | null>(null);
  const [activeDetailModal, setActiveDetailModal] = useState<DashboardModalType>(null);
  const [bookings, setBookings] = useState<Booking[]>(() => {
    try {
      const saved = localStorage.getItem('residence_bookings');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [shishaSales, setShishaSales] = useState<any[]>([]);
  const [dashboardSaleToDelete, setDashboardSaleToDelete] = useState<Sale | null>(null);

  useEffect(() => {
    const unsubBookings = onSnapshot(collection(db, 'bookings'), (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Booking));
      setBookings(data);
      try {
        localStorage.setItem('residence_bookings', JSON.stringify(data));
      } catch (e) {
        console.warn("Storage quota exceeded for bookings cache:", e);
      }
    }, (error) => console.error("Error loading bookings in Dashboard:", error));

    const unsubShisha = onSnapshot(collection(db, 'shisha_sales'), (snapshot) => {
      setShishaSales(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => console.debug("Error loading shisha_sales in Dashboard:", error));

    return () => {
      unsubBookings();
      unsubShisha();
    };
  }, []);

  const isManagerOrAdmin = isAdmin || user?.role === 'admin' || user?.role === 'manager' || user?.email?.toLowerCase() === 'cyber.kan587@gmail.com';

  const executeDeleteDashboardSale = async (sale: Sale) => {
    if (!isManagerOrAdmin) return;

    try {
      const { getDoc, updateDoc, increment, doc: fsDoc } = await import('firebase/firestore');

      // 1. Restore stock if it was a product sale from POS
      if (sale.items && sale.items.length > 0) {
        for (const item of sale.items) {
          if (item.productId && item.quantity > 0 && !item.productId.startsWith('room_')) {
            const productRef = fsDoc(db, 'products', item.productId);
            const productSnap = await getDoc(productRef);
            if (productSnap.exists()) {
              const loc = sale.location || 'Terrasse';
              let updateData: any = {
                stock: increment(item.quantity)
              };

              if (loc === 'Réception') {
                updateData.stockReception = increment(item.quantity);
              } else if (loc === 'VIP') {
                updateData.stockVip = increment(item.quantity);
              } else {
                updateData.stockTerrasse = increment(item.quantity);
              }

              await updateDoc(productRef, updateData);
            }
          }
        }
      }

      // 2. Cleanup linked records
      if (sale.sourceId) {
        try {
          await deleteDoc(doc(db, 'pool_tickets', sale.sourceId));
          await deleteDoc(doc(db, 'shisha_sales', sale.sourceId));
        } catch (e) {
          console.warn("Could not delete linked source record:", e);
        }
      }

      if (sale.bookingId) {
        try {
          await deleteDoc(doc(db, 'bookings', sale.bookingId));
        } catch (e) {
          console.warn("Could not delete linked booking:", e);
        }
      }

      // 3. Delete the sale itself
      await deleteDoc(doc(db, 'sales', sale.id));
      
      logEvent(user, 'Vente', `Vente #${sale.id.slice(-6).toUpperCase()} supprimée et stock restauré par ${user.username}.`);
      toast.success("Vente supprimée et stock restauré avec succès.");
    } catch (error) {
      console.error("Error deleting sale:", error);
      handleFirestoreError(error, OperationType.DELETE, 'sales');
    }
  };

  const handleDeleteSale = async (sale: Sale) => {
    if (!isManagerOrAdmin) return;
    setDashboardSaleToDelete(sale);
  };

  // State for active location filter
  const [selectedLocation, setSelectedLocation] = useState<string>(() => {
    if (user?.role === 'caissiere') return 'Terrasse';
    if (user?.role === 'receptionist') return 'Réception';
    if (user?.role === 'barman') return 'Terrasse';
    if (user?.role === 'serveur') return 'Restaurant';
    return isManagerOrAdmin ? 'Tous' : 'Terrasse';
  });

  const today = new Date();

  // Deduplication sets
  const salesSourceIds = new Set(sales.filter(s => s.sourceId).map(s => s.sourceId));
  const salesBookingIds = new Set(sales.filter(s => s.bookingId).map(s => s.bookingId));

  // Convert unrecorded bookings into sale format
  const unrecordedBookings = bookings.filter(b => !salesBookingIds.has(b.id));
  const unrecordedBookingAsSales: Sale[] = unrecordedBookings.map(b => ({
    id: `booking_${b.id}`,
    totalPrice: b.totalPaid || 0,
    paymentMethod: ((b.paymentMethod as string) === 'Espèces' || b.paymentMethod === 'Cash' ? 'Cash' : (b.paymentMethod as string) === 'Carte' || b.paymentMethod === 'Card' ? 'Card' : String(b.paymentMethod || '').toLowerCase().includes('mobile') || String(b.paymentMethod || '').toLowerCase().includes('wave') || String(b.paymentMethod || '').toLowerCase().includes('orange') || String(b.paymentMethod || '').toLowerCase().includes('moov') ? 'Mobile Money' : 'Cash') as any,
    sellerId: (b as any).receptionistId || 'reception',
    sellerName: (b as any).receptionistName || 'Réception',
    sellerRole: 'receptionist',
    location: 'Réception',
    timestamp: b.timestamp || (b as any).createdAt || (b as any).paymentDate || (b as any).checkInDate || b.checkOutDate,
    bookingId: b.id,
    items: [{
      productId: 'room_stay',
      productName: `Séjour Chambre #${b.roomNumber} (${b.guestName || 'Client'})`,
      quantity: b.totalNights || 1,
      price: b.totalPaid || 0,
      category: 'Hébergement'
    }],
    status: 'Completed'
  }));

  // Convert unrecorded shisha sales into sale format
  const unrecordedShishaAsSales: Sale[] = shishaSales
    .filter(ss => !salesSourceIds.has(ss.id))
    .map(ss => ({
      id: `shisha_${ss.id}`,
      totalPrice: ss.totalAmount || ss.totalPrice || 0,
      paymentMethod: (ss.paymentMethod === 'Chambre' ? 'Room Charge' : ss.paymentMethod || 'Cash') as any,
      sellerId: ss.sellerId || 'shisha',
      sellerName: ss.sellerName || 'Vendeur Chicha',
      sellerRole: 'staff',
      location: 'Chicha',
      timestamp: ss.timestamp,
      sourceId: ss.id,
      items: (ss.items && ss.items.length > 0) ? ss.items : [{
        productId: 'shisha_item',
        productName: 'Service Chicha',
        quantity: 1,
        price: ss.totalAmount || 0,
        category: 'Chicha'
      }],
      status: 'Completed'
    }));

  // Consolidate all sales cleanly across all points of sale
  const allUnrecordedSales = [
    ...unrecordedBookingAsSales,
    ...unrecordedShishaAsSales
  ];

  const allCombinedSales = [...sales, ...allUnrecordedSales].sort((a, b) => {
    return parseDate(b.timestamp).getTime() - parseDate(a.timestamp).getTime();
  });

  const todaySales = allCombinedSales.filter(sale => {
    const saleDate = parseDate(sale.timestamp);
    return today.toDateString() === saleDate.toDateString();
  });

  // Global Totals (across all 7 points of sale, zero double-counting)
  const globalTotalRevenue = allCombinedSales.reduce((acc, sale) => acc + (sale.totalPrice || sale.items?.reduce((sum, item) => sum + item.price * item.quantity, 0) || 0), 0);
  const globalTodayRevenue = todaySales.reduce((acc, sale) => acc + (sale.totalPrice || sale.items?.reduce((sum, item) => sum + item.price * item.quantity, 0) || 0), 0);
  const globalTodayCount = todaySales.length;

  // Calcul de la période cumulée (de la première transaction à ce jour)
  const cumulativePeriodLabel = React.useMemo(() => {
    let earliestDate: Date | null = null;
    
    allCombinedSales.forEach(s => {
      const d = parseDate(s.timestamp);
      if (d && (!earliestDate || d < earliestDate)) {
        earliestDate = d;
      }
    });

    const todayFormatted = format(today, 'dd/MM/yyyy');

    if (!earliestDate) {
      return `À ce jour (${todayFormatted})`;
    }

    const startFormatted = format(earliestDate, 'dd/MM/yyyy');
    return `Du ${startFormatted} à ce jour`;
  }, [allCombinedSales]);

  const lowStockCount = products.filter(p => p.stock <= LOW_STOCK_THRESHOLD).length;

  // Normalization helper for diacritics/accents
  const normalizeLoc = (str?: string) => {
    if (!str) return '';
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  };

  // Helper to match sales with consumption locations
  const isSaleInLocation = (sale: Sale, targetLocId: string) => {
    const tLoc = normalizeLoc(targetLocId);
    const sLoc = normalizeLoc(sale.location);

    if (tLoc === 'reception') {
      return (
        sLoc.includes('recept') ||
        sLoc.includes('hotel') ||
        sLoc.includes('chambre') ||
        sLoc.includes('heberg') ||
        Boolean(sale.bookingId) ||
        Boolean(sale.id && sale.id.startsWith('booking_')) ||
        sale.sellerRole === 'receptionist' ||
        (sale as any).receptionOrientation === 'Réception' ||
        Boolean(sale.items && sale.items.some(i => {
          const cat = normalizeLoc(i.category);
          const name = normalizeLoc(i.productName);
          return cat === 'hebergement' || cat === 'hotel' || name.includes('chambre') || name.includes('sejour') || name.includes('avance');
        }))
      );
    }

    if (!sale.location) {
      return targetLocId === 'Terrasse' || targetLocId === 'Restaurant';
    }

    if (tLoc === 'restaurant') return sLoc.includes('rest') || sLoc.includes('resto');
    if (tLoc === 'vip') return sLoc.includes('vip');
    if (tLoc === 'terrasse') return sLoc.includes('terrasse');
    if (tLoc === 'chicha') return sLoc.includes('chicha') || sLoc.includes('shisha');

    return sLoc === tLoc;
  };

  // Location Stats breakdown for each consumption location
  const locationStats = LOCATION_CONFIG.map(loc => {
    const locTodaySales = todaySales.filter(s => isSaleInLocation(s, loc.id));
    const locTodayRevenue = locTodaySales.reduce((acc, s) => acc + (s.totalPrice || s.items?.reduce((sum, item) => sum + item.price * item.quantity, 0) || 0), 0);
    const locTodayCount = locTodaySales.length;

    const locTotalSales = allCombinedSales.filter(s => isSaleInLocation(s, loc.id));
    const locTotalRevenue = locTotalSales.reduce((acc, s) => acc + (s.totalPrice || s.items?.reduce((sum, item) => sum + item.price * item.quantity, 0) || 0), 0);

    const percentageOfToday = globalTodayRevenue > 0 ? (locTodayRevenue / globalTodayRevenue) * 100 : 0;

    return {
      ...loc,
      todaySalesCount: locTodayCount,
      todayRevenue: locTodayRevenue,
      totalRevenue: locTotalRevenue,
      percentageOfToday
    };
  });

  // Determine currently active location data for non-manager view
  const activeLocationId = selectedLocation === 'Tous' ? 'Terrasse' : selectedLocation;
  const activeLocData = locationStats.find(l => l.id === activeLocationId) || locationStats[0];

  // Filtered recent sales based on selectedLocation
  const filteredRecentSales = allCombinedSales.filter(s => {
    if (selectedLocation === 'Tous') return true;
    return isSaleInLocation(s, selectedLocation);
  });

  return (
    <div className="space-y-4">
      {/* Top Header & Role Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-secondary/30 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-lg sm:text-xl font-bold font-serif text-[#1C2321]">Tableau de Bord</h1>
            {isManagerOrAdmin ? (
              <span className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-600" /> Direction / Manager
              </span>
            ) : (
              <span className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest bg-amber-50 text-amber-800 border border-amber-200 rounded-full flex items-center gap-1">
                <EyeOff className="w-3 h-3 text-amber-600" /> Vue Vendeur par Lieu
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 font-medium">
            {isManagerOrAdmin 
              ? "Supervision complète des revenus globaux et analyse détaillée des ventes par lieu de consommation."
              : `Consultation des ventes et de la performance restreinte au lieu : ${activeLocData.label}.`}
          </p>
        </div>

        {isManagerOrAdmin && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <button 
              onClick={() => setShowReport(true)} 
              className="flex items-center gap-1 px-2.5 py-1.5 bg-[#1C2321] text-white rounded-xl text-xs font-bold hover:bg-black transition-all shadow-sm active:scale-95 cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-[#C5A059]" /> 
              <span>Rapport (PDF)</span>
            </button>
            <button 
              onClick={() => exportDailySales(sales)} 
              className="flex items-center gap-1 px-2.5 py-1.5 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary/90 transition-all shadow-sm active:scale-95 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" /> 
              <span>Ventes Excel</span>
            </button>
            <button 
              onClick={() => exportInventory(products)} 
              className="flex items-center gap-1 px-2.5 py-1.5 bg-[#C5A059]/20 text-[#826123] border border-[#C5A059]/40 rounded-xl text-xs font-bold hover:bg-[#C5A059]/30 transition-all cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-[#826123]" /> 
              <span>Stock Excel</span>
            </button>
          </div>
        )}
      </div>

      {showReport && (
        <ReportGenerator 
          products={products} 
          sales={sales} 
          onClose={() => setShowReport(false)} 
          settings={settings}
        />
      )}

      {/* Row 1: Key Performance Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {isManagerOrAdmin ? (
          /* Manager & Admin see Global Totals */
          <>
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => setActiveDetailModal('global_total')}
              className="p-3.5 bg-white border border-secondary/30 shadow-sm hover:shadow-md hover:border-emerald-500/80 transition-all rounded-2xl relative overflow-hidden flex flex-col justify-between cursor-pointer group"
              title="Cliquer pour afficher les détails du Chiffre d'Affaires Global"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-700 group-hover:scale-105 transition-transform">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider bg-emerald-100/60 text-emerald-800 rounded-md">Global Total</span>
                    <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 group-hover:bg-emerald-600 group-hover:text-white transition-all flex items-center gap-0.5">
                      Détails <ChevronRight className="w-2.5 h-2.5" />
                    </span>
                  </div>
                </div>
                <p className="text-sm xs:text-base sm:text-xl font-black text-[#1C2321] truncate font-serif">
                  {globalTotalRevenue.toLocaleString()} <span className="text-[10px] font-sans font-normal text-gray-400">FCFA</span>
                </p>
                <p className="text-[9px] font-bold uppercase tracking-widest text-primary/60 mt-0.5">Chiffre Total (Cumul)</p>
              </div>

              <div className="mt-2 pt-2 border-t border-emerald-100/60 flex items-center gap-1.5 text-[9px] font-bold text-emerald-800 bg-emerald-50/70 px-2 py-1 rounded-lg w-fit">
                <Calendar className="w-3 h-3 text-emerald-600 shrink-0" />
                <span className="truncate">{cumulativePeriodLabel}</span>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              onClick={() => setActiveDetailModal('global_today')}
              className="p-3.5 bg-white border border-secondary/30 shadow-sm hover:shadow-md hover:border-blue-500/80 transition-all rounded-2xl cursor-pointer group"
              title="Cliquer pour afficher les détails des Ventes du Jour"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 group-hover:scale-105 transition-transform">
                  <ShoppingCart className="w-4 h-4" />
                </div>
                <div className="flex items-center gap-1">
                  <span className="px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider bg-blue-100/60 text-blue-800 rounded-md">Global Jour</span>
                  <span className="text-[9px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 group-hover:bg-blue-600 group-hover:text-white transition-all flex items-center gap-0.5">
                    Détails <ChevronRight className="w-2.5 h-2.5" />
                  </span>
                </div>
              </div>
              <p className="text-sm xs:text-base sm:text-xl font-black text-[#1C2321] truncate font-serif">
                {globalTodayRevenue.toLocaleString()} <span className="text-[10px] font-sans font-normal text-gray-400">FCFA</span>
              </p>
              <p className="text-[9px] font-bold uppercase tracking-widest text-primary/60 mt-0.5">Ventes Jour ({globalTodayCount})</p>
            </motion.div>
          </>
        ) : (
          /* Sellers see Location-Specific Totals ONLY */
          <>
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3.5 bg-white border border-emerald-200/80 shadow-sm rounded-2xl relative overflow-hidden"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-700">
                  <ShoppingCart className="w-4 h-4" />
                </div>
                <span className="px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 rounded-md">{activeLocData.label}</span>
              </div>
              <p className="text-sm xs:text-base sm:text-xl font-black text-[#1C2321] truncate font-serif">
                {activeLocData.todayRevenue.toLocaleString()} <span className="text-[10px] font-sans font-normal text-gray-400">FCFA</span>
              </p>
              <p className="text-[9px] font-bold uppercase tracking-widest text-emerald-700 mt-0.5">Ventes Jour ({activeLocData.label})</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="p-3.5 bg-white border border-blue-200/80 shadow-sm rounded-2xl"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                  <Layers className="w-4 h-4" />
                </div>
                <span className="px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider bg-blue-100 text-blue-800 rounded-md">{activeLocData.label}</span>
              </div>
              <p className="text-sm xs:text-base sm:text-xl font-black text-[#1C2321] truncate font-serif">
                {activeLocData.todaySalesCount} <span className="text-[10px] font-sans font-normal text-gray-400">Ventes</span>
              </p>
              <p className="text-[9px] font-bold uppercase tracking-widest text-blue-700 mt-0.5">Transactions du Jour</p>
            </motion.div>
          </>
        )}

        {/* Common Cards 3 & 4: Inventory & Low Stock */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          onClick={() => setActiveDetailModal('catalogue')}
          className="p-3.5 bg-white border border-secondary/30 shadow-sm hover:shadow-md hover:border-teal-500/80 transition-all rounded-2xl cursor-pointer group"
          title="Cliquer pour afficher les détails du Catalogue et du Stock"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 rounded-xl bg-teal-50 flex items-center justify-center text-primary group-hover:scale-105 transition-transform">
              <Package className="w-4 h-4" />
            </div>
            <div className="flex items-center gap-1">
              <span className="px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider bg-teal-50 text-teal-800 rounded-md">Catalogue</span>
              <span className="text-[9px] font-bold text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200 group-hover:bg-teal-600 group-hover:text-white transition-all flex items-center gap-0.5">
                Détails <ChevronRight className="w-2.5 h-2.5" />
              </span>
            </div>
          </div>
          <p className="text-sm xs:text-base sm:text-xl font-black text-[#1C2321] truncate font-serif">
            {products.length} <span className="text-[10px] font-sans font-normal text-gray-400">Articles</span>
          </p>
          <p className="text-[9px] font-bold uppercase tracking-widest text-primary/60 mt-0.5">Articles en Stock</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          onClick={() => setActiveDetailModal('actions_required')}
          className={cn(
            "p-3.5 bg-white border border-secondary/30 shadow-sm hover:shadow-md transition-all rounded-2xl cursor-pointer group",
            lowStockCount > 0 ? "hover:border-red-500/80" : "hover:border-amber-500/80"
          )}
          title="Cliquer pour afficher les alertes et actions requises"
        >
          <div className="flex items-center justify-between mb-2">
            <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform", lowStockCount > 0 ? "bg-red-50 text-red-600" : "bg-amber-50 text-[#C5A059]")}>
              <AlertCircle className="w-4 h-4" />
            </div>
            <div className="flex items-center gap-1">
              <span className={cn("px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider rounded-md", lowStockCount > 0 ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800")}>
                {lowStockCount > 0 ? 'Action Requise' : 'OK'}
              </span>
              <span className={cn(
                "text-[9px] font-bold px-1.5 py-0.5 rounded border transition-all flex items-center gap-0.5",
                lowStockCount > 0 
                  ? "text-red-700 bg-red-50 border-red-200 group-hover:bg-red-600 group-hover:text-white" 
                  : "text-amber-700 bg-amber-50 border-amber-200 group-hover:bg-amber-600 group-hover:text-white"
              )}>
                Détails <ChevronRight className="w-2.5 h-2.5" />
              </span>
            </div>
          </div>
          <p className={cn("text-sm xs:text-base sm:text-xl font-black truncate font-serif", lowStockCount > 0 ? "text-red-600" : "text-[#1C2321]")}>
            {lowStockCount} <span className="text-[10px] font-sans font-normal text-gray-400">Alertes</span>
          </p>
          <p className="text-[9px] font-bold uppercase tracking-widest text-primary/60 mt-0.5">Stock Faible</p>
        </motion.div>
      </div>

      {/* Section: Ventes par Lieux de Consommation */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-secondary/30 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
          <div>
            <h2 className="text-base sm:text-lg font-bold font-serif text-[#1C2321] flex items-center gap-2">
              <MapPin className="w-5 h-5 text-primary" />
              Ventes par Lieu de Consommation
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Statistiques quotidiennes ventilées par espace (Terrasse, Restaurant, Salon VIP, Réception).
            </p>
          </div>

          {/* Location Selector Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            {isManagerOrAdmin && (
              <button
                onClick={() => setSelectedLocation('Tous')}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5",
                  selectedLocation === 'Tous'
                    ? "bg-primary text-white shadow-md"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                )}
              >
                <Layers className="w-3.5 h-3.5" /> Tous les lieux
              </button>
            )}
            {LOCATION_CONFIG.map(loc => {
              const LocIcon = loc.icon;
              const isSelected = selectedLocation === loc.id;
              return (
                <button
                  key={loc.id}
                  onClick={() => setSelectedLocation(loc.id)}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 border",
                    isSelected
                      ? "bg-[#0D5C53] text-white border-[#0D5C53] shadow-md"
                      : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                  )}
                >
                  <LocIcon className={cn("w-3.5 h-3.5", isSelected ? "text-white" : loc.iconColor)} />
                  <span>{loc.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Location Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 pt-2">
          {locationStats.map((loc) => {
            const Icon = loc.icon;
            const isSelected = selectedLocation === loc.id;

            return (
              <div
                key={loc.id}
                onClick={() => setSelectedLocation(loc.id)}
                className={cn(
                  "p-4 sm:p-5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between space-y-4 relative group",
                  isSelected 
                    ? "border-primary bg-primary/5 shadow-md ring-2 ring-primary/20" 
                    : `${loc.bgColor} ${loc.borderColor} hover:border-primary/50 hover:shadow-sm`
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center bg-white shadow-xs", loc.iconColor)}>
                      <Icon className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-xs text-[#1C2321]">{loc.label}</h3>
                      <p className="text-[9px] text-gray-500 leading-none">{loc.description}</p>
                    </div>
                  </div>
                  {isSelected && (
                    <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  )}
                </div>

                <div>
                  <div className="flex items-baseline justify-between">
                    <p className="text-lg font-black text-[#1C2321] font-serif">
                      {loc.todayRevenue.toLocaleString()} <span className="text-[10px] font-sans text-gray-400">FCFA</span>
                    </p>
                    <span className="text-xs font-bold text-gray-600">
                      {loc.todaySalesCount} vtes
                    </span>
                  </div>

                  {/* Progress bar showing % of today's total revenue */}
                  {isManagerOrAdmin && globalTodayRevenue > 0 && (
                    <div className="mt-2 space-y-1">
                      <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary transition-all duration-500" 
                          style={{ width: `${Math.min(100, loc.percentageOfToday)}%` }}
                        />
                      </div>
                      <p className="text-[9px] font-bold text-gray-400 text-right">
                        {loc.percentageOfToday.toFixed(1)}% du CA jour
                      </p>
                    </div>
                  )}
                </div>

                <div className="pt-1 border-t border-black/5 flex items-center justify-between text-[10px] font-bold text-primary group-hover:underline">
                  <span>Filtrer ce lieu</span>
                  <ChevronRight className="w-3 h-3" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Row 2: Recent Sales & Low Stock List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8">
        {/* Recent Sales Panel */}
        <div className="p-4 sm:p-6 bg-white border border-secondary/30 shadow-sm rounded-2xl">
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <h3 className="text-base sm:text-xl font-bold tracking-tight font-serif text-[#1C2321] flex items-center gap-2">
              <TrendingUp className="w-4 h-4 sm:w-5 h-5 text-primary" />
              Ventes Récentes {selectedLocation !== 'Tous' && <span className="text-xs font-sans font-normal text-primary bg-primary/10 px-2 py-0.5 rounded-full">Zone : {selectedLocation}</span>}
            </h3>
            {selectedLocation !== 'Tous' && (
              <button 
                onClick={() => setSelectedLocation('Tous')}
                className="text-xs text-primary font-bold hover:underline cursor-pointer"
              >
                Réinitialiser filtre
              </button>
            )}
          </div>

          <div className="space-y-2 sm:space-y-4">
            {filteredRecentSales.length > 0 ? (
              filteredRecentSales.slice(0, selectedLocation === 'Tous' ? 8 : 25).map((sale) => {
                const roleText = sale.sellerRole ? ` (${sale.sellerRole})` : '';
                const itemsText = sale.items?.map(i => `${i.quantity} ${i.productName}`).join(', ') || 'des articles';
                const roomText = sale.roomId ? ` (Chambre ${rooms?.find(r => r.id === sale.roomId)?.number || sale.roomId})` : '';
                const locationBadge = sale.location || (sale.bookingId || sale.id.startsWith('booking_') ? 'Réception' : 'Terrasse');

                return (
                  <div key={sale.id} className="flex items-center justify-between py-2.5 sm:py-3 border-b border-secondary/20 last:border-0 gap-2">
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                        <span className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-gray-100 text-gray-700 rounded-md">
                          {locationBadge}
                        </span>
                        <span className="text-[10px] font-bold text-primary/80 flex items-center gap-1 bg-primary/5 px-2 py-0.5 rounded-md">
                          <Calendar className="w-2.5 h-2.5 text-primary/70 shrink-0" />
                          <span>{format(parseDate(sale.timestamp), "dd/MM/yyyy 'à' HH:mm", { locale: fr })}</span>
                        </span>
                      </div>
                      <p className="font-bold text-xs sm:text-sm text-[#1C2321] leading-tight line-clamp-2">
                        {sale.sellerName}{roleText} : {itemsText}{roomText}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                      <p className="font-bold text-xs sm:text-sm text-primary whitespace-nowrap font-serif">{sale.totalPrice.toLocaleString()} FCFA</p>
                      
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={() => setPrintingSale(sale)}
                          className="p-1.5 sm:p-2 hover:bg-primary/10 text-primary rounded-full transition-colors cursor-pointer"
                          title="Imprimer le reçu"
                        >
                          <Printer className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </button>

                        {isManagerOrAdmin && (
                          <button 
                            onClick={() => handleDeleteSale(sale)}
                            className="p-1.5 sm:p-2 hover:bg-red-50 text-red-500 rounded-full transition-colors cursor-pointer"
                            title="Supprimer la vente"
                          >
                            <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-8 text-center text-gray-400 text-xs italic">
                Aucune vente récente enregistrée pour la zone sélectionnée ({selectedLocation}).
              </div>
            )}
          </div>
        </div>

        {/* Low Stock Articles Panel */}
        <div className="p-4 sm:p-6 bg-white border border-secondary/30 shadow-sm rounded-2xl">
          <h3 className="text-base sm:text-xl font-bold tracking-tight font-serif text-[#1C2321] mb-4 sm:mb-6 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 sm:w-5 h-5 text-red-500" />
            Articles en rupture ou stock faible
          </h3>
          <div className="space-y-2 sm:space-y-4">
            {products.filter(p => p.stock <= LOW_STOCK_THRESHOLD).length > 0 ? (
              products.filter(p => p.stock <= LOW_STOCK_THRESHOLD).slice(0, 7).map((product) => (
                <div key={product.id} className="flex items-center justify-between py-2 sm:py-3 border-b border-secondary/20 last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-xs sm:text-sm text-[#1C2321] truncate">{product.name}</p>
                    <p className="text-[8px] sm:text-[10px] font-bold opacity-60 uppercase tracking-widest text-primary truncate">{product.category}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className={cn(
                      "px-2 py-0.5 sm:px-3 sm:py-1 text-[8px] sm:text-[10px] font-bold uppercase border rounded-full",
                      product.stock === 0 ? "bg-red-50 text-red-600 border-red-100" : "bg-amber-50 text-amber-600 border-amber-100"
                    )}>
                      Stock Total: {product.stock}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-gray-400 text-xs italic">
                Aucun article en rupture de stock actuellement.
              </div>
            )}
          </div>
        </div>


      </div>

      {/* Activity Details Modal (Global Total, Global Jour, Catalogue, Actions Requises) */}
      {activeDetailModal && (
        <DashboardModuleDetails
          type={activeDetailModal}
          onClose={() => setActiveDetailModal(null)}
          sales={sales}
          unrecordedBookings={unrecordedBookings}
          products={products}
          cumulativePeriodLabel={cumulativePeriodLabel}
          globalTotalRevenue={globalTotalRevenue}
          globalTodayRevenue={globalTodayRevenue}
          globalTodayCount={globalTodayCount}
          lowStockCount={lowStockCount}
          rooms={rooms}
          onPrintSale={(sale) => setPrintingSale(sale)}
        />
      )}

      {/* Invoice Printing Overlay */}
      {printingSale && (
        <Receipt 
          sale={printingSale} 
          onClose={() => setPrintingSale(null)} 
          settings={settings} 
        />
      )}

      <ConfirmModal
        isOpen={!!dashboardSaleToDelete}
        title="Supprimer la facture / vente"
        message="🚨 ATTENTION : Êtes-vous sûr de vouloir supprimer cette facture/vente ?\n\nCette action supprimera l'enregistrement de la comptabilité et RESTAURERA le stock des produits associés."
        confirmLabel="Supprimer"
        onConfirm={() => dashboardSaleToDelete && executeDeleteDashboardSale(dashboardSaleToDelete)}
        onClose={() => setDashboardSaleToDelete(null)}
      />
    </div>
  );
};
