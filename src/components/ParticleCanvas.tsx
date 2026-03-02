import { useEffect, useRef } from 'react';

interface ParticleCanvasProps {
  particles: Float64Array;
  weights: Float64Array;
  width?: number;
  height?: number;
}

export function ParticleCanvas({ particles, weights, height = 64 }: ParticleCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || particles.length === 0) return;

    const width = container.clientWidth;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);

    const nBins = 100;
    const bins = new Float64Array(nBins);

    for (let i = 0; i < particles.length; i++) {
      const logit = particles[i];
      const prob = 1 / (1 + Math.exp(-logit));
      const bin = Math.min(nBins - 1, Math.max(0, Math.floor(prob * nBins)));
      bins[bin] += weights[i];
    }

    let maxBin = 0;
    for (let i = 0; i < nBins; i++) {
      if (bins[i] > maxBin) maxBin = bins[i];
    }
    if (maxBin === 0) return;

    const barWidth = width / nBins;
    for (let i = 0; i < nBins; i++) {
      const h = (bins[i] / maxBin) * (height - 4);
      const x = i * barWidth;
      const y = height - h;
      const prob = i / nBins;
      const alpha = 0.3 + (bins[i] / maxBin) * 0.7;
      ctx.fillStyle = prob >= 0.5
        ? `rgba(0, 255, 136, ${alpha})`
        : `rgba(255, 51, 102, ${alpha})`;
      ctx.fillRect(x, y, barWidth - 0.5, h);
    }

    const midX = width / 2;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(midX, 0);
    ctx.lineTo(midX, height);
    ctx.stroke();
    ctx.setLineDash([]);
  }, [particles, weights, height]);

  return (
    <div ref={containerRef} className="w-full">
      <canvas
        ref={canvasRef}
        className="block w-full border border-border rounded"
        style={{ height }}
      />
    </div>
  );
}
