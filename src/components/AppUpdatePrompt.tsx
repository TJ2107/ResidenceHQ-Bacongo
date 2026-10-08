import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { Rocket, RefreshCw, X, Sparkles, ArrowRight, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { CURRENT_APP_VERSION } from '../constants';
import { AppSettings } from '../types';

interface AppVersionData {
  version: string;
  title?: string;
  description?: string;
  isMandatory?: boolean;
  publishedAt?: any;
}

interface AppUpdatePromptProps {
  settings?: AppSettings | null;
}

export const AppUpdatePrompt: React.FC<AppUpdatePromptProps> = ({ settings }) => {
  const [remoteUpdate, setRemoteUpdate] = useState<AppVersionData | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // Current client local version
  const [localVersion, setLocalVersion] = useState<string>(() => {
    return localStorage.getItem('residence_app_version') || CURRENT_APP_VERSION;
  });

  // Check from prop settings if available
  useEffect(() => {
    if (settings?.currentAppVersion && settings.currentAppVersion !== localVersion) {
      setRemoteUpdate({
        version: settings.currentAppVersion,
        title: settings.appVersionTitle || `Mise à jour v${settings.currentAppVersion}`,
        description: settings.appVersionChangelog || "Une nouvelle version de l'application est prête.",
        isMandatory: true,
        publishedAt: settings.appVersionPublishedAt
      });
    }
  }, [settings?.currentAppVersion, localVersion]);

  useEffect(() => {
    // Listen to settings/global in real-time as source of truth
    const unsub = onSnapshot(doc(db, 'settings', 'global'), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as AppSettings;
        if (data.currentAppVersion && data.currentAppVersion !== localVersion) {
          setRemoteUpdate({
            version: data.currentAppVersion,
            title: data.appVersionTitle || `Mise à jour v${data.currentAppVersion}`,
            description: data.appVersionChangelog || "Une nouvelle version de l'application est disponible.",
            isMandatory: true,
            publishedAt: data.appVersionPublishedAt
          });
          setIsDismissed(false);
        } else if (!settings?.currentAppVersion || settings.currentAppVersion === localVersion) {
          setRemoteUpdate(null);
        }
      }
    }, (error) => {
      console.debug("Notice on settings/global sync:", error);
    });

    return () => unsub();
  }, [localVersion]);

  const handleApplyUpdate = async () => {
    if (!remoteUpdate) return;
    setIsUpdating(true);
    toast.loading("Application de la nouvelle version en cours...");

    try {
      // 1. Update localStorage with new version
      localStorage.setItem('residence_app_version', remoteUpdate.version);
      setLocalVersion(remoteUpdate.version);

      // 2. Unregister any stale service workers if applicable
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          await registration.unregister();
        }
      }

      // 3. Clear transient cache keys if needed
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }

      // 4. Force hard reload
      setTimeout(() => {
        window.location.reload();
      }, 600);
    } catch (e) {
      console.warn("Reloading application directly:", e);
      window.location.reload();
    }
  };

  if (!remoteUpdate || remoteUpdate.version === localVersion) {
    return null;
  }

  // Minimized pill view if dismissed
  if (isDismissed) {
    return (
      <div className="fixed bottom-4 left-4 z-[999]">
        <motion.button
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          onClick={() => setIsDismissed(false)}
          className="flex items-center gap-2 px-3.5 py-2 bg-[#1C2321] text-white rounded-full text-xs font-bold shadow-xl border border-secondary/40 hover:bg-black transition-all cursor-pointer group"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <Rocket className="w-3.5 h-3.5 text-amber-400 group-hover:rotate-12 transition-transform" />
          <span>Mise à jour v{remoteUpdate.version}</span>
        </motion.button>
      </div>
    );
  }

  return (
    <AnimatePresence>
      <aside 
        aria-label="Notification de mise à jour"
        className="fixed bottom-4 right-4 left-4 sm:left-auto sm:max-w-md z-[999]"
      >
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 30, scale: 0.95 }}
          className="bg-white border-2 border-emerald-500/80 shadow-2xl rounded-3xl p-5 overflow-hidden relative"
        >
          {/* Subtle decorative glowing background */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl -z-10" />

          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-md animate-bounce">
                <Rocket className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800">
                    Nouvelle Version
                  </span>
                  <span className="text-xs font-bold text-gray-500 font-mono">
                    v{remoteUpdate.version}
                  </span>
                </div>
                <h4 className="font-bold text-sm text-[#1C2321] mt-0.5">
                  {remoteUpdate.title || "Mise à jour disponible"}
                </h4>
              </div>
            </div>

            {!remoteUpdate.isMandatory && (
              <button
                onClick={() => setIsDismissed(true)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg transition-colors cursor-pointer"
                title="Masquer temporairement"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {remoteUpdate.description && (
            <div className="my-3 p-3 bg-gray-50 rounded-2xl border border-gray-100 text-xs text-gray-700 leading-relaxed max-h-28 overflow-y-auto custom-scrollbar whitespace-pre-line">
              {remoteUpdate.description}
            </div>
          )}

          <div className="pt-2 flex items-center justify-between gap-2">
            <p className="text-[10px] text-gray-400 font-medium">
              Version active : <span className="font-mono">{localVersion}</span>
            </p>

            <button
              onClick={handleApplyUpdate}
              disabled={isUpdating}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
            >
              {isUpdating ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              <span>Mettre à jour maintenant</span>
            </button>
          </div>
        </motion.div>
      </aside>
    </AnimatePresence>
  );
};
