import React, { useState, useEffect } from 'react';
import { WarehouseProduct, WarehouseMovement, UserProfile, AppSettings, Product } from '../types';
import { 
  Warehouse, 
  PackagePlus, 
  ArrowRightLeft, 
  History, 
  Plus, 
  Search, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown, 
  FileText, 
  CheckCircle2, 
  Trash2, 
  Edit3, 
  X, 
  Loader2, 
  Download,
  Building2,
  DollarSign,
  Boxes,
  Printer
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, Timestamp, writeBatch, getDocs, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { parseDate, handleFirestoreError, OperationType, logEvent, cn } from '../lib/utils';
import { generatePDF } from '../lib/pdfUtils';
import { ConfirmModal } from './ConfirmModal';

interface MagasinModuleProps {
  user: UserProfile | null;
  settings?: AppSettings | null;
  products?: Product[];
}

export const MagasinModule = ({ user, settings, products = [] }: MagasinModuleProps) => {
  const isManagerOrAdmin = user?.role === 'admin' || user?.role === 'manager' || user?.email?.toLowerCase() === 'cyber.kan587@gmail.com';

  const [activeTab, setActiveTab] = useState<'stock' | 'entries' | 'transfers' | 'history'>('stock');
  const [warehouseProducts, setWarehouseProducts] = useState<WarehouseProduct[]>([]);
  const [movements, setMovements] = useState<WarehouseMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('Tous');

  const [productToDelete, setProductToDelete] = useState<{ id: string; name: string } | null>(null);

  // Modal states
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState<WarehouseProduct | null>(null);
  const [productForm, setProductForm] = useState({
    name: '',
    category: 'Boissons',
    unit: 'Carton',
    stock: '',
    minStock: '5',
    buyPrice: '',
    sellPrice: ''
  });

  // Entry / Purchase Modal
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const [entryForm, setEntryForm] = useState({
    productId: '',
    quantity: '',
    supplierName: '',
    invoiceNumber: '',
    notes: ''
  });

  // Transfer / Dispatch Modal
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferForm, setTransferForm] = useState({
    productId: '',
    quantity: '',
    destinationLocation: 'Terrasse',
    notes: ''
  });

  useEffect(() => {
    // 1. Subscribe to warehouse products
    const unsubProducts = onSnapshot(collection(db, 'warehouse_products'), (snapshot) => {
      const prods = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as WarehouseProduct));
      setWarehouseProducts(prods);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching warehouse products:', error);
      handleFirestoreError(error, OperationType.LIST, 'warehouse_products');
      setLoading(false);
    });

    // 2. Subscribe to warehouse movements
    const qMov = query(collection(db, 'warehouse_movements'), orderBy('timestamp', 'desc'));
    const unsubMov = onSnapshot(qMov, (snapshot) => {
      const movs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as WarehouseMovement));
      setMovements(movs);
    }, (error) => {
      console.error('Error fetching warehouse movements:', error);
    });

    return () => {
      unsubProducts();
      unsubMov();
    };
  }, []);

  // Handle Save Product (Add or Edit)
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productForm.name.trim()) {
      toast.error("Le nom du produit est requis.");
      return;
    }

    try {
      const payload = {
        name: productForm.name.trim(),
        category: productForm.category,
        unit: productForm.unit,
        stock: Number(productForm.stock || 0),
        minStock: Number(productForm.minStock || 5),
        buyPrice: Number(productForm.buyPrice || 0),
        sellPrice: Number(productForm.sellPrice || 0)
      };

      if (editingProduct) {
        await updateDoc(doc(db, 'warehouse_products', editingProduct.id), payload);
        if (payload.stock <= 10) {
          await addDoc(collection(db, 'notifications'), {
            type: 'alert',
            source: 'warehouse',
            message: `📦 Alerte Magasin Central : Le stock de réserve de "${payload.name}" a atteint ${payload.stock} ${payload.unit}(s).`,
            timestamp: serverTimestamp(),
            readBy: [],
            targetRole: 'admin'
          });
        }
        toast.success("Produit mis à jour dans le Magasin Central !");
        logEvent(user, 'Magasin', `Mise à jour produit magasin: ${payload.name}`);
      } else {
        const docRef = await addDoc(collection(db, 'warehouse_products'), payload);
        if (payload.stock <= 10) {
          await addDoc(collection(db, 'notifications'), {
            type: 'alert',
            source: 'warehouse',
            message: `📦 Alerte Magasin Central : Le stock de réserve de "${payload.name}" a atteint ${payload.stock} ${payload.unit}(s).`,
            timestamp: serverTimestamp(),
            readBy: [],
            targetRole: 'admin'
          });
        }
        
        // Also record initial entry movement if stock > 0
        if (payload.stock > 0) {
          await addDoc(collection(db, 'warehouse_movements'), {
            productId: docRef.id,
            productName: payload.name,
            type: 'IN',
            quantity: payload.stock,
            supplierName: 'Stock Initial / Inventaire',
            timestamp: Timestamp.now(),
            userId: user?.id || 'system',
            userName: user?.username || 'Système',
            notes: 'Stock initial à la création du produit'
          });
        }

        toast.success("Nouveau produit ajouté au Magasin Central !");
        logEvent(user, 'Magasin', `Création produit magasin: ${payload.name}`);
      }

      setIsAddingProduct(false);
      setEditingProduct(null);
      setProductForm({ name: '', category: 'Boissons', unit: 'Carton', stock: '', minStock: '5', buyPrice: '', sellPrice: '' });
    } catch (error) {
      console.error("Error saving warehouse product:", error);
      toast.error("Erreur lors de l'enregistrement du produit.");
    }
  };

  // Handle Delete Product
  const handleDeleteProduct = (productId: string, productName: string) => {
    console.log("[MagasinModule] handleDeleteProduct initiated for:", productId, "User role:", user?.role, "IsManagerOrAdmin:", isManagerOrAdmin);
    
    if (!isManagerOrAdmin) {
      console.warn("[MagasinModule] Permission denied (Client-side check)");
      toast.error("Permissions insuffisantes.");
      return;
    }

    setProductToDelete({ id: productId, name: productName });
  };

  const executeDeleteProduct = async (productId: string, productName: string) => {
    try {
      console.log("[MagasinModule] Attempting to delete product from warehouse_products:", productId);
      await deleteDoc(doc(db, 'warehouse_products', productId));
      console.log("[MagasinModule] Product deleted successfully");
      toast.success("Produit supprimé du magasin.");
      logEvent(user, 'Magasin', `Suppression produit magasin: ${productName}`);
    } catch (error: any) {
      console.error("[MagasinModule] Error deleting warehouse product:", error);
      handleFirestoreError(error, OperationType.DELETE, 'warehouse_products');
    }
  };

  // Handle Entry / Purchase from Supplier
  const handleRecordEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = Number(entryForm.quantity);
    if (!entryForm.productId || isNaN(qty) || qty <= 0) {
      toast.error("Veuillez sélectionner un produit et entrer une quantité valide.");
      return;
    }

    const prod = warehouseProducts.find(p => p.id === entryForm.productId);
    if (!prod) return;

    try {
      // 1. Update product stock in warehouse
      const newStock = prod.stock + qty;
      await updateDoc(doc(db, 'warehouse_products', prod.id), {
        stock: newStock
      });

      // 2. Record movement
      await addDoc(collection(db, 'warehouse_movements'), {
        productId: prod.id,
        productName: prod.name,
        type: 'IN',
        quantity: qty,
        supplierName: entryForm.supplierName.trim() || 'Fournisseur Général',
        invoiceNumber: entryForm.invoiceNumber.trim() || undefined,
        timestamp: Timestamp.now(),
        userId: user?.id || 'system',
        userName: user?.username || 'Utilisateur',
        notes: entryForm.notes.trim() || undefined
      });

      toast.success(`Entrée de ${qty} ${prod.unit}(s) de "${prod.name}" enregistrée !`);
      logEvent(user, 'Magasin', `Entrée stock magasin: +${qty} ${prod.name} (${entryForm.supplierName || 'Fournisseur'})`);
      
      setIsEntryModalOpen(false);
      setEntryForm({ productId: '', quantity: '', supplierName: '', invoiceNumber: '', notes: '' });
    } catch (error) {
      console.error("Error recording entry:", error);
      toast.error("Erreur lors de l'enregistrement de l'entrée.");
    }
  };

  // Handle Transfer / Dispatch to POS Location
  const handleRecordTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = Number(transferForm.quantity);
    if (!transferForm.productId || isNaN(qty) || qty <= 0) {
      toast.error("Veuillez sélectionner un produit et une quantité valide.");
      return;
    }

    const prod = warehouseProducts.find(p => p.id === transferForm.productId);
    if (!prod) return;

    if (prod.stock < qty) {
      toast.error(`Stock insuffisant dans le Magasin Central ! Stock actuel : ${prod.stock} ${prod.unit}(s)`);
      return;
    }

    try {
      // 1. Decrement warehouse stock
      const newWarehouseStock = prod.stock - qty;
      await updateDoc(doc(db, 'warehouse_products', prod.id), {
        stock: newWarehouseStock
      });

      if (newWarehouseStock <= 10) {
        await addDoc(collection(db, 'notifications'), {
          type: 'alert',
          source: 'warehouse',
          message: `📦 Alerte Magasin Central : Le stock de réserve de "${prod.name}" a atteint ${newWarehouseStock} ${prod.unit}(s).`,
          timestamp: serverTimestamp(),
          readBy: [],
          targetRole: 'admin'
        });
      }

      // 2. Try to also match and update corresponding POS product in `products` collection if it exists
      const matchingProduct = products.find(p => p.name.toLowerCase() === prod.name.toLowerCase());
      if (matchingProduct) {
        const targetLocation = transferForm.destinationLocation;
        const currentPosStock = matchingProduct.stock || 0;
        let updateField: any = {};
        
        if (targetLocation === 'Terrasse') {
          const prevTerrasse = matchingProduct.stockTerrasse ?? currentPosStock;
          updateField = { stockTerrasse: prevTerrasse + qty, stock: (matchingProduct.stock || 0) + qty };
        } else if (targetLocation === 'Réception') {
          const prevReception = matchingProduct.stockReception ?? 0;
          updateField = { stockReception: prevReception + qty, stock: (matchingProduct.stock || 0) + qty };
        } else if (targetLocation === 'VIP') {
          const prevVip = matchingProduct.stockVip ?? 0;
          updateField = { stockVip: prevVip + qty, stock: (matchingProduct.stock || 0) + qty };
        } else {
          updateField = { stock: currentPosStock + qty };
        }

        await updateDoc(doc(db, 'products', matchingProduct.id), updateField);
      }

      // 3. Record movement (OUT)
      await addDoc(collection(db, 'warehouse_movements'), {
        productId: prod.id,
        productName: prod.name,
        type: 'OUT',
        quantity: qty,
        destinationLocation: transferForm.destinationLocation,
        timestamp: Timestamp.now(),
        userId: user?.id || 'system',
        userName: user?.username || 'Utilisateur',
        notes: transferForm.notes.trim() || undefined
      });

      toast.success(`Transfert de ${qty} ${prod.unit}(s) vers ${transferForm.destinationLocation} effectué !`);
      logEvent(user, 'Magasin', `Sortie stock magasin: -${qty} ${prod.name} vers ${transferForm.destinationLocation}`);

      setIsTransferModalOpen(false);
      setTransferForm({ productId: '', quantity: '', destinationLocation: 'Terrasse', notes: '' });
    } catch (error) {
      console.error("Error recording transfer:", error);
      toast.error("Erreur lors du transfert de stock.");
    }
  };

  // Filter products
  const filteredProducts = warehouseProducts.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'Tous' || p.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const categories = ['Tous', ...Array.from(new Set(warehouseProducts.map(p => p.category)))];

  // Stats calculations
  const totalItemsCount = warehouseProducts.reduce((sum, p) => sum + p.stock, 0);
  const totalValuationBuy = warehouseProducts.reduce((sum, p) => sum + (p.stock * p.buyPrice), 0);
  const totalValuationSell = warehouseProducts.reduce((sum, p) => sum + (p.stock * p.sellPrice), 0);
  const lowStockProducts = warehouseProducts.filter(p => p.stock <= p.minStock);

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner - Yellow Theme */}
      <div className="bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 opacity-10 pointer-events-none">
          <Warehouse className="w-64 h-64 text-white" />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-black uppercase tracking-widest text-white mb-3 shadow-sm border border-white/30">
              <Warehouse className="w-3.5 h-3.5" /> Module Magasin Central
            </div>
            <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white uppercase drop-shadow-sm">
              Magasin & Approvisionnement
            </h1>
            <p className="text-white/90 text-sm mt-1 max-w-xl font-medium">
              Gestion centrale des stocks de réserve, enregistrement des achats fournisseurs et traçabilité des mouvements d'approvisionnement vers les points de vente.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setIsEntryModalOpen(true)}
              className="flex items-center gap-2 px-5 py-3 bg-white text-amber-900 rounded-2xl font-black text-xs uppercase tracking-wider hover:bg-yellow-50 transition-all shadow-lg active:scale-95"
            >
              <PackagePlus className="w-4 h-4 text-amber-700" /> + Entrée Achat
            </button>
            <button
              onClick={() => setIsTransferModalOpen(true)}
              className="flex items-center gap-2 px-5 py-3 bg-amber-900 text-white rounded-2xl font-black text-xs uppercase tracking-wider hover:bg-amber-950 transition-all shadow-lg active:scale-95 border border-white/20"
            >
              <ArrowRightLeft className="w-4 h-4 text-yellow-300" /> Sortie / Transfert POS
            </button>
            {isManagerOrAdmin && (
              <button
                onClick={() => {
                  setEditingProduct(null);
                  setProductForm({ name: '', category: 'Boissons', unit: 'Carton', stock: '', minStock: '5', buyPrice: '', sellPrice: '' });
                  setIsAddingProduct(true);
                }}
                className="flex items-center gap-2 px-5 py-3 bg-yellow-400 text-amber-950 rounded-2xl font-black text-xs uppercase tracking-wider hover:bg-yellow-300 transition-all shadow-lg active:scale-95"
              >
                <Plus className="w-4 h-4" /> Nouvel Article
              </button>
            )}
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 pt-6 border-t border-white/20">
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20">
            <div className="text-white/80 text-[10px] font-bold uppercase tracking-wider">Références Articles</div>
            <div className="text-2xl font-black text-white mt-1">{warehouseProducts.length}</div>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20">
            <div className="text-white/80 text-[10px] font-bold uppercase tracking-wider">Unités en Réserve</div>
            <div className="text-2xl font-black text-white mt-1">{totalItemsCount}</div>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20">
            <div className="text-white/80 text-[10px] font-bold uppercase tracking-wider">Valeur d'Achat Estimée</div>
            <div className="text-2xl font-black text-white mt-1">{totalValuationBuy.toLocaleString()} <span className="text-xs">FCFA</span></div>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20">
            <div className="text-white/80 text-[10px] font-bold uppercase tracking-wider">Alertes Stock Bas</div>
            <div className="text-2xl font-black text-yellow-200 mt-1 flex items-center gap-1.5">
              {lowStockProducts.length} {lowStockProducts.length > 0 && <AlertTriangle className="w-5 h-5 text-yellow-300 animate-pulse" />}
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex overflow-x-auto gap-2 p-1.5 bg-amber-500/10 border border-amber-200/50 rounded-2xl">
        <button
          onClick={() => setActiveTab('stock')}
          className={cn(
            "flex items-center gap-2 px-5 py-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all whitespace-nowrap",
            activeTab === 'stock'
              ? "bg-amber-500 text-white shadow-md shadow-amber-500/20"
              : "text-amber-900/70 hover:bg-amber-500/20 hover:text-amber-900"
          )}
        >
          <Boxes className="w-4 h-4" /> Stock Réserve Central ({warehouseProducts.length})
        </button>
        <button
          onClick={() => setActiveTab('entries')}
          className={cn(
            "flex items-center gap-2 px-5 py-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all whitespace-nowrap",
            activeTab === 'entries'
              ? "bg-amber-500 text-white shadow-md shadow-amber-500/20"
              : "text-amber-900/70 hover:bg-amber-500/20 hover:text-amber-900"
          )}
        >
          <PackagePlus className="w-4 h-4" /> Entrées / Achats
        </button>
        <button
          onClick={() => setActiveTab('transfers')}
          className={cn(
            "flex items-center gap-2 px-5 py-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all whitespace-nowrap",
            activeTab === 'transfers'
              ? "bg-amber-500 text-white shadow-md shadow-amber-500/20"
              : "text-amber-900/70 hover:bg-amber-500/20 hover:text-amber-900"
          )}
        >
          <ArrowRightLeft className="w-4 h-4" /> Transferts POS
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={cn(
            "flex items-center gap-2 px-5 py-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all whitespace-nowrap",
            activeTab === 'history'
              ? "bg-amber-500 text-white shadow-md shadow-amber-500/20"
              : "text-amber-900/70 hover:bg-amber-500/20 hover:text-amber-900"
          )}
        >
          <History className="w-4 h-4" /> Journal des Mouvements ({movements.length})
        </button>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="w-10 h-10 animate-spin text-amber-500" />
        </div>
      ) : activeTab === 'stock' ? (
        <div className="space-y-4">
          {/* Search and Filters */}
          <div className="flex flex-col gap-4 bg-white p-4 rounded-2xl border border-amber-200 shadow-sm">
            <div className="flex flex-col sm:flex-row gap-3 justify-between items-center">
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500" />
                <input
                  type="text"
                  placeholder="Rechercher un article en magasin..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-yellow-50/50 border border-amber-200 rounded-xl text-xs font-bold text-[#2B2321] placeholder-amber-900/40 focus:outline-none focus:border-amber-500 transition-all"
                />
              </div>

              <div className="flex gap-2">
                {isManagerOrAdmin && (
                  <button
                    onClick={() => {
                      generatePDF({
                        title: 'État du Stock Magasin Central',
                        filename: `stock_magasin_${format(new Date(), 'yyyyMMdd')}.pdf`,
                        columns: ['Réf', 'Article', 'Catégorie', 'Unité', 'Quantité', 'Seuil', 'Statut'],
                        rows: filteredProducts.map(p => [
                          p.reference || 'N/A',
                          p.name,
                          p.category,
                          p.unit,
                          p.quantity.toString(),
                          p.minQuantity.toString(),
                          p.quantity <= p.minQuantity ? 'CRITIQUE' : 'OK'
                        ]),
                        settings
                      });
                      toast.success("État du stock PDF généré !");
                    }}
                    className="flex items-center gap-2 px-4 py-2.5 bg-red-100 text-red-700 rounded-xl font-black text-xs uppercase tracking-wider hover:bg-red-200 transition-all border border-red-300 shadow-sm whitespace-nowrap"
                  >
                    <Printer className="w-4 h-4" /> Exporter Stock PDF
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 w-full overflow-x-auto pb-1 sm:pb-0">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={cn(
                    "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all",
                    categoryFilter === cat
                      ? "bg-amber-500 text-white shadow-sm"
                      : "bg-yellow-50 text-amber-900/70 border border-amber-200 hover:bg-amber-100"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Low Stock Warning Banner */}
          {lowStockProducts.length > 0 && (
            <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center text-white font-black shadow-md">
                  <AlertTriangle className="w-5 h-5 animate-bounce" />
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-amber-900">Alerte Rupture Stock Réserve</h4>
                  <p className="text-[11px] font-medium text-amber-800/80">
                    {lowStockProducts.length} article(s) ont atteint ou sont en dessous de leur seuil d'alerte minimal. Pensez à réapprovisionner auprès des fournisseurs.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Products Table */}
          <div className="bg-white rounded-3xl border border-amber-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-yellow-50/85 border-b border-amber-200 text-[10px] font-black uppercase tracking-widest text-amber-900">
                    <th className="p-4">Article</th>
                    <th className="p-4">Catégorie</th>
                    <th className="p-4">Unité</th>
                    <th className="p-4 text-center">Stock Réserve</th>
                    <th className="p-4 text-right">Prix Achat (Unitaire)</th>
                    <th className="p-4 text-right">Prix Vente (POS)</th>
                    <th className="p-4 text-center">Statut</th>
                    {isManagerOrAdmin && <th className="p-4 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-100 text-xs font-medium text-[#2B2321]">
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-amber-900/50 font-bold uppercase tracking-wider text-xs">
                        Aucun article trouvé dans le Magasin Central.
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map(prod => {
                      const isLow = prod.stock <= prod.minStock;
                      return (
                        <tr key={prod.id} className="hover:bg-yellow-50/40 transition-colors">
                          <td className="p-4 font-black text-amber-950 uppercase">{prod.name}</td>
                          <td className="p-4">
                            <span className="px-2.5 py-1 rounded-lg bg-amber-100/70 text-amber-900 font-bold text-[10px] uppercase">
                              {prod.category}
                            </span>
                          </td>
                          <td className="p-4 text-amber-900/70 font-semibold">{prod.unit}</td>
                          <td className="p-4 text-center">
                            <span className={cn(
                              "inline-flex items-center justify-center px-3 py-1 rounded-xl font-black text-xs",
                              isLow ? "bg-red-100 text-red-700 border border-red-200 animate-pulse" : "bg-amber-100 text-amber-900 border border-amber-300"
                            )}>
                              {prod.stock} {prod.unit}s
                            </span>
                          </td>
                          <td className="p-4 text-right font-bold text-amber-900">{prod.buyPrice?.toLocaleString()} FCFA</td>
                          <td className="p-4 text-right font-bold text-emerald-700">{prod.sellPrice?.toLocaleString()} FCFA</td>
                          <td className="p-4 text-center">
                            {isLow ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-red-600 bg-red-50 px-2.5 py-1 rounded-full border border-red-200">
                                <AlertTriangle className="w-3 h-3" /> Stock Bas
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3" /> Normal
                              </span>
                            )}
                          </td>
                          {isManagerOrAdmin && (
                            <td className="p-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => {
                                    setEditingProduct(prod);
                                    setProductForm({
                                      name: prod.name,
                                      category: prod.category,
                                      unit: prod.unit,
                                      stock: String(prod.stock),
                                      minStock: String(prod.minStock),
                                      buyPrice: String(prod.buyPrice || ''),
                                      sellPrice: String(prod.sellPrice || '')
                                    });
                                    setIsAddingProduct(true);
                                  }}
                                  className="p-2 bg-amber-100 text-amber-900 rounded-xl hover:bg-amber-200 transition-colors"
                                  title="Modifier"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteProduct(prod.id, prod.name)}
                                  className="p-2 bg-red-100 text-red-700 rounded-xl hover:bg-red-200 transition-colors"
                                  title="Supprimer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : activeTab === 'entries' ? (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-amber-200 shadow-sm">
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-amber-900">Entrées & Achats Fournisseurs</h3>
              <p className="text-xs text-amber-900/60 font-medium">Historique des réceptions de marchandises et ravitaillements du Magasin Central.</p>
            </div>
            <div className="flex gap-2">
              {isManagerOrAdmin && (
                <button
                  onClick={() => {
                    generatePDF({
                      title: 'Entrées & Achats Fournisseurs',
                      filename: `achats_fournisseurs_${format(new Date(), 'yyyyMMdd')}.pdf`,
                      columns: ['Date', 'Article', 'Quantité', 'Fournisseur', 'N° Facture', 'Coût Total'],
                      rows: movements.filter(m => m.type === 'IN').map(m => [
                        m.timestamp ? format(parseDate(m.timestamp), 'dd/MM/yyyy HH:mm') : '',
                        m.productName,
                        `+${m.quantity}`,
                        m.supplierName || 'N/A',
                        m.invoiceNumber || 'N/A',
                        m.totalCost ? `${m.totalCost} FCFA` : 'N/A'
                      ]),
                      settings
                    });
                    toast.success("Rapport Entrées PDF généré !");
                  }}
                  className="flex items-center gap-2 px-4 py-2.5 bg-red-100 text-red-700 rounded-xl font-black text-xs uppercase tracking-wider hover:bg-red-200 transition-all border border-red-300 shadow-sm"
                >
                  <Printer className="w-4 h-4" /> Exporter PDF
                </button>
              )}
              <button
                onClick={() => setIsEntryModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 text-white rounded-xl font-black text-xs uppercase tracking-wider hover:bg-amber-600 transition-all shadow-md"
              >
                <PackagePlus className="w-4 h-4" /> Enregistrer une Entrée
              </button>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-amber-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-yellow-50/85 border-b border-amber-200 text-[10px] font-black uppercase tracking-widest text-amber-900">
                    <th className="p-4">Date & Heure</th>
                    <th className="p-4">Article</th>
                    <th className="p-4 text-center">Quantité Entrée</th>
                    <th className="p-4">Fournisseur</th>
                    <th className="p-4">N° Facture</th>
                    <th className="p-4">Enregistré par</th>
                    <th className="p-4">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-100 text-xs font-medium text-[#2B2321]">
                  {movements.filter(m => m.type === 'IN').length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-amber-900/50 font-bold uppercase tracking-wider text-xs">
                        Aucune entrée enregistrée pour le moment.
                      </td>
                    </tr>
                  ) : (
                    movements.filter(m => m.type === 'IN').map(mov => (
                      <tr key={mov.id} className="hover:bg-yellow-50/40 transition-colors">
                        <td className="p-4 font-bold text-amber-950">
                          {mov.timestamp ? format(parseDate(mov.timestamp), 'dd/MM/yyyy HH:mm', { locale: fr }) : '—'}
                        </td>
                        <td className="p-4 font-black text-amber-900 uppercase">{mov.productName}</td>
                        <td className="p-4 text-center">
                          <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-xl font-black text-xs">
                            +{mov.quantity}
                          </span>
                        </td>
                        <td className="p-4 font-bold text-[#2B2321]">{mov.supplierName || 'Fournisseur Général'}</td>
                        <td className="p-4 font-mono text-amber-900">{mov.invoiceNumber || '—'}</td>
                        <td className="p-4 text-amber-900/70 font-semibold">{mov.userName}</td>
                        <td className="p-4 text-amber-900/60 italic">{mov.notes || '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : activeTab === 'transfers' ? (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-amber-200 shadow-sm">
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-amber-900">Sorties & Transferts vers les Points de Vente</h3>
              <p className="text-xs text-amber-900/60 font-medium">Réquisitions et affectations de stock depuis le Magasin Central vers la Terrasse, le Bar VIP, la Réception, le Restaurant, etc.</p>
            </div>
            <div className="flex gap-2">
              {isManagerOrAdmin && (
                <button
                  onClick={() => {
                    generatePDF({
                      title: 'Sorties & Transferts vers les Points de Vente',
                      filename: `transferts_pos_${format(new Date(), 'yyyyMMdd')}.pdf`,
                      columns: ['Date', 'Article', 'Quantité', 'Point de Vente Destination', 'Effectué par'],
                      rows: movements.filter(m => m.type === 'OUT').map(m => [
                        m.timestamp ? format(parseDate(m.timestamp), 'dd/MM/yyyy HH:mm') : '',
                        m.productName,
                        `-${m.quantity}`,
                        m.destinationLocation || 'Point de Vente',
                        m.userName
                      ]),
                      settings
                    });
                    toast.success("Rapport Transferts PDF généré !");
                  }}
                  className="flex items-center gap-2 px-4 py-2.5 bg-red-100 text-red-700 rounded-xl font-black text-xs uppercase tracking-wider hover:bg-red-200 transition-all border border-red-300 shadow-sm"
                >
                  <Printer className="w-4 h-4" /> Exporter PDF
                </button>
              )}
              <button
                onClick={() => setIsTransferModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-amber-900 text-white rounded-xl font-black text-xs uppercase tracking-wider hover:bg-amber-950 transition-all shadow-md"
              >
                <ArrowRightLeft className="w-4 h-4 text-yellow-300" /> Transférer vers POS
              </button>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-amber-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-yellow-50/85 border-b border-amber-200 text-[10px] font-black uppercase tracking-widest text-amber-900">
                    <th className="p-4">Date & Heure</th>
                    <th className="p-4">Article</th>
                    <th className="p-4 text-center">Quantité Sortie</th>
                    <th className="p-4">Point de Vente Destination</th>
                    <th className="p-4">Effectué par</th>
                    <th className="p-4">Notes / Motif</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-100 text-xs font-medium text-[#2B2321]">
                  {movements.filter(m => m.type === 'OUT').length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-amber-900/50 font-bold uppercase tracking-wider text-xs">
                        Aucun transfert vers un point de vente enregistré.
                      </td>
                    </tr>
                  ) : (
                    movements.filter(m => m.type === 'OUT').map(mov => (
                      <tr key={mov.id} className="hover:bg-yellow-50/40 transition-colors">
                        <td className="p-4 font-bold text-amber-950">
                          {mov.timestamp ? format(parseDate(mov.timestamp), 'dd/MM/yyyy HH:mm', { locale: fr }) : '—'}
                        </td>
                        <td className="p-4 font-black text-amber-900 uppercase">{mov.productName}</td>
                        <td className="p-4 text-center">
                          <span className="px-3 py-1 bg-amber-100 text-amber-900 rounded-xl font-black text-xs">
                            -{mov.quantity}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className="px-3 py-1 rounded-lg bg-yellow-100 text-amber-900 font-extrabold text-[10px] uppercase border border-amber-300">
                            {mov.destinationLocation || 'Point de Vente'}
                          </span>
                        </td>
                        <td className="p-4 text-amber-900/70 font-semibold">{mov.userName}</td>
                        <td className="p-4 text-amber-900/60 italic">{mov.notes || '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-amber-200 shadow-sm">
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-amber-900">Journal Complet des Mouvements Magasin</h3>
              <p className="text-xs text-amber-900/60 font-medium">Traçabilité complète de toutes les entrées fournisseurs et sorties vers les comptoirs.</p>
            </div>
            <div className="flex gap-2">
              {isManagerOrAdmin && (
                <>
                  <button
                    onClick={() => {
                      generatePDF({
                        title: 'Journal Complet des Mouvements Magasin',
                        filename: `journal_magasin_${format(new Date(), 'yyyyMMdd')}.pdf`,
                        columns: ['Date', 'Type', 'Article', 'Quantité', 'Origine/Destination', 'Auteur'],
                        rows: movements.map(m => [
                          m.timestamp ? format(parseDate(m.timestamp), 'dd/MM/yyyy HH:mm') : '',
                          m.type === 'IN' ? 'Entrée' : 'Sortie',
                          m.productName,
                          m.type === 'IN' ? `+${m.quantity}` : `-${m.quantity}`,
                          m.type === 'IN' ? (m.supplierName || 'Fournisseur') : (m.destinationLocation || 'POS'),
                          m.userName
                        ]),
                        settings
                      });
                      toast.success("Rapport PDF généré !");
                    }}
                    className="flex items-center gap-2 px-4 py-2.5 bg-red-100 text-red-700 rounded-xl font-black text-xs uppercase tracking-wider hover:bg-red-200 transition-all border border-red-300 shadow-sm"
                  >
                    <Printer className="w-4 h-4" /> Exporter PDF
                  </button>
                  <button
                    onClick={() => {
                      const csvContent = "data:text/csv;charset=utf-8," 
                        + ["Date,Type,Article,Quantite,Destination/Fournisseur,Auteur,Notes"].join(",") + "\n"
                        + movements.map(m => `"${m.timestamp ? format(parseDate(m.timestamp), 'yyyy-MM-dd HH:mm') : ''}","${m.type === 'IN' ? 'Entrée Fournisseur' : 'Sortie POS'}","${m.productName}",${m.quantity},"${m.type === 'IN' ? (m.supplierName || '') : (m.destinationLocation || '')}","${m.userName}","${m.notes || ''}"`).join("\n");
                      const encodedUri = encodeURI(csvContent);
                      const link = document.createElement("a");
                      link.setAttribute("href", encodedUri);
                      link.setAttribute("download", `journal_magasin_${format(new Date(), 'yyyy-MM-dd')}.csv`);
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      toast.success("Rapport CSV téléchargé !");
                    }}
                    className="flex items-center gap-2 px-4 py-2.5 bg-amber-100 text-amber-900 rounded-xl font-black text-xs uppercase tracking-wider hover:bg-amber-200 transition-all border border-amber-300 shadow-sm"
                  >
                    <Download className="w-4 h-4" /> Exporter CSV
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-amber-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-yellow-50/85 border-b border-amber-200 text-[10px] font-black uppercase tracking-widest text-amber-900">
                    <th className="p-4">Date & Heure</th>
                    <th className="p-4">Type de Mouvement</th>
                    <th className="p-4">Article</th>
                    <th className="p-4 text-center">Quantité</th>
                    <th className="p-4">Origine / Destination</th>
                    <th className="p-4">Auteur</th>
                    <th className="p-4">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-100 text-xs font-medium text-[#2B2321]">
                  {movements.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-amber-900/50 font-bold uppercase tracking-wider text-xs">
                        Aucun mouvement enregistré.
                      </td>
                    </tr>
                  ) : (
                    movements.map(mov => (
                      <tr key={mov.id} className="hover:bg-yellow-50/40 transition-colors">
                        <td className="p-4 font-bold text-amber-950">
                          {mov.timestamp ? format(parseDate(mov.timestamp), 'dd/MM/yyyy HH:mm', { locale: fr }) : '—'}
                        </td>
                        <td className="p-4">
                          <span className={cn(
                            "px-2.5 py-1 rounded-lg font-black text-[10px] uppercase inline-flex items-center gap-1",
                            mov.type === 'IN' ? "bg-emerald-100 text-emerald-800 border border-emerald-200" : "bg-amber-100 text-amber-900 border border-amber-300"
                          )}>
                            {mov.type === 'IN' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            {mov.type === 'IN' ? 'Entrée (Achat)' : 'Sortie (Transfert)'}
                          </span>
                        </td>
                        <td className="p-4 font-black text-amber-900 uppercase">{mov.productName}</td>
                        <td className="p-4 text-center font-black text-sm">
                          <span className={mov.type === 'IN' ? "text-emerald-700" : "text-amber-700"}>
                            {mov.type === 'IN' ? `+${mov.quantity}` : `-${mov.quantity}`}
                          </span>
                        </td>
                        <td className="p-4 font-bold text-[#2B2321]">
                          {mov.type === 'IN' ? (mov.supplierName || 'Fournisseur') : (mov.destinationLocation || 'POS')}
                        </td>
                        <td className="p-4 text-amber-900/70 font-semibold">{mov.userName}</td>
                        <td className="p-4 text-amber-900/60 italic">{mov.notes || '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Product Modal */}
      <AnimatePresence>
        {isAddingProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-lg w-full border border-amber-200 shadow-2xl overflow-hidden"
            >
              <div className="bg-gradient-to-r from-amber-500 to-yellow-500 px-6 py-4 flex justify-between items-center text-white">
                <h3 className="font-black uppercase tracking-wider text-sm flex items-center gap-2">
                  <Warehouse className="w-4 h-4" /> {editingProduct ? 'Modifier l’Article Magasin' : 'Nouvel Article en Réserve'}
                </h3>
                <button onClick={() => setIsAddingProduct(false)} className="p-1.5 rounded-xl hover:bg-white/20 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveProduct} className="p-6 space-y-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-amber-900/70 block mb-1.5">Nom de l'Article</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Pack Heineken 24x33cl, Carton Sucre..."
                    value={productForm.name}
                    onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                    className="w-full p-3 bg-yellow-50/50 border border-amber-200 rounded-2xl text-xs font-bold text-[#2B2321] focus:border-amber-500 outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-amber-900/70 block mb-1.5">Catégorie</label>
                    <select
                      value={productForm.category}
                      onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                      className="w-full p-3 bg-yellow-50/50 border border-amber-200 rounded-2xl text-xs font-bold text-[#2B2321] focus:border-amber-500 outline-none"
                    >
                      <option value="Boissons">Boissons</option>
                      <option value="Chicha & Tabac">Chicha & Tabac</option>
                      <option value="Restaurant & Alimentation">Restaurant & Alimentation</option>
                      <option value="Entretien & Nettoyage">Entretien & Nettoyage</option>
                      <option value="Consommables & Divers">Consommables & Divers</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-amber-900/70 block mb-1.5">Unité de Mesure</label>
                    <select
                      value={productForm.unit}
                      onChange={(e) => setProductForm({ ...productForm, unit: e.target.value })}
                      className="w-full p-3 bg-yellow-50/50 border border-amber-200 rounded-2xl text-xs font-bold text-[#2B2321] focus:border-amber-500 outline-none"
                    >
                      <option value="Carton">Carton</option>
                      <option value="Pack">Pack</option>
                      <option value="Bouteille">Bouteille</option>
                      <option value="Kg">Kg</option>
                      <option value="Pièce">Pièce</option>
                      <option value="Bidon">Bidon</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-amber-900/70 block mb-1.5">Stock Initial en Réserve</label>
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={productForm.stock}
                      onChange={(e) => setProductForm({ ...productForm, stock: e.target.value })}
                      className="w-full p-3 bg-yellow-50/50 border border-amber-200 rounded-2xl text-xs font-bold text-[#2B2321] focus:border-amber-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-amber-900/70 block mb-1.5">Seuil d'Alerte Min.</label>
                    <input
                      type="number"
                      min="0"
                      placeholder="5"
                      value={productForm.minStock}
                      onChange={(e) => setProductForm({ ...productForm, minStock: e.target.value })}
                      className="w-full p-3 bg-yellow-50/50 border border-amber-200 rounded-2xl text-xs font-bold text-[#2B2321] focus:border-amber-500 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-amber-900/70 block mb-1.5">Prix d'Achat Unitaire (FCFA)</label>
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={productForm.buyPrice}
                      onChange={(e) => setProductForm({ ...productForm, buyPrice: e.target.value })}
                      className="w-full p-3 bg-yellow-50/50 border border-amber-200 rounded-2xl text-xs font-bold text-[#2B2321] focus:border-amber-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-amber-900/70 block mb-1.5">Prix de Vente POS (FCFA)</label>
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={productForm.sellPrice}
                      onChange={(e) => setProductForm({ ...productForm, sellPrice: e.target.value })}
                      className="w-full p-3 bg-yellow-50/50 border border-amber-200 rounded-2xl text-xs font-bold text-[#2B2321] focus:border-amber-500 outline-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-amber-100">
                  <button
                    type="button"
                    onClick={() => setIsAddingProduct(false)}
                    className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-gray-200 transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-amber-500 text-white rounded-xl font-black text-xs uppercase tracking-wider hover:bg-amber-600 transition-colors shadow-md"
                  >
                    {editingProduct ? 'Mettre à jour' : 'Enregistrer'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Entry / Purchase Modal */}
      <AnimatePresence>
        {isEntryModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-md w-full border border-amber-200 shadow-2xl overflow-hidden"
            >
              <div className="bg-gradient-to-r from-amber-500 to-yellow-500 px-6 py-4 flex justify-between items-center text-white">
                <h3 className="font-black uppercase tracking-wider text-sm flex items-center gap-2">
                  <PackagePlus className="w-4 h-4" /> Enregistrer une Entrée (Achat Fournisseur)
                </h3>
                <button onClick={() => setIsEntryModalOpen(false)} className="p-1.5 rounded-xl hover:bg-white/20 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleRecordEntry} className="p-6 space-y-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-amber-900/70 block mb-1.5">Sélectionner l'Article</label>
                  <select
                    required
                    value={entryForm.productId}
                    onChange={(e) => setEntryForm({ ...entryForm, productId: e.target.value })}
                    className="w-full p-3 bg-yellow-50/50 border border-amber-200 rounded-2xl text-xs font-bold text-[#2B2321] focus:border-amber-500 outline-none"
                  >
                    <option value="">-- Choisir un article --</option>
                    {warehouseProducts.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} (Stock actuel: {p.stock} {p.unit}s)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-amber-900/70 block mb-1.5">Quantité Reçue</label>
                  <input
                    type="number"
                    min="1"
                    required
                    placeholder="Ex: 50"
                    value={entryForm.quantity}
                    onChange={(e) => setEntryForm({ ...entryForm, quantity: e.target.value })}
                    className="w-full p-3 bg-yellow-50/50 border border-amber-200 rounded-2xl text-xs font-bold text-[#2B2321] focus:border-amber-500 outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-amber-900/70 block mb-1.5">Nom du Fournisseur</label>
                  <input
                    type="text"
                    placeholder="Ex: Brasseries du Cameroun, Solibra..."
                    value={entryForm.supplierName}
                    onChange={(e) => setEntryForm({ ...entryForm, supplierName: e.target.value })}
                    className="w-full p-3 bg-yellow-50/50 border border-amber-200 rounded-2xl text-xs font-bold text-[#2B2321] focus:border-amber-500 outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-amber-900/70 block mb-1.5">N° de Facture / Bon de Livraison</label>
                  <input
                    type="text"
                    placeholder="Ex: FAC-2026-981"
                    value={entryForm.invoiceNumber}
                    onChange={(e) => setEntryForm({ ...entryForm, invoiceNumber: e.target.value })}
                    className="w-full p-3 bg-yellow-50/50 border border-amber-200 rounded-2xl text-xs font-bold text-[#2B2321] focus:border-amber-500 outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-amber-900/70 block mb-1.5">Notes / Remarques</label>
                  <textarea
                    rows={2}
                    placeholder="Commentaires éventuels..."
                    value={entryForm.notes}
                    onChange={(e) => setEntryForm({ ...entryForm, notes: e.target.value })}
                    className="w-full p-3 bg-yellow-50/50 border border-amber-200 rounded-2xl text-xs font-bold text-[#2B2321] focus:border-amber-500 outline-none resize-none"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-amber-100">
                  <button
                    type="button"
                    onClick={() => setIsEntryModalOpen(false)}
                    className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-gray-200 transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-amber-500 text-white rounded-xl font-black text-xs uppercase tracking-wider hover:bg-amber-600 transition-colors shadow-md"
                  >
                    Valider l'Entrée
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Transfer / Dispatch Modal */}
      <AnimatePresence>
        {isTransferModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-md w-full border border-amber-200 shadow-2xl overflow-hidden"
            >
              <div className="bg-gradient-to-r from-amber-600 to-amber-800 px-6 py-4 flex justify-between items-center text-white">
                <h3 className="font-black uppercase tracking-wider text-sm flex items-center gap-2">
                  <ArrowRightLeft className="w-4 h-4 text-yellow-300" /> Sortie / Transfert vers Point de Vente
                </h3>
                <button onClick={() => setIsTransferModalOpen(false)} className="p-1.5 rounded-xl hover:bg-white/20 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleRecordTransfer} className="p-6 space-y-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-amber-900/70 block mb-1.5">Sélectionner l'Article (Réserve Centrale)</label>
                  <select
                    required
                    value={transferForm.productId}
                    onChange={(e) => setTransferForm({ ...transferForm, productId: e.target.value })}
                    className="w-full p-3 bg-yellow-50/50 border border-amber-200 rounded-2xl text-xs font-bold text-[#2B2321] focus:border-amber-500 outline-none"
                  >
                    <option value="">-- Choisir un article --</option>
                    {warehouseProducts.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} (Dispo en Réserve: {p.stock} {p.unit}s)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-amber-900/70 block mb-1.5">Point de Vente Destination</label>
                  <select
                    required
                    value={transferForm.destinationLocation}
                    onChange={(e) => setTransferForm({ ...transferForm, destinationLocation: e.target.value })}
                    className="w-full p-3 bg-yellow-50/50 border border-amber-200 rounded-2xl text-xs font-bold text-[#2B2321] focus:border-amber-500 outline-none"
                  >
                    <option value="Terrasse">Terrasse</option>
                    <option value="VIP">Bar VIP</option>
                    <option value="Réception">Réception / Lobby</option>
                    <option value="Restaurant">Restaurant / Cuisine</option>
                    <option value="Chicha">Espace Chicha</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-amber-900/70 block mb-1.5">Quantité à Transférer</label>
                  <input
                    type="number"
                    min="1"
                    required
                    placeholder="Ex: 10"
                    value={transferForm.quantity}
                    onChange={(e) => setTransferForm({ ...transferForm, quantity: e.target.value })}
                    className="w-full p-3 bg-yellow-50/50 border border-amber-200 rounded-2xl text-xs font-bold text-[#2B2321] focus:border-amber-500 outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-amber-900/70 block mb-1.5">Motif / Notes de Transfert</label>
                  <textarea
                    rows={2}
                    placeholder="Ex: Réapprovisionnement bar terrasse pour le weekend..."
                    value={transferForm.notes}
                    onChange={(e) => setTransferForm({ ...transferForm, notes: e.target.value })}
                    className="w-full p-3 bg-yellow-50/50 border border-amber-200 rounded-2xl text-xs font-bold text-[#2B2321] focus:border-amber-500 outline-none resize-none"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-amber-100">
                  <button
                    type="button"
                    onClick={() => setIsTransferModalOpen(false)}
                    className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-gray-200 transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-amber-900 text-white rounded-xl font-black text-xs uppercase tracking-wider hover:bg-amber-950 transition-colors shadow-md"
                  >
                    Valider le Transfert
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={!!productToDelete}
        title="Supprimer du Magasin Central"
        message={`Voulez-vous vraiment supprimer "${productToDelete?.name}" du Magasin Central ?`}
        confirmLabel="Supprimer"
        onConfirm={() => productToDelete && executeDeleteProduct(productToDelete.id, productToDelete.name)}
        onClose={() => setProductToDelete(null)}
      />
    </div>
  );
};
