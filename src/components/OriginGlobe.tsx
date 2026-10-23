import React, { useEffect, useRef } from 'react';
import { geoGraticule10, geoOrthographic, geoPath } from 'd3-geo';
import { feature, mesh } from 'topojson-client';
import worldAtlas from 'world-atlas/countries-50m.json';
import { BeanBatch } from '../types';

type GlobeEntry = { id: string; batch: BeanBatch };

type View = { latitude: number; longitude: number };
type ProjectedPoint = { x: number; y: number; depth: number };

type Transition = {
  startedAt: number;
  duration: number;
  fromView: View;
  toView: View;
  fromOrigin: View;
  toOrigin: View;
};

const DEG = Math.PI / 180;
const WORLD = worldAtlas as any;
const LAND = feature(WORLD, WORLD.objects.land) as any;
const COUNTRY_BORDERS = mesh(WORLD, WORLD.objects.countries, (a, b) => a !== b) as any;
const GRATICULE = geoGraticule10();
const SPHERE = { type: 'Sphere' } as const;

function normalizeLongitude(value: number) {
  return ((value + 540) % 360) - 180;
}

function shortestLongitudeTarget(from: number, to: number) {
  return from + normalizeLongitude(to - from);
}

function easeInOutCubic(value: number) {
  return value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2;
}

function toVector(point: View): [number, number, number] {
  const lat = point.latitude * DEG;
  const lon = point.longitude * DEG;
  const cosLat = Math.cos(lat);
  return [cosLat * Math.cos(lon), Math.sin(lat), cosLat * Math.sin(lon)];
}

function vectorToView(vector: [number, number, number]): View {
  const length = Math.hypot(...vector) || 1;
  const [x, y, z] = vector.map((value) => value / length) as [number, number, number];
  return {
    latitude: Math.asin(y) / DEG,
    longitude: Math.atan2(z, x) / DEG,
  };
}

function greatCirclePoint(from: View, to: View, progress: number): View {
  const a = toVector(from);
  const b = toVector(to);
  const dot = Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
  const angle = Math.acos(dot);
  if (angle < 0.0001) return from;
  const sinAngle = Math.sin(angle);
  const weightA = Math.sin((1 - progress) * angle) / sinAngle;
  const weightB = Math.sin(progress * angle) / sinAngle;
  return vectorToView([
    a[0] * weightA + b[0] * weightB,
    a[1] * weightA + b[1] * weightB,
    a[2] * weightA + b[2] * weightB,
  ]);
}

function project(point: View, camera: View, centerX: number, centerY: number, radius: number): ProjectedPoint {
  const lat = point.latitude * DEG;
  const cameraLat = camera.latitude * DEG;
  const deltaLon = normalizeLongitude(point.longitude - camera.longitude) * DEG;
  const cosLat = Math.cos(lat);
  const sinLat = Math.sin(lat);
  const cosCameraLat = Math.cos(cameraLat);
  const sinCameraLat = Math.sin(cameraLat);
  return {
    x: centerX + radius * cosLat * Math.sin(deltaLon),
    y: centerY - radius * (cosCameraLat * sinLat - sinCameraLat * cosLat * Math.cos(deltaLon)),
    depth: sinCameraLat * sinLat + cosCameraLat * cosLat * Math.cos(deltaLon),
  };
}

function createProjection(camera: View, centerX: number, centerY: number, radius: number) {
  return geoOrthographic()
    .translate([centerX, centerY])
    .scale(radius)
    .rotate([-camera.longitude, -camera.latitude, 0])
    .clipAngle(90)
    .precision(0.2);
}

