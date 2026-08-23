import { Hono } from 'hono';
import { load } from 'cheerio';
import { requireAuth, requireJwt } from '../middleware/auth';
import { logError } from '../utils/log';
import { createRateLimiter } from '../utils/rate-limit';
import { clientIp } from '../utils/client-ip';
import { resolveHostBlocked, fetchPublicCapped, TooLargeError, BlockedUrlError } from '../utils/ssrf';

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

function parseDuration(duration: unknown): number | undefined {
  if (duration === undefined || duration === null) return undefined;

  const value = Array.isArray(duration) ? duration[0] : String(duration);
  if (!value) return undefined;

  const match = value.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!match) return undefined;

  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);

  return hours * 60 + minutes;
}

function parseServings(text: unknown): number | undefined {
  if (text === undefined || text === null) return undefined;

  const value = Array.isArray(text) ? text.join(' ') : String(text);
  if (!value) return undefined;

  const match = value.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : undefined;
}

function cleanText(text: string): string {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_m, n) => String.fromCharCode(Number(n)))
    .replace(/<[^>]*>/g, '')
    .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s▢□☐▪•◦○●✔☑✦✧✿]+/, '')
    .trim();
}

function resolveUrl(url: string, baseUrl: string): string {
  try {
    return new URL(url, baseUrl).href;
  } catch {
    return url;
  }
}

function isRecipeType(item: any): boolean {
  const type = item?.['@type'];
  return type === 'Recipe' || (Array.isArray(type) && type.includes('Recipe'));
}

/**
 * Heuristic: an ingredient-list line is a section heading when it's short and
 * either ends with a colon ("For the Marinade:", "Ingredients:") or reads like
 * a list title ("For the Marinade", "To Serve", "Sauce").
 */
function isIngredientHeader(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 60) return false;
  if (/:$/.test(trimmed)) return true;
  const t = trimmed.toLowerCase();
  if (/^for (the )?[a-z ]{2,50}$/.test(t)) return true;
  return /^(marinade|sauce|glaze|dressing|brine|topping|filling|coating|seasoning|the marinade|the sauce|to serve|for serving)$/i.test(trimmed);
}

function buildIngredientGroups(rawIngredients: unknown[]): { title?: string; ingredients: string[] }[] {
  const groups: { title?: string; ingredients: string[] }[] = [];
  let current: { title?: string; ingredients: string[] } = { ingredients: [] };

  for (const raw of rawIngredients) {
    const text = cleanText(typeof raw === 'string' ? raw : '');
    if (!text) continue;

    if (isIngredientHeader(text)) {
      if (current.ingredients.length > 0) groups.push(current);
      current = { title: text.replace(/:$/, '').trim(), ingredients: [] };
      continue;
    }

    current.ingredients.push(text);
  }

  if (current.ingredients.length > 0) groups.push(current);
  return groups;
}

/**
 * WPRM (WP Recipe Maker) sites render ingredient groups as separate
 * <div class="wprm-recipe-ingredient-group"> blocks with their own heading
 * (<h4 class="wprm-recipe-ingredient-group-name">) and list. This structure is
 * frequently missing from the JSON-LD recipeIngredient array (which is just a
 * flat list), so recover the groups from the rendered HTML.
 */
function extractIngredientGroupsFromDom($: any): { title?: string; ingredients: string[] }[] | null {
  const groups: { title?: string; ingredients: string[] }[] = [];

  $('.wprm-recipe-ingredient-group').each((_i: number, el: any) => {
    const title = cleanText($(el).find('.wprm-recipe-ingredient-group-name').first().text()).replace(/:$/, '');
    const items: string[] = [];
    $(el).find('li.wprm-recipe-ingredient').each((_j: number, li: any) => {
      const text = cleanText($(li).text());
      if (text) items.push(text);
    });
    groups.push({ title: title || undefined, ingredients: items });
  });

  return groups.length > 0 ? groups : null;
}

