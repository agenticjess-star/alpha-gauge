import { useEffect, useRef } from 'react';

interface ParticleCanvasProps {
  particles: Float64Array;
  weights: Float64Array;
  width?: number;
  height?: number;
}

export function ParticleCanvas({ particles, weights, width = 600, height = 80 }: ParticleCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || particles.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Clear
    ctx.clearRect(0, 0, width, height);

    // Build histogram of particle probabilities
    const nBins = 100;
    const bins = new Float64Array(nBins);

    // Convert logit particles to probabilities using sigmoid
    for (let i = 0; i < particles.length; i++) {
      const logit = particles[i];
      const prob = 1 / (1 + Math.exp(-logit));
      const bin = Math.min(nBins - 1, Math.max(0, Math.floor(prob * nBins)));
      bins[bin] += weights[i];
    }

    // Find max for scaling
    let maxBin = 0;
    for (let i = 0; i < nBins; i++) {
      if (bins[i] > maxBin) maxBin = bins[i];
    }

    if (maxBin === 0) return;

    // Draw histogram bars
    const barWidth = width / nBins;

    for (let i = 0; i < nBins; i++) {
      const h = (bins[i] / maxBin) * (height - 4);
      const x = i * barWidth;
      const y = height - h;
      const prob = i / nBins;

      // Color: green if > 0.5, red if < 0.5, with opacity based on density
      const alpha = 0.3 + (bins[i] / maxBin) * 0.7;
      if (prob >= 0.5) {
        ctx.fillStyle = `rgba(0, 255, 136, ${alpha})`;
      } else {
        ctx.fillStyle = `rgba(255, 51, 102, ${alpha})`;
      }

      ctx.fillRect(x, y, barWidth - 0.5, h);
    }

    // Draw 50% line
    const midX = width / 2;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(midX, 0);
    ctx.lineTo(midX, height);
    ctx.stroke();
    ctx.setLineDash([]);
  }, [particles, weights, width, height]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width, height }}
      className="block border border-border"
    />
  );
}
