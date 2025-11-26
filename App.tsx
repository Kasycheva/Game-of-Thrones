
import React, { useState, useCallback, useEffect } from 'react';
import { Character, GameState, GameStage, HistoryEntry, SaveFile } from './shared/types';
import { MainMenu } from './components/MainMenu';
import { CharacterCreation } from './components/CharacterCreation';
import { GameScreen } from './components/GameScreen';
import { LoadingOverlay } from './components/LoadingOverlay';
import { generateStartNode, generateNextTurn, generateSceneImage, generatePortrait } from './services/geminiService';
import { GAME_CONFIG } from './shared/constants';

const SAVES_KEY = 'got_saves_v2';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>({
    stage: GameStage.MENU,
    character: null,
    history: [],
    currentScene: null,
    isLoading: false,
    sceneImage: null,
    turnCount: 0,
    maxTurns: GAME_CONFIG.MAX_TURNS,
    currentAct: "Пролог",
    npcPortraits: {}
  });

  // Check for missing portraits when scene changes
  useEffect(() => {
    const checkForPortraits = async () => {
      if (!gameState.currentScene?.speaker) return;
      const speakerName = gameState.currentScene.speaker;
      
      // If we don't have a portrait for this speaker yet
      if (!gameState.npcPortraits[speakerName]) {
        // Generate it silently
        try {
          const image = await generatePortrait(speakerName);
          if (image) {
            setGameState(prev => ({
              ...prev,
              npcPortraits: {
                ...prev.npcPortraits,
                [speakerName]: image
              }
            }));
          }
        } catch (e) {
          console.error("Failed to generate portrait background", e);
        }
      }
    };

    if (gameState.stage === GameStage.PLAYING) {
      checkForPortraits();
    }
  }, [gameState.currentScene, gameState.stage, gameState.npcPortraits]);

  const handleStartNew = () => {
    setGameState(prev => ({ ...prev, stage: GameStage.CREATION }));
  };

  const handleCharacterComplete = async (character: Character) => {
    setGameState(prev => ({ 
      ...prev, 
      character, 
      isLoading: true 
    }));

    try {
      const startNode = await generateStartNode(character);
      
      // Create initial history entries
      const initialHistory: HistoryEntry[] = [];
      if (startNode.narrative) initialHistory.push({ type: 'narrative', text: startNode.narrative });
      if (startNode.speaker && startNode.dialogue) initialHistory.push({ type: 'dialogue', text: startNode.dialogue, speaker: startNode.speaker });

      setGameState(prev => ({
        ...prev,
        character,
        stage: GameStage.PLAYING,
        currentScene: startNode,
        history: initialHistory,
        isLoading: false,
        turnCount: 1,
        currentAct: "Акт I",
      }));

      // Auto-save the new game immediately
      saveGameToStorage({
        character,
        history: initialHistory,
        currentScene: startNode,
        turnCount: 1,
        lastSaved: Date.now()
      });

      // Generate Image in background
      if (startNode.visual_description) {
        generateSceneImage(startNode.visual_description).then(img => {
           setGameState(prev => ({ ...prev, sceneImage: img }));
        });
      }

    } catch (error) {
      console.error(error);
      setGameState(prev => ({ ...prev, isLoading: false }));
      alert("Не вдалося розпочати гру. Перевірте API ключ.");
    }
  };

  const handleOptionSelect = useCallback(async (optionId: string, optionText: string) => {
    if (!gameState.character || !gameState.currentScene) return;

    const nextTurnCount = gameState.turnCount + 1;

    setGameState(prev => ({ ...prev, isLoading: true }));

    try {
      // 2. Call API
      const nextNode = await generateNextTurn(
        gameState.history, 
        gameState.character, 
        optionText,
        nextTurnCount,
        gameState.maxTurns
      );

      // 3. Calculate new stats
      const newHealth = Math.max(0, Math.min(100, gameState.character.health + nextNode.health_change));
      const newInfluence = Math.max(0, Math.min(100, gameState.character.influence + nextNode.influence_change));
      
      // Determine Act
      let act = "Акт I";
      if (nextTurnCount > GAME_CONFIG.ACTS.ACT_1_END) act = "Акт II";
      if (nextTurnCount > GAME_CONFIG.ACTS.ACT_2_END) act = "Акт III";

      // 4. Update state
      setGameState(prev => {
        if (!prev.character) return prev;
        
        // Build new history entries
        const newEntries: HistoryEntry[] = [];
        newEntries.push({ type: 'choice', text: optionText });
        if (nextNode.narrative) newEntries.push({ type: 'narrative', text: nextNode.narrative });
        if (nextNode.speaker && nextNode.dialogue) newEntries.push({ type: 'dialogue', text: nextNode.dialogue, speaker: nextNode.speaker });
        
        const newState = {
          ...prev,
          character: {
            ...prev.character,
            health: newHealth,
            influence: newInfluence
          },
          currentScene: nextNode,
          history: [...prev.history, ...newEntries],
          isLoading: false,
          sceneImage: null, // Clear old image
          turnCount: nextTurnCount,
          currentAct: act
        };

        // Auto-save on every turn
        if (newHealth > 0 && !nextNode.is_game_over) {
           saveGameToStorage({
              character: newState.character!,
              history: newState.history,
              currentScene: newState.currentScene!,
              turnCount: newState.turnCount,
              lastSaved: Date.now()
           });
        }

        return newState;
      });

      // 5. Load new image
      if (nextNode.visual_description) {
         generateSceneImage(nextNode.visual_description).then(img => {
            setGameState(prev => ({ ...prev, sceneImage: img }));
         });
      }

    } catch (error) {
       console.error(error);
       setGameState(prev => ({ ...prev, isLoading: false }));
    }
  }, [gameState.character, gameState.history, gameState.currentScene, gameState.turnCount, gameState.maxTurns]);

  const saveGameToStorage = (saveData: SaveFile) => {
    try {
      const existingRaw = localStorage.getItem(SAVES_KEY);
      const saves = existingRaw ? JSON.parse(existingRaw) : {};
      
      // Use character name as key
      saves[saveData.character.name] = saveData;
      
      localStorage.setItem(SAVES_KEY, JSON.stringify(saves));
    } catch (e) {
      console.error("Failed to save", e);
    }
  };

  const handleManualSave = () => {
    const { character, history, currentScene, turnCount } = gameState;
    if (!character || !currentScene) return;

    saveGameToStorage({
      character,
      history,
      currentScene,
      turnCount,
      lastSaved: Date.now()
    });
  };

  const handleLoadGame = (saveData: SaveFile) => {
    let act = "Акт I";
    if (saveData.turnCount > GAME_CONFIG.ACTS.ACT_1_END) act = "Акт II";
    if (saveData.turnCount > GAME_CONFIG.ACTS.ACT_2_END) act = "Акт III";

    setGameState({
      stage: GameStage.PLAYING,
      character: saveData.character,
      history: saveData.history,
      currentScene: saveData.currentScene,
      isLoading: false,
      sceneImage: null,
      turnCount: saveData.turnCount,
      maxTurns: GAME_CONFIG.MAX_TURNS,
      currentAct: act,
      npcPortraits: {} // Reset portraits on load as they aren't saved in localStorage
    });

    // Regenerate image
    if (saveData.currentScene.visual_description) {
       generateSceneImage(saveData.currentScene.visual_description).then(img => {
          setGameState(prev => ({ ...prev, sceneImage: img }));
       });
    }
  };

  const handleExitToMenu = () => {
    setGameState(prev => ({
       ...prev,
       stage: GameStage.MENU,
       character: null,
       currentScene: null,
       npcPortraits: {}
    }));
  };

  const handlePlayAgain = () => {
    setGameState({
      stage: GameStage.CREATION,
      character: null,
      history: [],
      currentScene: null,
      isLoading: false,
      sceneImage: null,
      turnCount: 0,
      maxTurns: GAME_CONFIG.MAX_TURNS,
      currentAct: "Пролог",
      npcPortraits: {}
    });
  };

  return (
    <div className="font-sans antialiased">
      {gameState.isLoading && <LoadingOverlay />}
      
      {gameState.stage === GameStage.MENU && (
        <MainMenu 
          onStartNew={handleStartNew} 
          onLoadGame={handleLoadGame}
        />
      )}

      {gameState.stage === GameStage.CREATION && (
        <CharacterCreation onComplete={handleCharacterComplete} />
      )}

      {gameState.stage === GameStage.PLAYING && (
        <GameScreen 
          gameState={gameState} 
          onOptionSelect={handleOptionSelect} 
          onRestart={handleExitToMenu}
          onSave={handleManualSave}
          onExit={handleExitToMenu}
          onPlayAgain={handlePlayAgain}
        />
      )}
    </div>
  );
};

export default App;
