import React, { useState, useEffect } from 'react';
import { Hall, HallType, UserProfile, Guest } from '../types';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { 
  LayoutGrid, Plus, Edit2, Trash2, CheckCircle, XCircle, 
  Clock, User, DollarSign, Search, Filter, MoreVertical,
  Activity, Sparkles, MapPin, Calendar, Info, AlertCircle, ShoppingCart
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { handleFirestoreError, OperationType, cn, sendAppNotification } from '../lib/utils';

export const HallManagement = ({ user, onSell }: { user: UserProfile, onSell?: () => void }) => {
  const [halls, setHalls] = useState<Hall[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingHall, setEditingHall] = useState<Hall | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<HallType | 'All'>('All');
  const [filterStatus, setFilterStatus] = useState<Hall['status'] | 'All'>('All');

  const [formData, setFormData] = useState({ 
    name: '', 
    type: 'Salle de Fête' as HallType, 
    price: '', 
    status: 'Available' as Hall['status'] 
  });

  const [editFormData, setEditFormData] = useState({ name: '', price: '' });
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [hallToDelete, setHallToDelete] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'halls'), orderBy('name', 'asc'));
    const unsub = onSnapshot(q, (snapshot) => {
      setHalls(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Hall)));
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'halls'));
    return unsub;
  }, []);

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleAddHall = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'halls'), {
        ...formData,
        price: Number(formData.price),
        currentGuestId: null,
        currentGuestName: null,
        checkInDate: null,
        expectedCheckOutDate: null
      });
      setIsAdding(false);
      setFormData({ name: '', type: 'Salle de Fête', price: '', status: 'Available' });
      showSuccess('Salle créée avec succès !');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'halls');
    }
  };

  const handleUpdateHall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingHall) return;
    try {
      await updateDoc(doc(db, 'halls', editingHall.id), {
        name: editFormData.name,
        price: Number(editFormData.price)
      });
      setEditingHall(null);
      showSuccess('Salle mise à jour !');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'halls');
    }
  };

  const handleDeleteHall = async () => {
    if (!hallToDelete) return;
    try {
      await deleteDoc(doc(db, 'halls', hallToDelete));
      setHallToDelete(null);
      showSuccess('Salle supprimée.');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'halls');
    }
  };

  const filteredHalls = halls.filter(hall => {
    const matchesSearch = hall.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'All' || hall.type === filterType;
    const matchesStatus = filterStatus === 'All' || hall.status === filterStatus;
    return matchesSearch && matchesType && matchesStatus;
  });

  const getStatusColor = (status: Hall['status']) => {
    switch (status) {
      case 'Available': return 'bg-green-50 text-green-600 border-green-100';
      case 'Occupied': return 'bg-primary/10 text-primary border-primary/20';
      case 'Cleaning': return 'bg-orange-50 text-orange-600 border-orange-100';
      case 'Maintenance': return 'bg-red-50 text-red-600 border-red-100';
      default: return 'bg-gray-50 text-gray-600 border-gray-100';
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-64 space-y-4">
      <Activity className="w-12 h-12 animate-spin text-primary" />
      <p className="text-primary/60 font-bold uppercase tracking-widest text-xs">Chargement des salles...</p>
    </div>
  );

  return (
    <div className="space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[#2B2321] uppercase">Gestion des Salles</h2>
          <p className="text-xs font-bold text-primary/60 uppercase tracking-widest mt-1">Fête, Hammam, Massage & Soins</p>
        </div>
        {['admin', 'manager', 'receptionist'].includes(user.role) && (
          <button 
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-2xl font-bold text-sm hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
          >
            <Plus className="w-5 h-5" />
            Ajouter une Salle
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-2 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-primary/40" />
          <input 
            type="text"
            placeholder="Rechercher une salle..."
            className="w-full pl-12 pr-4 py-4 bg-white border border-secondary/30 rounded-2xl outline-none font-bold tracking-tight focus:border-primary transition-all text-[#2B2321]"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <select 
          className="p-4 bg-white border border-secondary/30 rounded-2xl outline-none font-bold tracking-tight text-xs uppercase text-primary/60"
          value={filterType}
          onChange={e => setFilterType(e.target.value as HallType | 'All')}
        >
          <option value="All">Tous les types</option>
          <option value="Salle de Fête">Salle de Fête</option>
          <option value="Salle Hammam">Salle Hammam</option>
          <option value="Salle de Massage">Salle de Massage</option>
          <option value="Salle de Pied">Salle de Pied</option>
        </select>
        <select 
          className="p-4 bg-white border border-secondary/30 rounded-2xl outline-none font-bold tracking-tight text-xs uppercase text-primary/60"
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value as Hall['status'] | 'All')}
        >
          <option value="All">Tous les statuts</option>
          <option value="Available">Disponible</option>
          <option value="Occupied">Occupée</option>
          <option value="Maintenance">Maintenance</option>
        </select>
      </div>

      {/* Hall Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
        <AnimatePresence mode="popLayout">
          {filteredHalls.map((hall) => (
            <motion.div
              key={hall.id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="group bg-white border border-secondary/30 rounded-xl sm:rounded-[2.5rem] p-3 sm:p-6 hover:shadow-2xl hover:shadow-primary/5 transition-all relative overflow-hidden flex flex-col justify-between"
            >
              <div>
                <div className="flex justify-between items-start mb-2 sm:mb-6">
                  <div className={`px-2 py-0.5 sm:px-4 sm:py-1.5 rounded-full text-[8px] sm:text-[10px] font-bold uppercase tracking-widest border ${getStatusColor(hall.status)}`}>
                    {hall.status === 'Available' ? 'Dispo' : hall.status === 'Occupied' ? 'Occ' : hall.status === 'Cleaning' ? 'Nettoy' : 'Maint'}
                  </div>
                  {['admin', 'manager', 'receptionist'].includes(user.role) && (
                    <div className="flex gap-0.5 sm:gap-2">
                      <button 
                        onClick={() => {
                          setEditingHall(hall);
                          setEditFormData({ name: hall.name, price: hall.price.toString() });
                        }}
                        className="p-1 sm:p-2 text-primary/40 hover:text-primary hover:bg-primary/5 rounded-xl transition-all"
                      >
                        <Edit2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </button>
                      <button 
                        onClick={() => setHallToDelete(hall.id)}
                        className="p-1 sm:p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="space-y-0.5 sm:space-y-1 mb-2 sm:mb-6">
                  <h3 className="text-base sm:text-2xl font-bold tracking-tighter text-[#2B2321] line-clamp-1">{hall.name}</h3>
                  <p className="text-[8px] sm:text-[10px] font-bold uppercase tracking-widest text-primary/40 truncate">{hall.type}</p>
                </div>

                <div className="flex items-center justify-between pt-2 sm:pt-6 border-t border-secondary/10">
                  <div className="flex items-center gap-1 sm:gap-2">
                    <DollarSign className="w-3 h-3 sm:w-4 sm:h-4 text-primary/40" />
                    <span className="text-xs sm:text-lg font-bold text-[#2B2321]">{hall.price.toLocaleString()}</span>
                    <span className="text-[8px] sm:text-[10px] font-bold text-primary/40 uppercase">FCFA</span>
                  </div>
                </div>
              </div>

              <div>
                <div className="mt-3 sm:mt-8 pt-2 sm:pt-6 border-t border-secondary/20 flex gap-1.5 sm:gap-3">
                  {hall.status === 'Available' && onSell && (
                    <button 
                      onClick={onSell}
                      className="flex-1 py-1.5 sm:py-3 bg-primary text-white rounded-lg sm:rounded-2xl font-bold text-[8px] sm:text-[10px] uppercase tracking-widest hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-1.5 truncate px-1"
                    >
                      <ShoppingCart className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                      Vendre
                    </button>
                  )}
                  <button 
                    onClick={() => {
                      let nextStatus: Hall['status'] = 'Available';
                      let updates: any = {};

                      if (hall.status === 'Available') {
                        nextStatus = 'Occupied';
                      } else if (hall.status === 'Occupied') {
                        nextStatus = 'Cleaning';
                        updates = {
                          currentGuestId: null,
                          currentGuestName: null,
                          checkInDate: null,
                          expectedCheckOutDate: null
                        };
                      } else if (hall.status === 'Cleaning') {
                        nextStatus = 'Available';
                        sendAppNotification(
                          'info',
                          `La salle "${hall.name}" est maintenant propre et disponible.`,
                          'Résidence HQ'
                        );
                      } else {
                        nextStatus = 'Available';
                      }

                      updateDoc(doc(db, 'halls', hall.id), { ...updates, status: nextStatus });
                    }}
                    className={cn(
                      "flex-1 py-1.5 sm:py-3 rounded-lg sm:rounded-2xl font-bold text-[8px] sm:text-[10px] uppercase tracking-widest transition-all border truncate px-1",
                      hall.status === 'Available' ? "bg-white text-primary border-primary/20 hover:bg-primary/5" : 
                      hall.status === 'Cleaning' ? "bg-orange-500 text-white border-orange-500 hover:bg-orange-600" :
                      "bg-white text-[#2B2321]/60 border-secondary/30 hover:bg-secondary/10"
                    )}
                  >
                    {hall.status === 'Available' ? 'Occuper' : hall.status === 'Occupied' ? 'Libérer' : hall.status === 'Cleaning' ? 'Terminer' : 'Réparer'}
                  </button>
                </div>

                {hall.status === 'Occupied' && (
                  <div className="mt-2 p-2 bg-primary/5 rounded-lg space-y-1">
                    <div className="flex items-center gap-1.5 text-[10px] sm:text-xs font-bold text-primary truncate">
                      <User className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                      {hall.currentGuestName}
                    </div>
                    {hall.checkInDate && (
                      <div className="flex items-center gap-1.5 text-[8px] sm:text-[10px] font-bold text-primary/60">
                        <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                        De {format(hall.checkInDate.toDate(), 'HH:mm')}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Add Hall Modal */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2B2321]/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-lg rounded-[3rem] p-8 md:p-12 shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-8">
                <button onClick={() => setIsAdding(false)} className="p-3 hover:bg-secondary/20 rounded-2xl transition-all">
                  <XCircle className="w-6 h-6 text-primary/40" />
                </button>
              </div>

              <div className="mb-10">
                <h3 className="text-3xl font-bold tracking-tighter text-[#2B2321] uppercase">Nouvelle Salle</h3>
                <p className="text-xs font-bold text-primary/60 uppercase tracking-widest mt-2">Ajouter un espace spécialisé</p>
              </div>

              <form onSubmit={handleAddHall} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-primary/60 ml-4">Nom de la Salle</label>
                  <input 
                    required
                    className="w-full p-4 border border-secondary/30 rounded-2xl outline-none font-bold tracking-tight focus:bg-[#FDFBF7] focus:border-primary transition-all text-[#2B2321]"
                    placeholder="Ex: Salle de Fête Royale"
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-primary/60 ml-4">Type</label>
                  <select 
                    className="w-full p-4 border border-secondary/30 rounded-2xl outline-none font-bold tracking-tight focus:bg-[#FDFBF7] focus:border-primary transition-all text-[#2B2321] appearance-none"
                    value={formData.type}
                    onChange={e => setFormData({...formData, type: e.target.value as HallType})}
                  >
                    <option value="Salle de Fête">Salle de Fête</option>
                    <option value="Salle Hammam">Salle Hammam</option>
                    <option value="Salle de Massage">Salle de Massage</option>
                    <option value="Salle de Pied">Salle de Pied</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-primary/60 ml-4">Prix par Séance/Heure (FCFA)</label>
                  <input 
                    required
                    type="number"
                    className="w-full p-4 border border-secondary/30 rounded-2xl outline-none font-bold tracking-tight focus:bg-[#FDFBF7] focus:border-primary transition-all text-[#2B2321]"
                    placeholder="50000"
                    value={formData.price}
                    onChange={e => setFormData({...formData, price: e.target.value})}
                  />
                </div>
                <button 
                  type="submit"
                  className="w-full py-5 bg-primary text-white rounded-[2rem] font-bold text-sm hover:bg-primary/90 transition-all shadow-xl shadow-primary/20 mt-4"
                >
                  Créer la Salle
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Hall Modal */}
      <AnimatePresence>
        {editingHall && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2B2321]/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-lg rounded-[3rem] p-8 md:p-12 shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-8">
                <button onClick={() => setEditingHall(null)} className="p-3 hover:bg-secondary/20 rounded-2xl transition-all">
                  <XCircle className="w-6 h-6 text-primary/40" />
                </button>
              </div>

              <div className="mb-10">
                <h3 className="text-3xl font-bold tracking-tighter text-[#2B2321] uppercase">Modifier la Salle</h3>
                <p className="text-xs font-bold text-primary/60 uppercase tracking-widest mt-2">{editingHall.type}</p>
              </div>

              <form onSubmit={handleUpdateHall} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-primary/60 ml-4">Nom de la Salle</label>
                  <input 
                    required
                    className="w-full p-4 border border-secondary/30 rounded-2xl outline-none font-bold tracking-tight focus:bg-[#FDFBF7] focus:border-primary transition-all text-[#2B2321]"
                    value={editFormData.name}
                    onChange={e => setEditFormData({...editFormData, name: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-primary/60 ml-4">Prix (FCFA)</label>
                  <input 
                    required
                    type="number"
                    className="w-full p-4 border border-secondary/30 rounded-2xl outline-none font-bold tracking-tight focus:bg-[#FDFBF7] focus:border-primary transition-all text-[#2B2321]"
                    value={editFormData.price}
                    onChange={e => setEditFormData({...editFormData, price: e.target.value})}
                  />
                </div>
                <button 
                  type="submit"
                  className="w-full py-5 bg-primary text-white rounded-[2rem] font-bold text-sm hover:bg-primary/90 transition-all shadow-xl shadow-primary/20 mt-4"
                >
                  Mettre à jour
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {hallToDelete && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-[#2B2321]/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl text-center"
            >
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertCircle className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="text-xl font-bold text-[#2B2321] mb-2">Confirmer la suppression</h3>
              <p className="text-sm text-primary/60 mb-8">Voulez-vous vraiment supprimer cette salle ? Cette action est irréversible.</p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setHallToDelete(null)}
                  className="flex-1 py-4 bg-secondary/20 text-[#2B2321] rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-secondary/30 transition-all"
                >
                  Annuler
                </button>
                <button 
                  onClick={handleDeleteHall}
                  className="flex-1 py-4 bg-red-500 text-white rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-red-600 transition-all shadow-lg shadow-red-500/20"
                >
                  Supprimer
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {hallToDelete && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-[#2B2321]/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl text-center"
            >
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertCircle className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="text-xl font-bold text-[#2B2321] mb-2">Confirmer la suppression</h3>
              <p className="text-sm text-primary/60 mb-8">Voulez-vous vraiment supprimer cette salle ? Cette action est irréversible.</p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setHallToDelete(null)}
                  className="flex-1 py-4 bg-secondary/20 text-[#2B2321] rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-secondary/30 transition-all"
                >
                  Annuler
                </button>
                <button 
                  onClick={handleDeleteHall}
                  className="flex-1 py-4 bg-red-500 text-white rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-red-600 transition-all shadow-lg shadow-red-500/20"
                >
                  Supprimer
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Success Message */}
      <AnimatePresence>
        {successMessage && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 px-8 py-4 bg-green-600 text-white rounded-2xl font-bold text-sm shadow-2xl flex items-center gap-3"
          >
            <CheckCircle className="w-5 h-5" />
            {successMessage}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
