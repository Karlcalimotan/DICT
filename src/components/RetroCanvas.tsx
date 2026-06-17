import { useEffect, useRef, useState } from 'react';
import { GameObstacle, PlayerCharacterType, PlayerState, GameSettings } from '../types';
import { audio } from '../lib/audio';

// Dynamic 8-bit canvas controller
interface RetroCanvasProps {
  characterType: PlayerCharacterType;
  triggerAction: 'jump' | 'crouch' | 'none';
  soundEnabled: boolean;
  onStatsUpdate: (score: number, coins: number, distance: number) => void;
  showHitboxes: boolean;
}

export default function RetroCanvas({
  characterType,
  triggerAction,
  soundEnabled,
  onStatsUpdate,
  showHitboxes
}: RetroCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Core Game State
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isGameOver, setIsGameOver] = useState<boolean>(false);
  const [highScore, setHighScore] = useState<number>(0);
  const [currentScore, setCurrentScore] = useState<number>(0);
  const [coinsCount, setCoinsCount] = useState<number>(0);
  const [gameSpeed, setGameSpeed] = useState<number>(5.5);
  const [level, setLevel] = useState<number>(1);

  // References for the loop to access constant up-to-date values without trigger re-renders
  const stateRef = useRef({
    isPlaying: false,
    isGameOver: false,
    speed: 5.5,
    distanceRun: 0,
    score: 0,
    coins: 0,
    obstacles: [] as GameObstacle[],
    particles: [] as any[],
    player: {
      y: 0, // Ground relative (0 is ground)
      vy: 0,
      isJumping: false,
      isCrouching: false,
      runFrame: 0,
      animTimer: 0,
      width: 44,
      height: 44,
    },
    backgroundElements: [] as any[],
    lastObstacleTime: 0,
    lastCoinTime: 0,
    level: 1,
    frameCount: 0,
  });

  // Load high score from local storage on mount
  useEffect(() => {
    const saved = localStorage.getItem('retro_runner_high_score');
    if (saved) {
      setHighScore(parseInt(saved, 10));
    }
  }, []);

  // Set sound global preference
  useEffect(() => {
    audio.setEnabled(soundEnabled);
  }, [soundEnabled]);

  // Handle external trigger actions (from Teachable Machine)
  useEffect(() => {
    if (!stateRef.current.isPlaying || stateRef.current.isGameOver) return;

    if (triggerAction === 'jump') {
      triggerJump();
    } else if (triggerAction === 'crouch') {
      triggerCrouch(true);
    } else if (triggerAction === 'none') {
      triggerCrouch(false);
    }
  }, [triggerAction]);

  // Trigger internal play state bindings
  const startGame = () => {
    // Reset state
    const playerInitY = 0;
    stateRef.current = {
      isPlaying: true,
      isGameOver: false,
      speed: 5.5,
      distanceRun: 0,
      score: 0,
      coins: 0,
      obstacles: [],
      particles: [],
      player: {
        y: playerInitY,
        vy: 0,
        isJumping: false,
        isCrouching: false,
        runFrame: 0,
        animTimer: 0,
        width: 44,
        height: 44,
      },
      backgroundElements: Array.from({ length: 6 }, (_, i) => ({
        x: i * 200 + Math.random() * 50,
        y: 40 + Math.random() * 60,
        width: 30 + Math.random() * 40,
        height: 10 + Math.random() * 15,
        speed: 0.5 + Math.random() * 0.5,
      })),
      lastObstacleTime: 0,
      lastCoinTime: 0,
      level: 1,
      frameCount: 0,
    };

    setIsPlaying(true);
    setIsGameOver(false);
    setCurrentScore(0);
    setCoinsCount(0);
    setLevel(1);
    setGameSpeed(5.5);

    audio.playLevelUp(); // Fun start sound!
  };

  const triggerJump = () => {
    const p = stateRef.current.player;
    if (!p.isJumping && !p.isCrouching) {
      p.vy = 12.5; // Jump strength
      p.isJumping = true;
      audio.playJump();
      // Particle feedback
      createDustCloud(40, 210);
    }
  };

  const triggerCrouch = (active: boolean) => {
    const p = stateRef.current.player;
    if (active) {
      if (!p.isCrouching) {
        p.isCrouching = true;
        p.height = 24; // Visual crunch
        if (p.isJumping) {
          p.vy = -6; // Fast drop if crouching mid-air
        } else {
          audio.playCrouch();
        }
      }
    } else {
      p.isCrouching = false;
      p.height = 44; // Back to normal height
    }
  };

  const createDustCloud = (x: number, y: number) => {
    for (let i = 0; i < 4; i++) {
      stateRef.current.particles.push({
        x: x + Math.random() * 10 - 5,
        y: y + Math.random() * 6 - 3,
        vx: -2 - Math.random() * 2,
        vy: -0.5 - Math.random() * 1,
        radius: 3 + Math.random() * 4,
        color: 'rgba(120, 120, 120, 0.4)',
        life: 1.0,
        decay: 0.05 + Math.random() * 0.05
      });
    }
  };

  const createSparkles = (x: number, y: number, color: string = '#f59e0b') => {
    for (let i = 0; i < 10; i++) {
      stateRef.current.particles.push({
        x: x,
        y: y,
        vx: (Math.random() - 0.5) * 6,
        vy: (Math.random() - 0.5) * 6 - 2,
        size: 2 + Math.random() * 3,
        color: color,
        life: 1.0,
        decay: 0.04 + Math.random() * 0.04,
        gravity: 0.1
      });
    }
  };

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        if (!stateRef.current.isPlaying) {
          startGame();
        } else {
          triggerJump();
        }
      }
      if (e.code === 'ArrowDown') {
        e.preventDefault();
        triggerCrouch(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'ArrowDown') {
        triggerCrouch(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Vector Drawings inside canvas context (Pixelated Sprites)
  const drawDinosaur = (ctx: CanvasRenderingContext2D, x: number, y: number, isCrouching: boolean, frame: number) => {
    ctx.fillStyle = '#34d399'; // Mint Green Dino
    const scale = 2; // draw bigger blocks to look 8-bit

    if (isCrouching) {
      // Couching dino
      ctx.fillRect(x, y + 20, 40, 20); // main body
      ctx.fillRect(x + 28, y + 16, 16, 12); // snout forward
      ctx.fillStyle = '#10b981'; // accent shadow
      ctx.fillRect(x + 10, y + 24, 20, 16);
      ctx.fillStyle = '#000000'; // Eye
      ctx.fillRect(x + 36, y + 18, 4, 4);

      // Running legs (small crouching flip)
      ctx.fillStyle = '#065f46';
      if (frame === 0) {
        ctx.fillRect(x + 8, y + 38, 6, 6);
        ctx.fillRect(x + 24, y + 38, 6, 6);
      } else {
        ctx.fillRect(x + 14, y + 38, 6, 6);
        ctx.fillRect(x + 30, y + 38, 6, 6);
      }
    } else {
      // Stand/Run dino
      // Tail
      ctx.fillRect(x, y + 12, 8, 14);
      ctx.fillRect(x + 4, y + 16, 10, 16);
      // Body
      ctx.fillRect(x + 10, y + 14, 20, 20);
      // Neck & Head
      ctx.fillRect(x + 24, y + 2, 16, 16);
      ctx.fillRect(x + 26, y - 4, 18, 10); // Snout
      // Eye
      ctx.fillStyle = '#000000';
      ctx.fillRect(x + 38, y + 0, 4, 4);

      // Cheek
      ctx.fillStyle = '#fca5a5';
      ctx.fillRect(x + 32, y + 6, 4, 4);

      // Cute tiny arm
      ctx.fillStyle = '#10b981';
      ctx.fillRect(x + 26, y + 18, 8, 4);

      // Moving legs
      ctx.fillStyle = '#065f46';
      if (stateRef.current.player.y > 0) {
        // Jumping legs position
        ctx.fillRect(x + 12, y + 32, 6, 8);
        ctx.fillRect(x + 22, y + 30, 6, 8);
      } else if (frame === 0) {
        ctx.fillRect(x + 10, y + 34, 6, 10);
        ctx.fillRect(x + 24, y + 34, 6, 6);
      } else {
        ctx.fillRect(x + 10, y + 34, 6, 6);
        ctx.fillRect(x + 24, y + 34, 6, 10);
      }
    }
  };

  const drawAstronaut = (ctx: CanvasRenderingContext2D, x: number, y: number, isCrouching: boolean, frame: number) => {
    ctx.fillStyle = '#f3f4f6'; // Bright White suit
    if (isCrouching) {
      // Helmet lower
      ctx.fillRect(x + 12, y + 16, 26, 20);
      ctx.fillStyle = '#3b82f6'; // Blue glowing visor
      ctx.fillRect(x + 26, y + 20, 12, 10);
      // Backpack
      ctx.fillStyle = '#ef4444'; // Red oxygen pack
      ctx.fillRect(x + 2, y + 14, 10, 20);
      // Legs
      ctx.fillStyle = '#9ca3af';
      if (frame === 0) {
        ctx.fillRect(x + 16, y + 34, 6, 6);
        ctx.fillRect(x + 28, y + 34, 6, 6);
      } else {
        ctx.fillRect(x + 20, y + 34, 6, 6);
        ctx.fillRect(x + 32, y + 34, 6, 6);
      }
    } else {
      // Suit Body
      ctx.fillRect(x + 8, y + 12, 24, 22);
      // Oxygen tank
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(x + 0, y + 10, 8, 22);
      // Head Helmet
      ctx.fillStyle = '#f3f4f6';
      ctx.fillRect(x + 10, y - 2, 22, 18);
      // Visor
      ctx.fillStyle = '#3b82f6';
      ctx.fillRect(x + 20, y + 2, 12, 10);
      // Visor shine
      ctx.fillStyle = '#93c5fd';
      ctx.fillRect(x + 26, y + 2, 4, 4);

      // Chest badge
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(x + 14, y + 18, 4, 4);

      // Legs
      ctx.fillStyle = '#4b5563';
      if (stateRef.current.player.y > 0) {
        ctx.fillRect(x + 12, y + 34, 6, 6);
        ctx.fillRect(x + 22, y + 34, 6, 6);
      } else if (frame === 0) {
        ctx.fillRect(x + 10, y + 34, 8, 10);
        ctx.fillRect(x + 22, y + 34, 8, 6);
      } else {
        ctx.fillRect(x + 10, y + 34, 8, 6);
        ctx.fillRect(x + 22, y + 34, 8, 10);
      }
    }
  };

  const drawRoboMonster = (ctx: CanvasRenderingContext2D, x: number, y: number, isCrouching: boolean, frame: number) => {
    ctx.fillStyle = '#a855f7'; // Purple Cyborg
    if (isCrouching) {
      ctx.fillRect(x + 4, y + 14, 34, 24);
      // Scanner laser eye
      ctx.fillStyle = '#f43f5e';
      ctx.fillRect(x + 26, y + 20, 12, 6);
      // Steel plates
      ctx.fillStyle = '#d8b4fe';
      ctx.fillRect(x + 10, y + 18, 8, 14);

      ctx.fillStyle = '#c084fc';
      if (frame === 0) {
        ctx.fillRect(x + 10, y + 36, 8, 4);
        ctx.fillRect(x + 24, y + 36, 8, 4);
      } else {
        ctx.fillRect(x + 14, y + 36, 8, 4);
        ctx.fillRect(x + 28, y + 36, 8, 4);
      }
    } else {
      // Main blocky cyber body
      ctx.fillRect(x + 6, y + 8, 28, 26);
      // Robotic neck and head
      ctx.fillRect(x + 12, y - 6, 20, 16);
      // Glowing red wide visor eye
      ctx.fillStyle = '#f43f5e';
      ctx.fillRect(x + 20, y - 2, 12, 6);
      // Brass bolts
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(x + 10, y + 12, 4, 4);
      ctx.fillRect(x + 10, y + 24, 4, 4);
      // Cybernetic core pulsating in center
      const coreColor = Math.floor(Date.now() / 150) % 2 === 0 ? '#10b981' : '#059669';
      ctx.fillStyle = coreColor;
      ctx.fillRect(x + 20, y + 16, 8, 8);

      // Metal wheel/feet tracks
      ctx.fillStyle = '#581c87';
      if (stateRef.current.player.y > 0) {
        ctx.fillRect(x + 8, y + 34, 24, 8);
      } else if (frame === 0) {
        ctx.fillRect(x + 6, y + 34, 10, 8);
        ctx.fillRect(x + 22, y + 34, 12, 8);
      } else {
        ctx.fillRect(x + 6, y + 34, 12, 8);
        ctx.fillRect(x + 24, y + 34, 10, 8);
      }
    }
  };

  // Main Canvas Rendering Loop
  useEffect(() => {
    let animationId: number;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const gameLoop = () => {
      const state = stateRef.current;

      // 1. Clear Canvas (Minimalist black layout)
      ctx.fillStyle = '#09090b';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 2. Cybernetic Vector Grid Parallax
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.lineWidth = 1;
      const gridSpacing = 32;
      const xOffset = -(state.distanceRun * state.speed * 0.25) % gridSpacing;
      for (let x = xOffset; x < canvas.width; x += gridSpacing) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 220);
        ctx.stroke();
      }
      for (let y = 0; y < 220; y += gridSpacing) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // 3. Far Parallax Vector Slates (Minimalist architectural outline blocks)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.015)';
      state.backgroundElements.forEach((el) => {
        if (state.isPlaying && !state.isGameOver) {
          el.x -= el.speed * 0.4;
          if (el.x + el.width < 0) {
            el.x = canvas.width + Math.random() * 80;
            el.y = 80 + Math.random() * 60;
          }
        }
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
        ctx.lineWidth = 1;
        ctx.strokeRect(el.x, el.y, el.width, el.height);
        ctx.fillRect(el.x, el.y, el.width, el.height);
      });

      // 4. Distant Vector crosshairs Moon alignment matrix
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(690, 60, 24, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.beginPath();
      ctx.moveTo(690, 30); ctx.lineTo(690, 90);
      ctx.moveTo(660, 60); ctx.lineTo(720, 60);
      ctx.stroke();

      // 5. Draw Ground horizon line
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 220, canvas.width, 2);
      ctx.fillStyle = '#09090b';
      ctx.fillRect(0, 222, canvas.width, canvas.height - 222);

      // Scenery ground ticks representing floor velocity feedback
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      for (let i = 0; i < canvas.width; i += 40) {
        const px = (i - state.distanceRun * state.speed) % canvas.width;
        const rawOffset = px < 0 ? px + canvas.width : px;
        ctx.fillRect(rawOffset, 224, 6, 2);
        ctx.fillRect(rawOffset + 20, 232, 2, 2);
      }

      // 6. Spawn Obstacles and Coins
      if (state.isPlaying && !state.isGameOver) {
        state.frameCount++;
        state.distanceRun += state.speed * 0.1;

        // Score increments with distance run
        state.score = Math.floor(state.distanceRun);

        // Notify parents on stats change occasionally to prevent excessive React state sets
        if (state.frameCount % 10 === 0) {
          onStatsUpdate(state.score, state.coins, Math.floor(state.distanceRun));
        }

        // Increase Speed with level difficulty curve
        const newLvl = Math.floor(state.score / 500) + 1;
        if (newLvl > state.level) {
          state.level = newLvl;
          state.speed += 0.6; // Speed boost
          setLevel(newLvl);
          setGameSpeed(parseFloat(state.speed.toFixed(1)));
          audio.playLevelUp();
        }

        // Spawn logic: Spawn obstacle if space is clear and cooldown is met
        const currentTime = Date.now();
        const minSpawnInterval = Math.max(1200, 2500 - state.speed * 180);

        if (currentTime - state.lastObstacleTime > minSpawnInterval && Math.random() < 0.015) {
          const types: GameObstacle['type'][] = ['cactus_short', 'cactus_tall', 'cactus_group', 'pterodactyl', 'rock'];
          const chosenType = types[Math.floor(Math.random() * types.length)];
          let ow = 26;
          let oh = 34;
          let oy = 220 - oh; // default ground level

          if (chosenType === 'cactus_tall') {
            ow = 24;
            oh = 48;
            oy = 220 - oh;
          } else if (chosenType === 'cactus_group') {
            ow = 48;
            oh = 36;
            oy = 220 - oh;
          } else if (chosenType === 'rock') {
            ow = 30;
            oh = 18;
            oy = 220 - oh;
          } else if (chosenType === 'pterodactyl') {
            ow = 34;
            oh = 24;
            const flightLayers = [0, 1, 2];
            const flight = flightLayers[Math.floor(Math.random() * flightLayers.length)];
            if (flight === 0) {
              oy = 135;
            } else if (flight === 1) {
              oy = 170;
            } else {
              oy = 210 - oh;
            }
          }

          state.obstacles.push({
            id: Math.random().toString(),
            type: chosenType,
            x: canvas.width,
            y: oy,
            width: ow,
            height: oh,
            speed: state.speed,
            passed: false,
            frame: 0
          });
          state.lastObstacleTime = currentTime;
        }

        // Spawn float collectible Gold Gems!
        if (currentTime - state.lastCoinTime > 1500 && Math.random() < 0.02) {
          const coinY = 120 + Math.random() * 60;
          state.obstacles.push({
            id: Math.random().toString(),
            type: 'gem',
            x: canvas.width,
            y: coinY,
            width: 18,
            height: 18,
            speed: state.speed,
            passed: false,
            pulse: 0,
            frame: 0
          });
          state.lastCoinTime = currentTime;
        }
      }

      // 7. Update Obstacles and detect Collisions
      const playerX = 40;
      const playerY = 220 - state.player.y - state.player.height;

      state.obstacles = state.obstacles.filter((obs) => {
        if (state.isPlaying && !state.isGameOver) {
          obs.x -= obs.speed;
        }

        // Vector Drawings (Hollow outlines with high contrast colors)
        if (obs.type === 'cactus_short') {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(obs.x, obs.y, obs.width, obs.height);
          ctx.fillStyle = 'rgba(255,255,255,0.05)';
          ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
          ctx.fillStyle = '#22c55e';
          ctx.fillRect(obs.x + obs.width / 2 - 2, obs.y + 4, 4, 4);
        } else if (obs.type === 'cactus_tall') {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(obs.x, obs.y, obs.width, obs.height);
          ctx.fillStyle = 'rgba(255,255,255,0.05)';
          ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
          ctx.fillStyle = '#22c55e';
          ctx.fillRect(obs.x + obs.width / 2 - 2, obs.y + 10, 4, 4);
        } else if (obs.type === 'cactus_group') {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(obs.x, obs.y, obs.width, obs.height);
          ctx.fillStyle = 'rgba(255,255,255,0.05)';
          ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
          ctx.beginPath();
          ctx.moveTo(obs.x + 12, obs.y);
          ctx.lineTo(obs.x + 12, obs.y + obs.height);
          ctx.moveTo(obs.x + 24, obs.y);
          ctx.lineTo(obs.x + 24, obs.y + obs.height);
          ctx.stroke();
        } else if (obs.type === 'rock') {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(obs.x, obs.y + obs.height);
          ctx.lineTo(obs.x + obs.width / 2, obs.y);
          ctx.lineTo(obs.x + obs.width, obs.y + obs.height);
          ctx.closePath();
          ctx.stroke();
          ctx.fillStyle = 'rgba(255,255,255,0.05)';
          ctx.fill();
        } else if (obs.type === 'pterodactyl') {
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 1.5;
          const wingFlap = Math.floor(state.frameCount / 8) % 2;
          ctx.strokeRect(obs.x, obs.y, obs.width, obs.height);
          ctx.fillStyle = 'rgba(239, 68, 68, 0.05)';
          ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
          ctx.beginPath();
          ctx.moveTo(obs.x, obs.y + obs.height / 2);
          ctx.lineTo(obs.x + obs.width / 2, wingFlap === 0 ? obs.y : obs.y + obs.height);
          ctx.lineTo(obs.x + obs.width, obs.y + obs.height / 2);
          ctx.stroke();
        } else if (obs.type === 'gem') {
          obs.pulse = (obs.pulse || 0) + 0.15;
          const floatOffset = Math.sin(obs.pulse) * 4;
          obs.y = obs.y + floatOffset * 0.15;

          ctx.fillStyle = '#4ade80';
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          const cx = obs.x + obs.width / 2;
          const cy = obs.y + obs.height / 2;
          ctx.beginPath();
          ctx.moveTo(cx, cy - 8);
          ctx.lineTo(cx + 8, cy);
          ctx.lineTo(cx, cy + 8);
          ctx.lineTo(cx - 8, cy);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }

        // Show Hitbox markers for debugging and professional polish
        if (showHitboxes) {
          ctx.strokeStyle = obs.type === 'gem' ? '#4ade80' : '#ef4444';
          ctx.lineWidth = 1;
          ctx.strokeRect(obs.x, obs.y, obs.width, obs.height);
        }

        // COLLISION LOGIC (AABB with safe margins)
        if (state.isPlaying && !state.isGameOver) {
          const hitboxPadding = 5;
          const boxPlayerX1 = playerX + hitboxPadding;
          const boxPlayerX2 = playerX + state.player.width - hitboxPadding;
          const boxPlayerY1 = playerY + hitboxPadding;
          const boxPlayerY2 = playerY + state.player.height - hitboxPadding;

          const boxObsX1 = obs.x + (obs.type === 'gem' ? 1 : 3);
          const boxObsX2 = obs.x + obs.width - (obs.type === 'gem' ? 1 : 3);
          const boxObsY1 = obs.y + (obs.type === 'gem' ? 1 : 3);
          const boxObsY2 = obs.y + obs.height - (obs.type === 'gem' ? 1 : 3);

          const intersects =
            boxPlayerX1 < boxObsX2 &&
            boxPlayerX2 > boxObsX1 &&
            boxPlayerY1 < boxObsY2 &&
            boxPlayerY2 > boxObsY1;

          if (intersects) {
            if (obs.type === 'gem') {
              state.coins++;
              setCoinsCount(state.coins);
              audio.playCoin();
              createSparkles(obs.x + obs.width / 2, obs.y + obs.height / 2, '#4ade80');
              return false;
            } else {
              state.isGameOver = true;
              setIsGameOver(true);
              audio.playGameOver();

              createSparkles(playerX + 20, playerY + 20, '#ef4444');
              createSparkles(playerX + 20, playerY + 20, '#ffffff');

              if (state.score > highScore) {
                setHighScore(state.score);
                localStorage.setItem('retro_runner_high_score', state.score.toString());
              }
            }
          }
        }

        return obs.x + obs.width > -10;
      });

      // 8. Update Physics of Player
      if (state.isPlaying && !state.isGameOver) {
        state.player.y += state.player.vy;
        state.player.vy -= 0.6;

        if (state.player.y <= 0) {
          state.player.y = 0;
          state.player.vy = 0;
          state.player.isJumping = false;
        }

        state.player.animTimer += state.speed;
        if (state.player.animTimer > 100) {
          state.player.runFrame = state.player.runFrame === 0 ? 1 : 0;
          state.player.animTimer = 0;

          if (state.player.y === 0 && !state.player.isCrouching) {
            state.particles.push({
              x: playerX + 6,
              y: 215,
              vx: -1.5,
              vy: -0.2,
              radius: 1 + Math.random() * 2,
              color: 'rgba(255, 255, 255, 0.15)',
              life: 0.8,
              decay: 0.08
            });
          }
        }
      }

      // 9. Update & Draw Particles
      state.particles = state.particles.filter((p) => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.gravity) p.vy += p.gravity;
        p.life -= p.decay || 0.03;

        ctx.fillStyle = p.color;
        if (p.radius) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius * Math.max(0, p.life), 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(p.x, p.y, p.size * Math.max(0, p.life), p.size * Math.max(0, p.life));
        }

        return p.life > 0;
      });

      // 10. Draw Player Character
      const runningOffsetFrame = state.player.runFrame;
      const drawX = playerX;
      const drawY = 220 - state.player.y - state.player.height;

      if (characterType === 'dinosaur') {
        drawDinosaur(ctx, drawX, drawY, state.player.isCrouching, runningOffsetFrame);
      } else if (characterType === 'astronaut') {
        drawAstronaut(ctx, drawX, drawY, state.player.isCrouching, runningOffsetFrame);
      } else if (characterType === 'robomonster') {
        drawRoboMonster(ctx, drawX, drawY, state.player.isCrouching, runningOffsetFrame);
      }

      if (showHitboxes) {
        ctx.strokeStyle = '#4ade80';
        ctx.strokeRect(drawX, drawY, state.player.width, state.player.height);
      }

      // 11. Custom Hud Title Card Screens (Tactical Monospace Terminal theme with brackets)
      if (!state.isPlaying) {
        ctx.fillStyle = 'rgba(9, 9, 11, 0.95)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Terminal text start
        ctx.fillStyle = '#ffffff';
        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('SYNAPSE RUN V.1.0 • COGNITIVE VECTOR ENGINE', canvas.width / 2, 80);

        ctx.fillStyle = '#4ade80';
        ctx.font = 'bold 22px font-sans, system-ui';
        ctx.fillText('TEACHABLE PLATFORMER', canvas.width / 2, 115);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.font = '9px "JetBrains Mono", monospace';
        ctx.fillText('[ GESTURE MATRIX SYNAPSE CONNECTOR ONLINE ]', canvas.width / 2, 140);

        ctx.fillStyle = '#ffffff';
        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.fillText('PRESS [SPACEBAR / TAP VIEWPORT] TO ENERGIZE SYSTEM', canvas.width / 2, 195);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.fillText(`LOCAL SCORE VECTOR RECORD: ${highScore}`, canvas.width / 2, 230);

      } else if (state.isGameOver) {
        ctx.fillStyle = 'rgba(9, 9, 11, 0.9)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 24px font-sans, system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('FAULT DETECTED', canvas.width / 2, 100);

        ctx.fillStyle = '#ffffff';
        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.fillText('CRASH COEFFICIENT EXCEEDED DESIGN CONSTANTS', canvas.width / 2, 125);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.font = '11px "JetBrains Mono", monospace';
        ctx.fillText(`FINAL RUN VALUE: ${state.score}  |  GEMS SECURED: ${state.coins}`, canvas.width / 2, 165);

        ctx.fillStyle = '#4ade80';
        ctx.fillText('CLICK CANCELS OR TAP VIEWPORT TO AUTO-REBOOT', canvas.width / 2, 215);

        if (state.score >= highScore && state.score > 0) {
          ctx.fillStyle = '#f59e0b';
          ctx.font = '9px "JetBrains Mono", monospace';
          ctx.fillText('❖ COGNITIVE VECTOR LOCAL HI-SCORE UPDATED ❖', canvas.width / 2, 245);
        }
      }

      // Always draw standard score details if playing
      if (state.isPlaying && !state.isGameOver) {
        // Draw elegant metadata banners rather than 8bit labels
        ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.fillRect(15, 15, 420, 24);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.strokeRect(15, 15, 420, 24);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`RUN: ${String(state.score).padStart(5, '0')}`, 28, 31);
        
        ctx.fillStyle = '#4ade80';
        ctx.fillText(`❖ GEMS: ${String(state.coins).padStart(2, '0')}`, 145, 31);
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.fillText(`SPEED: ${gameSpeed}x`, 265, 31);
        ctx.fillText(`LVL: ${state.level}`, 365, 31);

        // High score indicator standard
        ctx.textAlign = 'right';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fillText(`REC ${String(highScore).padStart(5, '0')}`, canvas.width - 20, 31);

        // Action debug target visualization UI on canvas
        ctx.textAlign = 'left';
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(15, 50, 220, 20);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.strokeRect(15, 50, 220, 20);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.font = '8px "JetBrains Mono", monospace';
        ctx.fillText('SYSTEM STATUS:', 24, 62);

        if (state.player.isJumping) {
          ctx.fillStyle = '#60a5fa';
          ctx.fillText('JUMPING Active', 125, 62);
        } else if (state.player.isCrouching) {
          ctx.fillStyle = '#ef4444';
          ctx.fillText('CROUCHING Active', 125, 62);
        } else {
          ctx.fillStyle = '#4ade80';
          ctx.fillText('RUNNING Nominal', 125, 62);
        }
      }

      animationId = requestAnimationFrame(gameLoop);
    };

    animationId = requestAnimationFrame(gameLoop);

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [isPlaying, isGameOver, characterType, showHitboxes, highScore]);

  // Corner helper to draw decorative borders in "Artistic Flair" style
  const SharpCorners = () => (
    <>
      <div className="absolute -top-[1.5px] -left-[1.5px] w-3 h-3 border-t-2 border-l-2 border-white pointer-events-none z-10" />
      <div className="absolute -top-[1.5px] -right-[1.5px] w-3 h-3 border-t-2 border-r-2 border-white pointer-events-none z-10" />
      <div className="absolute -bottom-[1.5px] -left-[1.5px] w-3 h-3 border-b-2 border-l-2 border-white pointer-events-none z-10" />
      <div className="absolute -bottom-[1.5px] -right-[1.5px] w-3 h-3 border-b-2 border-r-2 border-white pointer-events-none z-10" />
    </>
  );

  return (
    <div ref={containerRef} className="relative w-full overflow-hidden select-none" id="arcade-container bg-zinc-950 border border-white/10 rounded-sm p-1">
      {/* 8-bit Crisp Container viewport */}
      <div className="relative aspect-[800/300] w-full bg-black overflow-hidden border border-white/25">
        <SharpCorners />
        <canvas
          ref={canvasRef}
          width={800}
          height={300}
          onClick={() => {
            if (!stateRef.current.isPlaying || stateRef.current.isGameOver) {
              startGame();
            } else {
              triggerJump();
            }
          }}
          className="block w-full h-full cursor-pointer bg-black"
          style={{ imageRendering: 'pixelated' }}
        />
      </div>

      {/* Retro Arcade Cabin Buttons Panel */}
      <div className="flex flex-col sm:flex-row justify-between items-center bg-zinc-900 px-4 py-3 border-t border-white/10 text-xs text-zinc-300 font-mono gap-3">
        <div className="flex gap-3 items-center">
          <span className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-green-400">
            <span className="relative flex h-2.5 w-2.5">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75 ${!isPlaying ? 'pause' : ''}`}></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
            </span>
            SYSTEM: {isPlaying ? (isGameOver ? 'FAULTED' : 'OPERATIONAL') : 'STANDBY'}
          </span>
          <span className="text-zinc-700">|</span>
          <span className="text-zinc-400 text-[10px] uppercase">VELOCITY: <b className="text-green-300">{gameSpeed} Px/F</b></span>
        </div>

        {/* Action interactive buttons for screen touches / quick clicking */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (!isPlaying) startGame();
              else triggerJump();
            }}
            className="px-4 py-2 bg-white hover:bg-zinc-200 active:translate-y-0.5 text-zinc-950 text-[10px] font-bold uppercase cursor-pointer select-none border border-white transition-all font-sans"
          >
            A (JUMP)
          </button>
          <button
            onMouseDown={() => {
              if (isPlaying) triggerCrouch(true);
            }}
            onMouseUp={() => {
              if (isPlaying) triggerCrouch(false);
            }}
            onTouchStart={() => {
              if (isPlaying) triggerCrouch(true);
            }}
            onTouchEnd={() => {
              if (isPlaying) triggerCrouch(false);
            }}
            className="px-4 py-2 bg-transparent hover:bg-white/5 active:translate-y-0.5 text-white text-[10px] font-bold uppercase cursor-pointer select-none border border-white/20 transition-all font-sans"
          >
            B (CROUCH)
          </button>
          <button
            onClick={() => {
              if (isPlaying) {
                stateRef.current.isGameOver = true;
                setIsGameOver(true);
                audio.playGameOver();
              } else {
                startGame();
              }
            }}
            className="px-3 py-2 bg-zinc-950 hover:bg-zinc-900 text-zinc-500 hover:text-zinc-300 text-[9px] font-semibold uppercase tracking-wider cursor-pointer border border-white/5 transition-all"
          >
            REBOOT
          </button>
        </div>
      </div>
    </div>
  );
}
