import React, { useState, useEffect } from 'react';
import { Expense, UserProfile, AppSettings } from '../types';
import { Plus, X, Trash2, Edit2, DollarSign, Calendar, Filter, Search, TrendingDown, Briefcase, Zap, Package, Wrench, MoreHorizontal, FileText, CheckCircle, XCircle, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, OperationType, handleFirestoreError, logEvent, parseDate } from '../lib/utils';
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, doc, deleteDoc, serverTimestamp, limit, writeBatch, getDocs, where, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { fr } from 'date-fns/locale';
import { generatePDF } from '../lib/pdfUtils';
import { toast } from 'sonner';

export const ExpenseManagement = ({ user, settings }: { user: UserProfile, settings?: AppSettings | null }) => {
  const isSuperAdmin = user?.email?.toLowerCase() === 'cyber.kan587@gmail.com';
  const isAdmin = user?.role === 'admin' || isSuperAdmin;
  const isManagerOrAdmin = isAdmin || user?.role === 'manager';
  
  const getDefaultLocation = (_u?: UserProfile) => {
    return 'Réception';
  };

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [formData, setFormData] = useState({ 
    description: '', 
    amount: '', 
    category: 'Other' as Expense['category'], 
    location: getDefaultLocation(user) 
  });
  const [isDownloading, setIsDownloading] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);
  const [isClearingAll, setIsClearingAll] = useState(false);
  const [clearAllConfirmText, setClearAllConfirmText] = useState('');
  const [groupBy, setGroupBy] = useState<'day' | 'week' | 'month'>('day');
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'expenses'), orderBy('timestamp', 'desc'), limit(100));
    const unsub = onSnapshot(q, (snap) => {
      setExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() } as Expense)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'expenses'));
    return () => unsub();
  }, []);

  const toggleGroup = (groupKey: string) => {
    setExpandedGroups(prev => prev.includes(groupKey) ? prev.filter(k => k !== groupKey) : [...prev, groupKey]);
  };

  const groupedExpenses = expenses.reduce((acc, expense) => {
    if (!expense.timestamp) {
      if (!acc['Inconnu']) acc['Inconnu'] = [];
      acc['Inconnu'].push(expense);
      return acc;
    }
    const date = parseDate(expense.timestamp);
    let key = '';
    
    if (groupBy === 'day') {
      key = format(date, 'yyyy-MM-dd');
    } else if (groupBy === 'week') {
      const start = startOfWeek(date, { weekStartsOn: 1 });
      const end = endOfWeek(date, { weekStartsOn: 1 });
      key = `Du ${format(start, 'dd/MM', { locale: fr })} au ${format(end, 'dd/MM/yyyy', { locale: fr })}`;
    } else if (groupBy === 'month') {
      key = format(date, 'MMMM yyyy', { locale: fr });
    }

    if (!acc[key]) acc[key] = [];
    acc[key].push(expense);
    return acc;
  }, {} as Record<string, Expense[]>);

  const sortedGroupKeys = Object.keys(groupedExpenses).sort((a, b) => b.localeCompare(a));
  
  useEffect(() => {
    if (sortedGroupKeys.length > 0 && expandedGroups.length === 0) {
      setExpandedGroups([sortedGroupKeys[0]]);
    }
  }, [sortedGroupKeys, expandedGroups.length]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingExpense) {
        await updateDoc(doc(db, 'expenses', editingExpense.id), {
          ...formData,
          amount: Number(formData.amount)
        });
        logEvent(user, 'Dépense', `Dépense modifiée : ${formData.description} (${Number(formData.amount).toLocaleString()} FCFA) par ${user.username}.`);
      } else {
        const newExpense = {
          ...formData,
          amount: Number(formData.amount),
          timestamp: serverTimestamp(),
          recordedBy: user.username,
          recordedById: user.id,
          status: isAdmin ? 'Approved' : 'Pending',
          ...(isAdmin ? { validatedBy: user.username } : {})
        };
        
        const expDocRef = await addDoc(collection(db, 'expenses'), newExpense);
        
        if (!isAdmin) {
          // Send notification ONLY to admins
          await addDoc(collection(db, 'notifications'), {
            type: 'expense',
            message: `💸 Dépense en attente de validation : ${formData.description} (${Number(formData.amount).toLocaleString()} FCFA) par ${user.username}`,
            timestamp: serverTimestamp(),
            readBy: [],
            targetRole: 'admin_only',
            expenseId: expDocRef.id,
            expenseData: {
              description: formData.description,
              amount: Number(formData.amount),
              category: formData.category,
              location: formData.location,
              recordedBy: user.username,
              recordedById: user.id
            }
          });
          toast.success("Dépense soumise pour validation par l'administration");
        } else {
           toast.success("Dépense enregistrée et validée");
        }

        logEvent(user, 'Dépense', `Nouvelle dépense enregistrée : ${formData.description} (${Number(formData.amount).toLocaleString()} FCFA) par ${user.username}.`);
      }
      setIsAdding(false);
      setEditingExpense(null);
      setFormData({ description: '', amount: '', category: 'Other', location: getDefaultLocation(user) });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'expenses');
    }
  };

  const executeDelete = async () => {
    if (!expenseToDelete) return;
    try {
      await deleteDoc(doc(db, 'expenses', expenseToDelete.id));
      logEvent(user, 'Dépense', `Dépense supprimée par ${user.username}.`);
      setExpenseToDelete(null);
      toast.success("Dépense supprimée avec succès.");
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'expenses');
    }
  };

  const executeClearAll = async () => {
    if (!isManagerOrAdmin) {
      toast.error("Seuls les Managers et Administrateurs peuvent effacer toutes les dépenses.");
      return;
    }
    if (clearAllConfirmText !== 'EFFACER') {
      toast.error("Code de confirmation incorrect.");
      return;
    }
    try {
      const batch = writeBatch(db);
      expenses.forEach((expense) => {
        batch.delete(doc(db, 'expenses', expense.id));
      });
      await batch.commit();
      toast.success("Toutes les dépenses ont été effacées avec succès.");
      logEvent(user, 'Dépenses', `Toutes les dépenses ont été effacées par ${user.username}.`);
      setIsClearingAll(false);
      setClearAllConfirmText('');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'expenses');
    }
  };

  const handleValidate = async (expense: Expense, status: 'Approved' | 'Rejected') => {
    if (!isAdmin) {
      toast.error("Seuls les administrateurs ont le droit de valider ou rejeter les dépenses.");
      return;
    }
    try {
      // 1. Update the expense status reliably
      await updateDoc(doc(db, 'expenses', expense.id), {
        status,
        validatedBy: user.username
      });

      // 2. Safely dismiss and delete any pending notification linked to this expense
      try {
        const notifSnap = await getDocs(collection(db, 'notifications'));
        const toDelete: any[] = [];
        notifSnap.docs.forEach(d => {
          const data = d.data();
          const matchesId = data.expenseId === expense.id;
          const matchesDesc = data.expenseData?.description?.toLowerCase().trim() === expense.description?.toLowerCase().trim() ||
            (data.message && data.message.toLowerCase().includes(expense.description?.toLowerCase().trim()));
          const isPendingNotif = data.type === 'expense' || 
            (data.message && data.message.toLowerCase().includes('en attente de validation') &&
             (data.message.toLowerCase().includes('dépense') || data.message.toLowerCase().includes('depense')));

          if (isPendingNotif && (matchesId || matchesDesc)) {
            toDelete.push(d.ref);
          }
        });

        if (toDelete.length > 0) {
          const b = writeBatch(db);
          toDelete.forEach(ref => b.delete(ref));
          await b.commit();
        }
      } catch (e) {
        console.warn("Notice syncing expense notification status:", e);
      }

      // 3. Safely notify ONLY the employee who recorded the expense (never send to the admin)
      if (expense.recordedById && expense.recordedById !== user.id) {
        try {
          await addDoc(collection(db, 'notifications'), {
            type: 'system',
            targetUserId: expense.recordedById,
            message: `Votre dépense "${expense.description}" a été ${status === 'Approved' ? 'validée' : 'rejetée'} par ${user.username}.`,
            timestamp: serverTimestamp(),
            readBy: [user.id],
            handled: true
          });
        } catch (e) {
          console.warn("Notice sending validation notification to recorder:", e);
        }
      }

      logEvent(user, 'Validation Dépense', `Dépense ${status === 'Approved' ? 'validée' : 'rejetée'} : ${expense.description} par ${user.username}.`);
      toast.success(`Dépense ${status === 'Approved' ? 'validée' : 'rejetée'} avec succès`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'expenses');
    }
  };

  const totalExpenses = expenses.filter(e => e.status !== 'Rejected').reduce((acc, curr) => acc + Number(curr.amount || 0), 0);

  const handleDownloadPDF = () => {
    setIsDownloading(true);
    try {
      const columns = ['Description', 'Catégorie', 'Montant (FCFA)', 'Date', 'Enregistré par', 'Statut', 'Validé par'];
      const rows = expenses.map(e => [
        e.description,
        e.category,
        Number(e.amount || 0).toLocaleString(),
        format(parseDate(e.timestamp), 'dd/MM/yyyy'),
        e.recordedBy,
        e.status || 'Approved',
        e.validatedBy || '-'
      ]);

      generatePDF({
        title: 'Historique des Dépenses',
        filename: 'Historique_Depenses',
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

  const getCategoryIcon = (category: Expense['category']) => {
    switch (category) {
      case 'Salaries': return <Briefcase className="w-4 h-4" />;
      case 'Utilities': return <Zap className="w-4 h-4" />;
      case 'Stock': return <Package className="w-4 h-4" />;
      case 'Maintenance': return <Wrench className="w-4 h-4" />;
      default: return <MoreHorizontal className="w-4 h-4" />;
    }
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'Pending':
        return <span className="flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-[8px] md:text-[10px] font-bold uppercase"><Clock className="w-3 h-3" /> En attente</span>;
      case 'Rejected':
        return <span className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-[8px] md:text-[10px] font-bold uppercase"><XCircle className="w-3 h-3" /> Rejetée</span>;
      case 'Approved':
      default:
        return <span className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-[8px] md:text-[10px] font-bold uppercase"><CheckCircle className="w-3 h-3" /> Validée</span>;
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[#2B2321] uppercase">Gestion des Dépenses</h2>
          <p className="text-xs text-[#2B2321]/60 mt-1">Registre des charges de fonctionnement et bons de sortie</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex bg-[#FDFBF7] border border-secondary/20 rounded-xl p-1">
            <button
              onClick={() => setGroupBy('day')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors ${groupBy === 'day' ? 'bg-primary text-white shadow-sm' : 'text-primary/60 hover:text-primary'}`}
            >
              Jour
            </button>
            <button
              onClick={() => setGroupBy('week')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors ${groupBy === 'week' ? 'bg-primary text-white shadow-sm' : 'text-primary/60 hover:text-primary'}`}
            >
              Semaine
            </button>
            <button
              onClick={() => setGroupBy('month')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors ${groupBy === 'month' ? 'bg-primary text-white shadow-sm' : 'text-primary/60 hover:text-primary'}`}
            >
              Mois
            </button>
          </div>
          <button 
            onClick={handleDownloadPDF}
            disabled={isDownloading || expenses.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-secondary/30 text-primary rounded-xl font-bold text-[10px] md:text-xs hover:bg-[#FDFBF7] transition-all disabled:opacity-50"
          >
            {isDownloading ? (
              <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            ) : (
              <FileText className="w-4 h-4" />
            )}
            PDF
          </button>
          <button 
            onClick={() => {
              setEditingExpense(null);
              setFormData({ description: '', amount: '', category: 'Other', location: getDefaultLocation(user) });
              setIsAdding(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl shadow-sm font-bold hover:bg-primary/90 transition-all text-[10px] md:text-xs"
          >
            <Plus className="w-4 h-4" /> Nouvelle Dépense
          </button>
          {isManagerOrAdmin && expenses.length > 0 && (
            <button 
              onClick={() => {
                setIsClearingAll(true);
                setClearAllConfirmText('');
              }}
              className="flex items-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 rounded-xl font-bold text-[10px] md:text-xs transition-colors"
              title="Effacer toutes les dépenses"
            >
              <Trash2 className="w-4 h-4" /> Effacer Tout
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-3 md:p-6 bg-white border border-secondary/30 rounded-3xl shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-red-50 text-red-500 rounded-lg">
              <TrendingDown className="w-5 h-5" />
            </div>
            <h3 className="text-[8px] md:text-[10px] font-bold uppercase tracking-widest text-primary/60">Total Dépenses</h3>
          </div>
          <p className="text-xl sm:text-3xl font-bold text-[#2B2321]">{totalExpenses.toLocaleString()} <span className="text-[10px] md:text-xs uppercase tracking-widest opacity-60">FCFA</span></p>
        </div>
      </div>

      <div className="bg-white border border-secondary/30 rounded-[32px] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#FDFBF7] border-b border-secondary/20">
                <th className="p-3 md:p-6 text-[8px] md:text-[10px] font-bold uppercase tracking-widest text-primary/60">Description</th>
                <th className="p-3 md:p-6 text-[8px] md:text-[10px] font-bold uppercase tracking-widest text-primary/60">Catégorie</th>
                <th className="p-3 md:p-6 text-[8px] md:text-[10px] font-bold uppercase tracking-widest text-primary/60">Montant</th>
                <th className="p-3 md:p-6 text-[8px] md:text-[10px] font-bold uppercase tracking-widest text-primary/60">Date</th>
                <th className="p-3 md:p-6 text-[8px] md:text-[10px] font-bold uppercase tracking-widest text-primary/60">Statut</th>
                <th className="p-3 md:p-6 text-[8px] md:text-[10px] font-bold uppercase tracking-widest text-primary/60">Par</th>
                <th className="p-3 md:p-6 text-[8px] md:text-[10px] font-bold uppercase tracking-widest text-primary/60">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary/10">
              {sortedGroupKeys.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-primary/40 font-bold uppercase tracking-widest">
                    Aucune dépense trouvée
                  </td>
                </tr>
              ) : (
                sortedGroupKeys.map(groupKey => {
                  const isExpanded = expandedGroups.includes(groupKey);
                  const groupExpenses = groupedExpenses[groupKey];
                  const groupTotal = groupExpenses.filter(e => e.status !== 'Rejected').reduce((sum, e) => sum + e.amount, 0);

                  let displayKey = groupKey;
                  if (groupBy === 'day' && groupKey !== 'Inconnu') {
                    try {
                      displayKey = format(new Date(groupKey), 'EEEE d MMMM yyyy', { locale: fr });
                    } catch (e) {}
                  } else if (groupBy === 'month' && groupKey !== 'Inconnu') {
                    displayKey = groupKey.charAt(0).toUpperCase() + groupKey.slice(1);
                  }

                  return (
                    <React.Fragment key={groupKey}>
                      <tr className="bg-primary/5 cursor-pointer hover:bg-primary/10 transition-colors" onClick={() => toggleGroup(groupKey)}>
                        <td colSpan={7} className="p-3 md:p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                                <Calendar className="w-4 h-4" />
                              </div>
                              <div>
                                <p className="font-bold text-[#2B2321] capitalize text-sm">{displayKey}</p>
                                <p className="text-[10px] text-primary/60 font-bold tracking-widest uppercase mt-0.5">
                                  {groupExpenses.length} dépense{groupExpenses.length > 1 ? 's' : ''}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="text-right hidden sm:block">
                                <p className="text-[10px] uppercase tracking-widest text-primary/60 font-bold">Total</p>
                                <p className="font-bold text-red-500">{groupTotal.toLocaleString()} FCFA</p>
                              </div>
                              <div className="text-primary/40">
                                {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && groupExpenses.map((expense) => (
                        <tr key={expense.id} className="hover:bg-[#FDFBF7]/50 transition-colors">
                          <td className="p-3 md:p-6">
                            <p className="font-bold text-[#2B2321]">{expense.description}</p>
                            <span className="inline-block mt-1 text-[9px] px-2 py-0.5 bg-secondary/15 text-primary/80 rounded-md font-bold uppercase tracking-wider">
                              📍 {expense.location || 'Réception'}
                            </span>
                          </td>
                          <td className="p-3 md:p-6">
                            <div className="flex items-center gap-2 px-3 py-1 bg-primary/5 text-primary rounded-full border border-primary/10 w-fit">
                              {getCategoryIcon(expense.category)}
                              <span className="text-[8px] md:text-[10px] font-bold uppercase tracking-widest">{expense.category}</span>
                            </div>
                          </td>
                          <td className="p-3 md:p-6">
                            <span className="font-bold text-red-500 text-base sm:text-lg">{Number(expense.amount || 0).toLocaleString()} FCFA</span>
                          </td>
                          <td className="p-3 md:p-6">
                            <span className="text-[10px] md:text-xs font-bold text-[#2B2321]">{format(parseDate(expense.timestamp), 'dd/MM/yyyy', { locale: fr })}</span>
                          </td>
                          <td className="p-3 md:p-6">
                            <div className="flex flex-col gap-1">
                              {getStatusBadge(expense.status)}
                              {expense.validatedBy && (
                                <span className="text-[9px] text-primary/60 italic">par {expense.validatedBy}</span>
                              )}
                            </div>
                          </td>
                          <td className="p-3 md:p-6">
                            <span className="text-[8px] md:text-[10px] font-bold uppercase tracking-widest text-primary/60">{expense.recordedBy}</span>
                          </td>
                          <td className="p-3 md:p-6">
                            <div className="flex gap-2">
                              {isAdmin && expense.status === 'Pending' && (
                                <>
                                  <button onClick={() => handleValidate(expense, 'Approved')} className="p-2 text-green-600 hover:bg-green-50 rounded-full" title="Valider">
                                    <CheckCircle className="w-4 h-4" />
                                  </button>
                                  <button onClick={() => handleValidate(expense, 'Rejected')} className="p-2 text-red-600 hover:bg-red-50 rounded-full" title="Rejeter">
                                    <XCircle className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                              {(isManagerOrAdmin || (user && user.id === expense.recordedById)) && (
                                <>
                                  <button onClick={() => {
                                    setEditingExpense(expense);
                                    setFormData({
                                      description: expense.description,
                                      amount: (expense.amount || '').toString(),
                                      category: expense.category,
                                      location: expense.location || 'Réception'
                                    });
                                    setIsAdding(true);
                                  }} className="p-2 text-blue-600 hover:bg-blue-50 rounded-full" title="Modifier">
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button onClick={() => setExpenseToDelete(expense)} className="p-2 text-red-600 hover:bg-red-50 rounded-full" title="Supprimer">
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2B2321]/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-white border border-secondary/30 shadow-2xl rounded-3xl p-8"
            >
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-xl font-bold tracking-tight uppercase text-[#2B2321]">{editingExpense ? 'Modifier Dépense' : 'Nouvelle Dépense'}</h3>
                <button onClick={() => { setIsAdding(false); setEditingExpense(null); }} className="p-2 hover:bg-[#FDFBF7] text-primary rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-1">
                  <label className="text-[8px] md:text-[10px] font-bold uppercase tracking-widest text-primary/60">Description</label>
                  <input 
                    className="w-full p-4 border border-secondary/30 rounded-2xl outline-none font-bold focus:border-primary"
                    value={formData.description}
                    onChange={e => setFormData({...formData, description: e.target.value})}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[8px] md:text-[10px] font-bold uppercase tracking-widest text-primary/60">Montant (FCFA)</label>
                  <input 
                    type="number"
                    className="w-full p-4 border border-secondary/30 rounded-2xl outline-none font-bold focus:border-primary"
                    value={formData.amount}
                    onChange={e => setFormData({...formData, amount: e.target.value})}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[8px] md:text-[10px] font-bold uppercase tracking-widest text-primary/60">Catégorie</label>
                  <select 
                    className="w-full p-4 border border-secondary/30 rounded-2xl outline-none font-bold focus:border-primary"
                    value={formData.category}
                    onChange={e => setFormData({...formData, category: e.target.value as Expense['category']})}
                  >
                    <option value="Salaries">Salaires</option>
                    <option value="Utilities">Factures (Eau/Elec)</option>
                    <option value="Stock">Achats Stock</option>
                    <option value="Maintenance">Maintenance</option>
                    <option value="Other">Autre</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[8px] md:text-[10px] font-bold uppercase tracking-widest text-primary/60">Point de Vente / Affectation</label>
                  <select 
                    className="w-full p-4 border border-secondary/30 rounded-2xl outline-none font-bold focus:border-primary"
                    value={formData.location}
                    onChange={e => setFormData({...formData, location: e.target.value})}
                  >
                    <option value="Réception">Réception (Direction & Caisse Principale)</option>
                  </select>
                </div>
                <button type="submit" className="w-full py-4 bg-primary text-white rounded-2xl shadow-lg shadow-primary/20 font-bold uppercase tracking-widest text-sm hover:bg-primary/90 transition-all">
                  {editingExpense ? 'Sauvegarder' : 'Enregistrer la dépense'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation modal for single expense deletion */}
      <AnimatePresence>
        {expenseToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2B2321]/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-white border border-secondary/30 shadow-2xl rounded-3xl p-8"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold tracking-tight uppercase text-red-600">Supprimer la dépense</h3>
                <button onClick={() => setExpenseToDelete(null)} className="p-2 hover:bg-[#FDFBF7] text-primary rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-6">
                <p className="text-sm font-bold text-[#2B2321]">
                  Voulez-vous vraiment supprimer la dépense <span className="text-red-600">"{expenseToDelete.description}"</span> ? Cette action est définitive et irréversible.
                </p>
                <div className="flex gap-4">
                  <button 
                    onClick={() => setExpenseToDelete(null)}
                    className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl font-bold uppercase tracking-widest text-[10px] md:text-xs transition-colors"
                  >
                    Annuler
                  </button>
                  <button 
                    onClick={executeDelete}
                    className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-bold uppercase tracking-widest text-[10px] md:text-xs transition-colors shadow-lg shadow-red-600/20"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation modal for clearing all expenses */}
      <AnimatePresence>
        {isClearingAll && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2B2321]/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-white border border-secondary/30 shadow-2xl rounded-3xl p-8"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold tracking-tight uppercase text-red-600">Effacer toutes les dépenses</h3>
                <button onClick={() => { setIsClearingAll(false); setClearAllConfirmText(''); }} className="p-2 hover:bg-[#FDFBF7] text-primary rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-6">
                <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-[10px] md:text-xs font-semibold space-y-1">
                  <p className="font-bold">⚠️ ATTENTION : Action Irréversible !</p>
                  <p>Cette action va supprimer TOUTES les dépenses de la base de données définitivement.</p>
                </div>
                <div className="space-y-2">
                  <label className="text-[8px] md:text-[10px] font-bold uppercase tracking-widest text-primary/60">
                    Saisir "EFFACER" pour valider la suppression totale
                  </label>
                  <input 
                    type="text"
                    placeholder="Saisir en majuscules..."
                    className="w-full p-4 border border-secondary/30 rounded-2xl outline-none font-bold focus:border-red-500 transition-all text-center uppercase"
                    value={clearAllConfirmText}
                    onChange={e => setClearAllConfirmText(e.target.value)}
                  />
                </div>
                <div className="flex gap-4">
                  <button 
                    onClick={() => { setIsClearingAll(false); setClearAllConfirmText(''); }}
                    className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl font-bold uppercase tracking-widest text-[10px] md:text-xs transition-colors"
                  >
                    Annuler
                  </button>
                  <button 
                    onClick={executeClearAll}
                    disabled={clearAllConfirmText !== 'EFFACER'}
                    className="flex-1 py-3 bg-red-600 hover:bg-red-700 disabled:bg-red-300 disabled:cursor-not-allowed text-white rounded-2xl font-bold uppercase tracking-widest text-[10px] md:text-xs transition-colors shadow-lg shadow-red-600/20"
                  >
                    Effacer Tout
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
