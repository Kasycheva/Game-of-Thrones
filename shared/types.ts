export enum House {
  STARK = 'Stark',
  LANNISTER = 'Lannister',
  TARGARYEN = 'Targaryen',
  BARATHEON = 'Baratheon',
  GREYJOY = 'Greyjoy',
  TYRELL = 'Tyrell'
}

export interface Character {
  name: string;
  house: House;
  bio: string;
  health: number;
  influence: number;
}

export interface GameOption {
  id: string;
  text: string;
}

export interface StoryNode {
  narrative: string;
  visual_description: string;
  speaker?: string | null;
  dialogue?: string | null;
  options: GameOption[];
  health_change: number;
  influence_change: number;
  is_game_over: boolean;
  game_over_reason?: string;
}

export enum GameStage {
  MENU,
  CREATION,
  PLAYING,
  GAME_OVER,
  VICTORY
}

export type HistoryType = 'narrative' | 'dialogue' | 'choice';

export interface HistoryEntry {
  type: HistoryType;
  text: string;
  speaker?: string;
}

export interface GameState {
  stage: GameStage;
  character: Character | null;
  history: HistoryEntry[];
  currentScene: StoryNode | null;
  isLoading: boolean;
  sceneImage: string | null;
  turnCount: number;
  maxTurns: number;
  currentAct: string;
  npcPortraits: Record<string, string>;
}

export interface SaveFile {
  character: Character;
  history: HistoryEntry[];
  currentScene: StoryNode;
  turnCount: number;
  lastSaved: number;
}

