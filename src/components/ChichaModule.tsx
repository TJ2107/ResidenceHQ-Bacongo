import React, { useState, useEffect } from 'react';
import { 
  Flame, Plus, ShoppingBag, Package, History, CheckCircle, 
  Trash2, Edit, Search, AlertCircle, Printer, Download, X,
  Clock, CreditCard, DollarSign, User as UserIcon, ShieldAlert,
  FileText, RefreshCw, Layers
} from 'lucide-react';
import { 
  collection, onSnapshot, addDoc, updateDoc, doc, deleteDoc, 
  Timestamp, query, orderBy, getDoc, getDocs, increment, where 
} from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, AppSettings, ShishaProduct, ShishaSale, ShishaSaleItem, Room } from '../types';
import { ConfirmModal } from './ConfirmModal';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface ChichaModuleProps {
  user: UserProfile | null;
  settings?: AppSettings | null;
  rooms?: Room[];
}

const DEFAULT_SHISHA_PRODUCTS: Omit<ShishaProduct, 'id'>[] = [
  { name: 'Chicha Double Pomme', flavor: 'Double Pomme Al Fakher', price: 5000, stock: 25, category: 'Classic', alertStock: 5 },
  { name: 'Chicha Menthe Poivrée', flavor: 'Menthe Fraîche', price: 5000, stock: 30, category: 'Classic', alertStock: 5 },
  { name: 'Chicha Raisin Menthe', flavor: 'Raisin & Menthe', price: 5000, stock: 20, category: 'Classic', alertStock: 5 },
  { name: 'Chicha Love 66 HQ', flavor: 'Fruit de la passion, Pastèque & Menthe', price: 7000, stock: 15, category: 'Special', alertStock: 3 },
  { name: 'Chicha Hawaiian Ice', flavor: 'Ananas, Mango & Coco Menthe', price: 7000, stock: 15, category: 'Special', alertStock: 3 },
  { name: 'Chicha Fruits Rouges VIP', flavor: 'Mélange Baies Sauvages & Glace', price: 10000, stock: 10, category: 'VIP', alertStock: 2 },
  { name: 'Recharge Charbon Naturel (3 pcs)', flavor: 'Charbon Coco', price: 1000, stock: 100, category: 'Charcoal', alertStock: 20 },
  { name: 'Changement Foyer / Tête', flavor: 'Tête fraîche parfumée', price: 2500, stock: 40, category: 'Accessory', alertStock: 5 }
];

