import React, { useState, useEffect } from 'react';
import { Guest, AppSettings, UserProfile } from '../types';
import { Search, UserPlus, Phone, Mail, CreditCard, History, Edit2, Trash2, X, Check, Printer, ChevronDown, ChevronUp, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, OperationType, handleFirestoreError } from '../lib/utils';
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, setDoc, doc, deleteDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Receipt } from './Receipt';
import { toast } from 'sonner';

export const GuestManagement = ({ isAdmin, user, settings }: { isAdmin: boolean, user?: UserProfile | null, settings?: AppSettings | null }) => {
  const isManagerOrAdmin = user ? (user.role === 'admin' || user.role === 'manager' || user.email?.toLowerCase() === 'cyber.kan587@gmail.com') : isAdmin;
  const [guests, setGuests] = useState<Guest[]>([]);
  const [search, setSearch] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingGuest, setEditingGuest] = useState<Guest | null>(null);
  const [formData, setFormData] = useState({ name: '', phone: '', idNumber: '', email: '', preferences: '' });
  const [printingGuest, setPrintingGuest] = useState<Guest | null>(null);
  const [guestToDelete, setGuestToDelete] = useState<Guest | null>(null);
  const [isClearingAll, setIsClearingAll] = useState(false);
  const [clearAllConfirmText, setClearAllConfirmText] = useState('');
  const [groupBy, setGroupBy] = useState<'day' | 'week' | 'month'>('day');
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'guests'));
    const unsub = onSnapshot(q, (snap) => {
      setGuests(snap.docs.map(d => ({ id: d.id, ...d.data() } as Guest)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'guests'));
    return () => unsub();
  }, []);

  const filteredGuests = guests
    .filter(g => g.name.toLowerCase().includes(search.toLowerCase()) || g.phone.includes(search))
    .sort((a, b) => {
      const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
      const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
      if (timeA !== timeB) {
        return timeB - timeA;
      }
      return a.name.localeCompare(b.name);
    });

  const toggleGroup = (groupKey: string) => {
    setExpandedGroups(prev => prev.includes(groupKey) ? prev.filter(k => k !== groupKey) : [...prev, groupKey]);
  };

  const groupedGuests = filteredGuests.reduce((acc, guest) => {
    if (!guest.createdAt?.toDate) {
      if (!acc['Inconnu']) acc['Inconnu'] = [];
      acc['Inconnu'].push(guest);
      return acc;
    }
    const date = guest.createdAt.toDate();
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
    acc[key].push(guest);
    return acc;
  }, {} as Record<string, Guest[]>);

  const sortedGroupKeys = Object.keys(groupedGuests).sort((a, b) => b.localeCompare(a));
  
  useEffect(() => {
    if (sortedGroupKeys.length > 0 && expandedGroups.length === 0) {
      setExpandedGroups([sortedGroupKeys[0]]);
    }
  }, [sortedGroupKeys, expandedGroups.length]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingGuest) {
        await setDoc(doc(db, 'guests', editingGuest.id), formData, { merge: true });
      } else {
        await addDoc(collection(db, 'guests'), {
          ...formData,
          totalStays: 0,
          lastStay: null,
          createdAt: serverTimestamp()
        });
      }
      setIsAdding(false);
      setEditingGuest(null);
      setFormData({ name: '', phone: '', idNumber: '', email: '', preferences: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'guests');
    }
  };

  const executeDelete = async () => {
    if (!guestToDelete) return;
    try {
      await deleteDoc(doc(db, 'guests', guestToDelete.id));
      toast.success("Client supprimé avec succès.");
      setGuestToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'guests');
    }
  };

  const executeClearAll = async () => {
    if (!isManagerOrAdmin) {
      toast.error("Seuls les Managers et Administrateurs peuvent effacer la base clients.");
      return;
    }
    if (clearAllConfirmText !== 'EFFACER') {
      toast.error("Code de confirmation incorrect.");
      return;
    }
    try {
      const batch = writeBatch(db);
      guests.forEach((guest) => {
        batch.delete(doc(db, 'guests', guest.id));
      });
      await batch.commit();
      toast.success("Tous les clients ont été effacés avec succès.");
      setIsClearingAll(false);
      setClearAllConfirmText('');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'guests');
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[#2B2321] uppercase">CRM Clients</h2>
          <p className="text-xs text-[#2B2321]/60 mt-1">Base de données centralisée et historique des résidents</p>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl shadow-sm font-bold hover:bg-primary/90 transition-all text-[10px] md:text-xs"
          >
            <UserPlus className="w-4 h-4" /> Nouveau Client
          </button>
          {isManagerOrAdmin && guests.length > 0 && (
            <button 
              onClick={() => {
                setIsClearingAll(true);
                setClearAllConfirmText('');
              }}
              className="flex items-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 rounded-xl font-bold text-[10px] md:text-xs transition-colors"
              title="Effacer tous les clients"
            >
              <Trash2 className="w-4 h-4" /> Effacer Tout
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
        <div className="relative max-w-md w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-primary/40" />
          <input 
            placeholder="Rechercher par nom, téléphone..."
            className="w-full pl-10 pr-4 py-3 bg-white border border-secondary/30 rounded-2xl outline-none font-bold focus:border-primary transition-all"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex bg-[#FDFBF7] border border-secondary/20 rounded-xl p-1">
          <button
            onClick={() => setGroupBy('day')}
            className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors ${groupBy === 'day' ? 'bg-primary text-white shadow-sm' : 'text-primary/60 hover:text-primary'}`}
          >
            Jour
          </button>
          <button
            onClick={() => setGroupBy('week')}
            className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors ${groupBy === 'week' ? 'bg-primary text-white shadow-sm' : 'text-primary/60 hover:text-primary'}`}
          >
            Semaine
          </button>
          <button
            onClick={() => setGroupBy('month')}
            className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors ${groupBy === 'month' ? 'bg-primary text-white shadow-sm' : 'text-primary/60 hover:text-primary'}`}
          >
            Mois
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {sortedGroupKeys.length === 0 ? (
          <p className="text-center py-8 text-primary/40 font-bold uppercase tracking-widest">
            Aucun client trouvé
          </p>
        ) : (
          sortedGroupKeys.map(groupKey => {
            const isExpanded = expandedGroups.includes(groupKey);
            const groupItems = groupedGuests[groupKey];
            
            let displayKey = groupKey;
            if (groupBy === 'day' && groupKey !== 'Inconnu') {
              try {
                displayKey = format(new Date(groupKey), 'EEEE d MMMM yyyy', { locale: fr });
              } catch (e) {}
            } else if (groupBy === 'month' && groupKey !== 'Inconnu') {
              displayKey = groupKey.charAt(0).toUpperCase() + groupKey.slice(1);
            }

            return (
              <div key={groupKey} className="space-y-4">
                <button
                  onClick={() => toggleGroup(groupKey)}
                  className="w-full flex items-center justify-between p-4 bg-white border border-secondary/20 rounded-2xl hover:bg-primary/5 transition-colors shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                      <Calendar className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-[#2B2321] capitalize text-sm">{displayKey}</p>
                      <p className="text-[10px] text-primary/60 font-bold tracking-widest uppercase mt-0.5">
                        {groupItems.length} client{groupItems.length > 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <div className="text-primary/40">
                    {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </div>
                </button>
                
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 pt-2 pb-2">
                        {groupItems.map(guest => (
                          <motion.div 
                            layout
                            key={guest.id} 
                            className="p-2 sm:p-5 bg-white border border-secondary/30 rounded-2xl sm:rounded-3xl shadow-sm hover:shadow-xl transition-all"
                          >
                            <div className="flex justify-between items-start mb-3 sm:mb-4">
                              <div>
                                <h3 className="text-xs sm:text-lg font-bold text-[#2B2321]">{guest.name}</h3>
                                <p className="text-[7.5px] sm:text-[10px] font-bold uppercase tracking-widest text-primary/60">Client #{guest.id.slice(-4)}</p>
                              </div>
                              <div className="flex gap-1 sm:gap-2">
                                <button onClick={() => {
                                  setEditingGuest(guest);
                                  setFormData({ name: guest.name, phone: guest.phone, idNumber: guest.idNumber, email: guest.email || '', preferences: guest.preferences || '' });
                                  setIsAdding(true);
                                }} className="p-1 sm:p-2 text-primary hover:bg-primary/10 rounded-full">
                                  <Edit2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                </button>
                                <button 
                                  onClick={() => setPrintingGuest(guest)}
                                  className="p-1 sm:p-2 text-primary hover:bg-primary/10 rounded-full"
                                  title="Imprimer la fiche client"
                                >
                                  <Printer className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                </button>
                                {isAdmin && (
                                  <button onClick={() => setGuestToDelete(guest)} className="p-1 sm:p-2 text-red-500 hover:bg-red-50 rounded-full">
                                    <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                  </button>
                                )}
                              </div>
                            </div>

                            <div className="space-y-3 mb-6">
                              <div className="flex items-center gap-3 text-[10px] md:text-xs md:text-sm">
                                <Phone className="w-4 h-4 text-primary/40" />
                                <span className="font-bold text-[#2B2321]">{guest.phone}</span>
                              </div>
                              {guest.email && (
                                <div className="flex items-center gap-3 text-[10px] md:text-xs md:text-sm">
                                  <Mail className="w-4 h-4 text-primary/40" />
                                  <span className="font-bold text-[#2B2321]">{guest.email}</span>
                                </div>
                              )}
                              <div className="flex items-center gap-3 text-[10px] md:text-xs md:text-sm">
                                <CreditCard className="w-4 h-4 text-primary/40" />
                                <span className="font-bold text-[#2B2321]">{guest.idNumber}</span>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 sm:gap-4 pt-3 sm:pt-4 border-t border-secondary/10">
                              <div className="text-center">
                                <p className="text-[7.5px] sm:text-[10px] font-bold uppercase tracking-widest text-primary/60">Séjours</p>
                                <p className="text-sm sm:text-xl font-bold text-primary">{guest.totalStays || 0}</p>
                              </div>
                              <div className="text-center">
                                <p className="text-[7.5px] sm:text-[10px] font-bold uppercase tracking-widest text-primary/60">Dernier</p>
                                <p className="text-[7.5px] sm:text-[10px] font-bold text-[#2B2321]">{guest.lastStay ? format(guest.lastStay.toDate(), 'dd/MM/yy') : '-'}</p>
                              </div>
                            </div>

                            {guest.preferences && (
                              <div className="mt-4 p-3 bg-[#FDFBF7] rounded-xl border border-secondary/20">
                                <p className="text-[9px] font-bold uppercase tracking-widest text-primary/60 mb-1">Préférences</p>
                                <p className="text-[10px] md:text-xs font-bold text-[#2B2321] italic">"{guest.preferences}"</p>
                              </div>
                            )}
                          </motion.div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })
        )}
      </div>

      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2B2321]/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-white border border-secondary/30 shadow-2xl rounded-2xl p-4 md:p-8"
            >
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-xl font-bold tracking-tight uppercase text-[#2B2321]">{editingGuest ? 'Modifier Client' : 'Nouveau Client'}</h3>
                <button onClick={() => { setIsAdding(false); setEditingGuest(null); }} className="p-2 hover:bg-[#FDFBF7] text-primary rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-primary/60">Nom Complet</label>
                  <input 
                    className="w-full p-4 border border-secondary/30 rounded-2xl outline-none font-bold focus:border-primary"
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-primary/60">Téléphone</label>
                    <input 
                      className="w-full p-4 border border-secondary/30 rounded-2xl outline-none font-bold focus:border-primary"
                      value={formData.phone}
                      onChange={e => setFormData({...formData, phone: e.target.value})}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-primary/60">N° Pièce d'identité</label>
                    <input 
                      className="w-full p-4 border border-secondary/30 rounded-2xl outline-none font-bold focus:border-primary"
                      value={formData.idNumber}
                      onChange={e => setFormData({...formData, idNumber: e.target.value})}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-primary/60">Email</label>
                  <input 
                    type="email"
                    className="w-full p-4 border border-secondary/30 rounded-2xl outline-none font-bold focus:border-primary"
                    value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-primary/60">Préférences / Notes</label>
                  <textarea 
                    className="w-full p-4 border border-secondary/30 rounded-2xl outline-none font-bold focus:border-primary h-24 resize-none"
                    value={formData.preferences}
                    onChange={e => setFormData({...formData, preferences: e.target.value})}
                  />
                </div>
                <button type="submit" className="w-full py-4 bg-primary text-white rounded-2xl shadow-lg shadow-primary/20 font-bold uppercase tracking-widest text-[10px] md:text-xs md:text-sm hover:bg-primary/90 transition-all">
                  {editingGuest ? 'Sauvegarder' : 'Créer le client'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Guest Info Printing Overlay */}
      {printingGuest && (
        <Receipt 
          sale={{ 
            items: [
              { productName: 'Nom', quantity: 1, price: 0 },
              { productName: printingGuest.name, quantity: '', price: 0 },
              { productName: 'Téléphone', quantity: 1, price: 0 },
              { productName: printingGuest.phone, quantity: '', price: 0 },
              { productName: 'N° Pièce', quantity: 1, price: 0 },
              { productName: printingGuest.idNumber, quantity: '', price: 0 },
              { productName: 'Email', quantity: 1, price: 0 },
              { productName: printingGuest.email || 'N/A', quantity: '', price: 0 },
              { productName: 'Préférences', quantity: 1, price: 0 },
              { productName: printingGuest.preferences || 'N/A', quantity: '', price: 0 }
            ],
            totalPrice: 0
          }} 
          onClose={() => setPrintingGuest(null)} 
          settings={settings} 
          type="order"
        />
      )}

      {/* Confirmation modal for single client deletion */}
      <AnimatePresence>
        {guestToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2B2321]/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-white border border-secondary/30 shadow-2xl rounded-2xl p-4 md:p-8"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold tracking-tight uppercase text-red-600">Confirmer la suppression</h3>
                <button onClick={() => setGuestToDelete(null)} className="p-2 hover:bg-[#FDFBF7] text-primary rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-6">
                <p className="text-[10px] md:text-xs md:text-sm font-bold text-[#2B2321]">
                  Voulez-vous vraiment supprimer le client <span className="text-red-600">"{guestToDelete.name}"</span> ? Cette action est définitive et irréversible.
                </p>
                <div className="flex gap-4">
                  <button 
                    onClick={() => setGuestToDelete(null)}
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

      {/* Confirmation modal for clearing all clients */}
      <AnimatePresence>
        {isClearingAll && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2B2321]/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-white border border-secondary/30 shadow-2xl rounded-2xl p-4 md:p-8"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold tracking-tight uppercase text-red-600">Effacer tous les clients</h3>
                <button onClick={() => { setIsClearingAll(false); setClearAllConfirmText(''); }} className="p-2 hover:bg-[#FDFBF7] text-primary rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-6">
                <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-[10px] md:text-xs font-semibold space-y-1">
                  <p className="font-bold">⚠️ ATTENTION : Action Irréversible !</p>
                  <p>Cette action va supprimer TOUS les clients de la base de données définitivement.</p>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-primary/60">
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