function findRecipeInData(data: any): any | null {
  if (!data || typeof data !== 'object') return null;

  if (Array.isArray(data)) {
    for (const item of data) {
      const found = findRecipeInData(item);
      if (found) return found;
    }
    return null;
  }

  if (isRecipeType(data)) return data;

  for (const key of Object.keys(data)) {
    if (key === '@context' || key === '@id' || key === '@type') continue;
    const found = findRecipeInData(data[key]);
    if (found) return found;
  }

  return null;
}

/**
 * Recursively pull step text out of JSON-LD recipeInstructions.
 *
 * W3C HowTo markup can nest steps in several shapes:
 *   - a plain string
 *   - a HowToStep object with `.text` (and sometimes `.name`)
 *   - a HowToSection object (`{ name, itemListElement: [...] }`) whose items
 *     are themselves steps or sections
 */
function extractSteps(node: any, out: string[]) {
  if (typeof node === 'string') {
    const text = cleanText(node);
    if (text) out.push(text);
    return;
  }

  if (Array.isArray(node)) {
    for (const n of node) extractSteps(n, out);
    return;
  }

  if (node && typeof node === 'object') {
    const text = typeof node.text === 'string' ? node.text : (typeof node.name === 'string' ? node.name : '');
    const cleaned = cleanText(text);
    if (cleaned) out.push(cleaned);
    if (node.itemListElement) extractSteps(node.itemListElement, out);
    if (node.steps) extractSteps(node.steps, out);
  }
}

function extractFromJsonLd(html: string): ExtractedRecipe | null {
  const $ = load(html);
  const scripts = $('script[type="application/ld+json"]');

  for (let i = 0; i < scripts.length; i++) {
    try {
      const data = JSON.parse($(scripts[i]).html() || '{}');

      const item = findRecipeInData(data);
      if (!item) return null;

      const ingredientGroups = buildIngredientGroups(Array.isArray(item.recipeIngredient) ? item.recipeIngredient : []);
      const ingredients = ingredientGroups.flatMap((g) => g.ingredients);

      let instructions: string[] = [];
      extractSteps(item.recipeInstructions, instructions);

      const imageUrl = Array.isArray(item.image) ? item.image[0] : item.image;

      return {
        title: cleanText(item.name || ''),
        description: cleanText(item.description || ''),
        image_url: typeof imageUrl === 'string' ? imageUrl : imageUrl?.url,
        servings: parseServings(item.recipeYield || ''),
        prep_time_minutes: parseDuration(item.prepTime),
        cook_time_minutes: parseDuration(item.cookTime),
        total_time_minutes: parseDuration(item.totalTime),
        ingredients,
        ingredient_groups: ingredientGroups,
        instructions
      };
    } catch (e) {
      logError('Error parsing JSON-LD', e);
    }
  }

  return null;
}

function extractFromMicrodata(html: string): ExtractedRecipe | null {
  const $ = load(html);
  const recipeElement = $('[itemtype*="schema.org/Recipe"]').first();

  if (recipeElement.length === 0) return null;

  const title = recipeElement.find('[itemprop="name"]').first().text();
  const description = recipeElement.find('[itemprop="description"]').first().text();
  const image = recipeElement.find('[itemprop="image"]').first().attr('src') ||
                recipeElement.find('[itemprop="image"]').first().attr('content');

  const ingredients: string[] = [];
  recipeElement.find('[itemprop="recipeIngredient"]').each((_i: number, el: any) => {
    const text = cleanText($(el).text());
    if (text) ingredients.push(text);
  });

  const instructions: string[] = [];
  recipeElement.find('[itemprop="recipeInstructions"]').each((_i: number, el: any) => {
    const text = cleanText($(el).text());
    if (text) instructions.push(text);
  });

  recipeElement.find('[itemprop="step"], [itemprop="itemListElement"]').each((_i: number, el: any) => {
    const stepText = $(el).find('[itemprop="text"]').text() || $(el).text();
    const text = cleanText(stepText);
    if (text && !instructions.includes(text)) instructions.push(text);
  });

  const prepTime = recipeElement.find('[itemprop="prepTime"]').attr('content') ||
                   recipeElement.find('[itemprop="prepTime"]').attr('datetime');
  const cookTime = recipeElement.find('[itemprop="cookTime"]').attr('content') ||
                   recipeElement.find('[itemprop="cookTime"]').attr('datetime');
  const totalTime = recipeElement.find('[itemprop="totalTime"]').attr('content') ||
                    recipeElement.find('[itemprop="totalTime"]').attr('datetime');
  const yield_ = recipeElement.find('[itemprop="recipeYield"]').text();

  if (!title && ingredients.length === 0 && instructions.length === 0) return null;

  return {
    title: cleanText(title),
    description: cleanText(description),
    image_url: image,
    servings: parseServings(yield_),
    prep_time_minutes: parseDuration(prepTime || ''),
    cook_time_minutes: parseDuration(cookTime || ''),
    total_time_minutes: parseDuration(totalTime || ''),
    ingredients,
    instructions
  };
}