export const ChichaModule: React.FC<ChichaModuleProps> = ({ user, settings, rooms = [] }) => {
  const [subTab, setSubTab] = useState<'pos' | 'stock' | 'historique' | 'cloture'>('pos');
  const [products, setProducts] = useState<ShishaProduct[]>([]);
  const [sales, setSales] = useState<ShishaSale[]>([]);
  const [loading, setLoading] = useState(true);

  // POS State
  const [cart, setCart] = useState<{ product: ShishaProduct; quantity: number }[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'Espèces' | 'Carte' | 'Chambre'>('Espèces');
  const [tableNumber, setTableNumber] = useState('Terrasse T1');
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [saleNotes, setSaleNotes] = useState('');
  const [isProcessingSale, setIsProcessingSale] = useState(false);
  const [printedReceipt, setPrintedReceipt] = useState<ShishaSale | null>(null);
  const [chichaProductToDelete, setChichaProductToDelete] = useState<{id: string, name: string} | null>(null);
  const [chichaSaleToDelete, setChichaSaleToDelete] = useState<{saleId: string, ticketId: string} | null>(null);

  // Stock Form State
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ShishaProduct | null>(null);
  const [productForm, setProductForm] = useState({
    name: '',
    flavor: '',
    price: '',
    stock: '',
    category: 'Classic' as ShishaProduct['category'],
    alertStock: '5'
  });

  // Clôture State
  const [physicalCashCount, setPhysicalCashCount] = useState('');
  const [closureNotes, setClosureNotes] = useState('');
  const [isClosing, setIsClosing] = useState(false);

  // Check roles
  const isManagerOrAdmin = user?.role === 'admin' || user?.role === 'manager' || user?.email?.toLowerCase() === 'cyber.kan587@gmail.com';
  const canManageStock = isManagerOrAdmin || user?.role === 'receptionist' || user?.role === 'barman' || user?.role === 'caissiere' || user?.role === 'serveur';

  // 1. Subscribe to Firestore Collections
  useEffect(() => {
    setLoading(true);

    // Products listener
    const unsubscribeProducts = onSnapshot(
      collection(db, 'shisha_products'),
      (snapshot) => {
        const items: ShishaProduct[] = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as ShishaProduct));

        // Auto-seed only on first initialization if empty
        if (items.length === 0 && !snapshot.metadata.hasPendingWrites) {
          const hasSeeded = localStorage.getItem('shisha_products_seeded');
          if (!hasSeeded) {
            seedInitialProducts();
            localStorage.setItem('shisha_products_seeded', 'true');
          } else {
            setProducts([]);
          }
        } else {
          localStorage.setItem('shisha_products_seeded', 'true');
          setProducts(items);
        }
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching shisha products:", error);
        setLoading(false);
      }
    );

    // Sales listener
    const qSales = query(collection(db, 'shisha_sales'), orderBy('timestamp', 'desc'));
    const unsubscribeSales = onSnapshot(
      qSales,
      (snapshot) => {
        const salesList: ShishaSale[] = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as ShishaSale));
        setSales(salesList);
      },
      (error) => {
        console.error("Error fetching shisha sales:", error);
      }
    );

    return () => {
      unsubscribeProducts();
      unsubscribeSales();
    };
  }, []);

  const seedInitialProducts = async () => {
    try {
      for (const prod of DEFAULT_SHISHA_PRODUCTS) {
        await addDoc(collection(db, 'shisha_products'), prod);
      }
    } catch (err) {
      console.error("Failed to seed initial shisha products", err);
    }
  };

  // Cart Management
  const addToCart = (product: ShishaProduct) => {
    if (product.stock <= 0) {
      toast.error(`Stock épuisé pour ${product.name}`);
      return;
    }
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) {
          toast.error(`Quantité maximale en stock atteinte (${product.stock})`);
          return prev;
        }
        return prev.map(item => 
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateCartQty = (productId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.product.id === productId) {
        const newQty = item.quantity + delta;
        if (newQty > item.product.stock) {
          toast.error(`Stock insuffisant (${item.product.stock} dispo)`);
          return item;
        }
        return newQty > 0 ? { ...item, quantity: newQty } : null;
      }
      return item;
    }).filter(Boolean) as { product: ShishaProduct; quantity: number }[]);
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);

  // Submit Sale (Isolated Chisha Ledger)
  const handleCheckout = async () => {
    if (cart.length === 0) {
      toast.error("Le panier Chicha est vide.");
      return;
    }

    if (paymentMethod === 'Chambre' && !selectedRoomId) {
      toast.error("Veuillez sélectionner le numéro de chambre pour l'imputation.");
      return;
    }

    setIsProcessingSale(true);
    try {
      const ticketId = `CH-${Date.now().toString().slice(-6)}`;
      const roomObj = rooms.find(r => r.id === selectedRoomId);

      const itemsList: ShishaSaleItem[] = cart.map(item => ({
        productId: item.product.id,
        name: item.product.name,
        quantity: item.quantity,
        price: item.product.price
      }));

      const newSaleData: Omit<ShishaSale, 'id'> = {
        ticketId,
        items: itemsList,
        totalAmount: cartTotal,
        paymentMethod,
        tableNumber: tableNumber.trim() || 'Comptoir Chicha',
        sellerId: user?.id || 'anonymous',
        sellerName: user?.username || 'Vendeur Chicha',
        sellerRole: user?.role || 'staff',
        timestamp: Timestamp.now(),
        ...(saleNotes.trim() ? { notes: saleNotes.trim() } : {}),
        ...(paymentMethod === 'Chambre' && selectedRoomId ? { roomId: selectedRoomId } : {}),
        ...(paymentMethod === 'Chambre' && roomObj?.number ? { roomNumber: roomObj.number } : {})
      };

      // 1. Add record to isolated collection `shisha_sales` (separate from general accounting)
      const docRef = await addDoc(collection(db, 'shisha_sales'), newSaleData);

      // 3. Decrement stock for each item in `shisha_products`
      for (const item of cart) {
        const newStock = Math.max(0, item.product.stock - item.quantity);
        await updateDoc(doc(db, 'shisha_products', item.product.id), {
          stock: newStock
        });
      }

      toast.success(`Vente Chicha enregistrée ! Ticket : ${ticketId}`);
      
      const createdSale: ShishaSale = {
        id: docRef.id,
        ...newSaleData
      };

      setPrintedReceipt(createdSale);
      setCart([]);
      setSaleNotes('');
    } catch (error) {
      console.error("Error placing shisha sale:", error);
      toast.error("Erreur lors de l'enregistrement de la vente Chicha.");
    } finally {
      setIsProcessingSale(false);
    }
  };

  // Stock CRUD Operations
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productForm.name || !productForm.price) {
      toast.error("Veuillez renseigner le nom et le prix.");
      return;
    }

    try {
      const payload: Record<string, any> = {
        name: productForm.name.trim(),
        price: Number(productForm.price),
        stock: Number(productForm.stock || 0),
        category: productForm.category,
        alertStock: Number(productForm.alertStock || 5),
        ...(productForm.flavor.trim() ? { flavor: productForm.flavor.trim() } : {})
      };

      if (editingProduct) {
        await updateDoc(doc(db, 'shisha_products', editingProduct.id), payload);
        toast.success("Article Chicha mis à jour !");
      } else {
        await addDoc(collection(db, 'shisha_products'), payload);
        toast.success("Article Chicha ajouté au stock !");
      }

      setIsAddingProduct(false);
      setEditingProduct(null);
      setProductForm({ name: '', flavor: '', price: '', stock: '', category: 'Classic', alertStock: '5' });
    } catch (err) {
      console.error("Error saving shisha product:", err);
      toast.error("Erreur lors de l'enregistrement du produit.");
    }
  };

  const executeDeleteProduct = async (id: string, name: string) => {
    try {
      await deleteDoc(doc(db, 'shisha_products', id));
      toast.success(`Article "${name}" supprimé.`);
    } catch (err) {
      console.error("Error deleting product:", err);
      toast.error("Erreur lors de la suppression de l'article.");
    }
  };

  const handleDeleteProduct = async (id: string, name: string) => {
    if (!canManageStock) {
      toast.error("Vous n'avez pas les autorisations suffisantes pour supprimer des articles Chicha.");
      return;
    }
    setChichaProductToDelete({ id, name });
  };

  const executeDeleteSale = async (saleId: string, ticketId: string) => {
    try {
      const saleSnap = await getDoc(doc(db, 'shisha_sales', saleId));
      if (saleSnap.exists()) {
        const saleData = saleSnap.data();
        if (saleData.items) {
          for (const item of saleData.items) {
            await updateDoc(doc(db, 'shisha_products', item.productId), {
              stock: increment(item.quantity)
            });
          }
        }
      }

      await deleteDoc(doc(db, 'shisha_sales', saleId));
      
      const salesQ = query(collection(db, 'sales'), where('sourceId', '==', saleId));
      const salesSnap = await getDocs(salesQ);
      for (const s of salesSnap.docs) {
        await deleteDoc(s.ref);
      }

      toast.success(`Vente ${ticketId} supprimée et stock restauré.`);
    } catch (err) {
      console.error("Error deleting sale:", err);
      toast.error("Erreur lors de la suppression de la vente.");
    }
  };

  const handleDeleteSale = async (saleId: string, ticketId: string) => {
    if (!isManagerOrAdmin) {
      toast.error("Seuls les Administrateurs et Managers peuvent supprimer une vente.");
      return;
    }
    setChichaSaleToDelete({ saleId, ticketId });
  };

  const handleQuickRestock = async (product: ShishaProduct, delta: number) => {
    try {
      const newStock = product.stock + delta;
      await updateDoc(doc(db, 'shisha_products', product.id), {
        stock: newStock
      });
      toast.success(`Stock de ${product.name} ajusté : ${newStock}`);
    } catch (err) {
      console.error("Error restocking:", err);
      toast.error("Erreur d'ajustement du stock.");
    }
  };

  // Filter products
  const filteredProducts = products.filter(p => {
    const matchesCat = selectedCategory === 'All' || p.category === selectedCategory;
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (p.flavor && p.flavor.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCat && matchesSearch;
  });

  // Calculate stats for today's Chicha sales
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todaySales = sales.filter(s => {
    if (!s.timestamp) return false;
    const saleDate = format(s.timestamp.toDate(), 'yyyy-MM-dd');
    return saleDate === todayStr;
  });

  const todayTotalRevenue = todaySales.reduce((acc, s) => acc + (s.totalAmount || 0), 0);
  const todayCashRevenue = todaySales.filter(s => s.paymentMethod === 'Espèces').reduce((acc, s) => acc + (s.totalAmount || 0), 0);
  const todayMobileRevenue = todaySales.filter(s => ['Wave', 'Orange Money', 'Moov'].includes(s.paymentMethod)).reduce((acc, s) => acc + (s.totalAmount || 0), 0);
  const todayRoomRevenue = todaySales.filter(s => s.paymentMethod === 'Chambre').reduce((acc, s) => acc + (s.totalAmount || 0), 0);

  // Trigger Print
  const triggerPrintReceipt = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Dynamic Header with Red Bold Icon Theme */}
      <div className="bg-gradient-to-r from-[#2B2321] via-[#3A2D2A] to-[#2B2321] rounded-3xl p-6 text-white shadow-xl relative overflow-hidden border-2 border-red-500/20">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-red-600/20 border-2 border-red-500 rounded-2xl flex items-center justify-center shadow-lg shrink-0">
              <Flame className="w-8 h-8 text-red-500 fill-red-500 stroke-[2.5] animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight font-serif italic text-white">Espace Chicha & Lounge</h1>
                <span className="bg-red-600 text-white font-black text-[10px] uppercase tracking-widest px-2.5 py-0.5 rounded-full shadow-sm border border-red-400">
                  Caisse Autonome
                </span>
              </div>
              <p className="text-xs text-red-200/80 mt-1 font-medium flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-red-400 shrink-0" />
                Gestion étanche : Les recettes Chicha sont isolées et exclues de la comptabilité générale.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/10 self-start md:self-auto">
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-widest text-red-200 font-bold">Ventes Chicha Aujourd'hui</p>
              <p className="text-xl font-black text-white">{todayTotalRevenue.toLocaleString()} <span className="text-xs font-normal">FCFA</span></p>
            </div>
            <div className="h-8 w-px bg-white/20" />
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-widest text-red-200 font-bold">Chichas Servies</p>
              <p className="text-xl font-black text-red-400">{todaySales.length}</p>
            </div>
          </div>
        </div>

        {/* Sub Navigation */}
        <div className="flex flex-wrap items-center gap-2 mt-6 pt-4 border-t border-white/10">
          <button
            onClick={() => setSubTab('pos')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all ${
              subTab === 'pos' 
                ? 'bg-red-600 text-white shadow-md shadow-red-600/30' 
                : 'bg-white/10 text-white/80 hover:bg-white/20 hover:text-white'
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            Vente Chicha (POS)
          </button>
          <button
            onClick={() => setSubTab('stock')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all ${
              subTab === 'stock' 
                ? 'bg-red-600 text-white shadow-md shadow-red-600/30' 
                : 'bg-white/10 text-white/80 hover:bg-white/20 hover:text-white'
            }`}
          >
            <Package className="w-4 h-4" />
            Stock & Parfums ({products.length})
          </button>
          <button
            onClick={() => setSubTab('historique')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all ${
              subTab === 'historique' 
                ? 'bg-red-600 text-white shadow-md shadow-red-600/30' 
                : 'bg-white/10 text-white/80 hover:bg-white/20 hover:text-white'
            }`}
          >
            <History className="w-4 h-4" />
            Historique Ventes ({todaySales.length} aujourd'hui)
          </button>
          <button
            onClick={() => setSubTab('cloture')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all ${
              subTab === 'cloture' 
                ? 'bg-red-600 text-white shadow-md shadow-red-600/30' 
                : 'bg-white/10 text-white/80 hover:bg-white/20 hover:text-white'
            }`}
          >
            <FileText className="w-4 h-4" />
            Clôture Caisse Chicha
          </button>
        </div>
      </div>

      {/* ----------------- SUBTAB 1: POS VENTE CHICHA ----------------- */}
      {subTab === 'pos' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Catalog Side */}
          <div className="lg:col-span-7 space-y-4">
            {/* Controls Bar */}
            <div className="bg-white p-4 rounded-2xl border border-secondary/20 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
              {/* Category Filter */}
              <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 hide-scrollbar">
                {['All', 'Classic', 'Special', 'VIP', 'Charcoal', 'Accessory'].map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                      selectedCategory === cat 
                        ? 'bg-red-600 text-white shadow-sm' 
                        : 'bg-[#FDFBF7] text-[#2B2321]/70 hover:bg-secondary/10'
                    }`}
                  >
                    {cat === 'All' ? 'Tous' : cat}
                  </button>
                ))}
              </div>

              {/* Search Bar */}
              <div className="relative w-full sm:w-48">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-primary/40" />
                <input
                  type="text"
                  placeholder="Rechercher parfum..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-[#FDFBF7] border border-secondary/20 rounded-xl text-xs focus:outline-none focus:border-red-500"
                />
              </div>
            </div>

            {/* Products Grid */}
            {loading ? (
              <div className="p-12 text-center bg-white rounded-2xl border border-secondary/20">
                <div className="w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-xs font-bold text-primary/60">Chargement de la carte Chicha...</p>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="p-12 text-center bg-white rounded-2xl border border-secondary/20 text-primary/60">
                <Flame className="w-12 h-12 text-red-300 mx-auto mb-2" />
                <p className="font-bold text-sm">Aucun produit Chicha trouvé.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {filteredProducts.map(product => {
                  const isLow = product.stock <= (product.alertStock || 5);
                  const isOut = product.stock <= 0;

                  return (
                    <button
                      key={product.id}
                      onClick={() => addToCart(product)}
                      disabled={isOut}
                      className={`p-4 rounded-2xl border text-left transition-all relative group flex flex-col justify-between ${
                        isOut 
                          ? 'bg-gray-50 border-gray-200 opacity-60 cursor-not-allowed' 
                          : 'bg-white hover:border-red-500 hover:shadow-lg border-secondary/20 active:scale-95'
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-1 mb-1">
                          <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${
                            product.category === 'VIP' 
                              ? 'bg-amber-100 text-amber-800' 
                              : product.category === 'Special'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-red-50 text-red-700'
                          }`}>
                            {product.category}
                          </span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            isOut ? 'bg-red-100 text-red-700' : isLow ? 'bg-amber-100 text-amber-700' : 'bg-emerald-50 text-emerald-700'
                          }`}>
                            Stock: {product.stock}
                          </span>
                        </div>

                        <h3 className="font-bold text-[#2B2321] text-sm group-hover:text-red-600 transition-colors line-clamp-1 mt-1">
                          {product.name}
                        </h3>
                        {product.flavor && (
                          <p className="text-[11px] text-primary/60 line-clamp-1 italic mt-0.5">
                            {product.flavor}
                          </p>
                        )}
                      </div>

                      <div className="mt-3 pt-2 border-t border-secondary/10 flex items-center justify-between">
                        <span className="font-black text-red-600 text-sm">
                          {product.price.toLocaleString()} FCFA
                        </span>
                        <div className="w-7 h-7 rounded-lg bg-red-50 text-red-600 group-hover:bg-red-600 group-hover:text-white flex items-center justify-center transition-colors">
                          <Plus className="w-4 h-4" />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Cart & Checkout Panel */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white rounded-3xl border border-secondary/20 shadow-xl overflow-hidden flex flex-col h-full">
              {/* Header */}
              <div className="bg-[#2B2321] p-4 text-white flex items-center justify-between border-b border-red-500/30">
                <div className="flex items-center gap-2">
                  <Flame className="w-5 h-5 text-red-500 fill-red-500" />
                  <h2 className="font-bold text-sm tracking-wide">Commande Chicha en cours</h2>
                </div>
                <span className="bg-red-600 text-white text-xs font-bold px-2.5 py-0.5 rounded-full">
                  {cart.reduce((a, b) => a + b.quantity, 0)} articles
                </span>
              </div>

              {/* Items List */}
              <div className="p-4 flex-1 overflow-y-auto max-h-[320px] divide-y divide-secondary/10">
                {cart.length === 0 ? (
                  <div className="py-12 text-center text-primary/40">
                    <ShoppingBag className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p className="text-xs font-bold">Sélectionnez une Chicha ou un charbon pour commencer.</p>
                  </div>
                ) : (
                  cart.map(item => (
                    <div key={item.product.id} className="py-3 flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-xs text-[#2B2321] truncate">{item.product.name}</p>
                        <p className="text-[10px] text-red-600 font-semibold">
                          {item.product.price.toLocaleString()} FCFA / un.
                        </p>
                      </div>

                      {/* Quantity Selector */}
                      <div className="flex items-center gap-2 bg-[#FDFBF7] border border-secondary/20 rounded-xl p-1">
                        <button
                          onClick={() => updateCartQty(item.product.id, -1)}
                          className="w-6 h-6 rounded-lg bg-white shadow-sm flex items-center justify-center font-bold text-xs text-[#2B2321] hover:bg-secondary/10"
                        >
                          -
                        </button>
                        <span className="font-bold text-xs w-4 text-center">{item.quantity}</span>
                        <button
                          onClick={() => updateCartQty(item.product.id, 1)}
                          className="w-6 h-6 rounded-lg bg-white shadow-sm flex items-center justify-center font-bold text-xs text-[#2B2321] hover:bg-secondary/10"
                        >
                          +
                        </button>
                      </div>

                      <div className="text-right min-w-[70px]">
                        <p className="font-extrabold text-xs text-[#2B2321]">
                          {(item.product.price * item.quantity).toLocaleString()}
                        </p>
                        <button
                          onClick={() => removeFromCart(item.product.id)}
                          className="text-[10px] text-red-500 hover:underline font-bold"
                        >
                          Suppr.
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Order Options */}
              <div className="p-4 bg-[#FDFBF7] border-t border-secondary/20 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-primary/70 uppercase mb-1">
                      Table / Emplacement
                    </label>
                    <input
                      type="text"
                      value={tableNumber}
                      onChange={e => setTableNumber(e.target.value)}
                      placeholder="Ex: Terrasse T4"
                      className="w-full px-3 py-1.5 bg-white border border-secondary/20 rounded-xl text-xs font-bold text-[#2B2321]"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-primary/70 uppercase mb-1">
                      Mode de Paiement
                    </label>
                    <select
                      value={paymentMethod}
                      onChange={e => setPaymentMethod(e.target.value as any)}
                      className="w-full px-3 py-1.5 bg-white border border-secondary/20 rounded-xl text-xs font-bold text-[#2B2321]"
                    >
                      <option value="Espèces">Espèces (Cash)</option>
                      <option value="Carte">Carte Bancaire</option>
                      <option value="Chambre">Note de Chambre</option>
                    </select>
                  </div>
                </div>

                {paymentMethod === 'Chambre' && (
                  <div>
                    <label className="block text-[10px] font-bold text-primary/70 uppercase mb-1">
                      Sélectionner la Chambre Occupée
                    </label>
                    <select
                      value={selectedRoomId}
                      onChange={e => setSelectedRoomId(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-red-300 rounded-xl text-xs font-bold text-[#2B2321]"
                    >
                      <option value="">-- Choisir une chambre --</option>
                      {rooms.filter(r => r.status === 'Occupied').map(r => (
                        <option key={r.id} value={r.id}>
                          Chambre {r.number} ({r.currentGuestName || 'Occupée'})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <input
                    type="text"
                    value={saleNotes}
                    onChange={e => setSaleNotes(e.target.value)}
                    placeholder="Remarques / Préférence parfum..."
                    className="w-full px-3 py-1.5 bg-white border border-secondary/20 rounded-xl text-xs"
                  />
                </div>

                {/* Total & Action */}
                <div className="pt-2 border-t border-secondary/20 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-primary/60 font-bold">Total Chicha</p>
                    <p className="text-xl font-black text-red-600">{cartTotal.toLocaleString()} FCFA</p>
                  </div>

                  <button
                    onClick={handleCheckout}
                    disabled={cart.length === 0 || isProcessingSale}
                    className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg shadow-red-600/30 transition-all disabled:opacity-50 flex items-center gap-2"
                  >
                    {isProcessingSale ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Flame className="w-4 h-4 fill-white" />
                    )}
                    Encaisser Vente
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ----------------- SUBTAB 2: STOCK & PARFUMS CHICHA ----------------- */}
      {subTab === 'stock' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-secondary/20 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-[#2B2321]">Stock des Tabacs & Équipements Chicha</h2>
              <p className="text-xs text-primary/60">Gérez vos parfums, charbons et foyers en temps réel</p>
            </div>

            <button
              onClick={() => {
                setEditingProduct(null);
                setProductForm({ name: '', flavor: '', price: '', stock: '', category: 'Classic', alertStock: '5' });
                setIsAddingProduct(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs shadow-md transition-all"
            >
              <Plus className="w-4 h-4" />
              Ajouter un Parfum / Article
            </button>
          </div>

          {/* Modal Form */}
          {isAddingProduct && (
            <div className="bg-white p-6 rounded-3xl border-2 border-red-500 shadow-2xl relative">
              <button
                onClick={() => setIsAddingProduct(false)}
                className="absolute top-4 right-4 p-2 text-primary/50 hover:bg-secondary/10 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>

              <h3 className="text-lg font-bold text-[#2B2321] mb-4 flex items-center gap-2">
                <Flame className="w-5 h-5 text-red-600" />
                {editingProduct ? 'Modifier l\'article Chicha' : 'Nouveau Parfum / Article Chicha'}
              </h3>

              <form onSubmit={handleSaveProduct} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-primary mb-1">Nom du Produit *</label>
                  <input
                    type="text"
                    required
                    value={productForm.name}
                    onChange={e => setProductForm({ ...productForm, name: e.target.value })}
                    placeholder="Ex: Chicha Menthe Fraîche"
                    className="w-full px-3 py-2 border rounded-xl text-xs font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-primary mb-1">Détail Parfum / Marque</label>
                  <input
                    type="text"
                    value={productForm.flavor}
                    onChange={e => setProductForm({ ...productForm, flavor: e.target.value })}
                    placeholder="Ex: Al Fakher Menthe 250g"
                    className="w-full px-3 py-2 border rounded-xl text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-primary mb-1">Catégorie</label>
                  <select
                    value={productForm.category}
                    onChange={e => setProductForm({ ...productForm, category: e.target.value as any })}
                    className="w-full px-3 py-2 border rounded-xl text-xs font-semibold"
                  >
                    <option value="Classic">Classic (Standard)</option>
                    <option value="Special">Special (Mélange)</option>
                    <option value="VIP">VIP (Premium)</option>
                    <option value="Charcoal">Charbon</option>
                    <option value="Accessory">Accessoire / Tête</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-primary mb-1">Prix de Vente (FCFA) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={productForm.price}
                    onChange={e => setProductForm({ ...productForm, price: e.target.value })}
                    placeholder="5000"
                    className="w-full px-3 py-2 border rounded-xl text-xs font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-primary mb-1">Quantité en Stock</label>
                  <input
                    type="number"
                    min="0"
                    value={productForm.stock}
                    onChange={e => setProductForm({ ...productForm, stock: e.target.value })}
                    placeholder="20"
                    className="w-full px-3 py-2 border rounded-xl text-xs font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-primary mb-1">Seuil d'Alerte Stock Bas</label>
                  <input
                    type="number"
                    min="1"
                    value={productForm.alertStock}
                    onChange={e => setProductForm({ ...productForm, alertStock: e.target.value })}
                    placeholder="5"
                    className="w-full px-3 py-2 border rounded-xl text-xs"
                  />
                </div>

                <div className="sm:col-span-2 lg:col-span-3 flex justify-end gap-2 pt-3 border-t">
                  <button
                    type="button"
                    onClick={() => setIsAddingProduct(false)}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-[#2B2321] rounded-xl font-bold text-xs"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs shadow-md"
                  >
                    {editingProduct ? 'Mettre à jour' : 'Enregistrer'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Table of Products */}
          <div className="bg-white rounded-3xl border border-secondary/20 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#FDFBF7] border-b border-secondary/20 text-[10px] font-black uppercase tracking-wider text-primary">
                    <th className="p-4">Article & Parfum</th>
                    <th className="p-4">Catégorie</th>
                    <th className="p-4">Prix Unitaire</th>
                    <th className="p-4">Stock Restant</th>
                    <th className="p-4 text-center">Réapprovisionnement Rapide</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-secondary/10 text-xs">
                  {products.map(product => {
                    const isLow = product.stock <= (product.alertStock || 5);
                    return (
                      <tr key={product.id} className="hover:bg-[#FDFBF7]/50 transition-colors">
                        <td className="p-4 font-bold text-[#2B2321]">
                          <div>{product.name}</div>
                          {product.flavor && <div className="text-[10px] text-primary/60 font-normal italic">{product.flavor}</div>}
                        </td>
                        <td className="p-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-700 border border-red-100">
                            {product.category}
                          </span>
                        </td>
                        <td className="p-4 font-black text-red-600">
                          {product.price.toLocaleString()} FCFA
                        </td>
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-extrabold ${
                            product.stock === 0 ? 'bg-red-100 text-red-700' : isLow ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {product.stock} un.
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleQuickRestock(product, 5)}
                              className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded font-bold text-[10px] text-primary"
                            >
                              +5
                            </button>
                            <button
                              onClick={() => handleQuickRestock(product, 10)}
                              className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded font-bold text-[10px] text-primary"
                            >
                              +10
                            </button>
                            <button
                              onClick={() => handleQuickRestock(product, 25)}
                              className="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded font-bold text-[10px]"
                            >
                              +25
                            </button>
                          </div>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => {
                                setEditingProduct(product);
                                setProductForm({
                                  name: product.name,
                                  flavor: product.flavor || '',
                                  price: product.price.toString(),
                                  stock: product.stock.toString(),
                                  category: product.category,
                                  alertStock: (product.alertStock || 5).toString()
                                });
                                setIsAddingProduct(true);
                              }}
                              className="p-1.5 hover:bg-secondary/10 text-primary rounded-lg"
                              title="Modifier"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            {canManageStock && (
                              <button
                                onClick={() => handleDeleteProduct(product.id, product.name)}
                                className="p-1.5 hover:bg-red-50 text-red-600 rounded-lg"
                                title="Supprimer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ----------------- SUBTAB 3: HISTORIQUE DES VENTES CHICHA ----------------- */}
      {subTab === 'historique' && (
        <div className="space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-secondary/20 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-widest text-primary/60">Total Ventes Chicha (Aujourd'hui)</p>
              <p className="text-2xl font-black text-red-600 mt-1">{todayTotalRevenue.toLocaleString()} FCFA</p>
              <p className="text-[10px] text-primary/60 mt-1">{todaySales.length} commandes enregistrées</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-secondary/20 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-widest text-primary/60">Recettes Espèces</p>
              <p className="text-2xl font-black text-emerald-600 mt-1">{todayCashRevenue.toLocaleString()} FCFA</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-secondary/20 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-widest text-primary/60">Recettes Mobile Money</p>
              <p className="text-2xl font-black text-orange-600 mt-1">{todayMobileRevenue.toLocaleString()} FCFA</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-secondary/20 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-widest text-primary/60">Notes de Chambre</p>
              <p className="text-2xl font-black text-blue-600 mt-1">{todayRoomRevenue.toLocaleString()} FCFA</p>
            </div>
          </div>

          {/* Sales History List */}
          <div className="bg-white rounded-3xl border border-secondary/20 shadow-sm overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg text-[#2B2321]">Journal des Ventes Chicha</h2>
              <span className="text-xs font-bold text-red-600 bg-red-50 px-3 py-1 rounded-full">
                Ledger Autonome
              </span>
            </div>

            <div className="divide-y divide-secondary/10">
              {sales.length === 0 ? (
                <div className="py-12 text-center text-primary/40">
                  <History className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p className="text-xs font-bold">Aucune vente Chicha enregistrée pour le moment.</p>
                </div>
              ) : (
                sales.map(sale => (
                  <div key={sale.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#FDFBF7] transition-colors rounded-xl p-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-xs text-red-600">{sale.ticketId}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                          {sale.paymentMethod}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-50 text-red-700">
                          {sale.tableNumber || 'Chicha'}
                        </span>
                        {sale.roomNumber && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700">
                            Chambre {sale.roomNumber}
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-[#2B2321] font-semibold">
                        {sale.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}
                      </div>

                      <div className="text-[10px] text-primary/60 flex items-center gap-2">
                        <span>Par : {sale.sellerName} ({sale.sellerRole})</span>
                        <span>•</span>
                        <span>{sale.timestamp ? format(sale.timestamp.toDate(), 'dd/MM/yyyy HH:mm', { locale: fr }) : '-'}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 justify-between sm:justify-end">
                      <span className="text-base font-black text-[#2B2321]">
                        {sale.totalAmount.toLocaleString()} FCFA
                      </span>

                      <button
                        onClick={() => setPrintedReceipt(sale)}
                        className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl font-bold text-xs flex items-center gap-1 transition-all"
                      >
                        <Printer className="w-4 h-4" />
                        Reçu
                      </button>

                      {isManagerOrAdmin && (
                        <button
                          onClick={() => handleDeleteSale(sale.id, sale.ticketId)}
                          className="p-2 hover:bg-red-50 text-red-600 rounded-xl transition-all"
                          title="Annuler / Supprimer la vente"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ----------------- SUBTAB 4: CLÔTURE CAISSE CHICHA ----------------- */}
      {subTab === 'cloture' && (
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-secondary/20 shadow-xl space-y-6">
            <div className="border-b border-secondary/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-100 rounded-2xl flex items-center justify-center text-red-600 font-bold">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-[#2B2321]">Clôture de Caisse Chicha du Jour</h2>
                  <p className="text-xs text-primary/60">Générez un rapport de fin de service exclusivement pour la Chicha</p>
                </div>
              </div>
            </div>

            {/* Daily Totals Box */}
            <div className="bg-[#FDFBF7] p-5 rounded-2xl border border-secondary/20 space-y-3">
              <p className="text-xs font-bold uppercase tracking-widest text-primary/70">Résumé Théorique (Aujourd'hui)</p>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-white p-3 rounded-xl border border-secondary/10">
                  <span className="text-primary/60">Total Ventes Chicha :</span>
                  <p className="font-black text-sm text-[#2B2321]">{todayTotalRevenue.toLocaleString()} FCFA</p>
                </div>

                <div className="bg-white p-3 rounded-xl border border-secondary/10">
                  <span className="text-primary/60">Espèces Attendu :</span>
                  <p className="font-black text-sm text-emerald-600">{todayCashRevenue.toLocaleString()} FCFA</p>
                </div>

                <div className="bg-white p-3 rounded-xl border border-secondary/10">
                  <span className="text-primary/60">Mobile Money :</span>
                  <p className="font-black text-sm text-orange-600">{todayMobileRevenue.toLocaleString()} FCFA</p>
                </div>

                <div className="bg-white p-3 rounded-xl border border-secondary/10">
                  <span className="text-primary/60">Notes de Chambre :</span>
                  <p className="font-black text-sm text-blue-600">{todayRoomRevenue.toLocaleString()} FCFA</p>
                </div>
              </div>
            </div>

            {/* Input Form */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-primary mb-1">
                  Montant Espèces Compté Physiquement (FCFA)
                </label>
                <input
                  type="number"
                  min="0"
                  value={physicalCashCount}
                  onChange={e => setPhysicalCashCount(e.target.value)}
                  placeholder={todayCashRevenue.toString()}
                  className="w-full px-4 py-2.5 border rounded-2xl font-bold text-sm text-[#2B2321] focus:outline-none focus:border-red-500"
                />
              </div>

              {physicalCashCount !== '' && (
                <div className={`p-4 rounded-2xl border text-xs font-bold ${
                  Number(physicalCashCount) - todayCashRevenue === 0 
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                    : 'bg-red-50 text-red-800 border-red-200'
                }`}>
                  Écart de Caisse Chicha : {(Number(physicalCashCount) - todayCashRevenue).toLocaleString()} FCFA
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-primary mb-1">
                  Observations / Remarques
                </label>
                <textarea
                  rows={3}
                  value={closureNotes}
                  onChange={e => setClosureNotes(e.target.value)}
                  placeholder="Notez d'éventuels remplacements de charbon, têtes cassées..."
                  className="w-full px-4 py-2 border rounded-2xl text-xs focus:outline-none focus:border-red-500"
                />
              </div>

              <button
                onClick={() => {
                  toast.success("Rapport de Clôture Chicha imprimé !");
                  window.print();
                }}
                className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg shadow-red-600/30 flex items-center justify-center gap-2"
              >
                <Printer className="w-4 h-4" />
                Imprimer le Rapport de Clôture Chicha
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ----------------- THERMAL RECEIPT MODAL ----------------- */}
      {printedReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl relative border-2 border-red-500">
            <button
              onClick={() => setPrintedReceipt(null)}
              className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full text-gray-500"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Printable Receipt Area */}
            <div id="printable-shisha-receipt" className="text-center space-y-3 font-mono text-xs text-black p-2 border border-dashed border-gray-300 rounded-xl bg-amber-50/20">
              <div className="flex items-center justify-center gap-1">
                <Flame className="w-5 h-5 text-red-600 fill-red-600" />
                <h2 className="font-bold text-sm tracking-wider uppercase">{settings?.hotelName || 'RÉSIDENCE HQ'}</h2>
              </div>
              <p className="text-[10px] uppercase tracking-widest font-bold text-red-600">--- REÇU ESPACE CHICHA ---</p>
              <p className="text-[9px]">Caisse Autonome & Déconnectée</p>

              <div className="text-left text-[10px] space-y-0.5 border-t border-b border-dashed border-gray-300 py-2 my-2">
                <div>Ticket N° : <strong>{printedReceipt.ticketId}</strong></div>
                <div>Date : {printedReceipt.timestamp ? format(printedReceipt.timestamp.toDate(), 'dd/MM/yyyy HH:mm', { locale: fr }) : '-'}</div>
                <div>Emplacement : {printedReceipt.tableNumber || 'Terrasse'}</div>
                <div>Serveur/Vendeur : {printedReceipt.sellerName}</div>
                <div>Paiement : <strong>{printedReceipt.paymentMethod}</strong></div>
              </div>

              {/* Items */}
              <div className="text-left space-y-1 my-2">
                <div className="flex justify-between font-bold border-b pb-1 text-[10px]">
                  <span>Article</span>
                  <span>Qté x Prix</span>
                  <span>Total</span>
                </div>
                {printedReceipt.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-[10px]">
                    <span className="truncate pr-1">{item.name}</span>
                    <span>{item.quantity}x {item.price}</span>
                    <span className="font-bold">{(item.quantity * item.price).toLocaleString()}</span>
                  </div>
                ))}
              </div>

              {/* Total */}
              <div className="border-t border-dashed border-gray-300 pt-2 flex justify-between font-bold text-sm">
                <span>TOTAL :</span>
                <span className="text-red-600">{printedReceipt.totalAmount.toLocaleString()} FCFA</span>
              </div>

              <div className="text-[9px] pt-3 text-gray-500">
                Merci de votre visite à l'Espace Chicha !
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={triggerPrintReceipt}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-md"
              >
                <Printer className="w-4 h-4" />
                Imprimer Reçu
              </button>
              <button
                onClick={() => setPrintedReceipt(null)}
                className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-xs"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={!!chichaProductToDelete}
        title="Supprimer l'article Chicha"
        message={`Voulez-vous vraiment supprimer "${chichaProductToDelete?.name}" de la carte Chicha ?`}
        confirmLabel="Supprimer"
        onConfirm={() => chichaProductToDelete && executeDeleteProduct(chichaProductToDelete.id, chichaProductToDelete.name)}
        onClose={() => setChichaProductToDelete(null)}
      />

      <ConfirmModal
        isOpen={!!chichaSaleToDelete}
        title="Annuler la vente Chicha"
        message={`Voulez-vous vraiment annuler la vente Chicha N° ${chichaSaleToDelete?.ticketId} ? Cette action restaurera également le stock.`}
        confirmLabel="Annuler la vente"
        onConfirm={() => chichaSaleToDelete && executeDeleteSale(chichaSaleToDelete.saleId, chichaSaleToDelete.ticketId)}
        onClose={() => setChichaSaleToDelete(null)}
      />
    </div>
  );
};
export default ChichaModule;
