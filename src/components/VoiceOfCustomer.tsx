import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Star, 
  MessageSquare, 
  Sparkles, 
  ThumbsUp, 
  CheckCircle, 
  Smile, 
  User, 
  Home, 
  Coffee, 
  Waves, 
  Heart, 
  Send, 
  LogOut, 
  Loader2, 
  ClipboardCheck, 
  Bell, 
  Car, 
  Shield, 
  QrCode, 
  Printer, 
  Copy, 
  ExternalLink, 
  Share2, 
  TrendingUp, 
  Download, 
  X, 
  Eye, 
  Filter, 
  Calendar,
  Check
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { addDoc, collection, serverTimestamp, onSnapshot, query, orderBy, limit, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase';
import { AppSettings, UserProfile, AppNotification, Review } from '../types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';

interface VoiceOfCustomerProps {
  user: UserProfile | null;
  settings: AppSettings | null;
  onLogout: () => void;
}

type RatingCategory = 'Room' | 'Service' | 'Food' | 'General';

interface CategoryConfig {
  key: RatingCategory;
  label: string;
  icon: React.ComponentType<any>;
  description: string;
}

export const VoiceOfCustomer: React.FC<VoiceOfCustomerProps> = ({ user, settings, onLogout }) => {
  const isClient = user?.role === 'client';
  const isStaff = !isClient;

  // Staff tab switch: 'dashboard' (Avis reçus) | 'qrcode' (Code QR & Affiche) | 'form' (Saisie d'un avis)
  const [staffTab, setStaffTab] = useState<'dashboard' | 'qrcode' | 'form'>(isStaff ? 'qrcode' : 'form');

  // Review Form steps
  const [activeStep, setActiveStep] = useState<'intro' | 'ratings' | 'success'>('intro');
  const [guestName, setGuestName] = useState(user?.username && user?.username !== 'Client Résidence' ? user.username : '');
  const [roomNumber, setRoomNumber] = useState('');
  const [ratings, setRatings] = useState<Record<RatingCategory, number>>({
    Room: 5,
    Service: 5,
    Food: 5,
    General: 5,
  });
  const [comments, setComments] = useState<Record<RatingCategory, string>>({
    Room: '',
    Service: '',
    Food: '',
    General: '',
  });
  const [generalComment, setGeneralComment] = useState('');
  const [hoveredStars, setHoveredStars] = useState<Record<RatingCategory, number | null>>({
    Room: null,
    Service: null,
    Food: null,
    General: null,
  });
  const [submitting, setSubmitting] = useState(false);

  // QR Code Modal & Poster Print State
  const [showQrModal, setShowQrModal] = useState(false);
  const [showPrintPoster, setShowPrintPoster] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [qrLocationPreset, setQrLocationPreset] = useState<'Reception' | 'Restaurant' | 'Chambre'>('Reception');

  // Reviews list from Firestore for Staff
  const [reviews, setReviews] = useState<Review[]>([]);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Notifications state for client
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);

  const qrRef = useRef<HTMLDivElement>(null);

  const clientEvaluationUrl = `${window.location.origin}?mode=client&tab=voc`;

  // Fetch Reviews in real-time
  useEffect(() => {
    const qReviews = query(collection(db, 'reviews'), orderBy('timestamp', 'desc'), limit(100));
    const unsub = onSnapshot(qReviews, (snapshot) => {
      const list: Review[] = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() } as Review);
      });
      setReviews(list);
    }, (err) => {
      console.debug("Reviews sync error:", err);
    });
    return () => unsub();
  }, []);

  // Fetch Notifications for client
  useEffect(() => {
    if (!isClient) return;
    const qNotifs = query(collection(db, 'notifications'), orderBy('timestamp', 'desc'), limit(50));
    const unsub = onSnapshot(qNotifs, (snapshot) => {
      const list: AppNotification[] = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() } as AppNotification);
      });
      setNotifications(list);
    }, (err) => {
      console.debug("Client notifications sync:", err);
    });
    return () => unsub();
  }, [isClient]);

  const unreadNotifications = notifications.filter(n => {
    if (n.handled) return false;
    const isRead = n.readBy?.includes(user?.id || '');
    if (isRead) return false;
    if (n.targetUserId && n.targetUserId !== user?.id) return false;

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
  });

  const acknowledgeNotification = async (notifId: string) => {
    if (!user?.id) return;
    try {
      const notifRef = doc(db, 'notifications', notifId);
      await updateDoc(notifRef, {
        readBy: arrayUnion(user.id)
      });
    } catch (e) {
      console.error("Error acknowledging notification:", e);
    }
  };

  const categories: CategoryConfig[] = [
    { key: 'Room', label: 'Chambres & Confort', icon: Home, description: 'Qualité du sommeil, propreté de la chambre et équipements' },
    { key: 'Service', label: 'Service & Personnel', icon: Heart, description: 'Accueil, amabilité, professionnalisme et réactivité' },
    { key: 'Food', label: 'Restauration & Bar', icon: Coffee, description: 'Qualité des repas, cocktails, petit-déjeuner et service de table' },
    { key: 'General', label: 'Expérience Générale', icon: Smile, description: 'Impressions générales, rapport qualité-prix et recommandations' },
  ];

  const commentPresets = [
    "Accueil chaleureux et professionnel",
    "Chambre extrêmement propre et confortable",
    "Repas savoureux et bien présentés",
    "Service impeccable et personnel attentionné",
    "Service un peu lent mais personnel aimable",
    "Excellente réactivité du room service",
    "Rapport qualité-prix exceptionnel",
    "Nous reviendrons avec grand plaisir !"
  ];

  const handleRatingChange = (category: RatingCategory, value: number) => {
    setRatings(prev => ({ ...prev, [category]: value }));
  };

  const selectPreset = (preset: string) => {
    if (generalComment) {
      setGeneralComment(prev => prev + ', ' + preset);
    } else {
      setGeneralComment(preset);
    }
    toast.success('Suggestion ajoutée !');
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(clientEvaluationUrl);
    setCopiedLink(true);
    toast.success('Lien direct copié dans le presse-papiers !');
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handlePrintPoster = () => {
    window.print();
  };

  const handleSubmitAll = async () => {
    setSubmitting(true);
    try {
      const finalName = guestName.trim() || 'Client Résidence HQ';
      
      // Submit general review
      await addDoc(collection(db, 'reviews'), {
        guestId: user?.id || 'client_anonymous',
        guestName: `${finalName}${roomNumber ? ` (${roomNumber})` : ''}`,
        rating: ratings.General,
        comment: generalComment.trim() || 'Avis général soumis via le portail client.',
        category: 'General',
        timestamp: serverTimestamp()
      });

      // Submit specific reviews for other categories if they wrote anything or rated
      for (const cat of categories) {
        if (cat.key !== 'General') {
          await addDoc(collection(db, 'reviews'), {
            guestId: user?.id || 'client_anonymous',
            guestName: `${finalName}${roomNumber ? ` (${roomNumber})` : ''}`,
            rating: ratings[cat.key],
            comment: comments[cat.key].trim() || `Évaluation ${cat.label}`,
            category: cat.key,
            timestamp: serverTimestamp()
          });
        }
      }

      setActiveStep('success');
      toast.success('Merci pour vos précieux retours !');
    } catch (error: any) {
      console.error('Error submitting feedback:', error);
      toast.error("Erreur lors de l'envoi de vos avis. Veuillez réessayer.");
    } finally {
      setSubmitting(false);
    }
  };

  // Review statistics calculation
  const totalReviewsCount = reviews.length;
  const averageRating = totalReviewsCount > 0 
    ? (reviews.reduce((sum, r) => sum + (r.rating || 5), 0) / totalReviewsCount).toFixed(1)
    : '5.0';
  const promotersCount = reviews.filter(r => (r.rating || 5) >= 4).length;
  const satisfactionRate = totalReviewsCount > 0 
    ? Math.round((promotersCount / totalReviewsCount) * 100) 
    : 100;

  const filteredReviews = reviews.filter(r => {
    const matchesCat = selectedCategoryFilter === 'all' || r.category === selectedCategoryFilter;
    const matchesSearch = !searchTerm || 
      (r.guestName && r.guestName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (r.comment && r.comment.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesCat && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white p-4 md:p-6 rounded-3xl border border-secondary/30 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center font-bold text-lg border border-primary/20 shadow-xs shrink-0">
            {settings?.logoUrl ? (
              <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-contain p-1.5" onError={(e) => { e.currentTarget.src = '/logo.png'; }} />
            ) : (
              <Sparkles className="w-6 h-6 text-primary" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-serif font-bold text-[#2B2321] text-lg md:text-2xl italic leading-tight">
                La Voix du Client (VOC)
              </h1>
              <span className="px-2.5 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                <Star className="w-3 h-3 text-amber-500 fill-amber-500" /> {averageRating} / 5
              </span>
            </div>
            <p className="text-xs text-[#2B2321]/60 font-medium mt-0.5">
              {isStaff 
                ? "Générez vos codes QR d'évaluation pour les clients et suivez la satisfaction en temps réel."
                : "Évaluez la qualité de votre séjour et partagez vos impressions en direct."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto justify-end">
          {/* Quick QR Code Open Button */}
          <button
            onClick={() => setShowQrModal(true)}
            className="px-3.5 py-2 bg-[#1A8B8C] hover:bg-[#157071] text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer"
            title="Afficher le Code QR"
          >
            <QrCode className="w-4 h-4" />
            <span>Code QR Client</span>
          </button>

          <button
            onClick={handleCopyLink}
            className="px-3.5 py-2 bg-white hover:bg-[#FDFBF7] text-[#2B2321] border border-secondary/30 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs active:scale-95 cursor-pointer"
            title="Copier le lien direct"
          >
            {copiedLink ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-[#826123]" />}
            <span>{copiedLink ? 'Lien Copié !' : 'Copier Lien'}</span>
          </button>

          {isClient && (
            <button
              onClick={onLogout}
              className="px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-700 font-bold rounded-xl transition-all text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Quitter</span>
            </button>
          )}
        </div>
      </div>

      {/* Staff Navigation Tabs */}
      {isStaff && (
        <div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl border border-secondary/20 shadow-xs max-w-fit flex-wrap">
          <button
            onClick={() => setStaffTab('qrcode')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              staffTab === 'qrcode'
                ? 'bg-[#1A8B8C] text-white shadow-sm'
                : 'text-[#2B2321]/70 hover:text-[#2B2321] hover:bg-[#FDFBF7]'
            }`}
          >
            <QrCode className="w-4 h-4" />
            <span>Code QR & Affiche de Collecte</span>
          </button>

          <button
            onClick={() => setStaffTab('dashboard')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              staffTab === 'dashboard'
                ? 'bg-primary text-white shadow-sm'
                : 'text-[#2B2321]/70 hover:text-[#2B2321] hover:bg-[#FDFBF7]'
            }`}
          >
            <Star className="w-4 h-4" />
            <span>Avis Reçus ({reviews.length})</span>
          </button>

          <button
            onClick={() => setStaffTab('form')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              staffTab === 'form'
                ? 'bg-[#826123] text-white shadow-sm'
                : 'text-[#2B2321]/70 hover:text-[#2B2321] hover:bg-[#FDFBF7]'
            }`}
          >
            <Send className="w-4 h-4" />
            <span>Formulaire d'Évaluation (Test / Saisie)</span>
          </button>
        </div>
      )}

      {/* TAB 1: QR CODE GENERATOR & PRINTABLE POSTER SECTION */}
      {isStaff && staffTab === 'qrcode' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Interactive QR Code Card */}
          <div className="lg:col-span-5 bg-white p-6 md:p-8 rounded-3xl border border-secondary/30 shadow-sm flex flex-col items-center text-center space-y-6">
            <div className="space-y-1">
              <span className="px-3 py-1 bg-[#1A8B8C]/10 text-[#1A8B8C] border border-[#1A8B8C]/20 rounded-full text-[10px] font-bold uppercase tracking-wider">
                Accès Immédiat Sans Connexion
              </span>
              <h2 className="text-xl font-bold font-serif text-[#2B2321] italic pt-2">
                Scanner pour Évaluer
              </h2>
              <p className="text-xs text-[#2B2321]/60 max-w-xs">
                Présentez ce Code QR à vos clients à la réception, au restaurant ou dans les chambres.
              </p>
            </div>

            {/* QR Code Frame */}
            <div className="p-6 bg-[#FDFBF7] border-2 border-dashed border-[#E5C198] rounded-3xl shadow-inner relative group">
              <div className="bg-white p-4 rounded-2xl border border-[#E5C198]/40 shadow-sm">
                <QRCodeSVG
                  value={clientEvaluationUrl}
                  size={200}
                  level="H"
                  bgColor="#FFFFFF"
                  fgColor="#2B2321"
                  includeMargin={true}
                />
              </div>
              <div className="mt-3 flex items-center justify-center gap-1.5 text-primary font-bold text-[11px]">
                <Sparkles className="w-3.5 h-3.5 text-[#C5A059]" />
                <span>{settings?.hotelName || 'Résidence HQ'}</span>
              </div>
            </div>

            {/* Direct URL Box */}
            <div className="w-full space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[#2B2321]/60 block text-left">
                Lien direct d'évaluation :
              </label>
              <div className="p-2.5 bg-[#FDFBF7] rounded-xl border border-[#E5C198]/40 flex items-center justify-between gap-2 text-xs font-mono text-[#2B2321]/80">
                <span className="truncate">{clientEvaluationUrl}</span>
                <button
                  onClick={handleCopyLink}
                  className="px-2.5 py-1.5 bg-[#1A8B8C] hover:bg-[#157071] text-white rounded-lg font-bold text-[10px] transition-all flex items-center gap-1 shrink-0 cursor-pointer"
                >
                  <Copy className="w-3 h-3" />
                  <span>{copiedLink ? 'Copié' : 'Copier'}</span>
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-2 w-full pt-2">
              <button
                onClick={() => setShowPrintPoster(true)}
                className="py-3 bg-[#1C2321] hover:bg-black text-white rounded-xl font-bold text-xs transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4 text-[#C5A059]" />
                <span>Affiche A4</span>
              </button>
              <a
                href={clientEvaluationUrl}
                target="_blank"
                rel="noreferrer"
                className="py-3 bg-gray-50 hover:bg-gray-100 text-[#2B2321] border border-gray-200 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5"
              >
                <ExternalLink className="w-4 h-4 text-primary" />
                <span>Tester le Scan</span>
              </a>
            </div>
          </div>

          {/* Right: Deployment Recommendations & Print Stand Details */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-white p-6 md:p-8 rounded-3xl border border-secondary/30 shadow-sm space-y-5">
              <div className="flex items-center gap-2.5 border-b border-secondary/20 pb-4">
                <div className="w-9 h-9 bg-emerald-50 text-emerald-700 rounded-xl flex items-center justify-center">
                  <CheckCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm md:text-base text-[#2B2321]">Où disposer vos Codes QR pour maximiser les avis ?</h3>
                  <p className="text-xs text-gray-500">Stratégie de collecte d'avis clients pour la Résidence HQ</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-[#FDFBF7] border border-[#E5C198]/30 rounded-2xl space-y-2">
                  <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
                    <Home className="w-4 h-4 text-[#826123]" />
                    <span>1. Réception & Comptoir</span>
                  </div>
                  <p className="text-xs text-[#2B2321]/70 leading-relaxed">
                    Placez une fiche cartonnée sous cadre en verre sur le comptoir lors du check-out pour inviter le client à flasher son avis avant son départ.
                  </p>
                </div>

                <div className="p-4 bg-[#FDFBF7] border border-[#E5C198]/30 rounded-2xl space-y-2">
                  <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
                    <Coffee className="w-4 h-4 text-[#826123]" />
                    <span>2. Tables Restaurant & Bar</span>
                  </div>
                  <p className="text-xs text-[#2B2321]/70 leading-relaxed">
                    Collez de petits chevalets ou stickers QR Code discrets sur les tables pour recueillir des avis à chaud sur la gastronomie et le service.
                  </p>
                </div>

                <div className="p-4 bg-[#FDFBF7] border border-[#E5C198]/30 rounded-2xl space-y-2">
                  <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
                    <Home className="w-4 h-4 text-[#826123]" />
                    <span>3. Chambres & Suites</span>
                  </div>
                  <p className="text-xs text-[#2B2321]/70 leading-relaxed">
                    Insérez le Code QR dans le livret d'accueil de chaque chambre ou sur le miroir de la salle de bain avec le mot de passe Wi-Fi.
                  </p>
                </div>
              </div>

              <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                <div className="text-xs text-emerald-900 leading-relaxed">
                  <strong>Zéro Friction :</strong> Le client n'a besoin d'aucune application spéciale. L'appareil photo de son smartphone (iPhone ou Android) ouvre immédiatement l'interface d'évaluation sans mot de passe ni compte Google requis.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: STAFF REVIEWS DASHBOARD */}
      {isStaff && staffTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Key Metrics Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-4 bg-white border border-secondary/30 rounded-2xl shadow-sm space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-primary/60">Note Globale Moyenne</span>
              <div className="flex items-center gap-2">
                <p className="text-2xl font-black font-serif text-[#1C2321]">{averageRating} / 5</p>
                <div className="flex text-amber-400">
                  <Star className="w-4 h-4 fill-amber-400" />
                </div>
              </div>
              <p className="text-[10px] text-emerald-700 font-bold">Calculé sur {totalReviewsCount} avis</p>
            </div>

            <div className="p-4 bg-white border border-secondary/30 rounded-2xl shadow-sm space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-primary/60">Taux de Satisfaction</span>
              <p className="text-2xl font-black font-serif text-emerald-700">{satisfactionRate}%</p>
              <p className="text-[10px] text-gray-500 font-bold">{promotersCount} avis positifs (≥ 4★)</p>
            </div>

            <div className="p-4 bg-white border border-secondary/30 rounded-2xl shadow-sm space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-primary/60">Total Avis Collectés</span>
              <p className="text-2xl font-black font-serif text-[#1C2321]">{totalReviewsCount}</p>
              <p className="text-[10px] text-primary/60 font-bold">Via portail & QR Code</p>
            </div>

            <div className="p-4 bg-white border border-secondary/30 rounded-2xl shadow-sm space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-primary/60">Canal de Collecte</span>
              <p className="text-2xl font-black font-serif text-[#1A8B8C]">100%</p>
              <p className="text-[10px] text-gray-500 font-bold">Direct Client Mobile (VOC)</p>
            </div>
          </div>

          {/* Filters & Reviews List (With QR Code Sidebar) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Reviews list (Col span 8) */}
            <div className="lg:col-span-8 bg-white p-6 rounded-3xl border border-secondary/30 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-secondary/20 pb-4">
                <div>
                  <h3 className="font-bold text-base text-[#2B2321]">Flux des Retours & Avis Clients</h3>
                  <p className="text-xs text-gray-500">Consultez les commentaires laissés par vos clients en temps réel</p>
                </div>

                {/* Category Filter */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    onClick={() => setSelectedCategoryFilter('all')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      selectedCategoryFilter === 'all'
                        ? 'bg-primary text-white'
                        : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    Tous ({reviews.length})
                  </button>
                  {categories.map(c => (
                    <button
                      key={c.key}
                      onClick={() => setSelectedCategoryFilter(c.key)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        selectedCategoryFilter === c.key
                          ? 'bg-primary text-white'
                          : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {c.label.split(' ')[0]}
                    </button>
                  ))}
                </div>
              </div>

              {/* List */}
              {filteredReviews.length > 0 ? (
                <div className="divide-y divide-secondary/15 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                  {filteredReviews.map((rev) => {
                    const catConfig = categories.find(c => c.key === rev.category) || categories[0];
                    const Icon = catConfig.icon;
                    const dateStr = rev.timestamp?.toDate 
                      ? format(rev.timestamp.toDate(), "d MMMM yyyy 'à' HH:mm", { locale: fr })
                      : 'Récemment';

                    return (
                      <div key={rev.id} className="py-4 flex flex-col sm:flex-row sm:items-start justify-between gap-3 hover:bg-[#FDFBF7] p-3 rounded-2xl transition-colors">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 bg-primary/5 text-primary rounded-xl flex items-center justify-center shrink-0 border border-primary/10 mt-0.5">
                            <Icon className="w-5 h-5 text-primary" />
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-bold text-sm text-[#2B2321]">{rev.guestName || 'Client Résidence'}</p>
                              <span className="px-2 py-0.5 bg-primary/5 text-primary border border-primary/15 rounded-full text-[9px] font-bold uppercase tracking-wider">
                                {catConfig.label}
                              </span>
                            </div>
                            <p className="text-xs text-[#2B2321]/80 leading-relaxed italic">
                              "{rev.comment || 'Sans commentaire textuel.'}"
                            </p>
                            <p className="text-[10px] text-gray-400 font-medium">
                              {dateStr}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0 self-start sm:self-center">
                          {[1, 2, 3, 4, 5].map((starVal) => (
                            <Star
                              key={starVal}
                              className={`w-4 h-4 ${
                                starVal <= (rev.rating || 5)
                                  ? 'text-amber-400 fill-amber-400'
                                  : 'text-gray-200 fill-none'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-12 text-center text-[#2B2321]/60 space-y-2">
                  <Star className="w-8 h-8 mx-auto opacity-30 text-amber-500" />
                  <p className="font-bold text-sm">Aucun avis trouvé pour ce filtre</p>
                  <p className="text-xs text-gray-400">Présentez le Code QR à vos clients pour recevoir leurs premières évaluations !</p>
                </div>
              )}
            </div>

            {/* QR Code Evaluation Sidebar (Col span 4) */}
            <div className="lg:col-span-4 bg-white p-6 rounded-3xl border border-secondary/30 shadow-sm flex flex-col items-center text-center space-y-5 justify-between">
              <div className="space-y-4 w-full flex flex-col items-center">
                <div className="w-12 h-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center border border-primary/20 shadow-xs">
                  <QrCode className="w-6 h-6 text-primary" />
                </div>
                
                <div>
                  <h4 className="font-serif font-bold text-base text-[#2B2321] italic">Code QR d'Évaluation</h4>
                  <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
                    Les clients peuvent flasher ce code pour accéder instantanément au portail d'évaluation.
                  </p>
                </div>

                {/* QR Code SVG */}
                <div className="p-4 bg-[#FDFBF7] border border-dashed border-[#E5C198] rounded-2xl shadow-inner relative">
                  <div className="bg-white p-2 rounded-xl shadow-xs">
                    <QRCodeSVG
                      value={clientEvaluationUrl}
                      size={150}
                      level="H"
                      bgColor="#FFFFFF"
                      fgColor="#2B2321"
                      includeMargin={true}
                    />
                  </div>
                </div>

                {/* Quick Copy URL */}
                <div className="w-full space-y-1 text-left">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#2B2321]/60">Lien Direct :</span>
                  <div className="p-2 bg-[#FDFBF7] rounded-xl border border-secondary/15 flex items-center justify-between gap-1 text-[11px] font-mono text-[#2B2321]/80">
                    <span className="truncate flex-1 pr-1">{clientEvaluationUrl}</span>
                    <button
                      onClick={handleCopyLink}
                      className="px-2 py-1 bg-[#1A8B8C] hover:bg-[#157071] text-white rounded-lg font-bold text-[9px] transition-all flex items-center gap-1 shrink-0 cursor-pointer"
                    >
                      <Copy className="w-2.5 h-2.5" />
                      <span>{copiedLink ? 'Copié' : 'Copier'}</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-amber-50/70 border border-amber-200/50 rounded-xl text-[10px] text-[#2B2321]/70 leading-relaxed text-left">
                <strong>Zéro frottement :</strong> Pas de téléchargement, pas de connexion obligatoire. Les convives scannent simplement avec leur smartphone pour évaluer vos services en 30 secondes.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3 / CLIENT VIEW: INTERACTIVE EVALUATION FORM */}
      {(!isStaff || staffTab === 'form') && (
        <div className="flex items-center justify-center py-4">
          <AnimatePresence mode="wait">
            {activeStep === 'intro' && (
              <motion.div
                key="intro"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="max-w-xl w-full bg-white rounded-3xl border border-[#E5C198]/30 shadow-xl p-6 md:p-10 space-y-8"
              >
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 mx-auto bg-primary/10 text-primary rounded-full flex items-center justify-center border border-primary/20 animate-bounce">
                    <Heart className="w-8 h-8 text-primary fill-primary/10" />
                  </div>
                  <h2 className="text-xl md:text-3xl font-bold font-serif text-[#2B2321] italic">
                    Votre avis nous est précieux
                  </h2>
                  <p className="text-xs md:text-sm text-[#2B2321]/70 leading-relaxed max-w-md mx-auto">
                    Cher client, pour nous aider à parfaire chaque détail de votre séjour et vous offrir une expérience d’exception, nous vous invitons à évaluer nos services.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-[#2B2321]/60 block">
                      Votre Nom Complet (Optionnel)
                    </label>
                    <div className="relative">
                      <User className="w-5 h-5 text-primary/60 absolute left-4 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={guestName}
                        onChange={(e) => setGuestName(e.target.value)}
                        placeholder="Ex: M. ou Mme Kouamé"
                        className="w-full pl-12 pr-4 py-3 bg-[#FDFBF7] border border-[#E5C198]/40 rounded-xl outline-none font-bold text-[#2B2321] focus:border-primary transition-all text-xs md:text-sm"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-[#2B2321]/60 block">
                      Numéro de Chambre / Table (Optionnel)
                    </label>
                    <div className="relative">
                      <Home className="w-5 h-5 text-primary/60 absolute left-4 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={roomNumber}
                        onChange={(e) => setRoomNumber(e.target.value)}
                        placeholder="Ex: Chambre 103 ou Table VIP 4"
                        className="w-full pl-12 pr-4 py-3 bg-[#FDFBF7] border border-[#E5C198]/40 rounded-xl outline-none font-bold text-[#2B2321] focus:border-primary transition-all text-xs md:text-sm"
                      />
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setActiveStep('ratings')}
                  className="w-full py-4 bg-primary hover:bg-primary/90 text-white font-bold rounded-2xl shadow-lg hover:shadow-xl hover:shadow-primary/10 transition-all flex items-center justify-center gap-2 cursor-pointer text-sm md:text-base"
                >
                  <span>Commencer l'évaluation</span>
                  <ThumbsUp className="w-5 h-5" />
                </button>
              </motion.div>
            )}

            {activeStep === 'ratings' && (
              <motion.div
                key="ratings"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="max-w-3xl w-full bg-white rounded-3xl border border-[#E5C198]/30 shadow-xl p-6 md:p-8 space-y-8"
              >
                <div className="text-center space-y-2">
                  <span className="px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded-full text-xs font-bold uppercase tracking-wider">
                    Fiche d'Évaluation
                  </span>
                  <h2 className="text-xl md:text-2xl font-bold font-serif text-[#2B2321] italic">
                    Évaluez notre établissement
                  </h2>
                  <p className="text-[10px] md:text-xs text-[#2B2321]/60">
                    Attribuez une note de 1 à 5 étoiles pour chaque pôle de service.
                  </p>
                </div>

                <div className="space-y-6 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                  {categories.map((cat) => {
                    const Icon = cat.icon;
                    const currentRating = ratings[cat.key];
                    const hovered = hoveredStars[cat.key];

                    return (
                      <div
                        key={cat.key}
                        className="p-4 bg-[#FDFBF7] border border-[#E5C198]/20 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all hover:shadow-sm"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 bg-primary/5 text-primary rounded-xl flex items-center justify-center shrink-0 border border-primary/10 mt-0.5">
                            <Icon className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-bold text-[#2B2321] text-[10px] md:text-sm">{cat.label}</p>
                            <p className="text-[10px] md:text-xs text-[#2B2321]/60 leading-tight mt-0.5">{cat.description}</p>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1.5 justify-center shrink-0">
                          {/* Interactive Stars */}
                          <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map((starValue) => {
                              const isFilled = hovered !== null ? starValue <= hovered : starValue <= currentRating;
                              return (
                                <button
                                  key={starValue}
                                  type="button"
                                  onClick={() => handleRatingChange(cat.key, starValue)}
                                  onMouseEnter={() => setHoveredStars(prev => ({ ...prev, [cat.key]: starValue }))}
                                  onMouseLeave={() => setHoveredStars(prev => ({ ...prev, [cat.key]: null }))}
                                  className="p-1 cursor-pointer transition-transform hover:scale-125 focus:outline-none"
                                >
                                  <Star
                                    className={`w-6 h-6 transition-all ${
                                      isFilled 
                                        ? 'text-amber-400 fill-amber-400 filter drop-shadow-[0_0_2px_rgba(245,158,11,0.25)]' 
                                        : 'text-[#E5C198]/40 fill-none'
                                    }`}
                                  />
                                </button>
                              );
                            })}
                          </div>
                          <span className="text-[10px] font-bold text-primary uppercase tracking-widest bg-primary/5 px-2 py-0.5 rounded-full">
                            {currentRating === 5 && 'Excellent'}
                            {currentRating === 4 && 'Très Bon'}
                            {currentRating === 3 && 'Correct'}
                            {currentRating === 2 && 'À Améliorer'}
                            {currentRating === 1 && 'Insatisfaisant'}
                          </span>
                        </div>
                      </div>
                    );
                  })}

                  {/* General Comment block */}
                  <div className="p-5 bg-[#FDFBF7] border border-[#E5C198]/30 rounded-2xl space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-primary/5 text-primary rounded-xl flex items-center justify-center shrink-0 border border-primary/10">
                        <MessageSquare className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-[#2B2321] text-sm">Suggestions d'amélioration ou remerciements</p>
                        <p className="text-[10px] md:text-xs text-[#2B2321]/60">Écrivez vos remarques personnelles pour l'équipe de direction.</p>
                      </div>
                    </div>

                    {/* Suggestion Presets */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {commentPresets.map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => selectPreset(preset)}
                          className="px-2.5 py-1 bg-white hover:bg-[#E5C198]/10 text-[10px] font-medium text-[#2B2321]/80 rounded-lg border border-[#E5C198]/20 transition-all active:scale-95 cursor-pointer"
                        >
                          {preset}
                        </button>
                      ))}
                    </div>

                    <textarea
                      rows={3}
                      value={generalComment}
                      onChange={(e) => setGeneralComment(e.target.value)}
                      placeholder="Qu'est-ce qui vous a le plus plu durant votre séjour ? Comment pouvons-nous faire encore mieux la prochaine fois ?"
                      className="w-full p-4 bg-white border border-[#E5C198]/40 rounded-xl outline-none font-medium text-[#2B2321] focus:border-primary transition-all text-xs md:text-sm resize-none"
                    />
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <button
                    onClick={() => setActiveStep('intro')}
                    className="w-full sm:w-1/3 py-3.5 bg-gray-50 hover:bg-gray-100 text-[#2B2321]/70 font-bold rounded-xl transition-all text-xs uppercase tracking-widest cursor-pointer"
                  >
                    Retour
                  </button>
                  <button
                    onClick={handleSubmitAll}
                    disabled={submitting}
                    className="w-full sm:w-2/3 py-3.5 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer text-xs uppercase tracking-widest disabled:opacity-50"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                        <span>Transmission en cours...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 shrink-0" />
                        <span>Transmettre mon Évaluation</span>
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            )}

            {activeStep === 'success' && (
              <motion.div
                key="success"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="max-w-xl w-full bg-white rounded-3xl border border-[#E5C198]/30 shadow-xl p-6 md:p-10 space-y-8 text-center"
              >
                <div className="space-y-4">
                  <div className="w-20 h-20 mx-auto bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center border border-emerald-100 filter drop-shadow-md">
                    <CheckCircle className="w-12 h-12 text-emerald-600 animate-pulse" />
                  </div>
                  <h2 className="text-xl md:text-3xl font-bold font-serif text-[#2B2321] italic">
                    Avis enregistré avec succès !
                  </h2>
                  <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 text-left space-y-3 max-w-md mx-auto">
                    <p className="text-xs text-primary font-bold uppercase tracking-widest flex items-center gap-1">
                      <ClipboardCheck className="w-4 h-4" />
                      Message de la Direction
                    </p>
                    <p className="text-xs md:text-sm text-[#2B2321]/80 italic leading-relaxed">
                      "Nous vous remercions chaleureusement pour le temps accordé à cette évaluation. Vos retours nous permettent de parfaire notre qualité de service jour après jour pour faire de votre séjour un moment inoubliable."
                    </p>
                    <p className="text-[10px] font-bold text-[#2B2321]/60 text-right uppercase tracking-wider">
                      — Le Directeur Général, {settings?.hotelName || 'Résidence HQ'}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <button
                    onClick={() => {
                      setGeneralComment('');
                      setRatings({
                        Room: 5,
                        Service: 5,
                        Food: 5,
                        General: 5,
                      });
                      setActiveStep('intro');
                    }}
                    className="w-full py-4 bg-primary text-white font-bold rounded-2xl shadow-xl shadow-primary/10 hover:bg-primary/90 transition-all flex items-center justify-center gap-2 cursor-pointer text-sm"
                  >
                    Émettre un autre avis
                  </button>
                  {isClient && (
                    <button
                      onClick={onLogout}
                      className="w-full py-3 bg-gray-50 hover:bg-gray-100 text-[#2B2321]/70 font-bold rounded-xl transition-all text-xs cursor-pointer"
                    >
                      Quitter le portail & Déconnexion
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* POPUP MODAL: QUICK QR CODE VIEW */}
      <AnimatePresence>
        {showQrModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2B2321]/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-sm bg-white rounded-3xl border border-secondary/30 shadow-2xl p-6 text-center space-y-5 relative"
            >
              <button
                onClick={() => setShowQrModal(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 p-1.5 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="space-y-1 pt-2">
                <span className="px-2.5 py-0.5 bg-[#1A8B8C]/10 text-[#1A8B8C] border border-[#1A8B8C]/20 rounded-full text-[10px] font-bold uppercase tracking-wider">
                  Code QR Évaluation Client
                </span>
                <h3 className="font-serif font-bold text-xl text-[#2B2321] italic">
                  Flashez pour Évaluer
                </h3>
                <p className="text-xs text-[#2B2321]/60">
                  Ouvre directement le formulaire d'évaluation sur smartphone
                </p>
              </div>

              {/* QR Container */}
              <div className="p-4 bg-[#FDFBF7] border border-[#E5C198]/40 rounded-2xl inline-block shadow-inner">
                <QRCodeSVG
                  value={clientEvaluationUrl}
                  size={180}
                  level="H"
                  bgColor="#FFFFFF"
                  fgColor="#2B2321"
                  includeMargin={true}
                />
              </div>

              <div className="space-y-2">
                <button
                  onClick={handleCopyLink}
                  className="w-full py-3 bg-[#1A8B8C] hover:bg-[#157071] text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer"
                >
                  <Copy className="w-4 h-4" />
                  <span>{copiedLink ? 'Lien Copié !' : 'Copier le Lien Direct'}</span>
                </button>
                <button
                  onClick={() => {
                    setShowQrModal(false);
                    setShowPrintPoster(true);
                  }}
                  className="w-full py-2.5 bg-gray-50 hover:bg-gray-100 text-[#2B2321] border border-gray-200 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-[#826123]" />
                  <span>Imprimer l'Affiche</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* POPUP MODAL: PRINTABLE POSTER (A4 FORMAT READY TO PRINT) */}
      <AnimatePresence>
        {showPrintPoster && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2B2321]/80 backdrop-blur-md overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-white rounded-3xl border border-[#E5C198] shadow-2xl overflow-hidden my-6"
            >
              {/* Modal Toolbar */}
              <div className="p-4 bg-[#FDFBF7] border-b border-[#E5C198]/30 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Printer className="w-4 h-4 text-primary" />
                  <span className="font-bold text-xs uppercase tracking-widest text-[#2B2321]">
                    Aperçu Affiche A4 / Chevalet Table
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePrintPoster}
                    className="px-3 py-1.5 bg-primary text-white rounded-lg font-bold text-xs flex items-center gap-1.5 hover:bg-primary/90 transition-all cursor-pointer shadow-xs"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Lancer l'impression</span>
                  </button>
                  <button
                    onClick={() => setShowPrintPoster(false)}
                    className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Printable Poster Sheet */}
              <div className="p-8 md:p-12 text-center space-y-6 bg-white" id="printable-voc-poster">
                {/* Hotel Header */}
                <div className="space-y-2">
                  <div className="w-16 h-16 mx-auto bg-primary/5 text-primary rounded-2xl flex items-center justify-center border border-primary/20">
                    {settings?.logoUrl ? (
                      <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-contain p-2" onError={(e) => { e.currentTarget.src = '/logo.png'; }} />
                    ) : (
                      <Sparkles className="w-8 h-8 text-primary" />
                    )}
                  </div>
                  <h2 className="font-serif font-bold text-2xl md:text-3xl text-[#2B2321] italic">
                    {settings?.hotelName || 'Résidence HQ'}
                  </h2>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#1A8B8C]">
                    Hôtel • Restaurant • Lounge
                  </p>
                </div>

                <div className="border-t border-b border-[#E5C198]/40 py-4 space-y-1">
                  <h3 className="font-serif font-bold text-lg md:text-xl text-[#2B2321]">
                    Votre avis nous est précieux !
                  </h3>
                  <p className="text-xs text-[#2B2321]/70 max-w-sm mx-auto">
                    Scannez ce QR Code avec l'appareil photo de votre smartphone pour évaluer la qualité de nos services en quelques secondes.
                  </p>
                </div>

                {/* Big High-Res QR Code */}
                <div className="p-6 bg-[#FDFBF7] border-2 border-[#E5C198] rounded-3xl inline-block shadow-md">
                  <QRCodeSVG
                    value={clientEvaluationUrl}
                    size={220}
                    level="H"
                    bgColor="#FFFFFF"
                    fgColor="#2B2321"
                    includeMargin={true}
                  />
                  <div className="mt-2 flex items-center justify-center gap-1 text-amber-500">
                    {[1, 2, 3, 4, 5].map(i => (
                      <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                </div>

                {/* 3 Steps Guide */}
                <div className="grid grid-cols-3 gap-2 text-left pt-2">
                  <div className="p-2.5 bg-[#FDFBF7] rounded-xl border border-[#E5C198]/30 text-center space-y-1">
                    <span className="w-5 h-5 bg-primary text-white rounded-full text-[10px] font-bold inline-flex items-center justify-center">1</span>
                    <p className="text-[10px] font-bold text-[#2B2321]">Ouvrez l'appareil photo</p>
                  </div>
                  <div className="p-2.5 bg-[#FDFBF7] rounded-xl border border-[#E5C198]/30 text-center space-y-1">
                    <span className="w-5 h-5 bg-primary text-white rounded-full text-[10px] font-bold inline-flex items-center justify-center">2</span>
                    <p className="text-[10px] font-bold text-[#2B2321]">Scannez le QR Code</p>
                  </div>
                  <div className="p-2.5 bg-[#FDFBF7] rounded-xl border border-[#E5C198]/30 text-center space-y-1">
                    <span className="w-5 h-5 bg-primary text-white rounded-full text-[10px] font-bold inline-flex items-center justify-center">3</span>
                    <p className="text-[10px] font-bold text-[#2B2321]">Partagez votre avis</p>
                  </div>
                </div>

                {/* Footer Address */}
                <div className="pt-4 border-t border-[#E5C198]/30 text-[9px] text-[#2B2321]/60 space-y-0.5">
                  <p className="font-bold">{settings?.address || 'Brazzaville, Massissia'}</p>
                  <p>Merci pour votre confiance et excellent séjour parmi nous !</p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
