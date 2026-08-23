/**
 * PantryButler Embeddable Recipe Card
 * 
 * Usage:
 * <div id="pantrybutler-recipe-card" data-recipe-slug="YOUR_SLUG_HERE"></div>
 * <script src="https://your-domain.com/embed.js"></script>
 */

(function() {
  'use strict';

  // Configuration
  // Use the origin that served this script as the API base so embeds work
  // on any self-hosted deployment without hardcoded URLs.
  const API_BASE = (document.currentScript && document.currentScript.src)
    ? new URL(document.currentScript.src).origin
    : window.location.origin;

  // Route external recipe images through the server proxy so embed visitors
  // never contact a third-party host (prevents IP/referrer leaks).
  function proxyImageUrl(url) {
    if (!url) return url;
    if (url.indexOf('data:') === 0 || url.indexOf('blob:') === 0) return url;
    let parsed;
    try {
      parsed = new URL(url, API_BASE);
    } catch (e) {
      return url;
    }
    if (parsed.origin === API_BASE) return url;
    return API_BASE + '/api/images/proxy?url=' + encodeURIComponent(parsed.href);
  }

  // Scoped styles to avoid conflicts with host page
  const styles = `
    .pb-card {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
    }
    .pb-card * {
      box-sizing: border-box;
    }
    .pb-card-image {
      width: 100%;
      height: auto;
      display: block;
    }
    .pb-card-content {
      padding: 24px;
    }
    .pb-card-title {
      font-size: 28px;
      font-weight: 700;
      margin: 0 0 8px 0;
      color: #111827;
    }
    .pb-card-description {
      font-size: 16px;
      color: #6b7280;
      margin: 0 0 16px 0;
      line-height: 1.5;
    }
    .pb-card-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      margin-bottom: 24px;
      font-size: 14px;
      color: #6b7280;
    }
    .pb-card-meta-item {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .pb-card-section {
      margin-bottom: 24px;
    }
    .pb-card-section-title {
      font-size: 20px;
      font-weight: 600;
      margin: 0 0 12px 0;
      color: #111827;
    }
    .pb-card-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    .pb-card-list-item {
      padding: 8px 0;
      border-bottom: 1px solid #f3f4f6;
      line-height: 1.5;
    }
    .pb-card-list-item:last-child {
      border-bottom: none;
    }
    .pb-card-step {
      display: flex;
      gap: 12px;
      margin-bottom: 16px;
    }
    .pb-card-step-number {
      font-weight: 600;
      color: #6b7280;
      flex-shrink: 0;
    }
    .pb-card-step-content {
      flex: 1;
    }
    .pb-card-step-image {
      width: 100%;
      max-width: 400px;
      height: auto;
      border-radius: 4px;
      margin-top: 8px;
    }
    .pb-card-timer {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 14px;
      color: #6b7280;
      margin-top: 8px;
    }
    .pb-card-loading {
      text-align: center;
      padding: 48px 24px;
      color: #6b7280;
    }
    .pb-card-error {
      text-align: center;
      padding: 48px 24px;
      color: #ef4444;
    }
    .pb-card-badge {
      display: inline-block;
      padding: 4px 8px;
      background: #f3f4f6;
      border-radius: 4px;
      font-size: 12px;
      color: #374151;
      margin-right: 8px;
      margin-bottom: 8px;
    }
    @media (max-width: 640px) {
      .pb-card-content {
        padding: 16px;
      }
      .pb-card-title {
        font-size: 24px;
      }
    }
  `;

  // Inject styles
  const styleSheet = document.createElement('style');
  styleSheet.textContent = styles;
  document.head.appendChild(styleSheet);

  // Find all embed containers (data-recipe-slug is the source of truth; the
  // generated snippet also carries an id, but that can only be used once per
  // page, so we support multiple recipe cards via the attribute).
  const containers = Array.from(document.querySelectorAll('[data-recipe-slug]'));
  if (containers.length === 0) {
    console.error('PantryButler: No embed containers found (missing [data-recipe-slug])');
    return;
  }

  containers.forEach(function (container) {
    const slug = container.getAttribute('data-recipe-slug');
    if (!slug) {
      container.innerHTML = '<div class="pb-card"><div class="pb-card-error">Error: No recipe slug provided</div></div>';
      return;
    }

    // Show loading state
    container.innerHTML = '<div class="pb-card"><div class="pb-card-loading">Loading recipe...</div></div>';

    // Fetch recipe data
    fetch(`${API_BASE}/api/recipes/public/${encodeURIComponent(slug)}`)
      .then(response => response.json())
      .then(data => {
        const recipe = data.recipe || data;
        if (data.error || !recipe) {
          throw new Error(data.message || 'Recipe not found');
        }
        renderRecipe(container, recipe);
      })
      .catch(error => {
        console.error('PantryButler: Error loading recipe:', error);
        container.innerHTML = '<div class="pb-card"><div class="pb-card-error">Failed to load recipe. Please try again later.</div></div>';
      });
  });

  function renderRecipe(container, recipe) {
    const totalTime = (recipe.prep_time_minutes || 0) + (recipe.cook_time_minutes || 0) + (recipe.wait_time_minutes || 0);

    let html = '<div class="pb-card">';

    // Image
    if (recipe.image_url) {
      html += `<img src="${escapeHtml(proxyImageUrl(recipe.image_url))}" alt="${escapeHtml(recipe.title)}" class="pb-card-image">`;
    }

    html += '<div class="pb-card-content">';

    // Title and description
    html += `<h2 class="pb-card-title">${escapeHtml(recipe.title)}</h2>`;
    if (recipe.description) {
      html += `<p class="pb-card-description">${escapeHtml(recipe.description)}</p>`;
    }

    // Meta information
    html += '<div class="pb-card-meta">';
    if (totalTime > 0) {
      html += `<div class="pb-card-meta-item">⏱️ ${totalTime} min</div>`;
    }
    html += `<div class="pb-card-meta-item">👥 ${recipe.servings} servings</div>`;
    html += '</div>';

    // Tags
    if (recipe.tags && recipe.tags.length > 0) {
      html += '<div class="pb-card-section">';
      recipe.tags.forEach(tag => {
        html += `<span class="pb-card-badge">${escapeHtml(tag.name)}</span>`;
      });
      html += '</div>';
    }

    // Ingredients
    if (recipe.ingredients && recipe.ingredients.length > 0) {
      html += '<div class="pb-card-section">';
      html += '<h3 class="pb-card-section-title">Ingredients</h3>';
      html += '<ul class="pb-card-list">';
      recipe.ingredients.forEach(ing => {
        let text = '';
        if (ing.quantity > 0) {
          text += `${ing.quantity} ${ing.unit} `;
        }
        text += ing.name;
        if (ing.preparation) {
          text += `, ${ing.preparation}`;
        }
        if (ing.is_optional) {
          text += ' (optional)';
        }
        html += `<li class="pb-card-list-item">${escapeHtml(text)}</li>`;
      });
      html += '</ul></div>';
    }

    // Equipment
    if (recipe.equipment && recipe.equipment.length > 0) {
      html += '<div class="pb-card-section">';
      html += '<h3 class="pb-card-section-title">Equipment</h3>';
      html += '<ul class="pb-card-list">';
      recipe.equipment.forEach(eq => {
        html += `<li class="pb-card-list-item">${escapeHtml(eq.equipment_name)}</li>`;
      });
      html += '</ul></div>';
    }

    // Instructions
    if (recipe.sections && recipe.sections.length > 0) {
      recipe.sections.forEach(section => {
        html += '<div class="pb-card-section">';
        html += `<h3 class="pb-card-section-title">${escapeHtml(section.title)}</h3>`;
        
        if (section.steps && section.steps.length > 0) {
          section.steps.forEach(step => {
            html += '<div class="pb-card-step">';
            html += `<div class="pb-card-step-number">${step.order_index + 1}.</div>`;
            html += '<div class="pb-card-step-content">';
            html += `<p>${escapeHtml(step.instruction)}</p>`;
            
            if (step.image_url) {
              html += `<img src="${escapeHtml(proxyImageUrl(step.image_url))}" alt="Step ${step.order_index + 1}" class="pb-card-step-image">`;
            }
            
            if (step.timer_minutes && step.timer_minutes > 0) {
              html += `<div class="pb-card-timer">⏱️ ${step.timer_minutes} minutes</div>`;
            }
            
            html += '</div></div>';
          });
        }
        
        html += '</div>';
      });
    }

    // Notes
    if (recipe.notes) {
      html += '<div class="pb-card-section">';
      html += '<h3 class="pb-card-section-title">Notes</h3>';
      html += `<p style="white-space: pre-wrap;">${escapeHtml(recipe.notes)}</p>`;
      html += '</div>';
    }

    html += '</div></div>';

    container.innerHTML = html;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
})();
