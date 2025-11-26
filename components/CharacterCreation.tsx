
import React, { useState } from 'react';
import { Character, House } from '../shared/types';
import { HOUSE_DATA } from '../shared/constants';
import { Button } from './Button';
import { Shield, User, Crown } from 'lucide-react';

interface CharacterCreationProps {
  onComplete: (character: Character) => void;
}

export const CharacterCreation: React.FC<CharacterCreationProps> = ({ onComplete }) => {
  const [name, setName] = useState('');
  const [selectedHouse, setSelectedHouse] = useState<House>(House.STARK);
  const [bio, setBio] = useState('');

  const handleStart = () => {
    if (!name.trim()) return;
    onComplete({
      name,
      house: selectedHouse,
      bio: bio || "Амбітний спадкоємець, який прагне слави.",
      health: 100,
      influence: HOUSE_DATA[selectedHouse].startingInfluence
    });
  };

  return (
    <div className="min-h-screen bg-game-dark text-game-paper p-6 flex items-center justify-center bg-[url('https://images.unsplash.com/photo-1599707367072-cd6ad66acc40?q=80&w=2554&auto=format&fit=crop')] bg-cover bg-center bg-blend-overlay bg-fixed">
      <div className="max-w-4xl w-full bg-black/85 border border-game-iron p-8 rounded-sm shadow-2xl backdrop-blur-sm">
        <h2 className="text-4xl font-display text-game-gold text-center mb-8 border-b border-game-iron pb-4">Створення Персонажа</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Left Column: Inputs */}
          <div className="space-y-6">
            <div>
              <label className="block text-game-gold font-display mb-2 text-lg flex items-center gap-2">
                <User size={20} /> Ім'я Лорда / Леді
              </label>
              <input 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-stone-900 border border-stone-600 p-3 text-white focus:border-game-gold focus:outline-none font-serif"
                placeholder="Еддард..."
              />
            </div>

            <div>
              <label className="block text-game-gold font-display mb-2 text-lg">Коротка біографія (опціонально)</label>
              <textarea 
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full bg-stone-900 border border-stone-600 p-3 text-white focus:border-game-gold focus:outline-none font-serif h-24 resize-none"
                placeholder="Ваша історія..."
              />
            </div>
          </div>

          {/* Right Column: House Selection */}
          <div>
            <label className="block text-game-gold font-display mb-4 text-lg flex items-center gap-2">
              <Shield size={20} /> Оберіть Дім
            </label>
            <div className="grid grid-cols-2 gap-3">
              {Object.values(House).map((house) => (
                <button
                  key={house}
                  onClick={() => setSelectedHouse(house)}
                  className={`p-4 border transition-all duration-300 text-left ${
                    selectedHouse === house 
                      ? 'border-game-gold bg-game-gold/10' 
                      : 'border-stone-700 hover:border-stone-500 bg-stone-900/50'
                  }`}
                >
                  <div className="text-2xl mb-1">{HOUSE_DATA[house].icon}</div>
                  <div className={`font-display font-bold ${selectedHouse === house ? 'text-game-gold' : 'text-stone-400'}`}>
                    {house}
                  </div>
                </button>
              ))}
            </div>
            
            {/* House Details Preview */}
            <div className="mt-6 p-4 bg-stone-900/80 border-l-4 border-game-gold">
              <h3 className={`font-display text-xl ${HOUSE_DATA[selectedHouse].color}`}>
                {HOUSE_DATA[selectedHouse].motto}
              </h3>
              <p className="text-stone-400 text-sm mt-2 font-serif italic mb-3">
                {HOUSE_DATA[selectedHouse].description}
              </p>
              <div className="flex items-center gap-2 text-game-gold text-sm border-t border-white/10 pt-2">
                 <Crown size={16} />
                 <span>Початковий вплив: <strong>{HOUSE_DATA[selectedHouse].startingInfluence}%</strong></span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 flex justify-center">
          <Button onClick={handleStart} disabled={!name.trim()} className="w-full md:w-1/3 text-lg">
            Розпочати Гру
          </Button>
        </div>
      </div>
    </div>
  );
};
