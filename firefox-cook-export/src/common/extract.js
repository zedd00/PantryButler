function extractRecipeFromDocument() {
  'use strict';

  function cleanText(text) {
    return String(text == null ? '' : text)
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&#(\d+);/g, function (_m, n) { return String.fromCharCode(Number(n)); })
      .replace(/<[^>]*>/g, '')
      .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, '')
      .replace(/\s+/g, ' ')
      .replace(/^[\s\u25a1\u25a2\u2610\u25aa\u2022\u25e6\u3c9\u25cb\u2022\u2615\u2705\u2756\u2726\u2717]+/, '')
      .trim();
  }

  function parseDuration(value) {
    if (value === undefined || value === null) return undefined;
    const val = Array.isArray(value) ? value[0] : String(value);
    if (!val) return undefined;
    const match = val.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
    if (!match) return undefined;
    const hours = parseInt(match[1] || '0', 10);
    const minutes = parseInt(match[2] || '0', 10);
    return hours * 60 + minutes;
  }

  function parseServings(value) {
    if (value === undefined || value === null) return undefined;
    const text = Array.isArray(value) ? value.join(' ') : String(value);
    const match = text.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : undefined;
  }

  function isIngredientHeader(text) {
    const trimmed = (text || '').trim();
    if (!trimmed || trimmed.length > 60) return false;
    if (/:$/.test(trimmed)) return true;
    const t = trimmed.toLowerCase();
    if (/^for (the )?[a-z ]{2,50}$/.test(t)) return true;
    return /^(marinade|sauce|glaze|dressing|brine|topping|filling|coating|seasoning|the marinade|the sauce|to serve|for serving)$/i.test(trimmed);
  }

  function buildIngredientGroups(rawIngredients) {
    const groups = [];
    let current = { ingredients: [] };

    for (let i = 0; i < rawIngredients.length; i++) {
      const raw = rawIngredients[i];
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

  function firstAttr(selector, attr) {
    const el = document.querySelector(selector);
    return el ? el.getAttribute(attr) : undefined;
  }

  function firstAttrWithin(root, selector, attr) {
    let val = null;
    root.querySelectorAll(selector).forEach(function (el) {
      const a = el.getAttribute(attr);
      if (!val && a) val = a;
    });
    return val;
  }

  function collectWithin(root, selector) {
    const out = [];
    root.querySelectorAll(selector).forEach(function (el) {
      const text = cleanText(el.textContent);
      if (text) out.push(text);
    });
    return out;
  }

  function isRecipeType(item) {
    if (!item) return false;
    const type = item['@type'];
    return type === 'Recipe' || (Array.isArray(type) && type.indexOf('Recipe') !== -1);
  }

  function findRecipeInData(data) {
    if (!data || typeof data !== 'object') return null;
    if (Array.isArray(data)) {
      for (let i = 0; i < data.length; i++) {
        const found = findRecipeInData(data[i]);
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

  function extractSteps(node, out) {
    if (typeof node === 'string') {
      const text = cleanText(node);
      if (text) out.push(text);
      return;
    }
    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i++) extractSteps(node[i], out);
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

  function extractIngredientGroupsFromDom() {
    const groups = [];
    document.querySelectorAll('.wprm-recipe-ingredient-group').forEach(function (el) {
      let titleEl = null;
      el.querySelectorAll('.wprm-recipe-ingredient-group-name').forEach(function (n) {
        if (!titleEl) titleEl = n;
      });
      const title = cleanText(titleEl ? titleEl.textContent : '').replace(/:$/, '');
      const items = [];
      el.querySelectorAll('li.wprm-recipe-ingredient').forEach(function (li) {
        const text = cleanText(li.textContent);
        if (text) items.push(text);
      });
      groups.push({ title: title || undefined, ingredients: items });
    });
    return groups.length > 0 ? groups : null;
  }

  function hasLeadingMeasurement(text) {
    const t = String(text || '').trim();
    return /^[\d.½¼¾⅓⅔⅛⅜⅝⅞](?:\s|$|\/)/.test(t) || /^\d+\s+\d+\s*\/\s*\d+/.test(t);
  }

  function reconcileWithJsonLd(domFlat, jsonLd) {
    if (domFlat.length !== jsonLd.length) return domFlat;
    const out = domFlat.slice();
    for (let i = 0; i < out.length; i++) {
      const domText = out[i];
      const jsonText = jsonLd[i];
      if (jsonText && hasLeadingMeasurement(String(jsonText)) && !hasLeadingMeasurement(String(domText))) {
        out[i] = String(jsonText);
      }
    }
    return out;
  }

  function reconcileGroups(groups, reconciled) {
    let idx = 0;
    for (let g = 0; g < groups.length; g++) {
      for (let k = 0; k < groups[g].ingredients.length; k++) {
        if (idx < reconciled.length) groups[g].ingredients[k] = reconciled[idx];
        idx++;
      }
    }
  }

  function extractFromJsonLd() {
    let best = null;

    document.querySelectorAll('script[type="application/ld+json"]').forEach(function (s) {
      if (best) return;
      let data;
      try {
        data = JSON.parse(s.textContent || '{}');
      } catch (e) {
        return;
      }

      const item = findRecipeInData(data);
      if (!item) return;

      let ingredientGroups = buildIngredientGroups(Array.isArray(item.recipeIngredient) ? item.recipeIngredient : []);
      let ingredients = [];
      ingredientGroups.forEach(function (g) { g.ingredients.forEach(function (i) { ingredients.push(i); }); });

      const instructions = [];
      extractSteps(item.recipeInstructions, instructions);

      const domGroups = extractIngredientGroupsFromDom();
      if (domGroups) {
        const domFlat = [];
        domGroups.forEach(function (g) { g.ingredients.forEach(function (i) { domFlat.push(i); }); });
        const mismatch = Math.abs(domFlat.length - ingredients.length);
        if (domFlat.length > 0 && mismatch <= Math.max(2, Math.floor(ingredients.length * 0.15))) {
          ingredientGroups = domGroups;
          ingredients = reconcileWithJsonLd(domFlat, ingredients);
          reconcileGroups(ingredientGroups, ingredients);
        }
      }

      const image = Array.isArray(item.image) ? item.image[0] : item.image;

      best = {
        title: cleanText(item.name || ''),
        description: cleanText(item.description || ''),
        image_url: typeof image === 'string' ? image : (image ? image.url : undefined),
        servings: parseServings(item.recipeYield || ''),
        prep_time_minutes: parseDuration(item.prepTime),
        cook_time_minutes: parseDuration(item.cookTime),
        total_time_minutes: parseDuration(item.totalTime),
        ingredients: ingredients,
        ingredient_groups: ingredientGroups,
        instructions: instructions
      };
    });

    return best;
  }

  function extractFromMicrodata() {
    const recipeElement = document.querySelector('[itemtype*="schema.org/Recipe"]');
    if (!recipeElement) return null;

    function prop(selector) {
      const el = recipeElement.querySelector(selector);
      return el ? el.textContent : '';
    }

    const title = cleanText(prop('[itemprop="name"]'));
    const description = cleanText(prop('[itemprop="description"]'));

    let image = firstAttrWithin(recipeElement, '[itemprop="image"]', 'src');
    if (!image) image = firstAttrWithin(recipeElement, '[itemprop="image"]', 'content');

    const ingredients = collectWithin(recipeElement, '[itemprop="recipeIngredient"]');

    const instructions = [];
    recipeElement.querySelectorAll('[itemprop="recipeInstructions"]').forEach(function (el) {
      const text = cleanText(el.textContent);
      if (text) instructions.push(text);
    });
    recipeElement.querySelectorAll('[itemprop="step"], [itemprop="itemListElement"]').forEach(function (el) {
      let textEl = null;
      el.querySelectorAll('[itemprop="text"]').forEach(function (t) { if (!textEl) textEl = t; });
      const stepText = textEl ? textEl.textContent : el.textContent;
      const text = cleanText(stepText);
      if (text && instructions.indexOf(text) === -1) instructions.push(text);
    });

    const prepTime = firstAttrWithin(recipeElement, '[itemprop="prepTime"]', 'content') ||
                     firstAttrWithin(recipeElement, '[itemprop="prepTime"]', 'datetime');
    const cookTime = firstAttrWithin(recipeElement, '[itemprop="cookTime"]', 'content') ||
                     firstAttrWithin(recipeElement, '[itemprop="cookTime"]', 'datetime');
    const totalTime = firstAttrWithin(recipeElement, '[itemprop="totalTime"]', 'content') ||
                      firstAttrWithin(recipeElement, '[itemprop="totalTime"]', 'datetime');
    const yieldText = prop('[itemprop="recipeYield"]');

    if (!title && ingredients.length === 0 && instructions.length === 0) return null;

    return {
      title: title,
      description: description,
      image_url: image,
      servings: parseServings(yieldText),
      prep_time_minutes: parseDuration(prepTime || ''),
      cook_time_minutes: parseDuration(cookTime || ''),
      total_time_minutes: parseDuration(totalTime || ''),
      ingredients: ingredients,
      instructions: instructions
    };
  }

  function extractFromHeuristics() {
    let title = cleanText(document.querySelector('h1')
      ? document.querySelector('h1').textContent : '');
    if (!title) {
      const sel = document.querySelector('.recipe-title, .recipe-name, [class*="recipe-title"], [class*="recipe-name"]');
      title = cleanText(sel ? sel.textContent : '');
    }
    if (!title) title = cleanText(document.title);

    let description = cleanText(
      (document.querySelector('.recipe-description, [class*="recipe-description"], [class*="recipe-summary"]')
        ? document.querySelector('.recipe-description, [class*="recipe-description"], [class*="recipe-summary"]').textContent : '') ||
      firstAttr('meta[name="description"]', 'content') || '');
    description = description.substring(0, 500);

    let imageUrl = firstAttr('meta[property="og:image"]', 'content') ||
                   firstAttr('.recipe-image img, [class*="recipe-image"] img', 'src');
    if (!imageUrl) {
      const img = document.querySelector('article img');
      if (img) imageUrl = img.getAttribute('src');
    }
    if (imageUrl) imageUrl = resolveUrl(imageUrl, location.href);

    const ingredientGroups = [];
    let currentIngredientGroup = { ingredients: [] };

    const ingredientSelectors = [
      'li.wprm-recipe-ingredient',
      'li[itemprop="ingredients"]',
      'ul.ingredients li, .ingredients li',
      'ul[class*="ingredient"] li, ol[class*="ingredient"] li',
      '.ingredient, [class*="ingredient"]'
    ];

    function pushIngredient(raw) {
      const clean = raw.replace(/^[•\-\*]\s*/, '');
      if (clean.length <= 2) return;
      if (isIngredientHeader(clean)) {
        if (currentIngredientGroup.ingredients.length > 0) ingredientGroups.push(currentIngredientGroup);
        currentIngredientGroup = { title: clean.replace(/:$/, '').trim(), ingredients: [] };
        return;
      }
      currentIngredientGroup.ingredients.push(clean);
    }

    for (let i = 0; i < ingredientSelectors.length; i++) {
      document.querySelectorAll(ingredientSelectors[i]).forEach(function (el) {
        pushIngredient(cleanText(el.textContent));
      });
      if (currentIngredientGroup.ingredients.length > 0) break;
    }

    if (currentIngredientGroup.ingredients.length > 0) ingredientGroups.push(currentIngredientGroup);
    const ingredients = [];
    ingredientGroups.forEach(function (g) { g.ingredients.forEach(function (i) { ingredients.push(i); }); });

    const instructions = [];
    const instructionSelectors = [
      'li.wprm-recipe-instruction',
      'ol.instructions li, .instructions li',
      '.directions li, [class*="directions"] li',
      '.instruction, [class*="instruction"]',
      '[class*="recipe-step"]',
      '.step, [class*="step"]'
    ];

    for (let i = 0; i < instructionSelectors.length; i++) {
      document.querySelectorAll(instructionSelectors[i]).forEach(function (el) {
        const text = cleanText(el.textContent);
        if (text && text.length > 10 && !text.match(/^(directions:?|instructions:?|method:?)/i)) {
          instructions.push(text.replace(/^[•\-\*]\s*/, ''));
        }
      });
      if (instructions.length > 0) break;
    }

    const servingsEl = document.querySelector('.servings, [class*="servings"], [class*="yield"]');
    const servings = parseServings(servingsEl ? servingsEl.textContent : '');

    if (!title && ingredients.length === 0 && instructions.length === 0) return null;

    return {
      title: title,
      description: description,
      image_url: imageUrl,
      servings: servings,
      ingredients: ingredients,
      ingredient_groups: ingredientGroups,
      instructions: instructions
    };
  }

  function resolveUrl(url, baseUrl) {
    try {
      return new URL(url, baseUrl).href;
    } catch (e) {
      return url;
    }
  }

  let recipe = extractFromJsonLd();
  if (!recipe) recipe = extractFromMicrodata();
  if (!recipe) recipe = extractFromHeuristics();

  if (!recipe) return null;
  if (!recipe.title && recipe.ingredients.length === 0 && recipe.instructions.length === 0) return null;

  recipe.source_url = location.href;
  recipe.page_title = document.title;
  return recipe;
}

if (typeof window !== 'undefined') window.__cookExportExtract = extractRecipeFromDocument;
if (typeof globalThis !== 'undefined') globalThis.__cookExportExtract = extractRecipeFromDocument;