function extractFromHeuristics(html: string, baseUrl: string): ExtractedRecipe | null {
  const $ = load(html);

  let title = $('h1').first().text() ||
              $('.recipe-title, .recipe-name, [class*="recipe-title"], [class*="recipe-name"]').first().text() ||
              $('title').text();
  title = cleanText(title);

  const description = cleanText(
    $('.recipe-description, [class*="recipe-description"], [class*="recipe-summary"]').first().text() ||
    $('meta[name="description"]').attr('content') || ''
  );

  let imageUrl = $('meta[property="og:image"]').attr('content') ||
                 $('.recipe-image img, [class*="recipe-image"] img').first().attr('src') ||
                 $('article img').first().attr('src');

  if (imageUrl) {
    imageUrl = resolveUrl(imageUrl, baseUrl);
  }

  const ingredientGroups: { title?: string; ingredients: string[] }[] = [];
  let currentIngredientGroup: { title?: string; ingredients: string[] } = { ingredients: [] };

  const pushIngredient = (text: string) => {
    const clean = text.replace(/^[•\-\*]\s*/, '');
    if (clean.length <= 2) return;

    if (isIngredientHeader(clean)) {
      if (currentIngredientGroup.ingredients.length > 0) {
        ingredientGroups.push(currentIngredientGroup);
      }
      currentIngredientGroup = { title: clean.replace(/:$/, '').trim(), ingredients: [] };
      return;
    }

    currentIngredientGroup.ingredients.push(clean);
  };

  const ingredientSelectors = [
    'li.wprm-recipe-ingredient',
    'li[itemprop="ingredients"]',
    'ul.ingredients li, .ingredients li',
    'ul[class*="ingredient"] li, ol[class*="ingredient"] li',
    '.ingredient, [class*="ingredient"]'
  ];

  for (const selector of ingredientSelectors) {
    $(selector).each((_i: number, el: any) => {
      pushIngredient(cleanText($(el).text()));
    });
    if (currentIngredientGroup.ingredients.length > 0) break;
  }

  if (currentIngredientGroup.ingredients.length > 0) {
    ingredientGroups.push(currentIngredientGroup);
  }

  const ingredients = ingredientGroups.flatMap((g) => g.ingredients);

  const instructions: string[] = [];
  const instructionSelectors = [
    'li.wprm-recipe-instruction',
    'ol.instructions li, .instructions li',
    '.directions li, [class*="directions"] li',
    '.instruction, [class*="instruction"]',
    '[class*="recipe-step"]',
    '.step, [class*="step"]'
  ];

  for (const selector of instructionSelectors) {
    $(selector).each((_i: number, el: any) => {
      const text = cleanText($(el).text());
      if (text && text.length > 10 && !text.match(/^(directions:?|instructions:?|method:?)/i)) {
        instructions.push(text.replace(/^[•\-\*]\s*/, ''));
      }
    });
    if (instructions.length > 0) break;
  }

  const servingsText = $('.servings, [class*="servings"], [class*="yield"]').first().text();
  const servings = parseServings(servingsText);

  if (!title && ingredients.length === 0 && instructions.length === 0) return null;

  return {
    title,
    description: description.substring(0, 500),
    image_url: imageUrl,
    servings,
    ingredients,
    ingredient_groups: ingredientGroups,
    instructions
  };
}

