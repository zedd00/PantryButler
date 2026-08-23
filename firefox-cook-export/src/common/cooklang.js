(function (global) {
  'use strict';

  var UNIT_STOPWORDS = new Set([
    'a', 'an', 'two', 'in', 'of', 'til', 'the', 'and', 'or', 'plus',
    'large', 'small', 'medium', 'fresh', 'ground', 'pinch', 'dash',
    'chopped', 'diced', 'peeled', 'finely', 'to', 'taste', 'handful',
    'bunch'
  ]);

  var QTY_RE = /^(\d+\s+\d+\s*\/\s*\d+|\d+\s*\/\s*\d+|\d+(?:[.,]\d+)?)/;

  function normalizeFraction(value) {
    var mixed = value.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)/);
    if (mixed) {
      return String(parseInt(mixed[1], 10) + parseInt(mixed[2], 10) / parseInt(mixed[3], 10));
    }
    var frac = value.match(/^(\d+)\s*\/\s*(\d+)/);
    if (frac) {
      return String(parseInt(frac[1], 10) / parseInt(frac[2], 10));
    }
    var n = Number(value.replace(',', '.'));
    return Number.isInteger(n) ? String(n) : value;
  }

  function splitQuantity(text) {
    var clean = String(text).replace(/\s+/g, ' ').trim();
    var m = clean.match(QTY_RE);
    if (!m) return { qty: null, rest: clean };
    var qty = normalizeFraction(m[1].trim());
    var rest = clean.slice(m[1].length).trim();
    rest = rest.replace(/^(of)\s+/i, '');
    return { qty: qty, rest: rest };
  }

  function parseIngredient(raw) {
    var clean = String(raw == null ? '' : raw).replace(/\s+/g, ' ').trim();
    if (!clean) return null;

    var split = splitQuantity(clean);
    var qty = split.qty;
    var rest = split.rest;

    var words = rest.split(' ');
    var unit = null;
    var name;

    if (qty && words.length > 1 && !UNIT_STOPWORDS.has(words[0].toLowerCase())) {
      unit = words[0];
      name = words.slice(1).join(' ');
    } else {
      name = rest;
    }
    if (!name) name = unit;
    if (!name) return null;
    if (unit && (name === unit)) unit = null;

    return { qty: qty, unit: unit, name: name };
  }

  function tokenFor(ing) {
    if (!ing || !ing.name) return '';
    if (ing.qty && ing.unit) return '@' + ing.name + '{' + ing.qty + '%' + ing.unit + '}';
    if (ing.qty) return '@' + ing.name + '{' + ing.qty + '}';
    if (ing.unit) return '@' + ing.name + '{1%' + ing.unit + '}';
    if (/\s/.test(ing.name)) return '@' + ing.name + '{}';
    return '@' + ing.name;
  }

  function escapeRegExp(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function firstNonEmpty() {
    for (var i = 0; i < arguments.length; i++) {
      if (arguments[i] != null && String(arguments[i]).trim() !== '') return arguments[i];
    }
    return undefined;
  }

  function ingredientListOf(recipe) {
    if (recipe.ingredient_groups && recipe.ingredient_groups.length > 0) {
      var flat = [];
      recipe.ingredient_groups.forEach(function (g) { flat = flat.concat(g.ingredients || []); });
      return flat;
    }
    return Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
  }

  /**
   * Build the ingredient section. Handles flat lists and group arrays.
   * Lines of the form "for the X:" become group headers (emitted as = X =).
   * Returns { section: string[], tokens: [{name, token}] }.
   */
  function renderIngredients(rawIngredients) {
    var section = [];
    var tokens = [];
    var header = null;

    function flushHeader() {
      if (header) {
        section.push('= ' + header + ' =');
        header = null;
      }
    }

    function pushLine(line) {
      var s = String(line == null ? '' : (typeof line === 'string' ? line : line.name || '')).trim();
      if (!s) return;
      if (/^[\w\s-]{2,60}:$/.test(s)) {
        flushHeader();
        header = s.replace(/:$/, '').trim();
        return;
      }
      var parsed = parseIngredient(s);
      var token = parsed ? tokenFor(parsed) : '';
      section.push(token || s);
      if (parsed && parsed.name) tokens.push({ name: parsed.name, token: token });
    }

    if (Array.isArray(rawIngredients)) {
      var isGroups = rawIngredients.length > 0 && typeof rawIngredients[0] === 'object';
      if (isGroups) {
        rawIngredients.forEach(function (g) {
          if (g.title) {
            flushHeader();
            header = g.title;
          }
          (g.ingredients || []).forEach(pushLine);
        });
      } else {
        rawIngredients.forEach(pushLine);
      }
    }
    flushHeader();

    return { section: section, tokens: tokens };
  }

  // Split a step into plain-text chunks and existing cooklang tokens so the
  // inliner only rewrites words outside of already-emitted @{} tokens.
  function splitOutsideTokens(text) {
    var chunks = [];
    var re = /@[^\s@#~{]+(?:{[^}]*})?/g;
    var last = 0;
    var m;
    while ((m = re.exec(text)) !== null) {
      if (m.index > last) chunks.push({ plain: text.slice(last, m.index) });
      chunks.push({ token: m[0] });
      last = m.index + m[0].length;
    }
    if (last < text.length) chunks.push({ plain: text.slice(last) });
    if (chunks.length === 0) chunks.push({ plain: text });
    return chunks;
  }

  function inlineTokens(steps, tokens) {
    var sorted = tokens.slice().sort(function (a, b) { return b.name.length - a.name.length; });
    return (steps || []).map(function (step) {
      var text = String(step);
      var parts = splitOutsideTokens(text);
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i];
        if (!p.plain) continue;
        sorted.forEach(function (t) {
          var re = new RegExp('\\b(' + escapeRegExp(t.name) + ')\\b(?!@)', 'i');
          p.plain = p.plain.replace(re, t.token);
        });
      }
      return parts.map(function (p) { return p.token || p.plain; }).join('');
    });
  }

  function buildCooklang(recipe, overrides) {
    overrides = overrides || {};

    var meta = {};
    var title = firstNonEmpty(overrides.title, recipe.title);
    if (title) meta.title = title;

    var description = firstNonEmpty(overrides.description, recipe.description);
    if (description) meta.description = description;

    var servings = overrides.servings != null ? overrides.servings : recipe.servings;
    if (servings) meta.servings = String(servings);

    var prep = overrides.prep != null ? overrides.prep : recipe.prep_time_minutes;
    if (prep) meta['prep time'] = prep + ' minutes';

    var cook = overrides.cook != null ? overrides.cook : recipe.cook_time_minutes;
    if (cook) meta['cook time'] = cook + ' minutes';

    var total = overrides.total != null ? overrides.total : recipe.total_time_minutes;
    if (total) meta['total time'] = total + ' minutes';

    if (overrides.source) meta.source = overrides.source;
    if (overrides.notes) meta.notes = overrides.notes;
    if (overrides.tags) meta.tags = overrides.tags;

    var rawIngredients = overrides.ingredients != null ? overrides.ingredients : recipe.ingredient_groups || recipe.ingredients;
    var rawSteps = overrides.instructions != null ? overrides.instructions : recipe.instructions;

    var rendered = renderIngredients(rawIngredients);
    var steps = inlineTokens(rawSteps, rendered.tokens);

    var out = [];
    out.push('---');
    Object.keys(meta).forEach(function (key) { out.push(key + ': ' + meta[key]); });
    out.push('---');
    out.push('');

    if (rendered.section.length > 0) {
      out.push('Ingredients');
      rendered.section.forEach(function (l) { out.push(l); });
      out.push('');
    }

    out.push('= Instructions =');
    steps.forEach(function (s) {
      if (s && s.trim()) out.push(s);
    });

    return out.join('\n') + '\n';
  }

  function slugify(title) {
    return (String(title || 'recipe')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80)) || 'recipe';
  }

  global.CookExport = {
    buildCooklang: buildCooklang,
    parseIngredient: parseIngredient,
    tokenFor: tokenFor,
    slugify: slugify
  };
})(typeof self !== 'undefined' ? self : this);