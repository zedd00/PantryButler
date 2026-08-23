import type { ReactNode } from 'react';
import type { GridRecipe, GridRecipeNode } from '@/types/types';
import { formatQuantity } from '@/lib/conversions';

interface GridIngredient {
  name: string;
  quantity: number;
  unit: string;
}

const formatIngredient = (ing: GridIngredient): string => {
  const qty = Number(ing.quantity) || 0;
  if (qty <= 0) return ing.name;
  const amount = formatQuantity(qty, ing.unit);
  return ing.unit ? `${amount} ${ing.unit} ${ing.name}` : `${amount} ${ing.name}`;
};

interface GridCellValue {
  text: string;
  kind: 'ingredient' | 'step' | 'used' | 'blank';
}

interface PlacedCell {
  value: GridCellValue;
  rows: number;
  cols: number;
}

interface TableModel {
  map: Map<string, PlacedCell>;
  rows: number;
  cols: number;
}

const KEY = (r: number, c: number) => `${r},${c}`;

interface StepInfo {
  text: string;
  /** Ingredient order indices used anywhere within this step's subtree. */
  covered: Set<number>;
}

function treeToTable(node: GridRecipeNode, ingredients: GridIngredient[]): TableModel {
  const ingredientRows: string[] = [];
  const ingredientAtRow: number[] = [];
  const introducedAt = new Map<number, number>();
  const rowOfIngredient = new Map<number, number>();
  const steps: StepInfo[] = [];
  const introduced = new Set<number>();

  const addIngredient = (index: number) => {
    if (!rowOfIngredient.has(index)) {
      rowOfIngredient.set(index, ingredientRows.length);
      ingredientRows.push(ingredients[index] ? formatIngredient(ingredients[index]) : '?');
      ingredientAtRow.push(index);
      introducedAt.set(index, steps.length);
    }
  };

  // Pre-order walk (root first): an ingredient is introduced by the step
  // that lists it directly, so each step's cell spans every ingredient
  // introduced so far, forming a staircase that reaches back up the rows.
  const walk = (n: GridRecipeNode): void => {
    if (n.type === 'ingredient') {
      addIngredient(n.ingredientOrderIndex);
      introduced.add(n.ingredientOrderIndex);
      return;
    }
    for (const input of n.inputs) {
      if (input.type === 'ingredient') {
        addIngredient(input.ingredientOrderIndex);
        introduced.add(input.ingredientOrderIndex);
      }
    }
    if (n.text.trim()) {
      steps.push({ text: n.text, covered: new Set(introduced) });
    }
    for (const input of n.inputs) {
      if (input.type === 'step') walk(input);
    }
  };

  walk(node);

  const hasIngredients = ingredientRows.length > 0;
  const stepColOffset = hasIngredients ? 1 : 0;
  const headerRowOffset = hasIngredients ? 1 : 0;
  const map = new Map<string, PlacedCell>();

  ingredientRows.forEach((name, i) => {
    map.set(KEY(i + headerRowOffset, 0), { value: { text: name, kind: 'ingredient' }, rows: 1, cols: 1 });
  });

  // Steps live in the header row (row 0) as single cells. Each step's
  // covered ingredient rows form a white "used" band starting below the
  // header (row 1) so the step name isn't merged with the rows below.
  steps.forEach((step, col) => {
    const colIndex = col + stepColOffset;
    const coveredRows = Array.from(step.covered)
      .map((index) => (rowOfIngredient.get(index) ?? -1) + headerRowOffset)
      .filter((r) => r >= headerRowOffset)
      .sort((a, b) => a - b);

    map.set(KEY(0, colIndex), { value: { text: step.text, kind: 'step' }, rows: 1, cols: 1 });

    if (coveredRows.length > 0) {
      map.set(KEY(headerRowOffset, colIndex), {
        value: { text: '', kind: 'used' },
        rows: coveredRows[coveredRows.length - 1],
        cols: 1,
      });
    }
  });

  // Blank merged cells: for each ingredient row, a single no-fill bordered
  // cell spans the step columns before the step that introduces it (the
  // columns whose steps don't use the ingredient).
  ingredientAtRow.forEach((ingIndex, i) => {
    const row = i + headerRowOffset;
    const skip = introducedAt.get(ingIndex) ?? 0;
    if (skip > 0) {
      map.set(KEY(row, stepColOffset), {
        value: { text: '', kind: 'blank' },
        rows: 1,
        cols: skip,
      });
    }
  });

  return {
    map,
    rows: Math.max(ingredientRows.length + headerRowOffset, 1),
    cols: steps.length + stepColOffset,
  };
}

export default function GridRecipeTable({
  gridRecipe,
  ingredients,
}: {
  gridRecipe: GridRecipe;
  ingredients: GridIngredient[];
}) {
  if (!gridRecipe.root) return null;

  const table = treeToTable(gridRecipe.root, ingredients);

  const cellsInRow = (r: number): { col: number; cell: PlacedCell }[] => {
    const found: { col: number; cell: PlacedCell }[] = [];
    for (const [key, cell] of table.map) {
      const [cellRow, cellCol] = key.split(',').map(Number);
      if (cellRow === r) found.push({ col: cellCol, cell });
    }
    return found.sort((a, b) => a.col - b.col);
  };

  const rows: ReactNode[] = [];
  for (let r = 0; r < table.rows; r++) {
    const cells = cellsInRow(r);
    const isHeader = r === 0;
    rows.push(
      <tr key={r}>
        {isHeader && cells[0]?.col !== 0 && (
          <td className="px-3 py-2 border-b border-black" />
        )}
        {cells.map(({ col, cell }) => {
          const merged = cell.rows > 1 || cell.cols > 1;
          const isBlank = cell.value.kind === 'blank';
          // No horizontal border between the header row and the first body
          // row so the step names sit flush against the used bands below.
          const hideEdge = isHeader ? 'border-b-0' : r === 1 ? 'border-t-0' : '';
          return (
            <td
              key={`${r}-${col}`}
              rowSpan={cell.rows > 1 ? cell.rows : undefined}
              colSpan={cell.cols > 1 ? cell.cols : undefined}
              className={`px-3 py-2 align-top text-sm border border-black ${hideEdge} ${
                isBlank ? 'bg-transparent' : merged ? 'bg-white' : 'bg-background'
              } ${cell.value.kind === 'step' ? 'text-center' : ''}`}
            >
              {cell.value.text}
            </td>
          );
        })}
      </tr>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="border-collapse table-auto">
        <tbody>{rows}</tbody>
      </table>
    </div>
  );
}
