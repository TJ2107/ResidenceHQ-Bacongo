import React, { useState, useEffect } from 'react';
import { 
  BookOpen, 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  Bed, 
  Sparkles, 
  Users, 
  BarChart3, 
  Waves, 
  AlertCircle, 
  Settings as SettingsIcon,
  History,
  ChevronRight,
  ChevronDown,
  Info,
  CheckCircle2,
  HelpCircle,
  Wrench,
  ChefHat,
  LayoutGrid,
  FileText,
  WifiOff,
  Printer,
  MessageSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { exportUserGuideToPDF } from '../lib/pdfUtils';
import { AppSettings, UserProfile } from '../types';

interface GuideSection {
  id: string;
  title: string;
  icon: any;
  description: string;
  steps: string[];
  role: string;
}

const guideSections: GuideSection[] = [
  {
    id: 'dashboard',
    title: 'Tableau de Bord',
    icon: LayoutDashboard,
    description: 'Vue d\'ensemble en temps réel de l\'activité de l\'établissement (Hôtel, Bar et Services).',
    steps: [
      'Visualisez instantanément le Taux d\'occupation de l\'hôtel et les Graphiques de performance hebdomadaire.',
      'Suivez les indicateurs clés : Ventes brutes du jour, Encaissements et Alertes de stock bas.',
      'Utilisez les boutons de Raccourcis pour enregistrer un Check-In ou une Vente POS rapidement.',
      'Surveillez le résumé des pièces ou équipements signalés en panne.'
    ],
    role: 'Tous les utilisateurs'
  },
  {
    id: 'pos',
    title: 'Ventes & Facturation (POS)',
    icon: ShoppingCart,
    description: 'Interface d\'encaissement tactile de pointe pour le bar, la terrasse ou tout autre service.',
    steps: [
      'Naviguez parmi les articles classés par Catégories de produits.',
      'Ajustez les quantités et gérez le panier de commande de manière fluide.',
      'Choisissez le Mode de règlement : Espèces, Mobile Money (Orange, MTN, Wave), Carte Bancaire.',
      'Facturation Hôtel : Utilisez l\'option "Note de Chambre" pour imputer directement la facture sur le séjour d\'un client en cours.',
      'Clôture de Caisse (Nouveau) : Utilisez le bouton "Clôturer Caisse" à côté du panier pour effectuer la clôture journalière, compter l\'espèce physique, calculer l\'écart de caisse (excédent ou déficit) et générer un reçu imprimable.',
      'Impression Directe : Utilisez les boutons d\'impression pour générer des facturettes et reçus de ventes au format POS optimisés.',
      'La transaction s\'enregistre instantanément dans le rapport des ventes consolidé.'
    ],
    role: 'Barman, Réceptionniste, Caissière, Serveur, Manager, Admin'
  },
  {
    id: 'kitchen',
    title: 'Hub Central de Restauration (Cuisine)',
    icon: ChefHat,
    description: 'Carrefour central de la nourriture où tous les points de vente (Terrasse, Bar, VIP, Réception) lancent leurs commandes de plats.',
    steps: [
      'Hub Master : La cuisine est transformée en point de vente centralisé filtrant uniquement la nourriture (exclusion stricte des boissons).',
      'Lancement Direct : Depuis l\'onglet Cuisine, tout utilisateur habilité peut lancer une commande de nourriture directement pour n\'importe quel point de vente.',
      'Suivi en Temps Réel : Les commandes affichent un minuteur d\'écoulement pour garantir le respect des délais (En attente -> En préparation -> Prête -> Servie).',
      'Notifications Automatiques : Envoi d\'alertes aux serveurs et administrateurs dès que la commande est prête à être servie.'
    ],
    role: 'Cuisinier, Barman, Serveur, Manager, Admin'
  },
  {
    id: 'quotes',
    title: 'Devis & Factures Proiformes',
    icon: FileText,
    description: 'Création et gestion des devis et factures officiels avec auto-remplissage des coordonnées de l\'hôtel.',
    steps: [
      'Auto-remplissage Intelligent : Lors de la création d\'un devis ou d\'une facture, les informations d\'identité de l\'hôtel et son contact (nom, adresse, téléphone, email, NIF/RCCM, banque) sont automatiquement pré-remplies depuis les paramètres.',
      'Gestion des Statuts : Suivez l\'état des documents (Brouillon, Envoyé, Validé, Payé, Annulé).',
      'Suppression Sécurisée : Suppression définitive des devis/factures obsolètes via une modale de confirmation dédiée.',
      'Impression & Export PDF : Générez instantanément des documents professionnels mis aux normes de l\'établissement.'
    ],
    role: 'Réceptionniste, Manager, Admin, Caissière'
  },
  {
    id: 'chat',
    title: 'Messagerie & Notifications',
    icon: MessageSquare,
    description: 'Espace de communication instantanée entre tous les employés de l\'établissement pour faciliter la coordination.',
    steps: [
      'Salon Général : Envoyez des messages visibles par toute l\'équipe pour coordonner les tâches courantes.',
      'Discussions Privées (DMs) : Échangez en toute confidentialité avec un collaborateur spécifique en sélectionnant son profil.',
      'Notifications Toasts en Temps Réel : Un message pop-up s\'affiche instantanément en haut de l\'écran à chaque nouveau message reçu pour ne rater aucune urgence hôtelière.',
      'Accès Direct : Cliquez sur le bouton "Ouvrir" du pop-up de message pour être redirigé automatiquement vers l\'onglet de discussion concerné.'
    ],
    role: 'Tous les utilisateurs'
  },
  {
    id: 'inventory',
    title: 'Suivi des Stocks / Magasin',
    icon: Package,
    description: 'Controle précis des boissons, denrées et articles vendables.',
    steps: [
      'Affichez l\'inventaire actuel avec des indicateurs visuels dynamiques.',
      'Enregistrez de nouveaux produits et modifiez les prix de vente unitaires.',
      'Saisissez les réapprovisionnements (Entrées de Stocks) pour augmenter le stock physique.',
      'Alertes de Stocks Critiques (Nouveau) : Un bandeau d\'alertes dynamiques s\'affiche en tête d\'inventaire détaillant les articles en rupture ou en baisse de stock avec un bouton "Réappro" direct permettant d\'envoyer une demande de réapprovisionnement instantanée.',
      'Alerte Automatique : Le niveau de stock passe au Rouge vif dès qu\'il franchit le seuil critique (moins de 10 unités).'
    ],
    role: 'Manager, Admin'
  },
  {
    id: 'rooms',
    title: 'Gestion des Chambres',
    icon: Bed,
    description: 'Gestion du planning d\'occupation, des séjours et de la facturation hôtelière.',
    steps: [
      'Vue Grid : Aperçu visuel immédiat du statut de chaque chambre (Libre, Occupée, Ménage, Panne).',
      'Arrivée (Check-In) : Associez un client à une chambre, paramétrez les dates, et configurez le tarif ou l\'acompte.',
      'Départ (Check-Out) : Émettez la facture définitive comprenant la chambre et toutes les Consommations cumulées (POS).',
      'Fidélité & Satisfaction (Nouveau) : Lors du Check-Out, appliquez des remises de fidélité en échangeant les points du client (1 pt = 100 FCFA), saisissez une remise manuelle pour les négociations, et récoltez des enquêtes de satisfaction (notes par étoiles et commentaires catégorisés par service).',
      'Planificateur : Enregistrez une réservation future et bloquez les dates correspondantes.'
    ],
    role: 'Réceptionniste, Manager, Admin, Caissière, Serveur, Valet'
  },
  {
    id: 'halls',
    title: 'Salles & Conférences',
    icon: LayoutGrid,
    description: 'Réservation, aménagement et facturation de vos salles événementielles.',
    steps: [
      'Affichez le planning d\'occupation de vos différentes salles d\'événements.',
      'Saisissez une nouvelle fiche d\'événement (Durée, Nom de l\'organisation, Nombre de convives).',
      'Déterminez le tarif forfaitaire de location et associez-y des services de pause café ou buffet.',
      'Facturation : Convertissez l\'événement en fiche de compte POS ou imputation directe à une chambre.'
    ],
    role: 'Réceptionniste, Manager, Admin, Caissière, Serveur, Valet'
  },
  {
    id: 'housekeeping',
    title: 'Nettoyage & Gouvernance',
    icon: Sparkles,
    description: 'Contrôle rigoureux de la propreté de l\'hôtel avec validation par preuve photographique.',
    steps: [
      'Lorsqu\'une chambre effectue un Check-Out, elle bascule d\'office sous le statut "À nettoyer".',
      'Badge de Notification : L\'onglet Gouvernance affiche un badge rouge indiquant le nombre exact de chambres et salles actuellement à nettoyer.',
      'Rôles de ménage étendus : Le personnel de ménage, les valets de chambre, mais aussi les caissières et serveurs peuvent enregistrer le nettoyage des pièces.',
      'Suivi des Salles : Les salles d\'événements et espaces communs nécessitant une désinfection ou désencombrement sont également listés.',
      'Uploadez une Photo d\'après-nettoyage : Prenez obligatoirement une preuve visuelle pour soumettre la tâche terminée.',
      'Validation Administrative : Un administrateur ou gérant valide ou rejette l\'état après inspection. Une fois validée, la chambre redevient "Disponible/Libre".'
    ],
    role: 'Gouvernante, Staff, Valet de Chambre, Caissière, Serveur, Manager, Admin'
  },
  {
    id: 'maintenance',
    title: 'Dépannage & Maintenance',
    icon: Wrench,
    description: 'Traitement des anomalies et gestion budgétaire des travaux d\'entretien du patrimoine.',
    steps: [
      'Signalement (NeedSubmitted) : Identifiez et documentez une panne sur une chambre ou une salle.',
      'Badge de Notification : L\'onglet Maintenance signale le nombre de fiches d\'entretien et pannes en attente ou en cours.',
      'Autorisation Administrative : L\'Admin ou le Manager examine la panne et valide le Remplacement/Matériel avec un budget financièrement approuvé.',
      'Suivi Budgétaire (Nouveau) : La saisie et le cumul des coûts réels saisis pour l\'achat des pièces ou fournitures sont automatiquement suivis.',
      'Prise en charge (Accepted) : Le technicien qualifié accepte l\'intervention pour signaler qu\'il est à pied d\'œuvre.',
      'Clôture Définitive : Le réparateur télécharge sa photo après résolution et ferme la fiche. Le lieu redevient instantanément opérationnel.',
      'Suppression de rapports : Les administrateurs peuvent retirer définitivement un rapport ou enregistrement de maintenance erroné via une fenêtre de dialogue sécurisée.'
    ],
    role: 'Maintenancier, Réceptionniste, Manager, Admin'
  },
  {
    id: 'guests',
    title: 'Fiches Clients (CRM)',
    icon: Users,
    description: 'Base de données centralisée regroupant l\'historique d\'achats et séjours de vos résidents.',
    steps: [
      'Faites des recherches ultra-rapides par nom, pièce d\'identité ou téléphone.',
      'Consultez d\'un coup d\'œil le nombre total de nuitées passées dans l\'établissement.',
      'Identifiez instantanément les préférences ou exigences particulières du client (ex: chambre calme).',
      'Associez le client récurrent à ses nouvelles fiches d\'arrivée sans ressaisie.',
      'Suppression sécurisée : L\'Administrateur peut effacer la fiche d\'un client ou réinitialiser tout le registre via un écran de validation sécurisé demandant de taper obligatoirement "EFFACER".'
    ],
    role: 'Réceptionniste, Manager, Admin'
  },
  {
    id: 'bookings',
    title: 'Historique des Séjours & Factures',
    icon: History,
    description: 'Registre de traçabilité hôtelière consolidé pour le suivi des dossiers de réservation, des acomptes, et du chiffre d\'affaires de l\'hébergement.',
    steps: [
      'Visualisez l\'historique chronologique et complet de tous les séjours enregistrés (Check-Ins, Check-Outs).',
      'Consultez l\'historique comptable : acomptes versés, consommations extras (bar, restaurant) imputées à la chambre, et solde définitif.',
      'Filtrez vos dossiers par client, statut de paiement (ex: Réglé, Non payé), ou par période de séjour.',
      'Suivez les activités d\'hébergement de l\'établissement de manière transparente.'
    ],
    role: 'Réceptionniste, Manager, Admin'
  },
  {
    id: 'expenses',
    title: 'Sorties de Caisses & Dépenses',
    icon: AlertCircle,
    description: 'Registre des charges de fonctionnement courantes hors investissement.',
    steps: [
      'Déclarez les dépenses d\'exploitation (Achat d\'ingrédients, factures d\'eau, électricité, charges diverses).',
      'Associez les montants et affectez une catégorie claire pour structurer vos tableaux de bord.',
      'Ces dépenses s\'imputent directement sur la marge bénéficiaire nette de l\'établissement.',
      'Modals de sécurité : Supprimez des dépenses individuelles ou effacez tout le registre comptable (Admin/Manager) en confirmant via les fenêtres de validation dédiées intégrées.'
    ],
    role: 'Manager, Admin'
  },
  {
    id: 'stats',
    title: 'Analyses & Graphiques',
    icon: BarChart3,
    description: 'Visualisation statistique globale et comparaison de rentabilité.',
    steps: [
      'Consultez le graphique d\'occupation moyenne mensuelle des literies.',
      'Obtenez le classement des articles de bar ou de cuisine les plus vendus.',
      'Visualisez l\'évolution du chiffre d\'affaires cumulé pour cibler la saisonnalité.',
      'Analysez les performances globales de l\'établissement.'
    ],
    role: 'Manager, Admin'
  },
  {
    id: 'report',
    title: 'Rapports & Comptes',
    icon: FileText,
    description: 'Consolidation financière absolue pour audit et déclarations fiscales.',
    steps: [
      'Sélectionnez une période temporelle (Journée, Semaine, Mois, ou Dates personnalisées).',
      'Bilan Consolidé : Totalise le chiffre d\'affaires par source (Bar, Chambres, Salles).',
      'Maintenance Financière (Nouveau) : Détaille la somme complète dépensée en entretien (Coût Total de Maintenance) en FCFA.',
      'Synthèse de Rentabilité : Permet d\'exporter ou d\'imprimer un document formel résumant tous les mouvements.'
    ],
    role: 'Manager, Admin'
  },
  {
    id: 'security_confirmations',
    title: 'Confirmations & Sécurité des Données',
    icon: CheckCircle2,
    description: 'Système de modales de confirmation personnalisées et protection des données par rôle.',
    steps: [
      'Modales de Confirmation sur Mesure (ConfirmModal) : Toutes les actions de suppression (ventes, articles, séjours, maintenance) s\'effectuent désormais via une modale de confirmation React élégante avec flou d\'arrière-plan.',
      'Avis et Ergonomie : Élimination définitive des blocages liés aux fenêtres pop-up natives des navigateurs mobiles ou iFrames.',
      'Restauration Automatique des Stocks : Lorsqu\'une vente est supprimée, les quantités d\'articles sont automatiquement réattribuées à leur stock respectif (Réception, VIP, Terrasse).',
      'Protection Firestore : Les opérations de suppression sont verrouillées au niveau de la base de données et réservées exclusivement aux rôles Administrateur et Manager.'
    ],
    role: 'Tous les utilisateurs'
  },
  {
    id: 'admin',
    title: 'Gestion des Droits / Comptes',
    icon: SettingsIcon,
    description: 'Sécurité et gestion des privilèges des différents employés.',
    steps: [
      'Créez des fiches collaborateurs et associez des identifiants sécurisés.',
      'Rôles assouplis : Les caissières, serveurs et valets de chambre disposent désormais d\'un accès élargi aux onglets généraux (Chambres, Salles, Ménage, Stocks).',
      'Attribuez des rôles stricts en fonction du poste occupé (Admin, Manager, Réceptionniste, Cuisinier, Maintenancier, Caissière, Serveur, Valet).',
      'Activez ou révoquez l\'accès d\'un employé en toute sécurité.',
      'Configurez la devise standard de l\'application (ex: FCFA).'
    ],
    role: 'Admin uniquement'
  },
  {
    id: 'logs',
    title: 'Audit & Journal d\'Activité',
    icon: History,
    description: 'Traçabilité absolue des événements et des actions de sécurité.',
    steps: [
      'Consultez en continu le flux d\'activité (Horodateur, Identifiant, Événement).',
      'Identifiez qui s\'est connecté, à quelle heure et depuis quelle adresse IP ou emplacement.',
      'Suivez les modifications critiques de comptes, de tarifs, ou d\'annulations de ventes.'
    ],
    role: 'Admin, Manager'
  },
  {
    id: 'bypass',
    title: 'Mode Secours Hors-ligne',
    icon: WifiOff,
    description: 'Mécanisme de secours autonome en local si les serveurs Firebase externes deviennent momentanément inaccessibles.',
    steps: [
      'Si un message d\'erreur de type "Erreur réseau" apparaît suite à des pare-feux stricts ou des connexions instables.',
      'Cliquez sur le lien "Problème de connexion Firebase ? Mode Secours Hors-ligne" disponible sous le formulaire.',
      'Saisissez votre prénom ou titre d\'identification visuel.',
      'Choisissez le profil requis (ex: Administrateur, Réceptionniste, Maintenancier) puis cliquez sur Démarrer.',
      'L\'application désactive temporairement les restrictions en ligne afin de vous laisser manipuler l\'interface et faire vos démonstrations sereinement.'
    ],
    role: 'Tous les utilisateurs'
  }
];

interface UserGuideProps {
  user?: UserProfile | null;
  settings?: AppSettings | null;
}

export const UserGuide: React.FC<UserGuideProps> = ({ user, settings = null }) => {
  const [selectedId, setSelectedId] = useState<string>(guideSections[0].id);
  const [printAll, setPrintAll] = useState<boolean>(true);
  const [isMobileDropdownOpen, setIsMobileDropdownOpen] = useState<boolean>(false);

  const activeSection = guideSections.find(s => s.id === selectedId) || guideSections[0];

  const handlePrint = (all: boolean) => {
    setPrintAll(all);
    // Give state a brief millisecond to execute re-render, then fire print dialog
    setTimeout(() => {
      try {
        window.focus();
        window.print();
      } catch (err) {
        console.error("Print failed, possibly blocked by iframe restrictions:", err);
      }
    }, 250);
  };

  useEffect(() => {
    const restorePrint = () => {
      setPrintAll(true);
    };
    window.addEventListener('afterprint', restorePrint);
    return () => window.removeEventListener('afterprint', restorePrint);
  }, []);

  return (
    <div className={cn("p-4 sm:p-6 max-w-6xl mx-auto space-y-8", printAll ? "print-all-mode" : "print-single-mode")}>
      {/* Dynamic embedded printing styles to force amazing pagination during window.print() */}
      <style>{`
        /* By default (on screen), hide elements meant only for printing */
        .print-only-handbook {
          display: none !important;
        }

        @media print {
          /* Hide standard sidebar navigators and action buttons */
          aside,
          header,
          nav,
          button,
          .no-print {
            display: none !important;
          }

          /* Handle All sections print layout */
          .print-all-mode .screen-only {
            display: none !important;
          }
          .print-all-mode .print-only-handbook {
            display: block !important;
          }

          /* Handle Single active section print layout */
          .print-single-mode .screen-only {
            display: block !important;
          }
          .print-single-mode .screen-only > div:first-child, /* Intro banner */
          .print-single-mode .screen-only button,            /* Interactive summary menu buttons */
          .print-single-mode .lg\\:col-span-4,                /* Navigation sidebar */
          .print-single-mode .screen-only > div:last-child {  /* Footer banner */
            display: none !important;
          }
          .print-single-mode .print-only-handbook {
            display: none !important;
          }
          /* Make details card expand to full page width on print */
          .print-single-mode .lg\\:col-span-8 {
            width: 100% !important;
            max-width: 100% !important;
          }
          
          /* Remove layout padding scroll controls and fixed background constraints */
          body, html {
            background: white !important;
            color: black !important;
            font-size: 11pt !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          
          main {
            padding: 0 !important;
            margin: 0 !important;
            background: white !important;
            box-shadow: none !important;
          }

          /* Force full width on print canvas and remove parent wrappers constraints */
          .print-wide {
            width: 100% !important;
            max-width: 100% !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
          }

          /* Elegant page breaking */
          .print-avoid-break {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            border-bottom: 2px dashed #E5E7EB;
            padding-bottom: 2rem !important;
            margin-bottom: 2rem !important;
          }
        }
      `}</style>

      {/* 1. Screen Only UI structure */}
      <div className="screen-only print:hidden space-y-8">
        <div className="text-center space-y-2 mb-8 md:mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-primary/10 text-primary mb-4 shadow-sm">
            <BookOpen className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-[#2B2321] uppercase">
            Guide d'Utilisation Officiel
          </h2>
          <p className="text-xs text-[#2B2321]/60 mt-1 max-w-2xl mx-auto leading-relaxed">
            Ce guide interactif décrit en détail l'usage de chaque module pour optimiser l'accueil et la comptabilité au quotidien.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Navigation Sidebar */}
          <div className="lg:col-span-4 space-y-3">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-[#2B2321]/40 px-4 mb-2 flex items-center justify-between">
              <span>Sommaire interactif</span>
              <span className="lg:hidden text-[9px] font-bold text-primary">
                {guideSections.findIndex(s => s.id === selectedId) + 1} / {guideSections.length}
              </span>
            </h3>

            {/* Mobile Dropdown Menu Selector (lg:hidden) */}
            <div className="lg:hidden relative">
              <button
                type="button"
                onClick={() => setIsMobileDropdownOpen(!isMobileDropdownOpen)}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-white border-2 border-primary/30 rounded-2xl shadow-md text-left active:scale-[0.99] transition-all"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-xl bg-primary text-white shrink-0">
                    <activeSection.icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-xs text-[#2B2321] truncate">{activeSection.title}</p>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-primary truncate">
                      {activeSection.role}
                    </p>
                  </div>
                </div>
                <div className="p-1.5 rounded-lg bg-secondary/10 text-primary shrink-0">
                  <ChevronDown className={cn("w-4 h-4 transition-transform duration-200", isMobileDropdownOpen && "rotate-180")} />
                </div>
              </button>

              {/* Collapsible Dropdown List on Mobile */}
              <AnimatePresence>
                {isMobileDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.98 }}
                    transition={{ duration: 0.15 }}
                    className="absolute left-0 right-0 top-full mt-2 z-50 bg-white border border-secondary/20 rounded-2xl shadow-2xl overflow-hidden max-h-[360px] overflow-y-auto p-1.5 space-y-1 divide-y divide-secondary/10"
                  >
                    {guideSections.map((section) => (
                      <button
                        key={section.id}
                        type="button"
                        onClick={() => {
                          setSelectedId(section.id);
                          setIsMobileDropdownOpen(false);
                        }}
                        className={cn(
                          "w-full flex items-center gap-3 px-3.5 py-3 rounded-xl transition-all text-left pt-2.5",
                          selectedId === section.id 
                            ? "bg-primary text-white font-bold shadow-xs" 
                            : "hover:bg-primary/5 text-[#2B2321]/80"
                        )}
                      >
                        <div className={cn(
                          "p-1.5 rounded-lg shrink-0",
                          selectedId === section.id ? "bg-white/20 text-white" : "bg-secondary/10 text-primary"
                        )}>
                          <section.icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-xs truncate">{section.title}</p>
                          <p className={cn(
                            "text-[9px] font-bold uppercase tracking-wider truncate",
                            selectedId === section.id ? "text-white/80" : "text-primary/70"
                          )}>
                            {section.role}
                          </p>
                        </div>
                        {selectedId === section.id && (
                          <div className="w-2 h-2 rounded-full bg-white shrink-0" />
                        )}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Desktop Vertical List Sidebar (hidden on mobile) */}
            <div className="hidden lg:block max-h-[500px] overflow-y-auto pr-1 space-y-1.5 scrollbar-thin">
              {guideSections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setSelectedId(section.id)}
                  className={cn(
                    "w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl transition-all text-left group",
                    selectedId === section.id 
                      ? "bg-primary text-white shadow-lg shadow-primary/20" 
                      : "bg-white border border-secondary/20 text-[#2B2321]/70 hover:border-primary/40 hover:bg-[#FDFBF7]"
                  )}
                >
                  <div className={cn(
                    "p-2 rounded-xl transition-colors",
                    selectedId === section.id ? "bg-white/20" : "bg-secondary/10 group-hover:bg-primary/10"
                  )}>
                    <section.icon className="w-4 h-4 shrink-0" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-xs truncate">{section.title}</p>
                    <p className={cn(
                      "text-[9px] font-bold uppercase tracking-wider opacity-60 truncate",
                      selectedId === section.id ? "text-white" : "text-primary/80"
                    )}>
                      {section.role}
                    </p>
                  </div>
                  <ChevronRight className={cn(
                    "w-4 h-4 transition-transform shrink-0",
                    selectedId === section.id ? "translate-x-0 opacity-100" : "-translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100"
                  )} />
                </button>
              ))}
            </div>
          </div>

          {/* Content Area */}
          <div className="lg:col-span-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={selectedId}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="bg-white rounded-[2.5rem] border border-[#E5C198]/30 shadow-xl shadow-primary/5 overflow-hidden"
              >
                <div className="p-6 md:p-10 space-y-8">
                  <div className="flex items-start justify-between gap-6">
                    <div className="space-y-4">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/5 text-primary text-[9px] font-black uppercase tracking-widest border border-primary/10">
                        <Info className="w-3 h-3" />
                        Aide du module
                      </div>
                      <h3 className="text-2xl md:text-3xl font-bold text-[#2B2321] font-serif">{activeSection.title}</h3>
                      <p className="text-sm md:text-base text-[#2B2321]/80 font-medium leading-relaxed">
                        {activeSection.description}
                      </p>
                    </div>
                    <div className="hidden sm:flex w-20 h-20 rounded-2xl bg-[#FDFBF7] border border-secondary/25 items-center justify-center text-primary shrink-0">
                      <activeSection.icon className="w-8 h-8" />
                    </div>
                  </div>

                  <div className="h-px bg-[#E5C198]/20 w-full"></div>

                  <div className="space-y-5">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-[#2B2321]/40 flex items-center gap-2">
                      <HelpCircle className="w-4 h-4 text-primary/70" />
                      Marche à suivre & Procédures
                    </h4>
                    <div className="grid gap-3">
                      {activeSection.steps.map((step, index) => (
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                          key={index} 
                          className="flex items-start gap-3.5 p-3.5 rounded-xl bg-[#FDFBF7] border border-[#E5C198]/10 group hover:border-primary/20 transition-colors"
                        >
                          <div className="w-7 h-7 rounded-lg bg-white border border-secondary/20 flex items-center justify-center text-xs font-black text-primary shrink-0 group-hover:bg-primary group-hover:text-white transition-colors shadow-xs">
                            {index + 1}
                          </div>
                          <p className="text-xs text-[#2B2321]/80 font-semibold pt-1 leading-relaxed">
                            {step}
                          </p>
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                    <div className="flex-1 p-3.5 rounded-2xl bg-primary/5 border border-primary/10 flex items-center gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-primary" />
                      <p className="text-[10px] font-black text-primary/80 uppercase tracking-widest">
                        Rôles Autorisés : {activeSection.role}
                      </p>
                    </div>
                    <button
                      onClick={() => handlePrint(false)}
                      className="px-5 py-3.5 bg-[#FDFBF7] hover:bg-[#2B2321]/10 border border-secondary/20 text-[#2B2321] rounded-2xl font-bold text-xs uppercase tracking-widest transition-all shadow-xs active:scale-95 flex items-center justify-center gap-2 no-print"
                      title="Imprimer uniquement cette fiche sur papier ou PDF"
                    >
                      <Printer className="w-4 h-4 shrink-0" />
                      Imprimer cette fiche
                    </button>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Action Call / Footer banner on screen */}
        <div className="bg-[#2B2321] p-6 md:p-8 rounded-[2.5rem] text-white flex flex-col md:flex-row items-center justify-between gap-6 shadow-lg shadow-primary/5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center shrink-0">
              <Info className="w-6 h-6 text-secondary" />
            </div>
            <div className="text-center md:text-left">
              <p className="font-bold text-base md:text-lg">Prêt pour une formation physique ?</p>
              <p className="text-white/60 text-xs md:text-sm mt-0.5">Le bouton ci-dessous génère un document PDF haute définition prêt pour l'impression ou la consultation.</p>
            </div>
          </div>
          <button 
            onClick={() => exportUserGuideToPDF(guideSections, settings)}
            className="w-full md:w-auto px-8 py-3.5 bg-white text-[#2B2321] hover:bg-secondary hover:text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all shadow-md active:scale-95 shrink-0 no-print flex items-center justify-center gap-2"
          >
            <FileText className="w-4 h-4 shrink-0" />
            Exporter le Guide Complet (PDF)
          </button>
        </div>
      </div>

      {/* 2. Print Only Beautiful Booklet/Handbook - Hidden on screen, beautifully arranged for printer flow */}
      <div className="print-wide print-only-handbook text-[#2B2321] bg-white font-sans max-w-4xl mx-auto">
        {/* Document Header Page-like wrapper */}
        <div className="text-center pb-6 mb-10 border-b-2 border-zinc-200">
          <h1 className="text-3xl font-black uppercase tracking-tight text-zinc-900 mb-1">
            MANUEL DE RÉFÉRENCE ET GUIDE D'UTILISATION
          </h1>
          <p className="text-sm font-medium text-zinc-500 uppercase tracking-widest">
            LOGICIEL DE GESTION HOTELIÈRE ET COMPTABILITÉ CONSOLIDÉE
          </p>
          <div className="text-[10px] font-mono text-zinc-400 mt-4">
            Dernière mise à jour : {new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>

        {/* Sequential grid of all manual workflows */}
        <div className="space-y-10">
          {guideSections.map((section, idx) => (
            <div key={section.id} className="print-avoid-break bg-zinc-50/20 p-5 rounded-2xl border border-zinc-200/50">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-200 mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-black bg-zinc-900 text-white w-6 h-6 rounded flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <h2 className="text-lg font-bold tracking-tight text-zinc-900 uppercase">
                    {section.title}
                  </h2>
                </div>
                <div className="text-[9px] uppercase tracking-wider font-extrabold text-zinc-500 bg-zinc-100 border border-zinc-200 px-3 py-1 rounded-full">
                  Accès : {section.role}
                </div>
              </div>

              <p className="text-xs text-zinc-700 italic leading-relaxed mb-4">
                {section.description}
              </p>

              <div className="space-y-2 pl-1">
                <h4 className="text-[9px] uppercase tracking-wider font-black text-zinc-400">
                  Procédures opérationnelles :
                </h4>
                <div className="space-y-1.5 pl-3 border-l-2 border-zinc-150">
                  {section.steps.map((step, sIdx) => (
                    <div key={sIdx} className="text-xs text-zinc-800 leading-relaxed flex items-start gap-2">
                      <span className="font-extrabold text-zinc-400 font-mono mt-0.5">{sIdx + 1}.</span>
                      <p className="flex-1 font-medium">{step}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center pt-8 mt-12 border-t border-zinc-200 text-[10px] text-zinc-400 tracking-widest uppercase font-mono">
          © 2026 EMPREINTES TECHNOLOGIES • SYSTÈME SÉCURISÉ EN COULEUR NATURELLE
        </div>
      </div>
    </div>
  );
};
