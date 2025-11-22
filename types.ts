
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
  health: number; // 0-100
  influence: number; // 0-100
}

export interface GameOption {
  id: string;
  text: string;
}

export interface StoryNode {
  narrative: string; // The story text (scene description)
  visual_description: string; // Description for image generation
  speaker?: string | null; // Name of the NPC speaking (optional)
  dialogue?: string | null; // The actual spoken text (optional)
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
  history: HistoryEntry[]; // Keep track of structured history
  currentScene: StoryNode | null;
  isLoading: boolean;
  sceneImage: string | null; // Base64 image
  turnCount: number;
  maxTurns: number;
  currentAct: string; // "Act I", "Act II", etc.
  npcPortraits: Record<string, string>; // Cache for NPC avatar images (Name -> Base64)
}

export interface SaveFile {
  character: Character;
  history: HistoryEntry[];
  currentScene: StoryNode;
  turnCount: number;
  lastSaved: number; // Timestamp
}
