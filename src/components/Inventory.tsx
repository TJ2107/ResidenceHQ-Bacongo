import React, { useState } from 'react';
import { Product, AppSettings, UserProfile } from '../types';
import { Download, FileUp, Loader2, Plus, X, FileText, PackagePlus, Trash2, AlertTriangle, Bell } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, OperationType, handleFirestoreError, logEvent } from '../lib/utils';
import { addDoc, collection, updateDoc, doc, writeBatch, increment, deleteDoc, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import * as XLSX from 'xlsx';
import { LOW_STOCK_THRESHOLD } from '../constants';
import { sendStockNotification, sendRestockNotification } from '../lib/utils';
import { generatePDF } from '../lib/pdfUtils';
import { toast } from 'sonner';

export const Inventory = ({ products, isAdmin, settings, user }: { products: Product[], isAdmin: boolean, settings?: AppSettings | null, user: UserProfile }) => {
  const isManagerOrAdmin = isAdmin || user?.role === 'admin' || user?.role === 'manager' || user?.email?.toLowerCase() === 'cyber.kan587@gmail.com';
  const canManageStock = isManagerOrAdmin || ['receptionist', 'caissiere', 'serveur', 'waiter', 'barman'].includes(user?.role);

  const [isAdding, setIsAdding] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [stockProduct, setStockProduct] = useState<Product | null>(null);
  const [confirmDeleteProduct, setConfirmDeleteProduct] = useState<Product | null>(null);
  const [confirmClearStock, setConfirmClearStock] = useState(false);
  const [isClearingStock, setIsClearingStock] = useState(false);
  const [stockToAdd, setStockToAdd] = useState('');
  const [formData, setFormData] = useState({ 
    name: '', 
    category: '', 
    price: '', 
    stockTerrasse: '', 
    stockReception: '', 
    stockVip: '' 
  });
  const [isDownloading, setIsDownloading] = useState(false);

  // Stock selection tabs
  const [activeStockTab, setActiveStockTab] = useState<'all' | 'Terrasse' | 'Réception' | 'VIP'>('all');
  const [targetStockPoint, setTargetStockPoint] = useState<'Terrasse' | 'Réception' | 'VIP'>('Terrasse');

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !canManageStock) return;

    setIsImporting(true);
    setImportProgress(0);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      const totalItems = jsonData.length;
      const batchSize = 500;
      let processedCount = 0;

      // Process in batches of 500 (Firestore limit)
      for (let i = 0; i < jsonData.length; i += batchSize) {
        const batch = writeBatch(db);
        const chunk = jsonData.slice(i, i + batchSize);

        for (const item of chunk) {
          const row = item as any;
          const name = row.Nom || row.Name || row.name || row.nom;
          const category = row.Categorie || row.Category || row.category || row.categorie || 'Divers';
          const price = Number(row.Prix || row.Price || row.price || row.prix || 0);
          
          const legacyStock = Number(row.Stock || row.stock || 0);
          const stockTerrasse = Number(row['Stock Terrasse'] || row['stockTerrasse'] || row['Stock terrasse'] || legacyStock);
          const stockReception = Number(row['Stock Réception'] || row['stockReception'] || row['Stock reception'] || 0);
          const stockVip = Number(row['Stock VIP'] || row['stockVip'] || row['Stock vip'] || 0);
          const stockTotal = stockTerrasse + stockReception + stockVip;

          if (name && !isNaN(price)) {
            const newDocRef = doc(collection(db, 'products'));
            batch.set(newDocRef, {
              name,
              category,
              price,
              stockTerrasse,
              stockReception,
              stockVip,
              stock: stockTotal
            });
            
            if (stockTotal <= LOW_STOCK_THRESHOLD) {
              sendStockNotification(name, stockTotal, settings?.hotelName, settings?.logoUrl);
            }
          }
        }

        await batch.commit();
        logEvent(user, 'Stock', `Importation de ${totalItems} articles effectuée par ${user.username}.`);
        processedCount += chunk.length;
        setImportProgress(Math.round((processedCount / totalItems) * 100));
      }

      alert('Importation réussie !');
    } catch (error) {
      console.error('Import error:', error);
      alert('Erreur lors de l\'importation. Vérifiez le format du fichier.');
    } finally {
      setIsImporting(false);
      setImportProgress(0);
      if (e.target) e.target.value = '';
    }
  };

  const downloadTemplate = () => {
    const template = [
      { Nom: 'Exemple Produit', Categorie: 'Boissons', Prix: 1000, 'Stock Terrasse': 24, 'Stock Réception': 12, 'Stock VIP': 10 }
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "template_retro.xlsx");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageStock) {
      toast.error("Vous n'avez pas l'autorisation de modifier l'inventaire.");
      return;
    }

    try {
      const stockTerrasseVal = Number(formData.stockTerrasse || 0);
      const stockReceptionVal = Number(formData.stockReception || 0);
      const stockVipVal = Number(formData.stockVip || 0);
      const totalStock = stockTerrasseVal + stockReceptionVal + stockVipVal;

      const data = {
        name: formData.name,
        category: formData.category,
        price: Number(formData.price),
        stockTerrasse: stockTerrasseVal,
        stockReception: stockReceptionVal,
        stockVip: stockVipVal,
        stock: totalStock
      };

      let productId = editingProduct?.id;
      if (editingProduct) {
        await updateDoc(doc(db, 'products', editingProduct.id), data);
        logEvent(user, 'Stock', `Article modifié : ${formData.name} par ${user.username}.`);
      } else {
        const docRef = await addDoc(collection(db, 'products'), data);
        productId = docRef.id;
        logEvent(user, 'Stock', `Nouvel article ajouté : ${formData.name} par ${user.username}.`);
      }

      if (totalStock <= LOW_STOCK_THRESHOLD) {
        sendStockNotification(formData.name, totalStock, settings?.hotelName, settings?.logoUrl, productId);
      }

      setIsAdding(false);
      setEditingProduct(null);
      setFormData({ name: '', category: '', price: '', stockTerrasse: '', stockReception: '', stockVip: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'products');
    }
  };

  const handleAddStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockProduct || !stockToAdd) return;

    try {
      const quantity = Number(stockToAdd);
      if (isNaN(quantity) || quantity <= 0) return;

      const curTerrasse = stockProduct.stockTerrasse ?? stockProduct.stock ?? 0;
      const curReception = stockProduct.stockReception ?? 0;
      const curVip = stockProduct.stockVip ?? 0;

      let newTerrasse = curTerrasse;
      let newReception = curReception;
      let newVip = curVip;

      if (targetStockPoint === 'Réception') {
        newReception = curReception + quantity;
      } else if (targetStockPoint === 'VIP') {
        newVip = curVip + quantity;
      } else {
        newTerrasse = curTerrasse + quantity;
      }

      const totalStock = newTerrasse + newReception + newVip;

      await updateDoc(doc(db, 'products', stockProduct.id), {
        stockTerrasse: newTerrasse,
        stockReception: newReception,
        stockVip: newVip,
        stock: totalStock
      });

      logEvent(user, 'Stock', `Réapprovisionnement de ${quantity} unités pour ${stockProduct.name} (${targetStockPoint}) par ${user.username}.`);

      sendRestockNotification(
        `${stockProduct.name} (${targetStockPoint})`, 
        quantity, 
        totalStock, 
        settings?.hotelName, 
        settings?.logoUrl, 
        stockProduct.id
      );

      setStockProduct(null);
      setStockToAdd('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'products');
    }
  };

  const handleDownloadPDF = () => {
    setIsDownloading(true);
    try {
      const columns = ['Article', 'Catégorie', 'Prix (FCFA)', 'Stock Terrasse', 'Stock Réception', 'Stock VIP', 'Stock Total'];
      const rows = products.map(p => [
        p.name,
        p.category,
        p.price.toLocaleString(),
        (p.stockTerrasse ?? p.stock ?? 0).toString(),
        (p.stockReception ?? 0).toString(),
        (p.stockVip ?? 0).toString(),
        p.stock.toString()
      ]);

      generatePDF({
        title: 'État du Stock et Inventaire Multi-Points',
        filename: 'Inventaire_Stock_Global',
        columns,
        rows,
        settings
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  const exportToExcel = () => {
    const data = products.map(p => ({
      'Article': p.name,
      'Catégorie': p.category,
      'Prix (FCFA)': p.price,
      'Stock Terrasse': p.stockTerrasse ?? p.stock ?? 0,
      'Stock Réception': p.stockReception ?? 0,
      'Stock VIP': p.stockVip ?? 0,
      'Stock Total': p.stock
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventaire");
    XLSX.writeFile(wb, "Inventaire_Stock_Global.xlsx");
  };

  const handleDeleteProduct = async (product: Product) => {
    if (!isManagerOrAdmin) {
      toast.error("Seuls les Managers et Administrateurs peuvent supprimer un article.");
      return;
    }
    setConfirmDeleteProduct(product);
  };

  const executeDeleteProduct = async () => {
    if (!confirmDeleteProduct || !isManagerOrAdmin) return;
    const targetProduct = confirmDeleteProduct;
    setConfirmDeleteProduct(null);

    try {
      await deleteDoc(doc(db, 'products', targetProduct.id));
      logEvent(user, 'Stock', `Article supprimé : ${targetProduct.name} par ${user.username}.`);
      toast.success(`Article "${targetProduct.name}" supprimé avec succès.`);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `products/${targetProduct.id}`);
    }
  };

  const handleClearAllInventory = async () => {
    const isManagerOrAdmin = isAdmin || user?.role === 'admin' || user?.role === 'manager' || user?.email?.toLowerCase() === 'cyber.kan587@gmail.com';
    if (!isManagerOrAdmin) {
      toast.error("Seuls les Managers et Administrateurs sont autorisés à vider le stock.");
      return;
    }
    setIsClearingStock(true);
    try {
      const snapshot = await getDocs(collection(db, 'products'));
      const docs = snapshot.docs;
      const chunkSize = 400;
      for (let i = 0; i < docs.length; i += chunkSize) {
        const batch = writeBatch(db);
        const chunk = docs.slice(i, i + chunkSize);
        chunk.forEach(docSnap => batch.delete(docSnap.ref));
        await batch.commit();
      }
      localStorage.setItem('residence_products', '[]');
      logEvent(user, 'Stock', `Tout le stock a été vidé par ${user?.username || 'Admin'}.`);
      toast.success("Tout le stock a été supprimé avec succès !");
      setConfirmClearStock(false);
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'products');
      toast.error("Erreur lors de la suppression du stock. Vérifiez la connexion ou les permissions.");
    } finally {
      setIsClearingStock(false);
    }
  };

  const handleRequestRestock = (product: Product, point: string) => {
    sendRestockNotification(
      `${product.name} (${point})`, 
      10, // Quantité demandée par défaut
      product.stock, 
      settings?.hotelName, 
      settings?.logoUrl, 
      product.id
    );
    toast.success(`Demande de réapprovisionnement envoyée pour ${product.name} (${point}) !`);
    logEvent(user, 'Stock', `Demande de réapprovisionnement initiée pour ${product.name} (${point}) par ${user.username}.`);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[#2B2321] uppercase">Gestion des Stocks</h2>
          <p className="text-xs text-[#2B2321]/60 mt-1">Multi-points autonomes : Terrasse, Réception, & VIP Salon</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 md:gap-3">
          <button 
            onClick={handleDownloadPDF}
            disabled={isDownloading || products.length === 0}
            className="flex items-center gap-2 px-3 md:px-4 py-2 bg-white border border-secondary/30 text-primary rounded-xl font-bold text-xs hover:bg-[#FDFBF7] transition-all disabled:opacity-50"
            title="Exporter en PDF"
          >
            {isDownloading ? (
              <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            ) : (
              <FileText className="w-4 h-4" />
            )}
            <span className="hidden md:inline">PDF</span>
          </button>
          <button 
            onClick={exportToExcel}
            disabled={products.length === 0}
            className="flex items-center gap-2 px-3 md:px-4 py-2 bg-white border border-secondary/30 text-green-600 rounded-xl font-bold text-xs hover:bg-[#FDFBF7] transition-all disabled:opacity-50"
            title="Exporter Stock en Excel"
          >
            <Download className="w-4 h-4" />
            <span className="md:hidden">S</span>
            <span className="hidden md:inline">Excel S</span>
          </button>
          <button 
            onClick={downloadTemplate}
            className="hidden md:flex items-center gap-2 px-4 py-2 bg-white border border-secondary/30 rounded-xl font-bold hover:bg-[#FDFBF7] transition-all text-xs text-[#2B2321]"
            title="Télécharger le modèle Excel"
          >
            <Download className="w-4 h-4" />
            Modèle
          </button>
          {canManageStock && (
            <label className="flex items-center gap-2 px-3 md:px-4 py-2 bg-white border border-secondary/30 rounded-xl font-bold hover:bg-[#FDFBF7] transition-all cursor-pointer text-xs text-[#2B2321]">
              {isImporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span className="hidden md:inline">{importProgress}%</span>
                </>
              ) : (
                <>
                  <FileUp className="w-4 h-4 text-primary" />
                  <span className="hidden md:inline">Importer Excel</span>
                </>
              )}
              <input 
                type="file" 
                accept=".xlsx, .xls, .csv" 
                className="hidden" 
                onChange={handleImport}
                disabled={isImporting}
              />
            </label>
          )}
          {canManageStock && (
            <button 
              onClick={() => setIsAdding(true)}
              className="flex items-center gap-2 px-3 md:px-4 py-2 bg-primary text-white rounded-xl shadow-sm font-bold hover:bg-primary/90 transition-all text-xs"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden md:inline">Ajouter un article</span>
            </button>
          )}
          {isManagerOrAdmin && (
            <button 
              onClick={() => setConfirmClearStock(true)}
              disabled={products.length === 0}
              className="flex items-center gap-2 px-3 md:px-4 py-2 bg-red-50 border border-red-200 text-red-600 rounded-xl font-bold text-xs hover:bg-red-100 transition-all disabled:opacity-50"
              title="Vider tout le stock"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden md:inline">Vider le stock</span>
            </button>
          )}
        </div>
      </div>

      {/* Autonomous Point Filters */}
      <div className="flex flex-wrap gap-2 border-b border-secondary/20 pb-4">
        {(['all', 'Terrasse', 'Réception', 'VIP'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveStockTab(tab)}
            className={cn(
              "px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest transition-all",
              activeStockTab === tab
                ? "bg-primary text-white shadow-md"
                : "bg-white text-primary border border-secondary/20 hover:bg-[#FDFBF7]"
            )}
          >
            {tab === 'all' ? 'Vue Générale (Tout)' : `Stock ${tab}`}
          </button>
        ))}
      </div>

      {/* Low Stock Alerts and Restock Request panel */}
      {(() => {
        const lowStockList: { product: Product; point: string; stock: number }[] = [];
        products.forEach(p => {
          const t = p.stockTerrasse ?? p.stock ?? 0;
          const r = p.stockReception ?? 0;
          const v = p.stockVip ?? 0;
          if (t <= LOW_STOCK_THRESHOLD) lowStockList.push({ product: p, point: 'Terrasse', stock: t });
          if (r <= LOW_STOCK_THRESHOLD) lowStockList.push({ product: p, point: 'Réception', stock: r });
          if (v <= LOW_STOCK_THRESHOLD) lowStockList.push({ product: p, point: 'VIP', stock: v });
        });

        if (lowStockList.length === 0) return null;

        return (
          <div className="p-5 bg-amber-50/50 border border-amber-200/60 rounded-2xl space-y-3.5">
            <div className="flex items-center gap-2 text-amber-800">
              <AlertTriangle className="w-5 h-5 text-amber-600 animate-bounce" />
              <h3 className="text-sm font-black uppercase tracking-wider">Alertes de Stocks Critiques ({lowStockList.length})</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {lowStockList.map((item, idx) => (
                <div key={idx} className="bg-white border border-secondary/20 p-3 rounded-xl flex items-center justify-between gap-2 shadow-sm animate-in fade-in zoom-in-95 duration-200">
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-[#2B2321]">{item.product.name}</p>
                    <div className="flex items-center gap-1.5 text-[9px] font-bold text-[#2B2321]/60 uppercase tracking-wider">
                      <span>Point: <strong className="text-primary">{item.point}</strong></span>
                      <span>•</span>
                      <span>Stock: <strong className="text-red-500">{item.stock}</strong></span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRequestRestock(item.product, item.point)}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-primary/5 hover:bg-primary text-primary hover:text-white rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all border border-primary/20 hover:border-transparent shrink-0"
                  >
                    <Bell className="w-3 h-3" /> Réappro
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      <div className="overflow-x-auto bg-white border border-secondary/30 shadow-sm hover:shadow-xl hover:shadow-primary/10 transition-shadow rounded-2xl">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-secondary/30 bg-[#FDFBF7]">
              <th className="p-2 sm:p-4 text-[8px] sm:text-[10px] font-bold uppercase tracking-widest text-primary/60">Article</th>
              <th className="p-2 sm:p-4 text-[8px] sm:text-[10px] font-bold uppercase tracking-widest text-primary/60">Catégorie</th>
              <th className="p-2 sm:p-4 text-[8px] sm:text-[10px] font-bold uppercase tracking-widest text-primary/60">Prix</th>
              
              {activeStockTab === 'all' && (
                <>
                  <th className="p-2 sm:p-4 text-[8px] sm:text-[10px] font-bold uppercase tracking-widest text-primary/60">Stock Terr.</th>
                  <th className="p-2 sm:p-4 text-[8px] sm:text-[10px] font-bold uppercase tracking-widest text-primary/60">Stock Récep.</th>
                  <th className="p-2 sm:p-4 text-[8px] sm:text-[10px] font-bold uppercase tracking-widest text-primary/60">Stock VIP</th>
                </>
              )}
              
              {activeStockTab === 'Terrasse' && (
                <th className="p-2 sm:p-4 text-[8px] sm:text-[10px] font-bold uppercase tracking-widest text-primary/60">Stock terrasse</th>
              )}
              {activeStockTab === 'Réception' && (
                <th className="p-2 sm:p-4 text-[8px] sm:text-[10px] font-bold uppercase tracking-widest text-primary/60">Stock Réception</th>
              )}
              {activeStockTab === 'VIP' && (
                <th className="p-2 sm:p-4 text-[8px] sm:text-[10px] font-bold uppercase tracking-widest text-primary/60">Stock VIP</th>
              )}
              
              <th className="p-2 sm:p-4 text-[8px] sm:text-[10px] font-bold uppercase tracking-widest text-primary/60">Total global</th>
              <th className="p-2 sm:p-4 text-[8px] sm:text-[10px] font-bold uppercase tracking-widest text-primary/60 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => {
              const stockT = product.stockTerrasse ?? product.stock ?? 0;
              const stockR = product.stockReception ?? 0;
              const stockV = product.stockVip ?? 0;
              const stockTot = product.stock;

              return (
                <tr key={product.id} className="border-b border-secondary/10 hover:bg-[#FDFBF7] transition-colors">
                  <td className="p-2 sm:p-4 font-bold tracking-tight text-[#2B2321] text-xs sm:text-sm">{product.name}</td>
                  <td className="p-2 sm:p-4 text-[8px] sm:text-[10px] font-bold uppercase tracking-widest text-primary">{product.category}</td>
                  <td className="p-2 sm:p-4 font-bold text-primary text-xs sm:text-sm">{product.price.toLocaleString()} FCFA</td>
                  
                  {activeStockTab === 'all' && (
                    <>
                      <td className="p-2 sm:p-4">
                        <span className={cn(
                          "px-1.5 py-0.5 sm:px-2.5 sm:py-1 text-[8px] sm:text-[10px] font-bold border rounded-full",
                          stockT <= LOW_STOCK_THRESHOLD ? "bg-red-50 text-red-600 border-red-100" : "bg-[#FDFBF7] text-[#2B2321]/60 border-secondary/30"
                        )}>
                          {stockT}
                        </span>
                      </td>
                      <td className="p-2 sm:p-4">
                        <span className={cn(
                          "px-1.5 py-0.5 sm:px-2.5 sm:py-1 text-[8px] sm:text-[10px] font-bold border rounded-full",
                          stockR <= LOW_STOCK_THRESHOLD ? "bg-red-50 text-red-600 border-red-100" : "bg-[#FDFBF7] text-[#2B2321]/60 border-secondary/30"
                        )}>
                          {stockR}
                        </span>
                      </td>
                      <td className="p-2 sm:p-4">
                        <span className={cn(
                          "px-1.5 py-0.5 sm:px-2.5 sm:py-1 text-[8px] sm:text-[10px] font-bold border rounded-full",
                          stockV <= LOW_STOCK_THRESHOLD ? "bg-red-50 text-red-600 border-red-100" : "bg-[#FDFBF7] text-[#2B2321]/60 border-secondary/30"
                        )}>
                          {stockV}
                        </span>
                      </td>
                    </>
                  )}

                  {activeStockTab === 'Terrasse' && (
                    <td className="p-2 sm:p-4">
                      <span className={cn(
                        "px-2 py-0.5 sm:px-3 sm:py-1 text-[8px] sm:text-[10px] font-bold border rounded-full font-mono",
                        stockT <= LOW_STOCK_THRESHOLD ? "bg-red-50 text-red-600 border-red-100" : "bg-[#FDFBF7] text-[#2B2321]/60 border-secondary/30"
                      )}>
                        {stockT}
                      </span>
                    </td>
                  )}
                  {activeStockTab === 'Réception' && (
                    <td className="p-2 sm:p-4">
                      <span className={cn(
                        "px-2 py-0.5 sm:px-3 sm:py-1 text-[8px] sm:text-[10px] font-bold border rounded-full font-mono",
                        stockR <= LOW_STOCK_THRESHOLD ? "bg-red-50 text-red-600 border-red-100" : "bg-[#FDFBF7] text-[#2B2321]/60 border-secondary/30"
                      )}>
                        {stockR}
                      </span>
                    </td>
                  )}
                  {activeStockTab === 'VIP' && (
                    <td className="p-2 sm:p-4">
                      <span className={cn(
                        "px-2 py-0.5 sm:px-3 sm:py-1 text-[8px] sm:text-[10px] font-bold border rounded-full font-mono",
                        stockV <= LOW_STOCK_THRESHOLD ? "bg-red-50 text-red-600 border-red-100" : "bg-[#FDFBF7] text-[#2B2321]/60 border-secondary/30"
                      )}>
                        {stockV}
                      </span>
                    </td>
                  )}

                  <td className="p-2 sm:p-4">
                    <span className={cn(
                      "px-2 py-0.5 sm:px-3 sm:py-1 text-[8px] sm:text-[10px] font-bold uppercase border rounded-full font-mono",
                      stockTot <= LOW_STOCK_THRESHOLD ? "bg-red-50 text-red-600 border-red-100" : "bg-primary/5 text-primary border-primary/20"
                    )}>
                      {stockTot}
                    </span>
                  </td>

                  <td className="p-2 sm:p-4 text-right">
                    <div className="flex items-center justify-end gap-1.5 sm:gap-4 flex-wrap sm:flex-nowrap">
                      <button 
                        onClick={() => {
                          setStockProduct(product);
                          if (activeStockTab !== 'all') {
                            setTargetStockPoint(activeStockTab);
                          } else {
                            setTargetStockPoint('Terrasse');
                          }
                        }}
                        className="flex items-center gap-0.5 text-[8px] sm:text-[10px] font-bold uppercase tracking-widest text-green-600 hover:text-green-700 hover:underline"
                        title="Ajouter du stock"
                      >
                        <PackagePlus className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                        <span className="hidden xs:inline">Approvisionner</span>
                        <span className="xs:hidden">Approv</span>
                      </button>
                      {canManageStock && (
                        <button 
                          onClick={() => {
                            setEditingProduct(product);
                            setFormData({ 
                              name: product.name, 
                              category: product.category, 
                              price: product.price.toString(), 
                              stockTerrasse: (product.stockTerrasse ?? product.stock ?? 0).toString(),
                              stockReception: (product.stockReception ?? 0).toString(),
                              stockVip: (product.stockVip ?? 0).toString()
                            });
                            setIsAdding(true);
                          }}
                          className="text-[8px] sm:text-[10px] font-bold uppercase tracking-widest text-primary hover:text-primary/80 hover:underline"
                          title="Modifier l'article et les quantités"
                        >
                          Modif
                        </button>
                      )}
                      {isManagerOrAdmin && (
                        <button 
                          onClick={() => handleDeleteProduct(product)}
                          className="flex items-center gap-0.5 text-[8px] sm:text-[10px] font-bold uppercase tracking-widest text-[#E11D48] hover:text-[#BE123C] hover:underline"
                          title="Supprimer définitivement cet article"
                        >
                          <Trash2 className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                          Suppr
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

      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2B2321]/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-white border border-secondary/30 shadow-2xl shadow-primary/20 rounded-3xl p-8"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold tracking-tight uppercase text-[#2B2321]">
                  {editingProduct ? 'Modifier l\'article' : 'Nouvel Article'}
                </h3>
                <button onClick={() => { setIsAdding(false); setEditingProduct(null); }} className="p-2 hover:bg-[#FDFBF7] text-primary rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-primary/60">Nom de l'article</label>
                  <input 
                    required
                    type="text" 
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full p-3.5 border border-secondary/30 rounded-2xl outline-none font-bold tracking-tight focus:bg-[#FDFBF7] focus:border-primary transition-all text-[#2B2321]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-primary/60">Catégorie</label>
                  <input 
                    required
                    type="text" 
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full p-3.5 border border-secondary/30 rounded-2xl outline-none font-bold tracking-tight focus:bg-[#FDFBF7] focus:border-primary transition-all text-[#2B2321]"
                  />
                </div>
                
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-primary/60">Prix (FCFA)</label>
                  <input 
                    required
                    type="number" 
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    className="w-full p-3.5 border border-secondary/30 rounded-2xl outline-none font-bold focus:bg-[#FDFBF7] focus:border-primary transition-all text-[#2B2321]"
                  />
                </div>

                <div className="border-t border-secondary/20 pt-4 mt-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-[#2B2321]">Stocks Initiaux par Point</label>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase tracking-widest text-primary/60">Terrasse</label>
                      <input 
                        required
                        type="number" 
                        value={formData.stockTerrasse}
                        onChange={(e) => setFormData({ ...formData, stockTerrasse: e.target.value })}
                        className="w-full p-3 border border-secondary/30 rounded-xl outline-none font-bold text-center text-xs text-[#2B2321]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase tracking-widest text-primary/60">Réception</label>
                      <input 
                        required
                        type="number" 
                        value={formData.stockReception}
                        onChange={(e) => setFormData({ ...formData, stockReception: e.target.value })}
                        className="w-full p-3 border border-secondary/30 rounded-xl outline-none font-bold text-center text-xs text-[#2B2321]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase tracking-widest text-primary/60">VIP</label>
                      <input 
                        required
                        type="number" 
                        value={formData.stockVip}
                        onChange={(e) => setFormData({ ...formData, stockVip: e.target.value })}
                        className="w-full p-3 border border-secondary/30 rounded-xl outline-none font-bold text-center text-xs text-[#2B2321]"
                      />
                    </div>
                  </div>
                </div>

                <button 
                  type="submit"
                  className="w-full py-4 bg-primary text-white rounded-2xl shadow-lg shadow-primary/20 font-bold hover:bg-primary/90 transition-all uppercase tracking-widest text-sm mt-4"
                >
                  {editingProduct ? 'Enregistrer les modifications' : 'Ajouter au stock'}
                </button>
              </form>
            </motion.div>
          </div>
        )}

        {stockProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2B2321]/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-white border border-secondary/30 shadow-2xl shadow-primary/20 rounded-3xl p-8"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold tracking-tight uppercase text-[#2B2321]">
                  Approvisionner
                </h3>
                <button onClick={() => setStockProduct(null)} className="p-2 hover:bg-[#FDFBF7] text-primary rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mb-6 p-4 bg-[#FDFBF7] rounded-2xl border border-secondary/20">
                <p className="text-xs font-bold uppercase tracking-widest text-primary/60 mb-1">Article</p>
                <p className="font-bold text-[#2B2321] text-lg">{stockProduct.name}</p>
                <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-secondary/15 text-xs font-bold">
                  <div className="text-center">
                    <span className="block text-[10px] text-[#2B2321]/50 uppercase tracking-widest">Terrasse</span>
                    <span className="text-primary font-mono">{stockProduct.stockTerrasse ?? stockProduct.stock ?? 0}</span>
                  </div>
                  <div className="text-center border-x border-secondary/20">
                    <span className="block text-[10px] text-[#2B2321]/50 uppercase tracking-widest">Réception</span>
                    <span className="text-primary font-mono">{stockProduct.stockReception ?? 0}</span>
                  </div>
                  <div className="text-center">
                    <span className="block text-[10px] text-[#2B2321]/50 uppercase tracking-widest">VIP</span>
                    <span className="text-primary font-mono">{stockProduct.stockVip ?? 0}</span>
                  </div>
                </div>
              </div>

              <form onSubmit={handleAddStock} className="space-y-6">
                {/* Stock Point Selector for replenishment */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-primary/60">Sélectionner le Point de Stock à approvisionner</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['Terrasse', 'Réception', 'VIP'] as const).map((point) => (
                      <button
                        key={point}
                        type="button"
                        onClick={() => setTargetStockPoint(point)}
                        className={cn(
                          "py-3 border font-bold text-[10px] uppercase tracking-widest rounded-xl transition-all",
                          targetStockPoint === point 
                            ? "bg-primary text-white border-primary shadow-sm" 
                            : "bg-white text-primary border-secondary/30 hover:border-primary/50"
                        )}
                      >
                        {point}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-primary/60 font-medium">Quantité à ajouter</label>
                  <input 
                    required
                    autoFocus
                    type="number" 
                    min="1"
                    value={stockToAdd}
                    onChange={(e) => setStockToAdd(e.target.value)}
                    placeholder="Ex: 24"
                    className="w-full p-4 border border-secondary/30 rounded-2xl outline-none font-bold tracking-tight focus:bg-[#FDFBF7] focus:border-primary transition-all text-[#2B2321]"
                  />
                </div>
                <button 
                  type="submit"
                  className="w-full py-4 bg-green-600 text-white rounded-2xl shadow-lg shadow-green-600/20 font-bold hover:bg-green-700 transition-all uppercase tracking-widest text-sm"
                >
                  Confirmer l'approvisionnement
                </button>
              </form>
            </motion.div>
          </div>
        )}

        {confirmDeleteProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2B2321]/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-white border border-secondary/30 shadow-2xl shadow-[#E11D48]/10 rounded-3xl p-8"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold tracking-tight uppercase text-[#2B2321] flex items-center gap-2">
                  <Trash2 className="w-5 h-5 text-[#E11D48]" />
                  Supprimer l'article ?
                </h3>
                <button onClick={() => setConfirmDeleteProduct(null)} className="p-2 hover:bg-[#FDFBF7] text-primary rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mb-6 p-4 bg-red-50/50 rounded-2xl border border-red-100">
                <p className="text-sm font-bold text-[#2B2321] mb-1">Attention, cette action est irréversible !</p>
                <p className="text-xs text-[#2B2321]/70">
                  L'article <strong className="text-primary font-bold">"{confirmDeleteProduct.name}"</strong> sera définitivement retiré du stock et de la base de données.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button 
                  type="button"
                  onClick={() => setConfirmDeleteProduct(null)}
                  className="flex-1 py-3.5 bg-white border border-secondary/30 text-[#2B2321] rounded-2xl font-bold hover:bg-[#FDFBF7] transition-all uppercase tracking-widest text-xs"
                >
                  Annuler
                </button>
                <button 
                  type="button"
                  onClick={executeDeleteProduct}
                  className="flex-1 py-3.5 bg-[#E11D48] text-white rounded-2xl shadow-lg shadow-red-600/20 font-bold hover:bg-[#BE123C] transition-all uppercase tracking-widest text-xs"
                >
                  Confirmer
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {confirmClearStock && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2B2321]/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-white border border-secondary/30 shadow-2xl shadow-[#E11D48]/10 rounded-3xl p-8"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold tracking-tight uppercase text-[#2B2321] flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  Vider tout le stock ?
                </h3>
                <button onClick={() => setConfirmClearStock(false)} className="p-2 hover:bg-[#FDFBF7] text-primary rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mb-6 p-4 bg-red-50/50 rounded-2xl border border-red-100">
                <p className="text-sm font-bold text-[#2B2321] mb-1">Attention, action critique !</p>
                <p className="text-xs text-[#2B2321]/70">
                  Tous les articles et produits de l'inventaire ({products.length} articles) seront définitivement supprimés.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button 
                  type="button"
                  onClick={() => setConfirmClearStock(false)}
                  disabled={isClearingStock}
                  className="flex-1 py-3.5 bg-white border border-secondary/30 text-[#2B2321] rounded-2xl font-bold hover:bg-[#FDFBF7] transition-all uppercase tracking-widest text-xs disabled:opacity-50"
                >
                  Annuler
                </button>
                <button 
                  type="button"
                  onClick={handleClearAllInventory}
                  disabled={isClearingStock}
                  className="flex-1 py-3.5 bg-red-600 text-white rounded-2xl shadow-lg shadow-red-600/20 font-bold hover:bg-red-700 transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isClearingStock && <Loader2 className="w-4 h-4 animate-spin" />}
                  Tout supprimer
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
