
import React, { useEffect, useState } from 'react';
import { Button } from './Button';
import { Character, House, SaveFile } from '../shared/types';
import { Trash2, User, Clock, ChevronRight } from 'lucide-react';
import { HOUSE_DATA } from '../shared/constants';

interface MainMenuProps {
  onStartNew: () => void;
  onLoadGame: (saveData: SaveFile) => void;
}

export const MainMenu: React.FC<MainMenuProps> = ({ onStartNew, onLoadGame }) => {
  const [saves, setSaves] = useState<SaveFile[]>([]);

  useEffect(() => {
    // Load all saves
    try {
      const savedData = localStorage.getItem('got_saves_v2');
      if (savedData) {
        const parsed = JSON.parse(savedData);
        setSaves(Object.values(parsed));
      }
    } catch (e) {
      console.error("Error loading saves", e);
    }
  }, []);

  const handleDelete = (name: string) => {
    if (window.confirm(`Видалити історію персонажа ${name}?`)) {
      try {
        const savedData = localStorage.getItem('got_saves_v2');
        if (savedData) {
          const parsed = JSON.parse(savedData);
          
          // Ensure we delete the specific key
          if (parsed[name]) {
            delete parsed[name];
            localStorage.setItem('got_saves_v2', JSON.stringify(parsed));
            setSaves(Object.values(parsed));
          }
        }
      } catch (err) {
        console.error("Failed to delete save", err);
      }
    }
  };

  return (
    <div className="h-screen w-full flex flex-col items-center justify-center text-center relative bg-black overflow-hidden">
      {/* Background with Overlay */}
      <div className="absolute inset-0 z-0">
        <img 
          src="https://images.unsplash.com/photo-1533613220915-609f661a6fe1?q=80&w=2564&auto=format&fit=crop" 
          alt="Throne" 
          className="w-full h-full object-cover opacity-40 scale-105 animate-[pulse_15s_ease-in-out_infinite]"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/40 to-black"></div>
      </div>

      {/* Content */}
      <div className="relative z-10 px-6 w-full max-w-5xl flex flex-col md:flex-row gap-12 items-center md:items-stretch">
        
        {/* Title Section */}
        <div className="flex-1 flex flex-col justify-center items-center md:items-start text-center md:text-left">
          <h1 className="text-5xl md:text-7xl font-display text-transparent bg-clip-text bg-gradient-to-b from-game-gold to-yellow-900 drop-shadow-sm mb-4 tracking-widest">
            ГРА ПРЕСТОЛІВ
          </h1>
          <h2 className="text-2xl md:text-3xl font-serif text-stone-300 mb-8 tracking-widest uppercase border-b border-game-gold/30 pb-4 inline-block">
            Тіні Вестеросу
          </h2>
          <p className="text-lg text-stone-400 mb-12 max-w-md font-serif italic leading-relaxed">
            "Коли граєш у гру престолів, ти виграєш або помираєш. Середини не існує."
          </p>
          
          <Button 
            onClick={onStartNew} 
            className="w-full md:w-auto text-xl py-4 px-12 shadow-[0_0_20px_rgba(197,160,89,0.3)]"
          >
            Нова Історія
          </Button>
        </div>

        {/* Saves Section */}
        <div className="flex-1 w-full max-w-md bg-black/60 backdrop-blur-md border border-white/10 rounded-lg p-6 flex flex-col h-[500px]">
          <h3 className="text-game-gold font-display text-xl mb-4 flex items-center gap-2">
            <User size={20} /> Ваші Персонажі
          </h3>
          
          <div className="flex-1 overflow-y-auto scrollbar-hide space-y-3 pr-2">
            {saves.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-stone-500 italic">
                <p>Історій ще не написано...</p>
              </div>
            ) : (
              saves.map((save) => (
                <div 
                  key={save.character.name}
                  onClick={() => onLoadGame(save)}
                  className="group relative bg-stone-900/80 border border-stone-700 hover:border-game-gold p-4 rounded transition-all cursor-pointer hover:bg-stone-800 pr-12"
                >
                  {/* Delete Button - Positioned Absolutely */}
                  <button 
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(save.character.name);
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="absolute top-3 right-3 z-50 text-stone-600 hover:text-red-500 bg-black/50 hover:bg-red-950/50 p-2 rounded-full transition-all border border-transparent hover:border-red-900/50"
                    title="Видалити"
                  >
                    <Trash2 size={16} className="pointer-events-none" />
                  </button>

                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{HOUSE_DATA[save.character.house].icon}</span>
                      <div>
                        <h4 className="text-game-gold font-display font-bold leading-none">{save.character.name}</h4>
                        <span className="text-xs text-stone-400 font-serif">Дім {save.character.house}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-end mt-2">
                    <div className="text-xs text-stone-500 flex flex-col gap-1">
                       <span className="flex items-center gap-1"><Clock size={12}/> Хід {save.turnCount}</span>
                       <span className="italic max-w-[200px] truncate">{save.currentScene.narrative.substring(0, 30)}...</span>
                    </div>
                    <div className="text-game-gold opacity-0 group-hover:opacity-100 transition-opacity">
                      <ChevronRight />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
      
      <footer className="absolute bottom-6 text-stone-700 text-sm font-display w-full text-center">
        Valar Morghulis • Powered by Gemini & Maria Kasycheva
      </footer>
    </div>
  );
};
