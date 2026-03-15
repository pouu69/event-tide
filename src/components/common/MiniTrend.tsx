import { useRef, useEffect } from 'react';

interface Props {
  data: number[];
  color: string;
  width?: number;
  height?: number;
}

export default function MiniTrend({
  data,
  color,
  width = 60,
  height = 16,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.length < 2) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const padding = 3;
    const chartH = height - padding * 2;
    const stepX = (width - padding * 2 - 3) / (data.length - 1); // reserve 3px for endpoint dot

    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    data.forEach((val, i) => {
      const x = padding + i * stepX;
      const y = padding + chartH - ((val - min) / range) * chartH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    ctx.stroke();

    // Endpoint dot
    const lastX = padding + (data.length - 1) * stepX;
    const lastY = padding + chartH - ((data[data.length - 1] - min) / range) * chartH;
    ctx.beginPath();
    ctx.arc(lastX, lastY, 2, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }, [data, color, width, height]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width, height, display: 'inline-block', verticalAlign: 'middle' }}
    />
  );
}
