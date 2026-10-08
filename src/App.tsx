import React, { useState, useEffect, useRef } from 'react';
import { 
  onAuthStateChanged, 
  signOut,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc,
  onSnapshot,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocFromServer,
  updateDoc,
  arrayUnion,
  deleteDoc,
  writeBatch,
  serverTimestamp,
  getDocs,
  addDoc
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { UserManagement } from './components/UserManagement';
import { ChatModule } from './components/ChatModule';
import { ConnectivityIndicator } from './components/ConnectivityIndicator';
import { UserProfile, Product, Sale, Room, RoomStatus, RoomType, AppSettings, Expense, AppNotification, Hall } from './types';
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  BarChart3, 
  LogOut, 
  Users,
  AlertCircle,
  Loader2,
  Bed,
  Waves,
  Bell,
  LayoutGrid,
  Settings as SettingsIcon,
  Sparkles,
  AlertTriangle,
  CheckCircle,
  XCircle,
  X,
  History,
  BookOpen,
  MessageSquare,
  FileText,
  ChefHat,
  Utensils,
  Wrench,
  Flame,
  Code,
  ChevronLeft,
  ChevronRight,
  Warehouse,
  Clock,
  FileSpreadsheet,
  Globe,
  Car,
  Shield,
  Edit2,
  DollarSign,
  Calendar,
  SprayCan,
  Building,
  Hotel,
  Activity,
  Wallet,
  Star,
  Megaphone,
  Radio,
  Rocket,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn, OperationType, handleFirestoreError, getLowStockProducts, requestNotificationPermission, logEvent, updateUserPresence, wipeAllSalesAndDatabase } from './lib/utils';

import { Dashboard } from './components/Dashboard';
import { POS } from './components/POS';
import { Inventory } from './components/Inventory';
import { MagasinModule } from './components/MagasinModule';
import { Stats } from './components/Stats';
import { RoomManagement } from './components/RoomManagement';
import { Housekeeping } from './components/Housekeeping';
import { SplashScreen } from './components/SplashScreen';
import { SettingsManagement } from './components/SettingsManagement';
import { GuestManagement } from './components/GuestManagement';
import { BookingHistory } from './components/BookingHistory';
import { ExpenseManagement } from './components/ExpenseManagement';
import { EventLog } from './components/EventLog';
import { UserGuide } from './components/UserGuide';
import { VoiceOfCustomer } from './components/VoiceOfCustomer';
import { ReportModule } from './components/ReportModule';
import { KitchenModule } from './components/KitchenModule';
import { HallManagement } from './components/HallManagement';
import { ChichaModule } from './components/ChichaModule';

import { MaintenanceManagement } from './components/MaintenanceManagement';
import QuotesAndInvoices from './components/QuotesAndInvoices';

import { ErrorBoundary } from './components/ErrorBoundary';
import { Login } from './components/Login';
import { Toaster, toast } from 'sonner';
import { BroadcastNotificationModal } from './components/BroadcastNotificationModal';
import { AppUpdatePrompt } from './components/AppUpdatePrompt';
import { CURRENT_APP_VERSION } from './constants';

// --- Main App ---



















// Default local user and seed data
const DEFAULT_USER: UserProfile = {
  id: 'admin_local',
  username: 'Super Administrateur',
  email: 'cyber.kan587@gmail.com',
  role: 'admin'
};

