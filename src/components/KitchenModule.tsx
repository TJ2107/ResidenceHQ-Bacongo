import React, { useState, useEffect } from 'react';
import { Sale, UserProfile, KitchenStatus, AppSettings, AppNotification, Product, PaymentMethod, SaleLocation } from '../types';
import { 
  ChefHat, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  MapPin, 
  Timer,
  ChevronRight,
  Bell,
  UtensilsCrossed,
  Flame,
  Check,
  Printer,
  Plus,
  Search,
  Filter,
  X,
  DollarSign,
  ShoppingBag
} from 'lucide-react';
import { collection, query, where, orderBy, onSnapshot, updateDoc, doc, Timestamp, addDoc, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { cn, handleFirestoreError, OperationType, parseDate } from '../lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { Receipt } from './Receipt';

export const KitchenModule = ({ user, settings }: { user: UserProfile, settings?: AppSettings | null }) => {
  const [orders, setOrders] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [printingOrder, setPrintingOrder] = useState<Sale | null>(null);
  const [selectedLocationFilter, setSelectedLocationFilter] = useState<string>('All');
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [searchQuery, setSearchQuery] = useState('');

  // Direct Hub Order Launcher State
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [orderLocation, setOrderLocation] = useState<SaleLocation>('Restaurant');
  const [tableNumber, setTableNumber] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [cart, setCart] = useState<{ product: Product; quantity: number }[]>([]);

  // Fetch active or all orders (including yesterday's and past food sales)
  useEffect(() => {
    const qSales = query(collection(db, 'sales'), orderBy('timestamp', 'desc'));

    const unsubscribe = onSnapshot(qSales, (snapshot) => {
      const allSales = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Sale));
      
      const isKitchenOrder = (s: Sale) => {
        if (s.kitchenStatus) return true;
        if (s.location === 'Restaurant') return true;
        return s.items && s.items.some(i => {
          const cat = (i.category || '').toLowerCase();
          const pName = (i.productName || '').toLowerCase();
          return cat === 'cuisine' || cat === 'nourriture' || cat === 'food' || cat.includes('déjeuner') || cat.includes('dejeuner') || cat.includes('snack') || cat.includes('repas') || pName.includes('poulet') || pName.includes('poisson') || pName.includes('plat');
        });
      };

      const kitchenSales = allSales.filter(isKitchenOrder);

      const filtered = kitchenSales.filter(order => {
        const status = order.kitchenStatus || 'Delivered';
        if (activeTab === 'active') {
          return ['Pending', 'Preparing', 'Ready'].includes(status);
        } else {
          return ['Delivered', 'Cancelled', 'Completed'].includes(status) || !order.kitchenStatus;
        }
      });

      filtered.sort((a, b) => {
        const timeA = parseDate(a.timestamp).getTime();
        const timeB = parseDate(b.timestamp).getTime();
        return activeTab === 'active' ? timeA - timeB : timeB - timeA;
      });

      setOrders(filtered);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'sales');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [activeTab]);

  // Fetch products for direct hub order launcher (food only, excluding drinks)
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const snap = await getDocs(collection(db, 'products'));
        const prods = snap.docs.map(d => ({ id: d.id, ...d.data() } as Product));
        const foodProds = prods.filter(p => {
          const cat = (p.category || '').toLowerCase();
          const name = (p.name || '').toLowerCase();
          if (
            cat.includes('boisson') || cat.includes('drink') || cat.includes('bar') || 
            cat.includes('jus') || cat.includes('eau') || cat.includes('bière') || 
            cat.includes('vin') || cat.includes('champagne') || cat.includes('cocktail') || 
            cat.includes('soda') || cat.includes('whisky') || cat.includes('liqueur') ||
            name.includes('eau') || name.includes('coca') || name.includes('bière') || 
            name.includes('jus') || name.includes('café') || name.includes('sprite') || name.includes('fanta')
          ) {
            return false;
          }
          return true;
        });
        setProducts(foodProds);
      } catch (err) {
        console.error('Error fetching products:', err);
      }
    };
    fetchProducts();
  }, []);

  const updateStatus = async (orderId: string, newStatus: KitchenStatus, location?: string) => {
    try {
      const order = orders.find(o => o.id === orderId);
      const sellerId = order?.sellerId;
      const orderLocation = location || order?.location || 'Restaurant';

      await updateDoc(doc(db, 'sales', orderId), {
        kitchenStatus: newStatus
      });

      if (newStatus === 'Preparing') {
        const notification: Omit<AppNotification, 'id'> = {
          type: 'info',
          message: `Hub Cuisine : Commande en préparation (${orderLocation})`,
          timestamp: Timestamp.now(),
          readBy: [],
          saleId: orderId,
          location: orderLocation as any
        };
        await addDoc(collection(db, 'notifications'), notification);
        toast.info(`Commande prise en charge (En préparation)`);
      } else if (newStatus === 'Ready') {
        if (sellerId) {
          const sellerNotification: Omit<AppNotification, 'id'> = {
            type: 'order_ready',
            message: `Votre commande pour ${orderLocation} est prête au Hub Cuisine !`,
            timestamp: Timestamp.now(),
            readBy: [],
            saleId: orderId,
            location: orderLocation as any,
            targetUserId: sellerId
          };
          await addDoc(collection(db, 'notifications'), sellerNotification);
        }
        
        const adminNotification: Omit<AppNotification, 'id'> = {
          type: 'order_ready',
          message: `Hub Cuisine : Commande ${orderLocation} prête à servir !`,
          timestamp: Timestamp.now(),
          readBy: [],
          saleId: orderId,
          location: orderLocation as any,
          targetRole: 'admin'
        };
        await addDoc(collection(db, 'notifications'), adminNotification);
        toast.success(`Commande prête signalée !`);
      } else if (newStatus === 'Delivered') {
        const notification: Omit<AppNotification, 'id'> = {
          type: 'info',
          message: `Commande ${orderLocation} servie avec succès.`,
          timestamp: Timestamp.now(),
          readBy: [],
          saleId: orderId,
          location: orderLocation as any
        };
        await addDoc(collection(db, 'notifications'), notification);
        toast.success(`Commande marquée comme servie.`);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'sales');
    }
  };

  const handleAddToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const handleUpdateCartQty = (productId: string, delta: number) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.product.id === productId) {
          const newQty = item.quantity + delta;
          return newQty > 0 ? { ...item, quantity: newQty } : null;
        }
        return item;
      }).filter(Boolean) as { product: Product; quantity: number }[];
    });
  };

  const handleCreateHubOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) {
      toast.error("Veuillez ajouter au moins un plat ou article au panier.");
      return;
    }

    try {
      const totalPrice = cart.reduce((sum, i) => sum + (i.product.price * i.quantity), 0);
      const saleData = {
        items: cart.map(i => ({
          productName: i.product.name,
          productId: i.product.id,
          category: i.product.category,
          price: i.product.price,
          quantity: i.quantity
        })),
        totalPrice,
        timestamp: Timestamp.now(),
        sellerId: user.id,
        sellerName: `${user.username} (Hub Cuisine)`,
        sellerRole: user.role,
        paymentMethod,
        location: orderLocation,
        tableNumber: tableNumber ? tableNumber : null,
        roomId: roomNumber ? roomNumber : null,
        kitchenStatus: 'Pending' as KitchenStatus,
        sourceHub: 'KitchenHub'
      };

      const batch = writeBatch(db);
      const saleRef = doc(collection(db, 'sales'));
      batch.set(saleRef, saleData);

      // Decrement stock for products
      for (const item of cart) {
        const prodRef = doc(db, 'products', item.product.id);
        const curStock = item.product.stock ?? 0;
        batch.update(prodRef, {
          stock: Math.max(0, curStock - item.quantity)
        });
      }

      await batch.commit();
      toast.success("Commande envoyée directement au Hub Cuisine !");
      setIsOrderModalOpen(false);
      setCart([]);
      setTableNumber('');
      setRoomNumber('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'sales');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <ChefHat className="w-12 h-12 text-primary animate-bounce" />
        <p className="text-primary/60 font-bold uppercase tracking-widest text-xs">Chargement du Hub Cuisine...</p>
      </div>
    );
  }

  const isServeur = user?.role === 'serveur';
  const filteredOrders = orders.filter(o => {
    const matchesLocation = selectedLocationFilter === 'All' || o.location === selectedLocationFilter;
    const matchesSearch = searchQuery === '' || 
      o.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.sellerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.tableNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.items?.some(i => i.productName.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesLocation && matchesSearch;
  });

  const pendingOrders = filteredOrders.filter(o => o.kitchenStatus === 'Pending');
  const preparingOrders = filteredOrders.filter(o => o.kitchenStatus === 'Preparing');
  const readyOrders = filteredOrders.filter(o => o.kitchenStatus === 'Ready');
  const deliveredOrders = filteredOrders.filter(o => o.kitchenStatus === 'Delivered');

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-[2rem] border border-secondary/30 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
            <ChefHat className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-[#2B2321]">
                Hub Central de Restauration (Cuisine)
              </h1>
              <span className="px-3 py-1 bg-primary text-white rounded-full text-[10px] font-bold uppercase tracking-widest">
                Master Hub
              </span>
            </div>
            <p className="text-primary/60 font-medium text-xs mt-1">
              Point de vente central et suivi en temps réel des commandes de tous les départements (Terrasse, Bar, VIP, Réception, Chambres)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsOrderModalOpen(true)}
            className="px-5 py-3 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl text-xs uppercase tracking-widest flex items-center gap-2 transition-all shadow-md cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Lancer une Commande Hub
          </button>
        </div>
      </div>

      {/* Tabs & Filters bar */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-2xl border border-secondary/30">
        <div className="flex items-center gap-2 w-full md:w-auto">
          <button
            onClick={() => setActiveTab('active')}
            className={cn(
              "px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer flex-1 md:flex-none",
              activeTab === 'active' 
                ? "bg-primary text-white shadow-md" 
                : "bg-secondary/10 text-primary/70 hover:bg-secondary/20"
            )}
          >
            Commandes Actives ({orders.length})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={cn(
              "px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer flex-1 md:flex-none",
              activeTab === 'history' 
                ? "bg-primary text-white shadow-md" 
                : "bg-secondary/10 text-primary/70 hover:bg-secondary/20"
            )}
          >
            Historique & Servies
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Search */}
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/40" />
            <input
              type="text"
              placeholder="Rechercher plat, table..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-[#FDFBF7] border border-secondary/30 rounded-xl text-xs font-bold text-[#2B2321] focus:outline-none focus:border-primary"
            />
          </div>

          {/* Location filter */}
          <div className="flex items-center gap-1.5 bg-[#FDFBF7] px-3 py-1.5 border border-secondary/30 rounded-xl">
            <Filter className="w-3.5 h-3.5 text-primary/50" />
            <select
              value={selectedLocationFilter}
              onChange={(e) => setSelectedLocationFilter(e.target.value)}
              className="bg-transparent text-xs font-bold text-[#2B2321] focus:outline-none cursor-pointer"
            >
              <option value="All">Tous les points de vente</option>
              <option value="Restaurant">Restaurant</option>
              <option value="Terrasse">Terrasse</option>
              <option value="Bar">Bar</option>
              <option value="VIP">VIP</option>
              <option value="Réception">Réception / Chambres</option>
            </select>
          </div>
        </div>
      </div>

      {/* KPI Counters for Active tab */}
      {activeTab === 'active' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-orange-200 bg-gradient-to-br from-orange-50/50 to-white flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-orange-600 uppercase tracking-widest">En Attente (Nouvelles)</p>
              <p className="text-2xl font-bold text-orange-700 mt-1">{pendingOrders.length}</p>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-2xl flex items-center justify-center text-orange-600">
              <Clock className="w-6 h-6" />
            </div>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50/50 to-white flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">En Préparation (En cours)</p>
              <p className="text-2xl font-bold text-blue-700 mt-1">{preparingOrders.length}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600">
              <Flame className="w-6 h-6 animate-pulse" />
            </div>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-green-200 bg-gradient-to-br from-green-50/50 to-white flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-green-600 uppercase tracking-widest">Prêtes à Servir</p>
              <p className="text-2xl font-bold text-green-700 mt-1">{readyOrders.length}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-2xl flex items-center justify-center text-green-600">
              <CheckCircle className="w-6 h-6" />
            </div>
          </div>
        </div>
      )}

      {/* Orders Grid / Columns */}
      {activeTab === 'active' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Pending Column */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-2 bg-orange-100/50 p-3 rounded-xl border border-orange-200">
              <h2 className="text-xs font-bold uppercase tracking-widest text-orange-800 flex items-center gap-2">
                <Clock className="w-4 h-4 text-orange-600" />
                1. Nouvelles Commandes
              </h2>
              <span className="w-6 h-6 bg-orange-600 text-white rounded-full flex items-center justify-center text-[10px] font-bold">
                {pendingOrders.length}
              </span>
            </div>
            <div className="space-y-4">
              <AnimatePresence mode="popLayout">
                {pendingOrders.map((order) => (
                  <OrderCard 
                    key={order.id} 
                    order={order} 
                    onAction={() => updateStatus(order.id, 'Preparing')}
                    onPrint={() => setPrintingOrder(order)}
                    actionLabel="Préparer"
                    actionIcon={<Flame className="w-4 h-4" />}
                    actionColor="bg-blue-600 hover:bg-blue-700"
                  />
                ))}
                {pendingOrders.length === 0 && (
                  <div className="p-8 border-2 border-dashed border-secondary/20 rounded-[2rem] text-center bg-white">
                    <UtensilsCrossed className="w-8 h-8 text-secondary/20 mx-auto mb-2" />
                    <p className="text-xs font-bold text-secondary/40 uppercase tracking-widest">Aucune nouvelle commande</p>
                  </div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Preparing Column */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-2 bg-blue-100/50 p-3 rounded-xl border border-blue-200">
              <h2 className="text-xs font-bold uppercase tracking-widest text-blue-800 flex items-center gap-2">
                <Flame className="w-4 h-4 text-blue-600" />
                2. En Préparation
              </h2>
              <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-[10px] font-bold">
                {preparingOrders.length}
              </span>
            </div>
            <div className="space-y-4">
              <AnimatePresence mode="popLayout">
                {preparingOrders.map((order) => (
                  <OrderCard 
                    key={order.id} 
                    order={order} 
                    onAction={() => updateStatus(order.id, 'Ready', order.location)}
                    onPrint={() => setPrintingOrder(order)}
                    actionLabel="Prête à servir"
                    actionIcon={<Bell className="w-4 h-4" />}
                    actionColor="bg-green-600 hover:bg-green-700"
                  />
                ))}
                {preparingOrders.length === 0 && (
                  <div className="p-8 border-2 border-dashed border-secondary/20 rounded-[2rem] text-center bg-white">
                    <Flame className="w-8 h-8 text-secondary/20 mx-auto mb-2" />
                    <p className="text-xs font-bold text-secondary/40 uppercase tracking-widest">Rien en cours</p>
                  </div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Ready Column */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-2 bg-green-100/50 p-3 rounded-xl border border-green-200">
              <h2 className="text-xs font-bold uppercase tracking-widest text-green-800 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                3. Prêtes / À Servir
              </h2>
              <span className="w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-[10px] font-bold">
                {readyOrders.length}
              </span>
            </div>
            <div className="space-y-4">
              <AnimatePresence mode="popLayout">
                {readyOrders.map((order) => (
                  <OrderCard 
                    key={order.id} 
                    order={order} 
                    onAction={() => updateStatus(order.id, 'Delivered')}
                    onPrint={() => setPrintingOrder(order)}
                    actionLabel="Marquer Servie"
                    actionIcon={<Check className="w-4 h-4" />}
                    actionColor="bg-[#2B2321] hover:bg-black"
                  />
                ))}
                {readyOrders.length === 0 && (
                  <div className="p-8 border-2 border-dashed border-secondary/20 rounded-[2rem] text-center bg-white">
                    <CheckCircle className="w-8 h-8 text-secondary/20 mx-auto mb-2" />
                    <p className="text-xs font-bold text-secondary/40 uppercase tracking-widest">Aucune commande en attente de service</p>
                  </div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      ) : (
        /* History view */
        <div className="bg-white rounded-[2rem] border border-secondary/30 p-6 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-widest text-[#2B2321]/60 mb-4">
            Historique des commandes de cuisine ({filteredOrders.length})
          </h2>
          <div className="space-y-4">
            {filteredOrders.map(order => (
              <div key={order.id} className="p-4 bg-[#FDFBF7] rounded-2xl border border-secondary/20 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-0.5 bg-primary/10 text-primary rounded-full text-[10px] font-bold uppercase">
                      {order.location || 'Restaurant'}
                    </span>
                    {order.tableNumber && (
                      <span className="px-3 py-0.5 bg-amber-50 text-amber-700 rounded-full text-[10px] font-bold">
                        Table {order.tableNumber}
                      </span>
                    )}
                    <span className="text-xs font-bold text-[#2B2321]/50">#{order.id.slice(-6)}</span>
                  </div>
                  <p className="text-xs font-bold text-[#2B2321]">
                    {order.items?.map(i => `${i.quantity}x ${i.productName}`).join(', ')}
                  </p>
                  <p className="text-[10px] text-primary/60 font-medium">
                    Serveur / Auteur : {order.sellerName} | Paiement : {order.paymentMethod}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm font-bold text-primary">{order.totalPrice?.toLocaleString()} FCFA</p>
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest inline-block mt-1",
                      order.kitchenStatus === 'Delivered' ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                    )}>
                      {order.kitchenStatus === 'Delivered' ? 'Servie' : 'Annulée'}
                    </span>
                  </div>
                  <button
                    onClick={() => setPrintingOrder(order)}
                    className="p-2.5 bg-white border border-secondary/30 rounded-xl hover:bg-secondary/10 transition-all text-primary"
                    title="Imprimer"
                  >
                    <Printer className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
            {filteredOrders.length === 0 && (
              <div className="text-center py-12 text-secondary/40 font-bold text-xs uppercase tracking-widest">
                Aucun historique trouvé
              </div>
            )}
          </div>
        </div>
      )}

      {/* DIRECT HUB ORDER LAUNCHER MODAL */}
      {isOrderModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-[2.5rem] border border-secondary/30 shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
          >
            <div className="p-6 border-b border-secondary/20 flex justify-between items-center bg-[#FDFBF7]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                  <ChefHat className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-[#2B2321]">Lancer une Commande depuis le Hub Cuisine</h2>
                  <p className="text-xs text-primary/60 font-medium">Créez et envoyez une commande nourriture pour n'importe quel point de vente</p>
                </div>
              </div>
              <button 
                onClick={() => setIsOrderModalOpen(false)}
                className="p-2 hover:bg-secondary/10 rounded-full transition-colors cursor-pointer text-[#2B2321]/60"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateHubOrder} className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Left: Product Selector */}
              <div className="space-y-4">
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-2.5 text-amber-800 text-[11px]">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <p>
                    <strong>Anti-double encaissement :</strong> Les commandes de nourriture saisies au Point de Vente (Terrasse, Bar, VIP) arrivent déjà automatiquement ici. Ne créez pas de doublon.
                  </p>
                </div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-[#2B2321]/60">Sélectionner les plats / articles</h3>
                <div className="space-y-2 max-h-[350px] overflow-y-auto pr-2">
                  {products.map(product => (
                    <div 
                      key={product.id}
                      onClick={() => handleAddToCart(product)}
                      className="p-3 bg-[#FDFBF7] border border-secondary/20 hover:border-primary/50 rounded-2xl flex justify-between items-center cursor-pointer transition-all group"
                    >
                      <div>
                        <p className="text-xs font-bold text-[#2B2321] group-hover:text-primary transition-colors">{product.name}</p>
                        <p className="text-[10px] text-primary/60 font-bold uppercase">{product.category} • {product.price} FCFA</p>
                      </div>
                      <button type="button" className="w-8 h-8 bg-primary/10 text-primary rounded-xl flex items-center justify-center font-bold text-xs group-hover:bg-primary group-hover:text-white transition-all">
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right: Order Configuration & Cart */}
              <div className="space-y-6 bg-[#FDFBF7] p-6 rounded-3xl border border-secondary/20 flex flex-col justify-between">
                <div className="space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-[#2B2321]/60">Détails de la commande</h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-primary uppercase tracking-widest mb-1.5">Point de Vente Destination</label>
                      <select
                        value={orderLocation}
                        onChange={(e) => setOrderLocation(e.target.value as SaleLocation)}
                        className="w-full px-3 py-2.5 bg-white border border-secondary/30 rounded-xl text-xs font-bold text-[#2B2321] focus:outline-none focus:border-primary"
                      >
                        <option value="Restaurant">Restaurant</option>
                        <option value="Terrasse">Terrasse</option>
                        <option value="Bar">Bar</option>
                        <option value="VIP">VIP</option>
                        <option value="Réception">Réception / Chambres</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-primary uppercase tracking-widest mb-1.5">Mode de Paiement</label>
                      <select
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                        className="w-full px-3 py-2.5 bg-white border border-secondary/30 rounded-xl text-xs font-bold text-[#2B2321] focus:outline-none focus:border-primary"
                      >
                        <option value="Cash">Espèces (Cash)</option>
                        <option value="Card">Carte Bancaire</option>
                        <option value="Mobile Money">Mobile Money (Wave/OM)</option>
                        <option value="Room Charge">Facturer à la Chambre</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-primary uppercase tracking-widest mb-1.5">N° Table (Optionnel)</label>
                      <input
                        type="text"
                        placeholder="Ex: T04"
                        value={tableNumber}
                        onChange={(e) => setTableNumber(e.target.value)}
                        className="w-full px-3 py-2.5 bg-white border border-secondary/30 rounded-xl text-xs font-bold text-[#2B2321] focus:outline-none focus:border-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-primary uppercase tracking-widest mb-1.5">N° Chambre (Optionnel)</label>
                      <input
                        type="text"
                        placeholder="Ex: 102"
                        value={roomNumber}
                        onChange={(e) => setRoomNumber(e.target.value)}
                        className="w-full px-3 py-2.5 bg-white border border-secondary/30 rounded-xl text-xs font-bold text-[#2B2321] focus:outline-none focus:border-primary"
                      />
                    </div>
                  </div>

                  {/* Cart summary */}
                  <div className="border-t border-secondary/20 pt-4 space-y-2">
                    <p className="text-xs font-bold text-[#2B2321] uppercase tracking-wider">Panier sélectionné ({cart.length})</p>
                    <div className="max-h-[140px] overflow-y-auto space-y-2 pr-1">
                      {cart.map(item => (
                        <div key={item.product.id} className="flex justify-between items-center bg-white p-2.5 rounded-xl border border-secondary/20">
                          <div>
                            <p className="text-xs font-bold text-[#2B2321]">{item.product.name}</p>
                            <p className="text-[10px] text-primary/60 font-bold">{item.product.price * item.quantity} FCFA</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button type="button" onClick={() => handleUpdateCartQty(item.product.id, -1)} className="w-6 h-6 bg-secondary/10 rounded-lg flex items-center justify-center font-bold text-xs">-</button>
                            <span className="text-xs font-bold">{item.quantity}</span>
                            <button type="button" onClick={() => handleUpdateCartQty(item.product.id, 1)} className="w-6 h-6 bg-secondary/10 rounded-lg flex items-center justify-center font-bold text-xs">+</button>
                          </div>
                        </div>
                      ))}
                      {cart.length === 0 && (
                        <p className="text-xs text-secondary/40 italic py-2 text-center">Aucun article sélectionné</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="border-t border-secondary/20 pt-4 space-y-4">
                  <div className="flex justify-between items-center text-sm font-bold text-[#2B2321]">
                    <span>Total Commande :</span>
                    <span className="text-primary text-lg">{cart.reduce((s, i) => s + (i.product.price * i.quantity), 0).toLocaleString()} FCFA</span>
                  </div>
                  <button
                    type="submit"
                    className="w-full py-3.5 bg-primary hover:bg-primary/90 text-white font-bold rounded-2xl text-xs uppercase tracking-widest transition-all shadow-lg shadow-primary/20 cursor-pointer"
                  >
                    Envoyer au Hub Cuisine
                  </button>
                </div>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Order Printing Overlay */}
      {printingOrder && (
        <Receipt 
          sale={printingOrder} 
          onClose={() => setPrintingOrder(null)} 
          settings={settings} 
          type="order"
        />
      )}
    </div>
  );
};

const OrderCard: React.FC<{ 
  order: Sale, 
  onAction: () => void | Promise<void>, 
  onPrint: () => void,
  actionLabel: string,
  actionIcon: React.ReactNode,
  actionColor: string,
  disabled?: boolean
}> = ({ order, onAction, onPrint, actionLabel, actionIcon, actionColor, disabled }) => {
  const timeSince = order.timestamp ? Math.floor((Date.now() - order.timestamp.toMillis()) / 60000) : 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="bg-white border border-secondary/30 rounded-[2rem] overflow-hidden shadow-sm hover:shadow-xl hover:shadow-primary/5 transition-all group"
    >
      <div className="p-6 space-y-4">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn(
                "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border",
                order.location === 'VIP' ? "bg-purple-50 text-purple-600 border-purple-100" :
                order.location === 'Terrasse' ? "bg-orange-50 text-orange-600 border-orange-100" :
                (order.location as string) === 'Bar' ? "bg-amber-50 text-amber-600 border-amber-100" :
                "bg-blue-50 text-blue-600 border-blue-100"
              )}>
                {order.location || 'Restaurant'}
              </span>
              {order.tableNumber && (
                <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border bg-amber-50 text-amber-600 border-amber-100">
                  Table {order.tableNumber}
                </span>
              )}
              {order.roomId && (
                <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border bg-indigo-50 text-indigo-600 border-indigo-100">
                  Chambre {order.roomId}
                </span>
              )}
              <span className="text-[10px] font-bold text-[#2B2321]/40 uppercase tracking-widest">
                #{order.id.slice(-4)}
              </span>
            </div>
            <p className={cn(
              "text-xs font-bold flex items-center gap-1",
              timeSince > 20 ? "text-red-500 animate-pulse" : "text-[#2B2321]/60"
            )}>
              <Timer className="w-3 h-3" />
              {timeSince} min (Il y a {timeSince} min)
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold text-primary uppercase tracking-widest">{order.sellerName}</p>
            <p className="text-[10px] font-bold text-secondary/60">{order.paymentMethod}</p>
          </div>
        </div>

        {/* Anti-Double Cashing Alert Badge */}
        <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between gap-2 text-emerald-800">
          <div className="flex items-center gap-2 min-w-0">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <div className="text-[11px] leading-tight">
              <span className="font-black uppercase tracking-wider block">
                Facture Déjà Encaissée au Point de Vente
              </span>
              <span className="text-[10px] text-emerald-700 font-semibold">
                Origine : {order.originalLocation || order.location || 'POS'} • Règlement : {order.paymentMethod} • Vendeur : {order.sellerName}
              </span>
            </div>
          </div>
          <span className="px-2 py-0.5 bg-emerald-600 text-white rounded-md text-[9px] font-black uppercase tracking-widest shrink-0">
            Ne pas ré-encaisser
          </span>
        </div>

        {/* Items */}
        <div className="space-y-2 py-4 border-y border-secondary/10">
          {order.items.map((item, idx) => (
            <div key={idx} className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 bg-[#FDFBF7] rounded-lg flex items-center justify-center text-xs font-bold text-primary border border-secondary/20">
                  {item.quantity}
                </span>
                <p className="text-sm font-bold text-[#2B2321]">{item.productName}</p>
              </div>
              <span className="text-xs font-bold text-primary/70">{(item.price * item.quantity).toLocaleString()} F</span>
            </div>
          ))}
        </div>

        {/* Action */}
        <div className="flex gap-2 font-sans text-xs">
          {!disabled && (
            <button
              onClick={onAction}
              className={cn(
                "flex-1 py-3 rounded-xl text-white font-bold uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 transition-all shadow-lg shadow-primary/10 cursor-pointer",
                actionColor
              )}
            >
              {actionIcon}
              {actionLabel}
            </button>
          )}
          {order.kitchenStatus !== 'Delivered' && order.kitchenStatus !== 'Cancelled' && (
            <>
              <button
                onClick={onPrint}
                className="p-3 rounded-xl bg-primary/5 text-primary border border-primary/10 hover:bg-primary/10 transition-all cursor-pointer"
                title="Imprimer le bon de commande"
              >
                <Printer className="w-4 h-4" />
              </button>
              <button
                onClick={async () => {
                  try {
                    await updateDoc(doc(db, 'sales', order.id), {
                      kitchenStatus: 'Cancelled'
                    });
                    toast.error('Commande annulée');
                  } catch (error) {
                    handleFirestoreError(error, OperationType.UPDATE, 'sales');
                  }
                }}
                className="p-3 rounded-xl bg-red-50 text-red-500 border border-red-100 hover:bg-red-100 transition-all cursor-pointer"
                title="Annuler la commande"
              >
                <AlertCircle className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
};