function drawGlobeBase(
  context: CanvasRenderingContext2D,
  camera: View,
  centerX: number,
  centerY: number,
  radius: number,
) {
  const projection = createProjection(camera, centerX, centerY, radius);
  const path = geoPath(projection, context);

  const outerGlow = context.createRadialGradient(centerX, centerY, radius * 0.72, centerX, centerY, radius * 1.34);
  outerGlow.addColorStop(0, 'rgba(43, 133, 103, 0.18)');
  outerGlow.addColorStop(0.68, 'rgba(209, 174, 121, 0.09)');
  outerGlow.addColorStop(1, 'rgba(4, 10, 8, 0)');
  context.fillStyle = outerGlow;
  context.beginPath();
  context.arc(centerX, centerY, radius * 1.34, 0, Math.PI * 2);
  context.fill();

  context.save();
  context.beginPath();
  path(SPHERE);
  context.clip();

  const ocean = context.createRadialGradient(
    centerX - radius * 0.36,
    centerY - radius * 0.42,
    radius * 0.08,
    centerX,
    centerY,
    radius * 1.12,
  );
  ocean.addColorStop(0, '#285d54');
  ocean.addColorStop(0.38, '#123c37');
  ocean.addColorStop(0.74, '#082522');
  ocean.addColorStop(1, '#020a09');
  context.fillStyle = ocean;
  context.beginPath();
  path(SPHERE);
  context.fill();

  context.strokeStyle = 'rgba(176, 222, 205, 0.12)';
  context.lineWidth = 0.55;
  context.beginPath();
  path(GRATICULE);
  context.stroke();

  const land = context.createLinearGradient(
    centerX - radius * 0.78,
    centerY - radius,
    centerX + radius * 0.92,
    centerY + radius,
  );
  land.addColorStop(0, '#8baa83');
  land.addColorStop(0.42, '#668c6f');
  land.addColorStop(1, '#315a4a');
  context.fillStyle = land;
  context.shadowColor = 'rgba(1, 11, 8, 0.72)';
  context.shadowBlur = 9;
  context.shadowOffsetX = 2;
  context.shadowOffsetY = 4;
  context.beginPath();
  path(LAND);
  context.fill();
  context.shadowColor = 'transparent';
  context.shadowBlur = 0;
  context.shadowOffsetX = 0;
  context.shadowOffsetY = 0;

  context.strokeStyle = 'rgba(236, 226, 195, 0.5)';
  context.lineWidth = 0.75;
  context.beginPath();
  path(LAND);
  context.stroke();

  context.strokeStyle = 'rgba(229, 235, 209, 0.2)';
  context.lineWidth = 0.42;
  context.beginPath();
  path(COUNTRY_BORDERS);
  context.stroke();

  const highlight = context.createRadialGradient(
    centerX - radius * 0.42,
    centerY - radius * 0.48,
    0,
    centerX - radius * 0.3,
    centerY - radius * 0.36,
    radius * 1.16,
  );
  highlight.addColorStop(0, 'rgba(237, 255, 245, 0.16)');
  highlight.addColorStop(0.44, 'rgba(134, 203, 178, 0.035)');
  highlight.addColorStop(1, 'rgba(0, 0, 0, 0.62)');
  context.fillStyle = highlight;
  context.beginPath();
  path(SPHERE);
  context.fill();
  context.restore();

  context.strokeStyle = 'rgba(225, 198, 152, 0.52)';
  context.lineWidth = 1;
  context.beginPath();
  context.arc(centerX, centerY, radius + 0.5, 0, Math.PI * 2);
  context.stroke();

  context.strokeStyle = 'rgba(216, 186, 138, 0.12)';
  context.beginPath();
  context.ellipse(centerX, centerY, radius * 1.18, radius * 0.36, -0.24, 0, Math.PI * 2);
  context.stroke();

  const atmosphere = context.createLinearGradient(0, centerY - radius, 0, centerY + radius);
  atmosphere.addColorStop(0, 'rgba(223, 245, 233, 0.36)');
  atmosphere.addColorStop(0.55, 'rgba(182, 222, 199, 0.06)');
  atmosphere.addColorStop(1, 'rgba(226, 185, 125, 0.15)');
  context.strokeStyle = atmosphere;
  context.lineWidth = 2.2;
  context.beginPath();
  context.arc(centerX, centerY, radius + 2, 0, Math.PI * 2);
  context.stroke();
}

interface OriginGlobeProps {
  entries: GlobeEntry[];
  active: BeanBatch;
  onSelect: (id: string) => void;
}