const INITIAL_PRODUCTS: Product[] = [];
const INITIAL_ROOMS: Room[] = [];
const INITIAL_HALLS: Hall[] = [];

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const userRef = useRef(user);
  useEffect(() => {
    userRef.current = user;
  }, [user]);
  const [loading, setLoading] = useState(true);
  const [showSplash, setShowSplash] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'pos' | 'kitchen' | 'chicha' | 'magasin' | 'inventory' | 'rooms' | 'halls' | 'housekeeping' | 'maintenance' | 'stats' | 'users' | 'settings' | 'guests' | 'bookings' | 'expenses' | 'event-log' | 'report' | 'guide' | 'chat' | 'python' | 'quotes' | 'voc'>(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tab = urlParams.get('tab');
    if (urlParams.get('mode') === 'client') return 'voc';
    const allowedTabs = ['dashboard', 'pos', 'kitchen', 'chicha', 'magasin', 'inventory', 'rooms', 'halls', 'housekeeping', 'maintenance', 'stats', 'users', 'settings', 'guests', 'bookings', 'expenses', 'event-log', 'report', 'guide', 'chat', 'python', 'quotes', 'voc'];
    return (tab && allowedTabs.includes(tab)) ? (tab as any) : 'dashboard';
  });
  
  const [products, setProducts] = useState<Product[]>(() => {
    const saved = localStorage.getItem('residence_products');
    return saved ? JSON.parse(saved) : INITIAL_PRODUCTS;
  });
  const [sales, setSales] = useState<Sale[]>(() => {
    const saved = localStorage.getItem('residence_sales');
    return saved ? JSON.parse(saved) : [];
  });
  const [rooms, setRooms] = useState<Room[]>(() => {
    const saved = localStorage.getItem('residence_rooms');
    return saved ? JSON.parse(saved) : INITIAL_ROOMS;
  });
  const [halls, setHalls] = useState<Hall[]>(() => {
    const saved = localStorage.getItem('residence_halls');
    return saved ? JSON.parse(saved) : INITIAL_HALLS;
  });
  const [settings, setSettings] = useState<AppSettings | null>(() => {
    const saved = localStorage.getItem('appSettings');
    return saved ? JSON.parse(saved) : {
      id: 'global',
      theme: 'default',
      primaryColor: '#0D5C53',
      secondaryColor: '#C5A059',
      accentColor: '#D4AF37',
      logoUrl: '/logo.png',
      hotelName: 'Résidence HQ',
      address: "02 rue Daniel Mayinguidi, Massissia (derrière l'usine GO Fresh), Brazzaville"
    };
  });

  const [showNotifications, setShowNotifications] = useState(false);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    const saved = localStorage.getItem('residence_notifications');
    return saved ? JSON.parse(saved) : [];
  });
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [pendingKitchenCount, setPendingKitchenCount] = useState(0);
  const [pendingMaintenanceCount, setPendingMaintenanceCount] = useState(0);
  
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const isLandscape = width > height;
      
      // Mode tablette roter: width typically >= 768px and <= 1200px, and landscape
      if (width >= 768 && width <= 1200 && isLandscape) {
        setIsSidebarCollapsed(true);
      } else {
        setIsSidebarCollapsed(false);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);
  
  const handleLogout = async () => {
    if (user) {
      try {
        const nowStr = format(new Date(), 'HH:mm:ss');
        const dateStr = format(new Date(), 'dd/MM/yyyy');
        await logEvent(user, 'Déconnexion', `Action : Fermeture de session et déconnexion du poste de travail | Utilisateur : ${user.username} (${user.email || 'Compte local'}) | Rôle : ${user.role} | Heure de déconnexion : ${dateStr} à ${nowStr}`);
      } catch (e) {}
    }
    try {
      sessionStorage.clear();
    } catch (e) {}
    localStorage.removeItem('simulated_user');
    try {
      await signOut(auth);
    } catch (e) {
      console.error('Error signing out:', e);
    }
    setUser(null);
  };
  
  const isSuperAdmin = user?.email?.toLowerCase() === 'cyber.kan587@gmail.com';
  const isAdmin = isSuperAdmin || user?.role === 'admin';
  const isManager = isAdmin || user?.role === 'manager';
  const isReceptionist = isManager || user?.role === 'receptionist';
  const isCook = user?.role === 'cook';

  const isClient = user?.role === 'client';
  const isInventoryRole = !isClient && (isAdmin || isManager || user?.role === 'caissiere' || user?.role === 'cook' || user?.role === 'receptionist');

  const lowStockProducts = getLowStockProducts(products);

  const unreadNotifications = notifications.filter(n => {
    // 1. Any notification that has been handled (validated/rejected/closed) must NEVER appear as unread
    if (n.handled) return false;

    const isRead = n.readBy?.includes(user?.id || '');
    if (isRead) return false;
    
    // Broadcast messages and App Updates are delivered to ALL users
    if (n.type === 'app_update' || n.type === 'broadcast' || n.targetRole === 'all') {
      return true;
    }

    // Check user targeting
    if (n.targetUserId && n.targetUserId !== user?.id) return false;

    // Strict rule for CLIENT role:
    if (isClient) {
      const isFromAdminHQ = n.source === 'admin_hq' || 
                            n.type === 'admin_hq' || 
                            (n.message && (
                              n.message.toLowerCase().includes('admin hq') || 
                              n.message.toLowerCase().includes('dispatch hq')
                            ));

      if (!isFromAdminHQ) {
        return false;
      }

      if (n.targetRole && n.targetRole.toLowerCase() !== 'client') {
        return false;
      }

      return true;
    }
    
    // Check if it's an expense confirmation notification ("Votre dépense ... a été validée/rejetée")
    const isValidationConfirmation = n.message && (
      n.message.toLowerCase().includes('a été validée') || 
      n.message.toLowerCase().includes('a été rejetée') ||
      n.message.toLowerCase().includes('validée par') ||
      n.message.toLowerCase().includes('rejetée par')
    );
    
    if (isValidationConfirmation) {
      // The admin who validates should never see this confirmation notification
      if (isAdmin) {
        return false;
      }
      // Confirmations are strictly for the employee who submitted the expense
      if (n.targetUserId && n.targetUserId !== user?.id) {
        return false;
      }
      if (!n.targetUserId) {
        return false;
      }
      return true;
    }

    // Strict rule for EXPENSE requests:
    const isExpense = n.type === 'expense' || (
      n.message && (n.message.toLowerCase().includes('dépense') || n.message.toLowerCase().includes('depense'))
    );
    if (isExpense) {
      // Pending expense validation requests are strictly visible ONLY to ADMINS
      const isPending = !n.handled && n.message && n.message.toLowerCase().includes('en attente de validation');
      if (isPending) {
        return isAdmin;
      }
      // If already resolved or not a pending validation request, do not display
      return false;
    }

    // Check role targeting for staff/admin
    if (n.targetRole) {
      const target = n.targetRole.toLowerCase();
      const userRole = (user?.role || '').toLowerCase();
      
      const isPublicTarget = ['all', 'hotel', 'public', 'everyone', 'general', 'global'].includes(target);
      const isMatchingRole = target === userRole || ((target === 'admin' || target === 'manager') && isManager);
      
      if (!isMatchingRole && !isAdmin && !isPublicTarget) {
        return false;
      }
    }
    
    return true;
  });

  const totalNotificationBadgeCount = isClient ? unreadNotifications.length : (unreadNotifications.length + (isInventoryRole ? lowStockProducts.length : 0));

  useEffect(() => {
    // Save state to local storage whenever updated
    localStorage.setItem('residence_products', JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    localStorage.setItem('residence_rooms', JSON.stringify(rooms));
  }, [rooms]);

  useEffect(() => {
    localStorage.setItem('residence_halls', JSON.stringify(halls));
  }, [halls]);

  useEffect(() => {
    localStorage.setItem('residence_sales', JSON.stringify(sales));
  }, [sales]);

  useEffect(() => {
    // Apply cached settings immediately
    const saved = localStorage.getItem('appSettings');
    if (saved) {
      const data = JSON.parse(saved) as AppSettings;
      document.documentElement.style.setProperty('--primary-color', data.primaryColor || '#0D5C53');
      document.documentElement.style.setProperty('--secondary-color', data.secondaryColor || '#C5A059');
      document.documentElement.style.setProperty('--accent-color', data.accentColor || '#D4AF37');
      if (data.hotelName) {
        document.title = `${data.hotelName} - POS`;
      }
    }

    const unsubSettings = onSnapshot(doc(db, 'settings', 'global'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as AppSettings;
        const newSettings = { id: docSnap.id, ...data };
        setSettings(newSettings);
        localStorage.setItem('appSettings', JSON.stringify(newSettings));
        
        document.documentElement.style.setProperty('--primary-color', data.primaryColor || '#0D5C53');
        document.documentElement.style.setProperty('--secondary-color', data.secondaryColor || '#C5A059');
        document.documentElement.style.setProperty('--accent-color', data.accentColor || '#D4AF37');
        if (data.hotelName) {
          document.title = `${data.hotelName} - POS`;
        }
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings');
    });

    return () => unsubSettings();
  }, []);

  useEffect(() => {
    let unsubUser: (() => void) | undefined;

    // Direct QR-code / link access for clients (Voice of Customer)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('mode') === 'client') {
      const clientUser: UserProfile = {
        id: 'client_guest_' + Math.random().toString(36).substr(2, 9),
        username: 'Client Résidence',
        email: 'client@residencehq.com',
        role: 'client'
      };
      localStorage.setItem('simulated_user', JSON.stringify(clientUser));
      setUser(clientUser);
      setActiveTab('voc');
      setLoading(false);
      // Clean query parameters from URL for pristine address bar
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    // Check for simulated local user session first
    const localUserStr = localStorage.getItem('simulated_user');
    if (localUserStr) {
      try {
        const localUser = JSON.parse(localUserStr);
        const emailLower = (localUser.email || '').toLowerCase();
        const isOwner = emailLower === 'cyber.kan587@gmail.com';
        const isGmail = emailLower.endsWith('@gmail.com') || emailLower.endsWith('@googlemail.com');
        if (isGmail && !isOwner) {
          localUser.role = 'client';
        }
        setUser(localUser);
        if (localUser.role === 'client' && activeTab !== 'voc') {
          setActiveTab('voc');
        }
        setLoading(false);
        return;
      } catch (err) {
        localStorage.removeItem('simulated_user');
      }
    }

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      // If a simulated session is active, ignore auth
      if (localStorage.getItem('simulated_user')) {
        return;
      }

      if (firebaseUser) {
        setLoading(true);
        const emailLower = (firebaseUser.email || '').toLowerCase();
        const isOwner = emailLower === 'cyber.kan587@gmail.com';
        const isGmailUser = emailLower.endsWith('@gmail.com') || emailLower.endsWith('@googlemail.com');

        unsubUser = onSnapshot(doc(db, 'users', firebaseUser.uid), async (docSnap) => {
          if (isGmailUser && !isOwner) {
            // STRICT USER REQUIREMENT:
            // "Quand quelqu'un se connecte avec son compte Gmail, il doit directement etre diriger au profil client et n'a pas accès à d'autres profil"
            const clientProfile: UserProfile = {
              id: firebaseUser.uid,
              email: firebaseUser.email || '',
              username: firebaseUser.displayName || (docSnap.exists() && docSnap.data()?.username) || 'Client Résidence',
              role: 'client'
            };
            if (!docSnap.exists() || docSnap.data()?.role !== 'client') {
              try {
                await setDoc(doc(db, 'users', firebaseUser.uid), {
                  ...clientProfile,
                  createdAt: new Date().toISOString()
                }, { merge: true });
              } catch (e) {}
            }
            setUser(clientProfile);
            setActiveTab('voc');
            setLoading(false);
            return;
          }

          if (docSnap.exists()) {
            const data = docSnap.data();
            setUser({ 
              id: firebaseUser.uid, 
              email: data.email || firebaseUser.email || '',
              username: data.username || firebaseUser.displayName || (isOwner ? 'Super Administrateur' : 'Utilisateur'),
              role: isOwner ? 'admin' : (data.role || 'staff'),
              ...data,
              ...(isOwner ? { role: 'admin' } : {})
            } as UserProfile);
          } else {
            // User exists but has no profile record yet
            if (isOwner) {
              setUser({
                id: firebaseUser.uid,
                email: firebaseUser.email || '',
                username: 'Super Administrateur',
                role: 'admin'
              });
            } else {
              setUser({
                id: firebaseUser.uid,
                email: firebaseUser.email || '',
                username: firebaseUser.displayName || 'Utilisateur',
                role: 'pending_registration' as any
              });
            }
          }
          setLoading(false);
        }, (error) => {
          console.error('Error fetching user profile:', error);
          if (isGmailUser && !isOwner) {
            setUser({
              id: firebaseUser.uid,
              email: firebaseUser.email || '',
              username: firebaseUser.displayName || 'Client Résidence',
              role: 'client'
            } as UserProfile);
            setActiveTab('voc');
          } else {
            setUser({
              id: firebaseUser.uid,
              email: firebaseUser.email || '',
              username: firebaseUser.displayName || 'Utilisateur',
              role: isOwner ? 'admin' : 'receptionist'
            } as UserProfile);
          }
          setLoading(false);
        });
      } else {
        setUser(null);
        setLoading(false);
        if (unsubUser) unsubUser();
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubUser) unsubUser();
    };
  }, []);

  useEffect(() => {
    if (isAdmin) {
      requestNotificationPermission();
    }
  }, [isAdmin]);

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  // Presence Heartbeat & Initial Login Log
  useEffect(() => {
    if (!user) return;
    if (user.role === ('pending_registration' as any)) return;

    // Log initial session entry for current user session
    const sessionTokenKey = `active_login_session_${user.id}`;
    if (!sessionStorage.getItem(sessionTokenKey)) {
      const roleProfiles: Record<string, { title: string; location: string; scope: string }> = {
        admin: {
          title: 'Super Administrateur',
          location: 'Direction Générale & Siège',
          scope: 'Accès intégral au système : Supervision financière, comptabilité, gestion des stocks, tarification, utilisateurs et journal d\'audit.'
        },
        manager: {
          title: 'Gérant / Manager',
          location: 'Direction Opérationnelle',
          scope: 'Supervision globale de l\'établissement : Suivi des stocks, validation des dépenses, gestion des chambres et rapports journaliers.'
        },
        receptionist: {
          title: 'Réceptionniste',
          location: 'Réception & Hébergement',
          scope: 'Prise de poste à la réception : Accueil des clients, planning des réservations, check-in, check-out et facturation hôtel.'
        },
        caissiere: {
          title: 'Caissière (POS)',
          location: 'Caisse Principale & Point de Vente',
          scope: 'Prise de poste en caisse : Enregistrement des ventes POS, encaissements (espèces, mobile money, carte) et clôture journalière de caisse.'
        },
        serveur: {
          title: 'Serveur / Restaurant',
          location: 'Restaurant & Terrasse',
          scope: 'Prise de poste en salle : Prise des commandes clients et coordination du service en salle.'
        },
        cook: {
          title: 'Chef Cuisinier',
          location: 'Cuisine Centrale',
          scope: 'Prise de poste en cuisine : Réception et préparation des commandes repas, gestion des approvisionnements cuisine.'
        },
        barman: {
          title: 'Barman',
          location: 'Bar Lounge & Terrasse',
          scope: 'Prise de poste au bar : Service des boissons, cocktails et suivi du stock bar.'
        },
        valet_de_chambre: {
          title: 'Valet de Chambre / Gouvernante',
          location: 'Étages & Entretien Chambres',
          scope: 'Prise de poste gouvernante : Nettoyage, changement du statut des chambres et maintenance légère.'
        },
        client: {
          title: 'Client Résidence (VOC)',
          location: 'Espace Visiteur & Client',
          scope: 'Consultation des services et émission d\'avis / suggestions sur l\'expérience client.'
        }
      };

      const roleInfo = roleProfiles[user.role] || {
        title: user.role,
        location: 'Établissement',
        scope: 'Accès standard aux fonctionnalités autorisées pour ce profil.'
      };

      // Detect terminal & browser environment
      const ua = typeof navigator !== 'undefined' ? (navigator.userAgent || '') : '';
      let browserName = 'Navigateur Web';
      if (ua.includes('Firefox')) browserName = 'Firefox';
      else if (ua.includes('Edg')) browserName = 'Edge';
      else if (ua.includes('Chrome')) browserName = 'Chrome';
      else if (ua.includes('Safari')) browserName = 'Safari';

      let osName = 'Appareil';
      if (ua.includes('Win')) osName = 'Windows';
      else if (ua.includes('Mac')) osName = 'macOS';
      else if (ua.includes('Linux')) osName = 'Linux';
      else if (ua.includes('Android')) osName = 'Android';
      else if (ua.includes('iPhone') || ua.includes('iPad')) osName = 'iOS';

      const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
      const terminalDesc = `${isMobileDevice ? 'Mobile/Tablette' : 'Poste Bureau / PC'} (${browserName} sur ${osName})`;

      const nowTimeStr = format(new Date(), 'HH:mm:ss');
      const nowDateStr = format(new Date(), 'dd/MM/yyyy');

      const detailMsg = `Action : Authentification réussie & Prise de poste active\n` +
        `Poste & Rôle : ${roleInfo.title} (${user.role})\n` +
        `Affectation : ${roleInfo.location}\n` +
        `Périmètre d'action : ${roleInfo.scope}\n` +
        `Compte utilisateur : ${user.username} (${user.email || 'Compte local'})\n` +
        `Terminal & Navigateur : ${terminalDesc}\n` +
        `Heure de connexion : ${nowDateStr} à ${nowTimeStr}`;

      logEvent(user, 'Connexion', detailMsg);
      sessionStorage.setItem(sessionTokenKey, Date.now().toString());
    }

    updateUserPresence(user);
    const interval = setInterval(() => updateUserPresence(user), 2 * 60 * 1000);

    return () => clearInterval(interval);
  }, [user]);

  // Redirect users with restricted roles to permitted tabs
  useEffect(() => {
    if (!user) return;
    const userEmail = user.email?.toLowerCase() || '';
    const isAdminUser = userEmail === 'cyber.kan587@gmail.com' || user.role === 'admin';

    if (isAdminUser) return;

    if (user.role === 'client' && activeTab !== 'voc') {
      setActiveTab('voc');
    } else if (user.role === 'caissiere' && !['dashboard', 'pos', 'kitchen', 'chicha', 'inventory', 'rooms', 'halls', 'quotes', 'housekeeping', 'chat', 'guide', 'voc'].includes(activeTab)) {
      setActiveTab('pos');
    } else if (user.role === 'serveur' && !['dashboard', 'pos', 'kitchen', 'maintenance', 'chicha', 'inventory', 'rooms', 'halls', 'housekeeping', 'chat', 'guide', 'voc'].includes(activeTab)) {
      setActiveTab('kitchen');
    } else if (user.role === 'valet_de_chambre' && !['housekeeping', 'rooms', 'halls', 'chat', 'guide', 'voc'].includes(activeTab)) {
      setActiveTab('housekeeping');
    }
  }, [user, activeTab]);

  const userId = user?.id;

  useEffect(() => {
    if (!userId) return;

    // Purge and reset database and cached sales on startup
    if (localStorage.getItem('database_wiped_v1') !== 'true') {
      try {
        localStorage.removeItem('residence_sales');
        localStorage.removeItem('residence_products');
        localStorage.removeItem('residence_rooms');
        localStorage.removeItem('residence_halls');
        localStorage.removeItem('residence_pool_tickets');
        localStorage.removeItem('residence_bookings');
        localStorage.removeItem('residence_reservations');
        localStorage.removeItem('residence_expenses');
        localStorage.removeItem('residence_maintenance_tasks');
        localStorage.removeItem('residence_cleaning_tasks');
        localStorage.removeItem('residence_notifications');
        localStorage.setItem('residence_sales', '[]');
        localStorage.setItem('database_wiped_v1', 'true');
        setSales([]);
        setProducts([]);
        setRooms([]);
        setHalls([]);
      } catch (e) {}
    }

    const qProducts = query(collection(db, 'products'), orderBy('name'));
    const unsubProducts = onSnapshot(qProducts, (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'products'));

    const qSales = query(collection(db, 'sales'), orderBy('timestamp', 'desc'));
    const unsubSales = onSnapshot(qSales, (snapshot) => {
      const newSales = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sale));
      setSales(newSales);
      try {
        localStorage.setItem('residence_sales', JSON.stringify(newSales.slice(0, 100)));
      } catch (e) {
        console.warn("Storage quota notice for sales cache:", e);
      }
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'sales'));

    const qRooms = query(collection(db, 'rooms'), orderBy('number'));
    const unsubRooms = onSnapshot(qRooms, (snapshot) => {
      setRooms(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Room)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'rooms'));

    const qNotifications = query(collection(db, 'notifications'), orderBy('timestamp', 'desc'), limit(20));
    const unsubNotifications = onSnapshot(qNotifications, (snapshot) => {
      setNotifications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppNotification)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'notifications'));

    // Listener for unread chat messages
    const unsubChat = onSnapshot(collection(db, 'messages'), (snapshot) => {
      const activeUid = userRef.current?.id;
      if (!activeUid) return;
      const unreadCount = snapshot.docs.filter(doc => {
        const msg = doc.data();
        if (!msg || !msg.senderId || msg.senderId === activeUid) return false;
        
        // Check if message is a private DM (channelId contains '_')
        if (msg.channelId && typeof msg.channelId === 'string' && msg.channelId.includes('_')) {
          const participants = msg.channelId.split('_');
          if (!participants.includes(activeUid)) {
            // Private DM between two other users -> do not count for current user
            return false;
          }
        }

        // Count if message hasn't been read by current user
        const readBy = msg.readBy;
        const hasRead = Array.isArray(readBy) && readBy.includes(activeUid);
        return !hasRead;
      }).length;
      setUnreadChatCount(unreadCount);
    }, (error) => {
      console.warn("Notice in unread chat listener:", error);
    });

    const qHalls = query(collection(db, 'halls'), orderBy('name', 'asc'));
    const unsubHalls = onSnapshot(qHalls, (snapshot) => {
      setHalls(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Hall)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'halls'));

    // Listener for pending kitchen orders
    const qKitchen = query(
      collection(db, 'sales'),
      where('kitchenStatus', 'in', ['Pending', 'Preparing', 'Ready'])
    );
    const unsubKitchen = onSnapshot(qKitchen, (snapshot) => {
      setPendingKitchenCount(snapshot.docs.length);
    }, (error) => {
      console.warn("Notice in kitchen orders listener:", error);
    });

    // Listener for pending maintenance tasks
    const qMaintenance = query(
      collection(db, 'maintenance_tasks'),
      where('status', 'in', ['Pending', 'NeedSubmitted', 'Accepted'])
    );
    const unsubMaintenance = onSnapshot(qMaintenance, (snapshot) => {
      setPendingMaintenanceCount(snapshot.docs.length);
    }, (error) => {
      console.warn("Notice in maintenance tasks listener:", error);
    });

    return () => {
      unsubHalls();
      unsubProducts();
      unsubSales();
      unsubRooms();
      unsubNotifications();
      unsubChat();
      unsubKitchen();
      unsubMaintenance();
    };
  }, [userId]);

  const acknowledgeNotification = async (id: string) => {
    if (!user) return;
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, readBy: Array.from(new Set([...(n.readBy || []), user.id])) } : n));
    try {
      await updateDoc(doc(db, 'notifications', id), {
        readBy: arrayUnion(user.id)
      });
    } catch (error) {
      console.warn("Notice acknowledging notification in Firestore:", error);
    }
  };

  const [editingExpenseNotification, setEditingExpenseNotification] = useState<{
    notificationId: string;
    expenseId?: string;
    description: string;
    amount: number | string;
    category: Expense['category'];
    location: string;
  } | null>(null);

  const handleValidateExpenseFromNotification = async (
    notificationId: string, 
    expenseId: string | undefined, 
    actionStatus: 'Approved' | 'Rejected',
    expenseData?: any
  ) => {
    if (!user || !isAdmin) {
      toast.error("Seuls les administrateurs ont le droit de valider les dépenses.");
      return;
    }
    
    // Optimistic update to remove notification from UI
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
    
    try {
      let targetExpId = expenseId;
      if (!targetExpId && expenseData?.description) {
        // Fallback search in expenses if notification had no explicit expenseId
        try {
          const qExp = query(
            collection(db, 'expenses'),
            where('status', '==', 'Pending'),
            where('description', '==', expenseData.description),
            limit(1)
          );
          const snap = await getDocs(qExp);
          if (!snap.empty) {
            targetExpId = snap.docs[0].id;
          }
        } catch (e) {
          console.warn("Notice searching expense fallback:", e);
        }
      }

      if (targetExpId) {
        await updateDoc(doc(db, 'expenses', targetExpId), {
          status: actionStatus,
          validatedBy: user.username
        });
      }

      // Delete the validated notification completely so it can never reappear
      try {
        await deleteDoc(doc(db, 'notifications', notificationId));
      } catch (notifErr) {
        console.warn("Notice deleting notification:", notifErr);
      }

      // Dismiss and delete any other duplicate pending notifications for this expense
      try {
        const notifSnap = await getDocs(collection(db, 'notifications'));
        const toDelete: any[] = [];
        notifSnap.docs.forEach(d => {
          if (d.id === notificationId) return;
          const data = d.data();
          const matchesId = targetExpId && data.expenseId === targetExpId;
          const expDesc = (expenseData?.description || '').toLowerCase().trim();
          const matchesDesc = expDesc && (
            data.expenseData?.description?.toLowerCase().trim() === expDesc ||
            (data.message && data.message.toLowerCase().includes(expDesc))
          );
          const isPending = data.type === 'expense' || (data.message && data.message.toLowerCase().includes('en attente de validation'));
          if (isPending && (matchesId || matchesDesc)) {
            toDelete.push(d.ref);
          }
        });
        if (toDelete.length > 0) {
          const b = writeBatch(db);
          toDelete.forEach(ref => b.delete(ref));
          await b.commit();
        }
      } catch (e) {
        console.warn("Notice dismissing duplicate notifications:", e);
      }

      // Send confirmation notification ONLY to the employee who recorded the expense (never to the admin!)
      const recorderId = expenseData?.recordedById;
      if (recorderId && recorderId !== user.id) {
        try {
          await addDoc(collection(db, 'notifications'), {
            type: 'system',
            targetUserId: recorderId,
            message: `Votre dépense "${expenseData?.description || 'demandée'}" a été ${actionStatus === 'Approved' ? 'validée' : 'rejetée'} par ${user.username}.`,
            timestamp: serverTimestamp(),
            readBy: [user.id],
            handled: true
          });
        } catch (e) {
          console.warn("Notice sending confirmation notification to recorder:", e);
        }
      }

      if (actionStatus === 'Approved') {
        toast.success("Dépense validée avec succès !");
      } else {
        toast.info("Dépense rejetée.");
      }
    } catch (error) {
      console.error("Error validating expense from notification:", error);
      toast.error("Erreur lors de la validation de la dépense.");
      // Rollback not strictly necessary here as it will re-fetch on refresh
    }
  };

  const handleSaveEditedExpenseNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExpenseNotification || !user || !isAdmin) return;
    const { notificationId, expenseId, description, amount, category, location } = editingExpenseNotification;
    
    try {
      if (expenseId) {
        await updateDoc(doc(db, 'expenses', expenseId), {
          description: description.trim(),
          amount: Number(amount),
          category,
          location,
          status: 'Approved',
          validatedBy: user.username
        });
      }
      await acknowledgeNotification(notificationId);
      toast.success("Dépense modifiée et validée avec succès !");
      setEditingExpenseNotification(null);
    } catch (error) {
      console.error("Error editing expense from notification:", error);
      toast.error("Erreur lors de la modification de la dépense.");
    }
  };

  const handleValidateMaintenanceFromNotification = async (notificationId: string, taskId: string, actionType: 'approve' | 'pending' | 'reject' | 'acknowledge') => {
    if (!user) return;
    try {
      if (actionType === 'acknowledge') {
        await acknowledgeNotification(notificationId);
        toast.info("Notification de maintenance prise en compte.");
        return;
      }

      const taskRef = doc(db, 'maintenance_tasks', taskId);
      const taskSnap = await getDoc(taskRef);
      if (!taskSnap.exists()) {
        toast.error("Tâche de maintenance introuvable.");
        await acknowledgeNotification(notificationId);
        return;
      }
      const taskData = taskSnap.data();

      const batch = writeBatch(db);

      if (actionType === 'approve') {
        // Approuver le remplacement/intervention -> passe le statut à 'Pending' (En attente du matériel ou réalisation)
        batch.update(taskRef, {
          status: 'Pending',
          materialApprovedBy: user.username,
          materialApprovedById: user.id,
          materialApprovedAt: serverTimestamp()
        });
        toast.success("Remplacement / Tâche de maintenance validé !");
      } else if (actionType === 'pending') {
        // Mettre la tâche en attente
        batch.update(taskRef, {
          status: 'Pending',
          materialApprovedBy: user.username,
          materialApprovedById: user.id,
          materialApprovedAt: serverTimestamp(),
          adminNote: 'Mise en attente par la direction'
        });
        toast.info("Tâche de maintenance mise en attente.");
      } else if (actionType === 'reject') {
        // Rejeter le besoin -> passe le statut à 'Rejected' et libère la chambre/salle si besoin
        batch.update(taskRef, {
          status: 'Rejected',
          validatedBy: user.username,
          validatedById: user.id,
          validatedAt: serverTimestamp()
        });

        const location = taskData.location || '';
        if (location.startsWith('Chambre ')) {
          const roomNumberStr = location.replace('Chambre ', '');
          const matchingRoom = rooms.find(r => r.number === roomNumberStr);
          if (matchingRoom) {
            batch.update(doc(db, 'rooms', matchingRoom.id), { status: 'Available' });
          }
        } else if (location.startsWith('Salle "')) {
          const hallNameStr = location.substring(7, location.length - 1);
          const matchingHall = halls.find(h => h.name === hallNameStr);
          if (matchingHall) {
            batch.update(doc(db, 'halls', matchingHall.id), { status: 'Available' });
          }
        }
        toast.info("Demande de maintenance rejetée.");
      }

      await batch.commit();

      try {
        // Mark notification as read by current user
        await updateDoc(doc(db, 'notifications', notificationId), {
          readBy: arrayUnion(user.id)
        });
      } catch (notifErr) {
        console.warn("Notice updating maintenance notification status:", notifErr);
      }
    } catch (error) {
      console.error("Error validating task from notification:", error);
      toast.error("Erreur de validation ou de permissions.");
    }
  };

  if (showSplash) return <SplashScreen settings={settings} />;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#FDFBF7]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || user.role === 'pending_registration' as any) {
    return <Login onLogin={() => window.location.reload()} settings={settings} user={user} />;
  }

  const rawMenuItems = [
    { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
    { id: 'pos', label: 'Ventes (POS)', icon: ShoppingCart },
    ...((isAdmin || isManager || isCook || user?.role === 'serveur' || user?.role === 'caissiere' || user?.role === 'receptionist') ? [
      { id: 'kitchen', label: 'Restaurant / Cuisine', icon: ChefHat }
    ] : []),
    { id: 'chicha', label: 'Espace Chicha', icon: Flame, isBoldRed: true },
    { id: 'inventory', label: 'Stock', icon: Package },
    ...((isAdmin || isManager) ? [
      { id: 'magasin', label: 'Magasin Central', icon: Warehouse, isYellow: true }
    ] : []),
    { id: 'rooms', label: 'Hôtel', icon: Hotel },
    { id: 'halls', label: 'Salles', icon: Building },
    { id: 'quotes', label: 'Devis et Factures', icon: FileSpreadsheet, isBlue: true },
    { id: 'housekeeping', label: 'Nettoyage', icon: SprayCan },
    { id: 'maintenance', label: 'Maintenance', icon: Wrench },
    ...(isReceptionist ? [
      { id: 'guests', label: 'Clients (CRM)', icon: Users }
    ] : []),
    { id: 'bookings', label: 'Historique', icon: History },
    { id: 'voc', label: 'Avis Client (VOC)', icon: Star },
    { id: 'expenses', label: 'Dépenses', icon: Wallet },
    ...((isAdmin || isManager) ? [
      { id: 'stats', label: 'Statistiques', icon: BarChart3 }
    ] : []),
    ...(isAdmin ? [
      { id: 'users', label: 'Administration', icon: Shield }
    ] : []),
    ...(isManager ? [
      { id: 'settings', label: 'Paramètres', icon: SettingsIcon }
    ] : []),
    ...(isAdmin ? [
      { id: 'event-log', label: 'Journal', icon: Activity }
    ] : []),
    ...((isAdmin || isManager) ? [
      { id: 'report', label: 'Rapport', icon: FileText }
    ] : []),
    { id: 'chat', label: 'Conversations', icon: MessageSquare },
    { id: 'guide', label: 'Guide', icon: BookOpen },
  ];

  const menuItems = rawMenuItems.filter(item => {
    const userEmail = user?.email?.toLowerCase() || '';
    const isAdminUser = userEmail === 'cyber.kan587@gmail.com' || user?.role === 'admin';
    const isGmailUser = userEmail.endsWith('@gmail.com');

    if (isGmailUser && !isAdminUser) {
      return ['voc'].includes(item.id);
    }
    if (user?.role === 'client') {
      return ['voc'].includes(item.id);
    }
    if (user?.role === 'caissiere') {
      return ['dashboard', 'pos', 'kitchen', 'chicha', 'inventory', 'rooms', 'halls', 'quotes', 'housekeeping', 'chat', 'guide', 'voc'].includes(item.id);
    }
    if (user?.role === 'serveur') {
      return ['dashboard', 'pos', 'kitchen', 'maintenance', 'chicha', 'inventory', 'rooms', 'halls', 'housekeeping', 'chat', 'guide', 'voc'].includes(item.id);
    }
    if (user?.role === 'valet_de_chambre') {
      return ['housekeeping', 'rooms', 'halls', 'chat', 'guide', 'voc'].includes(item.id);
    }
    return true;
  });

  const getBadgeCountForItem = (itemId: string): number => {
    if (itemId === 'chat') return unreadChatCount;
    if (itemId === 'kitchen') return pendingKitchenCount;
    if (itemId === 'housekeeping') {
      return rooms.filter(r => r.status === 'Cleaning').length + halls.filter(h => h.status === 'Cleaning').length;
    }
    if (itemId === 'maintenance') return pendingMaintenanceCount;
    return 0;
  };

  const currentEmail = user?.email?.toLowerCase() || '';
  const isGmailUser = currentEmail.endsWith('@gmail.com');
  const isAdminUser = currentEmail === 'cyber.kan587@gmail.com' || user?.role === 'admin';

  return (
    <ErrorBoundary>
      <div className="flex min-h-screen bg-[#FDFBF7]">
        {/* Sidebar */}
        <aside className={cn(
          "bg-primary text-white shadow-2xl shadow-primary/20 hidden lg:flex flex-col relative z-20 transition-all duration-300 ease-in-out shrink-0",
          isSidebarCollapsed ? "w-20" : "w-64"
        )}>
          {/* Collapse manual toggle button */}
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="absolute -right-3 top-24 w-6 h-6 bg-primary border border-white/20 text-white rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform cursor-pointer z-30"
          >
            {isSidebarCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
          </button>

          <div className={cn(
            "p-6 border-b border-white/10 flex flex-col items-center transition-all duration-300",
            isSidebarCollapsed ? "p-3" : "p-6"
          )}>
            <div className={cn(
              "rounded-full bg-[#FDFBF7] flex items-center justify-center border-2 border-white/20 overflow-hidden shadow-inner transition-all duration-300",
              isSidebarCollapsed ? "w-10 h-10 mb-0" : "w-20 h-20 mb-3"
            )}>
              <img 
                src={settings?.logoUrl || "/logo.png"} 
                alt="Logo" 
                className="w-full h-full object-contain" 
                onError={(e) => {
                  const target = e.currentTarget;
                  if (!target.src.includes('/logo.png')) {
                    target.src = '/logo.png';
                  } else if (target.parentElement) {
                    target.parentElement.innerHTML = `<span class="${isSidebarCollapsed ? 'text-sm' : 'text-xl'} font-bold text-primary">${settings?.hotelName?.[0] || 'HQ'}</span>`;
                  }
                }} 
              />
            </div>
            {!isSidebarCollapsed && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center"
              >
                <h1 className="text-xl font-bold tracking-tight font-serif italic">{settings?.hotelName || 'Résidence HQ'}</h1>
                <p className="text-[10px] font-medium uppercase tracking-widest opacity-70 mt-1">Gestion Pro</p>
              </motion.div>
            )}
          </div>
          
          <nav className={cn(
            "flex-1 p-4 space-y-2 overflow-y-auto custom-scrollbar transition-all duration-300",
            isSidebarCollapsed ? "p-2 space-y-3" : "p-4 space-y-2"
          )}>
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as any)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 font-bold tracking-tight transition-all group rounded-xl relative",
                  activeTab === item.id 
                    ? "bg-white text-primary shadow-md" 
                    : "text-white/80 hover:bg-white/10 hover:text-white",
                  isSidebarCollapsed && "justify-center px-0 py-3"
                )}
                title={item.label}
              >
                <div className={cn(
                  "relative shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:-translate-y-0.5",
                  activeTab === item.id 
                    ? "bg-gradient-to-br from-white via-amber-50/80 to-amber-100/50 shadow-[0_8px_20px_rgba(0,0,0,0.18),inset_0_1px_1px_rgba(255,255,255,0.9),inset_0_-2px_4px_rgba(0,0,0,0.08)] border border-amber-200/80"
                    : "bg-gradient-to-br from-white/20 via-white/5 to-black/30 shadow-[0_6px_16px_rgba(0,0,0,0.25),inset_0_1px_1px_rgba(255,255,255,0.3),inset_0_-2px_4px_rgba(0,0,0,0.4)] border border-white/15"
                )}>
                  <item.icon className={cn(
                    "w-5 h-5 transition-transform drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]",
                    item.id === 'chicha' 
                      ? "text-red-500 fill-red-500/20 stroke-[2.5] font-black drop-shadow-[0_0_10px_rgba(239,68,68,0.7)] animate-pulse" 
                      : item.id === 'magasin'
                        ? "text-yellow-400 fill-yellow-400/20 stroke-[2.5] drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]"
                        : item.id === 'quotes'
                          ? "text-blue-400 fill-blue-400/20 stroke-[2.5] drop-shadow-[0_0_8px_rgba(96,165,250,0.5)]"
                          : activeTab === item.id 
                            ? "text-primary drop-shadow-[0_1px_2px_rgba(0,0,0,0.1)]" 
                            : "text-white/90 group-hover:text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.4)]"
                  )} />
                  {getBadgeCountForItem(item.id) > 0 && activeTab !== item.id && (
                    <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full shadow-md border-2 border-primary animate-pulse px-1 z-10">
                      {getBadgeCountForItem(item.id) > 99 ? '99+' : getBadgeCountForItem(item.id)}
                    </span>
                  )}
                </div>
                {!isSidebarCollapsed && (
                  <motion.span
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex-1 truncate"
                  >
                    {item.label}
                  </motion.span>
                )}
                {!isSidebarCollapsed && getBadgeCountForItem(item.id) > 0 && activeTab !== item.id && (
                  <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                    {getBadgeCountForItem(item.id)}
                  </span>
                )}
              </button>
            ))}
          </nav>

          <div className="p-4 border-t border-white/10 bg-black/10 transition-all duration-300">
            <div className={cn(
              "flex items-center gap-3 p-3 mb-2 transition-all duration-300",
              isSidebarCollapsed ? "justify-center p-1" : "p-3"
            )}>
              <div className="w-10 h-10 bg-secondary flex items-center justify-center text-[#2B2321] font-bold rounded-full shadow-sm shrink-0">
                {user.username[0]}
              </div>
              {!isSidebarCollapsed && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="overflow-hidden"
                >
                  <p className="font-bold tracking-tight truncate">{user.username}</p>
                  <p className="text-[10px] font-medium uppercase opacity-70">{user.role}</p>
                </motion.div>
              )}
            </div>
            <button 
              onClick={handleLogout}
              className={cn(
                "w-full flex items-center font-bold tracking-tight text-red-300 hover:bg-red-500/20 hover:text-red-100 rounded-xl transition-all",
                isSidebarCollapsed ? "justify-center p-3" : "gap-3 px-4 py-3"
              )}
              title="Déconnexion"
            >
              <LogOut className="w-5 h-5" />
              {!isSidebarCollapsed && <span>Déconnexion</span>}
            </button>
            {!isSidebarCollapsed && (
              <div className="mt-4 pt-4 border-t border-white/10 text-center">
                <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest">
                  © 2026 Empreintes Technologies
                </p>
              </div>
            )}
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col min-w-0 pb-20 lg:pb-0">
          {/* Header */}
          <header className="h-16 lg:h-20 bg-white/80 backdrop-blur-md border-b border-[#E5C198]/30 flex items-center justify-between px-4 lg:px-8 sticky top-0 z-10 shadow-sm">
            <div className="flex items-center gap-4">
              <h2 className="text-xl lg:text-2xl font-bold tracking-tight text-[#2B2321]">
                {menuItems.find(m => m.id === activeTab)?.label}
              </h2>
            </div>
            <div className="flex items-center gap-3 lg:gap-4">
              {/* Broadcast / Update Button for Admins & Managers */}
              {(isAdmin || isManager) && (
                <button 
                  onClick={() => setShowBroadcastModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FDFBF7] hover:bg-primary/10 text-primary border border-primary/20 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer active:scale-95"
                  title="Diffuser une annonce à tous les utilisateurs ou publier une mise à jour"
                >
                  <Megaphone className="w-4 h-4 text-primary" />
                  <span className="hidden sm:inline">Diffuser / Mise à jour</span>
                </button>
              )}

              <div className="relative">
                <button 
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative p-2 text-primary hover:bg-[#FDFBF7] rounded-full transition-colors"
                >
                  <Bell className="w-5 h-5 lg:w-6 lg:h-6" />
                  {totalNotificationBadgeCount > 0 && (
                    <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">
                      {totalNotificationBadgeCount}
                    </span>
                  )}
                </button>
                
                <AnimatePresence>
                  {showNotifications && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute right-0 mt-2 w-72 lg:w-80 bg-white border border-[#E5C198]/30 shadow-2xl shadow-primary/20 rounded-2xl overflow-hidden z-50"
                    >
                      <div className="p-3.5 border-b border-[#E5C198]/30 bg-[#FDFBF7] flex items-center justify-between">
                        <h3 className="font-bold uppercase tracking-widest text-xs text-primary">Notifications</h3>
                        {(isAdmin || isManager) && (
                          <button
                            onClick={() => {
                              setShowNotifications(false);
                              setShowBroadcastModal(true);
                            }}
                            className="text-[10px] font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <Megaphone className="w-3 h-3" /> Diffuser à tous
                          </button>
                        )}
                      </div>
                      <div className="max-h-96 overflow-y-auto">
                        {totalNotificationBadgeCount > 0 ? (
                          <div className="divide-y divide-[#E5C198]/10">
                             {unreadNotifications.map(notif => {
                               const isMaintenance = notif.type === 'maintenance';
                               const isValidationConfirmation = notif.message && (
                                 notif.message.toLowerCase().includes('a été validée') || 
                                 notif.message.toLowerCase().includes('a été rejetée') ||
                                 notif.message.toLowerCase().includes('validée par') ||
                                 notif.message.toLowerCase().includes('rejetée par')
                               );
                               const isExpense = !isValidationConfirmation && !notif.handled && (
                                 notif.type === 'expense' || 
                                 notif.targetRole === 'admin_only' || 
                                 (notif.message && notif.message.toLowerCase().includes('en attente de validation') && 
                                  (notif.message.toLowerCase().includes('dépense') || notif.message.toLowerCase().includes('depense')))
                               );
                               const isChauffeur = notif.source === 'chauffeur' || notif.type === 'chauffeur';
                               const isAdminHQ = notif.source === 'admin_hq' || notif.type === 'admin_hq';
                               return (
                                 <div key={notif.id} className="p-4 hover:bg-[#FDFBF7] transition-colors flex items-start gap-3">
                                   {isChauffeur ? (
                                     <Car className="w-5 h-5 text-[#1A8B8C] shrink-0 mt-0.5" />
                                   ) : isAdminHQ ? (
                                     <Shield className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                                   ) : notif.type === 'app_update' ? (
                                     <Rocket className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5 animate-bounce" />
                                   ) : notif.type === 'broadcast' ? (
                                     <Megaphone className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                                   ) : isExpense ? (
                                     <DollarSign className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                                   ) : notif.type === 'order_ready' ? (
                                     <Utensils className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                                   ) : isMaintenance ? (
                                     <Wrench className="w-5 h-5 text-[#1A8B8C] shrink-0 mt-0.5" />
                                   ) : (
                                     <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                                   )}
                                   <div className="flex-1 min-w-0">
                                     <p className="font-bold text-[#2B2321] text-sm">{notif.message}</p>
                                     <p className="text-[10px] text-primary/60 mt-1 uppercase tracking-widest font-bold">
                                       {notif.timestamp?.toDate ? format(notif.timestamp.toDate(), 'HH:mm') : '-'}
                                     </p>

                                     {notif.type === 'app_update' && (
                                       <button
                                         onClick={() => {
                                           if ((notif as any).version) {
                                             localStorage.setItem('residence_app_version', (notif as any).version);
                                           }
                                           acknowledgeNotification(notif.id);
                                           window.location.reload();
                                         }}
                                         className="mt-2 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer shadow-xs"
                                       >
                                         <RefreshCw className="w-3 h-3" /> Mettre à jour l'application
                                       </button>
                                     )}
                                   </div>
                                   {isExpense && isAdmin ? (
                                     <div className="flex flex-col gap-1 shrink-0 self-center">
                                       <div className="flex items-center gap-1">
                                         <button
                                           onClick={(e) => {
                                             e.stopPropagation();
                                             handleValidateExpenseFromNotification(notif.id, notif.expenseId, 'Approved', notif.expenseData);
                                           }}
                                           title="Valider la dépense"
                                           className="p-1.5 hover:bg-emerald-50 text-emerald-600 rounded-full cursor-pointer transition-colors border border-emerald-100/50"
                                         >
                                           <CheckCircle className="w-4 h-4" />
                                         </button>
                                         <button
                                           onClick={(e) => {
                                             e.stopPropagation();
                                             handleValidateExpenseFromNotification(notif.id, notif.expenseId, 'Rejected', notif.expenseData);
                                           }}
                                           title="Rejeter la dépense"
                                           className="p-1.5 hover:bg-red-50 text-red-500 rounded-full cursor-pointer transition-colors border border-red-100/50"
                                         >
                                           <XCircle className="w-4 h-4" />
                                         </button>
                                         <button
                                           onClick={(e) => {
                                             e.stopPropagation();
                                             setEditingExpenseNotification({
                                               notificationId: notif.id,
                                               expenseId: notif.expenseId,
                                               description: notif.expenseData?.description || notif.message.replace(/💸 Dépense en attente de validation : |Nouvelle dépense en attente de validation: /g, '').split(' (')[0] || '',
                                               amount: notif.expenseData?.amount || 0,
                                               category: notif.expenseData?.category || 'Other',
                                               location: notif.expenseData?.location || 'Réception'
                                             });
                                           }}
                                           title="Modifier la dépense"
                                           className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-full cursor-pointer transition-colors border border-blue-100/50"
                                         >
                                           <Edit2 className="w-4 h-4" />
                                         </button>
                                       </div>
                                     </div>
                                    ) : (isExpense || !isMaintenance) ? (
                                     <button 
                                       onClick={(e) => {
                                          e.stopPropagation();
                                          acknowledgeNotification(notif.id);
                                        }}
                                        className="p-1 hover:bg-green-50 rounded-full text-green-600 cursor-pointer"
                                      >
                                        <CheckCircle className="w-4 h-4" />
                                      </button>
                                    ) : (
                                      <div className="flex flex-col gap-1 shrink-0 self-center">
                                        {(isAdmin || isManager) && notif.maintenanceTaskId ? (
                                          <div className="flex items-center gap-1">
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleValidateMaintenanceFromNotification(notif.id, notif.maintenanceTaskId!, 'reject');
                                              }}
                                              title="Rejeter"
                                              className="p-1 hover:bg-red-50 text-red-500 rounded-full cursor-pointer transition-colors border border-red-100/50"
                                            >
                                              <XCircle className="w-4 h-4" />
                                            </button>
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleValidateMaintenanceFromNotification(notif.id, notif.maintenanceTaskId!, 'pending');
                                              }}
                                              title="Mettre en attente"
                                              className="p-1 hover:bg-amber-50 text-amber-600 rounded-full cursor-pointer transition-colors border border-amber-100/50"
                                            >
                                              <Clock className="w-4 h-4" />
                                            </button>
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleValidateMaintenanceFromNotification(notif.id, notif.maintenanceTaskId!, 'approve');
                                              }}
                                              title="Valider"
                                              className="p-1 hover:bg-emerald-50 text-emerald-600 rounded-full cursor-pointer transition-colors border border-emerald-100/50"
                                            >
                                              <CheckCircle className="w-4 h-4" />
                                            </button>
                                          </div>
                                        ) : null}
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            acknowledgeNotification(notif.id);
                                          }}
                                          title="Prendre connaissance (Poursuivre le travail)"
                                          className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-lg text-[9px] font-bold border border-amber-200 cursor-pointer transition-all flex items-center gap-1 shadow-xs"
                                        >
                                          <CheckCircle className="w-3 h-3 text-amber-600" />
                                          Pris connaissance
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                             {isInventoryRole && lowStockProducts.map(product => (
                               <div key={product.id} className="p-4 hover:bg-[#FDFBF7] transition-colors flex items-start gap-3">
                                 <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                                 <div>
                                   <p className="font-bold text-[#2B2321] text-sm">{product.name}</p>
                                   <p className="text-xs text-primary mt-1">Stock bas : <span className="font-bold text-red-500">{product.stock}</span> restants</p>
                                 </div>
                               </div>
                             ))}
                          </div>
                        ) : (
                          <div className="p-8 text-center text-[#2B2321]/60 text-sm">
                            {isClient 
                              ? "Aucune notification. Vous recevrez ici les alertes de votre chauffeur et de l'Admin HQ."
                              : "Aucune notification"}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <div className="hidden sm:flex flex-col items-end">
                <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Date du jour</p>
                <p className="font-bold tracking-tight text-[#2B2321]">{format(new Date(), 'EEEE d MMMM yyyy', { locale: fr })}</p>
              </div>
              
              {/* Mobile Logout Button */}
              <button 
                onClick={handleLogout}
                className="lg:hidden p-2 text-red-500 hover:bg-red-50 rounded-full transition-colors"
                title="Déconnexion"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </header>

          {/* Content Area */}
          <div className={cn(
            "p-3 sm:p-4 lg:p-8 overflow-y-auto max-w-[1600px] mx-auto w-full",
            activeTab === 'chat' && "p-2 lg:p-3 h-[calc(100vh-64px)] lg:h-[calc(100vh-80px)] overflow-hidden flex flex-col"
          )}>
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className={cn(activeTab === 'chat' && "h-full flex flex-col flex-1 min-h-0")}
              >
                {activeTab === 'dashboard' && <Dashboard products={products} sales={sales} isAdmin={isManager} settings={settings} rooms={rooms} user={user} />}
                {activeTab === 'pos' && <POS products={products} user={user} settings={settings} halls={halls} isAdmin={isAdmin} isManager={isManager} />}
                {activeTab === 'kitchen' && <KitchenModule user={user} settings={settings} />}
                {activeTab === 'chicha' && <ChichaModule user={user} settings={settings} rooms={rooms} />}
                {activeTab === 'inventory' && <Inventory products={products} isAdmin={isManager} settings={settings} user={user} />}
                {activeTab === 'magasin' && <MagasinModule user={user} settings={settings} products={products} />}
                {activeTab === 'rooms' && <RoomManagement rooms={rooms} isAdmin={isManager} user={user} settings={settings} />}
                {activeTab === 'halls' && <HallManagement user={user} onSell={() => setActiveTab('pos')} />}
                {activeTab === 'quotes' && <QuotesAndInvoices user={user} settings={settings} products={products} rooms={rooms} halls={halls} />}
                {activeTab === 'housekeeping' && <Housekeeping rooms={rooms} halls={halls} user={user} />}
                {activeTab === 'maintenance' && <MaintenanceManagement user={user} rooms={rooms} halls={halls} settings={settings} />}
                {activeTab === 'guests' && isReceptionist && <GuestManagement isAdmin={isManager} user={user} settings={settings} />}
                {activeTab === 'bookings' && <BookingHistory settings={settings} isAdmin={isAdmin} user={user} />}
                {activeTab === 'expenses' && <ExpenseManagement user={user} settings={settings} />}
                {activeTab === 'voc' && <VoiceOfCustomer user={user} settings={settings} onLogout={handleLogout} />}
                {activeTab === 'stats' && (isAdmin || isManager) && <Stats sales={sales} settings={settings} />}
                {activeTab === 'users' && <UserManagement isAdmin={isAdmin} user={user} settings={settings} />}
                {activeTab === 'settings' && <SettingsManagement isAdmin={isManager} />}
                {activeTab === 'event-log' && <EventLog user={user} />}
                {activeTab === 'report' && <ReportModule settings={settings} user={user} isAdmin={isAdmin} isManager={isManager} />}
                {activeTab === 'guide' && <UserGuide user={user} settings={settings} />}
                {activeTab === 'chat' && <ChatModule user={user} />}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>

        {/* Mobile Bottom Navigation */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-[#E5C198]/30 flex flex-nowrap justify-start sm:justify-around items-center p-2 z-50 pb-safe shadow-[0_-4px_20px_rgba(26,139,140,0.05)] overflow-x-auto hide-scrollbar">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={cn(
                "flex flex-col items-center justify-center min-w-[64px] py-2 gap-1 rounded-xl transition-all relative",
                activeTab === item.id 
                  ? item.id === 'chicha' ? "text-red-600" : item.id === 'magasin' ? "text-yellow-600 font-extrabold" : "text-primary" 
                  : item.id === 'chicha' ? "text-red-500 font-bold" : item.id === 'magasin' ? "text-yellow-600 font-bold" : "text-[#2B2321]/40 hover:text-primary/70"
              )}
            >
              <div className="relative">
                <item.icon className={cn(
                  "w-5 h-5", 
                  item.id === 'chicha' ? "text-red-600 fill-red-600 stroke-[2.5]" : item.id === 'magasin' ? "text-yellow-600 stroke-[2.5]" : activeTab === item.id ? "text-primary" : ""
                )} />
                {getBadgeCountForItem(item.id) > 0 && activeTab !== item.id && (
                  <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] font-bold min-w-[16px] h-[16px] flex items-center justify-center rounded-full shadow-sm border-2 border-white px-0.5 animate-pulse">
                    {getBadgeCountForItem(item.id) > 99 ? '99+' : getBadgeCountForItem(item.id)}
                  </span>
                )}
              </div>
              <span className={cn(
                "text-[9px] font-bold uppercase tracking-widest truncate w-full text-center px-1",
                item.id === 'chicha' && "text-red-600 font-extrabold",
                item.id === 'magasin' && "text-yellow-600 font-extrabold"
              )}>
                {item.label.split(' ')[0]}
              </span>
            </button>
          ))}
        </nav>
      </div>
      <AnimatePresence>
        {unreadNotifications.length > 0 && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#2B2321]/60 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="w-full max-w-lg bg-white border-2 border-secondary/10 shadow-2xl rounded-[2rem] overflow-hidden"
            >
              <div className="bg-[#FDFBF7] p-8 flex items-center gap-6 border-b border-secondary/10">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                  <Bell className="w-8 h-8 text-primary animate-pulse" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-[#2B2321] font-serif italic">Centre de Notifications</h3>
                  <p className="text-primary/60 font-bold text-xs uppercase tracking-widest mt-1">Mises à jour du stock en temps réel</p>
                </div>
              </div>
              
              <div className="p-8 space-y-6 max-h-[50vh] overflow-y-auto custom-scrollbar">
                {unreadNotifications.map((notif) => {
                  const isMaintenance = notif.type === 'maintenance';
                  const isValidationConfirmation = notif.message && (
                    notif.message.toLowerCase().includes('a été validée') || 
                    notif.message.toLowerCase().includes('a été rejetée') ||
                    notif.message.toLowerCase().includes('validée par') ||
                    notif.message.toLowerCase().includes('rejetée par')
                  );
                  const isExpense = !isValidationConfirmation && !notif.handled && (
                    notif.type === 'expense' || 
                    notif.targetRole === 'admin_only' || 
                    (notif.message && notif.message.toLowerCase().includes('en attente de validation') && 
                     (notif.message.toLowerCase().includes('dépense') || notif.message.toLowerCase().includes('depense')))
                  );
                  return (
                    <div 
                      key={notif.id} 
                      className={cn(
                        "p-6 rounded-2xl border space-y-4 transition-all",
                        notif.type === 'low_stock' 
                          ? "bg-red-50/50 border-red-100" 
                          : isExpense
                            ? "bg-emerald-50/50 border-emerald-100"
                            : isMaintenance
                              ? "bg-amber-50/50 border-amber-100"
                              : "bg-green-50/50 border-green-100"
                      )}
                    >
                        <div className="flex justify-between items-start gap-4">
                        <div className="flex items-center gap-3">
                          {notif.type === 'app_update' ? (
                            <Rocket className="w-5 h-5 text-emerald-600 animate-bounce" />
                          ) : notif.type === 'broadcast' ? (
                            <Megaphone className="w-5 h-5 text-blue-600" />
                          ) : notif.type === 'low_stock' ? (
                            <AlertTriangle className="w-5 h-5 text-red-600" />
                          ) : isExpense ? (
                            <DollarSign className="w-5 h-5 text-emerald-600 shrink-0" />
                          ) : notif.type === 'order_ready' ? (
                            <Utensils className="w-5 h-5 text-green-600" />
                          ) : isMaintenance ? (
                            <Wrench className="w-5 h-5 text-amber-600 shrink-0" />
                          ) : (
                            <Package className="w-5 h-5 text-green-600" />
                          )}
                          <div>
                            <p className="font-bold text-[#2B2321] text-lg">
                              {notif.type === 'app_update' 
                                ? (notif.title || 'Mise à jour Système') 
                                : notif.type === 'broadcast' 
                                  ? (notif.title || 'Annonce Générale') 
                                  : isExpense 
                                    ? 'Validation Dépense' 
                                    : notif.type === 'order_ready' 
                                      ? 'Commande Prête' 
                                      : isMaintenance 
                                        ? 'Maintenance' 
                                        : notif.productName || 'Notification'}
                            </p>
                            <p className={cn(
                              "text-sm font-bold mt-1",
                              notif.type === 'app_update'
                                ? "text-emerald-700 bg-emerald-100/60 px-2.5 py-0.5 rounded-full inline-block"
                                : notif.type === 'broadcast'
                                  ? "text-blue-700 bg-blue-100/60 px-2.5 py-0.5 rounded-full inline-block"
                                  : notif.type === 'low_stock' 
                                    ? "text-red-600" 
                                    : isExpense
                                      ? "text-emerald-700 bg-emerald-100/60 px-2 py-0.5 rounded-full inline-block"
                                      : isMaintenance 
                                        ? "text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full" 
                                        : "text-green-600"
                            )}>
                              {notif.type === 'app_update' ? 'Nouvelle Version Disponible' : 
                               notif.type === 'broadcast' ? 'Diffusion à tous les utilisateurs' :
                               notif.type === 'low_stock' ? 'Stock Critique' : 
                               isExpense ? 'Dépense à valider' :
                               notif.type === 'order_ready' ? `Lieu: ${notif.location}` : 
                               isMaintenance ? 'Remplacement d\'équipement' :
                               'Réapprovisionnement'}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <button
                            onClick={() => acknowledgeNotification(notif.id)}
                            className="text-gray-400 hover:text-gray-600 transition-colors"
                            aria-label="Fermer"
                          >
                            <X className="w-5 h-5" />
                          </button>
                          <span className="text-[10px] font-bold text-primary/40 uppercase tracking-widest">
                            {notif.timestamp?.toDate ? format(notif.timestamp.toDate(), 'HH:mm') : '-'}
                          </span>
                        </div>
                      </div>
                      
                      <p className="text-sm text-[#2B2321]/70 leading-relaxed italic">"{notif.message}"</p>

                      {notif.type === 'app_update' && (
                        <div className="pt-2">
                          <button
                            onClick={() => {
                              if ((notif as any).version) {
                                localStorage.setItem('residence_app_version', (notif as any).version);
                              }
                              acknowledgeNotification(notif.id);
                              window.location.reload();
                            }}
                            className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer w-full sm:w-auto active:scale-95"
                          >
                            <RefreshCw className="w-4 h-4" />
                            <span>Mettre à jour l'application maintenant (Recharger)</span>
                          </button>
                        </div>
                      )}
                      
                      {isExpense && isAdmin ? (
                        <div className="grid grid-cols-3 gap-2 pt-2">
                          <button
                            onClick={() => handleValidateExpenseFromNotification(notif.id, notif.expenseId, 'Approved', notif.expenseData)}
                            className="py-2.5 px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold uppercase tracking-widest text-[10px] transition-all flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
                          >
                            <CheckCircle className="w-4 h-4" />
                            Valider
                          </button>
                          <button
                            onClick={() => handleValidateExpenseFromNotification(notif.id, notif.expenseId, 'Rejected', notif.expenseData)}
                            className="py-2.5 px-2 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold uppercase tracking-widest text-[10px] transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                          >
                            <XCircle className="w-4 h-4" />
                            Rejeter
                          </button>
                          <button
                            onClick={() => {
                              setEditingExpenseNotification({
                                notificationId: notif.id,
                                expenseId: notif.expenseId,
                                description: notif.expenseData?.description || notif.message.replace(/💸 Dépense en attente de validation : |Nouvelle dépense en attente de validation: /g, '').split(' (')[0] || '',
                                amount: notif.expenseData?.amount || 0,
                                category: notif.expenseData?.category || 'Other',
                                location: notif.expenseData?.location || 'Réception'
                              });
                            }}
                            className="py-2.5 px-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold uppercase tracking-widest text-[10px] transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                          >
                            <Edit2 className="w-4 h-4" />
                            Modifier
                          </button>
                        </div>
                      ) : isMaintenance ? (
                        <div className="space-y-3">
                          {(isAdmin || isManager) && notif.maintenanceTaskId && (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                              <button
                                onClick={() => {
                                  setActiveTab('maintenance');
                                  setShowNotifications(false);
                                  toast.info("Détails disponibles dans le module Maintenance.");
                                }}
                                className="py-2.5 px-2 border border-amber-500/30 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-xl font-bold uppercase tracking-widest text-[9px] transition-all flex items-center justify-center gap-1 cursor-pointer"
                              >
                                <Wrench className="w-3.5 h-3.5" />
                                Détails
                              </button>
                              <button
                                onClick={() => {
                                  handleValidateMaintenanceFromNotification(notif.id, notif.maintenanceTaskId!, 'pending');
                                }}
                                className="py-2.5 px-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold uppercase tracking-widest text-[9px] transition-all flex items-center justify-center gap-1 cursor-pointer shadow-xs"
                              >
                                <Clock className="w-3.5 h-3.5" />
                                En Attente
                              </button>
                              <button
                                onClick={() => {
                                  handleValidateMaintenanceFromNotification(notif.id, notif.maintenanceTaskId!, 'reject');
                                }}
                                className="py-2.5 px-2 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold uppercase tracking-widest text-[9px] transition-all flex items-center justify-center gap-1 cursor-pointer"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                Rejeter
                              </button>
                              <button
                                onClick={() => {
                                  handleValidateMaintenanceFromNotification(notif.id, notif.maintenanceTaskId!, 'approve');
                                }}
                                className="py-2.5 px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold uppercase tracking-widest text-[9px] transition-all flex items-center justify-center gap-1 cursor-pointer shadow-md shadow-emerald-500/10"
                              >
                                <CheckCircle className="w-3.5 h-3.5" />
                                Valider
                              </button>
                            </div>
                          )}

                          <button
                            onClick={() => acknowledgeNotification(notif.id)}
                            className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl font-bold uppercase tracking-widest text-[11px] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-amber-500/20"
                          >
                            <CheckCircle className="w-4 h-4" />
                            J'ai pris connaissance (Continuer à travailler)
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => acknowledgeNotification(notif.id)}
                          className={cn(
                            "w-full py-3 border-2 rounded-xl font-bold uppercase tracking-widest text-[10px] transition-all flex items-center justify-center gap-2 group cursor-pointer",
                            notif.type === 'low_stock'
                              ? "bg-white border-red-100 text-red-600 hover:bg-red-50"
                              : "bg-white border-green-100 text-green-600 hover:bg-green-50"
                          )}
                        >
                          <CheckCircle className="w-4 h-4 group-hover:scale-110 transition-transform" />
                          J'ai pris connaissance
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              
              <div className="p-6 bg-gray-50 text-center border-t border-gray-100">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  Veuillez confirmer la lecture de ces messages
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal modifier dépense depuis notification */}
      <AnimatePresence>
        {editingExpenseNotification && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border border-secondary/20"
            >
              <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-100">
                <h3 className="text-lg font-bold text-[#2B2321] flex items-center gap-2">
                  <Edit2 className="w-5 h-5 text-primary" />
                  Modifier & Valider la Dépense
                </h3>
                <button
                  type="button"
                  onClick={() => setEditingExpenseNotification(null)}
                  className="p-1 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
                >
                  <XCircle className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <form onSubmit={handleSaveEditedExpenseNotification} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    required
                    value={editingExpenseNotification.description}
                    onChange={(e) => setEditingExpenseNotification({
                      ...editingExpenseNotification,
                      description: e.target.value
                    })}
                    className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1">
                    Montant (FCFA)
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={editingExpenseNotification.amount}
                    onChange={(e) => setEditingExpenseNotification({
                      ...editingExpenseNotification,
                      amount: e.target.value
                    })}
                    className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1">
                    Catégorie
                  </label>
                  <select
                    value={editingExpenseNotification.category}
                    onChange={(e) => setEditingExpenseNotification({
                      ...editingExpenseNotification,
                      category: e.target.value as any
                    })}
                    className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm font-semibold"
                  >
                    <option value="Salaries">Salaires</option>
                    <option value="Utilities">Factures & Services</option>
                    <option value="Stock">Achats / Stock</option>
                    <option value="Maintenance">Maintenance & Entretien</option>
                    <option value="Other">Autre</option>
                  </select>
                </div>

                <div className="flex gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setEditingExpenseNotification(null)}
                    className="flex-1 py-2.5 border rounded-xl font-bold text-sm text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl font-bold text-sm shadow-md transition-colors flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Enregistrer & Valider
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Real-Time Application Update Prompt for All Users */}
      <AppUpdatePrompt settings={settings} />

      {/* Broadcast Notification & Update Publisher Modal for Admins & Managers */}
      <BroadcastNotificationModal
        isOpen={showBroadcastModal}
        onClose={() => setShowBroadcastModal(false)}
        user={user}
      />

      <ConnectivityIndicator hideInChat={activeTab === 'chat'} />
      <Toaster position="top-right" richColors closeButton />
    </ErrorBoundary>
  );
}
