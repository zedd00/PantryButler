import type { ElementType } from '../api/types';

export interface ElementConfig {
  type: ElementType;
  label: string;
  defaultWidth: number;
  defaultHeight: number;
  color: string;
  icon: string;
}

export const ELEMENT_CONFIGS: Record<ElementType, ElementConfig> = {
  upper_cabinet: { type: 'upper_cabinet', label: 'Upper Cabinet', defaultWidth: 120, defaultHeight: 60, color: '#fbbf24', icon: 'file-tray-full-outline' },
  lower_cabinet: { type: 'lower_cabinet', label: 'Lower Cabinet', defaultWidth: 120, defaultHeight: 80, color: '#f59e0b', icon: 'file-tray-outline' },
  countertop: { type: 'countertop', label: 'Countertop', defaultWidth: 200, defaultHeight: 60, color: '#78716c', icon: 'remove-outline' },
  sink: { type: 'sink', label: 'Sink', defaultWidth: 80, defaultHeight: 60, color: '#60a5fa', icon: 'water-outline' },
  stove: { type: 'stove', label: 'Stove', defaultWidth: 80, defaultHeight: 60, color: '#f87171', icon: 'flame-outline' },
  refrigerator: { type: 'refrigerator', label: 'Refrigerator', defaultWidth: 100, defaultHeight: 120, color: '#94a3b8', icon: 'cube-outline' },
  freezer: { type: 'freezer', label: 'Freezer', defaultWidth: 100, defaultHeight: 60, color: '#7dd3fc', icon: 'snow-outline' },
  pantry: { type: 'pantry', label: 'Pantry', defaultWidth: 100, defaultHeight: 120, color: '#fde047', icon: 'grid-outline' },
  table: { type: 'table', label: 'Table', defaultWidth: 150, defaultHeight: 100, color: '#fb923c', icon: 'square-outline' },
  door: { type: 'door', label: 'Door', defaultWidth: 80, defaultHeight: 20, color: '#9ca3af', icon: 'enter-outline' },
  window: { type: 'window', label: 'Window', defaultWidth: 120, defaultHeight: 20, color: '#7dd3fc', icon: 'scan-outline' },
  other: { type: 'other', label: 'Other', defaultWidth: 100, defaultHeight: 100, color: '#c084fc', icon: 'help-circle-outline' },
};

export const ELEMENT_TYPES: ElementType[] = Object.keys(ELEMENT_CONFIGS) as ElementType[];

export function elementLabel(el: { element_type: ElementType; custom_name: string | null }): string {
  return el.custom_name || ELEMENT_CONFIGS[el.element_type]?.label || el.element_type;
}

export function elementColor(el: { element_type: ElementType; custom_color: string | null }): string {
  return el.custom_color || ELEMENT_CONFIGS[el.element_type]?.color || '#cbd5e1';
}
