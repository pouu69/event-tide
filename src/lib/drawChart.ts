import type { EconDataPoint } from '../types';

export interface ChartDataset {
  key: string;
  label: string;
  color: string;
  dash?: number[];
  lineWidth?: number;
}

export function drawChart(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  datasets: ChartDataset[],
  data: EconDataPoint[],
  hoverIndex?: number,
  warStartDate?: string,
  eventMarkers?: { date: string; label: string }[],
): void {
  const W = canvas.width;
  const H = canvas.height;
  const pad = { top: 24, right: 16, bottom: 32, left: 52 };
  const chartW = W - pad.left - pad.right;
  const chartH = H - pad.top - pad.bottom;
  const n = data.length;
  if (n < 2) return;

  const dates = data.map(d => d.date as string);

  ctx.clearRect(0, 0, W, H);

  // Normalized values (% change from baseline = data[0])
  const dsVals = datasets.map(ds =>
    data.map(d => {
      const base = Number(data[0][ds.key]);
      const val = Number(d[ds.key]);
      return base !== 0 ? ((val - base) / base) * 100 : 0;
    })
  );

  // Y range
  const flat = dsVals.flat();
  let yMin = Math.min(...flat);
  let yMax = Math.max(...flat);
  const range = yMax - yMin || 1;
  yMin -= range * 0.1;
  yMax += range * 0.1;

  const toY = (v: number) => pad.top + chartH - ((v - yMin) / (yMax - yMin)) * chartH;
  const toX = (i: number) => pad.left + (i / (n - 1)) * chartW;

  // Grid lines
  ctx.strokeStyle = '#e8e4de';
  ctx.lineWidth = 1;
  const gridLines = 4;
  for (let i = 0; i <= gridLines; i++) {
    const y = pad.top + (chartH / gridLines) * i;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + chartW, y);
    ctx.stroke();
    const val = yMax - ((yMax - yMin) / gridLines) * i;
    ctx.fillStyle = '#918a82';
    ctx.font = '500 10px DM Sans, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(val.toFixed(1), pad.left - 8, y + 3);
  }

  // Zero baseline
  const zeroY = toY(0);
  if (zeroY > pad.top && zeroY < pad.top + chartH) {
    ctx.save();
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(pad.left, zeroY);
    ctx.lineTo(pad.left + chartW, zeroY);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#918a82';
    ctx.font = '600 9px DM Sans, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('0%', pad.left - 8, zeroY + 3);
  }

  // War start marker
  if (warStartDate) {
    const warIdx = dates.indexOf(warStartDate);
    if (warIdx >= 0) {
      const x = toX(warIdx);
      ctx.save();
      ctx.strokeStyle = 'rgba(192,57,43,0.25)';
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(x, pad.top);
      ctx.lineTo(x, pad.top + chartH);
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = '#c0392b';
      ctx.font = 'bold 9px DM Sans, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('WAR', x, pad.top - 6);
    }
  }

  // Event markers
  if (eventMarkers && eventMarkers.length > 0) {
    const markers = eventMarkers.slice(0, 5);
    markers.forEach(marker => {
      const mIdx = dates.indexOf(marker.date);
      // Find nearest date if exact match not found
      let x: number;
      if (mIdx >= 0) {
        x = toX(mIdx);
      } else {
        // Find closest date
        let closest = 0;
        for (let i = 1; i < dates.length; i++) {
          if (dates[i] <= marker.date) closest = i;
        }
        x = toX(closest);
      }
      // Dashed vertical line
      ctx.save();
      ctx.strokeStyle = 'rgba(0,0,0,0.08)';
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, pad.top);
      ctx.lineTo(x, pad.top + chartH);
      ctx.stroke();
      ctx.restore();
      // Rotated label at bottom
      ctx.save();
      ctx.fillStyle = '#918a82';
      ctx.font = '500 7px DM Sans, sans-serif';
      ctx.textAlign = 'left';
      ctx.translate(x + 2, pad.top + chartH + 28);
      ctx.rotate(-Math.PI / 6);
      const labelText = marker.label.length > 12 ? marker.label.slice(0, 12) + '..' : marker.label;
      ctx.fillText(labelText, 0, 0);
      ctx.restore();
    });
  }

  // Hover crosshair
  if (hoverIndex !== undefined) {
    const hx = toX(hoverIndex);
    ctx.save();
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(hx, pad.top);
    ctx.lineTo(hx, pad.top + chartH);
    ctx.stroke();
    ctx.restore();
  }

  // Draw datasets
  datasets.forEach((ds, dsIdx) => {
    const vals = dsVals[dsIdx];

    // Line
    ctx.strokeStyle = ds.color;
    ctx.lineWidth = ds.lineWidth || 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.setLineDash(ds.dash || []);
    ctx.beginPath();
    vals.forEach((v, i) => {
      i === 0 ? ctx.moveTo(toX(i), toY(v)) : ctx.lineTo(toX(i), toY(v));
    });
    ctx.stroke();
    ctx.setLineDash([]);

    // Fill under first dataset
    if (dsIdx === 0) {
      ctx.lineTo(toX(n - 1), pad.top + chartH);
      ctx.lineTo(toX(0), pad.top + chartH);
      ctx.closePath();
      const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + chartH);
      grad.addColorStop(0, ds.color + '15');
      grad.addColorStop(1, ds.color + '02');
      ctx.fillStyle = grad;
      ctx.fill();
    }

    // Dots
    vals.forEach((v, i) => {
      const x = toX(i);
      const y = toY(v);
      const hover = hoverIndex === i;
      ctx.beginPath();
      ctx.arc(x, y, hover ? 5 : 3, 0, Math.PI * 2);
      ctx.fillStyle = hover ? ds.color : '#fff';
      ctx.fill();
      ctx.strokeStyle = ds.color;
      ctx.lineWidth = hover ? 2.5 : 1.5;
      ctx.stroke();
    });
  });

  // X labels
  ctx.fillStyle = '#918a82';
  ctx.font = '500 9px DM Sans, sans-serif';
  ctx.textAlign = 'center';
  dates.forEach((d, i) => {
    if (n <= 6 || i % 2 === 0 || i === n - 1) {
      ctx.fillText(d.slice(5), toX(i), pad.top + chartH + 16);
    }
  });
}
