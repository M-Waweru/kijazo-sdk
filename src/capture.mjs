/**
 * Browser-only screenshot and annotation utilities for any web application.
 * A captured tab/window requires explicit browser permission.
 */
const MAX_SIDE = 1600;

function surface(width, height) {
  const canvas = document.createElement('canvas');
  const ratio = Math.min(1, MAX_SIDE / Math.max(width, height));
  canvas.width = Math.max(1, Math.round(width * ratio));
  canvas.height = Math.max(1, Math.round(height * ratio));
  return canvas;
}

export async function imageFromFile(file) {
  if (!file || !/^image\/(png|jpeg|webp|gif)$/.test(file.type)) {
    throw new Error('Attach a PNG, JPEG, WebP or GIF screenshot.');
  }
  if (file.size > 12 * 1024 * 1024) throw new Error('Screenshots must be under 12 MB.');
  const url = URL.createObjectURL(file);
  try {
    const bitmap = await createImageBitmap(file);
    try {
      const canvas = surface(bitmap.width, bitmap.height);
      canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/jpeg', 0.84);
    } finally {
      bitmap.close();
    }
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function captureScreen() {
  if (!navigator.mediaDevices?.getDisplayMedia) throw new Error('This browser cannot capture a tab or screen. Paste or attach an image instead.');
  const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 1 }, audio: false });
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.srcObject = stream;
  try {
    await new Promise((resolve, reject) => {
      video.onloadedmetadata = resolve;
      video.onerror = () => reject(new Error('Screen capture could not start.'));
      void video.play().catch(reject);
    });
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const canvas = surface(video.videoWidth || 1280, video.videoHeight || 720);
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.86);
  } finally {
    stream.getTracks().forEach(track => track.stop());
    video.srcObject = null;
  }
}

export function createAnnotator(canvas, onChange) {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas rendering is unavailable.');
  let baseImage = null;
  let tool = 'pen';
  let strokes = [];
  let active = null;

  const rectPoint = event => {
    const bounds = canvas.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width)),
      y: Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height)),
    };
  };
  const coords = point => ({ x: point.x * canvas.width, y: point.y * canvas.height });
  const paintStroke = stroke => {
    const points = stroke.points.map(coords);
    if (!points.length) return;
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = stroke.tool === 'highlight' ? 'rgba(248,207,50,0.5)' : '#f04e45';
    ctx.lineWidth = stroke.tool === 'highlight' ? Math.max(14, canvas.width * 0.018) : Math.max(3, canvas.width * 0.003);
    if (stroke.tool === 'circle' || stroke.tool === 'crop') {
      if (points.length > 1) {
        const [a, b] = [points[0], points[points.length - 1]];
        const left = Math.min(a.x, b.x), top = Math.min(a.y, b.y);
        const width = Math.abs(a.x - b.x), height = Math.abs(a.y - b.y);
        if (stroke.tool === 'crop') {
          ctx.setLineDash([10, 7]);
          ctx.strokeRect(left, top, width, height);
        } else {
          ctx.beginPath();
          ctx.ellipse(left + width / 2, top + height / 2, Math.max(1, width / 2), Math.max(1, height / 2), 0, 0, 2 * Math.PI);
          ctx.stroke();
        }
      }
    } else if (stroke.tool === 'underline') {
      if (points.length > 1) {
        const first=points[0],last=points[points.length-1];
        ctx.beginPath();ctx.moveTo(first.x,first.y);ctx.lineTo(last.x,last.y);ctx.stroke();
      }
    } else {
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      points.slice(1).forEach(point => ctx.lineTo(point.x, point.y));
      if (points.length === 1) ctx.lineTo(points[0].x + 0.1, points[0].y);
      ctx.stroke();
      if (stroke.tool === 'arrow' && points.length > 1) {
        const a = points[points.length - 2], b = points[points.length - 1];
        const angle = Math.atan2(b.y - a.y, b.x - a.x);
        const length = Math.max(14, canvas.width * 0.024);
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(b.x - length * Math.cos(angle - 0.55), b.y - length * Math.sin(angle - 0.55));
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(b.x - length * Math.cos(angle + 0.55), b.y - length * Math.sin(angle + 0.55));
        ctx.stroke();
      }
    }
    ctx.restore();
  };
  function render() {
    if (!baseImage) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(baseImage, 0, 0, canvas.width, canvas.height);
    strokes.forEach(paintStroke);
    if (active) paintStroke(active);
  }
  async function load(dataUrl) {
    const picture = new Image();
    await new Promise((resolve, reject) => {
      picture.onload = resolve;
      picture.onerror = () => reject(new Error('Could not open screenshot.'));
      picture.src = dataUrl;
    });
    baseImage = picture;
    canvas.width = picture.naturalWidth;
    canvas.height = picture.naturalHeight;
    strokes = [];
    active = null;
    render();
    onChange?.();
  }
  function pointerDown(e) {
    if (!baseImage) return;
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    active = { tool, points: [rectPoint(e)] };
    render();
  }
  function pointerMove(e) {
    if (!active) return;
    active.points.push(rectPoint(e));
    render();
  }
  function pointerUp(e) {
    if (!active) return;
    if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    active.points.push(rectPoint(e));
    if (active.tool === 'crop' && active.points.length > 1) {
      const a = coords(active.points[0]);
      const b = coords(active.points[active.points.length - 1]);
      const x = Math.floor(Math.min(a.x, b.x));
      const y = Math.floor(Math.min(a.y, b.y));
      const width = Math.round(Math.abs(a.x - b.x));
      const height = Math.round(Math.abs(a.y - b.y));
      if (width > 24 && height > 24) {
        const cropCanvas = surface(width, height);
        cropCanvas.getContext('2d').drawImage(baseImage, x, y, width, height, 0, 0, cropCanvas.width, cropCanvas.height);
        void load(cropCanvas.toDataURL('image/jpeg', 0.85)).then(()=>{ tool='circle';onChange?.('crop') });
      }
    } else {
      strokes.push(active);
      render();
      onChange?.();
    }
    active = null;
    render();
  }
  canvas.style.touchAction = 'none';
  canvas.addEventListener('pointerdown', pointerDown);
  canvas.addEventListener('pointermove', pointerMove);
  canvas.addEventListener('pointerup', pointerUp);
  canvas.addEventListener('pointercancel', pointerUp);
  return {
    load,
    setTool(name) { tool = name; },
    undo() { strokes.pop(); render(); onChange?.(); },
    clear() { strokes = []; render(); onChange?.(); },
    get hasImage() { return Boolean(baseImage); },
    get annotations() { return strokes.map(x => ({ tool: x.tool, points: x.points })); },
    screenshot() { return baseImage ? canvas.toDataURL('image/jpeg', 0.82) : null; },
    destroy() {
      canvas.removeEventListener('pointerdown', pointerDown);
      canvas.removeEventListener('pointermove', pointerMove);
      canvas.removeEventListener('pointerup', pointerUp);
      canvas.removeEventListener('pointercancel', pointerUp);
    },
  };
}
