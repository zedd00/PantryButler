/**
 * Cooklang Parser
 * Based on the Cooklang specification: https://cooklang.org/docs/spec/
 *
 * Syntax:
 * - Ingredients: @ingredient{quantity%unit} or @ingredient{quantity} or @ingredient{}
 * - Shorthand preparations: @ingredient{quantity}(preparation)
 * - Cookware: #cookware{quantity} or #cookware
 * - Timers: ~timer{duration%unit} or ~{duration%unit}
 * - Comments: -- comment or [- comment -]
 * - Sections: == Section Title == or = Section Title
 * - Metadata: YAML front matter (--- ... ---) or legacy >> key: value
 *
 * Per the spec, names are single-word unless terminated by braces `{}`.
 * e.g. `@salt` is the ingredient "salt", while `@ground black pepper{}`
 * is the ingredient "ground black pepper".
 */

export interface CooklangIngredient {
  name: string;
  quantity?: number;
  unit?: string;
  preparation?: string;
}

export interface CooklangCookware {
  name: string;
  quantity?: number;
}

export interface CooklangTimer {
  name?: string;
  duration: number;
  unit: string;
}

export interface CooklangStep {
  instruction: string;
  ingredients: CooklangIngredient[];
  cookware: CooklangCookware[];
  timers: CooklangTimer[];
}

export interface CooklangSection {
  title: string;
  steps: CooklangStep[];
}

export interface CooklangRecipe {
  metadata: Record<string, string>;
  steps: CooklangStep[];
  sections: CooklangSection[];
  ingredients: CooklangIngredient[];
  cookware: CooklangCookware[];
}

export class CooklangParser {
  /**
   * Parse a .cook file content
   */
  static parse(content: string): CooklangRecipe {
    const metadata: Record<string, string> = {};
    let body = content;

    // YAML front matter (--- ... ---)
    const frontMatter = this.extractFrontMatter(body);
    if (frontMatter) {
      Object.assign(metadata, this.parseFrontMatter(frontMatter.yamlText));
      body = frontMatter.body;
    }

    const lines = body.split('\n');
    const steps: CooklangStep[] = [];
    const sections: CooklangSection[] = [];
    let currentStep = '';
    let currentSection: CooklangSection | null = null;
    let inMetadata = true;

    const flushStep = () => {
      if (currentStep.trim()) {
        const step = this.parseStep(currentStep);
        if (currentSection) {
          currentSection.steps.push(step);
        } else {
          steps.push(step);
        }
        currentStep = '';
      }
    };

    for (let line of lines) {
      // Skip empty lines (step separator)
      if (!line.trim()) {
        flushStep();
        continue;
      }

      // Section marker: == Title == or = Title
      const sectionMatch = line.trim().match(/^=+\s*(.+?)\s*=*\s*$/);
      if (sectionMatch && !line.trim().startsWith('>>')) {
        flushStep();
        currentSection = { title: sectionMatch[1].trim(), steps: [] };
        sections.push(currentSection);
        continue;
      }

      // Legacy metadata (>> key: value)
      if (line.startsWith('>>')) {
        const metaLine = line.substring(2).trim();
        const colonIndex = metaLine.indexOf(':');
        if (colonIndex > 0 && inMetadata) {
          const key = metaLine.substring(0, colonIndex).trim();
          const value = metaLine.substring(colonIndex + 1).trim();
          metadata[key] = value;
        }
        continue;
      } else {
        inMetadata = false;
      }

      // Remove comments
      line = this.removeComments(line);
      if (!line.trim()) continue;

      // Add to current step
      if (currentStep) {
        currentStep += ' ' + line.trim();
      } else {
        currentStep = line.trim();
      }
    }

    flushStep();

    // Collect all unique ingredients and cookware (loose steps before any
    // section marker are included before section steps)
    const allSteps = [...steps, ...sections.flatMap((s) => s.steps)];
    const ingredientsMap = new Map<string, CooklangIngredient>();
    const cookwareMap = new Map<string, CooklangCookware>();

    for (const step of allSteps) {
      for (const ing of step.ingredients) {
        const key = ing.name.toLowerCase();
        if (!ingredientsMap.has(key)) {
          ingredientsMap.set(key, ing);
        } else {
          // Merge quantities if same ingredient appears multiple times
          const existing = ingredientsMap.get(key)!;
          if (ing.quantity && existing.quantity && ing.unit === existing.unit) {
            existing.quantity += ing.quantity;
          }
        }
      }
      for (const cw of step.cookware) {
        const key = cw.name.toLowerCase();
        if (!cookwareMap.has(key)) {
          cookwareMap.set(key, cw);
        }
      }
    }

    return {
      metadata,
      steps: allSteps,
      sections,
      ingredients: Array.from(ingredientsMap.values()),
      cookware: Array.from(cookwareMap.values()),
    };
  }

