import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Link2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { getStoredToken } from '@/lib/api-client';
import { detectTimerMinutes } from '@/lib/recipe-timers';
import { splitLeadingPreparation, stripAlternateMeasurement, truncateAlternatives } from '@/lib/preparation';

/**
 * Parse a quantity string that may be an integer, decimal, simple fraction,
 * or mixed fraction (e.g., "2", "1.5", "1/2", "1 1/2", "1 1 / 2").
 */
const parseQuantityText = (str: string): number => {
  const trimmed = str.trim();
  if (!trimmed) return 0;

  // Mixed fraction like "1 1/2" or "1 1 / 2" → 1 + 1/2 = 1.5
  const mixed = trimmed.match(/^(\d+(?:\.\d+)?)\s+(\d+)\s*\/\s*(\d+)$/);
  if (mixed) {
    return parseFloat(mixed[1]) + parseFloat(mixed[2]) / parseFloat(mixed[3]);
  }

  // Simple fraction like "1/2" or "1 / 2"
  const frac = trimmed.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
  if (frac) {
    return parseFloat(frac[1]) / parseFloat(frac[2]);
  }

  return parseFloat(trimmed) || 0;
};

interface ExtractedRecipe {
  title: string;
  description?: string;
  image_url?: string;
  servings?: number;
  prep_time_minutes?: number;
  cook_time_minutes?: number;
  total_time_minutes?: number;
  ingredients: string[];
  ingredient_groups?: { title?: string; ingredients: string[] }[];
  instructions: string[];
}

interface ParsedRecipe {
  title: string;
  description: string;
  servings: number;
  prep_time_minutes?: number;
  cook_time_minutes?: number;
  notes: string;
  ingredients: Array<{
    name: string;
    preparation: string;
    quantity: number;
    unit: string;
    is_optional: boolean;
    order_index: number;
    group_name?: string | null;
  }>;
  equipment: string[];
  sections: Array<{
    title: string;
    order_index: number;
    steps: Array<{
      order_index: number;
      instruction: string;
      image_url: string;
      timer_minutes: number;
    }>;
  }>;
  tags: string[];
}

async function invokeExtractRecipe(url: string): Promise<any> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getStoredToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch('/api/extract-recipe', {
    method: 'POST',
    headers,
    body: JSON.stringify({ url }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || 'Failed to extract recipe');
  }

  return res.json();
}

