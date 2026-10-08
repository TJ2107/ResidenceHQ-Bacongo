import React, { useState, useEffect, useRef } from 'react';
import { collection, query, onSnapshot, addDoc, updateDoc, doc, serverTimestamp, orderBy, where, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { Room, CleaningTask, UserProfile, Hall } from '../types';
import { Camera, CheckCircle, XCircle, Clock, Image as ImageIcon, Loader2, LayoutGrid, Bed, ChevronDown, ChevronUp, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { handleFirestoreError, sendAppNotification } from '../lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface HousekeepingProps {
  rooms: Room[];
  halls: Hall[];
  user: UserProfile;
}

export const Housekeeping: React.FC<HousekeepingProps> = ({ rooms, halls, user }) => {
  const [tasks, setTasks] = useState<CleaningTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<{ type: 'room' | 'hall', id: string, name: string } | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [taskNotes, setTaskNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [viewingTask, setViewingTask] = useState<CleaningTask | null>(null);
  const [expandedDates, setExpandedDates] = useState<string[]>([]);
  const [historyDateFilter, setHistoryDateFilter] = useState<string>('All');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<string>('All');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canClean = user.role === 'staff' || user.role === 'admin' || user.role === 'manager' || user.role === 'valet_de_chambre' || user.role === 'caissiere' || user.role === 'serveur' || user.role === 'receptionist';
  const canValidate = user.role === 'admin' || user.role === 'manager' || user.role === 'receptionist';

  useEffect(() => {
    const q = query(collection(db, 'cleaning_tasks'), orderBy('timestamp', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      setTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CleaningTask)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, 'list' as any, 'cleaning_tasks');
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        // Compress heavily to fit in Firestore document (max 1MB)
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.6);
        setPhotoBase64(compressedBase64);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitTask = async () => {
    if (!selectedItem || !photoBase64) return;
    setIsSubmitting(true);

    try {
      const taskData: any = {
        cleanerId: user.id,
        cleanerName: user.username,
        photoUrl: photoBase64,
        notes: taskNotes.trim(),
        timestamp: serverTimestamp(),
        status: 'Pending'
      };

      if (selectedItem.type === 'room') {
        taskData.roomId = selectedItem.id;
        taskData.roomNumber = selectedItem.name;
      } else {
        taskData.hallId = selectedItem.id;
        taskData.hallName = selectedItem.name;
      }

      await addDoc(collection(db, 'cleaning_tasks'), taskData);

      setSelectedItem(null);
      setPhotoBase64(null);
      setTaskNotes('');
    } catch (error) {
      handleFirestoreError(error, 'create' as any, 'cleaning_tasks');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleValidateTask = async (task: CleaningTask, isApproved: boolean) => {
    try {
      const batch = writeBatch(db);
      
      batch.update(doc(db, 'cleaning_tasks', task.id), {
        status: isApproved ? 'Validated' : 'Rejected'
      });

      if (isApproved) {
        if (task.roomId) {
          batch.update(doc(db, 'rooms', task.roomId), {
            status: 'Available'
          });
          sendAppNotification('info', `La chambre ${task.roomNumber} est maintenant propre et disponible.`);
        } else if (task.hallId) {
          batch.update(doc(db, 'halls', task.hallId), {
            status: 'Available'
          });
          sendAppNotification('info', `La salle "${task.hallName}" est maintenant propre et disponible.`);
        }
      }
      
      await batch.commit();
      setViewingTask(null);
    } catch (error) {
      handleFirestoreError(error, 'update' as any, 'cleaning_tasks');
    }
  };

  const roomsNeedingCleaning = rooms.filter(r => r.status === 'Cleaning');
  const hallsNeedingCleaning = halls.filter(h => h.status === 'Cleaning');
  const pendingTasks = tasks.filter(t => t.status === 'Pending');

  const toggleDate = (date: string) => {
    setExpandedDates(prev => prev.includes(date) ? prev.filter(d => d !== date) : [...prev, date]);
  };

  const historyTasks = tasks.filter(t => t.status !== 'Pending');

  // Unique history dates for the dropdown filter
  const allHistoryDates: string[] = Array.from(new Set<string>(
    historyTasks.map(t => t.timestamp?.toDate ? format(t.timestamp.toDate(), 'yyyy-MM-dd') : 'Inconnu')
  )).sort((a: string, b: string) => b.localeCompare(a));

  // Apply filters
  const filteredHistoryTasks = historyTasks.filter(t => {
    // Status filter
    if (historyStatusFilter !== 'All' && t.status !== historyStatusFilter) return false;
    
    // Date filter
    if (historyDateFilter !== 'All') {
      const dateStr = t.timestamp?.toDate ? format(t.timestamp.toDate(), 'yyyy-MM-dd') : 'Inconnu';
      if (dateStr !== historyDateFilter) return false;
    }
    
    return true;
  });

  const groupedTasks = filteredHistoryTasks.reduce((acc, task) => {
    const dateStr = task.timestamp?.toDate ? format(task.timestamp.toDate(), 'yyyy-MM-dd') : 'Inconnu';
    if (!acc[dateStr]) {
      acc[dateStr] = [];
    }
    acc[dateStr].push(task);
    return acc;
  }, {} as Record<string, CleaningTask[]>);

  const sortedDates = Object.keys(groupedTasks).sort((a, b) => b.localeCompare(a));

  // Auto-expand the most recent date if nothing is expanded and we have dates
  useEffect(() => {
    if (sortedDates.length > 0 && expandedDates.length === 0) {
      setExpandedDates([sortedDates[0]]);
    }
  }, [sortedDates, expandedDates.length]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[#2B2321] uppercase">Service d'Entretien</h2>
          <p className="text-xs text-[#2B2321]/60 mt-1">Gestion du nettoyage des chambres et des salles</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column: Actions based on role */}
        <div className="space-y-6">
          {canClean && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Camera className="w-5 h-5 text-primary" />
                Nouveau Nettoyage
              </h3>
              
              {!selectedItem ? (
                <div className="space-y-6">
                  {/* Rooms Section */}
                  <div>
                    <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <Bed className="w-4 h-4" />
                      Chambres à nettoyer
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {roomsNeedingCleaning.length === 0 ? (
                        <p className="text-gray-400 col-span-full py-2 text-center text-sm">Aucune chambre en attente</p>
                      ) : (
                        roomsNeedingCleaning.map(room => (
                          <button
                            key={room.id}
                            onClick={() => setSelectedItem({ type: 'room', id: room.id, name: room.number })}
                            className="p-4 rounded-xl border-2 border-dashed border-gray-200 hover:border-primary hover:bg-primary/5 transition-colors flex flex-col items-center gap-2"
                          >
                            <span className="text-2xl font-bold text-gray-700">{room.number}</span>
                            <span className="text-[10px] font-bold text-orange-500 bg-orange-50 px-2 py-1 rounded-full uppercase">Chambre</span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Halls Section */}
                  {true && (
                    <div>
                      <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <LayoutGrid className="w-4 h-4" />
                        Salles à nettoyer
                      </h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {hallsNeedingCleaning.length === 0 ? (
                          <p className="text-gray-400 col-span-full py-2 text-center text-sm">Aucune salle en attente</p>
                        ) : (
                          hallsNeedingCleaning.map(hall => (
                            <button
                              key={hall.id}
                              onClick={() => setSelectedItem({ type: 'hall', id: hall.id, name: hall.name })}
                              className="p-4 rounded-xl border-2 border-dashed border-gray-200 hover:border-primary hover:bg-primary/5 transition-colors flex flex-col items-center gap-2"
                            >
                              <span className="text-sm font-bold text-gray-700 text-center line-clamp-1">{hall.name}</span>
                              <span className="text-[10px] font-bold text-orange-500 bg-orange-50 px-2 py-1 rounded-full uppercase">Salle</span>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between bg-gray-50 p-4 rounded-xl">
                    <div>
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                        {selectedItem.type === 'room' ? 'Chambre' : 'Salle'} sélectionnée
                      </span>
                      <p className="text-xl font-bold text-gray-800">{selectedItem.name}</p>
                    </div>
                    <button 
                      onClick={() => { setSelectedItem(null); setPhotoBase64(null); }}
                      className="text-sm text-red-500 hover:text-red-600 font-medium"
                    >
                      Annuler
                    </button>
                  </div>

                  {!photoBase64 ? (
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-gray-300 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 hover:border-primary transition-colors"
                    >
                      <Camera className="w-12 h-12 text-gray-400 mb-3" />
                      <p className="text-gray-600 font-medium">Prendre une photo</p>
                      <p className="text-sm text-gray-400 mt-1 text-center">Preuve du nettoyage effectué</p>
                      <input 
                        type="file" 
                        accept="image/*" 
                        capture="environment"
                        className="hidden" 
                        ref={fileInputRef}
                        onChange={handlePhotoCapture}
                      />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="relative rounded-xl overflow-hidden border border-gray-200">
                        <img src={photoBase64} alt="Espace nettoyé" className="w-full h-48 object-cover" />
                        <button 
                          onClick={() => setPhotoBase64(null)}
                          className="absolute top-2 right-2 bg-black/50 text-white p-2 rounded-full hover:bg-black/70 transition-colors"
                        >
                          <XCircle className="w-5 h-5" />
                        </button>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                          Observation / Commentaire (optionnel)
                        </label>
                        <textarea
                          value={taskNotes}
                          onChange={(e) => setTaskNotes(e.target.value)}
                          placeholder="Ex: Nettoyage complet effectué, linge changé..."
                          rows={2}
                          className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-primary"
                        />
                      </div>

                      <button
                        onClick={handleSubmitTask}
                        disabled={isSubmitting}
                        className="w-full bg-primary text-white py-3 rounded-xl font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                        Soumettre pour validation
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Validation Section for Managers/Receptionists */}
          {canValidate && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                Validations en attente
              </h3>
              
              <div className="space-y-3">
                {pendingTasks.length === 0 ? (
                  <p className="text-gray-400 text-center py-8">Aucune validation en attente</p>
                ) : (
                  pendingTasks.map(task => (
                    <div key={task.id} className="flex items-center justify-between p-4 rounded-xl border border-gray-100 bg-gray-50 hover:bg-gray-100 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-white border border-gray-200 flex items-center justify-center overflow-hidden shrink-0">
                          <img src={task.photoUrl} alt="Aperçu" className="w-full h-full object-cover opacity-80" />
                        </div>
                        <div>
                          <p className="font-bold text-gray-800">
                            {task.roomId ? `Chambre ${task.roomNumber}` : `Salle ${task.hallName}`}
                          </p>
                          <p className="text-xs text-gray-500">Par {task.cleanerName}</p>
                          {task.notes && (
                            <p className="text-xs text-primary italic mt-0.5 max-w-xs truncate">"{task.notes}"</p>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => setViewingTask(task)}
                        className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors shrink-0"
                      >
                        Examiner
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: History */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <h3 className="text-xl font-semibold flex items-center gap-2">
              <Clock className="w-5 h-5 text-gray-500" />
              Historique récent
            </h3>
          </div>

          {/* Filter Dropdowns */}
          <div className="flex flex-col sm:flex-row gap-2 mb-6 p-3 bg-gray-50 rounded-xl border border-gray-100">
            {/* Filter by Date */}
            <div className="flex-1">
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                Filtrer par date
              </label>
              <select
                value={historyDateFilter}
                onChange={(e) => setHistoryDateFilter(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-gray-700 focus:outline-none focus:border-primary cursor-pointer"
              >
                <option value="All">Toutes les dates</option>
                {allHistoryDates.map(date => {
                  let label = date;
                  if (date !== 'Inconnu') {
                    try {
                      label = format(new Date(date), 'dd MMMM yyyy', { locale: fr });
                    } catch (e) {}
                  }
                  return <option key={date} value={date}>{label}</option>;
                })}
              </select>
            </div>

            {/* Filter by Status */}
            <div className="flex-1">
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                Filtrer par statut
              </label>
              <select
                value={historyStatusFilter}
                onChange={(e) => setHistoryStatusFilter(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-gray-700 focus:outline-none focus:border-primary cursor-pointer"
              >
                <option value="All">Tous les statuts</option>
                <option value="Validated">Validé</option>
                <option value="Rejected">Rejeté</option>
              </select>
            </div>
          </div>

          <div className="space-y-4">
            {sortedDates.length === 0 ? (
              <p className="text-gray-400 text-center py-8">Aucun historique correspondant</p>
            ) : (
              sortedDates.map(date => {
                const isExpanded = expandedDates.includes(date);
                const dayTasks = groupedTasks[date];
                
                let displayDate = date;
                if (date !== 'Inconnu') {
                  try {
                    const parsed = new Date(date);
                    displayDate = format(parsed, 'EEEE d MMMM yyyy', { locale: fr });
                  } catch (e) {}
                }

                return (
                  <div key={date} className="border border-gray-100 rounded-2xl overflow-hidden bg-gray-50/50">
                    <button
                      onClick={() => toggleDate(date)}
                      className="w-full flex items-center justify-between p-4 bg-white hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                          <Calendar className="w-5 h-5" />
                        </div>
                        <div className="text-left">
                          <p className="font-bold text-gray-800 capitalize">{displayDate}</p>
                          <p className="text-xs text-gray-500">{dayTasks.length} nettoyage{dayTasks.length > 1 ? 's' : ''}</p>
                        </div>
                      </div>
                      <div className="text-gray-400">
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
                          <div className="p-4 pt-0 space-y-3">
                            {dayTasks.map(task => (
                              <div key={task.id} className="flex items-start gap-4 p-4 rounded-xl bg-white border border-gray-100 shadow-sm hover:border-primary/20 transition-all">
                                <div className="w-16 h-16 rounded-lg bg-gray-100 overflow-hidden shrink-0 border border-gray-100">
                                  <img src={task.photoUrl} alt="Photo" className="w-full h-full object-cover" />
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center justify-between">
                                    <p className="font-bold text-[#2B2321]">
                                      {task.roomId ? `Chambre ${task.roomNumber}` : `Salle ${task.hallName}`}
                                    </p>
                                    <span className={`text-[9px] font-bold px-2 py-1 rounded-md uppercase tracking-wider ${
                                      task.status === 'Validated' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                    }`}>
                                      {task.status === 'Validated' ? 'Validé' : 'Rejeté'}
                                    </span>
                                  </div>
                                  <p className="text-sm text-gray-600 mt-0.5">Nettoyé par <span className="font-bold">{task.cleanerName}</span></p>
                                  {task.notes && (
                                    <p className="text-xs text-gray-500 bg-gray-50 p-2.5 rounded-lg mt-2 italic border border-gray-100">
                                      "{task.notes}"
                                    </p>
                                  )}
                                  <p className="text-[10px] font-bold text-primary/40 uppercase tracking-widest mt-2">
                                    {task.timestamp?.toDate ? format(task.timestamp.toDate(), 'HH:mm') : '-'}
                                  </p>
                                </div>
                              </div>
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
        </div>
      </div>

      {/* Validation Modal */}
      <AnimatePresence>
        {viewingTask && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                <h3 className="font-bold text-lg">
                  Validation - {viewingTask.roomId ? `Chambre ${viewingTask.roomNumber}` : `Salle ${viewingTask.hallName}`}
                </h3>
                <button onClick={() => setViewingTask(null)} className="text-gray-400 hover:text-gray-600">
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
              
              <div className="flex-1 overflow-auto p-6 flex flex-col items-center">
                <img 
                  src={viewingTask.photoUrl} 
                  alt="Preuve de nettoyage" 
                  className="max-w-full rounded-xl shadow-sm border border-gray-200"
                  style={{ maxHeight: '40vh' }}
                />
                {viewingTask.notes && (
                  <div className="w-full bg-gray-50 p-4 rounded-xl border border-gray-100 mt-4 text-left">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Observation du valet</p>
                    <p className="text-sm text-gray-700 italic">"{viewingTask.notes}"</p>
                  </div>
                )}
                <div className="mt-4 text-center">
                  <p className="text-gray-600">Nettoyage effectué par <span className="font-bold text-gray-800">{viewingTask.cleanerName}</span></p>
                  <p className="text-sm text-gray-400 mt-1">{viewingTask.timestamp?.toDate().toLocaleString('fr-FR')}</p>
                </div>
              </div>

              <div className="p-4 border-t border-gray-100 bg-gray-50 flex gap-3 justify-end">
                <button
                  onClick={() => handleValidateTask(viewingTask, false)}
                  className="px-6 py-2.5 rounded-xl font-medium text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
                >
                  Rejeter
                </button>
                <button
                  onClick={() => handleValidateTask(viewingTask, true)}
                  className="px-6 py-2.5 rounded-xl font-medium text-white bg-green-600 hover:bg-green-700 transition-colors flex items-center gap-2"
                >
                  <CheckCircle className="w-5 h-5" />
                  Valider & Libérer
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
