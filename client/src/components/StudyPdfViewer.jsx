'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Highlighter,
  PenLine,
  Eraser,
  RotateCcw,
  Trash2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';

pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

const STORAGE_PREFIX = 'nptel-study-pdf';
const TOOL_CONFIG = {
  pen: { label: 'Pen', width: 3, alpha: 1 },
  highlighter: { label: 'Highlighter', width: 16, alpha: 0.3 },
};
const COLOR_OPTIONS = ['#2563eb', '#ef4444', '#16a34a', '#f59e0b', '#0f172a'];

const getAnnotationStorageKey = (storageKey) => `${STORAGE_PREFIX}:${storageKey}`;

const normalizePoint = (event, bounds) => ({
  x: (event.clientX - bounds.left) / bounds.width,
  y: (event.clientY - bounds.top) / bounds.height,
});

const distanceToSegment = (point, start, end) => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;

  if (dx === 0 && dy === 0) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }

  const t = Math.max(
    0,
    Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy))
  );
  const projection = {
    x: start.x + t * dx,
    y: start.y + t * dy,
  };

  return Math.hypot(point.x - projection.x, point.y - projection.y);
};

const shouldEraseStroke = (stroke, point) => {
  const threshold = (stroke.width || 3) / 100;
  if (!stroke.points?.length) return false;
  if (stroke.points.length === 1) {
    const single = stroke.points[0];
    return Math.hypot(point.x - single.x, point.y - single.y) <= threshold;
  }

  for (let index = 1; index < stroke.points.length; index += 1) {
    if (distanceToSegment(point, stroke.points[index - 1], stroke.points[index]) <= threshold) {
      return true;
    }
  }

  return false;
};

