/**
 * Digital Signature Canvas Pad
 * Legal compliance signature capture for biosecurity declarations
 */

import React, { useRef, useState, useEffect } from 'react';
import { Eraser, PenLine } from 'lucide-react';

interface DigitalSignaturePadProps {
  onSignatureChange: (dataUrl: string) => void;
  required?: boolean;
}

export const DigitalSignaturePad: React.FC<DigitalSignaturePadProps> = ({
  onSignatureChange,
  required = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    if ('touches' in e && e.touches.length > 0) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    const mouseEvent = e as React.MouseEvent;
    return {
      x: mouseEvent.clientX - rect.left,
      y: mouseEvent.clientY - rect.top,
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const coords = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const coords = getCoordinates(e);
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas && hasSignature) {
      const dataUrl = canvas.toDataURL('image/png');
      onSignatureChange(dataUrl);
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    onSignatureChange('');
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
        <label className="flex items-center gap-1.5">
          <PenLine className="w-3.5 h-3.5 text-emerald-400" />
          Visitor Digital Signature {required && <span className="text-rose-400">*</span>}
        </label>
        {hasSignature && (
          <button
            type="button"
            onClick={clearCanvas}
            className="text-[11px] text-slate-400 hover:text-rose-400 flex items-center gap-1 transition"
          >
            <Eraser className="w-3 h-3" />
            Clear Signature
          </button>
        )}
      </div>

      <div className="relative rounded-xl border border-slate-700 bg-white/95 overflow-hidden shadow-inner">
        <canvas
          ref={canvasRef}
          width={400}
          height={110}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="w-full h-24 touch-none cursor-crosshair block"
        />

        {!hasSignature && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-slate-400/70 text-xs italic">
            Sign inside this box with finger or stylus
          </div>
        )}
      </div>
      <p className="text-[10px] text-slate-400">
        By signing, the visitor legally affirms all ASF biosecurity declarations under penalty of Innscor access denial.
      </p>
    </div>
  );
};
