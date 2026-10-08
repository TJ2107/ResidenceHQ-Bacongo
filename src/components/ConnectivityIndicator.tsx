import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff } from 'lucide-react';

interface ConnectivityIndicatorProps {
  hideInChat?: boolean;
}

export const ConnectivityIndicator: React.FC<ConnectivityIndicatorProps> = ({ hideInChat = false }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (hideInChat) {
    return null;
  }

  return (
    <div 
      title={isOnline ? 'En ligne' : 'Hors ligne'}
      className={`fixed bottom-20 lg:bottom-6 right-4 lg:right-6 z-[1000] flex items-center justify-center w-10 h-10 rounded-full shadow-lg transition-all max-h-[500px]:hidden landscape:max-lg:hidden ${isOnline ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}
    >
      {isOnline ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
    </div>
  );
};