export default function UrlImport({ buttonVariant = 'outline' }: { buttonVariant?: 'default' | 'outline' | 'ghost' }) {
  const { t } = useTranslation('recipes');
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);

  const validateUrl = (urlString: string): boolean => {
    try {
      const parsedUrl = new URL(urlString);
      return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const parseIngredient = (ingredientText: string): { name: string; preparation: string; quantity: number; unit: string } => {
    // Try to extract quantity and unit from ingredient text
    // Examples: "2 cups flour", "350g butter, softened", "1 tablespoon olive oil"
    
    const fractionMap: Record<string, number> = {
      '¼': 0.25, '½': 0.5, '¾': 0.75,
      '⅓': 0.333, '⅔': 0.666,
      '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875,
      '⅕': 0.2, '⅖': 0.4, '⅗': 0.6, '⅘': 0.8
    };
    
    let text = ingredientText;

    // Strip leading checkbox/bullet glyphs (e.g., "▢ 1 cup heavy cream")
    text = text.replace(/^[\s▢□☐▪•◦○●✔☑✦✧✿]+/, '');
    
    // Replace fractions with decimals
    for (const [fraction, decimal] of Object.entries(fractionMap)) {
      text = text.replace(new RegExp(fraction, 'g'), decimal.toString());
    }

    const normalizeUnit = (u: string): string => {
      const unitMap: Record<string, string> = {
        'g': 'g', 'gram': 'g', 'grams': 'g',
        'kg': 'kg', 'kilogram': 'kg', 'kilograms': 'kg',
        'ml': 'ml', 'milliliter': 'ml', 'milliliters': 'ml',
        'l': 'L', 'liter': 'L', 'liters': 'L',
        'oz': 'oz', 'oz.': 'oz', 'ounce': 'oz', 'ounces': 'oz',
        'lb': 'lb', 'lb.': 'lb', 'pound': 'lb', 'pounds': 'lb',
        'cup': 'cup', 'cups': 'cup', 'c': 'cup', 'c.': 'cup',
        'tbsp': 'tbsp', 'tablespoon': 'tbsp', 'tablespoons': 'tbsp', 'tbsp.': 'tbsp',
        'tsp': 'tsp', 'teaspoon': 'tsp', 'teaspoons': 'tsp', 'tsp.': 'tsp',
        'clove': 'clove', 'cloves': 'clove',
        'whole': 'whole',
        'slice': 'slice', 'slices': 'slice'
      };
      return unitMap[u.toLowerCase()] || u || 'unit';
    };
    
    // Units recognized as measure indicators, including abbreviations with
    // trailing periods (tbsp., tsp., c.) and count words (whole, slice(s)).
    const UNIT_ALT = 'g|kg|ml|l|oz\\.?|ounce|ounces|lb\\.?|pound|pounds|cup|cups|c\\.?|tbsp\\.?|tablespoon|tablespoons|tsp\\.?|teaspoon|teaspoons|clove|cloves|whole|slice|slices';
    
    // Try to match quantity + unit + ingredient
    const patterns = [
      new RegExp(`^(\\d+(?:\\.\\d+)?(?:(?:\\s+\\d+\\s*)?\\/\\s*\\d+)?)\\s*(${UNIT_ALT})?\\s+(.+)$`, 'i'),
      new RegExp(`^(\\d+(?:\\.\\d+)?)\\s*-\\s*(\\d+(?:\\.\\d+)?)\\s*(${UNIT_ALT})?\\s+(.+)$`, 'i'),
    ];
    
    const [singlePattern, rangePattern] = patterns;
    
    for (const [pattern, isRange] of [[singlePattern, false], [rangePattern, true]] as const) {
      const match = text.match(pattern);
      if (match) {
        // Handles integers, decimals, fractions, and mixed fractions like "1 1/2"
        const quantity = parseQuantityText(match[1]);
        
        // Range pattern: [1]=q1 [2]=q2 [3]=unit [4]=rest; single: [1]=qty [2]=unit [3]=rest
        const unit = (isRange ? match[3] : match[2])?.toLowerCase() || '';
        let rest = (isRange ? match[4] : match[3]) || '';

        // Extract parenthetical/bracket annotations (e.g., "eggs (weighed out of shell, separated into yolks and whites)",
        // "2 cups [284 g] all-purpose flour") BEFORE truncating alternatives or splitting on commas so commas inside
        // the annotations don't break name/preparation apart.
        const parenNotes: string[] = [];
        rest = rest.replace(/\(([^)]*)\)|\[([^\]]*)\]/g, (_whole: string, inner?: string, bracketInner?: string) => {
          const trimmed = (inner ?? bracketInner ?? '').trim();
          if (trimmed) parenNotes.push(trimmed);
          return ' ';
        }).replace(/\s+/g, ' ').trim();

        // Strip leading quantity range (e.g., "½ teaspoon to 1 tablespoon toasted sesame oil" → "toasted sesame oil")
        rest = rest.replace(/^to\s+\d+(?:[./\s]*\d+)?\s*[a-zA-Z.]+\.?\s+/i, '');

        // Stop at ingredient alternatives (e.g., "heavy cream or half-and-half" → "heavy cream")
        rest = truncateAlternatives(rest);

        // Strip leading alternate measurement (e.g., "250 g / 8.8oz pasta" → "pasta")
        rest = stripAlternateMeasurement(rest);

        // Split ingredient name and preparation (e.g., "butter, softened")
        const parts = rest.split(',');
        let name = parts[0].trim();
        let preparation = parts.slice(1).join(',').trim();

        // Reattach annotation notes to the preparation so no info is lost
        if (parenNotes.length > 0) {
          preparation = preparation ? `${preparation}, ${parenNotes.join(', ')}` : parenNotes.join(', ');
        }

        // Clean parenthetical content from name (e.g., "sugar (about 2 tbsp)" → "sugar")
        name = name.replace(/\s*\([^)]*\)\s*$/, '').trim();

        // Move leading preparation words into the preparation field (e.g., "grated cheddar" → "cheddar")
        const { name: cleanName, preparation: leadingPrep } = splitLeadingPreparation(name);
        name = cleanName;
        if (leadingPrep) {
          preparation = preparation ? `${preparation}, ${leadingPrep}` : leadingPrep;
        }

        const normalizedUnit = normalizeUnit(unit);
        
        return {
          name,
          preparation,
          quantity,
          unit: normalizedUnit
        };
      }
    }

    // Fallback 1: Extract quantity/unit from parenthetical content
    // e.g., "ounce sugar (about 2 tablespoons; 30g)" → extracts "30g" as primary
    const parenExtract = text.match(new RegExp(`\\([^)]*?(\\d+(?:[./\\s]*\\d+)?)\\s*(${UNIT_ALT})\\s*\\)`, 'i'));
    if (parenExtract) {
      const quantity = parseQuantityText(parenExtract[1]);
      const unit = normalizeUnit(parenExtract[2]);
      // Remove parenthetical and leading unit words to get name
      let name = text.replace(/\([^)]*\)/g, '').trim();
      // Strip leading unit words (e.g., "ounce sugar" → "sugar")
      name = name.replace(new RegExp(`^(${UNIT_ALT})\\s+`, 'i'), '').trim();
      name = name.replace(/^[,\s]+|[,\s]+$/g, '').trim();
      // Stop at ingredient alternatives (e.g., "cream or half-and-half" → "cream")
      name = truncateAlternatives(name);
      // Strip leading alternate measurement (e.g., "200 g / 7 oz Pecorino" → "Pecorino")
      name = stripAlternateMeasurement(name);
      const parts = name.split(',');
      name = parts[0].trim();
      let preparation = parts.slice(1).join(',').trim();
      // Move leading preparation words into the preparation field (e.g., "grated cheddar" → "cheddar")
      const { name: cleanName, preparation: leadingPrep } = splitLeadingPreparation(name);
      name = cleanName;
      if (leadingPrep) {
        preparation = preparation ? `${preparation}, ${leadingPrep}` : leadingPrep;
      }
      return { name: name || ingredientText.trim(), preparation, quantity, unit };
    }
    
    // Fallback 2: Text starts with a known unit word → prepend "1 " and re-parse
    const knownUnitStart = new RegExp(`^(${UNIT_ALT})\\b`, 'i');
    if (knownUnitStart.test(text)) {
      const result = parseIngredient("1 " + text);
      if (result.quantity > 0) {
        return result;
      }
    }
    
    // Final fallback: clean parenthetical from text and return as name
    let cleanedName = text.replace(/\s*\([^)]*\)\s*/g, '').trim() || text.trim();
    // Stop at ingredient alternatives (e.g., "cream or half-and-half" → "cream")
    cleanedName = truncateAlternatives(cleanedName);
    // Strip leading alternate measurement (e.g., "/ 8.8oz fresh egg fettucine" → "fresh egg fettucine")
    cleanedName = stripAlternateMeasurement(cleanedName);
    // Move leading preparation words into the preparation field (e.g., "grated cheddar" → "cheddar")
    const { name: fallbackName, preparation } = splitLeadingPreparation(cleanedName);
    return {
      name: fallbackName || cleanedName,
      preparation,
      quantity: 0,
      unit: 'whole'
    };
  };

  const convertToRecipeFormat = (extracted: ExtractedRecipe, sourceUrl: string): ParsedRecipe => {
    // Parse ingredients, preserving group headings (e.g., "For the Marinade:",
    // "For the Sauce:") so multi-list recipes keep their structure.
    const groups = extracted.ingredient_groups && extracted.ingredient_groups.length > 0
      ? extracted.ingredient_groups
      : [{ title: null, ingredients: extracted.ingredients }];

    const allIngredients: Array<{ text: string; group: string | null }> = [];

    for (const group of groups) {
      const groupName = group.title ? group.title.replace(/:$/, '').trim() : null;

      for (const ing of group.ingredients) {
        // Check if this looks like multiple ingredients (contains newlines or multiple bullet points)
        if (ing.includes('\n')) {
          // Split by newlines and add each as separate ingredient
          const split = ing.split('\n').map(s => s.trim()).filter(s => s.length > 0);
          allIngredients.push(...split.map(s => ({ text: s, group: groupName })));
        } else if (ing.length > 200) {
          // If ingredient text is too long (>200 chars), it's likely multiple ingredients
          // Try to split by common separators
          const split = ing.split(/[;•·]/).map(s => s.trim()).filter(s => s.length > 0);
          if (split.length > 1) {
            allIngredients.push(...split.map(s => ({ text: s, group: groupName })));
          } else {
            // If no separators found, just truncate and add warning
            allIngredients.push({ text: ing.substring(0, 200), group: groupName });
          }
        } else {
          allIngredients.push({ text: ing, group: groupName });
        }
      }
    }

    const ingredients = allIngredients.map(({ text, group }, idx) => {
      const parsed = parseIngredient(text);
      // Ensure ingredient name doesn't exceed reasonable length
      const name = parsed.name.length > 100 ? parsed.name.substring(0, 100) : parsed.name;
      return {
        ...parsed,
        name,
        is_optional: text.toLowerCase().includes('optional'),
        order_index: idx,
        group_name: group
      };
    });
    
    // Parse instructions into sections
    const steps = extracted.instructions.map((instruction, idx) => ({
      order_index: idx,
      instruction: instruction.trim(),
      image_url: '',
      timer_minutes: detectTimerMinutes(instruction)
    }));
    
    const sections = [{
      title: 'Main',
      order_index: 0,
      steps
    }];
    
    // Add source URL to notes
    const notes = `Source: ${sourceUrl}`;
    
    return {
      title: extracted.title || 'Untitled Recipe',
      description: extracted.description || '',
      servings: extracted.servings || 4,
      prep_time_minutes: extracted.prep_time_minutes,
      cook_time_minutes: extracted.cook_time_minutes,
      notes,
      ingredients,
      equipment: [],
      sections,
      tags: []
    };
  };

  const handleImport = async () => {
    if (!url.trim()) {
      toast.error(t('import.error.invalidUrl'));
      return;
    }
    
    if (!validateUrl(url)) {
      toast.error(t('import.error.invalidUrl'));
      return;
    }
    
    setLoading(true);
    
    try {
      const data = await invokeExtractRecipe(url);
      
      if (data.error) {
        const errorKey = `import.error.${data.error}`;
        const errorMsg = t(errorKey, { defaultValue: data.message || t('import.error.unknown') });
        toast.error(errorMsg);
        return;
      }
      
      if (!data.recipe) {
        toast.error(t('import.error.noRecipe'));
        return;
      }
      
      const parsedRecipe = convertToRecipeFormat(data.recipe, url);
      
      // Navigate to the import review page for confirmation
      navigate('/import-review', {
        state: {
          importData: {
            recipe: {
              title: parsedRecipe.title,
              description: parsedRecipe.description,
              image_url: data.recipe.image_url || '',
              servings: parsedRecipe.servings,
              prep_time_minutes: parsedRecipe.prep_time_minutes,
              cook_time_minutes: parsedRecipe.cook_time_minutes,
              notes: parsedRecipe.notes,
            },
            ingredients: parsedRecipe.ingredients.map((ing, idx) => ({
              name: ing.name,
              preparation: ing.preparation,
              quantity: ing.quantity,
              unit: ing.unit,
              is_optional: ing.is_optional,
              order_index: idx,
              group_name: ing.group_name || null
            })),
            equipment: parsedRecipe.equipment.map((eq, idx) => ({
              name: eq,
              order_index: idx
            })),
            sections: parsedRecipe.sections.map((section, idx) => ({
              title: section.title,
              order_index: idx,
              steps: section.steps
            })),
            tags: parsedRecipe.tags.map(tag => ({ name: tag }))
          }
        }
      });
      
      setOpen(false);
      setUrl('');
      toast.success(t('import.success'));
      
    } catch (error: any) {
      console.error('Import error:', error);
      toast.error(error.message || t('import.error.unknown'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button type="button" variant={buttonVariant}>
            <Link2 className="h-4 w-4 mr-2" />
            {t('import.fromUrl')}
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('import.fromUrl')}</DialogTitle>
            <DialogDescription>
              {t('import.prompt')}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="recipe-url">URL</Label>
              <Input
                id="recipe-url"
                type="url"
                placeholder={t('import.urlPlaceholder')}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={loading}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !loading) {
                    handleImport();
                  }
                }}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setOpen(false);
                setUrl('');
              }}
              disabled={loading}
            >
              {t('import.cancel')}
            </Button>
            <Button
              type="button"
              onClick={handleImport}
              disabled={loading || !url.trim()}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('import.extracting')}
                </>
              ) : (
                t('import.button')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
  );
}
