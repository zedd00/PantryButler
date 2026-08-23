import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { ElementType } from '@/types/types';
import { useTranslation } from 'react-i18next';
import {
  Box,
  DoorOpen,
  Flame,
  Refrigerator,
  Utensils,
  Table,
  SquareDashedBottom,
  LayoutGrid,
  Maximize2,
} from 'lucide-react';

interface ElementConfig {
  type: ElementType;
  labelKey: string;
  icon: React.ReactNode;
  defaultWidth: number;
  defaultHeight: number;
  color: string;
  bgClass: string;
}

export const ELEMENT_CONFIGS: Record<ElementType, ElementConfig> = {
  upper_cabinet: {
    type: 'upper_cabinet',
    labelKey: 'upper_cabinet',
    icon: <Box className="h-5 w-5" />,
    defaultWidth: 120,
    defaultHeight: 60,
    color: '#fbbf24',
    bgClass: 'bg-amber-100 dark:bg-amber-900 border-amber-300 dark:border-amber-700',
  },
  lower_cabinet: {
    type: 'lower_cabinet',
    labelKey: 'lower_cabinet',
    icon: <Box className="h-5 w-5" />,
    defaultWidth: 120,
    defaultHeight: 80,
    color: '#f59e0b',
    bgClass: 'bg-amber-200 dark:bg-amber-800 border-amber-400 dark:border-amber-600',
  },
  countertop: {
    type: 'countertop',
    labelKey: 'countertop',
    icon: <SquareDashedBottom className="h-5 w-5" />,
    defaultWidth: 200,
    defaultHeight: 60,
    color: '#78716c',
    bgClass: 'bg-stone-200 dark:bg-stone-700 border-stone-400 dark:border-stone-600',
  },
  sink: {
    type: 'sink',
    labelKey: 'sink',
    icon: <SquareDashedBottom className="h-5 w-5" />,
    defaultWidth: 80,
    defaultHeight: 60,
    color: '#60a5fa',
    bgClass: 'bg-blue-100 dark:bg-blue-900 border-blue-300 dark:border-blue-700',
  },
  stove: {
    type: 'stove',
    labelKey: 'stove',
    icon: <Flame className="h-5 w-5" />,
    defaultWidth: 80,
    defaultHeight: 60,
    color: '#f87171',
    bgClass: 'bg-red-100 dark:bg-red-900 border-red-300 dark:border-red-700',
  },
  refrigerator: {
    type: 'refrigerator',
    labelKey: 'refrigerator',
    icon: <Refrigerator className="h-5 w-5" />,
    defaultWidth: 100,
    defaultHeight: 120,
    color: '#94a3b8',
    bgClass: 'bg-slate-200 dark:bg-slate-700 border-slate-400 dark:border-slate-600',
  },
  freezer: {
    type: 'freezer',
    labelKey: 'freezer',
    icon: <Refrigerator className="h-5 w-5" />,
    defaultWidth: 100,
    defaultHeight: 60,
    color: '#7dd3fc',
    bgClass: 'bg-sky-200 dark:bg-sky-800 border-sky-400 dark:border-sky-600',
  },
  pantry: {
    type: 'pantry',
    labelKey: 'pantry',
    icon: <LayoutGrid className="h-5 w-5" />,
    defaultWidth: 100,
    defaultHeight: 120,
    color: '#fde047',
    bgClass: 'bg-yellow-100 dark:bg-yellow-900 border-yellow-300 dark:border-yellow-700',
  },
  table: {
    type: 'table',
    labelKey: 'table',
    icon: <Table className="h-5 w-5" />,
    defaultWidth: 150,
    defaultHeight: 100,
    color: '#fb923c',
    bgClass: 'bg-orange-100 dark:bg-orange-900 border-orange-300 dark:border-orange-700',
  },
  door: {
    type: 'door',
    labelKey: 'door',
    icon: <DoorOpen className="h-5 w-5" />,
    defaultWidth: 80,
    defaultHeight: 20,
    color: '#9ca3af',
    bgClass: 'bg-gray-200 dark:bg-gray-700 border-gray-400 dark:border-gray-600',
  },
  window: {
    type: 'window',
    labelKey: 'window',
    icon: <Maximize2 className="h-5 w-5" />,
    defaultWidth: 120,
    defaultHeight: 20,
    color: '#7dd3fc',
    bgClass: 'bg-sky-100 dark:bg-sky-900 border-sky-300 dark:border-sky-700',
  },
  other: {
    type: 'other',
    labelKey: 'other',
    icon: <Utensils className="h-5 w-5" />,
    defaultWidth: 100,
    defaultHeight: 100,
    color: '#c084fc',
    bgClass: 'bg-purple-100 dark:bg-purple-900 border-purple-300 dark:border-purple-700',
  },
};

export default function ElementPalette() {
  const { t } = useTranslation(['kitchen']);

  const handleDragStart = (e: React.DragEvent, config: ElementConfig) => {
    e.dataTransfer.setData('elementType', config.type);
    e.dataTransfer.setData('elementWidth', config.defaultWidth.toString());
    e.dataTransfer.setData('elementHeight', config.defaultHeight.toString());
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <Card className="h-full rounded-none border-0 shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{t('kitchen:kitchenElements')}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[calc(100vh-12rem)]">
          <div className="px-4 pb-4 space-y-2">
            {Object.values(ELEMENT_CONFIGS).map((config) => (
              <div
                key={config.type}
                draggable
                onDragStart={(e) => handleDragStart(e, config)}
                className={`
                  flex items-center gap-3 p-3 rounded border-2 cursor-move
                  transition-all hover:shadow-md hover:scale-105
                  ${config.bgClass}
                `}
              >
                <div className="shrink-0 text-foreground">{config.icon}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate text-foreground">{t('kitchen:elements.' + config.labelKey)}</p>
                  <p className="text-xs text-muted-foreground">
                    {config.defaultWidth} × {config.defaultHeight}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
