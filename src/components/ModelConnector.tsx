import { useEffect, useRef, useState } from 'react';
import { TMModelConfig, PredictionMap } from '../types';
import { Play, Pause, Camera, WifiOff, RefreshCw, Layers, ShieldAlert, CheckCircle, HelpCircle } from 'lucide-react';

interface ModelConnectorProps {
  onTriggerAction: (action: 'jump' | 'crouch' | 'none') => void;
  onWebcamStatusChange: (active: boolean) => void;
}

export default function ModelConnector({
  onTriggerAction,
  onWebcamStatusChange
}: ModelConnectorProps) {
  // Config state
  const [modelConfig, setModelConfig] = useState<TMModelConfig>({
    modelUrl: '',
    modelType: 'image',
    status: 'idle',
    classes: [],
    jumpClass: 'Jump',
    crouchClass: 'Crouch',
    neutralClass: 'Idle',
    jumpThreshold: 0.82,
    crouchThreshold: 0.82,
    activePredictionLogs: []
  });

  const [inputUrl, setInputUrl] = useState<string>('');
  const [webcamEnabled, setWebcamEnabled] = useState<boolean>(false);
  const [cameraLoading, setCameraLoading] = useState<boolean>(false);
  const [predictions, setPredictions] = useState<PredictionMap[]>([]);
  const [detectedAction, setDetectedAction] = useState<'jump' | 'crouch' | 'none'>('none');
  const [isCdnLoaded, setIsCdnLoaded] = useState<boolean>(false);
  const [cdnStatus, setCdnStatus] = useState<string>('Unloaded');

  // Fallback Motion Detector Mode (Lets them play instantly with webcam without needing a model!)
  const [useMotionFallback, setUseMotionFallback] = useState<boolean>(true);
  const [motionMetrics, setMotionMetrics] = useState<{ jumpAmt: number; crouchAmt: number }>({ jumpAmt: 0, crouchAmt: 0 });

  const videoRef = useRef<HTMLVideoElement>(null);
  const webcamStreamRef = useRef<MediaStream | null>(null);
  const requestRef = useRef<number | null>(null);
  const previousFrameRef = useRef<ImageData | null>(null);

  // References to keep prediction loop access synchronous during RAF
  const activeConfigRef = useRef(modelConfig);
  useEffect(() => {
    activeConfigRef.current = modelConfig;
  }, [modelConfig]);

  const useMotionFallbackRef = useRef(useMotionFallback);
  useEffect(() => {
    useMotionFallbackRef.current = useMotionFallback;
  }, [useMotionFallback]);

  // Load TensorFlow & Teachable Machine scripts from JSDelivr CDNs
  useEffect(() => {
    let active = true;
    setCdnStatus('Connecting to CDN...');

    const loadScript = (src: string): Promise<void> => {
      return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Failed to load script ${src}`));
        document.head.appendChild(script);
      });
    };

    const loadAllLibraries = async () => {
      try {
        // Step 1: Load TensorFlow core
        if (!(window as any).tf) {
          await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js');
        }
        if (!active) return;
        setCdnStatus('TensorFlow.js Ready. Loading Teachable Machine...');

        // Step 2: Load tm-image
        if (!(window as any).tmImage) {
          await loadScript('https://cdn.jsdelivr.net/npm/@teachablemachine/image@0.8.5/dist/teachablemachine-image.min.js');
        }

        if (active) {
          setIsCdnLoaded(true);
          setCdnStatus('AI Engines Loaded!');
          addLog('System', 'TensorFlow & Teachable Machine engines loaded successfully.');
        }
      } catch (err: any) {
        if (active) {
          setCdnStatus('Failed to load libraries. Offline fallback active.');
          addLog('Error', 'Could not fetch machine learning CDNs. Dynamic camera motion detection fallback is ready!');
          console.error(err);
        }
      }
    };

    loadAllLibraries();

    return () => {
      active = false;
    };
  }, []);

  const addLog = (tag: string, text: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logStr = `[${timestamp}] (${tag}) ${text}`;
    setModelConfig(prev => ({
      ...prev,
      activePredictionLogs: [logStr, ...prev.activePredictionLogs.slice(0, 15)]
    }));
  };

  // Setup Web Camera video feed
  const setupWebcam = async () => {
    if (webcamEnabled) {
      stopWebcam();
      return;
    }

    setCameraLoading(true);
    try {
      const constraints = {
        video: {
          width: { ideal: 320 },
          height: { ideal: 240 },
          facingMode: 'user'
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      webcamStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setWebcamEnabled(true);
      onWebcamStatusChange(true);
      addLog('Webcam', 'Camera stream active.');
      addLog('Status', useMotionFallback ? 'Running on Pixel motion detector' : 'Awaiting Teachable Machine predictions');
    } catch (err: any) {
      addLog('Error', 'Camera access blocked or not available.');
      alert('Could not start webcam. Please grant camera permission in your browser.');
      console.error(err);
    } finally {
      setCameraLoading(false);
    }
  };

  const stopWebcam = () => {
    if (webcamStreamRef.current) {
      webcamStreamRef.current.getTracks().forEach(track => track.stop());
      webcamStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
      requestRef.current = null;
    }
    setWebcamEnabled(false);
    onWebcamStatusChange(false);
    setPredictions([]);
    setDetectedAction('none');
    onTriggerAction('none');
    addLog('Webcam', 'Camera offline.');
  };

  // Teachable Machine Load model function
  // The user inputs a URL e.g. "https://teachablemachine.withgoogle.com/models/I5y_X2_0A/"
  // It handles automatic layout slash injection at end in case they forget it.
  const loadTeachableModel = async (urlStr: string) => {
    if (!urlStr) return;
    let formattedUrl = urlStr.trim();
    if (!formattedUrl.endsWith('/')) {
      formattedUrl += '/';
    }

    setModelConfig(prev => ({ ...prev, status: 'loading', errorMessage: undefined }));
    addLog('Model', `Fetching config from: ${formattedUrl}`);

    try {
      const tmImage = (window as any).tmImage;
      if (!tmImage) {
        throw new Error('Teachable Machine Image library is not online.');
      }

      const modelJsonURL = `${formattedUrl}model.json`;
      const metadataJsonURL = `${formattedUrl}metadata.json`;

      // Load model using TM image loader
      const loadedModel = await tmImage.load(modelJsonURL, metadataJsonURL);
      (window as any).activeTMModel = loadedModel;

      // Extract model class names
      const classNames = loadedModel.getClassLabels();
      addLog('Model', `Successfully parsed ${classNames.length} classes: [${classNames.join(', ')}]`);

      // Try automatic mapping guess based on name labels
      let foundJump = classNames[0] || 'Jump';
      let foundCrouch = classNames[1] || 'Crouch';
      let foundIdle = classNames[2] || 'Idle';

      classNames.forEach((name: string) => {
        const lower = name.toLowerCase();
        if (lower.includes('jump') || lower.includes('up') || lower.includes('raise') || lower.includes('fly')) {
          foundJump = name;
        } else if (lower.includes('crouch') || lower.includes('down') || lower.includes('duck') || lower.includes('sit')) {
          foundCrouch = name;
        } else if (lower.includes('idle') || lower.includes('neutral') || lower.includes('stand') || lower.includes('normal')) {
          foundIdle = name;
        }
      });

      setModelConfig(prev => ({
        ...prev,
        modelUrl: formattedUrl,
        status: 'success',
        classes: classNames,
        jumpClass: foundJump,
        crouchClass: foundCrouch,
        neutralClass: foundIdle
      }));

      // Turn off raw fallback because real model loaded!
      setUseMotionFallback(false);

    } catch (err: any) {
      console.error(err);
      setModelConfig(prev => ({
        ...prev,
        status: 'failed',
        errorMessage: err.message || 'Model load error'
      }));
      addLog('Model Error', `Could not download: ${err.message || 'Check URL validity and CORS permissions'}`);
    }
  };

  // Continuous prediction loop RAF
  useEffect(() => {
    const loop = async () => {
      if (!webcamEnabled) return;

      const video = videoRef.current;
      if (video && video.readyState === video.HAVE_CURRENT_DATA) {
        // Choose between True Teachable Machine estimation OR Pixel-grid motion estimation
        if (useMotionFallbackRef.current) {
          detectMotion(video);
        } else if ((window as any).activeTMModel) {
          await predictWithModel(video);
        }
      }

      requestRef.current = requestAnimationFrame(loop);
    };

    if (webcamEnabled) {
      requestRef.current = requestAnimationFrame(loop);
    }

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [webcamEnabled, useMotionFallback]);

  // 1. Pixel Motion Detection Logic (Fallback to play instantly with camera waves!)
  const detectMotion = (video: HTMLVideoElement) => {
    const videoWidth = video.videoWidth || 320;
    const videoHeight = video.videoHeight || 240;

    // We can create an offscreen canvas to analyze pixel differences
    const canvas = document.createElement('canvas');
    canvas.width = 64; // Low-res for high performance
    canvas.height = 48;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Mirror image for standard webcam feel
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const currentFrame = ctx.getImageData(0, 0, canvas.width, canvas.height);

    if (previousFrameRef.current) {
      const prev = previousFrameRef.current.data;
      const curr = currentFrame.data;

      // Define two regions of interest (ROI):
      // Upper half of screen = Jump trigger zone (detects hand raise or head bob)
      // Lower quarter of screen = Crouch trigger zone (detects head lowering)
      let upperDiffSum = 0;
      let lowerDiffSum = 0;
      let upperPixelsCount = 0;
      let lowerPixelsCount = 0;

      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          const idx = (y * canvas.width + x) * 4;
          // Grayscale luminosity delta
          const prevLuma = 0.299 * prev[idx] + 0.587 * prev[idx + 1] + 0.114 * prev[idx + 2];
          const currLuma = 0.299 * curr[idx] + 0.587 * curr[idx + 1] + 0.114 * curr[idx + 2];
          const diff = Math.abs(currLuma - prevLuma);

          if (diff > 35) { // threshold of delta change
            if (y < canvas.height * 0.4) {
              upperDiffSum += diff;
            } else if (y > canvas.height * 0.65) {
              lowerDiffSum += diff;
            }
          }

          if (y < canvas.height * 0.4) upperPixelsCount++;
          else if (y > canvas.height * 0.65) lowerPixelsCount++;
        }
      }

      // Metric calculations
      const upperMetric = upperPixelsCount > 0 ? (upperDiffSum / upperPixelsCount) : 0;
      const lowerMetric = lowerPixelsCount > 0 ? (lowerDiffSum / lowerPixelsCount) : 0;

      // Smooth metrics
      setMotionMetrics({
        jumpAmt: Math.min(100, Math.floor(upperMetric * 8)),
        crouchAmt: Math.min(100, Math.floor(lowerMetric * 6))
      });

      // Map metrics straight to triggers
      const cfg = activeConfigRef.current;
      const jumpThresholdValue = cfg.jumpThreshold * 100;
      const crouchThresholdValue = cfg.crouchThreshold * 100;

      let nextAction: 'jump' | 'crouch' | 'none' = 'none';

      // Prioritize jump waves
      if (upperMetric * 8 > jumpThresholdValue) {
        nextAction = 'jump';
      } else if (lowerMetric * 6 > crouchThresholdValue) {
        nextAction = 'crouch';
      }

      if (nextAction !== detectedAction) {
        setDetectedAction(nextAction);
        onTriggerAction(nextAction);
        if (nextAction !== 'none') {
          addLog('Trigger (Motion)', `${nextAction.toUpperCase()} gesture sensed.`);
        }
      }

      // Simulated classification rendering lists
      setPredictions([
        { className: '🖐️ Upper Zone (JUMP)', probability: Math.min(1, (upperMetric * 8) / 100) },
        { className: '👇 Lower Zone (CROUCH)', probability: Math.min(1, (lowerMetric * 6) / 100) },
        { className: '🧘 Neutral Stillness', probability: Math.max(0, 1 - (upperMetric * 8 + lowerMetric * 6) / 100) }
      ]);
    }

    previousFrameRef.current = currentFrame;
  };

  // 2. Real Teachable Machine Model prediction logic
  const predictWithModel = async (video: HTMLVideoElement) => {
    const loadedModel = (window as any).activeTMModel;
    if (!loadedModel) return;

    try {
      // Run loaded TM classifier model predictions
      const prediction = await loadedModel.predict(video);

      // Map prediction list to custom mappings
      const items: PredictionMap[] = prediction.map((p: any) => ({
        className: p.className,
        probability: p.probability
      }));

      setPredictions(items);

      // Find probability values for our mapped settings labels
      const config = activeConfigRef.current;
      const jumpData = items.find(i => i.className === config.jumpClass);
      const crouchData = items.find(i => i.className === config.crouchClass);

      const jumpProb = jumpData ? jumpData.probability : 0;
      const crouchProb = crouchData ? crouchData.probability : 0;

      let nextAction: 'jump' | 'crouch' | 'none' = 'none';

      if (jumpProb >= config.jumpThreshold) {
        nextAction = 'jump';
      } else if (crouchProb >= config.crouchThreshold) {
        nextAction = 'crouch';
      }

      if (nextAction !== detectedAction) {
        setDetectedAction(nextAction);
        onTriggerAction(nextAction);
        if (nextAction !== 'none') {
          const confidence = Math.floor((nextAction === 'jump' ? jumpProb : crouchProb) * 100);
          addLog('Trigger (AI)', `${nextAction.toUpperCase()} (Confidence: ${confidence}%)`);
        }
      }

    } catch (e) {
      console.error('Error during prediction', e);
    }
  };

  const SharpCorners = () => (
    <>
      <div className="absolute -top-[1.5px] -left-[1.5px] w-2.5 h-2.5 border-t-2 border-l-2 border-white pointer-events-none z-10" />
      <div className="absolute -top-[1.5px] -right-[1.5px] w-2.5 h-2.5 border-t-2 border-r-2 border-white pointer-events-none z-10" />
      <div className="absolute -bottom-[1.5px] -left-[1.5px] w-2.5 h-2.5 border-b-2 border-l-2 border-white pointer-events-none z-10" />
      <div className="absolute -bottom-[1.5px] -right-[1.5px] w-2.5 h-2.5 border-b-2 border-r-2 border-white pointer-events-none z-10" />
    </>
  );

  return (
    <div className="relative flex flex-col gap-5 bg-zinc-900 border border-white/10 p-5 font-mono text-zinc-300">
      <SharpCorners />

      {/* Title block */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/10 pb-4 gap-2">
        <div className="flex items-center gap-2">
          <Camera className="h-4 w-4 text-white" />
          <h2 className="text-[11px] font-black uppercase tracking-wider text-white font-sans">01. OPTICAL COHESION BUS</h2>
        </div>
        <div className="flex items-center gap-2 text-[10px]">
          <span className="text-zinc-500 font-sans">AI ENGINE PATH:</span>
          <span className={`px-2 py-0.5 text-[9px] font-bold tracking-wider rounded-sm ${isCdnLoaded ? 'bg-zinc-800 text-green-400 border border-white/10' : 'bg-zinc-950 text-amber-500 border border-white/5'}`}>
            {cdnStatus.toUpperCase()}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
        {/* WEBCAM FEED PREVIEW (LHS - 5 Columns) */}
        <div className="md:col-span-5 flex flex-col gap-3">
          <div className="relative aspect-[4/3] w-full bg-black border border-white/10 overflow-hidden flex flex-col items-center justify-center">
            {webcamEnabled ? (
              <video
                ref={videoRef}
                className="w-full h-full object-cover scale-x-[-1]"
                playsInline
                muted
              />
            ) : (
              <div className="flex flex-col items-center gap-2.5 text-zinc-600 p-4 text-center">
                <WifiOff className="h-8 w-8 text-zinc-700 animate-pulse" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">CAMERA STANDBY</span>
                <p className="text-[9px] text-zinc-600 max-w-xs leading-normal">
                  Connect direct user optical stream to engage real-time movement velocity checks.
                </p>
              </div>
            )}

            {/* Retro HUD Interface overlays */}
            {webcamEnabled && (
              <div className="absolute inset-0 border border-white/10 pointer-events-none">
                {/* Crosshairs */}
                <div className="absolute top-1/2 left-4 right-4 h-[1px] bg-white/10" />
                <div className="absolute left-1/2 top-4 bottom-4 w-[1px] bg-white/10" />

                {/* Sub-areas visuals for fallback motion mode */}
                {useMotionFallback && (
                  <>
                    <div className="absolute top-0 left-0 right-0 h-[40%] border-b border-dotted border-green-500/30 bg-green-500/5 flex items-start p-2">
                      <span className="text-[8px] font-mono text-green-400 font-bold bg-black/80 border border-white/10 px-1 tracking-wider uppercase">
                        JUMP TRIGGER ZONE ({motionMetrics.jumpAmt}%)
                      </span>
                    </div>

                    <div className="absolute bottom-0 left-0 right-0 h-[35%] border-t border-dotted border-blue-500/30 bg-blue-500/5 flex items-end p-2 justify-end">
                      <span className="text-[8px] font-mono text-blue-400 font-bold bg-black/80 border border-white/10 px-1 tracking-wider uppercase">
                        CROUCH TRIGGER ZONE ({motionMetrics.crouchAmt}%)
                      </span>
                    </div>
                  </>
                )}

                {/* Scanline pattern overlay */}
                <div className="absolute inset-0 bg-scanlines bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.4)_50%)] bg-[length:100%_4px]" />
                <div className="absolute bottom-2.5 left-2.5 bg-black/90 text-[8px] font-mono px-2 py-0.5 border border-white/20 text-green-400 font-bold tracking-wider">
                  OPSTREAM ● CAPTURE
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={setupWebcam}
              disabled={cameraLoading}
              className={`relative w-full flex items-center justify-center gap-2 py-2 px-4 text-xs font-bold font-sans cursor-pointer transition-all border ${
                webcamEnabled
                  ? 'bg-rose-950/60 border-rose-500 text-rose-200 hover:bg-rose-900'
                  : 'bg-white text-zinc-950 border-white hover:bg-zinc-200'
              }`}
            >
              {webcamEnabled && <SharpCorners />}
              <Camera className="h-3.5 w-3.5" />
              <span className="uppercase tracking-wider text-[10px]">
                {cameraLoading ? 'INIT PROCESS...' : webcamEnabled ? 'TERMINATE CAPTURE' : 'ACTIVATE CAMERA'}
              </span>
            </button>
          </div>
        </div>

        {/* CONTROLLER CONFIG & PREDICTIONS (RHS - 7 columns) */}
        <div className="md:col-span-7 flex flex-col gap-4 font-mono">
          {/* Mode Switch Tab Bar */}
          <div className="flex bg-zinc-950 p-1 border border-white/10 text-xs">
            <button
              onClick={() => {
                setUseMotionFallback(true);
                addLog('Mode Change', 'Switched to Motion Wave trigger helper');
              }}
              className={`w-full py-2 font-black uppercase tracking-wider text-[10px] cursor-pointer transition-all ${
                useMotionFallback
                  ? 'bg-zinc-800 text-white border border-white/20'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Pixel-Motion Active
            </button>
            <button
              onClick={() => {
                setUseMotionFallback(false);
                addLog('Mode Change', 'Switched to Teachable Machine custom model loader');
              }}
              className={`w-full py-2 font-black uppercase tracking-wider text-[10px] cursor-pointer transition-all ${
                !useMotionFallback
                  ? 'bg-zinc-800 text-white border border-white/20'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Neural Classifier
            </button>
          </div>

          {/* MODE 1: Motion Detector instructions */}
          {useMotionFallback && (
            <div className="bg-zinc-950/40 border border-white/5 p-3 text-[11px] flex flex-col gap-2">
              <span className="font-bold text-white flex items-center gap-1 uppercase tracking-wider text-[10px]">
                <Layers className="h-3.5 w-3.5 text-green-400" /> OPTICAL DIFFERENTIAL SENSORTYPE
              </span>
              <p className="text-zinc-400 leading-relaxed font-sans">
                Automatic trigger sequence: Pixel variance maps hand / head speeds straight into movement states.
              </p>
              <ul className="space-y-1 font-sans text-zinc-500 text-[10px]">
                <li>• <b className="text-zinc-300 font-mono">MOTION JUMP:</b> Lift hand high into upper zone.</li>
                <li>• <b className="text-zinc-300 font-mono">MOTION CROUCH:</b> Sit low or slide hand down into lower zone.</li>
              </ul>
            </div>
          )}

          {/* MODE 2: Teachable Machine URL Loader */}
          {!useMotionFallback && (
            <div className="flex flex-col gap-2.5 bg-zinc-900/40 p-3 border border-white/10">
              <span className="text-[10px] font-bold text-white flex items-center gap-1 uppercase tracking-wider">
                🧠 CONNECT CLOUD BRAIN
              </span>
              <p className="text-[9px] text-zinc-500 font-sans leading-normal">
                Paste the exported Google Teachable Machine link (must be uploaded / published):
              </p>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="https://teachablemachine.withgoogle.com/models/I5y_X2_0A/"
                  value={inputUrl}
                  onChange={(e) => setInputUrl(e.target.value)}
                  className="w-full bg-zinc-950 border border-white/15 text-[10px] px-3 py-2 text-white focus:outline-none focus:border-white font-mono"
                />
                <button
                  onClick={() => loadTeachableModel(inputUrl)}
                  disabled={modelConfig.status === 'loading'}
                  className="bg-zinc-100 hover:bg-zinc-300 text-zinc-950 font-bold py-1 px-4 text-[10px] uppercase tracking-wider cursor-pointer transition-all whitespace-nowrap border border-white"
                >
                  {modelConfig.status === 'loading' ? 'FETCHING...' : 'SYNC'}
                </button>
              </div>

              {/* Loader feedback */}
              {modelConfig.status === 'success' && (
                <div className="flex items-center gap-1.5 text-[9px] text-green-400 bg-zinc-950 p-2 border border-green-900/60">
                  <CheckCircle className="h-3 w-3" /> SYNAPSE ESTABLISHED: {modelConfig.classes.length} MODEL CLASSES REGISTERED.
                </div>
              )}
              {modelConfig.status === 'failed' && (
                <div className="flex items-center gap-1.5 text-[9px] text-rose-400 bg-zinc-950 p-2 border border-rose-900/60">
                  <ShieldAlert className="h-3 w-3" /> FAULT: {modelConfig.errorMessage || 'Link check failed. Verify public CORS configuration.'}
                </div>
              )}

              {/* Dynamic Action Mapping Settings if model is active */}
              {modelConfig.status === 'success' && (
                <div className="grid grid-cols-2 gap-3 mt-1 border-t border-white/5 pt-2.5 text-[10px]">
                  <div>
                    <label className="text-zinc-500 block mb-1 uppercase font-bold tracking-wider">Jump Class:</label>
                    <select
                      value={modelConfig.jumpClass}
                      onChange={(e) => setModelConfig(p => ({ ...p, jumpClass: e.target.value }))}
                      className="w-full bg-zinc-950 border border-white/15 text-zinc-300 px-2 py-1 focus:border-white focus:outline-none"
                    >
                      {modelConfig.classes.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-zinc-500 block mb-1 uppercase font-bold tracking-wider">Crouch Class:</label>
                    <select
                      value={modelConfig.crouchClass}
                      onChange={(e) => setModelConfig(p => ({ ...p, crouchClass: e.target.value }))}
                      className="w-full bg-zinc-950 border border-white/15 text-zinc-300 px-2 py-1 focus:border-white focus:outline-none"
                    >
                      {modelConfig.classes.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* THRESHOLD SENSITIVITY CONFIG */}
          <div className="bg-zinc-950/20 p-3 border border-white/5 flex flex-col gap-2.5">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">THRESHOLD BUS VELOCITY</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[10px]">
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between text-[9px]">
                  <span className="text-zinc-500 font-bold uppercase tracking-wider">JUMP CONFIDENCE:</span>
                  <span className="text-zinc-300 font-black">{(1 - modelConfig.jumpThreshold).toFixed(2)}x ({(modelConfig.jumpThreshold * 100).toFixed(0)}%)</span>
                </div>
                <input
                  type="range"
                  min="0.50"
                  max="0.95"
                  step="0.01"
                  value={modelConfig.jumpThreshold}
                  onChange={(e) => setModelConfig(prev => ({ ...prev, jumpThreshold: parseFloat(e.target.value) }))}
                  className="w-full accent-white bg-zinc-800 h-1 cursor-pointer"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between text-[9px]">
                  <span className="text-zinc-500 font-bold uppercase tracking-wider">CROUCH CONFIDENCE:</span>
                  <span className="text-zinc-300 font-black">{(1 - modelConfig.crouchThreshold).toFixed(2)}x ({(modelConfig.crouchThreshold * 100).toFixed(0)}%)</span>
                </div>
                <input
                  type="range"
                  min="0.50"
                  max="0.95"
                  step="0.01"
                  value={modelConfig.crouchThreshold}
                  onChange={(e) => setModelConfig(prev => ({ ...prev, crouchThreshold: parseFloat(e.target.value) }))}
                  className="w-full accent-white bg-zinc-800 h-1 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* DYNAMIC CONFIDENCE PROGRESS BARS */}
          <div className="flex flex-col gap-2 bg-zinc-950/70 p-3 border border-white/10">
            <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider">
              REAL-TIME SIGNAL TELEMETRY
            </span>

            {webcamEnabled && predictions.length > 0 ? (
              <div className="space-y-2 text-[10px]">
                {predictions.map((p) => {
                  const probPercent = Math.floor(p.probability * 100);
                  const isSensedAction =
                    (!useMotionFallback &&
                      ((p.className === modelConfig.jumpClass && p.probability >= modelConfig.jumpThreshold) ||
                       (p.className === modelConfig.crouchClass && p.probability >= modelConfig.crouchThreshold))) ||
                    (useMotionFallback &&
                      ((p.className.includes('JUMP') && p.probability * 100 >= modelConfig.jumpThreshold * 100) ||
                       (p.className.includes('CROUCH') && p.probability * 100 >= modelConfig.crouchThreshold * 100)));

                  return (
                    <div key={p.className} className="space-y-1">
                      <div className="flex justify-between items-center text-zinc-400">
                        <span className={`truncate ${isSensedAction ? 'text-green-400 font-bold' : ''}`}>
                          {p.className.toUpperCase()}
                        </span>
                        <span className={`font-bold ${isSensedAction ? 'text-green-300' : 'text-zinc-500'}`}>
                          {probPercent}% {isSensedAction && '❖ ACTIVE'}
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-zinc-900 border border-white/5 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-75 ${
                            p.className.includes('JUMP') || p.className === modelConfig.jumpClass
                              ? 'bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.5)]'
                              : p.className.includes('CROUCH') || p.className === modelConfig.crouchClass
                              ? 'bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.5)]'
                              : 'bg-zinc-650'
                          }`}
                          style={{ width: `${probPercent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <span className="text-[9px] text-zinc-600 block text-center py-1 italic">
                {webcamEnabled ? 'ENGAGING SENSOR LOOPS...' : 'AWAITING OPTSTREAM TELEMETRY'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* DETECTORS REAL-TIME OUTPUT LOGGER WINDOW */}
      <div className="flex flex-col gap-2 bg-black/90 p-3 border border-white/10">
        <div className="flex justify-between items-center text-[9px] text-zinc-500 font-bold uppercase tracking-wider">
          <span>SYSTEM LOGS:</span>
          <button
            onClick={() => setModelConfig(p => ({ ...p, activePredictionLogs: [] }))}
            className="text-[8px] text-zinc-400 hover:text-white underline cursor-pointer select-none"
          >
            Flush logs
          </button>
        </div>
        <div className="h-20 overflow-y-auto text-[9px] text-zinc-500 space-y-1.5 scrollbar-thin scrollbar-thumb-zinc-800">
          {modelConfig.activePredictionLogs.length > 0 ? (
            modelConfig.activePredictionLogs.map((log, i) => (
              <div key={i} className={`truncate ${log.includes('Trigger') ? 'text-green-400 font-bold' : log.includes('Error') ? 'text-rose-450' : 'text-zinc-500'}`}>
                {log.toUpperCase()}
              </div>
            ))
          ) : (
            <span className="italic block text-zinc-700">AWAITING EVENT COEFFICIENTS_</span>
          )}
        </div>
      </div>
    </div>
  );
}
