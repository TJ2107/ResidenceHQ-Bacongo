import React, { useState, useEffect } from 'react';
import { Product, UserProfile, PaymentMethod, Room, AppSettings, SaleLocation, KitchenStatus, Hall, Sale, Expense, Booking } from '../types';
import { Search, Loader2, Plus, CreditCard, Banknote, Smartphone, Bed, Trash2, MapPin, LayoutGrid, Printer, Lock, Calculator, X, AlertCircle, Share2, FileText, Download, ChevronDown, ChevronUp, Layers, DollarSign, Package, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { cn, sendStockNotification, sendAppNotification, requestNotificationPermission, OperationType, handleFirestoreError, logEvent, parseDate } from '../lib/utils';
import { collection, updateDoc, doc, Timestamp, writeBatch, query, where, getDocs, addDoc, deleteDoc, getDoc, increment } from 'firebase/firestore';
import { db } from '../firebase';
import { Receipt } from './Receipt';
import { ConfirmModal } from './ConfirmModal';
import { LOW_STOCK_THRESHOLD } from '../constants';
import { generateClosureReportPDF } from '../lib/pdfUtils';
import { toast } from 'sonner';

export const POS = ({ products, user, settings, halls = [], isAdmin, isManager }: { products: Product[], user: UserProfile, settings?: AppSettings | null, halls?: Hall[], isAdmin?: boolean, isManager?: boolean }) => {
  const isManagerOrAdmin = isAdmin || isManager || user?.role === 'admin' || user?.role === 'manager' || user?.email?.toLowerCase() === 'cyber.kan587@gmail.com';
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<'Products' | 'Halls'>('Products');
  const [cart, setCart] = useState<{item: Product | Hall, quantity: number, type: 'product' | 'hall'}[]>([]);
  const [selling, setSelling] = useState(false);
  const [lastSale, setLastSale] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [selectedRoomId, setSelectedRoomId] = useState<string>('');
  const [occupiedRooms, setOccupiedRooms] = useState<Room[]>([]);
  const [location, setLocation] = useState<SaleLocation>(() => {
    if (user?.role === 'caissiere') return 'Terrasse';
    if (user?.role === 'receptionist') return 'Réception';
    return 'Terrasse';
  });
  const [tableNumber, setTableNumber] = useState<string>('');
  const [receptionOrientation, setReceptionOrientation] = useState<'Terrasse' | 'VIP' | 'Réception' | ''>('');
  const [guestName, setGuestName] = useState<string>('');

  // États pour la clôture de caisse
  const [isClosingRegister, setIsClosingRegister] = useState(false);
  const [selectedClosureDate, setSelectedClosureDate] = useState<string>(() => format(new Date(), 'yyyy-MM-dd'));
  const [closureLocationFilter, setClosureLocationFilter] = useState<string>(() => {
    if (isManager) return 'Tous';
    if (user?.role === 'caissiere') return 'Terrasse';
    if (user?.role === 'receptionist') return 'Réception';
    if (user?.role === 'serveur') return 'Restaurant';
    return 'Terrasse';
  });
  const [closureSalesList, setClosureSalesList] = useState<Sale[]>([]);
  const [closureExpensesList, setClosureExpensesList] = useState<Expense[]>([]);
  const [closureStockList, setClosureStockList] = useState<any[]>([]);
  const [showSalesDetailsInModal, setShowSalesDetailsInModal] = useState(false);
  const [showExpensesDetailsInModal, setShowExpensesDetailsInModal] = useState(false);
  const [showStockDetailsInModal, setShowStockDetailsInModal] = useState(false);
  const [closureStockSearch, setClosureStockSearch] = useState('');
  const [closureData, setClosureData] = useState<{
    cashSales: number;
    cardSales: number;
    mobileSales: number;
    roomSales: number;
    totalSales: number;
    count: number;
    location: string;
    totalExpenses: number;
    expensesCount: number;
    expensesList: Expense[];
    salesByLocation?: { [key: string]: number };
    stockSummary: {
      totalProductsCount: number;
      totalStockUnits: number;
      totalStockValue: number;
      lowStockCount: number;
    };
    stockList: any[];
  } | null>(null);
  const [physicalCash, setPhysicalCash] = useState('');
  const [closureNote, setClosureNote] = useState('');
  const [loadingClosureData, setLoadingClosureData] = useState(false);
  const [isSavingClosure, setIsSavingClosure] = useState(false);
  const [savedClosureReport, setSavedClosureReport] = useState<any | null>(null);
  const [posSaleToDelete, setPosSaleToDelete] = useState<any | null>(null);

  const executeDeletePOSSale = async (sale: any) => {
    try {
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

      const collectionName = sale.sourceCollection || 'sales';
      await deleteDoc(doc(db, collectionName, sale.id));
      
      toast.success("Vente supprimée et stock restauré.");
      fetchTodaySalesForClosure(closureLocationFilter, selectedClosureDate);
    } catch (error: any) {
      console.error("[POS] Error during deletion:", error);
      handleFirestoreError(error, OperationType.DELETE, 'sales');
    }
  };

  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const q = query(collection(db, 'rooms'), where('status', '==', 'Occupied'));
        const snap = await getDocs(q);
        setOccupiedRooms(snap.docs.map(d => ({ id: d.id, ...d.data() } as Room)));
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'rooms');
      }
    };
    fetchRooms();
  }, []);

  useEffect(() => {
    if (user.role === 'admin' || user.role === 'manager') {
      requestNotificationPermission();
    }
  }, [user.role]);

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.category.toLowerCase().includes(search.toLowerCase())
  );

  const filteredHalls = halls.filter(h => 
    h.name.toLowerCase().includes(search.toLowerCase()) ||
    h.type.toLowerCase().includes(search.toLowerCase())
  );

  const getProductStockForLocation = (product: Product, loc: SaleLocation) => {
    if (loc === 'Réception') return product.stockReception ?? 0;
    if (loc === 'VIP') return product.stockVip ?? 0;
    // Default or 'Terrasse', 'Bar', 'Restaurant' falls back to stockTerrasse (or product.stock if stockTerrasse is undefined)
    return product.stockTerrasse ?? product.stock ?? 0;
  };

  const addToCart = (item: Product | Hall, type: 'product' | 'hall') => {
    setCart(prev => {
      const existing = prev.find(i => i.item.id === item.id && i.type === type);
      if (existing) {
        if (type === 'product') {
          const product = item as Product;
          const locStock = getProductStockForLocation(product, location);
          if (existing.quantity < locStock) {
            return prev.map(i => (i.item.id === item.id && i.type === type) ? {...i, quantity: i.quantity + 1} : i);
          }
          return prev;
        }
        // For halls, quantity is usually 1
        return prev;
      }
      return [...prev, { item, quantity: 1, type }];
    });
  };

  const removeFromCart = (itemId: string, type: 'product' | 'hall') => {
    setCart(prev => prev.filter(i => !(i.item.id === itemId && i.type === type)));
  };

  const handleSell = async () => {
    const hasHall = cart.some(i => i.type === 'hall');
    
    if (cart.length === 0) return;
    if (paymentMethod === 'Room Charge' && !selectedRoomId) return;
    if (location === 'Réception' && !selectedRoomId && !hasHall) return;
    
    setSelling(true);
    try {
      const isKitchenItem = (item: any) => {
        const cat = (item.category || '').toLowerCase();
        const pName = (item.name || item.productName || '').toLowerCase();
        return cat === 'cuisine' || cat === 'nourriture' || cat === 'food' || cat.includes('déjeuner') || cat.includes('dejeuner') || cat.includes('snack') || cat.includes('repas') || pName.includes('poulet') || pName.includes('poisson') || pName.includes('plat');
      };

      // Classify cart items into groups: Kitchen (Food) and Bar/Drinks/Other
      const kitchenCart = cart.filter(i => isKitchenItem(i.item));
      const barCart = cart.filter(i => !isKitchenItem(i.item));

      const groupsToProcess: { items: typeof cart; targetLocation: string; isKitchen: boolean }[] = [];

      if (kitchenCart.length > 0) {
        const targetLoc = location === 'Réception' ? 'Réception' : 'Restaurant';
        groupsToProcess.push({ items: kitchenCart, targetLocation: targetLoc, isKitchen: true });
      }

      if (barCart.length > 0) {
        groupsToProcess.push({ items: barCart, targetLocation: location, isKitchen: false });
      }

      const batch = writeBatch(db);
      let lastCreatedSale: any = null;

      for (const group of groupsToProcess) {
        const groupTotal = group.items.reduce((sum, i) => sum + (i.item.price * i.quantity), 0);
        const groupTableNumber = tableNumber 
          ? (location !== group.targetLocation ? `[${location}] ${tableNumber}` : tableNumber)
          : (location !== group.targetLocation ? `Servi en ${location}` : null);

        const saleData: any = {
          items: group.items.map(i => ({
            productName: i.item.name,
            productId: i.item.id,
            category: i.type === 'product' ? (i.item as Product).category : (i.item as Hall).type,
            price: i.item.price,
            quantity: i.quantity,
            type: i.type
          })),
          totalPrice: groupTotal,
          timestamp: Timestamp.now(),
          sellerId: user.id,
          sellerName: user.username,
          sellerRole: user.role,
          paymentMethod,
          roomId: (paymentMethod === 'Room Charge' || (location === 'Réception' && !hasHall)) ? selectedRoomId : null,
          location: group.targetLocation,
          originalLocation: location,
          cashedAt: location,
          alreadyCashedAtPOS: true,
          paymentStatus: 'Paid',
          tableNumber: groupTableNumber,
          receptionOrientation: (location === 'Réception' && !hasHall) ? receptionOrientation : null,
          guestName: guestName || null
        };

        if (group.isKitchen) {
          saleData.kitchenStatus = 'Pending' as KitchenStatus;
        }

        const saleRef = doc(collection(db, 'sales'));
        batch.set(saleRef, saleData);
        lastCreatedSale = { ...saleData, id: saleRef.id };
      }

      // 2. Update stock and check for notifications
      for (const i of cart) {
        if (i.type === 'product') {
          const product = i.item as Product;
          
          const curTerrasse = product.stockTerrasse ?? product.stock ?? 0;
          const curReception = product.stockReception ?? 0;
          const curVip = product.stockVip ?? 0;

          let newTerrasse = curTerrasse;
          let newReception = curReception;
          let newVip = curVip;

          if (location === 'Réception') {
            newReception = Math.max(0, curReception - i.quantity);
          } else if (location === 'VIP') {
            newVip = Math.max(0, curVip - i.quantity);
          } else {
            newTerrasse = Math.max(0, curTerrasse - i.quantity);
          }

          const newTotalStock = newTerrasse + newReception + newVip;

          batch.update(doc(db, 'products', product.id), {
            stockTerrasse: newTerrasse,
            stockReception: newReception,
            stockVip: newVip,
            stock: newTotalStock
          });

          if (newTotalStock <= LOW_STOCK_THRESHOLD) {
            sendStockNotification(product.name, newTotalStock, settings?.hotelName, settings?.logoUrl, product.id);
          }
        } else if (i.type === 'hall') {
          const hall = i.item as Hall;
          batch.update(doc(db, 'halls', hall.id), {
            status: 'Occupied',
            currentGuestName: guestName || 'Client POS',
            checkInDate: Timestamp.now()
          });

          sendAppNotification(
            'info', 
            `La salle "${hall.name}" a été vendue à ${guestName || 'un client'}.`,
            settings?.hotelName,
            settings?.logoUrl
          );
        }
      }

      await batch.commit();
      logEvent(user, 'Vente', `Vente effectuée par ${user.username} pour un montant total de ${cart.reduce((sum, i) => sum + (i.item.price * i.quantity), 0).toLocaleString()} FCFA (${paymentMethod}). ${groupsToProcess.length > 1 ? '[Séparée entre Restaurant et Bar]' : ''}`);

      if (groupsToProcess.length > 1) {
        toast.info(`Vente séparée en ${groupsToProcess.length} tickets : Nourriture ➔ Caisse Restaurant, Boissons ➔ Caisse ${location}`);
      } else {
        toast.success("Vente enregistrée avec succès !");
      }

      setLastSale(lastCreatedSale);
      setCart([]);
      setPaymentMethod('Cash');
      setSelectedRoomId('');
      setTableNumber('');
      setReceptionOrientation('');
      setGuestName('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'sales');
    } finally {
      setSelling(false);
    }
  };

  const isKitchenSale = (sale: any) => {
    if (sale.items && sale.items.length > 0) {
      return sale.items.some((i: any) => {
        const cat = (i.category || '').toLowerCase();
        const pName = (i.productName || '').toLowerCase();
        return cat === 'cuisine' || cat === 'nourriture' || cat === 'food' || cat.includes('déjeuner') || cat.includes('dejeuner') || cat.includes('snack') || cat.includes('repas') || pName.includes('poulet') || pName.includes('poisson') || pName.includes('plat');
      });
    }
    return sale.kitchenStatus ? true : false;
  };

  const isSaleInClosureLocation = (sale: any, targetLocId: string) => {
    if (targetLocId === 'Tous' || targetLocId === 'Générale') return true;

    const kitchen = isKitchenSale(sale);

    const norm = (s?: string) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    const sLoc = norm(sale.location);
    const origLoc = norm(sale.originalLocation);
    const tLoc = norm(targetLocId);

    // 2. Restaurant closure: sales cashed at the Restaurant cash point
    if (tLoc === 'restaurant') {
      if (sale.alreadyCashedAtPOS && origLoc && !origLoc.includes('rest')) {
        return false;
      }
      return kitchen && (sLoc.includes('rest') || origLoc.includes('rest') || !origLoc);
    }

    // If kitchen order was issued and cashed at another department, it belongs to that department's register:
    if (kitchen) {
      if (tLoc === 'terrasse' && (origLoc.includes('terrasse') || sLoc.includes('terrasse'))) {
        return true;
      }
      if (tLoc === 'vip' && (origLoc.includes('vip') || sLoc.includes('vip'))) {
        return true;
      }
      if (tLoc === 'reception' && (origLoc.includes('recept') || sLoc.includes('recept'))) {
        return true;
      }
      return false;
    }

    // 3. Terrasse / Bar closure: non-pool, non-kitchen sales (drinks, beverages, etc.)
    if (tLoc === 'terrasse') {
      return sLoc.includes('terrasse') || origLoc.includes('terrasse') || sLoc.includes('bar');
    }

    if (tLoc === 'vip') {
      return sLoc.includes('vip') || origLoc.includes('vip');
    }

    if (tLoc === 'reception') {
      return sLoc.includes('recept') || origLoc.includes('recept') || sLoc.includes('hotel') || sLoc.includes('chambre') || sLoc.includes('heberg');
    }

    return sLoc === tLoc;
  };

  const isExpenseInClosureLocation = (expense: Expense, tLoc: string) => {
    const norm = (s?: string) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    const targetNorm = norm(tLoc);
    if (targetNorm === 'tous' || targetNorm === 'generale' || !targetNorm) return true;
    const expLoc = norm(expense.location);
    if (expLoc === 'tous' || expLoc === 'generale') return true;
    if (targetNorm === 'restaurant') return expLoc.includes('rest');
    if (targetNorm === 'terrasse') return expLoc.includes('terrasse');
    if (targetNorm === 'vip') return expLoc.includes('vip');
    if (targetNorm === 'reception') return expLoc.includes('recept') || expLoc.includes('hotel') || expLoc.includes('chambre') || !expense.location;
    return expLoc === targetNorm;
  };

  const getStockForClosureLocation = (product: Product, locFilter: string) => {
    const norm = locFilter.toLowerCase();
    if (norm === 'tous' || norm === 'générale' || norm === 'generale') {
      return product.stock ?? ((product.stockTerrasse || 0) + (product.stockReception || 0) + (product.stockVip || 0));
    }
    if (norm.includes('recept')) return product.stockReception ?? product.stock ?? 0;
    if (norm.includes('vip')) return product.stockVip ?? product.stock ?? 0;
    return product.stockTerrasse ?? product.stock ?? 0;
  };

  const fetchTodaySalesForClosure = async (locFilter: string = closureLocationFilter, dateStr: string = selectedClosureDate) => {
    setLoadingClosureData(true);
    setClosureData(null);
    setClosureSalesList([]);
    setClosureExpensesList([]);
    setClosureStockList([]);
    try {
      let startOfDay: Date;
      let endOfDay: Date;

      if (dateStr && dateStr.includes('-')) {
        const [year, month, day] = dateStr.split('-').map(Number);
        startOfDay = new Date(year, month - 1, day, 0, 0, 0, 0);
        endOfDay = new Date(year, month - 1, day, 23, 59, 59, 999);
      } else {
        startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);
      }

      const startTimestamp = Timestamp.fromDate(startOfDay);
      const endTimestamp = Timestamp.fromDate(endOfDay);

      // 1. Fetch sales
      const qSales = query(
        collection(db, 'sales'),
        where('timestamp', '>=', startTimestamp),
        where('timestamp', '<=', endTimestamp)
      );
      const snapSalesRaw = await getDocs(qSales);
      const allSalesDocs = snapSalesRaw.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sale));
      
      let filteredSales = allSalesDocs.filter(sale => isSaleInClosureLocation(sale, locFilter));
      
      // Fetch room stay bookings for Réception
      const bookingSales: Sale[] = [];
      if (locFilter === 'Tous' || locFilter === 'Réception' || locFilter === 'Générale') {
        const snapBookingsRaw = await getDocs(collection(db, 'bookings'));
        snapBookingsRaw.docs.forEach(doc => {
          const data = doc.data() as Booking;
          if (data.checkOutDate) {
            const checkOutTime = parseDate(data.checkOutDate);
            if (checkOutTime >= startOfDay && checkOutTime <= endOfDay) {
              const pm = String(data.paymentMethod || '');
              let mappedMethod: PaymentMethod = 'Cash';
              if (pm.toLowerCase().includes('card') || pm.toLowerCase().includes('carte')) mappedMethod = 'Card';
              else if (pm.toLowerCase().includes('room') || pm.toLowerCase().includes('chambre')) mappedMethod = 'Room Charge';

              bookingSales.push({
                id: doc.id, // Use actual doc.id
                totalPrice: data.totalPaid || 0,
                paymentMethod: mappedMethod,
                sellerId: (data as any).receptionistId || user.id,
                sellerName: (data as any).receptionistName || 'Réception',
                sellerRole: 'receptionist',
                location: 'Réception',
                timestamp: data.checkOutDate,
                items: [{
                  productId: 'room_stay',
                  productName: `Séjour Chambre #${data.roomNumber} (${data.guestName || 'Client'})`,
                  quantity: data.totalNights || 1,
                  price: data.totalPaid || 0,
                  category: 'Hébergement'
                }],
                status: 'Completed',
                sourceCollection: 'bookings',
                sourceId: doc.id
              } as any);
            }
          }
        });
      }

      const combinedSales = [...filteredSales, ...bookingSales].sort((a, b) => {
        const timeA = parseDate(a.timestamp).getTime();
        const timeB = parseDate(b.timestamp).getTime();
        return timeA - timeB;
      });

      let cash = 0;
      let card = 0;
      let mobile = 0;
      let room = 0;
      let totalSales = 0;
      const defaultLocations = ['Terrasse', 'Restaurant', 'VIP', 'Réception'];
      const salesByLocation: { [key: string]: number } = {};
      defaultLocations.forEach(loc => { salesByLocation[loc] = 0; });

      combinedSales.forEach(sale => {
        const price = sale.totalPrice || 0;
        const method = sale.paymentMethod;
        const saleLocation = sale.location || 'Générale';

        totalSales += price;
        salesByLocation[saleLocation] = (salesByLocation[saleLocation] || 0) + price;

        if (method === 'Cash') cash += price;
        else if (method === 'Card') card += price;
        else if (method === 'Mobile Money') mobile += price;
        else if (method === 'Room Charge') room += price;
      });

      // 2. Fetch expenses
      const qExpenses = query(
        collection(db, 'expenses'),
        where('timestamp', '>=', startTimestamp),
        where('timestamp', '<=', endTimestamp)
      );
      const snapExpensesRaw = await getDocs(qExpenses);
      const allExpensesDocs = snapExpensesRaw.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense));
      const filteredExpenses = allExpensesDocs.filter(exp => 
        exp.status !== 'Rejected' && isExpenseInClosureLocation(exp, locFilter)
      );
      const totalExpenses = filteredExpenses.reduce((acc, curr) => acc + (curr.amount || 0), 0);

      // 3. Fetch current products & stock
      const snapProducts = await getDocs(collection(db, 'products'));
      const allProducts = snapProducts.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      
      const stockList = allProducts.map(p => ({
        id: p.id,
        name: p.name,
        category: p.category || 'Général',
        price: p.price || 0,
        stock: getStockForClosureLocation(p, locFilter)
      })).sort((a, b) => a.name.localeCompare(b.name));

      const totalProductsCount = stockList.length;
      const totalStockUnits = stockList.reduce((acc, curr) => acc + curr.stock, 0);
      const totalStockValue = stockList.reduce((acc, curr) => acc + (curr.stock * curr.price), 0);
      const lowStockCount = stockList.filter(p => p.stock <= 5).length;

      setClosureData({
        cashSales: cash,
        cardSales: card,
        mobileSales: mobile,
        roomSales: room,
        totalSales,
        count: combinedSales.length,
        location: locFilter,
        totalExpenses,
        expensesCount: filteredExpenses.length,
        expensesList: filteredExpenses,
        stockSummary: {
          totalProductsCount,
          totalStockUnits,
          totalStockValue,
          lowStockCount
        },
        stockList,
        salesByLocation
      });

      setClosureSalesList(combinedSales);
      setClosureExpensesList(filteredExpenses);
      setClosureStockList(stockList);
      const netCashExpected = Math.max(0, cash - totalExpenses);
      setPhysicalCash(netCashExpected.toString());
    } catch (error) {
      console.error("Error fetching closure data:", error);
      toast.error("Erreur lors de la récupération des données de caisse.");
    } finally {
      setLoadingClosureData(false);
    }
  };

  const handleSaveClosure = async () => {
    if (!closureData) return;
    setIsSavingClosure(true);
    try {
      const counted = Number(physicalCash) || 0;
      const expected = Math.max(0, closureData.cashSales - closureData.totalExpenses);
      const discrepancy = counted - expected;

      const closureReport = {
        cashierId: user.id,
        cashierName: user.username,
        cashierRole: user.role,
        location: closureLocationFilter,
        timestamp: Timestamp.now(),
        cashSales: closureData.cashSales,
        cardSales: closureData.cardSales,
        mobileSales: closureData.mobileSales,
        roomSales: closureData.roomSales,
        totalSales: closureData.totalSales,
        salesCount: closureData.count,
        physicalCashCounted: counted,
        discrepancy: discrepancy,
        notes: closureNote,
        totalExpenses: closureData.totalExpenses,
        expensesCount: closureData.expensesCount,
        expensesDetails: closureData.expensesList.map(e => ({
          id: e.id,
          description: e.description,
          amount: e.amount,
          category: e.category,
          recordedBy: e.recordedBy,
          location: e.location || 'Tous'
        })),
        stockSummary: closureData.stockSummary,
        stockDetails: closureData.stockList
      };

      const docRef = await addDoc(collection(db, 'cash_closures'), closureReport);
      
      logEvent(user, 'Fermeture de Caisse', `Clôture de caisse (${closureLocationFilter}) effectuée par ${user.username}. Espèces attendues: ${expected.toLocaleString()} FCFA, Comptées: ${counted.toLocaleString()} FCFA (Écart: ${discrepancy.toLocaleString()} FCFA). Dépenses: ${closureData.totalExpenses.toLocaleString()} FCFA.`);

      setSavedClosureReport({
        id: docRef.id,
        ...closureReport,
        salesDetails: closureSalesList,
        expensesDetails: closureExpensesList,
        stockDetails: closureStockList
      });
      toast.success("Clôture de caisse enregistrée avec succès !");
      setIsClosingRegister(false);
      setClosureNote('');
    } catch (error) {
      console.error("Error saving closure:", error);
      toast.error("Erreur lors de l'enregistrement de la clôture de caisse.");
    } finally {
      setIsSavingClosure(false);
    }
  };

  const handleShareClosure = async () => {
    if (!savedClosureReport) return;
    
    const formattedDate = parseDate(savedClosureReport.timestamp).toLocaleString('fr-FR');
    const text = `📝 *CLÔTURE DE CAISSE - ${settings?.hotelName || "RÉSIDENCE HOTEL"}*
📅 Date : ${formattedDate}
👤 Caissier : ${savedClosureReport.cashierName.toUpperCase()} (${savedClosureReport.cashierRole.toUpperCase()})

💵 *VENTES PAR PAIEMENT*
• Espèces : ${savedClosureReport.cashSales.toLocaleString()} FCFA
• Carte Bancaire : ${savedClosureReport.cardSales.toLocaleString()} FCFA
• Mobile Money : ${savedClosureReport.mobileSales.toLocaleString()} FCFA
• Charges Chambres : ${savedClosureReport.roomSales.toLocaleString()} FCFA
━━━━━━━━━━━━━━━━━
💰 *TOTAL DES VENTES : ${savedClosureReport.totalSales.toLocaleString()} FCFA*
📊 Transactions : ${savedClosureReport.salesCount}

🔍 *CONTRÔLE DE CAISSE*
• Espèces Attendues : ${savedClosureReport.cashSales.toLocaleString()} FCFA
• Espèces Comptées : ${savedClosureReport.physicalCashCounted.toLocaleString()} FCFA
⚠️ Écart : ${savedClosureReport.discrepancy > 0 ? '+' : ''}${savedClosureReport.discrepancy.toLocaleString()} FCFA

${savedClosureReport.notes ? `✍️ *OBSERVATIONS :*\n${savedClosureReport.notes}` : ''}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Clôture de Caisse - ${formattedDate}`,
          text: text,
        });
        toast.success("Partagé avec succès !");
      } catch (error) {
        console.log("Error sharing:", error);
        // Fallback to clipboard
        try {
          await navigator.clipboard.writeText(text);
          toast.success("Rapport de clôture copié !");
        } catch (clipErr) {
          toast.error("Impossible de copier.");
        }
      }
    } else {
      try {
        await navigator.clipboard.writeText(text);
        toast.success("Rapport de clôture copié dans le presse-papiers !");
      } catch (err) {
        toast.error("Impossible de copier.");
      }
    }
  };

  const total = cart.reduce((sum, i) => sum + (i.item.price * i.quantity), 0);
  const hasHall = cart.some(i => i.type === 'hall');

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
      <div className="col-span-1 md:col-span-7 lg:col-span-8 space-y-6">
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <div className="flex-1 flex items-center gap-3 p-2.5 sm:p-4 bg-white border border-secondary/30 shadow-sm hover:shadow-md transition-shadow rounded-xl sm:rounded-2xl">
            <Search className="w-4 h-4 sm:w-5 h-5 text-primary/40" />
            <input 
              type="text" 
              placeholder="Rechercher..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent outline-none font-medium text-xs sm:text-sm uppercase tracking-tight text-[#2B2321] placeholder:text-[#2B2321]/30"
            />
          </div>
          <div className="w-full sm:w-auto flex bg-white p-1 border border-secondary/30 rounded-xl sm:rounded-2xl shadow-sm">
            <button
              onClick={() => setActiveCategory('Products')}
              className={cn(
                "flex-1 sm:flex-initial text-center px-4 py-2 sm:px-6 sm:py-3 rounded-lg sm:rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all",
                activeCategory === 'Products' ? "bg-primary text-white shadow-lg shadow-primary/20" : "text-primary/60 hover:bg-[#FDFBF7]"
              )}
            >
              Produits
            </button>
            <button
              onClick={() => setActiveCategory('Halls')}
              className={cn(
                "flex-1 sm:flex-initial text-center px-4 py-2 sm:px-6 sm:py-3 rounded-lg sm:rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all",
                activeCategory === 'Halls' ? "bg-primary text-white shadow-lg shadow-primary/20" : "text-primary/60 hover:bg-[#FDFBF7]"
              )}
            >
              Salles
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-5 xl:grid-cols-5 gap-2 sm:gap-3 lg:gap-4">
          {activeCategory === 'Products' ? (
            filteredProducts.map((product) => {
              const cartItem = cart.find(i => i.item.id === product.id && i.type === 'product');
              const locStock = getProductStockForLocation(product, location);
              const displayStock = locStock - (cartItem?.quantity || 0);

              return (
                <button
                  key={product.id}
                  onClick={() => addToCart(product, 'product')}
                  disabled={displayStock <= 0}
                  className={cn(
                    "p-2 text-left bg-white border border-secondary/30 shadow-sm hover:shadow-xl hover:shadow-primary/10 transition-shadow rounded-xl transition-all group",
                    displayStock <= 0 && "opacity-50 grayscale cursor-not-allowed"
                  )}
                >
                  <div className="flex justify-between items-start gap-1 mb-1">
                    <span className="text-[8px] font-bold uppercase tracking-widest text-primary/60 truncate">{product.category}</span>
                    <span className={cn(
                      "px-1 py-0.5 text-[8px] font-bold uppercase border rounded-full shrink-0",
                      displayStock <= LOW_STOCK_THRESHOLD ? "bg-red-50 text-red-600 border-red-100" : "bg-[#FDFBF7] text-[#2B2321]/60 border-secondary/30"
                    )}>
                      St: {displayStock}
                    </span>
                  </div>
                  <h3 className="text-[10px] font-bold tracking-tight text-[#2B2321] mb-1 group-hover:text-primary transition-colors line-clamp-2 min-h-[1.5rem]">{product.name}</h3>
                  <div className="flex items-center justify-between mt-1 pt-1 border-t border-secondary/20">
                    <p className="font-bold text-[10px] text-primary">{product.price.toLocaleString()} <span className="text-[8px] font-bold uppercase tracking-widest text-primary/60">FCFA</span></p>
                    <div className="w-5 h-5 rounded-full bg-[#FDFBF7] flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors text-primary shrink-0">
                      <Plus className="w-3 h-3" />
                    </div>
                  </div>
                </button>
              );
            })
          ) : (
            filteredHalls.map((hall) => {
              const isInCart = cart.some(i => i.item.id === hall.id && i.type === 'hall');
              const isAvailable = hall.status === 'Available';

              return (
                <button
                  key={hall.id}
                  onClick={() => addToCart(hall, 'hall')}
                  disabled={!isAvailable || isInCart}
                  className={cn(
                    "p-2 text-left bg-white border border-secondary/30 shadow-sm hover:shadow-xl hover:shadow-primary/10 transition-shadow rounded-xl transition-all group",
                    (!isAvailable || isInCart) && "opacity-50 grayscale cursor-not-allowed"
                  )}
                >
                  <div className="flex justify-between items-start gap-1 mb-1">
                    <span className="text-[8px] font-bold uppercase tracking-widest text-primary/60 truncate">{hall.type}</span>
                    <span className={cn(
                      "px-1 py-0.5 text-[8px] font-bold uppercase border rounded-full shrink-0",
                      hall.status === 'Available' ? "bg-green-50 text-green-600 border-green-100" : "bg-red-50 text-red-600 border-red-100"
                    )}>
                      {hall.status === 'Available' ? 'Dispo' : 'Occupé'}
                    </span>
                  </div>
                  <h3 className="text-[10px] font-bold tracking-tight text-[#2B2321] mb-1 group-hover:text-primary transition-colors line-clamp-2 min-h-[1.5rem]">{hall.name}</h3>
                  <div className="flex items-center justify-between mt-1 pt-1 border-t border-secondary/20">
                    <p className="font-bold text-[10px] text-primary">{hall.price.toLocaleString()} <span className="text-[8px] font-bold uppercase tracking-widest text-primary/60">FCFA</span></p>
                    <div className="w-5 h-5 rounded-full bg-[#FDFBF7] flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors text-primary shrink-0">
                      <LayoutGrid className="w-3 h-3" />
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      <div className="bg-white p-6 border border-secondary/30 shadow-sm rounded-2xl h-fit col-span-1 md:col-span-5 lg:col-span-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Panier</h2>
          <button
            onClick={() => {
              const defaultLoc = isManager ? 'Tous' : (user?.role === 'receptionist' ? 'Réception' : user?.role === 'serveur' ? 'Restaurant' : 'Terrasse');
              setClosureLocationFilter(defaultLoc);
              const todayStr = format(new Date(), 'yyyy-MM-dd');
              setSelectedClosureDate(todayStr);
              setIsClosingRegister(true);
              fetchTodaySalesForClosure(defaultLoc, todayStr);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2B2321]/5 hover:bg-red-50 hover:text-red-600 border border-secondary/10 rounded-xl font-bold text-[9px] uppercase tracking-widest transition-all text-[#2B2321]/60"
            title="Clôturer la journée et vérifier la caisse"
          >
            <Lock className="w-3.5 h-3.5" />
            Clôturer Caisse
          </button>
        </div>
        <div className="space-y-4 mb-6">
          {cart.map(i => (
            <div key={`${i.type}-${i.item.id}`} className="flex justify-between items-center p-3 bg-[#FDFBF7] rounded-xl border border-secondary/20">
              <div>
                <p className="font-bold text-sm text-[#2B2321]">{i.item.name}</p>
                <p className="text-[10px] font-bold text-primary uppercase tracking-widest">{i.quantity} x {i.item.price.toLocaleString()} FCFA</p>
              </div>
              <button 
                onClick={() => removeFromCart(i.item.id, i.type)} 
                className="p-2 text-red-500 hover:bg-red-50 rounded-full transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          {cart.length === 0 && (
            <div className="text-center py-8 text-[#2B2321]/30">
              <p className="text-xs font-bold uppercase tracking-widest">Le panier est vide</p>
            </div>
          )}
        </div>
        
        <div className="border-t border-secondary/20 pt-6 space-y-6">
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-primary/60">Nom du client (Optionnel)</label>
                <input 
                  type="text"
                  placeholder="Ex: Jean Dupont"
                  className="w-full p-3 border border-secondary/30 rounded-xl outline-none font-bold text-xs uppercase tracking-widest"
                  value={guestName}
                  onChange={e => setGuestName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-primary/60">N° de Table (Optionnel)</label>
                <input 
                  type="text"
                  placeholder="Ex: Table 5"
                  className="w-full p-3 border border-secondary/30 rounded-xl outline-none font-bold text-xs uppercase tracking-widest"
                  value={tableNumber}
                  onChange={e => setTableNumber(e.target.value)}
                />
              </div>
            </div>

            <label className="text-[10px] font-bold uppercase tracking-widest text-primary/60">Lieu de consommation</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'Restaurant', label: 'Resto' },
                { id: 'Terrasse', label: 'Terrasse' },
                { id: 'VIP', label: 'Salon VIP' },
                { id: 'Réception', label: 'Réception' },
              ].filter((loc) => {
                if (user?.role === 'caissiere') {
                  return ['Terrasse', 'VIP', 'Réception'].includes(loc.id);
                }
                return true;
              }).map((loc) => (
                <button
                  key={loc.id}
                onClick={() => {
                    setLocation(loc.id as SaleLocation);
                    setCart([]); // Clear cart to avoid cross-stock sales issues
                    if (loc.id === 'Réception') {
                      setReceptionOrientation('Réception');
                    } else {
                      setReceptionOrientation('');
                    }
                  }}
                  className={cn(
                    "flex items-center justify-center gap-2 p-3 rounded-xl border font-bold text-[10px] uppercase tracking-widest transition-all",
                    location === loc.id 
                      ? "bg-accent text-white border-accent shadow-md" 
                      : "bg-white text-[#2B2321] border-secondary/30 hover:border-accent/50"
                  )}
                >
                  <MapPin className="w-3 h-3" />
                  {loc.label}
                </button>
              ))}
            </div>

            {location === 'Réception' && !hasHall && (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-primary/60">Chambre du client</label>
                  <select 
                    className="w-full p-3 border border-secondary/30 rounded-xl outline-none font-bold text-xs uppercase tracking-widest"
                    value={selectedRoomId}
                    onChange={e => setSelectedRoomId(e.target.value)}
                    required
                  >
                    <option value="">Choisir une chambre...</option>
                    {occupiedRooms.map(room => (
                      <option key={room.id} value={room.id}>Chambre #{room.number} - {room.currentGuestName}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-primary/60">Orienter vers</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['Terrasse', 'VIP', 'Réception'].map((orient) => (
                      <button
                        key={orient}
                        type="button"
                        onClick={() => setReceptionOrientation(orient as any)}
                        className={cn(
                          "p-2 rounded-xl border font-bold text-[10px] uppercase tracking-widest transition-all",
                          receptionOrientation === orient 
                            ? "bg-accent text-white border-accent" 
                            : "bg-white text-[#2B2321] border-secondary/30"
                        )}
                      >
                        {orient}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <label className="text-[10px] font-bold uppercase tracking-widest text-primary/60">Mode de paiement</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'Cash', label: 'Espèces', icon: Banknote },
                { id: 'Card', label: 'Carte', icon: CreditCard },
                { id: 'Mobile Money', label: 'Mobile', icon: Smartphone },
                { id: 'Room Charge', label: 'Chambre', icon: Bed },
              ].map((method) => (
                <button
                  key={method.id}
                  onClick={() => setPaymentMethod(method.id as PaymentMethod)}
                  className={cn(
                    "flex items-center gap-2 p-3 rounded-xl border font-bold text-[10px] uppercase tracking-widest transition-all",
                    paymentMethod === method.id 
                      ? "bg-primary text-white border-primary shadow-md" 
                      : "bg-white text-[#2B2321] border-secondary/30 hover:border-primary/50"
                  )}
                >
                  <method.icon className="w-4 h-4" />
                  {method.label}
                </button>
              ))}
            </div>

            {paymentMethod === 'Room Charge' && location !== 'Réception' && (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-primary/60">Sélectionner la chambre</label>
                <select 
                  className="w-full p-3 border border-secondary/30 rounded-xl outline-none font-bold text-xs uppercase tracking-widest"
                  value={selectedRoomId}
                  onChange={e => setSelectedRoomId(e.target.value)}
                  required
                >
                  <option value="">Choisir une chambre...</option>
                  {occupiedRooms.map(room => (
                    <option key={room.id} value={room.id}>Chambre #{room.number} - {room.currentGuestName}</option>
                    ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex justify-between items-center">
            <span className="text-xs font-bold uppercase tracking-widest text-primary/60">Total</span>
            <p className="text-2xl font-bold text-primary">{total.toLocaleString()} <span className="text-xs">FCFA</span></p>
          </div>
          
          <button 
            onClick={handleSell}
            disabled={selling || cart.length === 0 || (paymentMethod === 'Room Charge' && !selectedRoomId) || (location === 'Réception' && !selectedRoomId && !hasHall)}
            className="w-full py-4 bg-primary text-white rounded-2xl font-bold uppercase tracking-widest text-sm shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all disabled:opacity-50"
          >
            {selling ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Valider la vente'}
          </button>

          <div className="pt-2 border-t border-dashed border-secondary/20 space-y-1 bg-secondary/5 p-3 rounded-2xl">
            <p className="text-[9px] font-black uppercase tracking-widest text-primary/60 text-center">Diagnostic Matériel</p>
            <button 
              type="button"
              onClick={() => setLastSale({ isTestPage: true })}
              className="w-full py-2.5 bg-white hover:bg-[#FDFBF7] text-[#2B2321] rounded-xl font-bold uppercase tracking-widest text-[10px] transition-all flex items-center justify-center gap-2 border border-secondary/20 shadow-xs"
            >
              <Printer className="w-3.5 h-3.5 text-accent" />
              Imprimer page de test (TP200)
            </button>
            <p className="text-[8px] text-[#2B2321]/50 text-center uppercase tracking-wider">Permet d'isoler les pannes de pilote ou d'imprimante</p>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {lastSale && (
          <Receipt sale={lastSale} onClose={() => setLastSale(null)} settings={settings} />
        )}

        {isClosingRegister && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-[#2B2321]/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-xl max-h-[85vh] sm:max-h-[90vh] bg-white border border-secondary/30 shadow-2xl rounded-3xl text-[#2B2321] flex flex-col overflow-hidden my-auto"
            >
              <div className="flex justify-between items-center p-5 sm:p-6 pb-4 border-b border-secondary/15 shrink-0 bg-white">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 bg-red-50 text-red-600 rounded-xl">
                    <Lock className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg sm:text-xl font-black tracking-tight uppercase text-[#2B2321]">Fermeture de Caisse</h3>
                    <p className="text-[10px] text-primary/60 font-bold uppercase tracking-wider">Point de vente & Journal de Caisse</p>
                  </div>
                </div>
                <button onClick={() => setIsClosingRegister(false)} className="p-2 hover:bg-[#FDFBF7] text-primary/70 rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
                {/* Date Selection for Past Sales */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-primary/70 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-primary" /> Sélectionner la Date :
                  </label>
                  <input 
                    type="date"
                    value={selectedClosureDate}
                    onChange={(e) => {
                      const newDate = e.target.value;
                      setSelectedClosureDate(newDate);
                      fetchTodaySalesForClosure(closureLocationFilter, newDate);
                    }}
                    className="w-full p-3 bg-secondary/10 border border-secondary/20 rounded-2xl outline-none font-bold text-xs uppercase text-[#2B2321] focus:border-primary transition-all"
                  />
                </div>

                {/* Point of Sale Selection Tabs */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-primary/70 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-primary" /> Sélectionner le Point de Vente / Périmètre :
                  </label>
                  <div className="flex flex-wrap gap-1.5 p-1.5 bg-secondary/10 rounded-2xl border border-secondary/20">
                    {[
                      ...(isManager ? [{ id: 'Tous', label: 'Générale (Tous)' }] : []),
                      { id: 'Terrasse', label: 'Terrasse' },
                      { id: 'Restaurant', label: 'Restaurant' },
                      { id: 'VIP', label: 'Salon VIP' },
                      { id: 'Réception', label: 'Réception' },
                    ].map((loc) => (
                      <button
                        key={loc.id}
                        type="button"
                        onClick={() => {
                          setClosureLocationFilter(loc.id);
                          fetchTodaySalesForClosure(loc.id);
                        }}
                        className={cn(
                          "flex-1 min-w-[90px] py-2 px-3 rounded-xl font-bold text-[10px] uppercase tracking-wider transition-all text-center",
                          closureLocationFilter === loc.id
                            ? "bg-primary text-white shadow-md"
                            : "text-[#2B2321]/70 hover:bg-white/60"
                        )}
                      >
                        {loc.label}
                      </button>
                    ))}
                  </div>
                </div>

                {loadingClosureData ? (
                  <div className="py-12 flex flex-col items-center justify-center gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <p className="text-xs text-primary/60 font-bold uppercase tracking-widest">Calcul des ventes pour {closureLocationFilter === 'Tous' ? 'Clôture Générale' : closureLocationFilter}...</p>
                  </div>
                ) : closureData ? (
                  <div className="space-y-5">
                    {/* Summary Box */}
                    <div className="p-4 sm:p-5 bg-[#FDFBF7] rounded-2xl border border-secondary/20 space-y-3 shadow-xs">
                      <div className="flex justify-between items-center border-b border-secondary/15 pb-2">
                        <p className="text-[10px] font-black uppercase tracking-widest text-primary/80">
                          Rapport d'activité • {closureLocationFilter === 'Tous' ? 'Clôture Générale' : `Espace ${closureLocationFilter}`}
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            if (closureData) {
                              generateClosureReportPDF({
                                closureReport: {
                                  location: closureLocationFilter,
                                  cashierName: user.username,
                                  cashierRole: user.role,
                                  timestamp: Timestamp.now(),
                                  cashSales: closureData.cashSales,
                                  cardSales: closureData.cardSales,
                                  mobileSales: closureData.mobileSales,
                                  roomSales: closureData.roomSales,
                                  totalSales: closureData.totalSales,
                                  salesCount: closureData.count,
                                  physicalCashCounted: Number(physicalCash) || 0,
                                  discrepancy: (Number(physicalCash) || 0) - closureData.cashSales,
                                  notes: closureNote,
                                  totalExpenses: closureData.totalExpenses,
                                  expensesCount: closureData.expensesCount,
                                  expensesDetails: closureExpensesList,
                                  stockSummary: closureData.stockSummary,
                                  stockDetails: closureStockList,
                                  salesByLocation: closureData.salesByLocation
                                },
                                salesDetails: closureSalesList,
                                expensesDetails: closureExpensesList,
                                stockDetails: closureStockList,
                                settings
                              });
                            }
                          }}
                          className="flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 text-primary hover:bg-primary hover:text-white rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all"
                        >
                          <FileText className="w-3.5 h-3.5" /> PDF Aperçu
                        </button>
                      </div>

                      {/* Cards Overview */}
                      {closureLocationFilter === 'Tous' ? (
                        <div className="grid grid-cols-1 gap-2 text-xs">
                          <div className="p-3 bg-white rounded-xl border border-secondary/10 space-y-2">
                            <span className="text-primary/60 font-bold uppercase tracking-widest text-[9px] block">Ventes par point de vente</span>
                            <div className="space-y-1">
                              {closureData.salesByLocation && Object.entries(closureData.salesByLocation).map(([loc, amount]) => (
                                <div key={loc} className="flex justify-between items-center text-[11px] font-semibold">
                                  <span>{loc}</span>
                                  <span>{amount.toLocaleString()} FCFA</span>
                                </div>
                              ))}
                              <div className="flex justify-between items-center text-[11px] font-bold border-t border-secondary/10 pt-1 mt-1">
                                <span>TOTAL GÉNÉRAL</span>
                                <span>{closureData.totalSales.toLocaleString()} FCFA</span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="p-3 bg-red-50/50 rounded-xl border border-red-100 space-y-1">
                              <span className="text-red-700 font-bold uppercase tracking-widest text-[9px] block">Dépenses du Jour</span>
                              <p className="font-black text-red-600 text-base">{closureData.totalExpenses.toLocaleString()} FCFA</p>
                              <p className="text-[9px] text-red-600/70 font-semibold">{closureData.expensesCount} bon(s) de sortie</p>
                            </div>
                            <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-100 space-y-1">
                              <span className="text-amber-800 font-bold uppercase tracking-widest text-[9px] block">Espèces Nettes Attendues</span>
                              <p className="font-black text-amber-900 text-base">{Math.max(0, closureData.cashSales - closureData.totalExpenses).toLocaleString()} FCFA</p>
                              <p className="text-[9px] text-amber-800/70 font-semibold">{closureData.totalExpenses > 0 ? `(Ventes - ${closureData.totalExpenses.toLocaleString()} F sorties)` : '(Hors CB/Mobile/Chambres)'}</p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <>
                          {/* 4 Cards Overview: Sales, Expenses, Expected Net Cash, Stock */}
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="p-3 bg-white rounded-xl border border-secondary/10 space-y-1">
                              <span className="text-primary/60 font-bold uppercase tracking-widest text-[9px] block">Total Ventes</span>
                              <p className="font-black text-primary text-base">{closureData.totalSales.toLocaleString()} FCFA</p>
                              <p className="text-[9px] text-[#2B2321]/60 font-semibold">{closureData.count} transaction(s)</p>
                            </div>
                            <div className="p-3 bg-red-50/50 rounded-xl border border-red-100 space-y-1">
                              <span className="text-red-700 font-bold uppercase tracking-widest text-[9px] block">Dépenses du Jour</span>
                              <p className="font-black text-red-600 text-base">{closureData.totalExpenses.toLocaleString()} FCFA</p>
                              <p className="text-[9px] text-red-600/70 font-semibold">{closureData.expensesCount} bon(s) de sortie</p>
                            </div>
                            <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-100 space-y-1">
                              <span className="text-amber-800 font-bold uppercase tracking-widest text-[9px] block">Espèces Nettes Attendues</span>
                              <p className="font-black text-amber-900 text-base">{Math.max(0, closureData.cashSales - closureData.totalExpenses).toLocaleString()} FCFA</p>
                              <p className="text-[9px] text-amber-800/70 font-semibold">{closureData.totalExpenses > 0 ? `(Ventes - ${closureData.totalExpenses.toLocaleString()} F sorties)` : '(Hors CB/Mobile/Chambres)'}</p>
                            </div>
                            <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100 space-y-1">
                              <span className="text-blue-800 font-bold uppercase tracking-widest text-[9px] block">Stock Restant</span>
                              <p className="font-black text-blue-900 text-base">{closureData.stockSummary.totalStockUnits} unités</p>
                              <p className="text-[9px] text-blue-800/70 font-semibold">{closureData.stockSummary.totalProductsCount} articles ({closureData.stockSummary.lowStockCount} bas)</p>
                            </div>
                          </div>

                          <div className="h-px bg-secondary/20 my-1" />

                          <div className="grid grid-cols-2 gap-2 text-[10px] text-[#2B2321]/70">
                            <div>Espèces: <span className="font-bold text-[#2B2321]">{closureData.cashSales.toLocaleString()} F</span></div>
                            <div>Carte: <span className="font-bold text-[#2B2321]">{closureData.cardSales.toLocaleString()} F</span></div>
                            <div>Mobile Money: <span className="font-bold text-[#2B2321]">{closureData.mobileSales.toLocaleString()} F</span></div>
                            <div>Chambres: <span className="font-bold text-[#2B2321]">{closureData.roomSales.toLocaleString()} F</span></div>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Accordion 1: Sales Details */}
                    <div className="border border-secondary/20 rounded-2xl overflow-hidden bg-white">
                      <button
                        type="button"
                        onClick={() => setShowSalesDetailsInModal(!showSalesDetailsInModal)}
                        className="w-full p-3 bg-secondary/5 hover:bg-secondary/10 flex justify-between items-center text-xs font-bold text-[#2B2321] transition-all"
                      >
                        <span className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-primary" />
                          Détails des Ventes du Jour ({closureSalesList.length} transactions)
                        </span>
                        {showSalesDetailsInModal ? <ChevronUp className="w-4 h-4 text-primary" /> : <ChevronDown className="w-4 h-4 text-primary" />}
                      </button>

                      {showSalesDetailsInModal && (
                        <div className="p-3 max-h-48 overflow-y-auto space-y-2 text-[11px] divide-y divide-secondary/10">
                          {closureSalesList.length === 0 ? (
                            <p className="text-center py-4 text-primary/50 font-bold">Aucune vente enregistrée pour ce périmètre aujourd'hui.</p>
                          ) : (
                            closureSalesList.map((sale: any, idx) => (
                              <div key={sale.id || idx} className="pt-2 first:pt-0 flex justify-between items-center gap-2">
                                <div className="space-y-0.5 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono font-bold text-primary text-[10px]">{format(parseDate(sale.timestamp), 'dd/MM/yyyy HH:mm')}</span>
                                    <span className="font-bold truncate">{sale.sellerName || 'Vendeur'}</span>
                                    <span className="text-[9px] px-1.5 py-0.5 bg-secondary/10 rounded-md text-primary font-bold">
                                      {sale.location || 'Terrasse'} {sale.tableNumber ? `(T.${sale.tableNumber})` : sale.roomId ? `(Ch.${sale.roomId})` : ''}
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-[#2B2321]/70 truncate">
                                    {sale.items?.map((i: any) => `${i.quantity}x ${i.productName}`).join(', ')}
                                  </p>
                                </div>
                                <div className="text-right shrink-0 flex items-center gap-2">
                                  <div className="text-right">
                                    <p className="font-black text-primary">{sale.totalPrice?.toLocaleString()} FCFA</p>
                                    <span className="text-[9px] text-[#2B2321]/60">{sale.paymentMethod}</span>
                                  </div>
                                  {isManagerOrAdmin && (
                                    <button
                                      onClick={() => setPosSaleToDelete(sale)}
                                      className="p-1.5 hover:bg-red-50 text-red-500 rounded-lg transition-colors"
                                      title="Supprimer la vente"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>

                    {/* Accordion 2: Daily Expenses Report */}
                    <div className="border border-secondary/20 rounded-2xl overflow-hidden bg-white">
                      <button
                        type="button"
                        onClick={() => setShowExpensesDetailsInModal(!showExpensesDetailsInModal)}
                        className="w-full p-3 bg-red-50/40 hover:bg-red-50/80 flex justify-between items-center text-xs font-bold text-red-900 transition-all"
                      >
                        <span className="flex items-center gap-2">
                          <DollarSign className="w-4 h-4 text-red-600" />
                          Dépenses Effectuées du Jour ({closureExpensesList.length} bons • Total: {closureData.totalExpenses.toLocaleString()} FCFA)
                        </span>
                        {showExpensesDetailsInModal ? <ChevronUp className="w-4 h-4 text-red-600" /> : <ChevronDown className="w-4 h-4 text-red-600" />}
                      </button>

                      {showExpensesDetailsInModal && (
                        <div className="p-3 max-h-48 overflow-y-auto space-y-2 text-[11px] divide-y divide-secondary/10">
                          {closureExpensesList.length === 0 ? (
                            <p className="text-center py-4 text-primary/50 font-bold">Aucune dépense enregistrée aujourd'hui pour ce lieu.</p>
                          ) : (
                            closureExpensesList.map((exp: any, idx) => (
                              <div key={exp.id || idx} className="pt-2 first:pt-0 flex justify-between items-center gap-2">
                                <div className="space-y-0.5 min-w-0">
                                  <p className="font-bold text-[#2B2321] truncate">{exp.description}</p>
                                  <div className="flex items-center gap-2 text-[9px] text-primary/60 font-semibold">
                                    <span>{exp.category}</span>
                                    <span>•</span>
                                    <span>Par {exp.recordedBy}</span>
                                    <span>•</span>
                                    <span>Lieu: {exp.location || 'Général'}</span>
                                  </div>
                                </div>
                                <div className="text-right shrink-0 font-bold text-red-600 text-xs">
                                  {exp.amount.toLocaleString()} FCFA
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>

                    {/* Accordion 3: Stock Remaining Report (hidden for Clôture Générale 'Tous') */}
                    {closureLocationFilter !== 'Tous' && (
                      <div className="border border-secondary/20 rounded-2xl overflow-hidden bg-white">
                        <button
                          type="button"
                          onClick={() => setShowStockDetailsInModal(!showStockDetailsInModal)}
                          className="w-full p-3 bg-blue-50/40 hover:bg-blue-50/80 flex justify-between items-center text-xs font-bold text-blue-900 transition-all"
                        >
                          <span className="flex items-center gap-2">
                            <Package className="w-4 h-4 text-blue-600" />
                            Rapport Stock Restant ({closureData.stockSummary.totalStockUnits} unités • Valeur: {closureData.stockSummary.totalStockValue.toLocaleString()} FCFA)
                          </span>
                          {showStockDetailsInModal ? <ChevronUp className="w-4 h-4 text-blue-600" /> : <ChevronDown className="w-4 h-4 text-blue-600" />}
                        </button>

                        {showStockDetailsInModal && (
                          <div className="p-3 space-y-2">
                            <input
                              type="text"
                              placeholder="Rechercher un article en stock..."
                              className="w-full p-2 border border-secondary/20 rounded-xl text-xs outline-none focus:border-primary"
                              value={closureStockSearch}
                              onChange={e => setClosureStockSearch(e.target.value)}
                            />
                            <div className="max-h-56 overflow-y-auto space-y-1 text-[11px] divide-y divide-secondary/10">
                              {closureStockList.filter(s => s.name.toLowerCase().includes(closureStockSearch.toLowerCase())).length === 0 ? (
                                <p className="text-center py-4 text-primary/50 font-bold">Aucun article trouvé.</p>
                              ) : (
                                closureStockList
                                  .filter(s => s.name.toLowerCase().includes(closureStockSearch.toLowerCase()))
                                  .map((item: any, idx) => {
                                    const isLow = item.stock <= 5;
                                    return (
                                      <div key={item.id || idx} className="pt-2 first:pt-0 flex justify-between items-center gap-2">
                                        <div className="space-y-0.5 min-w-0">
                                          <p className="font-bold text-[#2B2321] truncate">{item.name}</p>
                                          <p className="text-[9px] text-primary/60 font-semibold">{item.category} • Prix: {item.price.toLocaleString()} FCFA</p>
                                        </div>
                                        <div className="text-right shrink-0">
                                          <span className={cn(
                                            "px-2 py-0.5 rounded-full font-bold text-[10px]",
                                            isLow ? "bg-red-100 text-red-700 font-black" : "bg-green-100 text-green-800"
                                          )}>
                                            Stock: {item.stock} {isLow ? '⚠️ Bas' : ''}
                                          </span>
                                          <p className="text-[9px] text-[#2B2321]/60 mt-0.5">Val: {(item.stock * item.price).toLocaleString()} F</p>
                                        </div>
                                      </div>
                                    );
                                  })
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-primary/60 flex items-center gap-1">
                          <Calculator className="w-3.5 h-3.5" /> Espèces physiques comptées (FCFA)
                        </label>
                        <input
                          type="number"
                          placeholder="Ex: 150000"
                          className="w-full p-3.5 border border-secondary/30 rounded-2xl outline-none font-bold text-base tracking-tight focus:bg-[#FDFBF7] focus:border-primary transition-all text-[#2B2321]"
                          value={physicalCash}
                          onChange={e => setPhysicalCash(e.target.value)}
                          required
                        />
                      </div>

                      {/* Écart de caisse */}
                      {(() => {
                        const counted = Number(physicalCash) || 0;
                        const expected = closureData.cashSales;
                        const diff = counted - expected;
                        return (
                          <div className={cn(
                            "p-2.5 rounded-xl border flex items-center gap-2 text-xs font-bold",
                            diff === 0 
                              ? "bg-green-50 border-green-200 text-green-700" 
                              : diff > 0 
                                ? "bg-amber-50 border-amber-200 text-amber-700" 
                                : "bg-red-50 border-red-200 text-red-700"
                          )}>
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <div className="flex-1 flex justify-between">
                              <span>Écart de caisse :</span>
                              <span>{diff > 0 ? '+' : ''}{diff.toLocaleString()} FCFA ({diff === 0 ? 'Parfait' : diff > 0 ? 'Excédent' : 'Déficit'})</span>
                            </div>
                          </div>
                        );
                      })()}

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-primary/60">Notes / Observations</label>
                        <textarea
                          placeholder="Remarques éventuelles sur les écarts, les coupures..."
                          className="w-full p-3 border border-secondary/30 rounded-2xl outline-none font-medium text-xs focus:bg-[#FDFBF7] focus:border-primary h-16 resize-none"
                          value={closureNote}
                          onChange={e => setClosureNote(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => setIsClosingRegister(false)}
                        className="flex-1 py-3 bg-secondary/10 hover:bg-secondary/20 text-primary rounded-2xl font-bold uppercase tracking-widest text-xs transition-all"
                      >
                        Annuler
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveClosure}
                        disabled={isSavingClosure || physicalCash === ''}
                        className="flex-1 py-3 bg-primary text-white hover:bg-primary/90 rounded-2xl font-bold uppercase tracking-widest text-xs shadow-lg shadow-primary/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {isSavingClosure ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                        Valider Clôture
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="py-8 text-center text-red-500 font-bold text-sm">
                    Impossible de charger les données de caisse.
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}

        {savedClosureReport && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-[#2B2321]/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg max-h-[85vh] sm:max-h-[90vh] bg-white border border-secondary/30 shadow-2xl rounded-3xl p-5 sm:p-6 text-[#2B2321] flex flex-col overflow-hidden my-auto"
            >
              <div className="overflow-y-auto space-y-4 flex-1 pr-1">
                <div id="printable-closure" className="border-4 border-double border-secondary/30 p-4 sm:p-5 rounded-2xl bg-[#FDFBF7] space-y-4 font-mono text-xs">
                <div className="text-center space-y-1">
                  <h4 className="font-bold text-sm uppercase tracking-wider">{settings?.hotelName || "RÉSIDENCE HOTEL"}</h4>
                  <p className="text-[10px] text-primary/60 font-bold uppercase tracking-widest">
                    Reçu de Clôture {savedClosureReport.location && savedClosureReport.location !== 'Tous' ? `(${savedClosureReport.location})` : 'Générale'}
                  </p>
                  <div className="text-[8px] text-[#2B2321]/70 leading-normal space-y-0.5 mt-1">
                    <p>02 rue Daniel Mayinguidi, Massissia</p>
                    <p>(derrière l'usine GO Fresh, Brazzaville)</p>
                    <p className="font-bold">Tél: 05 201 8181 | www.residence-hq.com</p>
                  </div>
                  <p className="text-[9px] text-[#2B2321]/50 pt-1">Date : {parseDate(savedClosureReport.timestamp).toLocaleString('fr-FR')}</p>
                </div>
                
                <div className="h-px bg-[#2B2321]/20 border-t border-dashed" />

                <div className="space-y-1 text-[10px]">
                  <div className="flex justify-between">
                    <span>CAISSIER :</span>
                    <span className="font-bold">{savedClosureReport.cashierName.toUpperCase()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>RÔLE :</span>
                    <span className="font-bold">{savedClosureReport.cashierRole.toUpperCase()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>POINT DE VENTE :</span>
                    <span className="font-bold text-primary">{savedClosureReport.location || 'Tous (Générale)'}</span>
                  </div>
                </div>

                <div className="h-px bg-[#2B2321]/20 border-t border-dashed" />

                {savedClosureReport.location === 'Tous' ? (
                  <div className="space-y-1 text-[10px]">
                    <p className="font-bold uppercase tracking-wider text-center text-xs pb-1">Ventes par point de vente</p>
                    {savedClosureReport.salesByLocation && Object.entries(savedClosureReport.salesByLocation).map(([loc, amount]) => (
                      <div key={loc} className="flex justify-between">
                        <span>{loc.toUpperCase()} :</span>
                        <span>{amount.toLocaleString()} FCFA</span>
                      </div>
                    ))}
                    <div className="h-px bg-[#2B2321]/10 my-1" />
                    <div className="flex justify-between font-bold text-xs pt-1">
                      <span>TOTAL VENTES :</span>
                      <span>{savedClosureReport.totalSales.toLocaleString()} FCFA</span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1 text-[10px]">
                    <p className="font-bold uppercase tracking-wider text-center text-xs pb-1">Ventes par paiement</p>
                    <div className="flex justify-between">
                      <span>ESPÈCES :</span>
                      <span>{savedClosureReport.cashSales.toLocaleString()} FCFA</span>
                    </div>
                    <div className="flex justify-between">
                      <span>CARTE BANCAIRE :</span>
                      <span>{savedClosureReport.cardSales.toLocaleString()} FCFA</span>
                    </div>
                    <div className="flex justify-between">
                      <span>MOBILE MONEY :</span>
                      <span>{savedClosureReport.mobileSales.toLocaleString()} FCFA</span>
                    </div>
                    <div className="flex justify-between">
                      <span>CHARGES CHAMBRES :</span>
                      <span>{savedClosureReport.roomSales.toLocaleString()} FCFA</span>
                    </div>
                    <div className="h-px bg-[#2B2321]/10 my-1" />
                    <div className="flex justify-between font-bold text-xs pt-1">
                      <span>TOTAL VENTES :</span>
                      <span>{savedClosureReport.totalSales.toLocaleString()} FCFA</span>
                    </div>
                    <div className="flex justify-between text-[9px] text-[#2B2321]/60">
                      <span>Nbre Transactions :</span>
                      <span>{savedClosureReport.salesCount}</span>
                    </div>
                  </div>
                )}

                <div className="h-px bg-[#2B2321]/20 border-t border-dashed" />

                <div className="space-y-1 text-[10px]">
                  <p className="font-bold uppercase tracking-wider text-center text-xs pb-1">Contrôle de Caisse</p>
                  <div className="flex justify-between font-bold">
                    <span>ESPÈCES ATTENDUES :</span>
                    <span>{savedClosureReport.cashSales.toLocaleString()} FCFA</span>
                  </div>
                  <div className="flex justify-between font-bold">
                    <span>ESPÈCES COMPTÉES :</span>
                    <span>{savedClosureReport.physicalCashCounted.toLocaleString()} FCFA</span>
                  </div>
                  <div className="h-px bg-[#2B2321]/10 my-1" />
                  <div className={cn(
                    "flex justify-between font-bold text-xs p-1 rounded-sm",
                    savedClosureReport.discrepancy === 0 
                      ? "text-green-700 bg-green-50" 
                      : savedClosureReport.discrepancy > 0 
                        ? "text-amber-700 bg-amber-50" 
                        : "text-red-700 bg-red-50"
                  )}>
                    <span>ÉCART :</span>
                    <span>{savedClosureReport.discrepancy > 0 ? '+' : ''}{savedClosureReport.discrepancy.toLocaleString()} FCFA</span>
                  </div>
                </div>

                {/* Section Dépenses Effectuées du Jour */}
                {(savedClosureReport.totalExpenses > 0 || (savedClosureReport.expensesDetails && savedClosureReport.expensesDetails.length > 0)) && (
                  <>
                    <div className="h-px bg-[#2B2321]/20 border-t border-dashed" />
                    <div className="space-y-1 text-[10px]">
                      <p className="font-bold uppercase tracking-wider text-center text-xs pb-1">Dépenses Effectuées ({savedClosureReport.expensesCount || savedClosureReport.expensesDetails?.length || 0})</p>
                      {savedClosureReport.expensesDetails?.map((exp: any, i: number) => (
                        <div key={exp.id || i} className="flex justify-between text-[9px]">
                          <span className="truncate pr-2">{exp.description}</span>
                          <span className="font-bold text-red-600 shrink-0">-{exp.amount.toLocaleString()} FCFA</span>
                        </div>
                      ))}
                      <div className="flex justify-between font-bold text-xs pt-1 border-t border-secondary/10">
                        <span>TOTAL DÉPENSES :</span>
                        <span>{(savedClosureReport.totalExpenses || 0).toLocaleString()} FCFA</span>
                      </div>
                    </div>
                  </>
                )}

                {/* Section Rapport Stock Restant (Exclure si Clôture Générale 'Tous') */}
                {savedClosureReport.location !== 'Tous' && savedClosureReport.stockSummary && (
                  <>
                    <div className="h-px bg-[#2B2321]/20 border-t border-dashed" />
                    <div className="space-y-1 text-[10px]">
                      <p className="font-bold uppercase tracking-wider text-center text-xs pb-1">Stock Restant ({savedClosureReport.stockSummary.totalProductsCount} Articles)</p>
                      <div className="flex justify-between">
                        <span>TOTAL UNITÉS :</span>
                        <span className="font-bold">{savedClosureReport.stockSummary.totalStockUnits}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>VALEUR TOTALE :</span>
                        <span>{savedClosureReport.stockSummary.totalStockValue.toLocaleString()} FCFA</span>
                      </div>
                      {savedClosureReport.stockSummary.lowStockCount > 0 && (
                        <div className="flex justify-between text-red-600 font-bold">
                          <span>ARTICLES EN ALERTES (&lt; 5) :</span>
                          <span>{savedClosureReport.stockSummary.lowStockCount}</span>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {savedClosureReport.notes && (
                  <>
                    <div className="h-px bg-[#2B2321]/20 border-t border-dashed" />
                    <div className="text-[9px] space-y-1">
                      <span className="font-bold">OBSERVATIONS :</span>
                      <p className="italic leading-normal text-[#2B2321]/80">{savedClosureReport.notes}</p>
                    </div>
                  </>
                )}

                <div className="h-px bg-[#2B2321]/20 border-t border-dashed" />

                <div className="grid grid-cols-2 gap-4 pt-4 text-[8px] text-center uppercase tracking-widest text-[#2B2321]/60">
                  <div className="space-y-8">
                    <span>Signature Caissier</span>
                    <div className="h-px bg-[#2B2321]/30 mx-2" />
                  </div>
                  <div className="space-y-8">
                    <span>Signature Manager</span>
                    <div className="h-px bg-[#2B2321]/30 mx-2" />
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 pt-3 border-t border-secondary/15 shrink-0">
                <button
                  type="button"
                  onClick={() => setSavedClosureReport(null)}
                  className="py-3 bg-secondary/10 hover:bg-secondary/20 text-[#2B2321] rounded-2xl font-bold uppercase tracking-widest text-[10px] transition-all text-center"
                >
                  Fermer
                </button>
                <button
                  type="button"
                  onClick={() => {
                    generateClosureReportPDF({
                      closureReport: savedClosureReport,
                      salesDetails: savedClosureReport.salesDetails || closureSalesList,
                      expensesDetails: savedClosureReport.expensesDetails || closureExpensesList,
                      stockDetails: savedClosureReport.stockDetails || closureStockList,
                      settings
                    });
                  }}
                  className="py-3 bg-emerald-600 text-white hover:bg-emerald-700 rounded-2xl font-bold uppercase tracking-widest text-[10px] shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-1.5 text-center"
                >
                  <Download className="w-3.5 h-3.5 shrink-0" />
                  Rapport PDF
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="py-3 bg-primary text-white hover:bg-primary/90 rounded-2xl font-bold uppercase tracking-widest text-[10px] shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-1.5 text-center"
                >
                  <Printer className="w-3.5 h-3.5 shrink-0" />
                  Imprimer
                </button>
                <button
                  type="button"
                  onClick={handleShareClosure}
                  className="py-3 bg-accent text-white hover:bg-accent/90 rounded-2xl font-bold uppercase tracking-widest text-[10px] shadow-lg shadow-accent/20 transition-all flex items-center justify-center gap-1.5 text-center"
                >
                  <Share2 className="w-3.5 h-3.5 shrink-0" />
                  Partager
                </button>
              </div>

              <style>{`
                @media print {
                  html, body {
                    background: #ffffff !important;
                    color: #000000 !important;
                    margin: 0 !important;
                    padding: 0 !important;
                  }
                  
                  body * { 
                    visibility: hidden !important; 
                  }
                  
                  #printable-closure, #printable-closure * { 
                    visibility: visible !important; 
                  }
                  
                  #printable-closure { 
                    position: absolute !important; 
                    left: 0 !important; 
                    top: 0 !important; 
                    width: 100% !important;
                    max-width: none !important;
                    box-shadow: none !important;
                    border: none !important;
                    margin: 0 !important;
                    padding: 10mm !important;
                    background: #ffffff !important;
                    color: #000000 !important;
                    border-radius: 0 !important;
                  }

                  * {
                    background-color: transparent !important;
                    color: #000000 !important;
                    border-color: #000000 !important;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                  }
                }
              `}</style>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={!!posSaleToDelete}
        title="Supprimer la vente"
        message="🚨 Êtes-vous sûr de vouloir supprimer cette vente ?\n\nCela restaurera également le stock si applicable."
        confirmLabel="Supprimer"
        onConfirm={() => posSaleToDelete && executeDeletePOSSale(posSaleToDelete)}
        onClose={() => setPosSaleToDelete(null)}
      />
    </div>
  );
};
