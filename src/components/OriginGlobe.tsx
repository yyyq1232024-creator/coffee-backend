import React, { useEffect, useRef } from 'react';
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

const CONTINENTS: Array<Array<[number, number]>> = [
  [[-168, 68], [-150, 58], [-132, 55], [-124, 44], [-118, 32], [-103, 19], [-88, 18], [-81, 25], [-65, 44], [-54, 52], [-72, 60], [-97, 70], [-130, 72]],
  [[-81, 12], [-70, 7], [-52, 4], [-35, -8], [-46, -25], [-57, -40], [-70, -55], [-76, -30]],
  [[-18, 35], [-5, 48], [16, 58], [38, 55], [48, 43], [34, 32], [43, 12], [33, -6], [19, -35], [5, -34], [-8, -12]],
  [[-10, 36], [-8, 51], [6, 59], [25, 70], [60, 72], [95, 75], [140, 62], [165, 54], [145, 38], [118, 22], [105, 6], [82, 10], [68, 24], [45, 32], [28, 39]],
  [[112, -12], [132, -10], [151, -24], [146, -39], [122, -35], [113, -24]],
  [[-52, 60], [-42, 70], [-28, 76], [-40, 83], [-62, 78], [-72, 67]],
  [[43, -13], [50, -16], [49, -26], [45, -24]],
];

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

function drawGeoLine(
  context: CanvasRenderingContext2D,
  points: View[],
  camera: View,
  centerX: number,
  centerY: number,
  radius: number
) {
  let drawing = false;
  for (const point of points) {
    const projected = project(point, camera, centerX, centerY, radius);
    if (projected.depth <= 0.015) {
      drawing = false;
      continue;
    }
    if (!drawing) context.moveTo(projected.x, projected.y);
    else context.lineTo(projected.x, projected.y);
    drawing = true;
  }
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

    const draw = (timestamp: number) => {
      const bounds = canvas.getBoundingClientRect();
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
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

      const outerGlow = context.createRadialGradient(centerX, centerY, radius * 0.72, centerX, centerY, radius * 1.34);
      outerGlow.addColorStop(0, 'rgba(43, 133, 103, 0.16)');
      outerGlow.addColorStop(0.65, 'rgba(209, 174, 121, 0.08)');
      outerGlow.addColorStop(1, 'rgba(4, 10, 8, 0)');
      context.fillStyle = outerGlow;
      context.beginPath();
      context.arc(centerX, centerY, radius * 1.34, 0, Math.PI * 2);
      context.fill();

      context.save();
      context.beginPath();
      context.arc(centerX, centerY, radius, 0, Math.PI * 2);
      context.clip();

      const ocean = context.createRadialGradient(centerX - radius * 0.36, centerY - radius * 0.42, radius * 0.08, centerX, centerY, radius * 1.1);
      ocean.addColorStop(0, '#214f48');
      ocean.addColorStop(0.46, '#0c2d2a');
      ocean.addColorStop(0.78, '#071b1b');
      ocean.addColorStop(1, '#020808');
      context.fillStyle = ocean;
      context.fillRect(centerX - radius, centerY - radius, radius * 2, radius * 2);

      context.lineWidth = 0.7;
      context.strokeStyle = 'rgba(170, 215, 199, 0.14)';
      for (let latitude = -60; latitude <= 60; latitude += 20) {
        const points: View[] = [];
        for (let longitude = -180; longitude <= 180; longitude += 3) points.push({ latitude, longitude });
        context.beginPath();
        drawGeoLine(context, points, camera, centerX, centerY, radius);
        context.stroke();
      }
      for (let longitude = -180; longitude < 180; longitude += 20) {
        const points: View[] = [];
        for (let latitude = -89; latitude <= 89; latitude += 3) points.push({ latitude, longitude });
        context.beginPath();
        drawGeoLine(context, points, camera, centerX, centerY, radius);
        context.stroke();
      }

      for (const polygon of CONTINENTS) {
        const visiblePoints = polygon
          .map(([longitude, latitude]) => project({ latitude, longitude }, camera, centerX, centerY, radius))
          .filter((point) => point.depth > -0.05);
        if (visiblePoints.length < 3) continue;
        context.beginPath();
        visiblePoints.forEach((point, index) => index === 0 ? context.moveTo(point.x, point.y) : context.lineTo(point.x, point.y));
        context.closePath();
        const land = context.createLinearGradient(centerX - radius, centerY - radius, centerX + radius, centerY + radius);
        land.addColorStop(0, 'rgba(103, 151, 122, 0.82)');
        land.addColorStop(1, 'rgba(45, 87, 68, 0.72)');
        context.fillStyle = land;
        context.strokeStyle = 'rgba(210, 223, 194, 0.32)';
        context.lineWidth = 0.8;
        context.fill();
        context.stroke();
      }

      const shade = context.createLinearGradient(centerX - radius, centerY, centerX + radius, centerY);
      shade.addColorStop(0, 'rgba(222, 247, 232, 0.09)');
      shade.addColorStop(0.46, 'rgba(0, 0, 0, 0)');
      shade.addColorStop(1, 'rgba(0, 0, 0, 0.62)');
      context.fillStyle = shade;
      context.fillRect(centerX - radius, centerY - radius, radius * 2, radius * 2);

      if (transition && transitionProgress < 1) {
        context.beginPath();
        const routePoints: View[] = [];
        for (let index = 0; index <= 72; index += 1) routePoints.push(greatCirclePoint(transition.fromOrigin, transition.toOrigin, index / 72));
        drawGeoLine(context, routePoints, camera, centerX, centerY, radius);
        context.strokeStyle = `rgba(237, 190, 116, ${0.35 + Math.sin(transitionProgress * Math.PI) * 0.45})`;
        context.lineWidth = 1.8;
        context.setLineDash([4, 7]);
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

      context.strokeStyle = 'rgba(216, 186, 138, 0.44)';
      context.lineWidth = 1;
      context.beginPath();
      context.arc(centerX, centerY, radius + 0.5, 0, Math.PI * 2);
      context.stroke();
      context.strokeStyle = 'rgba(216, 186, 138, 0.12)';
      context.beginPath();
      context.ellipse(centerX, centerY, radius * 1.18, radius * 0.36, -0.24, 0, Math.PI * 2);
      context.stroke();

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
