import React, { useState } from 'react';
import { db } from '../firebase';
import { collection, addDoc, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { 
  X, 
  Megaphone, 
  Rocket, 
  RefreshCw, 
  Send, 
  Bell, 
  AlertTriangle, 
  Info, 
  Sparkles, 
  CheckCircle2, 
  Radio
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { UserProfile } from '../types';
import { CURRENT_APP_VERSION } from '../constants';
import { logEvent } from '../lib/utils';

interface BroadcastNotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  user?: UserProfile;
}

export const BroadcastNotificationModal: React.FC<BroadcastNotificationModalProps> = ({
  isOpen,
  onClose,
  user
}) => {
  const [activeTab, setActiveTab] = useState<'broadcast' | 'update'>('update');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Broadcast Message State
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastLevel, setBroadcastLevel] = useState<'info' | 'alert' | 'success'>('info');

  // App Update State
  const [updateVersion, setUpdateVersion] = useState(CURRENT_APP_VERSION);
  const [updateTitle, setUpdateTitle] = useState('Nouvelle mise à jour disponible');
  const [updateNotes, setUpdateNotes] = useState(
    "Améliorations récentes :\n- Analyse des produits les plus vendus dans le module Statistiques\n- Résolution et optimisation du module Dépenses\n- Intégration du code QR pour l'évaluation client"
  );
  const [isMandatory, setIsMandatory] = useState(true);

  if (!isOpen) return null;

  // 1. Send Broadcast Notification to all users
  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastMessage.trim()) {
      toast.error("Veuillez saisir un message à diffuser.");
      return;
    }

    setIsSubmitting(true);
    try {
      const fullMessage = broadcastTitle.trim() 
        ? `📢 [${broadcastTitle.trim()}] : ${broadcastMessage.trim()}`
        : `📢 ${broadcastMessage.trim()}`;

      await addDoc(collection(db, 'notifications'), {
        type: 'broadcast',
        level: broadcastLevel,
        title: broadcastTitle.trim() || 'Annonce Générale',
        message: fullMessage,
        timestamp: serverTimestamp(),
        readBy: [],
        targetRole: 'all',
        source: 'admin_broadcast',
        senderName: user?.username || 'Direction',
        senderId: user?.id || 'admin'
      });

      // Audit Event Log
      if (user) {
        try {
          await logEvent(user, 'Diffusion', `Diffusion générale : ${fullMessage}`);
        } catch (e) {
          console.debug("Notice audit logging broadcast:", e);
        }
      }

      // Browser Notification if permitted
      if ('Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification(broadcastTitle.trim() || "Annonce Système", {
            body: broadcastMessage.trim(),
            icon: '/logo.png'
          });
        } catch (e) {
          console.warn("Browser notification could not be dispatched:", e);
        }
      }

      toast.success("Notification diffusée à tous les utilisateurs avec succès !");
      setBroadcastTitle('');
      setBroadcastMessage('');
      onClose();
    } catch (error) {
      console.error("Error sending broadcast notification:", error);
      toast.error("Échec de l'envoi de la notification. Veuillez réessayer.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // 2. Publish App Update Notification to all users
  const handlePublishUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!updateVersion.trim()) {
      toast.error("Veuillez spécifier un numéro de version.");
      return;
    }

    setIsSubmitting(true);
    try {
      const updateData = {
        version: updateVersion.trim(),
        title: updateTitle.trim() || `Mise à jour v${updateVersion.trim()}`,
        description: updateNotes.trim(),
        isMandatory,
        publishedAt: serverTimestamp(),
        publishedBy: user?.username || 'Direction',
        publishedById: user?.id || 'admin'
      };

      let hasSavedAny = false;

      // 1. Save version to settings/global
      try {
        await setDoc(doc(db, 'settings', 'global'), {
          currentAppVersion: updateVersion.trim(),
          appVersionTitle: updateTitle.trim() || `Mise à jour v${updateVersion.trim()}`,
          appVersionChangelog: updateNotes.trim(),
          appVersionPublishedAt: serverTimestamp()
        }, { merge: true });
        hasSavedAny = true;
      } catch (err) {
        console.warn("Could not save to settings/global:", err);
      }

      // 2. Audit Event Log
      if (user) {
        try {
          await logEvent(user, 'Mise à jour', `Déploiement de la version ${updateVersion.trim()} : ${updateTitle.trim()}`);
          hasSavedAny = true;
        } catch (e) {
          console.debug("Notice audit logging update:", e);
        }
      }

      // 3. Create real-time notification for all users
      const notificationMessage = `🚀 Nouvelle mise à jour (${updateVersion.trim()}) disponible : ${updateTitle.trim()}. Cliquez pour actualiser l'application.`;

      try {
        await addDoc(collection(db, 'notifications'), {
          type: 'app_update',
          title: `Mise à jour v${updateVersion.trim()}`,
          version: updateVersion.trim(),
          message: notificationMessage,
          changelog: updateNotes.trim(),
          isMandatory,
          timestamp: serverTimestamp(),
          readBy: [],
          targetRole: 'all',
          source: 'system_update',
          senderName: user?.username || 'Direction'
        });
        hasSavedAny = true;
      } catch (err) {
        console.warn("Could not create app_update notification:", err);
      }

      // 4. Update local version for current user
      localStorage.setItem('residence_app_version', updateVersion.trim());

      // 5. Browser notification
      if ('Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification(`Mise à jour v${updateVersion.trim()} disponible`, {
            body: updateTitle.trim(),
            icon: '/logo.png'
          });
        } catch (e) {
          console.warn("Browser notification could not be dispatched:", e);
        }
      }

      if (hasSavedAny) {
        toast.success(`Mise à jour v${updateVersion.trim()} publiée ! Tous les utilisateurs ont été notifiés.`);
        onClose();
      } else {
        throw new Error("Impossible d'enregistrer la mise à jour sur le serveur.");
      }
    } catch (error: any) {
      console.error("Error publishing app update:", error);
      toast.error(error?.message || "Erreur lors de la publication de la mise à jour.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto bg-black/60 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-secondary/30 flex flex-col overflow-hidden"
        >
          {/* HEADER */}
          <div className="p-5 border-b border-gray-100 flex items-center justify-between gap-3 bg-gray-50/70">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-xs">
                {activeTab === 'update' ? <Rocket className="w-5 h-5 text-primary" /> : <Megaphone className="w-5 h-5 text-primary" />}
              </div>
              <div>
                <h3 className="font-serif font-bold text-lg text-[#1C2321]">
                  {activeTab === 'update' ? "Publication de Mise à Jour" : "Diffusion de Message à Tous"}
                </h3>
                <p className="text-xs text-gray-500 font-medium">
                  {activeTab === 'update' 
                    ? "Notifiez immédiatement tous les utilisateurs pour qu'ils appliquent la nouvelle version" 
                    : "Envoyez une annonce instantanée visible par l'ensemble de l'équipe"}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* TABS SWITCHER */}
          <div className="p-4 bg-white border-b border-gray-100 flex gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('update')}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'update' 
                  ? 'bg-primary text-white shadow-sm' 
                  : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Rocket className="w-4 h-4" />
              <span>Mise à Jour Application</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('broadcast')}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'broadcast' 
                  ? 'bg-primary text-white shadow-sm' 
                  : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Radio className="w-4 h-4" />
              <span>Annonce / Message Général</span>
            </button>
          </div>

          {/* TAB 1: APP UPDATE PUBLISHER */}
          {activeTab === 'update' && (
            <form onSubmit={handlePublishUpdate} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1">
                    Numéro de Version
                  </label>
                  <input
                    type="text"
                    required
                    value={updateVersion}
                    onChange={(e) => setUpdateVersion(e.target.value)}
                    placeholder="ex: v2.4.2"
                    className="w-full px-3.5 py-2.5 bg-[#FDFBF7] rounded-xl border border-secondary/30 text-sm font-bold text-[#1C2321] outline-none focus:border-primary font-mono"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">Version actuelle de build : {CURRENT_APP_VERSION}</p>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1">
                    Titre Résumé
                  </label>
                  <input
                    type="text"
                    required
                    value={updateTitle}
                    onChange={(e) => setUpdateTitle(e.target.value)}
                    placeholder="ex: Nouvelles fonctionnalités & optimisations"
                    className="w-full px-3.5 py-2.5 bg-[#FDFBF7] rounded-xl border border-secondary/30 text-sm font-medium text-[#1C2321] outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1">
                  Notes de Mise à Jour (Ce qui change pour les utilisateurs)
                </label>
                <textarea
                  rows={4}
                  required
                  value={updateNotes}
                  onChange={(e) => setUpdateNotes(e.target.value)}
                  placeholder="Décrivez les nouveautés, corrections ou fonctionnalités ajoutées..."
                  className="w-full p-3.5 bg-[#FDFBF7] rounded-xl border border-secondary/30 text-xs text-[#1C2321] outline-none focus:border-primary leading-relaxed resize-none custom-scrollbar"
                />
              </div>

              <div className="p-3.5 bg-blue-50/70 border border-blue-200/60 rounded-2xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <RefreshCw className="w-5 h-5 text-blue-600 shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-blue-900">Actualisation Recommandée Immédiate</p>
                    <p className="text-[11px] text-blue-700">Affiche un bouton « Mettre à jour maintenant » qui recharge automatiquement l'app.</p>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isMandatory}
                    onChange={(e) => setIsMandatory(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 border border-gray-200 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50 transition-all cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Rocket className="w-4 h-4" />
                  )}
                  <span>Publier & Notifier tous les users</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: GENERAL BROADCAST MESSAGE */}
          {activeTab === 'broadcast' && (
            <form onSubmit={handleSendBroadcast} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1">
                  Type d'Annonce
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setBroadcastLevel('info')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      broadcastLevel === 'info' 
                        ? 'bg-blue-50 text-blue-800 border-blue-300 ring-2 ring-blue-200' 
                        : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <Info className="w-3.5 h-3.5 text-blue-600" />
                    <span>Information</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setBroadcastLevel('alert')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      broadcastLevel === 'alert' 
                        ? 'bg-red-50 text-red-800 border-red-300 ring-2 ring-red-200' 
                        : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                    <span>Alerte Urgente</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setBroadcastLevel('success')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      broadcastLevel === 'success' 
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300 ring-2 ring-emerald-200' 
                        : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Succès / Info</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1">
                  Titre de l'Annonce (Optionnel)
                </label>
                <input
                  type="text"
                  value={broadcastTitle}
                  onChange={(e) => setBroadcastTitle(e.target.value)}
                  placeholder="ex: Réunion d'équipe à 15h, Rappel inventaire..."
                  className="w-full px-3.5 py-2.5 bg-[#FDFBF7] rounded-xl border border-secondary/30 text-sm font-medium text-[#1C2321] outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1">
                  Message à diffuser
                </label>
                <textarea
                  rows={4}
                  required
                  value={broadcastMessage}
                  onChange={(e) => setBroadcastMessage(e.target.value)}
                  placeholder="Rédigez le message qui apparaîtra sur l'écran de tous les utilisateurs connectés..."
                  className="w-full p-3.5 bg-[#FDFBF7] rounded-xl border border-secondary/30 text-xs text-[#1C2321] outline-none focus:border-primary leading-relaxed resize-none custom-scrollbar"
                />
              </div>

              <div className="p-3 bg-amber-50/70 border border-amber-200/60 rounded-xl text-[11px] text-amber-900 leading-relaxed">
                <strong>Visibilité collective :</strong> Ce message sera notifié en direct à <u>tous les comptes connectés</u> (réception, cuisine, bar, caisse, direction).
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 border border-gray-200 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50 transition-all cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-[#1C2321] hover:bg-black text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Send className="w-4 h-4 text-emerald-400" />
                  )}
                  <span>Diffuser la notification</span>
                </button>
              </div>
            </form>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
