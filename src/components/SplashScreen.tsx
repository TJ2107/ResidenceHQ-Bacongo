import React from 'react';
import { motion } from 'motion/react';

import { AppSettings } from '../types';

export const SplashScreen = ({ settings }: { settings?: AppSettings | null }) => (
  <motion.div 
    initial={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 z-[200] flex flex-col items-center justify-center text-white"
    style={{ backgroundColor: settings?.primaryColor || '#0D5C53' }}
  >
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="text-center flex flex-col items-center"
    >
      <div className="w-40 h-40 mb-6 rounded-full bg-[#FDFBF7] flex items-center justify-center border-4 border-white/20 overflow-hidden shadow-2xl">
        <img src={settings?.logoUrl || "/logo.png"} alt="Logo" className="w-full h-full object-contain" onError={(e) => {
          const target = e.currentTarget;
          if (!target.src.includes('/logo.png')) {
            target.src = '/logo.png';
          } else if (target.parentElement) {
            target.style.display = 'none';
            target.parentElement.innerHTML = `<span class="text-4xl font-bold" style="color: ${settings?.primaryColor || '#0D5C53'}">${settings?.hotelName?.[0] || 'HQ'}</span>`;
          }
        }} />
      </div>
      <h1 className="text-5xl font-bold tracking-tight mb-4 font-serif italic">{settings?.hotelName || 'Résidence HQ'}</h1>
      <div className="w-48 h-1 bg-white/20 mx-auto overflow-hidden rounded-full">
        <motion.div 
          initial={{ x: '-100%' }}
          animate={{ x: '100%' }}
          transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
          className="w-full h-full bg-white"
        />
      </div>
      <p className="mt-4 font-medium text-[10px] uppercase tracking-[0.3em] opacity-50">Chargement du système...</p>
      <div className="absolute bottom-8 left-0 right-0 text-center">
        <p className="text-[9px] font-bold uppercase tracking-widest opacity-30">
          © 2026 Empreintes Technologies
        </p>
      </div>
    </motion.div>
  </motion.div>
);