  /**
   * Extract YAML front matter (--- ... ---) from the start of the file.
   */
  private static extractFrontMatter(content: string): { yamlText: string; body: string } | null {
    const lines = content.split('\n');
    if (lines.length < 2 || lines[0].trim() !== '---') return null;

    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === '---') {
        return {
          yamlText: lines.slice(1, i).join('\n'),
          body: lines.slice(i + 1).join('\n'),
        };
      }
    }
    return null;
  }

  /**
   * Parse a small YAML subset used for recipe front matter.
   * Produces a flat map of string values.
   */
  private static parseFrontMatter(yamlText: string): Record<string, string> {
    const meta: Record<string, string> = {};
    const lines = yamlText.split('\n');

    const flushNested = (
      start: number,
      indent: number
    ): { next: number; list: string[]; nested: Record<string, string> } => {
      const list: string[] = [];
      const nested: Record<string, string> = {};
      let i = start;
      while (i < lines.length) {
        const nl = lines[i];
        if (!nl.trim()) {
          i++;
          continue;
        }
        const nIndent = nl.match(/^\s*/)![0].length;
        if (nIndent <= indent) break;
        const trimmed = nl.trim();
        if (trimmed.startsWith('- ')) {
          list.push(trimmed.slice(2).trim());
        } else {
          const cIdx = trimmed.indexOf(':');
          if (cIdx > 0) {
            nested[trimmed.slice(0, cIdx).trim()] = trimmed.slice(cIdx + 1).trim();
          }
        }
        i++;
      }
      return { next: i, list, nested };
    };

    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (!line.trim() || line.trim().startsWith('#')) {
        i++;
        continue;
      }
      if ((line.match(/^\s*/)![0].length) > 0) {
        i++;
        continue;
      }

      const colonIdx = line.indexOf(':');
      if (colonIdx < 0) {
        i++;
        continue;
      }
      const key = line.slice(0, colonIdx).trim();
      const value = line.slice(colonIdx + 1).trim();
      i++;

      if (value === '' || value === '|' || value === '>') {
        const { next, list, nested } = flushNested(i, 0);
        i = next;
        if (list.length > 0) {
          meta[key] = list.join(',');
        } else if (key === 'time') {
          for (const [k, v] of Object.entries(nested)) {
            meta[`${k} time`] = v;
          }
        } else {
          for (const [k, v] of Object.entries(nested)) {
            meta[`${key} ${k}`] = v;
          }
        }
      } else {
        meta[key] = value;
      }
    }

    return meta;
  }

  /**
   * Remove comments from a line
   */
  private static removeComments(line: string): string {
    // Remove block comments [- ... -]
    line = line.replace(/\[-.*?-\]/g, '');

    // Remove line comments -- ...
    const commentIndex = line.indexOf('--');
    if (commentIndex >= 0) {
      line = line.substring(0, commentIndex);
    }

    return line;
  }

  /**
   * Parse a single step
   */
  private static parseStep(text: string): CooklangStep {
    const ingredients: CooklangIngredient[] = [];
    const cookware: CooklangCookware[] = [];
    const timers: CooklangTimer[] = [];
    let instruction = text;

    // Protect escaped characters (\@ \# \~ \: \{ \} \% \( \) \\ ) so they are
    // not interpreted as component syntax, then restore after parsing.
    const ESCAPE_SENTINEL = '\uE000';
    instruction = instruction.replace(/\\([@#~:{}%()\\])/g, (_match, char) => ESCAPE_SENTINEL + char);

    // Parse braced ingredients: @name{quantity%unit}(preparation)
    instruction = instruction.replace(
      /@([^{@#~\n]+)\{([^}]*)\}(?:\(([^)]*)\))?/g,
      (_match, name, details, prep) => {
        const ing = this.parseIngredient(name.trim(), details, prep);
        ingredients.push(ing);
        let replaced = ing.name;
        if (ing.preparation) replaced += ` (${ing.preparation})`;
        return replaced;
      }
    );

    // Parse unbraced ingredients (single word)
    instruction = instruction.replace(/@([a-zA-Z0-9\-']+)/g, (_match, name) => {
      const ing: CooklangIngredient = { name: name.trim() };
      ingredients.push(ing);
      return ing.name;
    });

    // Parse braced cookware: #name{quantity}
    instruction = instruction.replace(
      /#([^{@#~\n]+)\{([^}]*)\}/g,
      (_match, name, details) => {
        const cw = this.parseCookware(name.trim(), details);
        cookware.push(cw);
        return cw.name;
      }
    );

    // Parse unbraced cookware (single word)
    instruction = instruction.replace(/#([a-zA-Z0-9\-']+)/g, (_match, name) => {
      const cw: CooklangCookware = { name: name.trim() };
      cookware.push(cw);
      return cw.name;
    });

    // Parse timers ~timer{duration%unit} or ~{duration%unit}
    instruction = instruction.replace(/~([a-zA-Z0-9\s\-']*)(?:\{([^}]*)\})?/g, (match, name, details) => {
      if (details) {
        const timer = this.parseTimer(name.trim() || undefined, details);
        if (timer) {
          timers.push(timer);
          // Named timers replace the whole construct with the name;
          // unnamed timers are metadata only and removed entirely.
          return timer.name || '';
        }
      }
      return match;
    });

    // Clean up extra whitespace, then restore escaped characters
    instruction = instruction
      .replace(/\s+/g, ' ')
      .replace(new RegExp(ESCAPE_SENTINEL + '([@#~:{}%()\\\\])', 'g'), '$1')
      .trim();

    return {
      instruction,
      ingredients,
      cookware,
      timers,
    };
  }

  /**
   * Parse ingredient details
   */
  private static parseIngredient(name: string, details?: string, prep?: string): CooklangIngredient {
    const ing: CooklangIngredient = { name };
    if (prep && prep.trim()) {
      ing.preparation = prep.trim();
    }

    if (!details) {
      return ing;
    }

    // Split by % for quantity%unit
    const parts = details.split('%');
    if (parts.length === 1) {
      // Just quantity
      const quantity = this.parseQuantity(parts[0]);
      if (quantity !== null) ing.quantity = quantity;
    } else if (parts.length === 2) {
      // quantity%unit
      const quantity = this.parseQuantity(parts[0]);
      const unit = parts[1].trim();
      if (quantity !== null) ing.quantity = quantity;
      if (unit) ing.unit = unit;
    }

    return ing;
  }

  /**
   * Parse cookware details
   */
  private static parseCookware(name: string, details?: string): CooklangCookware {
    if (!details) {
      return { name };
    }

    const quantity = this.parseQuantity(details);
    return { name, quantity: quantity || undefined };
  }

  /**
   * Parse timer details
   */
  private static parseTimer(name: string | undefined, details: string): CooklangTimer | null {
    // Split by % for duration%unit
    const parts = details.split('%');
    if (parts.length < 2) {
      return null;
    }

    const duration = this.parseQuantity(parts[0]);
    const unit = parts[1].trim();

    if (duration === null) {
      return null;
    }

    return { name, duration, unit };
  }

  /**
   * Parse quantity (supports fractions and decimals)
   */
  private static parseQuantity(str: string): number | null {
    if (!str || !str.trim()) {
      return null;
    }

    str = str.trim();

    // Handle mixed numbers like "2 1/4" (with space)
    const mixedMatch = str.match(/^(\d+)\s+(\d+)\/(\d+)$/);
    if (mixedMatch) {
      const whole = parseFloat(mixedMatch[1]);
      const numerator = parseFloat(mixedMatch[2]);
      const denominator = parseFloat(mixedMatch[3]);
      if (!isNaN(whole) && !isNaN(numerator) && !isNaN(denominator) && denominator !== 0) {
        return whole + (numerator / denominator);
      }
    }

    // Handle fractions like "1/2", "3/4"
    if (str.includes('/')) {
      const parts = str.split('/');
      if (parts.length === 2) {
        const numerator = parseFloat(parts[0]);
        const denominator = parseFloat(parts[1]);
        if (!isNaN(numerator) && !isNaN(denominator) && denominator !== 0) {
          return numerator / denominator;
        }
      }
    }

    // Handle regular numbers
    const num = parseFloat(str);
    return isNaN(num) ? null : num;
  }

  /**
   * Convert Cooklang time unit to minutes
   */
  static convertTimeToMinutes(duration: number, unit: string): number {
    const unitLower = unit.toLowerCase();

    if (unitLower.startsWith('hour')) {
      return duration * 60;
    } else if (unitLower.startsWith('min')) {
      return duration;
    } else if (unitLower.startsWith('sec')) {
      return Math.ceil(duration / 60);
    } else if (unitLower.startsWith('day')) {
      return duration * 24 * 60;
    }

    // Default to minutes
    return duration;
  }

  /**
   * Normalize unit names to common formats
   */
  static normalizeUnit(unit?: string): string {
    if (!unit) return 'g';

    const unitLower = unit.toLowerCase();

    // Weight
    if (unitLower === 'g' || unitLower === 'gram' || unitLower === 'grams') return 'g';
    if (unitLower === 'kg' || unitLower === 'kilogram' || unitLower === 'kilograms') return 'kg';
    if (unitLower === 'oz' || unitLower === 'ounce' || unitLower === 'ounces') return 'oz';
    if (unitLower === 'lb' || unitLower === 'pound' || unitLower === 'pounds') return 'lb';

    // Volume
    if (unitLower === 'ml' || unitLower === 'milliliter' || unitLower === 'milliliters') return 'ml';
    if (unitLower === 'l' || unitLower === 'liter' || unitLower === 'liters') return 'l';
    if (unitLower === 'cup' || unitLower === 'cups') return 'cup';
    if (unitLower === 'tbsp' || unitLower === 'tablespoon' || unitLower === 'tablespoons') return 'tbsp';
    if (unitLower === 'tsp' || unitLower === 'teaspoon' || unitLower === 'teaspoons') return 'tsp';
    if (unitLower === 'fl oz' || unitLower === 'fluid ounce' || unitLower === 'fluid ounces') return 'fl oz';

    // Count
    if (unitLower === 'piece' || unitLower === 'pieces' || unitLower === 'item' || unitLower === 'items') return 'piece';

    return unit;
  }
}
