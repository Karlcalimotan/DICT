export interface GameObstacle {
  id: string;
  type: 'cactus_short' | 'cactus_tall' | 'cactus_group' | 'pterodactyl' | 'rock' | 'gem';
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
  passed: boolean;
  pulse?: number; // For floating collectible gems
  frame?: number; // Animation frame
}

export type PlayerCharacterType = 'dinosaur' | 'astronaut' | 'robomonster';

export interface PlayerState {
  y: number;
  vy: number;
  isJumping: boolean;
  isCrouching: boolean;
  runFrame: number;
  animTimer: number;
  characterType: PlayerCharacterType;
  score: number;
  coins: number;
  distance: number;
}

export interface GameSettings {
  difficulty: 'easy' | 'medium' | 'hard';
  speedMultiplier: number;
  soundEnabled: boolean;
  keyboardOnly: boolean;
}

export interface PredictionMap {
  className: string;
  probability: number;
}

export interface TMModelConfig {
  modelUrl: string;
  modelType: 'image' | 'pose';
  status: 'idle' | 'loading' | 'success' | 'failed';
  errorMessage?: string;
  classes: string[];
  jumpClass: string;
  crouchClass: string;
  neutralClass: string;
  jumpThreshold: number; // 0 to 1
  crouchThreshold: number; // 0 to 1
  activePredictionLogs: string[];
}