const extractRecipe = new Hono();

extractRecipe.use('*', requireAuth, requireJwt);

// Each call opens up to MAX_REDIRECTS+1 outbound connections with a 5 MB cap,
// so bound how often one caller can trigger fetches.
const extractLimiter = createRateLimiter(30, 60 * 1000);

extractRecipe.post('/', async (c) => {
  try {
    if (!extractLimiter(clientIp(c))) {
      return c.json({ error: 'rateLimited', message: 'Too many requests, please try again later' }, 429);
    }
    const { url } = await c.req.json<{ url: string }>();

    if (!url || typeof url !== 'string') {
      return c.json({ error: 'invalidUrl', message: 'URL is required' }, 400);
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error('Invalid protocol');
      }
    } catch {
      return c.json({ error: 'invalidUrl', message: 'Invalid URL format' }, 400);
    }

    if (await resolveHostBlocked(parsedUrl.hostname)) {
      return c.json({ error: 'blockedUrl', message: 'URL is not allowed' }, 403);
    }

    let fetched: { response: { ok: boolean; status: number }; bytes: Buffer; contentType: string };
    try {
      fetched = await fetchPublicCapped(url);
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        return c.json({ error: 'timeout', message: 'Request timed out' }, 408);
      }
      if (error instanceof TooLargeError) {
        return c.json({ error: 'tooLarge', message: error.message }, 413);
      }
      if (error instanceof BlockedUrlError) {
        return c.json({ error: 'blockedUrl', message: 'URL is not allowed' }, 403);
      }
      return c.json({ error: 'fetchFailed', message: 'Failed to fetch URL' }, 500);
    }

    if (!fetched.response.ok) {
      return c.json({ error: 'fetchFailed', message: `HTTP ${fetched.response.status}` }, fetched.response.status as 400 | 401 | 402 | 403 | 404 | 405 | 406 | 407 | 408 | 409 | 410 | 411 | 412 | 413 | 414 | 415 | 416 | 417 | 421 | 422 | 423 | 424 | 425 | 426 | 428 | 429 | 431 | 451 | 500 | 502 | 503 | 504 | 505 | 506 | 507 | 508 | 510 | 511);
    }

    const html = fetched.bytes.toString('utf-8');

    let recipe = extractFromJsonLd(html);
    if (!recipe) recipe = extractFromMicrodata(html);
    if (!recipe) recipe = extractFromHeuristics(html, url);

    // WPRM pages carry ingredient groups only in the HTML. Adopt them when the
    // DOM list lines up with the ingredients extracted from the structured data.
    if (recipe) {
      const domGroups = extractIngredientGroupsFromDom(load(html));
      if (domGroups) {
        const domFlat = domGroups.flatMap((g) => g.ingredients);
        const extractedFlat = recipe.ingredients;
        const mismatch = Math.abs(domFlat.length - extractedFlat.length);
        if (domFlat.length > 0 && mismatch <= Math.max(2, Math.floor(extractedFlat.length * 0.15))) {
          recipe.ingredient_groups = domGroups;
          recipe.ingredients = domFlat;
        }
      }
    }

    if (!recipe || (!recipe.title && recipe.ingredients.length === 0 && recipe.instructions.length === 0)) {
      return c.json({ error: 'noRecipe', message: 'No recipe found on this page' }, 404);
    }

    if (!recipe.title || (recipe.ingredients.length === 0 && recipe.instructions.length === 0)) {
      return c.json({ error: 'noRecipe', message: 'Recipe is missing critical fields' }, 422);
    }

    return c.json({ recipe }, 200);
  } catch (error: any) {
    logError('Error extracting recipe', error);
    // Never echo error.message to the client — it can contain internal paths,
    // dependency internals, or URLs.
    return c.json({ error: 'parsing', message: 'Failed to parse recipe' }, 500);
  }
});

export { extractRecipe };
