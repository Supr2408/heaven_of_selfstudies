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

export default function StudyPdfViewer({ src, storageKey, onLoadError = null }) {
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
  const [useNativeViewer, setUseNativeViewer] = useState(false);

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
    setUseNativeViewer(false);
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

  const isCompactViewport = (viewportWidth || 0) > 0 && viewportWidth < 640;
  const editorEnabled = !isCompactViewport;
  const mobileReadingZoom = isCompactViewport ? 1.35 : 1;
  const baseWidth = isCompactViewport
    ? Math.max(340, (viewportWidth || 360) - 8)
    : Math.max(320, Math.min((viewportWidth || 960) - 32, 980));
  const effectiveZoom = editorEnabled ? zoom : mobileReadingZoom;
  const renderWidth = Math.round(baseWidth * effectiveZoom);
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
    if (!editorEnabled) return;

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
    if (!editorEnabled) return;
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
    if (!editorEnabled) return;
    setTool((current) => (current === toolName ? null : toolName));
  };

  const panelGroupClass =
    'inline-flex flex-wrap items-center gap-2 rounded-[1.2rem] border border-white/10 bg-white/[0.04] p-1.5';
  const quietButtonClass =
    'inline-flex h-10 items-center justify-center gap-2 rounded-full border px-4 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40';
  const activeToolClass = 'border-blue-400 bg-blue-500/20 text-white';
  const inactiveToolClass = 'border-white/15 bg-white/5 text-slate-200 hover:bg-white/10';

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-800 bg-slate-950 px-2.5 py-2.5 text-white sm:px-4 sm:py-3">
        <div className="flex flex-col gap-3">
          {editorEnabled ? (
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className={`${panelGroupClass} max-w-full`}>
                {Object.entries(TOOL_CONFIG).map(([toolName, config]) => {
                  const Icon = toolName === 'pen' ? PenLine : Highlighter;
                  return (
                    <button
                      key={toolName}
                      onClick={() => toggleTool(toolName)}
                      className={`${quietButtonClass} ${
                        tool === toolName ? activeToolClass : inactiveToolClass
                      }`}
                    >
                      <Icon size={15} />
                      {config.label}
                    </button>
                  );
                })}

                <button
                  onClick={() => toggleTool('eraser')}
                  className={`${quietButtonClass} ${
                    tool === 'eraser' ? activeToolClass : inactiveToolClass
                  }`}
                >
                  <Eraser size={15} />
                  Eraser
                </button>
              </div>

              <div className={`${panelGroupClass} self-start lg:justify-end`}>
                {COLOR_OPTIONS.map((value) => (
                  <button
                    key={value}
                    onClick={() => setColor(value)}
                    className={`h-10 w-10 rounded-full border-2 transition ${
                      color === value ? 'scale-110 border-white shadow-[0_0_0_2px_rgba(15,23,42,0.45)]' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: value }}
                    aria-label={`Select ${value} ink color`}
                  />
                ))}
              </div>
            </div>
          ) : null}

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className={`${panelGroupClass} self-start`}>
              <button
                disabled={currentPage <= 1}
                onClick={() => goToPage(currentPage - 1)}
                className={quietButtonClass}
              >
                <ChevronLeft size={15} />
                <span className={isCompactViewport ? 'hidden' : 'inline'}>Prev</span>
              </button>

              <div className="inline-flex h-10 min-w-[4.5rem] items-center justify-center rounded-full border border-white/15 bg-white/5 px-4 text-sm font-semibold text-white">
                {currentPage} / {numPages || 1}
              </div>

              <button
                disabled={currentPage >= numPages}
                onClick={() => goToPage(currentPage + 1)}
                className={quietButtonClass}
              >
                <span className={isCompactViewport ? 'hidden' : 'inline'}>Next</span>
                <ChevronRight size={15} />
              </button>
            </div>

            {editorEnabled ? (
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-end">
                <div className={`${panelGroupClass} self-start`}>
                  <button
                    onClick={() => setZoom((current) => Math.max(0.8, Number((current - 0.1).toFixed(1))))}
                    className={quietButtonClass}
                    aria-label="Zoom out"
                  >
                    <ZoomOut size={15} />
                  </button>

                  <div className="inline-flex h-10 min-w-[4.5rem] items-center justify-center rounded-full border border-white/15 bg-white/5 px-4 text-sm text-slate-200">
                    {Math.round(zoom * 100)}%
                  </div>

                  <button
                    onClick={() => setZoom((current) => Math.min(2.2, Number((current + 0.1).toFixed(1))))}
                    className={quietButtonClass}
                    aria-label="Zoom in"
                  >
                    <ZoomIn size={15} />
                  </button>
                </div>

                <div className={`${panelGroupClass} self-start`}>
                  <button
                    onClick={undoLastStroke}
                    className={quietButtonClass}
                  >
                    <RotateCcw size={15} />
                    {!isCompactViewport ? 'Undo' : null}
                  </button>

                  <button
                    onClick={clearCurrentPage}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-red-400/40 bg-red-500/10 px-4 text-sm font-medium text-red-100 transition hover:bg-red-500/20"
                  >
                    <Trash2 size={15} />
                    {!isCompactViewport ? 'Clear Page' : null}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div
        ref={shellRef}
        className="overflow-auto bg-slate-900/95 px-1 py-2 sm:px-4 sm:py-5"
        style={{
          height: isCompactViewport ? 'calc(100dvh - 11rem)' : '82vh',
          minHeight: isCompactViewport ? '420px' : '720px',
        }}
      >
        <div className="mx-auto w-fit">
          <div
            className="relative overflow-hidden rounded-lg bg-white shadow-2xl"
            style={{
              width: renderWidth || undefined,
              height: renderHeight || undefined,
            }}
          >
            {useNativeViewer ? (
              <iframe
                title="PDF preview"
                src={src}
                className="h-full w-full border-0"
                style={{ minHeight: renderHeight || '70vh' }}
              />
            ) : (
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
                  setUseNativeViewer(true);
                  if (typeof onLoadError === 'function') {
                    onLoadError(loadError);
                  }
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
            )}

            {editorEnabled && renderWidth && renderHeight && !useNativeViewer ? (
              <canvas
                ref={canvasRef}
                className={`absolute inset-0 touch-none ${
                  editorEnabled && tool
                    ? 'pointer-events-auto cursor-crosshair'
                    : 'pointer-events-none cursor-default'
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
