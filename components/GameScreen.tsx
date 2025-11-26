
import React, { useEffect, useRef, useState } from 'react';
import { GameState, House } from '../shared/types';
import { Button } from './Button';
import { GAME_CONFIG, HOUSE_NPCS, SFX_URLS, BGM_URL } from '../shared/constants';
import { Heart, Crown, Skull, MessageSquare, Save, Check, LogOut, Volume2, VolumeX, Music, Trophy, Scroll } from 'lucide-react';
import { Howl } from 'howler';

interface GameScreenProps {
  gameState: GameState;
  onOptionSelect: (optionId: string, optionText: string) => void;
  onRestart: () => void;
  onSave: () => void;
  onExit: () => void;
  onPlayAgain: () => void;
}

// Helper to determine NPC styles based on name/house association
const getNpcStyle = (name: string) => {
  let house: House | null = null;

  // 1. Check predefined list
  for (const [h, npcs] of Object.entries(HOUSE_NPCS)) {
    if (npcs.some(npc => name.includes(npc))) {
      house = h as House;
      break;
    }
  }

  // 2. Check by surname match
  if (!house) {
    if (name.includes("Ланністер")) house = House.LANNISTER;
    else if (name.includes("Старк")) house = House.STARK;
    else if (name.includes("Таргарієн")) house = House.TARGARYEN;
    else if (name.includes("Баратеон")) house = House.BARATHEON;
    else if (name.includes("Грейджой")) house = House.GREYJOY;
    else if (name.includes("Тірел")) house = House.TYRELL;
  }

  // Return styles
  switch (house) {
    case House.STARK: return "bg-slate-800 border-slate-400 text-slate-200 shadow-[0_0_10px_rgba(148,163,184,0.3)]";
    case House.LANNISTER: return "bg-red-950 border-red-500 text-red-100 shadow-[0_0_10px_rgba(239,68,68,0.3)]";
    case House.TARGARYEN: return "bg-stone-950 border-rose-600 text-rose-500 shadow-[0_0_10px_rgba(225,29,72,0.3)]";
    case House.BARATHEON: return "bg-yellow-950 border-yellow-500 text-yellow-100 shadow-[0_0_10px_rgba(234,179,8,0.3)]";
    case House.GREYJOY: return "bg-cyan-950 border-cyan-600 text-cyan-100 shadow-[0_0_10px_rgba(8,145,178,0.3)]";
    case House.TYRELL: return "bg-green-950 border-green-500 text-green-100 shadow-[0_0_10px_rgba(34,197,94,0.3)]";
    default: return "bg-stone-800 border-game-gold text-game-gold shadow-none";
  }
};

const getInitials = (name: string) => {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();
};

const NarrativeBlock: React.FC<{ text: string }> = ({ text }) => (
  <div className="prose prose-invert prose-lg font-serif leading-relaxed text-stone-200 drop-shadow-md bg-black/40 p-6 rounded-lg border border-white/5 mb-6">
    {text.split('\n').map((para, idx) => (
       <p key={idx} className="mb-4 last:mb-0">{para}</p>
    ))}
  </div>
);

const DialogueBlock: React.FC<{ speaker: string; text: string; portrait?: string }> = ({ speaker, text, portrait }) => {
  const avatarStyle = getNpcStyle(speaker);
  const initials = getInitials(speaker);

  return (
    <div className="relative mb-8 pl-0 md:pl-0 animate-[fadeIn_0.3s_ease-out]">
       <div className="flex flex-col md:flex-row md:items-start gap-4">
          
          {/* Avatar Column */}
          <div className="flex-shrink-0 flex md:flex-col items-center gap-3 md:w-24 md:pt-2">
             <div className={`w-14 h-14 md:w-16 md:h-16 rounded-full border-2 flex items-center justify-center font-display font-bold text-xl select-none overflow-hidden relative ${avatarStyle}`}>
                {portrait ? (
                  <img src={portrait} alt={speaker} className="w-full h-full object-cover animate-[fadeIn_0.5s]" />
                ) : (
                  <span>{initials}</span>
                )}
             </div>
             <span className="font-display uppercase tracking-wider text-[10px] md:text-xs text-center text-stone-400 max-w-[100px] leading-tight">
               {speaker}
             </span>
          </div>

          {/* Text Bubble */}
          <div className="flex-1 bg-black/80 border-l-4 border-game-gold p-6 rounded-r-lg shadow-lg backdrop-blur-sm relative mt-2 md:mt-0">
             <div className="absolute -top-3 -left-3 bg-game-dark text-game-gold p-1 rounded-full border border-game-gold z-10">
                <MessageSquare size={16} />
             </div>
             <p className="font-serif italic text-xl text-white/90 leading-relaxed">
                "{text}"
             </p>
          </div>
       </div>
    </div>
  );
};

