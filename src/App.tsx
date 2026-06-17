import { useState, useEffect } from 'react';
import RetroCanvas from './components/RetroCanvas';
import ModelConnector from './components/ModelConnector';
import { PlayerCharacterType } from './types';
import { Volume2, VolumeX, Cpu, BookOpen, Layers } from 'lucide-react';
import { audio } from './lib/audio';

// Visual helper for corner decorations consistent with the "Artistic Flair" layout theme
const SharpCorners = () => (
  <>
    <div className="absolute -top-[2px] -left-[2px] w-3 h-3 border-t-2 border-l-2 border-white pointer-events-none z-10" />
    <div className="absolute -top-[2px] -right-[2px] w-3 h-3 border-t-2 border-r-2 border-white pointer-events-none z-10" />
    <div className="absolute -bottom-[2px] -left-[2px] w-3 h-3 border-b-2 border-l-2 border-white pointer-events-none z-10" />
    <div className="absolute -bottom-[2px] -right-[2px] w-3 h-3 border-b-2 border-r-2 border-white pointer-events-none z-10" />
  </>
);

export default function App() {
  // Master state
  const [characterType, setCharacterType] = useState<PlayerCharacterType>('dinosaur');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [showHitboxes, setShowHitboxes] = useState<boolean>(false);
  const [triggerAction, setTriggerAction] = useState<'jump' | 'crouch' | 'none'>('none');
  const [webcamStatus, setWebcamStatus] = useState<boolean>(false);

  // Statistics tracker
  const [stats, setStats] = useState({
    score: 0,
    coins: 0,
    distance: 0,
    highScore: 0
  });

  const handleStatsUpdate = (score: number, coins: number, distance: number) => {
    setStats((prev) => {
      const savedHighScore = Math.max(prev.highScore, score);
      return {
        score,
        coins,
        distance,
        highScore: savedHighScore
      };
    });
  };

  const handleTriggerAction = (action: 'jump' | 'crouch' | 'none') => {
    setTriggerAction(action);
  };

  useEffect(() => {
    // Sync initial high score
    const saved = localStorage.getItem('retro_runner_high_score');
    if (saved) {
      setStats((prev) => ({ ...prev, highScore: parseInt(saved, 10) }));
    }
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans select-none antialiased">
      {/* 8-bit dynamic technical layout grid pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[length:16px_16px] pointer-events-none z-0" />

      {/* Cyberpunk High-Contrast Header */}
      <header className="relative z-10 border-b border-white/10 bg-zinc-900/80 backdrop-blur-sm px-6 py-6 transition-all">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div className="flex flex-col">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-white flex items-center justify-center p-1 shadow-[0_0_15px_rgba(255,255,255,0.1)]">
                <div className="w-4 h-4 bg-zinc-950" />
              </div>
              <h1 className="text-3xl md:text-5xl font-black italic tracking-tighter leading-none text-white font-sans">
                SYNAPSE RUN
              </h1>
            </div>
            <p className="text-[10px] uppercase font-bold text-zinc-500 font-mono tracking-[0.3em] mt-2.5">
              TEACHABLE PLATFORMER ENGINE • NEURAL COMMAND ARCHITECTURE
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
            {/* Audio Toggle */}
            <button
              onClick={() => {
                const updated = !soundEnabled;
                setSoundEnabled(updated);
                audio.setEnabled(updated);
                audio.playJump();
              }}
              className={`relative flex items-center gap-1.5 px-3 py-2 border text-xs font-mono font-bold cursor-pointer transition-all ${
                soundEnabled
                  ? 'bg-zinc-900 border-white text-white hover:bg-zinc-800'
                  : 'bg-zinc-950 border-white/10 text-zinc-600 line-through'
              }`}
            >
              {soundEnabled && <SharpCorners />}
              {soundEnabled ? <Volume2 className="h-3.5 w-3.5 text-green-400" /> : <VolumeX className="h-3.5 w-3.5 text-zinc-600" />}
              SOUND: {soundEnabled ? 'ON' : 'OFF'}
            </button>

            {/* Hitboxes debug toggle */}
            <button
              onClick={() => {
                setShowHitboxes(!showHitboxes);
                audio.playCrouch();
              }}
              className={`relative px-3 py-2 border text-xs font-mono font-bold cursor-pointer transition-all ${
                showHitboxes
                  ? 'bg-zinc-900 border-green-500 text-green-400 shadow-[0_0_10px_rgba(34,197,94,0.15)]'
                  : 'bg-zinc-950 border-white/10 text-zinc-500 hover:border-white/20'
              }`}
            >
              {showHitboxes && <SharpCorners />}
              HITBOXES: {showHitboxes ? 'VISIBLE' : 'HIDDEN'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Game Interface Board Grid */}
      <main className="relative z-10 flex-grow max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT / CENTRAL COLUMN - Arcade (7 Columns) */}
        <section className="lg:col-span-7 flex flex-col gap-5">
          
          {/* Action indicator bar for live gaming instructions */}
          <div className="relative bg-zinc-900/90 border border-white/10 p-4 flex items-center justify-between text-xs text-zinc-300">
            <span className="flex items-center gap-1.5 font-mono">
              <Cpu className="h-4 w-4 text-green-400 animate-pulse" />
              <span className="text-zinc-500 font-bold uppercase tracking-wider text-[10px]">INPUT BUS:</span>
              <span className={`px-2 py-0.5 rounded-sm font-mono font-bold text-[10px] uppercase tracking-wider ${webcamStatus ? 'bg-green-950 text-green-400 border border-green-900' : 'bg-zinc-950 text-zinc-400 border border-white/5'}`}>
                {webcamStatus ? '📹 OPTICAL INPUT ACTIVE' : '⌨️ KEYBOARD MATRIX READY'}
              </span>
            </span>

            <div className="text-[10px] text-zinc-400 font-mono hidden sm:block uppercase tracking-wider text-right">
              {webcamStatus ? 'Hands UP to Jump | Duck Down to Crouch' : 'Press [SPACE to Jump | ARROW DOWN to Crouch]'}
            </div>
          </div>

          {/* MAIN CANVAS GAME VIEWPORT with Artistic Flair outer frame */}
          <div className="relative p-1 bg-zinc-950 border border-white/10 rounded-sm">
            <RetroCanvas
              characterType={characterType}
              triggerAction={triggerAction}
              soundEnabled={soundEnabled}
              onStatsUpdate={handleStatsUpdate}
              showHitboxes={showHitboxes}
            />
          </div>

          {/* CHARACTER SELECT PANEL with minimalist corner brackets */}
          <div className="relative bg-zinc-900/90 border border-white/10 p-5 rounded-sm flex flex-col gap-4">
            <span className="text-[10px] uppercase font-bold text-zinc-400 font-mono tracking-[0.2em] flex items-center gap-1">
              Select Retro Runner Avatar Character Design:
            </span>

            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => {
                  setCharacterType('dinosaur');
                  audio.playJump();
                }}
                className={`relative flex flex-col items-center gap-2 p-3 border cursor-pointer transition-all ${
                  characterType === 'dinosaur'
                    ? 'bg-zinc-900 border-white text-white shadow-[0_0_15px_rgba(255,255,255,0.06)]'
                    : 'bg-zinc-950/40 border-white/10 hover:border-white/20 text-zinc-500'
                }`}
              >
                {characterType === 'dinosaur' && <SharpCorners />}
                <span className="text-2xl mt-1">🦕</span>
                <div className="text-center">
                  <span className="block text-[11px] font-bold uppercase tracking-wide">Pixel Dino</span>
                  <span className="text-[9px] text-zinc-600 font-mono">Original Dino</span>
                </div>
              </button>

              <button
                onClick={() => {
                  setCharacterType('astronaut');
                  audio.playJump();
                }}
                className={`relative flex flex-col items-center gap-2 p-3 border cursor-pointer transition-all ${
                  characterType === 'astronaut'
                    ? 'bg-zinc-900 border-white text-white shadow-[0_0_15px_rgba(255,255,255,0.06)]'
                    : 'bg-zinc-950/40 border-white/10 hover:border-white/20 text-zinc-500'
                }`}
              >
                {characterType === 'astronaut' && <SharpCorners />}
                <span className="text-2xl mt-1">👨‍🚀</span>
                <div className="text-center">
                  <span className="block text-[11px] font-bold uppercase tracking-wide">Astro Explorer</span>
                  <span className="text-[9px] text-zinc-600 font-mono">Visor Core</span>
                </div>
              </button>

              <button
                onClick={() => {
                  setCharacterType('robomonster');
                  audio.playJump();
                }}
                className={`relative flex flex-col items-center gap-2 p-3 border cursor-pointer transition-all ${
                  characterType === 'robomonster'
                    ? 'bg-zinc-900 border-white text-white shadow-[0_0_15px_rgba(255,255,255,0.06)]'
                    : 'bg-zinc-950/40 border-white/10 hover:border-white/20 text-zinc-500'
                }`}
              >
                {characterType === 'robomonster' && <SharpCorners />}
                <span className="text-2xl mt-1">🤖</span>
                <div className="text-center">
                  <span className="block text-[11px] font-bold uppercase tracking-wide">Cyber Mecha</span>
                  <span className="text-[9px] text-zinc-600 font-mono">Roller Tracks</span>
                </div>
              </button>
            </div>
          </div>

          {/* SESSIONS DETAILS GRID */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="relative bg-zinc-900/60 p-4 border border-white/10 flex flex-col font-mono">
              <div className="absolute -top-[1.5px] -left-[1.5px] w-2.5 h-2.5 border-t-2 border-l-2 border-zinc-400 pointer-events-none" />
              <div className="absolute -bottom-[1.5px] -right-[1.5px] w-2.5 h-2.5 border-b-2 border-r-2 border-zinc-400 pointer-events-none" />
              <span className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider">RECORD HIGH</span>
              <span className="text-xl font-black text-amber-500 mt-1.5 tracking-tight">{stats.highScore}</span>
            </div>
            
            <div className="relative bg-zinc-900/60 p-4 border border-white/10 flex flex-col font-mono">
              <div className="absolute -top-[1.5px] -left-[1.5px] w-2.5 h-2.5 border-t-2 border-l-2 border-zinc-400 pointer-events-none" />
              <div className="absolute -bottom-[1.5px] -right-[1.5px] w-2.5 h-2.5 border-b-2 border-r-2 border-zinc-400 pointer-events-none" />
              <span className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider">CURRENT RUN</span>
              <span className="text-xl font-black text-white mt-1.5 tracking-tight">{stats.score}</span>
            </div>

            <div className="relative bg-zinc-900/60 p-4 border border-white/10 flex flex-col font-mono">
              <div className="absolute -top-[1.5px] -left-[1.5px] w-2.5 h-2.5 border-t-2 border-l-2 border-zinc-400 pointer-events-none" />
              <div className="absolute -bottom-[1.5px] -right-[1.5px] w-2.5 h-2.5 border-b-2 border-r-2 border-zinc-400 pointer-events-none" />
              <span className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider">GEMS ACQUIRED</span>
              <span className="text-xl font-black text-emerald-400 mt-1.5 tracking-tight">❖ {stats.coins}</span>
            </div>

            <div className="relative bg-zinc-900/60 p-4 border border-white/10 flex flex-col font-mono">
              <div className="absolute -top-[1.5px] -left-[1.5px] w-2.5 h-2.5 border-t-2 border-l-2 border-zinc-400 pointer-events-none" />
              <div className="absolute -bottom-[1.5px] -right-[1.5px] w-2.5 h-2.5 border-b-2 border-r-2 border-zinc-400 pointer-events-none" />
              <span className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider">TIME ELAPSED</span>
              <span className="text-xl font-black text-zinc-300 mt-1.5 tracking-tight">{(stats.distance * 0.1).toFixed(1)}s</span>
            </div>
          </div>

        </section>

        {/* RIGHT COLUMN - ML Connector & Setup Guide (5 Columns) */}
        <section className="lg:col-span-5 flex flex-col gap-6">
          
          {/* WEBCAM CONNECTOR PANEL */}
          <div className="relative bg-zinc-900/90 border border-white/10 p-1 rounded-sm">
            <ModelConnector
              onTriggerAction={handleTriggerAction}
              onWebcamStatusChange={setWebcamStatus}
            />
          </div>

          {/* BLUEPRINT STEPS TUTORIAL FOR TEACHABLE MACHINE */}
          <div className="relative bg-zinc-900 border border-white/10 rounded-sm p-5 flex flex-col gap-4 text-xs font-mono">
            <div className="absolute -top-[2px] -left-[2px] w-3 h-3 border-t-2 border-l-2 border-white pointer-events-none z-10" />
            <div className="absolute -top-[2px] -right-[2px] w-3 h-3 border-t-2 border-r-2 border-white pointer-events-none z-10" />
            <div className="absolute -bottom-[2px] -left-[2px] w-3 h-3 border-b-2 border-l-2 border-white pointer-events-none z-10" />
            <div className="absolute -bottom-[2px] -right-[2px] w-3 h-3 border-b-2 border-r-2 border-white pointer-events-none z-10" />

            <div className="flex items-center gap-1.5 border-b border-white/10 pb-3">
              <BookOpen className="h-4 w-4 text-zinc-300" />
              <h3 className="uppercase font-semibold tracking-wider text-white text-[11px] font-sans">
                TEACHABLE BLUEPRINT CONFIG
              </h3>
            </div>

            <p className="text-[11px] text-zinc-400 leading-relaxed font-sans">
              Train browser-based gesture classification loops using Teachable Machine in under 2 minutes:
            </p>

            <ol className="space-y-4 mt-2">
              <li className="flex gap-3">
                <span className="flex items-center justify-center h-5.5 w-5.5 bg-zinc-800 font-bold font-mono text-[10px] text-white border border-white/25 rounded-none shrink-0">
                  01
                </span>
                <div className="font-sans">
                  <b className="text-white block text-[11px] uppercase tracking-wide">Initiate Project:</b>
                  <span className="text-[10px] text-zinc-400 leading-normal">
                    Navigate to {' '}
                    <a
                      href="https://teachablemachine.withgoogle.com/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-white underline font-semibold hover:text-zinc-300"
                    >
                      teachablemachine.withgoogle.com
                    </a>{' '}
                    and open an <b>Image/Pose Project</b>.
                  </span>
                </div>
              </li>

              <li className="flex gap-3">
                <span className="flex items-center justify-center h-5.5 w-5.5 bg-zinc-800 font-bold font-mono text-[10px] text-white border border-white/25 rounded-none shrink-0">
                  02
                </span>
                <div className="font-sans">
                  <b className="text-white block text-[11px] uppercase tracking-wide">Define Classes:</b>
                  <span className="text-[10px] text-zinc-400 leading-normal">
                    Define three distinct states:
                    <ul className="list-disc pl-4 mt-1 text-[10px] text-zinc-500 space-y-0.5 font-mono">
                      <li><b>Idle</b>: Resting state in front of camera.</li>
                      <li><b>Jump</b>: Wave hand up high or lift head.</li>
                      <li><b>Crouch</b>: Motion down or lean side.</li>
                    </ul>
                  </span>
                </div>
              </li>

              <li className="flex gap-3">
                <span className="flex items-center justify-center h-5.5 w-5.5 bg-zinc-800 font-bold font-mono text-[10px] text-white border border-white/25 rounded-none shrink-0">
                  03
                </span>
                <div className="font-sans">
                  <b className="text-white block text-[11px] uppercase tracking-wide">Export Weights:</b>
                  <span className="text-[10px] text-zinc-400 leading-normal">
                    Press <b>Train</b>, then <b>Export Model</b>. Upload the shareable link (Tensorflow.js), copy the public cloud URL, and submit into the neural link adapter input box.
                  </span>
                </div>
              </li>
            </ol>
          </div>

        </section>
      </main>

      {/* Retro Footer */}
      <footer className="mt-auto border-t border-white/10 bg-zinc-950 p-6 text-center text-[9px] text-zinc-600 font-mono uppercase tracking-[0.2em]">
        <div>
          SYNAPSE SYSTEM ENGINE PROTO V.1.0 • POWERED BY TENSORFLOW.JS VIA CDN • 2026
        </div>
      </footer>
    </div>
  );
}

