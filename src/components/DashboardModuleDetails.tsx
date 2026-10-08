import React, { useState, useMemo } from 'react';
import { Product, Sale, Booking, Room, PaymentMethod } from '../types';
import { 
  X, 
  Search, 
  TrendingUp, 
  ShoppingCart, 
  Package, 
  AlertCircle, 
  Calendar, 
  Printer, 
  Filter, 
  CheckCircle2, 
  AlertTriangle, 
  Coins, 
  CreditCard, 
  Smartphone, 
  Bed, 
  ArrowUpDown,
  Download,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn, parseDate } from '../lib/utils';
import { LOW_STOCK_THRESHOLD } from '../constants';

export type DashboardModalType = 'global_total' | 'global_today' | 'catalogue' | 'actions_required' | null;

interface DashboardModuleDetailsProps {
  type: DashboardModalType;
  onClose: () => void;
  sales: Sale[];
  unrecordedBookings: Booking[];
  products: Product[];
  cumulativePeriodLabel: string;
  globalTotalRevenue: number;
  globalTodayRevenue: number;
  globalTodayCount: number;
  lowStockCount: number;
  rooms?: Room[];
  onPrintSale?: (sale: Sale) => void;
}

export const DashboardModuleDetails: React.FC<DashboardModuleDetailsProps> = ({
  type,
  onClose,
  sales,
  unrecordedBookings,
  products,
  cumulativePeriodLabel,
  globalTotalRevenue,
  globalTodayRevenue,
  globalTodayCount,
  lowStockCount,
  rooms = [],
  onPrintSale
}) => {
  if (!type) return null;

  // Search & Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<'all' | 'pos' | 'booking'>('all');
  const [selectedLocationFilter, setSelectedLocationFilter] = useState<string>('all');
  const [selectedPaymentFilter, setSelectedPaymentFilter] = useState<string>('all');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [selectedUrgencyFilter, setSelectedUrgencyFilter] = useState<'all' | 'out_of_stock' | 'low_stock'>('all');

  // Today reference
  const today = new Date();

  // Convert unrecorded bookings into unified activity format
  const unrecordedBookingActivities = useMemo(() => {
    return unrecordedBookings.map(b => {
      let pm: PaymentMethod = 'Cash';
      const rawPm = String(b.paymentMethod || '').toLowerCase();
      if (rawPm.includes('card') || rawPm.includes('carte')) pm = 'Card';
      else if (rawPm.includes('mobile') || rawPm.includes('wave') || rawPm.includes('orange') || rawPm.includes('moov')) pm = 'Mobile Money';

      const saleFormat: Sale = {
        id: `booking_${b.id}`,
        totalPrice: b.totalPaid || 0,
        paymentMethod: pm,
        sellerId: (b as any).receptionistId || 'reception',
        sellerName: (b as any).receptionistName || 'Réceptionniste',
        sellerRole: 'receptionist',
        location: 'Réception',
        timestamp: b.timestamp || (b as any).createdAt || (b as any).paymentDate || (b as any).checkInDate || b.checkOutDate,
        items: [{
          productId: 'room_stay',
          productName: `Séjour Chambre #${b.roomNumber} (${b.guestName || 'Client'})`,
          quantity: b.totalNights || 1,
          price: b.totalPaid || 0,
          category: 'Hébergement'
        }],
        paymentStatus: 'Completed',
        bookingId: b.id
      };
      return saleFormat;
    });
  }, [unrecordedBookings]);

  // Combined all activities (Sales + Unrecorded Bookings)
  const allActivities = useMemo(() => {
    return [...sales, ...unrecordedBookingActivities].sort((a, b) => {
      const dateA = parseDate(a.timestamp).getTime();
      const dateB = parseDate(b.timestamp).getTime();
      return dateB - dateA;
    });
  }, [sales, unrecordedBookingActivities]);

  // Combined Today's activities
  const todayActivities = useMemo(() => {
    return allActivities.filter(item => {
      const itemDate = parseDate(item.timestamp);
      return today.toDateString() === itemDate.toDateString();
    });
  }, [allActivities, today]);

  // Calculate Breakdown for Global Total
  const posSalesRevenue = useMemo(() => {
    return sales.reduce((acc, sale) => acc + (sale.totalPrice || sale.items?.reduce((sum, item) => sum + item.price * item.quantity, 0) || 0), 0);
  }, [sales]);

  const bookingRevenues = useMemo(() => {
    return unrecordedBookings.reduce((sum, b) => sum + (b.totalPaid || 0), 0);
  }, [unrecordedBookings]);

  // Normalization helper for diacritics/accents
  const normalizeLoc = (str?: string) => {
    if (!str) return '';
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  };

  // Flexible location matcher for activity details
  const matchesActivityLocation = (item: Sale, filterLoc: string) => {
    if (filterLoc === 'all') return true;
    const target = normalizeLoc(filterLoc);
    const loc = normalizeLoc(item.location || (item.bookingId || item.id.startsWith('booking_') ? 'Réception' : 'Terrasse'));

    if (target === 'reception') {
      return (
        loc.includes('recept') || 
        loc.includes('hotel') || 
        loc.includes('chambre') || 
        loc.includes('heberg') || 
        item.bookingId != null || 
        item.id.startsWith('booking_') || 
        item.sellerRole === 'receptionist' ||
        item.items?.some(i => {
          const cat = normalizeLoc(i.category);
          const name = normalizeLoc(i.productName);
          return cat === 'hebergement' || cat === 'hotel' || name.includes('chambre') || name.includes('sejour');
        })
      );
    }
    if (target === 'restaurant') return loc.includes('rest') || loc.includes('resto');
    if (target === 'vip') return loc.includes('vip');
    if (target === 'terrasse') return loc.includes('terrasse');
    if (target === 'chicha') return loc.includes('chicha') || loc.includes('shisha');

    return loc === target;
  };

  // Filtered Activities for Global Total
  const filteredGlobalTotalActivities = useMemo(() => {
    return allActivities.filter(item => {
      const isBooking = item.id.startsWith('booking_') || !!item.bookingId;
      
      // Type filter
      if (selectedTypeFilter === 'pos' && isBooking) return false;
      if (selectedTypeFilter === 'booking' && !isBooking) return false;

      // Location filter
      if (!matchesActivityLocation(item, selectedLocationFilter)) return false;

      // Payment filter
      if (selectedPaymentFilter !== 'all') {
        const pm = String(item.paymentMethod || '').toLowerCase();
        if (!pm.includes(selectedPaymentFilter.toLowerCase())) return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const sellerMatch = item.sellerName?.toLowerCase().includes(q);
        const locMatch = item.location?.toLowerCase().includes(q);
        const idMatch = item.id.toLowerCase().includes(q);
        const itemsMatch = item.items?.some(i => i.productName.toLowerCase().includes(q) || i.category?.toLowerCase().includes(q));
        const roomMatch = item.roomId ? rooms.some(r => r.id === item.roomId && r.number.toLowerCase().includes(q)) : false;
        if (!sellerMatch && !locMatch && !idMatch && !itemsMatch && !roomMatch) return false;
      }

      return true;
    });
  }, [allActivities, selectedTypeFilter, selectedLocationFilter, selectedPaymentFilter, searchQuery, rooms]);

  // Filtered Activities for Global Today
  const filteredTodayActivities = useMemo(() => {
    return todayActivities.filter(item => {
      // Location filter
      if (!matchesActivityLocation(item, selectedLocationFilter)) return false;

      // Payment filter
      if (selectedPaymentFilter !== 'all') {
        const pm = String(item.paymentMethod || '').toLowerCase();
        if (!pm.includes(selectedPaymentFilter.toLowerCase())) return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const sellerMatch = item.sellerName?.toLowerCase().includes(q);
        const locMatch = item.location?.toLowerCase().includes(q);
        const idMatch = item.id.toLowerCase().includes(q);
        const itemsMatch = item.items?.some(i => i.productName.toLowerCase().includes(q));
        if (!sellerMatch && !locMatch && !idMatch && !itemsMatch) return false;
      }

      return true;
    });
  }, [todayActivities, selectedLocationFilter, selectedPaymentFilter, searchQuery]);

  // Filtered Products for Catalogue
  const allCategories = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [products]);

  const filteredCatalogueProducts = useMemo(() => {
    return products.filter(p => {
      // Category filter
      if (selectedCategoryFilter !== 'all' && p.category !== selectedCategoryFilter) {
        return false;
      }

      // Stock status filter
      if (selectedUrgencyFilter === 'out_of_stock' && p.stock > 0) return false;
      if (selectedUrgencyFilter === 'low_stock' && (p.stock === 0 || p.stock > LOW_STOCK_THRESHOLD)) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const nameMatch = p.name.toLowerCase().includes(q);
        const catMatch = p.category?.toLowerCase().includes(q);
        if (!nameMatch && !catMatch) return false;
      }

      return true;
    });
  }, [products, selectedCategoryFilter, selectedUrgencyFilter, searchQuery]);

  // Filtered Actions Required (Low Stock & Out of Stock)
  const lowStockProducts = useMemo(() => {
    return products.filter(p => p.stock <= LOW_STOCK_THRESHOLD);
  }, [products]);

  const filteredActionProducts = useMemo(() => {
    return lowStockProducts.filter(p => {
      if (selectedUrgencyFilter === 'out_of_stock' && p.stock > 0) return false;
      if (selectedUrgencyFilter === 'low_stock' && p.stock === 0) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const nameMatch = p.name.toLowerCase().includes(q);
        const catMatch = p.category?.toLowerCase().includes(q);
        if (!nameMatch && !catMatch) return false;
      }

      return true;
    }).sort((a, b) => a.stock - b.stock); // Out of stock first
  }, [lowStockProducts, selectedUrgencyFilter, searchQuery]);

  // Total stock inventory value
  const totalInventoryValue = useMemo(() => {
    return products.reduce((acc, p) => acc + (p.price * (p.stock || 0)), 0);
  }, [products]);

  // Render Payment Icon / Badge
  const renderPaymentBadge = (method: string) => {
    const m = String(method || 'Cash').toLowerCase();
    if (m.includes('card') || m.includes('carte')) {
      return (
        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1 w-fit">
          <CreditCard className="w-3 h-3" /> Carte
        </span>
      );
    }
    if (m.includes('mobile') || m.includes('wave') || m.includes('orange') || m.includes('moov')) {
      return (
        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1 w-fit">
          <Smartphone className="w-3 h-3" /> Mobile
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1 w-fit">
        <Coins className="w-3 h-3" /> Espèces
      </span>
    );
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto bg-black/60 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl border border-secondary/30 flex flex-col max-h-[92vh] overflow-hidden"
        >
          {/* MODAL HEADER */}
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-4 bg-gray-50/60 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className={cn(
                "w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-xs",
                type === 'global_total' && "bg-emerald-100 text-emerald-700",
                type === 'global_today' && "bg-blue-100 text-blue-700",
                type === 'catalogue' && "bg-teal-100 text-primary",
                type === 'actions_required' && "bg-red-100 text-red-600"
              )}>
                {type === 'global_total' && <TrendingUp className="w-5 h-5" />}
                {type === 'global_today' && <ShoppingCart className="w-5 h-5" />}
                {type === 'catalogue' && <Package className="w-5 h-5" />}
                {type === 'actions_required' && <AlertCircle className="w-5 h-5" />}
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base sm:text-lg font-bold font-serif text-[#1C2321] truncate">
                    {type === 'global_total' && "Détails du Chiffre d'Affaires Global"}
                    {type === 'global_today' && "Détails des Ventes et Activités du Jour"}
                    {type === 'catalogue' && "Détails du Catalogue & Articles en Stock"}
                    {type === 'actions_required' && "Détails des Actions Requises & Alertes"}
                  </h2>
                  
                  {type === 'global_total' && (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100/80 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-emerald-700" />
                      {cumulativePeriodLabel}
                    </span>
                  )}
                  {type === 'global_today' && (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100/80 text-blue-800 border border-blue-200 flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-blue-700" />
                      {format(today, "EEEE d MMMM yyyy", { locale: fr })}
                    </span>
                  )}
                  {type === 'actions_required' && (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-200 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      {lowStockCount} alerte{lowStockCount > 1 ? 's' : ''} active{lowStockCount > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 font-medium truncate mt-0.5">
                  {type === 'global_total' && "Consultation détaillée de toutes les transactions et séjours cumulés."}
                  {type === 'global_today' && "Suivi en temps réel des encaissements et ventes enregistrés aujourd'hui."}
                  {type === 'catalogue' && "Inventaire complet, quantités disponibles, prix unitaires et valeur marchande."}
                  {type === 'actions_required' && "Articles en rupture de stock ou nécessitant un réapprovisionnement urgent."}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-all cursor-pointer shrink-0"
              title="Fermer la fenêtre"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* KPI SUMMARY CARDS */}
          <div className="p-4 sm:p-5 border-b border-gray-100 bg-white grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
            {type === 'global_total' && (
              <>
                <div className="p-3 bg-emerald-50/50 border border-emerald-100 rounded-2xl">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">Total Encaissé (Cumul)</span>
                  <p className="text-lg sm:text-xl font-black font-serif text-[#1C2321] mt-0.5">
                    {globalTotalRevenue.toLocaleString()} <span className="text-xs font-sans font-normal text-gray-500">FCFA</span>
                  </p>
                  <p className="text-[10px] text-emerald-700 font-medium mt-0.5">{allActivities.length} opérations au total</p>
                </div>

                <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-2xl">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-800">Ventes Directes (POS)</span>
                  <p className="text-lg sm:text-xl font-black font-serif text-[#1C2321] mt-0.5">
                    {posSalesRevenue.toLocaleString()} <span className="text-xs font-sans font-normal text-gray-500">FCFA</span>
                  </p>
                  <p className="text-[10px] text-blue-700 font-medium mt-0.5">{sales.length} tickets de vente</p>
                </div>

                <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-2xl">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-800">Séjours & Hébergement</span>
                  <p className="text-lg sm:text-xl font-black font-serif text-[#1C2321] mt-0.5">
                    {bookingRevenues.toLocaleString()} <span className="text-xs font-sans font-normal text-gray-500">FCFA</span>
                  </p>
                  <p className="text-[10px] text-indigo-700 font-medium mt-0.5">{unrecordedBookings.length} séjours réception</p>
                </div>

                <div className="p-3 bg-amber-50/50 border border-amber-100 rounded-2xl">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800">Période Historique</span>
                  <p className="text-sm sm:text-base font-bold font-serif text-[#1C2321] mt-0.5 truncate">
                    {cumulativePeriodLabel}
                  </p>
                  <p className="text-[10px] text-amber-700 font-medium mt-0.5">Zéro double comptage</p>
                </div>
              </>
            )}

            {type === 'global_today' && (
              <>
                <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-2xl">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-800">Chiffre du Jour</span>
                  <p className="text-lg sm:text-xl font-black font-serif text-[#1C2321] mt-0.5">
                    {globalTodayRevenue.toLocaleString()} <span className="text-xs font-sans font-normal text-gray-500">FCFA</span>
                  </p>
                  <p className="text-[10px] text-blue-700 font-medium mt-0.5">{todayActivities.length} transactions aujourd'hui</p>
                </div>

                <div className="p-3 bg-emerald-50/50 border border-emerald-100 rounded-2xl">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">Volume Transactions</span>
                  <p className="text-lg sm:text-xl font-black font-serif text-[#1C2321] mt-0.5">
                    {globalTodayCount} <span className="text-xs font-sans font-normal text-gray-500">tickets</span>
                  </p>
                  <p className="text-[10px] text-emerald-700 font-medium mt-0.5">Clients servis ce jour</p>
                </div>

                <div className="p-3 bg-purple-50/50 border border-purple-100 rounded-2xl">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-purple-800">Panier Moyen</span>
                  <p className="text-lg sm:text-xl font-black font-serif text-[#1C2321] mt-0.5">
                    {Math.round(globalTodayRevenue / (globalTodayCount || 1)).toLocaleString()} <span className="text-xs font-sans font-normal text-gray-500">FCFA</span>
                  </p>
                  <p className="text-[10px] text-purple-700 font-medium mt-0.5">Par commande/séjour</p>
                </div>

                <div className="p-3 bg-teal-50/50 border border-teal-100 rounded-2xl">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-teal-800">Lieux Actifs</span>
                  <p className="text-lg sm:text-xl font-black font-serif text-[#1C2321] mt-0.5">
                    {new Set(todayActivities.map(a => a.location || 'Terrasse')).size} <span className="text-xs font-sans font-normal text-gray-500">zones</span>
                  </p>
                  <p className="text-[10px] text-teal-700 font-medium mt-0.5">Points de vente opérationnels</p>
                </div>
              </>
            )}

            {type === 'catalogue' && (
              <>
                <div className="p-3 bg-teal-50/50 border border-teal-100 rounded-2xl">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-teal-800">Total Références</span>
                  <p className="text-lg sm:text-xl font-black font-serif text-[#1C2321] mt-0.5">
                    {products.length} <span className="text-xs font-sans font-normal text-gray-500">articles</span>
                  </p>
                  <p className="text-[10px] text-teal-700 font-medium mt-0.5">{allCategories.length} catégories</p>
                </div>

                <div className="p-3 bg-emerald-50/50 border border-emerald-100 rounded-2xl">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">Valeur Marchande du Stock</span>
                  <p className="text-lg sm:text-xl font-black font-serif text-[#1C2321] mt-0.5">
                    {totalInventoryValue.toLocaleString()} <span className="text-xs font-sans font-normal text-gray-500">FCFA</span>
                  </p>
                  <p className="text-[10px] text-emerald-700 font-medium mt-0.5">Prix vente × stock actuel</p>
                </div>

                <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-2xl">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-800">Stock Conforme</span>
                  <p className="text-lg sm:text-xl font-black font-serif text-[#1C2321] mt-0.5">
                    {products.filter(p => p.stock > LOW_STOCK_THRESHOLD).length} <span className="text-xs font-sans font-normal text-gray-500">articles</span>
                  </p>
                  <p className="text-[10px] text-blue-700 font-medium mt-0.5">Niveau de stock optimal</p>
                </div>

                <div className="p-3 bg-amber-50/50 border border-amber-100 rounded-2xl">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800">En Alerte ou Rupture</span>
                  <p className="text-lg sm:text-xl font-black font-serif text-amber-700 mt-0.5">
                    {lowStockCount} <span className="text-xs font-sans font-normal text-gray-500">articles</span>
                  </p>
                  <p className="text-[10px] text-amber-700 font-medium mt-0.5">Stock ≤ {LOW_STOCK_THRESHOLD}</p>
                </div>
              </>
            )}

            {type === 'actions_required' && (
              <>
                <div className="p-3 bg-red-50/50 border border-red-100 rounded-2xl">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-red-800">Total Alertes Actives</span>
                  <p className="text-lg sm:text-xl font-black font-serif text-red-600 mt-0.5">
                    {lowStockCount} <span className="text-xs font-sans font-normal text-gray-500">produits</span>
                  </p>
                  <p className="text-[10px] text-red-700 font-medium mt-0.5">Sous le seuil d'alerte</p>
                </div>

                <div className="p-3 bg-red-100/60 border border-red-200 rounded-2xl">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-red-900">Ruptures Totales (0)</span>
                  <p className="text-lg sm:text-xl font-black font-serif text-red-700 mt-0.5">
                    {products.filter(p => p.stock === 0).length} <span className="text-xs font-sans font-normal text-gray-500">critiques</span>
                  </p>
                  <p className="text-[10px] text-red-800 font-medium mt-0.5">Indisponibles à la vente</p>
                </div>

                <div className="p-3 bg-amber-50/50 border border-amber-100 rounded-2xl">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800">Stock Faible Résiduel</span>
                  <p className="text-lg sm:text-xl font-black font-serif text-amber-700 mt-0.5">
                    {products.filter(p => p.stock > 0 && p.stock <= LOW_STOCK_THRESHOLD).length} <span className="text-xs font-sans font-normal text-gray-500">produits</span>
                  </p>
                  <p className="text-[10px] text-amber-800 font-medium mt-0.5">1 à {LOW_STOCK_THRESHOLD} unités restantes</p>
                </div>

                <div className="p-3 bg-gray-50 border border-gray-200 rounded-2xl">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-700">Action Recommandée</span>
                  <p className="text-sm font-bold text-[#1C2321] mt-0.5">
                    Réapprovisionnement
                  </p>
                  <p className="text-[10px] text-gray-500 font-medium mt-0.5">Émission bon de commande</p>
                </div>
              </>
            )}
          </div>

          {/* SEARCH & FILTERS BAR */}
          <div className="p-4 bg-gray-50/70 border-b border-gray-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={
                  type === 'catalogue' || type === 'actions_required'
                    ? "Rechercher un article, catégorie..."
                    : "Rechercher par vendeur, client, article, lieu, ID..."
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white rounded-xl border border-gray-200 text-xs text-[#1C2321] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-2xs"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Contextual Filters */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Type filter for Global Total */}
              {type === 'global_total' && (
                <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-gray-200 text-xs">
                  <button
                    onClick={() => setSelectedTypeFilter('all')}
                    className={cn(
                      "px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer",
                      selectedTypeFilter === 'all' ? "bg-primary text-white shadow-2xs" : "text-gray-600 hover:bg-gray-50"
                    )}
                  >
                    Tous ({allActivities.length})
                  </button>
                  <button
                    onClick={() => setSelectedTypeFilter('pos')}
                    className={cn(
                      "px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer",
                      selectedTypeFilter === 'pos' ? "bg-primary text-white shadow-2xs" : "text-gray-600 hover:bg-gray-50"
                    )}
                  >
                    Ventes POS ({sales.length})
                  </button>
                  <button
                    onClick={() => setSelectedTypeFilter('booking')}
                    className={cn(
                      "px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer",
                      selectedTypeFilter === 'booking' ? "bg-primary text-white shadow-2xs" : "text-gray-600 hover:bg-gray-50"
                    )}
                  >
                    Chambres ({unrecordedBookings.length})
                  </button>
                </div>
              )}

              {/* Location filter for sales */}
              {(type === 'global_total' || type === 'global_today') && (
                <select
                  value={selectedLocationFilter}
                  onChange={(e) => setSelectedLocationFilter(e.target.value)}
                  className="px-2.5 py-1.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-700 cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
                >
                  <option value="all">Tous les lieux</option>
                  <option value="Terrasse">Terrasse</option>
                  <option value="Restaurant">Restaurant</option>
                  <option value="VIP">Salon VIP</option>
                  <option value="Réception">Réception</option>
                  <option value="Chicha">Chicha</option>
                </select>
              )}

              {/* Payment filter for sales */}
              {(type === 'global_total' || type === 'global_today') && (
                <select
                  value={selectedPaymentFilter}
                  onChange={(e) => setSelectedPaymentFilter(e.target.value)}
                  className="px-2.5 py-1.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-700 cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
                >
                  <option value="all">Tous les paiements</option>
                  <option value="cash">Espèces</option>
                  <option value="card">Carte Bancaire</option>
                  <option value="mobile">Mobile Money</option>
                </select>
              )}

              {/* Category filter for Catalogue */}
              {type === 'catalogue' && (
                <select
                  value={selectedCategoryFilter}
                  onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                  className="px-2.5 py-1.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-700 cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
                >
                  <option value="all">Toutes catégories</option>
                  {allCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              )}

              {/* Urgency filter for Actions Required & Catalogue */}
              {(type === 'actions_required' || type === 'catalogue') && (
                <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-gray-200 text-xs">
                  <button
                    onClick={() => setSelectedUrgencyFilter('all')}
                    className={cn(
                      "px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer",
                      selectedUrgencyFilter === 'all' ? "bg-primary text-white shadow-2xs" : "text-gray-600 hover:bg-gray-50"
                    )}
                  >
                    Tous
                  </button>
                  <button
                    onClick={() => setSelectedUrgencyFilter('out_of_stock')}
                    className={cn(
                      "px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer",
                      selectedUrgencyFilter === 'out_of_stock' ? "bg-red-600 text-white shadow-2xs" : "text-red-700 hover:bg-red-50"
                    )}
                  >
                    Rupture (0)
                  </button>
                  <button
                    onClick={() => setSelectedUrgencyFilter('low_stock')}
                    className={cn(
                      "px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer",
                      selectedUrgencyFilter === 'low_stock' ? "bg-amber-600 text-white shadow-2xs" : "text-amber-700 hover:bg-amber-50"
                    )}
                  >
                    Stock Faible
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* MAIN SCROLLABLE CONTENT AREA */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
            {/* VIEW 1: GLOBAL TOTAL DETAILS */}
            {type === 'global_total' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-gray-500 font-bold px-1">
                  <span>{filteredGlobalTotalActivities.length} opération(s) affichée(s)</span>
                  <span>Total affiché : {filteredGlobalTotalActivities.reduce((s, a) => s + (a.totalPrice || 0), 0).toLocaleString()} FCFA</span>
                </div>

                {filteredGlobalTotalActivities.length > 0 ? (
                  <div className="border border-gray-200 rounded-2xl overflow-hidden shadow-2xs">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-gray-50/80 border-b border-gray-200 text-gray-500 font-bold uppercase tracking-wider text-[10px]">
                          <th className="p-3 pl-4">Date & Heure</th>
                          <th className="p-3">Source & Lieu</th>
                          <th className="p-3">Opérateur / Vendeur</th>
                          <th className="p-3">Prestations / Articles</th>
                          <th className="p-3">Paiement</th>
                          <th className="p-3 text-right">Montant</th>
                          <th className="p-3 pr-4 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {filteredGlobalTotalActivities.map((act) => {
                          const isBooking = act.id.startsWith('booking_') || !!act.bookingId;
                          const formattedDate = format(parseDate(act.timestamp), "dd/MM/yyyy 'à' HH:mm", { locale: fr });
                          const itemsSummary = act.items?.map(i => `${i.quantity}x ${i.productName}`).join(', ') || 'Vente directe';
                          const roomInfo = act.roomId ? ` (Chambre #${rooms.find(r => r.id === act.roomId)?.number || act.roomId})` : '';

                          return (
                            <tr key={act.id} className="hover:bg-gray-50/70 transition-colors">
                              <td className="p-3 pl-4 font-bold text-gray-700 whitespace-nowrap">
                                <div className="flex items-center gap-1.5">
                                  <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                  <span>{formattedDate}</span>
                                </div>
                              </td>

                              <td className="p-3 whitespace-nowrap">
                                <span className={cn(
                                  "px-2 py-0.5 rounded-md text-[10px] font-bold border",
                                  isBooking 
                                    ? "bg-indigo-50 text-indigo-800 border-indigo-200" 
                                    : "bg-emerald-50 text-emerald-800 border-emerald-200"
                                )}>
                                  {isBooking ? 'Hébergement' : (act.location || 'Terrasse')}
                                </span>
                              </td>

                              <td className="p-3 font-semibold text-gray-800 whitespace-nowrap">
                                <span>{act.sellerName || 'Personnel'}</span>
                                {act.sellerRole && <span className="text-[10px] text-gray-400 font-normal ml-1">({act.sellerRole})</span>}
                              </td>

                              <td className="p-3 text-gray-700 max-w-xs truncate font-medium" title={itemsSummary + roomInfo}>
                                {itemsSummary}{roomInfo}
                              </td>

                              <td className="p-3 whitespace-nowrap">
                                {renderPaymentBadge(act.paymentMethod)}
                              </td>

                              <td className="p-3 text-right font-black font-serif text-[#1C2321] whitespace-nowrap">
                                {act.totalPrice.toLocaleString()} <span className="text-[10px] font-sans font-normal text-gray-400">FCFA</span>
                              </td>

                              <td className="p-3 pr-4 text-center whitespace-nowrap">
                                {onPrintSale && (
                                  <button
                                    onClick={() => onPrintSale(act)}
                                    className="p-1.5 hover:bg-primary/10 text-primary rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1 text-[11px] font-bold"
                                    title="Imprimer le reçu"
                                  >
                                    <Printer className="w-3.5 h-3.5" />
                                    <span className="hidden sm:inline">Reçu</span>
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-12 text-center text-gray-400 text-xs italic bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                    Aucune transaction ne correspond aux critères de recherche actuels.
                  </div>
                )}
              </div>
            )}

            {/* VIEW 2: GLOBAL TODAY DETAILS */}
            {type === 'global_today' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-gray-500 font-bold px-1">
                  <span>{filteredTodayActivities.length} transaction(s) enregistrée(s) aujourd'hui</span>
                  <span>Recettes : {filteredTodayActivities.reduce((s, a) => s + (a.totalPrice || 0), 0).toLocaleString()} FCFA</span>
                </div>

                {filteredTodayActivities.length > 0 ? (
                  <div className="border border-gray-200 rounded-2xl overflow-hidden shadow-2xs">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-gray-50/80 border-b border-gray-200 text-gray-500 font-bold uppercase tracking-wider text-[10px]">
                          <th className="p-3 pl-4">Heure</th>
                          <th className="p-3">Lieu</th>
                          <th className="p-3">Opérateur</th>
                          <th className="p-3">Articles & Prestations</th>
                          <th className="p-3">Mode Paiement</th>
                          <th className="p-3 text-right">Montant</th>
                          <th className="p-3 pr-4 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {filteredTodayActivities.map((act) => {
                          const formattedTime = format(parseDate(act.timestamp), "HH:mm", { locale: fr });
                          const itemsSummary = act.items?.map(i => `${i.quantity}x ${i.productName}`).join(', ') || 'Vente directe';
                          const roomInfo = act.roomId ? ` (Chambre #${rooms.find(r => r.id === act.roomId)?.number || act.roomId})` : '';

                          return (
                            <tr key={act.id} className="hover:bg-gray-50/70 transition-colors">
                              <td className="p-3 pl-4 font-black text-gray-900 whitespace-nowrap">
                                <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md font-mono text-[11px] font-bold">
                                  {formattedTime}
                                </span>
                              </td>

                              <td className="p-3 whitespace-nowrap">
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-gray-100 text-gray-800 border border-gray-200">
                                  {act.location || 'Terrasse'}
                                </span>
                              </td>

                              <td className="p-3 font-semibold text-gray-800 whitespace-nowrap">
                                {act.sellerName || 'Personnel'}
                              </td>

                              <td className="p-3 text-gray-700 max-w-xs truncate font-medium" title={itemsSummary + roomInfo}>
                                {itemsSummary}{roomInfo}
                              </td>

                              <td className="p-3 whitespace-nowrap">
                                {renderPaymentBadge(act.paymentMethod)}
                              </td>

                              <td className="p-3 text-right font-black font-serif text-[#1C2321] whitespace-nowrap">
                                {act.totalPrice.toLocaleString()} <span className="text-[10px] font-sans font-normal text-gray-400">FCFA</span>
                              </td>

                              <td className="p-3 pr-4 text-center whitespace-nowrap">
                                {onPrintSale && (
                                  <button
                                    onClick={() => onPrintSale(act)}
                                    className="p-1.5 hover:bg-primary/10 text-primary rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1 text-[11px] font-bold"
                                    title="Imprimer le reçu"
                                  >
                                    <Printer className="w-3.5 h-3.5" />
                                    <span className="hidden sm:inline">Reçu</span>
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-12 text-center text-gray-400 text-xs italic bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                    Aucune vente enregistrée pour le moment aujourd'hui.
                  </div>
                )}
              </div>
            )}

            {/* VIEW 3: CATALOGUE & INVENTORY DETAILS */}
            {type === 'catalogue' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-gray-500 font-bold px-1">
                  <span>{filteredCatalogueProducts.length} référence(s) répertoriée(s)</span>
                  <span>Valeur totale affichée : {filteredCatalogueProducts.reduce((s, p) => s + (p.price * (p.stock || 0)), 0).toLocaleString()} FCFA</span>
                </div>

                {filteredCatalogueProducts.length > 0 ? (
                  <div className="border border-gray-200 rounded-2xl overflow-hidden shadow-2xs">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-gray-50/80 border-b border-gray-200 text-gray-500 font-bold uppercase tracking-wider text-[10px]">
                          <th className="p-3 pl-4">Nom de l'Article</th>
                          <th className="p-3">Catégorie</th>
                          <th className="p-3 text-right">Prix Unitaire</th>
                          <th className="p-3 text-center">Quantité Stock</th>
                          <th className="p-3">État du Stock</th>
                          <th className="p-3 pr-4 text-right">Valeur en Stock</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {filteredCatalogueProducts.map((prod) => {
                          const isOutOfStock = prod.stock === 0;
                          const isLowStock = prod.stock > 0 && prod.stock <= LOW_STOCK_THRESHOLD;
                          const stockValue = prod.price * (prod.stock || 0);

                          return (
                            <tr key={prod.id} className="hover:bg-gray-50/70 transition-colors">
                              <td className="p-3 pl-4 font-bold text-[#1C2321]">
                                {prod.name}
                              </td>

                              <td className="p-3">
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
                                  {prod.category || 'Général'}
                                </span>
                              </td>

                              <td className="p-3 text-right font-serif font-bold text-gray-700">
                                {prod.price.toLocaleString()} FCFA
                              </td>

                              <td className="p-3 text-center font-bold">
                                <span className={cn(
                                  "px-2.5 py-0.5 rounded-full text-xs font-black",
                                  isOutOfStock ? "bg-red-100 text-red-700" :
                                  isLowStock ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
                                )}>
                                  {prod.stock}
                                </span>
                              </td>

                              <td className="p-3">
                                {isOutOfStock ? (
                                  <span className="text-red-600 font-bold flex items-center gap-1 text-[11px]">
                                    <AlertTriangle className="w-3.5 h-3.5" /> En Rupture
                                  </span>
                                ) : isLowStock ? (
                                  <span className="text-amber-600 font-bold flex items-center gap-1 text-[11px]">
                                    <AlertCircle className="w-3.5 h-3.5" /> Stock Faible (≤{LOW_STOCK_THRESHOLD})
                                  </span>
                                ) : (
                                  <span className="text-emerald-600 font-bold flex items-center gap-1 text-[11px]">
                                    <CheckCircle2 className="w-3.5 h-3.5" /> Disponible
                                  </span>
                                )}
                              </td>

                              <td className="p-3 pr-4 text-right font-black font-serif text-[#1C2321]">
                                {stockValue.toLocaleString()} <span className="text-[10px] font-sans font-normal text-gray-400">FCFA</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-12 text-center text-gray-400 text-xs italic bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                    Aucun article trouvé dans le catalogue avec les filtres sélectionnés.
                  </div>
                )}
              </div>
            )}

            {/* VIEW 4: ACTIONS REQUIRED (STOCK ALERTS) */}
            {type === 'actions_required' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-gray-500 font-bold px-1">
                  <span>{filteredActionProducts.length} article(s) nécessitant une action immédiate</span>
                  <span className="text-red-600 font-bold">Seuil d'alerte : ≤ {LOW_STOCK_THRESHOLD} unités</span>
                </div>

                {filteredActionProducts.length > 0 ? (
                  <div className="border border-red-200/60 rounded-2xl overflow-hidden shadow-2xs">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-red-50/70 border-b border-red-200/60 text-red-900 font-bold uppercase tracking-wider text-[10px]">
                          <th className="p-3 pl-4">Urgence</th>
                          <th className="p-3">Article Concerné</th>
                          <th className="p-3">Catégorie</th>
                          <th className="p-3 text-center">Stock Restant</th>
                          <th className="p-3 text-center">Seuil Configuré</th>
                          <th className="p-3 pr-4">Action Requise Conseillée</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {filteredActionProducts.map((prod) => {
                          const isZero = prod.stock === 0;

                          return (
                            <tr key={prod.id} className={cn("hover:bg-red-50/30 transition-colors", isZero && "bg-red-50/20")}>
                              <td className="p-3 pl-4 whitespace-nowrap">
                                {isZero ? (
                                  <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-600 text-white flex items-center gap-1 w-fit animate-pulse">
                                    <AlertTriangle className="w-3 h-3" /> Critique (0)
                                  </span>
                                ) : (
                                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1 w-fit">
                                    <AlertCircle className="w-3 h-3" /> Alerte Stock
                                  </span>
                                )}
                              </td>

                              <td className="p-3 font-bold text-[#1C2321]">
                                {prod.name}
                              </td>

                              <td className="p-3">
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-gray-100 text-gray-700">
                                  {prod.category}
                                </span>
                              </td>

                              <td className="p-3 text-center">
                                <span className={cn(
                                  "px-2.5 py-0.5 rounded-full font-black text-xs inline-block",
                                  isZero ? "bg-red-100 text-red-700 font-mono" : "bg-amber-100 text-amber-800"
                                )}>
                                  {prod.stock} restant{prod.stock > 1 ? 's' : ''}
                                </span>
                              </td>

                              <td className="p-3 text-center font-bold text-gray-500">
                                {LOW_STOCK_THRESHOLD}
                              </td>

                              <td className="p-3 pr-4">
                                {isZero ? (
                                  <span className="font-bold text-red-600 flex items-center gap-1 text-[11px]">
                                    🚨 Commande fournisseur immédiate (Rupture complète)
                                  </span>
                                ) : (
                                  <span className="font-bold text-amber-700 flex items-center gap-1 text-[11px]">
                                    ⚠️ Prévoir réapprovisionnement sous 24h
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-12 text-center text-emerald-600 text-xs italic bg-emerald-50/50 rounded-2xl border border-dashed border-emerald-200">
                    <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
                    Excellente nouvelle ! Tous les articles ont un niveau de stock supérieur au seuil d'alerte.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* MODAL FOOTER */}
          <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/60 flex items-center justify-between gap-3 shrink-0">
            <div className="text-[11px] text-gray-500 font-medium">
              💡 Cliquez sur le bouton <span className="font-bold text-gray-700">Fermer</span> ou appuyez sur <kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded text-[10px]">Échap</kbd> pour revenir au Tableau de Bord.
            </div>

            <button
              onClick={onClose}
              className="px-4 py-2 bg-[#1C2321] text-white hover:bg-black rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer"
            >
              Fermer
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