export default function OriginGlobe({ entries, active, onSelect }: OriginGlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number>(0);
  const activeRef = useRef(active);
  const previousActiveRef = useRef(active);
  const viewRef = useRef<View>({ latitude: active.latitude, longitude: active.longitude });
  const transitionRef = useRef<Transition | null>(null);
  const markerHitsRef = useRef<Array<{ id: string; x: number; y: number; radius: number }>>([]);

  useEffect(() => {
    const previous = previousActiveRef.current;
    activeRef.current = active;
    if (previous.id !== active.id) {
      const fromView = viewRef.current;
      transitionRef.current = {
        startedAt: performance.now(),
        duration: 1250,
        fromView,
        toView: {
          latitude: active.latitude,
          longitude: shortestLongitudeTarget(fromView.longitude, active.longitude),
        },
        fromOrigin: { latitude: previous.latitude, longitude: previous.longitude },
        toOrigin: { latitude: active.latitude, longitude: active.longitude },
      };
      previousActiveRef.current = active;
    }
  }, [active]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    let baseCanvas: HTMLCanvasElement | null = null;
    let baseCacheKey = '';

    const draw = (timestamp: number) => {
      const bounds = canvas.getBoundingClientRect();
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2.5);
      const width = Math.max(320, bounds.width);
      const height = Math.max(320, bounds.height);
      if (canvas.width !== Math.round(width * pixelRatio) || canvas.height !== Math.round(height * pixelRatio)) {
        canvas.width = Math.round(width * pixelRatio);
        canvas.height = Math.round(height * pixelRatio);
      }
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.clearRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2;
      const radius = Math.min(width, height) * 0.395;
      const transition = transitionRef.current;
      let transitionProgress = 1;
      if (transition) {
        transitionProgress = Math.min(1, (timestamp - transition.startedAt) / transition.duration);
        const eased = easeInOutCubic(transitionProgress);
        viewRef.current = {
          latitude: transition.fromView.latitude + (transition.toView.latitude - transition.fromView.latitude) * eased,
          longitude: transition.fromView.longitude + (transition.toView.longitude - transition.fromView.longitude) * eased,
        };
        if (transitionProgress >= 1) {
          viewRef.current = { latitude: activeRef.current.latitude, longitude: activeRef.current.longitude };
          transitionRef.current = null;
        }
      }
      const camera = viewRef.current;

      const baseKey = [canvas.width, canvas.height, camera.latitude.toFixed(4), camera.longitude.toFixed(4)].join(':');
      if (!baseCanvas || baseCacheKey !== baseKey) {
        baseCanvas = document.createElement('canvas');
        baseCanvas.width = canvas.width;
        baseCanvas.height = canvas.height;
        const baseContext = baseCanvas.getContext('2d');
        if (baseContext) {
          baseContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
          drawGlobeBase(baseContext, camera, centerX, centerY, radius);
          baseCacheKey = baseKey;
        }
      }
      if (baseCanvas) context.drawImage(baseCanvas, 0, 0, width, height);

      const projection = createProjection(camera, centerX, centerY, radius);
      const path = geoPath(projection, context);

      context.save();
      context.beginPath();
      context.arc(centerX, centerY, radius, 0, Math.PI * 2);
      context.clip();

      if (transition && transitionProgress < 1) {
        const routePoints: View[] = [];
        for (let index = 0; index <= 72; index += 1) routePoints.push(greatCirclePoint(transition.fromOrigin, transition.toOrigin, index / 72));
        const route = {
          type: 'LineString',
          coordinates: routePoints.map((point) => [point.longitude, point.latitude]),
        } as const;
        context.strokeStyle = `rgba(237, 190, 116, ${0.35 + Math.sin(transitionProgress * Math.PI) * 0.45})`;
        context.lineWidth = 1.8;
        context.setLineDash([4, 7]);
        context.beginPath();
        path(route as any);
        context.stroke();
        context.setLineDash([]);

        const traveler = project(greatCirclePoint(transition.fromOrigin, transition.toOrigin, easeInOutCubic(transitionProgress)), camera, centerX, centerY, radius);
        if (traveler.depth > 0) {
          const travelGlow = context.createRadialGradient(traveler.x, traveler.y, 0, traveler.x, traveler.y, 18);
          travelGlow.addColorStop(0, 'rgba(255, 244, 218, 1)');
          travelGlow.addColorStop(0.2, 'rgba(238, 191, 116, .95)');
          travelGlow.addColorStop(1, 'rgba(238, 191, 116, 0)');
          context.fillStyle = travelGlow;
          context.beginPath();
          context.arc(traveler.x, traveler.y, 18, 0, Math.PI * 2);
          context.fill();
        }
      }

      const markerHits: Array<{ id: string; x: number; y: number; radius: number }> = [];
      for (const entry of entries) {
        const point = project(entry.batch, camera, centerX, centerY, radius);
        if (point.depth <= 0.03) continue;
        const isActive = entry.id === activeRef.current.id;
        const pulse = isActive && !transitionRef.current ? 1 + (Math.sin(timestamp / 260) + 1) * 0.18 : 1;
        const markerRadius = (isActive ? 6.5 : 4.2) * (0.72 + point.depth * 0.28) * pulse;
        context.fillStyle = isActive ? 'rgba(238, 191, 116, .18)' : 'rgba(225, 230, 211, .1)';
        context.beginPath();
        context.arc(point.x, point.y, markerRadius * 2.7, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = isActive ? '#f2c47e' : 'rgba(222, 230, 211, .78)';
        context.strokeStyle = isActive ? '#fff6e5' : 'rgba(255,255,255,.55)';
        context.lineWidth = isActive ? 2 : 1;
        context.beginPath();
        context.arc(point.x, point.y, markerRadius, 0, Math.PI * 2);
        context.fill();
        context.stroke();
        markerHits.push({ id: entry.id, x: point.x, y: point.y, radius: 18 });
      }
      markerHitsRef.current = markerHits;
      context.restore();

      frameRef.current = requestAnimationFrame(draw);
    };

    frameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frameRef.current);
  }, [entries]);

  const handlePointer = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const bounds = canvas.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;
    const hit = markerHitsRef.current.find((marker) => Math.hypot(marker.x - x, marker.y - y) <= marker.radius);
    canvas.style.cursor = hit ? 'pointer' : 'grab';
  };

  const handleClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const bounds = canvas.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;
    const hit = markerHitsRef.current.find((marker) => Math.hypot(marker.x - x, marker.y - y) <= marker.radius);
    if (hit) onSelect(hit.id);
  };

  return (
    <div className="origin-globe-shell">
      <canvas
        ref={canvasRef}
        className="origin-globe-canvas"
        onMouseMove={handlePointer}
        onClick={handleClick}
        role="img"
        aria-label={`交互地球，当前定位 ${active.country} ${active.region}`}
      />
      <div className="origin-globe-readout" aria-live="polite">
        <span>LOCATING ORIGIN</span>
        <strong>{active.country} · {active.region}</strong>
      </div>
    </div>
  );
}
