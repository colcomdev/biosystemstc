/**
 * Biometric Capture & Facial Embedding Extraction
 * Provides live camera feed / simulator, facial alignment reticle, and 512-dim vector generation
 */

import React, { useRef, useState, useEffect } from 'react';
import { Camera, RefreshCw, CheckCircle, Scan, AlertCircle, Sparkles } from 'lucide-react';
import { generateSyntheticEmbedding, generateMatchingVector } from '../../lib/biometrics';
import { RegisteredVisitor } from '../../types';

interface BiometricCapturePadProps {
  onCapture: (photoDataUrl: string, embedding: number[]) => void;
  selectedVisitor?: RegisteredVisitor | null;
  forcePassBiometric?: boolean;
}

export const BiometricCapturePad: React.FC<BiometricCapturePadProps> = ({
  onCapture,
  selectedVisitor,
  forcePassBiometric = true,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [streamActive, setStreamActive] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Initialize camera if permitted
  const startCamera = async () => {
    setCameraError(null);
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          setStreamActive(true);
        }
      } else {
        throw new Error('Camera API not supported');
      }
    } catch {
      setCameraError('Camera access unavailable or blocked. You can use standard capture.');
      setStreamActive(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
      setStreamActive(false);
    }
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Capture face snapshot & generate 512-dim embedding
  const handleCapture = (simulatePass = forcePassBiometric) => {
    setIsScanning(true);
    setTimeout(() => {
      let photoDataUrl = '';
      if (streamActive && videoRef.current && canvasRef.current) {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        canvas.width = video.videoWidth || 400;
        canvas.height = video.videoHeight || 400;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          photoDataUrl = canvas.toDataURL('image/jpeg', 0.85);
        }
      }

      if (!photoDataUrl) {
        // Fallback photo
        photoDataUrl = selectedVisitor?.photoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80';
      }

      setCapturedPhoto(photoDataUrl);

      // Generate embedding vector
      let embedding: number[];
      if (selectedVisitor && selectedVisitor.embeddingVector) {
        const targetSim = simulatePass ? 0.94 : 0.65;
        embedding = generateMatchingVector(selectedVisitor.embeddingVector, targetSim);
      } else {
        embedding = generateSyntheticEmbedding(Date.now().toString());
      }

      setIsScanning(false);
      onCapture(photoDataUrl, embedding);
    }, 600);
  };

  const handleRetake = () => {
    setCapturedPhoto(null);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
        <label className="flex items-center gap-1.5">
          <Scan className="w-3.5 h-3.5 text-emerald-400" />
          Gate Camera: Facial Biometrics (512D pgvector)
        </label>
        <span className="text-[11px] text-emerald-400 font-mono font-bold">
          Threshold: &gt;85%
        </span>
      </div>

      <div className="relative rounded-2xl border border-slate-700 bg-slate-950 overflow-hidden aspect-video flex items-center justify-center">
        {/* Hidden Canvas for Frame Grab */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Video feed or Captured Image or Placeholder */}
        {capturedPhoto ? (
          <div className="relative w-full h-full">
            <img
              src={capturedPhoto}
              alt="Captured Biometric"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[1px] flex flex-col items-center justify-center p-3 text-center">
              <CheckCircle className="w-10 h-10 text-emerald-400 mb-1 drop-shadow" />
              <div className="text-white text-xs font-black tracking-wide uppercase">
                512-D Embedding Vector Extracted
              </div>
              <div className="text-[10px] text-emerald-300 font-mono mt-0.5">
                Ready for pgvector cosine comparison
              </div>
            </div>
          </div>
        ) : streamActive ? (
          <div className="relative w-full h-full">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover mirror"
            />
            {/* Face Alignment Overlay Reticle */}
            <div className="absolute inset-0 border-2 border-emerald-500/40 rounded-xl m-4 pointer-events-none flex flex-col items-center justify-center">
              <div className="w-36 h-48 border-2 border-dashed border-emerald-400 rounded-3xl animate-pulse flex items-center justify-center">
                <span className="text-[10px] text-emerald-300 font-bold bg-slate-950/70 px-2 py-0.5 rounded">
                  ALIGN VISITOR FACE
                </span>
              </div>
            </div>
          </div>
        ) : (
          /* High-fidelity Biometric Simulator Display */
          <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center bg-gradient-to-br from-slate-900 to-slate-950">
            <div className="w-20 h-24 border-2 border-dashed border-emerald-500/60 rounded-2xl flex flex-col items-center justify-center relative mb-2">
              <Scan className="w-8 h-8 text-emerald-400 animate-pulse" />
              <span className="text-[9px] text-emerald-300 font-mono mt-1 font-bold">512D MESH</span>
              <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping" />
            </div>

            <div className="text-xs text-slate-200 font-bold">
              Optical Biometric Gate Scanner
            </div>
            <p className="text-[11px] text-slate-400 max-w-xs mt-0.5">
              Align visitor face with handheld camera or simulate high-accuracy enrollment match.
            </p>

            {cameraError && (
              <span className="text-[10px] text-amber-300 flex items-center gap-1 mt-1">
                <AlertCircle className="w-3 h-3" /> {cameraError}
              </span>
            )}
          </div>
        )}

        {/* Live Scanning Progress Overlay */}
        {isScanning && (
          <div className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center text-emerald-400 gap-2">
            <RefreshCw className="w-8 h-8 animate-spin" />
            <span className="text-xs font-mono font-bold">Computing Cosine Similarity...</span>
          </div>
        )}
      </div>

      {/* Control Buttons */}
      <div className="grid grid-cols-2 gap-2 pt-1">
        {!capturedPhoto ? (
          <>
            <button
              type="button"
              onClick={() => handleCapture(true)}
              className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-[0.98] shadow-md shadow-emerald-950/40"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Capture Verified Face (&gt;85%)
            </button>

            <button
              type="button"
              onClick={() => handleCapture(false)}
              className="py-2.5 px-3 bg-rose-900/60 hover:bg-rose-900/80 text-rose-200 border border-rose-700/60 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition active:scale-[0.98]"
            >
              <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
              Capture Mismatch (&lt;85%)
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={handleRetake}
            className="col-span-2 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retake Biometric Photo
          </button>
        )}
      </div>

      {!streamActive && !capturedPhoto && (
        <button
          type="button"
          onClick={startCamera}
          className="w-full text-center text-[11px] text-slate-400 hover:text-emerald-400 py-1 transition flex items-center justify-center gap-1"
        >
          <Camera className="w-3 h-3" />
          Activate Device Hardware Camera
        </button>
      )}
    </div>
  );
};
