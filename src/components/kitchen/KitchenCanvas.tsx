import { useEffect, useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
} from '@/components/ui/context-menu';
import { Edit, Trash2, Plus, Layers, X } from 'lucide-react';
import {
  getKitchenElements,
  createKitchenElement,
  updateKitchenElement,
  deleteKitchenElement,
  getElementPlacements,
  createElementPlacement,
} from '@/api';
import type {
  KitchenModel,
  KitchenElement,
  PantryItem,
  Equipment,
  ElementType,
  Shelf,
  ElementItemPlacement,
} from '@/types/types';
import { toast } from 'sonner';
import { ELEMENT_CONFIGS } from './ElementPalette';
import { useTranslation } from 'react-i18next';

interface KitchenCanvasProps {
  model: KitchenModel;
  mode: 'edit' | 'pantry';
  ingredients?: PantryItem[];
  equipment?: Equipment[];
}

interface DragState {
  elementId: string;
  startX: number;
  startY: number;
  initialElementX: number;
  initialElementY: number;
}

interface ResizeState {
  elementId: string;
  handle: 'se' | 'sw' | 'ne' | 'nw' | 'e' | 'w' | 'n' | 's';
  startX: number;
  startY: number;
  initialWidth: number;
  initialHeight: number;
  initialX: number;
  initialY: number;
}

interface ElementWithPlacements extends KitchenElement {
  placements?: ElementItemPlacement[];
  items?: (PantryItem | Equipment)[];
}

const SNAP_THRESHOLD = 15;
const MIN_ELEMENT_SIZE = 40;

