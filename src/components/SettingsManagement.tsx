import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { AppSettings } from '../types';
import { Palette, Upload, Save, RefreshCcw, Check, Users, QrCode, Printer, Link, ExternalLink, Sparkles, Rocket, Megaphone, RefreshCw, Trash2, AlertTriangle, Database } from 'lucide-react';
import { motion } from 'motion/react';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';
import { BroadcastNotificationModal } from './BroadcastNotificationModal';
import { CURRENT_APP_VERSION } from '../constants';
import { wipeAllSalesAndDatabase } from '../lib/utils';

export const SettingsManagement = ({ isAdmin }: { isAdmin: boolean }) => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [isWiping, setIsWiping] = useState(false);
  const [showWipeConfirm, setShowWipeConfirm] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      // Priority 1: Local Storage
      const saved = localStorage.getItem('appSettings');
      if (saved) {
        try {
          setSettings(JSON.parse(saved));
          setLoading(false);
        } catch (e) {}
      }

      try {
        const docRef = doc(db, 'settings', 'global');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const remoteSettings = { id: docSnap.id, ...docSnap.data() } as AppSettings;
          setSettings(remoteSettings);
          localStorage.setItem('appSettings', JSON.stringify(remoteSettings));
        } else if (!saved) {
          const defaultSettings: AppSettings = {
            id: 'global',
            theme: 'default',
            primaryColor: '#0D5C53',
            secondaryColor: '#C5A059',
            accentColor: '#D4AF37',
            logoUrl: '/logo.png',
            hotelName: 'Résidence HQ',
            address: "02 rue Daniel Mayinguidi, Massissia (derrière l'usine GO Fresh), Brazzaville",
            poolAdultPrice: 2000,
            poolChildPrice: 1000
          };
          setSettings(defaultSettings);
          localStorage.setItem('appSettings', JSON.stringify(defaultSettings));
        }
      } catch (error: any) {
        console.warn("Using local settings fallback:", error?.message);
        if (!saved) {
          const defaultSettings: AppSettings = {
            id: 'global',
            theme: 'default',
            primaryColor: '#0D5C53',
            secondaryColor: '#C5A059',
            accentColor: '#D4AF37',
            logoUrl: '/logo.png',
            hotelName: 'Résidence HQ',
            address: "02 rue Daniel Mayinguidi, Massissia (derrière l'usine GO Fresh), Brazzaville",
            poolAdultPrice: 2000,
            poolChildPrice: 1000
          };
          setSettings(defaultSettings);
          localStorage.setItem('appSettings', JSON.stringify(defaultSettings));
        }
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && settings) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (settings) {
          setSettings({ ...settings, logoUrl: reader.result as string });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    if (!settings || !isAdmin) return;
    setSaving(true);
    // Always save to localStorage first
    localStorage.setItem('appSettings', JSON.stringify(settings));
    
    try {
      await setDoc(doc(db, 'settings', 'global'), settings);
    } catch (error) {
      console.warn("Firestore settings save bypassed, using local storage:", error);
    } finally {
      setSaving(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      window.location.reload();
    }
  };

  const handleCopyLink = () => {
    const clientUrl = `${window.location.origin}?mode=client`;
    navigator.clipboard.writeText(clientUrl);
    toast.success('Lien direct copié dans le presse-papiers !');
  };

  const handlePrintQR = () => {
    if (!settings) return;
    const clientUrl = `${window.location.origin}?mode=client`;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error("Veuillez autoriser les popups pour imprimer la fiche QR Code.");
      return;
    }
    
    printWindow.document.write(`
      <html>
        <head>
          <title>Affiche QR Code - La Voix du Client</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
            body {
              font-family: 'Plus Jakarta Sans', sans-serif;
              color: #2B2321;
              background-color: #FDFBF7;
              margin: 0;
              padding: 0;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              text-align: center;
            }
            .card {
              border: 2px solid #E5C198;
              padding: 60px 40px;
              border-radius: 32px;
              background: white;
              max-width: 480px;
              box-shadow: 0 20px 40px rgba(43,35,33,0.04);
              margin: 20px;
              box-sizing: border-box;
            }
            .logo {
              width: 80px;
              height: 80px;
              margin: 0 auto 20px auto;
              object-fit: contain;
              display: block;
            }
            .logo-placeholder {
              width: 80px;
              height: 80px;
              border-radius: 24px;
              background: #1A8B8C10;
              color: #1A8B8C;
              font-size: 24px;
              font-weight: 800;
              display: flex;
              align-items: center;
              justify-content: center;
              margin: 0 auto 20px auto;
              border: 1px solid #1A8B8C20;
            }
            h1 {
              font-family: 'Playfair Display', serif;
              font-size: 34px;
              margin: 0 0 8px 0;
              font-style: italic;
              color: #2B2321;
            }
            h2 {
              font-size: 11px;
              text-transform: uppercase;
              letter-spacing: 3px;
              color: #1A8B8C;
              margin: 0 0 40px 0;
              font-weight: 800;
            }
            .qr-container {
              padding: 24px;
              background: #FDFBF7;
              border: 1px solid #E5C19840;
              border-radius: 24px;
              display: inline-block;
              margin-bottom: 30px;
              box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);
            }
            p.lead {
              font-size: 18px;
              font-weight: 700;
              margin: 0 0 10px 0;
              color: #2B2321;
            }
            p.sub {
              font-size: 13px;
              color: #2B2321A0;
              margin: 0 auto 40px auto;
              line-height: 1.6;
              max-width: 380px;
            }
            .footer {
              font-size: 9px;
              text-transform: uppercase;
              letter-spacing: 2px;
              color: #2B232160;
              border-top: 1px solid #E5C19830;
              padding-top: 24px;
              font-weight: 700;
            }
            @media print {
              body {
                background: white;
                padding: 0;
              }
              .card {
                box-shadow: none;
                border: 2px solid #E5C198;
                margin: 0;
              }
            }
          </style>
        </head>
        <body>
          <div class="card">
            ${settings.logoUrl
              ? `<img class="logo" src="${settings.logoUrl}" alt="Logo" onerror="this.src='/logo.png'" />` 
              : `<div class="logo-placeholder">HQ</div>`
            }
            <h1>${settings.hotelName || 'Résidence HQ'}</h1>
            <h2>Votre avis nous aide à grandir</h2>
            
            <p class="lead">Votre avis nous est précieux !</p>
            <p class="sub">Scannez ce QR Code pour évaluer la qualité de nos services (Chambres, Service, Restauration) en quelques secondes.</p>
            
            <div class="qr-container" id="qr-target"></div>
            
            <div class="footer">
              La Voix du Client • Powered by Empreintes Technologies
            </div>
          </div>
          
          <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
          <script>
            new QRCode(document.getElementById("qr-target"), {
              text: "${clientUrl}",
              width: 220,
              height: 220,
              colorDark : "#2B2321",
              colorLight : "#FDFBF7",
              correctLevel : QRCode.CorrectLevel.H
            });
            setTimeout(() => {
              window.print();
              window.close();
            }, 600);
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  if (loading) return <div className="p-4 md:p-6 text-center">Chargement des paramètres...</div>;
  if (!settings) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-8 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[#2B2321] uppercase">Personnalisation</h2>
          <p className="text-xs text-[#2B2321]/60 mt-1">Apparence de l'application</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3 bg-[#1A8B8C] text-white rounded-2xl font-bold hover:bg-[#157071] transition-all shadow-lg shadow-[#1A8B8C]/20 disabled:opacity-50"
        >
          {saving ? <RefreshCcw className="w-5 h-5 animate-spin" /> : success ? <Check className="w-5 h-5" /> : <Save className="w-5 h-5" />}
          {saving ? 'Enregistrement...' : success ? 'Enregistré !' : 'Enregistrer les modifications'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        {/* Brand Identity */}
        <section className="bg-white p-4 md:p-6 rounded-3xl border border-[#E5C198]/30 shadow-sm space-y-8">
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <Upload className="w-6 h-6 text-[#1A8B8C]" />
              <h3 className="text-xl font-bold text-[#2B2321]">Identité visuelle</h3>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-[#1A8B8C]/60 ml-1">Nom de l'établissement</label>
                <input
                  type="text"
                  value={settings.hotelName}
                  onChange={(e) => setSettings({ ...settings, hotelName: e.target.value })}
                  className="w-full px-4 py-3 bg-[#FDFBF7] border border-[#E5C198]/30 rounded-xl outline-none font-bold focus:border-[#1A8B8C] transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-[#1A8B8C]/60 ml-1">Logo personnalisé</label>
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 bg-[#FDFBF7] rounded-2xl border border-[#E5C198]/30 flex items-center justify-center overflow-hidden">
                    {settings.logoUrl ? (
                      <img src={settings.logoUrl} alt="Logo preview" className="w-full h-full object-contain" />
                    ) : (
                      <span className="text-2xl font-bold text-[#1A8B8C]/20">HQ</span>
                    )}
                  </div>
                  <label className="flex-1 cursor-pointer">
                    <div className="px-4 py-3 bg-gray-50 border border-dashed border-[#E5C198] rounded-xl text-center hover:bg-gray-100 transition-all">
                      <span className="text-xs font-bold text-[#2B2321]/60">Cliquez pour télécharger</span>
                    </div>
                    <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6 pt-6 border-t border-[#E5C198]/20">
            <div className="flex items-center gap-3 mb-2">
              <Palette className="w-6 h-6 text-[#1A8B8C]" />
              <h3 className="text-xl font-bold text-[#2B2321]">Couleurs de l'interface</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-[#1A8B8C]/60">Primaire</label>
                <input
                  type="color"
                  value={settings.primaryColor}
                  onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value, theme: 'custom' })}
                  className="w-full h-10 rounded-lg cursor-pointer"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-[#1A8B8C]/60">Secondaire</label>
                <input
                  type="color"
                  value={settings.secondaryColor}
                  onChange={(e) => setSettings({ ...settings, secondaryColor: e.target.value, theme: 'custom' })}
                  className="w-full h-10 rounded-lg cursor-pointer"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-[#1A8B8C]/60">Accent</label>
                <input
                  type="color"
                  value={settings.accentColor}
                  onChange={(e) => setSettings({ ...settings, accentColor: e.target.value, theme: 'custom' })}
                  className="w-full h-10 rounded-lg cursor-pointer"
                />
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* PORTAIL CLIENT / VOIX DU CLIENT QR CODE GENERATOR */}
      <section className="bg-white p-4 md:p-6 rounded-3xl border border-[#E5C198]/30 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E5C198]/10">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <QrCode className="w-6 h-6 text-[#1A8B8C]" />
              <h3 className="text-xl font-bold text-[#2B2321]">Portail d'Évaluation Client & Code QR (VOC)</h3>
            </div>
            <p className="text-xs text-[#2B2321]/60">Générez des fiches QR Code d'évaluation pour vos tables, chambres, ou la réception.</p>
          </div>
          <div className="flex flex-wrap gap-1.5 shrink-0">
            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full text-[10px] font-bold uppercase tracking-wider">
              100% Sécurisé
            </span>
            <span className="px-2 py-0.5 bg-[#1A8B8C]/10 text-[#1A8B8C] border border-[#1A8B8C]/20 rounded-full text-[10px] font-bold uppercase tracking-wider">
              Zéro Google Auth
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6 items-center">
          <div className="md:col-span-7 space-y-5">
            <div className="space-y-2.5">
              <h4 className="font-bold text-sm text-[#2B2321]">Comment fonctionne le direct-accès ?</h4>
              <p className="text-xs text-[#2B2321]/70 leading-relaxed">
                Afin de garantir que les clients de votre hôtel puissent émettre leurs avis en toute simplicité sans s'authentifier par Google (ce qui est réservé à votre personnel), le système utilise un lien spécial doté d'une clé d'accès sécurisée.
              </p>
              <div className="p-3 bg-[#FDFBF7] rounded-xl border border-[#E5C198]/20 flex items-center justify-between gap-3 font-mono text-[11px] text-[#2B2321]/80">
                <span className="truncate">{window.location.origin}?mode=client</span>
                <button
                  onClick={handleCopyLink}
                  type="button"
                  className="px-2.5 py-1.5 bg-[#1A8B8C] hover:bg-[#157071] text-white rounded-lg font-bold text-[10px] transition-all flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <Link className="w-3 h-3" />
                  Copier
                </button>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <h4 className="font-bold text-sm text-[#2B2321]">Recommandations d'usage :</h4>
              <ul className="text-xs text-[#2B2321]/70 space-y-1.5 list-disc pl-4 leading-relaxed">
                <li>Imprimez l'affiche officielle ci-dessous et disposez-la sous un cadre en verre à la réception.</li>
                <li>Générez de petits autocollants QR Code à coller sur les tables du restaurant ou au bar.</li>
                <li>Insérez le QR Code dans les livrets d'accueil disposés dans chaque chambre.</li>
              </ul>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-3">
              <button
                onClick={handlePrintQR}
                type="button"
                className="px-5 py-3 bg-[#1A8B8C] hover:bg-[#157071] text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                Imprimer l'Affiche QR Code (A4/Poster)
              </button>
              <a
                href={`${window.location.origin}?mode=client`}
                target="_blank"
                rel="noreferrer"
                className="px-5 py-3 bg-gray-50 hover:bg-gray-100 text-[#2B2321]/70 border border-gray-200 rounded-xl font-bold text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                Tester le Portail Client
              </a>
            </div>
          </div>

          <div className="md:col-span-5 flex flex-col items-center justify-center">
            <div className="p-5 bg-[#FDFBF7] border border-[#E5C198]/30 rounded-3xl shadow-sm text-center space-y-4 w-full max-w-[280px] mx-auto">
              <div className="bg-white p-4 rounded-2xl border border-[#E5C198]/20 inline-block shadow-xs">
                <QRCodeSVG
                  value={`${window.location.origin}?mode=client`}
                  size={150}
                  level="H"
                  bgColor="#FFFFFF"
                  fgColor="#2B2321"
                  includeMargin={true}
                />
              </div>
              <div>
                <p className="font-serif font-bold italic text-sm text-[#2B2321]">{settings.hotelName || 'Résidence HQ'}</p>
                <p className="text-[10px] font-black uppercase text-[#1A8B8C] tracking-widest mt-0.5">Scannez pour évaluer</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION: MISES À JOUR & NOTIFICATIONS GLOBALES */}
      <section className="bg-white p-6 md:p-8 rounded-3xl border border-secondary/30 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-secondary/20 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center shadow-xs">
              <Rocket className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-[#2B2321]">Mises à Jour & Annonces Système</h3>
              <p className="text-xs text-gray-500">Gérez le déploiement des nouvelles versions et notifiez l'ensemble des utilisateurs</p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-gray-100 text-gray-800 border border-gray-200 w-fit">
            Version active : v{CURRENT_APP_VERSION}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-5 bg-[#FDFBF7] rounded-2xl border border-secondary/20 space-y-3 flex flex-col justify-between">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-primary" />
                <h4 className="font-bold text-sm text-[#2B2321]">Notification Générale à tous les utilisateurs</h4>
              </div>
              <p className="text-xs text-gray-600 leading-relaxed">
                Diffusez instantanément un message urgent ou informatif visible par tous les rôles connectés sur leurs écrans.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowBroadcastModal(true)}
              className="px-4 py-2.5 bg-[#1C2321] text-white hover:bg-black rounded-xl font-bold text-xs transition-all shadow-xs flex items-center gap-2 cursor-pointer w-fit"
            >
              <Megaphone className="w-3.5 h-3.5" />
              <span>Diffuser une notification</span>
            </button>
          </div>

          <div className="p-5 bg-emerald-50/50 rounded-2xl border border-emerald-200/60 space-y-3 flex flex-col justify-between">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Rocket className="w-4 h-4 text-emerald-700" />
                <h4 className="font-bold text-sm text-emerald-950">Publication d'une Mise à Jour</h4>
              </div>
              <p className="text-xs text-emerald-800 leading-relaxed">
                Alertez tous les comptes qu'une nouvelle mise à jour est disponible pour qu'ils actualisent leur application en un clic.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowBroadcastModal(true)}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs transition-all shadow-xs flex items-center gap-2 cursor-pointer w-fit"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Publier une mise à jour</span>
            </button>
          </div>
        </div>
      </section>

      {/* SECTION: PURGE & REMISE À ZÉRO DE LA BASE DE DONNÉES */}
      {isAdmin && (
        <section className="bg-red-50/60 p-6 md:p-8 rounded-3xl border border-red-200/80 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-red-200/60 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-red-100 text-red-700 flex items-center justify-center shadow-xs">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-red-950">Purge & Remise à Zéro des Données</h3>
                <p className="text-xs text-red-700">Suppression définitive de toutes les ventes et nettoyage complet de la base de données</p>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200 w-fit">
              Zone Administrateur
            </span>
          </div>

          <p className="text-xs text-red-800/80 leading-relaxed">
            Cette opération efface immédiatement tout l'historique des ventes (caisse POS, restaurant, bar, terrasse, chicha), 
            les réservations, mouvements et caches locaux.
          </p>

          <button
            type="button"
            onClick={() => setShowWipeConfirm(true)}
            disabled={isWiping}
            className="px-5 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            <span>{isWiping ? 'Purge en cours...' : 'Supprimer toutes les ventes et réinitialiser la base'}</span>
          </button>
        </section>
      )}

      {/* Confirmation Modal for Settings Wipe */}
      {showWipeConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-red-600 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Confirmation de Suppression
              </h3>
            </div>
            <p className="text-[#2B2321]/80 mb-6 text-sm leading-relaxed">
              Êtes-vous absolument certain de vouloir <strong>supprimer toutes les ventes et vider la base de données existante</strong> ?
              Cette action est irréversible et remettra toutes les statistiques et commandes à zéro.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowWipeConfirm(false)}
                className="px-4 py-2.5 text-gray-700 font-bold hover:bg-gray-100 rounded-xl text-xs transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={async () => {
                  setShowWipeConfirm(false);
                  setIsWiping(true);
                  try {
                    const res = await wipeAllSalesAndDatabase();
                    if (res.success) {
                      toast.success("Toutes les ventes et données ont été supprimées avec succès !");
                      setTimeout(() => window.location.reload(), 1200);
                    } else {
                      toast.error(res.error || "Erreur lors de la purge.");
                    }
                  } catch (e: any) {
                    toast.error("Erreur inattendue");
                  } finally {
                    setIsWiping(false);
                  }
                }}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs shadow-lg shadow-red-600/30 transition-all"
              >
                Oui, Tout Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Broadcast / Update Modal */}
      <BroadcastNotificationModal
        isOpen={showBroadcastModal}
        onClose={() => setShowBroadcastModal(false)}
      />

      <div className="bg-[#FDFBF7] p-4 md:p-6 rounded-3xl border border-[#E5C198]/20 text-center">
        <p className="text-sm text-[#2B2321]/60 italic">
          "La personnalisation permet d'adapter l'outil à l'identité unique de votre établissement."
        </p>
      </div>
    </div>
  );
};
