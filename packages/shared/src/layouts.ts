import { z } from 'zod';

export interface FractionalRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type ObsRole = 'matchVideo' | 'cam1' | 'cam2';
export const OBS_LAYOUT_IDS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'] as const;
export const LayoutPresetIdSchema = z.enum(OBS_LAYOUT_IDS);
export type LayoutPresetId = z.infer<typeof LayoutPresetIdSchema>;

export interface LayoutPreset {
  id: LayoutPresetId;
  name: string;
  roles: Partial<Record<ObsRole, FractionalRect>>;
}

export const OBS_LAYOUT_PRESETS: LayoutPreset[] = [
  {
    id: 'A',
    name: 'Video centre, stats left',
    roles: {
      matchVideo: { x: 0.24, y: 0.16, width: 0.52, height: 0.68 },
      cam1: { x: 0.79, y: 0.68, width: 0.17, height: 0.24 },
      cam2: { x: 0.79, y: 0.42, width: 0.17, height: 0.24 },
    },
  },
  {
    id: 'B',
    name: 'Video centre, stats right',
    roles: {
      matchVideo: { x: 0.24, y: 0.16, width: 0.52, height: 0.68 },
      cam1: { x: 0.04, y: 0.68, width: 0.17, height: 0.24 },
      cam2: { x: 0.04, y: 0.42, width: 0.17, height: 0.24 },
    },
  },
  {
    id: 'C',
    name: 'Large video left',
    roles: {
      matchVideo: { x: 0.04, y: 0.16, width: 0.62, height: 0.68 },
      cam1: { x: 0.7, y: 0.56, width: 0.26, height: 0.28 },
      cam2: { x: 0.7, y: 0.22, width: 0.26, height: 0.28 },
    },
  },
  {
    id: 'D',
    name: 'Large video right',
    roles: {
      matchVideo: { x: 0.34, y: 0.16, width: 0.62, height: 0.68 },
      cam1: { x: 0.04, y: 0.56, width: 0.26, height: 0.28 },
      cam2: { x: 0.04, y: 0.22, width: 0.26, height: 0.28 },
    },
  },
  {
    id: 'E',
    name: 'Streamer spotlight',
    roles: {
      matchVideo: { x: 0.2, y: 0.34, width: 0.6, height: 0.5 },
      cam1: { x: 0.04, y: 0.18, width: 0.24, height: 0.24 },
      cam2: { x: 0.72, y: 0.18, width: 0.24, height: 0.24 },
    },
  },
  {
    id: 'F',
    name: 'Boundary lounge',
    roles: {
      matchVideo: { x: 0.04, y: 0.14, width: 0.92, height: 0.66 },
      cam1: { x: 0.04, y: 0.68, width: 0.25, height: 0.24 },
      cam2: { x: 0.71, y: 0.68, width: 0.25, height: 0.24 },
    },
  },
  {
    id: 'G',
    name: 'Split-screen hosts',
    roles: {
      matchVideo: { x: 0.04, y: 0.16, width: 0.58, height: 0.68 },
      cam1: { x: 0.66, y: 0.16, width: 0.3, height: 0.3 },
      cam2: { x: 0.66, y: 0.54, width: 0.3, height: 0.3 },
    },
  },
  {
    id: 'H',
    name: 'Vertical match panel',
    roles: {
      matchVideo: { x: 0.32, y: 0.12, width: 0.64, height: 0.76 },
      cam1: { x: 0.04, y: 0.18, width: 0.22, height: 0.3 },
      cam2: { x: 0.04, y: 0.54, width: 0.22, height: 0.3 },
    },
  },
  {
    id: 'I',
    name: 'Top desk, wide replay',
    roles: {
      matchVideo: { x: 0.04, y: 0.28, width: 0.92, height: 0.62 },
      cam1: { x: 0.04, y: 0.06, width: 0.22, height: 0.18 },
      cam2: { x: 0.74, y: 0.06, width: 0.22, height: 0.18 },
    },
  },
  {
    id: 'J',
    name: 'Match with camera rail',
    roles: {
      matchVideo: { x: 0.04, y: 0.16, width: 0.68, height: 0.68 },
      cam1: { x: 0.76, y: 0.16, width: 0.2, height: 0.3 },
      cam2: { x: 0.76, y: 0.54, width: 0.2, height: 0.3 },
    },
  },
];

export const obsRectPixels = (rect: FractionalRect, width: number, height: number) => ({
  x: Math.round(rect.x * width),
  y: Math.round(rect.y * height),
  width: Math.round(rect.width * width),
  height: Math.round(rect.height * height),
});