const ChoiceBlock: React.FC<{ text: string }> = ({ text }) => (
  <div className="flex justify-end mb-6 opacity-75">
      <div className="bg-stone-800/60 text-stone-300 px-6 py-3 rounded-tl-2xl rounded-br-2xl border border-stone-600 font-display text-sm tracking-wide italic">
          {text}
      </div>
  </div>
);

export const GameScreen: React.FC<GameScreenProps> = ({ gameState, onOptionSelect, onRestart, onSave, onExit, onPlayAgain }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle');
  const [isMuted, setIsMuted] = useState(false); // SFX Mute
  const [isMusicMuted, setIsMusicMuted] = useState(false); // Music Mute
  const [isTakingDamage, setIsTakingDamage] = useState(false); // Visual damage feedback
  const [showFinale, setShowFinale] = useState(false);
  const isInitialLoadRef = useRef(true);
  const lastHistoryLengthRef = useRef(0);
  const lastCharacterNameRef = useRef<string | null>(null);

  const { character, currentScene, sceneImage, history, turnCount, maxTurns, currentAct, npcPortraits } = gameState;

  // Sound Refs
  const soundsRef = useRef<{
    click: Howl;
    damage: Howl;
    gameOver: Howl;
    victory: Howl;
  } | null>(null);

  const musicRef = useRef<Howl | null>(null);

  const prevHealthRef = useRef(character ? character.health : 100);
  const prevActRef = useRef(currentAct);
  const lastAutoSavedTurnRef = useRef(0);

  const isDead = character ? (character.health <= 0 || currentScene?.is_game_over) : false;

  // Initialize Sounds
  useEffect(() => {
    soundsRef.current = {
      click: new Howl({ src: [SFX_URLS.CLICK], volume: 0.4 }),
      damage: new Howl({ src: [SFX_URLS.DAMAGE], volume: 0.6 }),
      gameOver: new Howl({ src: [SFX_URLS.GAME_OVER], volume: 0.8 }),
      victory: new Howl({ src: [SFX_URLS.VICTORY], volume: 0.6 })
    };

    // Initialize Music
    musicRef.current = new Howl({
      src: [BGM_URL],
      html5: true, // Force HTML5 Audio to allow streaming and larger files
      loop: true,
      volume: 0.3,
      autoplay: false
    });

    // Try to play music (browsers might block it until interaction)
    if (!isMusicMuted) {
      musicRef.current.play();
    }

    return () => {
      soundsRef.current?.click.unload();
      soundsRef.current?.damage.unload();
      soundsRef.current?.gameOver.unload();
      soundsRef.current?.victory.unload();
      musicRef.current?.unload();
    };
  }, []);

  // Handle SFX Mute Toggle
  useEffect(() => {
    if (soundsRef.current) {
      Object.values(soundsRef.current).forEach(sound => sound.mute(isMuted));
    }
  }, [isMuted]);

  // Handle Music Mute Toggle
  useEffect(() => {
    if (musicRef.current) {
      if (isMusicMuted) {
        musicRef.current.pause();
      } else {
        if (!musicRef.current.playing()) {
          musicRef.current.play();
          musicRef.current.fade(0, 0.3, 2000); // Fade in
        }
      }
    }
  }, [isMusicMuted]);

  // Сброс флага при загрузке новой игры или сохранения (когда меняется персонаж)
  useEffect(() => {
    if (character && character.name !== lastCharacterNameRef.current) {
      // Новый персонаж = новая игра или загруженное сохранение
      isInitialLoadRef.current = true;
      lastCharacterNameRef.current = character.name;
      lastHistoryLengthRef.current = history.length;
    }
  }, [character?.name, history.length]);

  // Scroll to top on initial load, auto-scroll to bottom only if user is already near bottom
  useEffect(() => {
    if (!scrollRef.current || !character) return;

    // При первой загрузке или загрузке сохранения - прокрутка вверх
    if (isInitialLoadRef.current) {
      // Используем двойной requestAnimationFrame для гарантии, что DOM полностью обновлен
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (scrollRef.current) {
            scrollRef.current.scrollTop = 0;
          }
        });
      });
      isInitialLoadRef.current = false;
      lastHistoryLengthRef.current = history.length;
      return;
    }

    // Если история увеличилась (добавился новый контент во время игры)
    if (history.length > lastHistoryLengthRef.current) {
      const container = scrollRef.current;
      const scrollHeight = container.scrollHeight;
      const scrollTop = container.scrollTop;
      const clientHeight = container.clientHeight;
      
      // Проверяем, находится ли пользователь внизу (в пределах 150px от низа для мобильных)
      const threshold = window.innerWidth < 768 ? 150 : 100;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < threshold;
      
      // Автоматически прокручиваем вниз только если пользователь уже был внизу
      if (isNearBottom && bottomRef.current) {
        // Небольшая задержка для рендеринга нового контента
        setTimeout(() => {
          bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
      
      lastHistoryLengthRef.current = history.length;
    }
  }, [history.length, character]);

  // Play Damage Sound & Trigger Visual Effect
  useEffect(() => {
    if (!character || !soundsRef.current) return;
    
    if (character.health < prevHealthRef.current) {
      soundsRef.current.damage.play();
      setIsTakingDamage(true);
      setTimeout(() => setIsTakingDamage(false), 500);
    }
    prevHealthRef.current = character.health;
  }, [character?.health]);

  // Play Game Over Sound & Show Finale
  useEffect(() => {
    if (!currentScene || !soundsRef.current) return;

    if (currentScene.is_game_over) {
      musicRef.current?.fade(0.3, 0, 2000); // Fade out music on end
      
      // Delay effect
      setTimeout(() => {
         if (character && character.health <= 0) {
           soundsRef.current?.gameOver.play();
         } else {
           soundsRef.current?.victory.play();
         }
         setShowFinale(true);
      }, 1000);
    }
  }, [currentScene?.is_game_over]);

  // Auto-save logic on Act change or Milestones (every 5 turns)
  useEffect(() => {
    const isMilestone = turnCount > 1 && turnCount % 5 === 0;
    const isActChange = currentAct !== prevActRef.current;

    // Ensure we don't save multiple times for the same turn update
    if ((isMilestone || isActChange) && turnCount !== lastAutoSavedTurnRef.current) {
        onSave();
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
        lastAutoSavedTurnRef.current = turnCount;
    }
    prevActRef.current = currentAct;
  }, [turnCount, currentAct, onSave]);

  const playClickSound = () => {
    soundsRef.current?.click.play();
  };

  const handleSaveClick = () => {
    playClickSound();
    onSave();
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2000);
  };

  if (!character || !currentScene) return null;

  const progressPercent = (turnCount / maxTurns) * 100;

  return (
    <div className="min-h-screen bg-game-dark text-game-paper flex flex-col md:flex-row">
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-4px); }
          40%, 80% { transform: translateX(4px); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slowZoom {
          from { transform: scale(1); }
          to { transform: scale(1.05); }
        }
      `}</style>
      
      {/* Sidebar: Stats & Character */}
      <aside 
        className={`w-full md:w-80 border-r p-6 flex flex-col shrink-0 z-30 shadow-xl h-auto md:h-screen transition-colors duration-200 ${isTakingDamage ? 'bg-red-950/30 border-red-600' : 'bg-stone-900 border-game-iron'}`}
        style={{ animation: isTakingDamage ? 'shake 0.4s cubic-bezier(.36,.07,.19,.97) both' : 'none' }}
      >
        <div className="mb-6 text-center">
          <h2 className={`font-display text-2xl ${isTakingDamage ? 'text-red-500' : 'text-game-gold'}`}>{character.name}</h2>
          <p className="text-stone-400 font-serif">Дім {character.house}</p>
        </div>

        {/* Progress Section */}
        <div className="mb-8 bg-black/30 p-3 rounded border border-stone-700">
           <div className="flex justify-between text-xs font-display text-stone-400 mb-1">
              <span>{currentAct}</span>
              <span>Хід {turnCount}/{maxTurns}</span>
           </div>
           <div className="w-full bg-stone-800 h-1.5 rounded-full overflow-hidden">
              <div className="bg-game-gold h-full" style={{ width: `${progressPercent}%` }}></div>
           </div>
        </div>

        <div className="space-y-6 mb-auto">
          <div className={`p-4 rounded border transition-all duration-200 ${isTakingDamage ? 'bg-red-900/40 border-red-500 scale-105' : 'bg-black/40 border-stone-700'}`}>
            <div className="flex justify-between items-center mb-2">
              <span className="flex items-center gap-2 font-display text-sm"><Heart className={`${isTakingDamage ? 'text-red-400 animate-pulse' : 'text-red-600'}`} size={18}/> Здоров'я</span>
              <span className={`font-bold ${isTakingDamage ? 'text-red-400' : ''}`}>{character.health}%</span>
            </div>
            <div className="w-full bg-stone-800 h-2 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-500 ${isTakingDamage ? 'bg-red-500' : 'bg-red-700'}`}
                style={{ width: `${Math.max(0, character.health)}%` }}
              ></div>
            </div>
          </div>

          <div className="bg-black/40 p-4 rounded border border-stone-700">
            <div className="flex justify-between items-center mb-2">
              <span className="flex items-center gap-2 font-display text-sm"><Crown className="text-yellow-500" size={18}/> Вплив</span>
              <span className="font-bold">{character.influence}%</span>
            </div>
            <div className="w-full bg-stone-800 h-2 rounded-full overflow-hidden">
              <div 
                className="bg-yellow-600 h-full transition-all duration-500" 
                style={{ width: `${Math.max(0, character.influence)}%` }}
              ></div>
            </div>
          </div>
        </div>
        
        <div className="mt-8 space-y-3">
          <div className="grid grid-cols-2 gap-2 mb-2">
            <button 
              onClick={() => setIsMusicMuted(!isMusicMuted)}
              className={`flex items-center justify-center gap-2 py-2 transition-colors border rounded border-stone-700 ${isMusicMuted ? 'text-stone-600 bg-stone-900' : 'text-game-gold bg-stone-800'}`}
              title="Музика"
            >
              {isMusicMuted ? <VolumeX size={18}/> : <Music size={18}/>}
              <span className="text-xs uppercase tracking-widest hidden lg:inline">Музика</span>
            </button>
            
            <button 
              onClick={() => setIsMuted(!isMuted)}
              className={`flex items-center justify-center gap-2 py-2 transition-colors border rounded border-stone-700 ${isMuted ? 'text-stone-600 bg-stone-900' : 'text-stone-300 bg-stone-800'}`}
              title="Звукові ефекти"
            >
              {isMuted ? <VolumeX size={18}/> : <Volume2 size={18}/>}
              <span className="text-xs uppercase tracking-widest hidden lg:inline">SFX</span>
            </button>
          </div>

          {!isDead && (
             <Button 
               onClick={handleSaveClick} 
               variant="outline" 
               fullWidth 
               disabled={saveStatus === 'saved'}
               className="flex items-center justify-center gap-2"
             >
               {saveStatus === 'saved' ? <Check size={18} /> : <Save size={18} />}
               {saveStatus === 'saved' ? "Збережено!" : "Зберегти"}
             </Button>
          )}
          
          <Button onClick={onExit} variant="secondary" fullWidth className="flex items-center justify-center gap-2 text-stone-400 border-stone-700 hover:text-white">
            <LogOut size={18} /> Меню
          </Button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-[calc(100vh-theme(spacing.80))] md:h-screen overflow-hidden relative">
        {/* Background Image Layer */}
        <div className="absolute inset-0 z-0 bg-black">
             {sceneImage ? (
                 <img 
                    src={sceneImage} 
                    alt="Scene" 
                    className="w-full h-full object-cover opacity-40 transition-opacity duration-1000"
                 />
             ) : (
                 <div className="w-full h-full bg-stone-900 opacity-40" />
             )}
             <div className="absolute inset-0 bg-gradient-to-t from-game-dark via-game-dark/90 to-transparent" />
        </div>

        {/* Top Bar Mobile Only */}
        <div className="md:hidden absolute top-0 left-0 right-0 z-40 p-4 flex justify-between items-center bg-gradient-to-b from-black to-transparent">
           <div className="text-game-gold font-display text-sm">{currentAct}</div>
           <div className="text-stone-400 text-xs">Хід {turnCount}/{maxTurns}</div>
        </div>

        {/* Story Content Log */}
        <div 
          ref={scrollRef}
          className="relative z-10 flex-1 overflow-y-auto p-6 md:p-12 scrollbar-hide pb-40 pt-12 md:pt-12"
        >
          <div className="max-w-3xl mx-auto w-full">
             {history.map((entry, index) => (
               <React.Fragment key={index}>
                  {entry.type === 'narrative' && <NarrativeBlock text={entry.text} />}
                  {entry.type === 'dialogue' && entry.speaker && (
                    <DialogueBlock 
                      speaker={entry.speaker} 
                      text={entry.text} 
                      portrait={npcPortraits[entry.speaker]} 
                    />
                  )}
                  {entry.type === 'choice' && <ChoiceBlock text={entry.text} />}
               </React.Fragment>
             ))}
             
             {/* Invisible div to scroll to */}
             <div ref={bottomRef} />
          </div>
        </div>

        {/* Choices - Fixed at bottom */}
        {!isDead && (
          <div className="relative z-20 bg-black/90 border-t border-game-gold/30 backdrop-blur-md p-6 shadow-[0_-10px_40px_rgba(0,0,0,0.8)]">
             <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4">
                 {currentScene.options.map((option) => (
                   <Button 
                      key={option.id} 
                      onClick={() => {
                        playClickSound();
                        onSave();
                        onOptionSelect(option.id, option.text);
                      }}
                      variant={option.text.toLowerCase().includes("атакувати") || option.text.toLowerCase().includes("вбити") ? "danger" : "secondary"}
                      className="text-left h-auto py-4 normal-case hover:translate-y-[-2px] transition-transform"
                   >
                     {option.text}
                   </Button>
                 ))}
             </div>
          </div>
        )}
      </main>
      
      {/* Cinematic Finale Overlay */}
      {showFinale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 animate-[fadeIn_1s_ease-in]">
          <div className="absolute inset-0 overflow-hidden">
             {/* Background FX */}
             <div className={`absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')]`} />
             <div className={`absolute inset-0 bg-gradient-to-b ${character.health > 0 ? 'from-yellow-900/20 via-black to-yellow-900/10' : 'from-red-900/20 via-black to-red-900/10'}`} />
          </div>
          
          <div className="relative z-10 max-w-2xl w-full p-8 text-center">
            {/* Icon & Title */}
            <div className="mb-8 animate-[fadeInUp_0.8s_ease-out_0.2s_both]">
              {character.health > 0 ? (
                <Trophy className="mx-auto text-yellow-500 mb-4 drop-shadow-[0_0_15px_rgba(234,179,8,0.5)]" size={80} />
              ) : (
                <Skull className="mx-auto text-red-600 mb-4 drop-shadow-[0_0_15px_rgba(220,38,38,0.5)]" size={80} />
              )}
              
              <h1 className={`text-5xl md:text-7xl font-display uppercase tracking-widest mb-2 ${character.health > 0 ? 'text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-yellow-700' : 'text-red-600'}`}>
                {character.health > 0 ? "Легенда" : "Valar Morghulis"}
              </h1>
              <h2 className="text-2xl font-serif text-stone-400 uppercase tracking-wide border-b border-white/10 pb-4 inline-block">
                {character.health > 0 ? "Вестеросу" : "Всі люди смертні"}
              </h2>
            </div>

            {/* Reason */}
            <div className="mb-10 animate-[fadeInUp_0.8s_ease-out_0.5s_both]">
              <p className="text-xl md:text-2xl font-serif italic text-stone-200 leading-relaxed drop-shadow-md">
                 "{currentScene.game_over_reason}"
              </p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-4 mb-10 animate-[fadeInUp_0.8s_ease-out_0.8s_both]">
               <div className="bg-white/5 p-4 rounded border border-white/10">
                  <div className="text-stone-400 text-xs uppercase tracking-widest mb-1">Дім</div>
                  <div className={`font-display text-xl ${character.health > 0 ? 'text-game-gold' : 'text-stone-300'}`}>{character.house}</div>
               </div>
               <div className="bg-white/5 p-4 rounded border border-white/10">
                  <div className="text-stone-400 text-xs uppercase tracking-widest mb-1">Вплив</div>
                  <div className="font-display text-xl text-yellow-500">{character.influence}%</div>
               </div>
               <div className="bg-white/5 p-4 rounded border border-white/10">
                  <div className="text-stone-400 text-xs uppercase tracking-widest mb-1">Прожито</div>
                  <div className="font-display text-xl text-stone-300">{turnCount} дн.</div>
               </div>
            </div>

            {/* Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center animate-[fadeInUp_0.8s_ease-out_1.1s_both]">
               <Button onClick={onPlayAgain} variant="primary" className="px-8 py-4 text-lg shadow-[0_0_20px_rgba(197,160,89,0.2)]">
                 Грати знову
               </Button>
               <Button onClick={onExit} variant="secondary" className="px-8 py-4 text-lg">
                 Головне меню
               </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
