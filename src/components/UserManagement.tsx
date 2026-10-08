import React, { useState, useEffect } from 'react';
import { collection, doc, setDoc, deleteDoc, writeBatch, onSnapshot, query, orderBy, getDocs, getFirestore } from 'firebase/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { db } from '../firebase';
import { UserProfile, UserRole, AppSettings } from '../types';
import { Loader2, Plus, Trash2, UserPlus, AlertTriangle, Database, X, Users, Edit2, Check, FileText } from 'lucide-react';
import { handleFirestoreError, OperationType, wipeAllSalesAndDatabase } from '../lib/utils';
import { exportUsersPDF } from '../lib/pdfUtils';
import { toast } from 'sonner';

export const UserManagement = ({ isAdmin, user, settings }: { isAdmin: boolean, user?: UserProfile | null, settings?: AppSettings | null }) => {
  const isManagerOrAdmin = isAdmin || user?.role === 'admin' || user?.role === 'manager' || user?.email?.toLowerCase() === 'cyber.kan587@gmail.com';
  const canManage = isManagerOrAdmin;
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearingData, setClearingData] = useState(false);
  const [newUser, setNewUser] = useState({ 
    username: '', 
    email: '', 
    role: 'staff' as UserRole, 
    password: '',
    phone: ''
  });
  const [editingUser, setEditingUser] = useState<{id: string, username: string, password?: string} | null>(null);

  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => Promise<void>;
    isDanger?: boolean;
  }>({ isOpen: false, title: '', message: '', onConfirm: async () => {} });

  const [feedbackMsg, setFeedbackMsg] = useState<{text: string, type: 'success'|'error'} | null>(null);

  const showFeedback = (text: string, type: 'success'|'error' = 'success') => {
    setFeedbackMsg({ text, type });
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  useEffect(() => {
    // 1. Instantly load from local storage cache if available
    try {
      const cached = localStorage.getItem('residence_cached_users');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setUsers(parsed);
          setLoading(false);
        }
      }
    } catch (e) {}

    // 2. Real-time listener on 'users' collection without restrictive orderBy
    const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const loaded = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          username: data.username || data.name || doc.id,
          email: data.email || `${doc.id}@residencehq.com`,
          role: data.role || 'staff',
          phone: data.phone,
          password: data.password,
          createdAt: data.createdAt,
          isInvited: data.isInvited
        } as UserProfile;
      });

      // In-memory sort by username
      loaded.sort((a, b) => (a.username || '').localeCompare(b.username || ''));

      setUsers(loaded);
      setLoading(false);
      try {
        localStorage.setItem('residence_cached_users', JSON.stringify(loaded));
      } catch (e) {}
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
      setLoading(false);
    });

    return () => {
      unsubscribeUsers();
    };
  }, []);

  const deleteUser = (id: string) => {
    if (users.find(u => u.id === id)?.email === 'cyber.kan587@gmail.com') {
      showFeedback('Impossible de supprimer l\'administrateur principal.', 'error');
      return;
    }

    setModalConfig({
      isOpen: true,
      title: 'Supprimer l\'utilisateur',
      message: 'Êtes-vous sûr de vouloir supprimer cet utilisateur ? Il ne pourra plus se connecter.',
      isDanger: true,
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'users', id));
          try {
            await deleteDoc(doc(db, 'drivers', id));
          } catch (e) {}
          setUsers(prev => {
            const updated = prev.filter(u => u.id !== id);
            try {
              localStorage.setItem('residence_cached_users', JSON.stringify(updated));
            } catch (e) {}
            return updated;
          });
          showFeedback('Utilisateur supprimé avec succès.');
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `users/${id}`);
        }
      }
    });
  };

  const updateUserSettings = async () => {
    if (!editingUser) return;
    try {
      const updates: any = { username: editingUser.username };
      if (editingUser.password !== undefined) {
        updates.password = editingUser.password;
      }
      await setDoc(doc(db, 'users', editingUser.id), updates, { merge: true });
      setEditingUser(null);
      showFeedback('Informations mises à jour.');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${editingUser.id}`);
    }
  };

  const changeRole = async (userProfile: UserProfile, newRole: UserRole) => {
    if (userProfile.email === 'cyber.kan587@gmail.com') return;

    try {
      await setDoc(doc(db, 'users', userProfile.id), { role: newRole }, { merge: true });
      showFeedback(`Rôle mis à jour : ${newRole}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userProfile.id}`);
    }
  };

  const clearCollectionInBatches = async (colName: string) => {
    const snapshot = await getDocs(collection(db, colName));
    const docs = snapshot.docs;
    const chunkSize = 400;
    for (let i = 0; i < docs.length; i += chunkSize) {
      const batch = writeBatch(db);
      const chunk = docs.slice(i, i + chunkSize);
      chunk.forEach(docSnap => batch.delete(docSnap.ref));
      await batch.commit();
    }
  };

  const clearBookingsData = () => {
    setModalConfig({
      isOpen: true,
      title: 'Effacer Historique Réservations',
      message: 'ATTENTION : Voulez-vous vraiment effacer TOUT l\'historique des réservations et séjours ? Cette action est irréversible.',
      isDanger: true,
      onConfirm: async () => {
        setClearingData(true);
        try {
          await clearCollectionInBatches('bookings');
          await clearCollectionInBatches('reservations');
          localStorage.setItem('residence_bookings', '[]');
          localStorage.setItem('residence_reservations', '[]');
          showFeedback('Historique des réservations effacé.');
          setTimeout(() => window.location.reload(), 1500);
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, 'bookings');
        } finally {
          setClearingData(false);
        }
      }
    });
  };

  const clearHotelData = () => {
    setModalConfig({
      isOpen: true,
      title: 'Vider le module Hôtel',
      message: 'ATTENTION : Voulez-vous vraiment SUPPRIMER TOUTES les chambres ? Cette action est irréversible et videra complètement la base de données des chambres.',
      isDanger: true,
      onConfirm: async () => {
        setClearingData(true);
        try {
          await clearCollectionInBatches('rooms');
          localStorage.setItem('residence_rooms', '[]');
          showFeedback('Toutes les chambres ont été supprimées.');
          setTimeout(() => window.location.reload(), 1500);
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, 'rooms');
        } finally {
          setClearingData(false);
        }
      }
    });
  };

  const clearSalesData = () => {
    setModalConfig({
      isOpen: true,
      title: 'Effacer Ventes (POS)',
      message: 'ATTENTION : Voulez-vous vraiment effacer TOUT l\'historique des ventes (POS) ? Cette action est irréversible.',
      isDanger: true,
      onConfirm: async () => {
        setClearingData(true);
        try {
          await clearCollectionInBatches('sales');
          localStorage.setItem('residence_sales', '[]');
          showFeedback('Historique des ventes effacé avec succès.');
          setTimeout(() => window.location.reload(), 1500);
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, 'sales');
        } finally {
          setClearingData(false);
        }
      }
    });
  };

  const clearInventoryData = () => {
    setModalConfig({
      isOpen: true,
      title: 'Vider le Stock',
      message: 'ATTENTION : Voulez-vous vraiment SUPPRIMER TOUS les produits du stock ? Cette action est irréversible et videra complètement votre inventaire.',
      isDanger: true,
      onConfirm: async () => {
        setClearingData(true);
        try {
          await clearCollectionInBatches('products');
          localStorage.setItem('residence_products', '[]');
          showFeedback('Tout le stock a été supprimé.');
          toast.success('Tout le stock a été supprimé avec succès !');
          setTimeout(() => window.location.reload(), 1500);
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, 'products');
        } finally {
          setClearingData(false);
        }
      }
    });
  };

  const clearMaintenanceAndCleaningData = () => {
    setModalConfig({
      isOpen: true,
      title: 'Vider Maintenance & Nettoyage',
      message: 'ATTENTION : Voulez-vous vraiment SUPPRIMER TOUTES les tâches de maintenance et de nettoyage/propreté ? Cette action est irréversible.',
      isDanger: true,
      onConfirm: async () => {
        setClearingData(true);
        try {
          await clearCollectionInBatches('maintenance_tasks');
          await clearCollectionInBatches('cleaning_tasks');
          showFeedback('Toutes les tâches de maintenance et nettoyage ont été supprimées.');
          setTimeout(() => window.location.reload(), 1500);
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, 'maintenance_tasks');
        } finally {
          setClearingData(false);
        }
      }
    });
  };

  const handleWipeAllSalesAndDatabase = () => {
    setModalConfig({
      isOpen: true,
      title: 'Suppression Totale des Ventes & Base de Données',
      message: 'ACTION DÉFINITIVE & IRRÉVERSIBLE : Voulez-vous vraiment SUPPRIMER TOUTES les ventes (POS, bar, resto, chicha) et TOUTES les données de la base ? L\'application sera entièrement remise à zéro.',
      isDanger: true,
      onConfirm: async () => {
        setClearingData(true);
        try {
          const res = await wipeAllSalesAndDatabase();
          if (res.success) {
            showFeedback('Toutes les ventes et la base de données ont été supprimées avec succès.');
            toast.success('Base de données et ventes entièrement effacées.');
            setTimeout(() => window.location.reload(), 1200);
          } else {
            toast.error(res.error || 'Erreur lors de la purge');
          }
        } catch (error) {
          toast.error("Erreur lors de la suppression");
        } finally {
          setClearingData(false);
        }
      }
    });
  };

  const inviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.email || !newUser.username || !newUser.password) {
      showFeedback('Email, nom et mot de passe sont requis.', 'error');
      return;
    }

    setLoading(true);
    let secondaryApp: any;
    try {
      const secondaryAppName = `secondary_${Date.now()}`;
      secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
      const secondaryAuth = getAuth(secondaryApp);

      let uid: string;
      try {
        const userCredential = await createUserWithEmailAndPassword(
          secondaryAuth, 
          newUser.email.trim().toLowerCase(), 
          newUser.password
        );
        uid = userCredential.user.uid;
      } catch (authErr: any) {
        if (authErr.code === 'auth/email-already-in-use') {
          // If the account was already created in Auth (e.g. from a previous attempt), recover its ID or generate a consistent reference
          const existing = users.find(u => u.email.toLowerCase() === newUser.email.trim().toLowerCase());
          uid = existing?.id || ('auth_' + newUser.email.trim().toLowerCase().replace(/[^a-z0-9]/g, '_'));
        } else {
          throw authErr;
        }
      }
      
      const userProfileDoc: UserProfile = {
        id: uid,
        username: newUser.username.trim(),
        email: newUser.email.trim().toLowerCase(),
        role: newUser.role,
        password: newUser.password
      };

      const userDocData = {
        username: newUser.username.trim(),
        email: newUser.email.trim().toLowerCase(),
        role: newUser.role,
        password: newUser.password,
        createdAt: new Date().toISOString()
      };

      // Write user document to primary db with fallback
      try {
        await setDoc(doc(db, 'users', uid), userDocData, { merge: true });
      } catch (primaryErr) {
        console.warn('Warning writing to primary db:', primaryErr);
      }

      // Optimistic update of local user list
      setUsers(prev => {
        const filtered = prev.filter(u => u.id !== uid && u.email !== userProfileDoc.email);
        const updated = [...filtered, userProfileDoc];
        try {
          localStorage.setItem('residence_cached_users', JSON.stringify(updated));
        } catch (e) {}
        return updated;
      });
      
      try {
        await signOut(secondaryAuth);
        await deleteApp(secondaryApp);
      } catch (e) {}
      secondaryApp = null;
      
      setNewUser({ 
        username: '', 
        email: '', 
        role: 'staff', 
        password: '',
        phone: ''
      });
      showFeedback(`Utilisateur ${userProfileDoc.username} créé avec succès.`);
    } catch (error: any) {
      console.error('User creation error:', error);
      let errMsg = 'Échec de la création de l\'utilisateur.';
      if (error.code === 'auth/email-already-in-use') {
        errMsg = 'Cet email est déjà utilisé.';
      } else if (error.code === 'auth/weak-password') {
        errMsg = 'Le mot de passe est trop court (min 6 caractères).';
      } else if (error.code === 'auth/invalid-email') {
        errMsg = 'Email invalide.';
      } else if (error.message?.includes('permission') || error.code === 'permission-denied') {
        errMsg = 'Permissions insuffisantes. Vérifiez vos droits administrateur.';
      }
      showFeedback(errMsg, 'error');
      if (secondaryApp) {
        try {
          await deleteApp(secondaryApp);
        } catch (e) {}
      }
    } finally {
      setLoading(false);
    }
  };

  if (!canManage) return <div className="p-8 text-center text-[#2B2321]/60">Accès réservé aux administrateurs et managers.</div>;

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-3xl border border-secondary/30 shadow-sm hover:shadow-xl hover:shadow-primary/10 transition-shadow">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-xl font-bold tracking-tight text-[#2B2321] mb-1 flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Gestion des Utilisateurs & Accès
            </h3>
            <p className="text-xs text-[#2B2321]/60 font-medium">
              Gérez les accès, consultez et modifiez les mots de passe, ou exportez la liste confidentielle.
            </p>
          </div>
          <button
            onClick={() => exportUsersPDF(users, settings || null)}
            className="px-5 py-3 bg-[#FDFBF7] border border-secondary/30 text-[#2B2321] rounded-2xl font-bold hover:bg-secondary/10 transition-all flex items-center justify-center gap-2 shadow-sm self-start md:self-auto"
          >
            <FileText className="w-5 h-5 text-primary" />
            Exporter PDF (Confidentiel)
          </button>
        </div>

        
        <form onSubmit={inviteUser} className="flex flex-col md:flex-row gap-4 items-end bg-[#FDFBF7] p-4 rounded-2xl border border-secondary/20">
          <div className="flex-1 w-full">
            <label className="text-[10px] font-bold uppercase tracking-widest text-primary/60 ml-1 mb-1 block">Nom de l'employé</label>
            <input 
              type="text" 
              required
              placeholder="Ex: Sophie"
              className="w-full px-4 py-3 bg-white border border-secondary/30 rounded-xl outline-none font-bold focus:border-primary transition-all text-[#2B2321]"
              value={newUser.username}
              onChange={e => setNewUser({...newUser, username: e.target.value})}
            />
          </div>
          <div className="flex-1 w-full">
            <label className="text-[10px] font-bold uppercase tracking-widest text-primary/60 ml-1 mb-1 block">Email</label>
            <input 
              type="email" 
              required
              placeholder="sophie@hotel.com"
              className="w-full px-4 py-3 bg-white border border-secondary/30 rounded-xl outline-none font-bold focus:border-primary transition-all text-[#2B2321]"
              value={newUser.email}
              onChange={e => setNewUser({...newUser, email: e.target.value})}
            />
          </div>
          <div className="w-full md:w-48">
            <label className="text-[10px] font-bold uppercase tracking-widest text-primary/60 ml-1 mb-1 block">Rôle</label>
            <select 
              className="w-full px-4 py-3 bg-white border border-secondary/30 rounded-xl outline-none font-bold focus:border-primary transition-all text-[#2B2321]"
              value={newUser.role}
              onChange={e => setNewUser({...newUser, role: e.target.value as UserRole})}
            >
              <option value="manager">Manager</option>
              <option value="receptionist">Réceptionniste</option>
              <option value="barman">Barman</option>
              <option value="cook">Cuisinier</option>
              <option value="staff">Staff</option>
              <option value="maintenance">Maintenancier</option>
              <option value="caissiere">Caissière (Terrasse/VIP/Réception)</option>
              <option value="serveur">Serveur (Resto/Terrasse/VIP)</option>
              <option value="valet_de_chambre">Valet de chambre (Nettoyage chambres)</option>
            </select>
          </div>
          <div className="flex-1 w-full">
            <label className="text-[10px] font-bold uppercase tracking-widest text-primary/60 ml-1 mb-1 block">Mot de passe</label>
            <input 
              type="text" 
              placeholder="Saisir un mot de passe"
              className="w-full px-4 py-3 bg-white border border-secondary/30 rounded-xl outline-none font-bold focus:border-primary transition-all text-[#2B2321]"
              value={newUser.password}
              onChange={e => setNewUser({...newUser, password: e.target.value})}
            />
          </div>
          <button 
            type="submit"
            className="w-full md:w-auto px-6 py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
          >
            <UserPlus className="w-5 h-5" />
            <span className="hidden md:inline">Créer</span>
          </button>
        </form>
      </div>

      <div className="bg-white rounded-3xl border border-secondary/30 shadow-sm hover:shadow-xl hover:shadow-primary/10 transition-shadow overflow-hidden">
        {loading ? (
          <div className="p-8 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-secondary/30 bg-[#FDFBF7]">
                  <th className="p-4 font-bold uppercase tracking-widest text-[10px] text-primary">Nom</th>
                  <th className="p-4 font-bold uppercase tracking-widest text-[10px] text-primary">Email</th>
                  <th className="p-4 font-bold uppercase tracking-widest text-[10px] text-primary">Rôle</th>
                  <th className="p-4 font-bold uppercase tracking-widest text-[10px] text-primary font-serif">Mot de passe</th>
                  <th className="p-4 font-bold uppercase tracking-widest text-[10px] text-primary text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user.id} className="border-b border-secondary/10 hover:bg-[#FDFBF7] transition-colors">
                    <td className="p-4 font-bold text-[#2B2321]">
                      <div className="flex items-center gap-2">
                        {editingUser?.id === user.id ? (
                          <div className="flex items-center gap-2">
                            <input 
                              className="px-2 py-1 border border-secondary/30 rounded-lg text-sm outline-none focus:border-primary"
                              value={editingUser.username}
                              onChange={e => setEditingUser({...editingUser, username: e.target.value})}
                              autoFocus
                            />
                            <button onClick={updateUserSettings} className="p-1 text-accent hover:bg-accent/10 rounded-full">
                              <Check className="w-4 h-4" />
                            </button>
                            <button onClick={() => setEditingUser(null)} className="p-1 text-red-500 hover:bg-red-50 rounded-full">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <>
                            {user.username}
                            <button onClick={() => setEditingUser({id: user.id, username: user.username, password: user.password || ''})} className="p-1 text-primary/40 hover:text-primary transition-colors">
                              <Edit2 className="w-3 h-3" />
                            </button>
                          </>
                        )}
                        {user.isInvited && (
                          <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-[10px] rounded-full uppercase tracking-widest">
                            Invité
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-[#2B2321]/60 font-medium">{user.email}</td>
                    <td className="p-4">
                      <select
                        value={user.role}
                        onChange={(e) => changeRole(user, e.target.value as UserRole)}
                        disabled={user.email === 'cyber.kan587@gmail.com'}
                        className={`px-3 py-1 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all outline-none border-none cursor-pointer ${
                          user.role === 'admin' 
                            ? 'bg-primary text-white' 
                            : 'bg-secondary/20 text-[#2B2321] hover:bg-secondary/40'
                        } disabled:opacity-50`}
                      >
                        <option value="admin">Admin</option>
                        <option value="manager">Manager</option>
                        <option value="receptionist">Réceptionniste</option>
                        <option value="barman">Barman</option>
                        <option value="cook">Cuisinier</option>
                        <option value="staff">Staff</option>
                        <option value="maintenance">Maintenancier</option>
                        <option value="caissiere">Caissière</option>
                        <option value="serveur">Serveur</option>
                        <option value="valet_de_chambre">Valet de chambre</option>
                        <option value="chauffeur">Chauffeur</option>
                      </select>
                    </td>
                    <td className="p-4 text-xs font-bold text-[#2B2321]">
                      {editingUser?.id === user.id ? (
                        <div className="flex items-center gap-2">
                          <input 
                            className="px-2 py-1 border border-secondary/30 rounded-lg text-sm outline-none focus:border-primary font-mono w-32"
                            value={editingUser.password || ''}
                            onChange={e => setEditingUser({...editingUser, password: e.target.value})}
                          />
                        </div>
                      ) : (
                        <span className="font-mono text-primary/80">{user.password || '••••••••'}</span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <button 
                        onClick={() => deleteUser(user.id)} 
                        disabled={user.email === 'cyber.kan587@gmail.com'}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors disabled:opacity-30"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Danger Zone */}
      {isManagerOrAdmin && (
        <div className="bg-red-50 p-6 rounded-3xl border border-red-200 shadow-sm mt-12">
          <h3 className="text-xl font-bold tracking-tight text-red-900 mb-2 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            Zone de Danger (Gestion des données)
          </h3>
          <p className="text-sm text-red-700 mb-6 font-medium">
            Ces actions sont irréversibles. Elles supprimeront ou réinitialiseront définitivement les données de l'application.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <button
              onClick={clearBookingsData}
              disabled={clearingData}
              className="w-full py-3 px-4 bg-white border-2 border-red-200 text-red-700 rounded-2xl font-bold hover:bg-red-100 hover:border-red-300 transition-all text-sm flex flex-col items-center justify-center gap-2 disabled:opacity-50"
            >
              <Database className="w-5 h-5" />
              Vider Historique Séjours
            </button>
            
            <button
              onClick={clearHotelData}
              disabled={clearingData}
              className="w-full py-3 px-4 bg-white border-2 border-red-200 text-red-700 rounded-2xl font-bold hover:bg-red-100 hover:border-red-300 transition-all text-sm flex flex-col items-center justify-center gap-2 disabled:opacity-50"
            >
              <Database className="w-5 h-5" />
              Vider module Hôtel
            </button>
            
            <button
              onClick={clearSalesData}
              disabled={clearingData}
              className="w-full py-3 px-4 bg-white border-2 border-red-200 text-red-700 rounded-2xl font-bold hover:bg-red-100 hover:border-red-300 transition-all text-sm flex flex-col items-center justify-center gap-2 disabled:opacity-50"
            >
              <Database className="w-5 h-5" />
              Effacer Ventes (POS)
            </button>
            
            <button
              onClick={clearInventoryData}
              disabled={clearingData}
              className="w-full py-3 px-4 bg-white border-2 border-red-200 text-red-700 rounded-2xl font-bold hover:bg-red-100 hover:border-red-300 transition-all text-sm flex flex-col items-center justify-center gap-2 disabled:opacity-50"
            >
              <Database className="w-5 h-5" />
              Vider le Stock
            </button>

            <button
              onClick={clearMaintenanceAndCleaningData}
              disabled={clearingData}
              className="w-full py-3 px-4 bg-white border-2 border-red-200 text-red-700 rounded-2xl font-bold hover:bg-red-100 hover:border-red-300 transition-all text-sm flex flex-col items-center justify-center gap-2 disabled:opacity-50"
            >
              <Database className="w-5 h-5" />
              Vider Maintenance & Nettoyage
            </button>

            <button
              onClick={handleWipeAllSalesAndDatabase}
              disabled={clearingData}
              className="w-full col-span-1 md:col-span-2 lg:col-span-4 py-4 px-6 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-bold transition-all text-sm flex items-center justify-center gap-3 disabled:opacity-50 shadow-lg shadow-red-600/30 cursor-pointer"
            >
              <Trash2 className="w-5 h-5 text-white" />
              <span>Supprimer TOUTES les Ventes & Réinitialiser la Base de Données (Zéro Vente)</span>
            </button>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {modalConfig.isOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-xl font-bold ${modalConfig.isDanger ? 'text-red-600' : 'text-[#2B2321]'}`}>
                {modalConfig.title}
              </h3>
              <button 
                onClick={() => setModalConfig(prev => ({ ...prev, isOpen: false }))}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <p className="text-[#2B2321]/70 mb-8 font-medium leading-relaxed">
              {modalConfig.message}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setModalConfig(prev => ({ ...prev, isOpen: false }))}
                className="px-5 py-2.5 text-[#2B2321] font-bold hover:bg-[#FDFBF7] rounded-xl transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={async () => {
                  await modalConfig.onConfirm();
                  setModalConfig(prev => ({ ...prev, isOpen: false }));
                }}
                className={`px-5 py-2.5 text-white font-bold rounded-xl shadow-lg transition-all ${
                  modalConfig.isDanger 
                    ? 'bg-red-500 hover:bg-red-600 shadow-red-500/20' 
                    : 'bg-primary hover:bg-primary/90 shadow-primary/20'
                }`}
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feedback Toast */}
      {feedbackMsg && (
        <div className={`fixed top-4 right-4 z-[9999] px-6 py-3 rounded-2xl shadow-xl font-bold text-white transition-all animate-in fade-in slide-in-from-top-4 ${
          feedbackMsg.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'
        }`}>
          {feedbackMsg.text}
        </div>
      )}
    </div>
  );
};
