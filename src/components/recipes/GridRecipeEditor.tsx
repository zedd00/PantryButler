import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';
import type { GridRecipe, GridRecipeNode, GridStepNode } from '@/types/types';
import { useTranslation } from 'react-i18next';

const STEP_MAX_LEN = 60;

interface GridRecipeEditorProps {
  gridRecipe: GridRecipe | null;
  ingredients: { name: string }[];
  onChange: (grid: GridRecipe | null) => void;
}

type Path = number[];

function makeStep(text = ''): GridStepNode {
  return { type: 'step', text, inputs: [] };
}

function updateNodeAtPath(
  root: GridStepNode,
  path: Path,
  updater: (n: GridRecipeNode) => GridRecipeNode
): GridStepNode {
  if (path.length === 0) return updater(root) as GridStepNode;
  const [idx, ...rest] = path;
  return {
    ...root,
    inputs: root.inputs.map((n, i) => {
      if (i !== idx) return n;
      // Only step nodes carry inputs, so a deeper path must descend through a
      // step. A path into an ingredient node is a no-op.
      if (n.type !== 'step') return n;
      return updateNodeAtPath(n, rest, updater);
    }),
  };
}

export default function GridRecipeEditor({
  gridRecipe,
  ingredients,
  onChange,
}: GridRecipeEditorProps) {
  const { t } = useTranslation('recipes');
  const root = gridRecipe?.root ?? null;

  const updateRoot = (node: GridStepNode) => onChange({ root: node });

  const update = (path: Path, updater: (n: GridRecipeNode) => GridRecipeNode) => {
    if (!root) return;
    updateRoot(updateNodeAtPath(root, path, updater));
  };

  const removeAt = (path: Path) => {
    if (!root || path.length === 0) return;
    const parentPath = path.slice(0, -1);
    const idx = path[path.length - 1];
    update(parentPath, (n) => {
      if (n.type !== 'step') return n;
      return { ...n, inputs: n.inputs.filter((_, i) => i !== idx) };
    });
  };

  const addStepAt = (path: Path) => {
    update(path, (n) => {
      if (n.type !== 'step') return n;
      return { ...n, inputs: [...n.inputs, makeStep()] };
    });
  };

  const addIngredientAt = (path: Path) => {
    if (ingredients.length === 0) return;
    update(path, (n) => {
      if (n.type !== 'step') return n;
      return {
        ...n,
        inputs: [...n.inputs, { type: 'ingredient', ingredientOrderIndex: 0 }],
      };
    });
  };

  const renderNode = (node: GridRecipeNode, path: Path) => {
    if (node.type === 'ingredient') {
      const isValid = node.ingredientOrderIndex < ingredients.length;
      return (
        <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2">
          <span className="text-xs text-muted-foreground w-20 shrink-0">{t('gridRecipeEditor.ingredient')}</span>
          <Select
            value={isValid ? String(node.ingredientOrderIndex) : undefined}
            onValueChange={(v) =>
              update(path, () => ({
                type: 'ingredient' as const,
                ingredientOrderIndex: Number(v),
              }))
            }
          >
            <SelectTrigger className="flex-1 h-8">
              <SelectValue placeholder={t('gridRecipeEditor.selectIngredient')} />
            </SelectTrigger>
            <SelectContent>
              {ingredients.map((ing, idx) => (
                <SelectItem key={idx} value={String(idx)}>
                  {ing.name || t('gridRecipeEditor.ingredientWithIndex', { index: idx + 1 })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => removeAt(path)}
            title={t('gridRecipeEditor.removeIngredient')}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      );
    }

    const isRoot = path.length === 0;
    return (
      <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
        <div className="flex items-center gap-2">
          {!isRoot && (
            <span className="text-xs text-muted-foreground w-20 shrink-0">{t('gridRecipeEditor.step')}</span>
          )}
          <Input
            value={node.text}
            maxLength={STEP_MAX_LEN}
            placeholder={isRoot ? t('gridRecipeEditor.rootStepPlaceholder') : t('gridRecipeEditor.stepPlaceholder')}
            onChange={(e) =>
              update(path, (n) =>
                n.type === 'step' ? { ...n, text: e.target.value } : n
              )
            }
            className="flex-1 h-8"
          />
          <span className="text-xs text-muted-foreground w-14 text-right shrink-0">
            {node.text.length}/{STEP_MAX_LEN}
          </span>
          {!isRoot && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeAt(path)}
              title={t('gridRecipeEditor.removeStep')}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>

        {node.inputs.length > 0 && (
          <div className="space-y-2 pl-6 border-l-2 border-border">
            {node.inputs.map((child, i) => (
              <div key={i} className="space-y-2">
                {renderNode(child, [...path, i])}
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2 pl-6">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => addStepAt(path)}
          >
            <Plus className="mr-1 h-3 w-3" />
            {t('addStep')}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => addIngredientAt(path)}
            disabled={ingredients.length === 0}
          >
            <Plus className="mr-1 h-3 w-3" />
            {t('addIngredient')}
          </Button>
        </div>
      </div>
    );
  };

  if (!root) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {t('gridRecipeEditor.enableGridPrompt')}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange({ root: makeStep() })}
        >
          <Plus className="mr-1 h-3 w-3" />
          {t('gridRecipeEditor.createGrid')}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm font-medium">{t('gridRecipeEditor.gridRecipeTree')}</Label>
          <p className="text-xs text-muted-foreground">
            {t('gridRecipeEditor.stepsReference')}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange(null)}
        >
          {t('gridRecipeEditor.clearGrid')}
        </Button>
      </div>
      {renderNode(root, [])}
    </div>
  );
}