export default function KitchenCanvas({ model, mode, ingredients = [], equipment = [] }: KitchenCanvasProps) {
  const { t } = useTranslation(['kitchen', 'common']);
  const [elements, setElements] = useState<ElementWithPlacements[]>([]);
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [resizeState, setResizeState] = useState<ResizeState | null>(null);
  const [canvasScale, setCanvasScale] = useState(1);
  const canvasRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [shelvesDialogOpen, setShelvesDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editingElement, setEditingElement] = useState<ElementWithPlacements | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingColor, setEditingColor] = useState('');
  const [editingShelves, setEditingShelves] = useState<Shelf[]>([]);
  const [viewingElement, setViewingElement] = useState<ElementWithPlacements | null>(null);

  useEffect(() => {
    loadElements();
  }, [model.id]);

  useEffect(() => {
    updateCanvasScale();
    window.addEventListener('resize', updateCanvasScale);
    return () => window.removeEventListener('resize', updateCanvasScale);
  }, [model.canvas_width, model.canvas_height]);

  const updateCanvasScale = () => {
    if (!canvasRef.current) return;
    
    const container = canvasRef.current.parentElement;
    if (!container) return;

    const containerWidth = container.clientWidth - 32;
    const containerHeight = container.clientHeight - 32;
    
    const scaleX = containerWidth / model.canvas_width;
    const scaleY = containerHeight / model.canvas_height;
    
    // Prioritize fitting to width, but don't exceed container height
    const scale = Math.min(scaleX, scaleY);
    setCanvasScale(scale);
  };

  const loadElements = async () => {
    try {
      const data = await getKitchenElements(model.id);
      
      if (mode === 'pantry') {
        const elementsWithPlacements = await Promise.all(
          data.map(async (element) => {
            const placements = await getElementPlacements(element.id);
            const items = placements.map(p => {
              if (p.item_type === 'ingredient') {
                return ingredients.find(i => i.id === p.item_id);
              } else {
                return equipment.find(e => e.id === p.item_id);
              }
            }).filter(Boolean) as (PantryItem | Equipment)[];
            
            return { ...element, placements, items };
          })
        );
        setElements(elementsWithPlacements);
      } else {
        setElements(data);
      }
    } catch (error: any) {
      toast.error(t('kitchen:loadError', { message: error.message }));
    }
  };

  const snapToGrid = (value: number, gridSize: number = 10): number => {
    return Math.round(value / gridSize) * gridSize;
  };

  const snapToElements = (x: number, y: number, width: number, height: number, excludeId: string) => {
    let snappedX = x;
    let snappedY = y;

    for (const element of elements) {
      if (element.id === excludeId) continue;

      // Snap to edges
      if (Math.abs(x - element.x) < SNAP_THRESHOLD) snappedX = element.x;
      if (Math.abs(x + width - element.x) < SNAP_THRESHOLD) snappedX = element.x - width;
      if (Math.abs(x - (element.x + element.width)) < SNAP_THRESHOLD) snappedX = element.x + element.width;
      if (Math.abs(x + width - (element.x + element.width)) < SNAP_THRESHOLD) snappedX = element.x + element.width - width;

      if (Math.abs(y - element.y) < SNAP_THRESHOLD) snappedY = element.y;
      if (Math.abs(y + height - element.y) < SNAP_THRESHOLD) snappedY = element.y - height;
      if (Math.abs(y - (element.y + element.height)) < SNAP_THRESHOLD) snappedY = element.y + element.height;
      if (Math.abs(y + height - (element.y + element.height)) < SNAP_THRESHOLD) snappedY = element.y + element.height - height;
    }

    return { x: snappedX, y: snappedY };
  };

  const constrainToCanvas = (x: number, y: number, width: number, height: number) => {
    const constrainedX = Math.max(0, Math.min(x, model.canvas_width - width));
    const constrainedY = Math.max(0, Math.min(y, model.canvas_height - height));
    return { x: constrainedX, y: constrainedY };
  };

  const handleCanvasDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    
    const elementType = e.dataTransfer.getData('elementType') as ElementType;
    const itemType = e.dataTransfer.getData('itemType');
    
    if (elementType && mode === 'edit') {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const x = (e.clientX - rect.left) / canvasScale;
      const y = (e.clientX - rect.top) / canvasScale;
      
      const config = ELEMENT_CONFIGS[elementType];
      if (!config) return;
      
      const oneThirdHeight = Math.round(model.canvas_height / 3);
      const halfHeight = Math.round(model.canvas_height / 2);
      const fullHeight = model.canvas_height;
      
      let height = config.defaultHeight;
      if (['upper_cabinet', 'lower_cabinet', 'countertop', 'sink', 'stove'].includes(elementType)) {
        height = oneThirdHeight;
      } else if (['door'].includes(elementType)) {
        height = fullHeight;
      } else if (['refrigerator', 'freezer'].includes(elementType)) {
        height = halfHeight;
      }

      const snapped = Math.round(snapToGrid(x, 10));
      const snappedY = Math.round(snapToGrid(y, 10));
      const constrained = constrainToCanvas(snapped, snappedY, config.defaultWidth, height);

      try {
        const newElement = await createKitchenElement({
          model_id: model.id,
          element_type: elementType,
          x: Math.round(constrained.x),
          y: Math.round(constrained.y),
          width: Math.round(config.defaultWidth),
          height: Math.round(height),
          rotation: 0,
        });
        
        setElements([...elements, newElement]);
        toast.success(t('kitchen:elementAdded'));
      } catch (error: any) {
        toast.error(t('kitchen:elementAddError', { message: error.message }));
      }
    } else if (itemType && mode === 'pantry') {
      // Handle item drop in pantry mode
      const itemId = e.dataTransfer.getData('itemId');
      const targetElementId = (e.target as HTMLElement).closest('[data-element-id]')?.getAttribute('data-element-id');
      
      if (targetElementId && itemId) {
        try {
          await createElementPlacement(
            targetElementId,
            itemType as 'ingredient' | 'equipment',
            itemId
          );
          await loadElements();
          const itemName = itemType === 'ingredient'
            ? ingredients.find(i => i.id === itemId)?.ingredient_name
            : equipment.find(eq => eq.id === itemId)?.name;
          toast.success(t('kitchen:itemPlaced', { name: itemName || itemId }));
        } catch (error: any) {
          toast.error(t('kitchen:itemPlaceError', { message: error.message }));
        }
      }
    }
  };

  const handleElementMouseDown = (e: React.MouseEvent, elementId: string) => {
    if (mode !== 'edit') return;
    if ((e.target as HTMLElement).classList.contains('resize-handle')) return;
    
    e.stopPropagation();
    
    const element = elements.find(el => el.id === elementId);
    if (!element) return;

    setDragState({
      elementId,
      startX: e.clientX,
      startY: e.clientY,
      initialElementX: element.x,
      initialElementY: element.y,
    });
    setSelectedElement(elementId);
  };

  const handleResizeMouseDown = (e: React.MouseEvent, elementId: string, handle: ResizeState['handle']) => {
    if (mode !== 'edit') return;
    e.stopPropagation();
    
    const element = elements.find(el => el.id === elementId);
    if (!element) return;

    setResizeState({
      elementId,
      handle,
      startX: e.clientX,
      startY: e.clientY,
      initialWidth: element.width,
      initialHeight: element.height,
      initialX: element.x,
      initialY: element.y,
    });
    setSelectedElement(elementId);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    // Cancel any pending animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    // Use requestAnimationFrame for smooth updates
    animationFrameRef.current = requestAnimationFrame(() => {
      if (dragState) {
        const element = elements.find(el => el.id === dragState.elementId);
        if (!element) return;

        const dx = (e.clientX - dragState.startX) / canvasScale;
        const dy = (e.clientY - dragState.startY) / canvasScale;

        let newX = dragState.initialElementX + dx;
        let newY = dragState.initialElementY + dy;

        const snapped = snapToElements(newX, newY, element.width, element.height, element.id);
        const constrained = constrainToCanvas(snapped.x, snapped.y, element.width, element.height);

        setElements(elements.map(el =>
          el.id === dragState.elementId
            ? { ...el, x: constrained.x, y: constrained.y }
            : el
        ));
      } else if (resizeState) {
        const element = elements.find(el => el.id === resizeState.elementId);
        if (!element) return;

        const dx = (e.clientX - resizeState.startX) / canvasScale;
        const dy = (e.clientY - resizeState.startY) / canvasScale;

        let newWidth = resizeState.initialWidth;
        let newHeight = resizeState.initialHeight;
        let newX = resizeState.initialX;
        let newY = resizeState.initialY;

        if (resizeState.handle.includes('e')) newWidth = Math.max(MIN_ELEMENT_SIZE, resizeState.initialWidth + dx);
        if (resizeState.handle.includes('w')) {
          newWidth = Math.max(MIN_ELEMENT_SIZE, resizeState.initialWidth - dx);
          newX = resizeState.initialX + (resizeState.initialWidth - newWidth);
        }
        if (resizeState.handle.includes('s')) newHeight = Math.max(MIN_ELEMENT_SIZE, resizeState.initialHeight + dy);
        if (resizeState.handle.includes('n')) {
          newHeight = Math.max(MIN_ELEMENT_SIZE, resizeState.initialHeight - dy);
          newY = resizeState.initialY + (resizeState.initialHeight - newHeight);
        }

        // Apply snapping to resize edges
        const snapped = snapToElements(newX, newY, newWidth, newHeight, element.id);
        const constrained = constrainToCanvas(snapped.x, snapped.y, newWidth, newHeight);

        setElements(elements.map(el =>
          el.id === resizeState.elementId
            ? { ...el, x: constrained.x, y: constrained.y, width: newWidth, height: newHeight }
            : el
        ));
      }
    });
  }, [dragState, resizeState, elements, canvasScale, model.canvas_width, model.canvas_height]);

  const handleMouseUp = useCallback(async () => {
    if (dragState) {
      const element = elements.find(el => el.id === dragState.elementId);
      if (element) {
        try {
          await updateKitchenElement(element.id, {
            x: Math.round(element.x),
            y: Math.round(element.y),
          });
        } catch (error: any) {
          toast.error(t('kitchen:updatePositionError', { message: error.message }));
        }
      }
      setDragState(null);
    } else if (resizeState) {
      const element = elements.find(el => el.id === resizeState.elementId);
      if (element) {
        try {
          await updateKitchenElement(element.id, {
            x: Math.round(element.x),
            y: Math.round(element.y),
            width: Math.round(element.width),
            height: Math.round(element.height),
          });
        } catch (error: any) {
          toast.error(t('kitchen:kitchenCanvas.updateSizeError', { message: error.message }));
        }
      }
      setResizeState(null);
    }
  }, [dragState, resizeState, elements]);

  useEffect(() => {
    if (dragState || resizeState) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
        // Cancel any pending animation frame on cleanup
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      };
    }
  }, [dragState, resizeState, handleMouseMove, handleMouseUp]);

  // Keyboard delete support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input, textarea, or dialog is open
      const target = e.target as HTMLElement;
      const isInputField = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      const isDialogOpen = editDialogOpen || shelvesDialogOpen || viewDialogOpen;
      
      if (mode === 'edit' && selectedElement && (e.key === 'Delete' || e.key === 'Backspace') && !isInputField && !isDialogOpen) {
        e.preventDefault();
        handleDeleteElement(selectedElement);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, selectedElement, editDialogOpen, shelvesDialogOpen, viewDialogOpen]);

  const handleElementClick = (element: ElementWithPlacements) => {
    if (mode === 'pantry') {
      setViewingElement(element);
      setViewDialogOpen(true);
    }
  };

  const openEditDialog = (element: ElementWithPlacements) => {
    setEditingElement(element);
    setEditingName(element.custom_name || '');
    setEditingColor(element.custom_color || '');
    setEditDialogOpen(true);
  };

  const openShelvesDialog = (element: ElementWithPlacements) => {
    setEditingElement(element);
    setEditingShelves(element.shelves || []);
    setShelvesDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingElement) return;

    try {
      await updateKitchenElement(editingElement.id, {
        custom_name: editingName || null,
        custom_color: editingColor || null,
      });
      
      setElements(elements.map(el =>
        el.id === editingElement.id
          ? { ...el, custom_name: editingName || null, custom_color: editingColor || null }
          : el
      ));
      
      setEditDialogOpen(false);
      toast.success(t('kitchen:kitchenCanvas.elementUpdated'));
    } catch (error: any) {
      toast.error(t('kitchen:kitchenCanvas.elementUpdateError', { message: error.message }));
    }
  };

  const handleSaveShelves = async () => {
    if (!editingElement) return;

    try {
      await updateKitchenElement(editingElement.id, {
        shelves: editingShelves,
      });
      
      setElements(elements.map(el =>
        el.id === editingElement.id
          ? { ...el, shelves: editingShelves }
          : el
      ));
      
      setShelvesDialogOpen(false);
      toast.success(t('kitchen:kitchenCanvas.shelvesUpdated'));
    } catch (error: any) {
      toast.error(t('kitchen:kitchenCanvas.shelvesUpdateError', { message: error.message }));
    }
  };

  const handleDeleteElement = async (elementId: string) => {
    try {
      await deleteKitchenElement(elementId);
      setElements(elements.filter(el => el.id !== elementId));
      toast.success(t('kitchen:elementDeleted'));
    } catch (error: any) {
      toast.error(t('kitchen:elementDeleteError', { message: error.message }));
    }
  };

  const addShelf = () => {
    const newShelfCount = editingShelves.length + 1;
    const heightPerShelf = Math.round(100 / newShelfCount);
    
    // Recalculate all shelf heights to distribute evenly
    const updatedShelves = editingShelves.map((shelf) => ({
      ...shelf,
      height_percent: heightPerShelf,
    }));
    
    setEditingShelves([...updatedShelves, { name: `Shelf ${newShelfCount}`, height_percent: heightPerShelf }]);
  };

  const removeShelf = (index: number) => {
    const updatedShelves = editingShelves.filter((_, i) => i !== index);
    
    // Recalculate heights for remaining shelves
    if (updatedShelves.length > 0) {
      const heightPerShelf = Math.round(100 / updatedShelves.length);
      setEditingShelves(updatedShelves.map(shelf => ({
        ...shelf,
        height_percent: heightPerShelf,
      })));
    } else {
      setEditingShelves(updatedShelves);
    }
  };

  const updateShelf = (index: number, field: 'name' | 'height_percent', value: string | number) => {
    setEditingShelves(editingShelves.map((shelf, i) =>
      i === index ? { ...shelf, [field]: value } : shelf
    ));
  };

  const getElementColor = (element: ElementWithPlacements) => {
    if (element.custom_color) return element.custom_color;
    return ELEMENT_CONFIGS[element.element_type]?.color || '#94a3b8';
  };

  const getElementLabel = (element: ElementWithPlacements) => {
    if (element.custom_name) return element.custom_name;
    return t('kitchen:elements.' + element.element_type) || element.element_type;
  };

  return (
    <div className="w-full h-full flex items-center justify-center p-4">
      <div
        ref={canvasRef}
        className="relative bg-muted/20 border-2 border-dashed border-border rounded-lg"
        style={{
          width: model.canvas_width * canvasScale,
          height: model.canvas_height * canvasScale,
        }}
        onDrop={handleCanvasDrop}
        onDragOver={(e) => e.preventDefault()}
      >
        {elements.map((element) => {
          const isSelected = selectedElement === element.id;
          const color = getElementColor(element);
          const label = getElementLabel(element);

          return (
            <ContextMenu key={element.id}>
              <ContextMenuTrigger>
                <div
                  data-element-id={element.id}
                  className={`absolute cursor-${mode === 'edit' ? 'move' : 'pointer'} border-2 rounded flex items-center justify-center text-xs font-medium transition-all ${
                    isSelected ? 'border-primary ring-2 ring-primary/20' : 'border-foreground/20'
                  }`}
                  style={{
                    left: element.x * canvasScale,
                    top: element.y * canvasScale,
                    width: element.width * canvasScale,
                    height: element.height * canvasScale,
                    backgroundColor: color,
                    color: '#ffffff',
                  }}
                  onMouseDown={(e) => handleElementMouseDown(e, element.id)}
                  onClick={() => handleElementClick(element)}
                >
                  <div className="text-center px-2">
                    <div className="font-semibold truncate">{label}</div>
                    {mode === 'pantry' && element.items && element.items.length > 0 && (
                      <div className="text-xs opacity-90 mt-1">
                        {t('kitchen:kitchenCanvas.itemCount', { count: element.items.length })}
                      </div>
                    )}
                  </div>

                  {/* Delete Button (Edit Mode Only) */}
                  {mode === 'edit' && isSelected && (
                    <button
                      className="absolute top-1 right-1 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center hover:bg-destructive/90 transition-colors z-10"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteElement(element.id);
                      }}
                      title={t('kitchen:kitchenCanvas.deleteTooltip')}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}

                  {/* Resize Handles (Edit Mode Only) */}
                  {mode === 'edit' && isSelected && (
                    <>
                      {['se', 'sw', 'ne', 'nw', 'e', 'w', 'n', 's'].map((handle) => (
                        <div
                          key={handle}
                          className={`resize-handle absolute w-3 h-3 bg-primary border border-background rounded-full ${
                            handle === 'se' ? 'bottom-0 right-0 cursor-se-resize' :
                            handle === 'sw' ? 'bottom-0 left-0 cursor-sw-resize' :
                            handle === 'ne' ? 'top-0 right-0 cursor-ne-resize' :
                            handle === 'nw' ? 'top-0 left-0 cursor-nw-resize' :
                            handle === 'e' ? 'top-1/2 right-0 -translate-y-1/2 cursor-e-resize' :
                            handle === 'w' ? 'top-1/2 left-0 -translate-y-1/2 cursor-w-resize' :
                            handle === 'n' ? 'top-0 left-1/2 -translate-x-1/2 cursor-n-resize' :
                            'bottom-0 left-1/2 -translate-x-1/2 cursor-s-resize'
                          }`}
                          style={{
                            transform: `translate(${handle.includes('e') ? '50%' : handle.includes('w') ? '-50%' : '0'}, ${handle.includes('s') ? '50%' : handle.includes('n') ? '-50%' : '0'})`,
                          }}
                          onMouseDown={(e) => handleResizeMouseDown(e, element.id, handle as ResizeState['handle'])}
                        />
                      ))}
                    </>
                  )}
                </div>
              </ContextMenuTrigger>
              
              {mode === 'edit' && (
                <ContextMenuContent>
                  <ContextMenuItem onClick={() => openEditDialog(element)}>
                    <Edit className="mr-2 h-4 w-4" />
                    {t('kitchen:kitchenCanvas.renameAndColor')}
                  </ContextMenuItem>
                  <ContextMenuItem onClick={() => openShelvesDialog(element)}>
                    <Layers className="mr-2 h-4 w-4" />
                    {t('kitchen:kitchenCanvas.manageShelves')}
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                  <ContextMenuItem
                    className="text-destructive"
                    onClick={() => handleDeleteElement(element.id)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {t('kitchen:delete')}
                  </ContextMenuItem>
                </ContextMenuContent>
              )}
            </ContextMenu>
          );
        })}

        {elements.length === 0 && mode === 'edit' && (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
            {t('kitchen:emptyCanvasMessage')}
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('kitchen:kitchenCanvas.editElementTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="element-name">{t('kitchen:customName')}</Label>
              <Input
                id="element-name"
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                placeholder={t('kitchen:kitchenCanvas.customNamePlaceholder')}
              />
            </div>
            <div>
              <Label htmlFor="element-color">{t('kitchen:kitchenCanvas.customColor')}</Label>
              <div className="flex gap-2 items-center">
                <div
                  className="w-12 h-12 rounded border-2 border-border cursor-pointer"
                  style={{ backgroundColor: editingColor || '#94a3b8' }}
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'color';
                    input.value = editingColor || '#94a3b8';
                    input.onchange = (e) => setEditingColor((e.target as HTMLInputElement).value);
                    input.click();
                  }}
                />
                <Input
                  id="element-color"
                  value={editingColor || ''}
                  onChange={(e) => setEditingColor(e.target.value)}
                  placeholder="#RRGGBB"
                  className="flex-1"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              {t('common:cancel')}
            </Button>
            <Button onClick={handleSaveEdit}>{t('common:save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Shelves Dialog */}
      <Dialog open={shelvesDialogOpen} onOpenChange={setShelvesDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('kitchen:kitchenCanvas.manageShelves')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {editingShelves.map((shelf, index) => (
              <div key={index} className="flex gap-2 items-end">
                <div className="flex-1">
                  <Label>{t('kitchen:kitchenCanvas.shelfName')}</Label>
                  <Input
                    value={shelf.name}
                    onChange={(e) => updateShelf(index, 'name', e.target.value)}
                    placeholder={t('kitchen:kitchenCanvas.shelfNamePlaceholder')}
                  />
                </div>
                <div className="w-32">
                  <Label>{t('kitchen:kitchenCanvas.heightPercent')}</Label>
                  <Input
                    type="number"
                    min="10"
                    max="100"
                    value={shelf.height_percent}
                    onChange={(e) => updateShelf(index, 'height_percent', Number(e.target.value))}
                  />
                </div>
                <Button
                  variant="destructive"
                  size="icon"
                  onClick={() => removeShelf(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button onClick={addShelf} variant="outline" className="w-full">
              <Plus className="mr-2 h-4 w-4" />
              {t('kitchen:kitchenCanvas.addShelf')}
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShelvesDialogOpen(false)}>
              {t('common:cancel')}
            </Button>
            <Button onClick={handleSaveShelves}>{t('common:save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Items Dialog (Pantry Mode) */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{viewingElement && getElementLabel(viewingElement)}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {viewingElement?.shelves && viewingElement.shelves.length > 0 ? (
              viewingElement.shelves.map((shelf, index) => {
                const shelfItems = viewingElement.items?.filter((_, i) => {
                  const itemsPerShelf = Math.ceil((viewingElement.items?.length || 0) / viewingElement.shelves.length);
                  return i >= index * itemsPerShelf && i < (index + 1) * itemsPerShelf;
                }) || [];

                return (
                  <div key={index} className="border rounded-lg p-4">
                    <h3 className="font-semibold mb-2">{shelf.name}</h3>
                    {shelfItems.length > 0 ? (
                      <div className="space-y-1">
                        {shelfItems.map((item, i) => {
                          const itemName = 'ingredient_name' in item ? item.ingredient_name : item.name;
                          const itemQty = 'amount' in item ? item.amount : undefined;
                          const itemUnit = 'unit' in item ? item.unit : '';
                          
                          return (
                            <div key={i} className="flex justify-between text-sm">
                              <span>{itemName}</span>
                              {itemQty !== undefined && (
                                <span className="text-muted-foreground">
                                  {itemQty} {itemUnit}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">{t('kitchen:kitchenCanvas.noItemsOnShelf')}</p>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="space-y-1">
                {viewingElement?.items && viewingElement.items.length > 0 ? (
                  viewingElement.items
                    .sort((a, b) => {
                      const qtyA = 'amount' in a ? a.amount : 0;
                      const qtyB = 'amount' in b ? b.amount : 0;
                      return (qtyB as number) - (qtyA as number);
                    })
                    .map((item, i) => {
                      const itemName = 'ingredient_name' in item ? item.ingredient_name : item.name;
                      const itemQty = 'amount' in item ? item.amount : undefined;
                      const itemUnit = 'unit' in item ? item.unit : '';
                      
                      return (
                        <div key={i} className="flex justify-between text-sm">
                          <span>{itemName}</span>
                          {itemQty !== undefined && (
                            <span className="text-muted-foreground">
                              {itemQty} {itemUnit}
                            </span>
                          )}
                        </div>
                      );
                    })
                ) : (
                  <p className="text-sm text-muted-foreground">{t('kitchen:kitchenCanvas.noItemsInElement')}</p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setViewDialogOpen(false)}>{t('common:close')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
