import React from 'react';
import { Loader2 } from 'lucide-react';

export const LoadingOverlay: React.FC<{ message?: string }> = ({ message = "Ворони несуть вісті..." }) => {
  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex flex-col items-center justify-center text-game-gold">
      <div className="relative">
        <Loader2 className="w-16 h-16 animate-spin mb-4" />
        <div className="absolute inset-0 animate-pulse bg-game-gold/20 blur-xl rounded-full"></div>
      </div>
      <p className="font-display text-xl tracking-widest animate-pulse">{message}</p>
    </div>
  );
};