const drawStroke = (context, stroke, width, height) => {
  if (!stroke?.points?.length) return;

  context.save();
  context.strokeStyle = stroke.color;
  context.globalAlpha = stroke.alpha;
  context.lineWidth = stroke.width;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.beginPath();

  stroke.points.forEach((point, index) => {
    const x = point.x * width;
    const y = point.y * height;
    if (index === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  });

  if (stroke.points.length === 1) {
    const point = stroke.points[0];
    context.lineTo(point.x * width + 0.01, point.y * height + 0.01);
  }

  context.stroke();
  context.restore();
};

export default function StudyPdfViewer({ src, storageKey, title }) {
  const shellRef = useRef(null);
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);

  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [tool, setTool] = useState(null);
  const [color, setColor] = useState(COLOR_OPTIONS[0]);
  const [annotations, setAnnotations] = useState({});
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 });
  const [viewportWidth, setViewportWidth] = useState(0);
  const [error, setError] = useState('');
  const [annotationsReady, setAnnotationsReady] = useState(false);

  const annotationStorageKey = useMemo(
    () => getAnnotationStorageKey(storageKey || src || 'default'),
    [src, storageKey]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const raw = window.localStorage.getItem(annotationStorageKey);
      setAnnotations(raw ? JSON.parse(raw) : {});
    } catch {
      setAnnotations({});
    }
    setAnnotationsReady(true);
  }, [annotationStorageKey]);

  useEffect(() => {
    if (typeof window === 'undefined' || !annotationsReady) return;
    window.localStorage.setItem(annotationStorageKey, JSON.stringify(annotations));
  }, [annotationStorageKey, annotations, annotationsReady]);

  useEffect(() => {
    setCurrentPage(1);
    setZoom(1);
    setError('');
    setPageSize({ width: 0, height: 0 });
    setTool(null);
  }, [src]);

  useEffect(() => {
    const element = shellRef.current;
    if (!element || typeof ResizeObserver === 'undefined') return undefined;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      setViewportWidth(entry.contentRect.width);
    });

    observer.observe(element);
    setViewportWidth(element.getBoundingClientRect().width);

    return () => observer.disconnect();
  }, []);

  const baseWidth = Math.max(320, Math.min((viewportWidth || 960) - 32, 980));
  const renderWidth = Math.round(baseWidth * zoom);
  const renderHeight =
    pageSize.width && pageSize.height
      ? Math.round((pageSize.height / pageSize.width) * renderWidth)
      : 0;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !renderWidth || !renderHeight) return;

    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    canvas.width = renderWidth * dpr;
    canvas.height = renderHeight * dpr;
    canvas.style.width = `${renderWidth}px`;
    canvas.style.height = `${renderHeight}px`;

    const context = canvas.getContext('2d');
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, renderWidth, renderHeight);

    (annotations[currentPage] || []).forEach((stroke) =>
      drawStroke(context, stroke, renderWidth, renderHeight)
    );
  }, [annotations, currentPage, renderHeight, renderWidth]);

  const startStroke = (event) => {
    if (!canvasRef.current || !tool || tool === 'eraser') {
      if (tool !== 'eraser') return;
      const bounds = canvasRef.current.getBoundingClientRect();
      const point = normalizePoint(event, bounds);
      setAnnotations((prev) => ({
        ...prev,
        [currentPage]: (prev[currentPage] || []).filter((stroke) => !shouldEraseStroke(stroke, point)),
      }));
      return;
    }

    const bounds = canvasRef.current.getBoundingClientRect();
    const firstPoint = normalizePoint(event, bounds);
    const config = TOOL_CONFIG[tool];

    drawingRef.current = true;
    setAnnotations((prev) => ({
      ...prev,
      [currentPage]: [
        ...(prev[currentPage] || []),
        {
          color,
          width: config.width,
          alpha: config.alpha,
          points: [firstPoint],
        },
      ],
    }));
  };

  const extendStroke = (event) => {
    if (!canvasRef.current || !drawingRef.current) return;

    const bounds = canvasRef.current.getBoundingClientRect();
    const point = normalizePoint(event, bounds);

    setAnnotations((prev) => {
      const pageStrokes = [...(prev[currentPage] || [])];
      if (!pageStrokes.length) return prev;

      const latestStroke = pageStrokes[pageStrokes.length - 1];
      pageStrokes[pageStrokes.length - 1] = {
        ...latestStroke,
        points: [...latestStroke.points, point],
      };

      return {
        ...prev,
        [currentPage]: pageStrokes,
      };
    });
  };

  const finishStroke = () => {
    drawingRef.current = false;
  };

  const goToPage = (nextPage) => {
    setCurrentPage((current) => {
      const normalized = Math.max(1, Math.min(numPages || 1, nextPage));
      return Number.isFinite(normalized) ? normalized : current;
    });
  };

  const clearCurrentPage = () => {
    setAnnotations((prev) => ({
      ...prev,
      [currentPage]: [],
    }));
  };

  const undoLastStroke = () => {
    setAnnotations((prev) => ({
      ...prev,
      [currentPage]: (prev[currentPage] || []).slice(0, -1),
    }));
  };

  const toggleTool = (toolName) => {
    setTool((current) => (current === toolName ? null : toolName));
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-950 px-4 py-3 text-white">
        <div className="flex flex-wrap items-center gap-2">
          {Object.entries(TOOL_CONFIG).map(([toolName, config]) => {
            const Icon = toolName === 'pen' ? PenLine : Highlighter;
            return (
              <button
                key={toolName}
                onClick={() => toggleTool(toolName)}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition ${
                  tool === toolName
                    ? 'border-blue-400 bg-blue-500/20 text-white'
                    : 'border-white/15 bg-white/5 text-slate-200 hover:bg-white/10'
                }`}
              >
                <Icon size={15} />
                {config.label}
              </button>
            );
          })}

          <button
            onClick={() => toggleTool('eraser')}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition ${
              tool === 'eraser'
                ? 'border-blue-400 bg-blue-500/20 text-white'
                : 'border-white/15 bg-white/5 text-slate-200 hover:bg-white/10'
            }`}
          >
            <Eraser size={15} />
            Eraser
          </button>

          <div className="ml-1 flex items-center gap-2">
            {COLOR_OPTIONS.map((value) => (
              <button
                key={value}
                onClick={() => setColor(value)}
                className={`h-8 w-8 rounded-full border-2 transition ${
                  color === value ? 'border-white scale-110' : 'border-transparent'
                }`}
                style={{ backgroundColor: value }}
                aria-label={`Select ${value} ink color`}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            disabled={currentPage <= 1}
            onClick={() => goToPage(currentPage - 1)}
            className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft size={15} />
            Prev
          </button>

          <div className="rounded-full border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-white">
            {currentPage} / {numPages || 1}
          </div>

          <button
            disabled={currentPage >= numPages}
            onClick={() => goToPage(currentPage + 1)}
            className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
            <ChevronRight size={15} />
          </button>

          <button
            onClick={() => setZoom((current) => Math.max(0.8, Number((current - 0.1).toFixed(1))))}
            className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-200 transition hover:bg-white/10"
          >
            <ZoomOut size={15} />
          </button>

          <div className="rounded-full border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-200">
            {Math.round(zoom * 100)}%
          </div>

          <button
            onClick={() => setZoom((current) => Math.min(2.2, Number((current + 0.1).toFixed(1))))}
            className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-200 transition hover:bg-white/10"
          >
            <ZoomIn size={15} />
          </button>

          <button
            onClick={undoLastStroke}
            className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-200 transition hover:bg-white/10"
          >
            <RotateCcw size={15} />
            Undo
          </button>

          <button
            onClick={clearCurrentPage}
            className="inline-flex items-center gap-1 rounded-full border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-100 transition hover:bg-red-500/20"
          >
            <Trash2 size={15} />
            Clear Page
          </button>
        </div>
      </div>

      <div className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600">
        Basic study tools for {title || 'this PDF'}: pen, highlighter, eraser, page navigation, and zoom. Click the active tool again to return to reading mode.
      </div>

      <div ref={shellRef} className="overflow-auto bg-slate-900/95 px-4 py-5" style={{ height: '82vh', minHeight: '720px' }}>
        <div className="mx-auto w-fit">
          <div
            className="relative overflow-hidden rounded-lg bg-white shadow-2xl"
            style={{
              width: renderWidth || undefined,
              height: renderHeight || undefined,
            }}
          >
            <Document
              file={src}
              loading={<div className="p-10 text-center text-sm text-slate-500">Loading PDF...</div>}
              onLoadSuccess={({ numPages: totalPages }) => {
                setNumPages(totalPages);
                setCurrentPage((current) => Math.min(current, totalPages || 1));
                setError('');
              }}
              onLoadError={(loadError) => {
                console.error(loadError);
                setError('Unable to load this PDF in study mode right now.');
              }}
              error={<div className="p-10 text-center text-sm text-red-600">{error || 'Unable to load this PDF.'}</div>}
            >
              <Page
                pageNumber={currentPage}
                width={renderWidth}
                renderAnnotationLayer={false}
                renderTextLayer={false}
                loading={<div className="p-10 text-center text-sm text-slate-500">Rendering page...</div>}
                onLoadSuccess={(page) => {
                  const viewport = page.getViewport({ scale: 1 });
                  setPageSize({ width: viewport.width, height: viewport.height });
                }}
              />
            </Document>

            {renderWidth && renderHeight ? (
              <canvas
                ref={canvasRef}
                className={`absolute inset-0 touch-none ${
                  tool ? 'pointer-events-auto cursor-crosshair' : 'pointer-events-none cursor-default'
                }`}
                onPointerDown={startStroke}
                onPointerMove={extendStroke}
                onPointerUp={finishStroke}
                onPointerLeave={finishStroke}
                onPointerCancel={finishStroke}
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
