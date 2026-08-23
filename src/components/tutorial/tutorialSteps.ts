import type { Step } from 'react-joyride';
import type { TFunction } from 'i18next';

export const getRecipesTutorialSteps = (t: TFunction): Step[] => [
  {
    target: 'body',
    content: t('tutorial:recipes.welcome'),
    placement: 'center',
  },
  {
    target: '[data-tutorial="nav-recipes"]',
    content: t('tutorial:recipes.navRecipes'),
    placement: 'right',
  },
  {
    target: '[data-tutorial="nav-grocery"]',
    content: t('tutorial:recipes.navGrocery'),
    placement: 'right',
  },
  {
    target: '[data-tutorial="nav-calendar"]',
    content: t('tutorial:recipes.navCalendar'),
    placement: 'right',
  },
  {
    target: '[data-tutorial="nav-pantry"]',
    content: t('tutorial:recipes.navPantry'),
    placement: 'right',
  },
  {
    target: '[data-tutorial="notifications"]',
    content: t('tutorial:recipes.notifications'),
    placement: 'bottom',
  },
  {
    target: '[data-tutorial="user-menu"]',
    content: t('tutorial:recipes.userMenu'),
    placement: 'bottom',
  },
  {
    target: '[data-tutorial="add-recipe"]',
    content: t('tutorial:recipes.addRecipe'),
    placement: 'bottom',
  },
  {
    target: '[data-tutorial="search-recipes"]',
    content: t('tutorial:recipes.searchRecipes'),
    placement: 'bottom',
  },
  {
    target: '[data-tutorial="filter-folder"]',
    content: t('tutorial:recipes.filterFolder'),
    placement: 'bottom',
  },
  {
    target: '[data-tutorial="filter-tags"]',
    content: t('tutorial:recipes.filterTags'),
    placement: 'bottom',
  },
  {
    target: '[data-tutorial="recipe-card"]',
    content: t('tutorial:recipes.recipeCard'),
    placement: 'top',
  },
];

export const getIngredientsTutorialSteps = (t: TFunction): Step[] => [
  {
    target: 'body',
    content: t('tutorial:ingredients.welcome'),
    placement: 'center',
  },
  {
    target: '[data-tutorial="add-ingredient"]',
    content: t('tutorial:ingredients.addIngredient'),
    placement: 'bottom',
  },
  {
    target: '[data-tutorial="search-ingredients"]',
    content: t('tutorial:ingredients.searchIngredients'),
    placement: 'bottom',
  },
  {
    target: '[data-tutorial="filter-location"]',
    content: t('tutorial:ingredients.filterLocation'),
    placement: 'bottom',
  },
  {
    target: '[data-tutorial="ingredient-row"]',
    content: t('tutorial:ingredients.ingredientRow'),
    placement: 'top',
  },
  {
    target: '[data-tutorial="ingredient-actions"]',
    content: t('tutorial:ingredients.ingredientActions'),
    placement: 'left',
  },
];

export const getEquipmentTutorialSteps = (t: TFunction): Step[] => [
  {
    target: 'body',
    content: t('tutorial:equipment.welcome'),
    placement: 'center',
  },
  {
    target: '[data-tutorial="add-equipment"]',
    content: t('tutorial:equipment.addEquipment'),
    placement: 'bottom',
  },
  {
    target: '[data-tutorial="search-equipment"]',
    content: t('tutorial:equipment.searchEquipment'),
    placement: 'bottom',
  },
  {
    target: '[data-tutorial="equipment-location"]',
    content: t('tutorial:equipment.equipmentLocation'),
    placement: 'top',
  },
];

export const getGroceryListTutorialSteps = (t: TFunction): Step[] => [
  {
    target: 'body',
    content: t('tutorial:groceryList.welcome'),
    placement: 'center',
  },
  {
    target: '[data-tutorial="add-item"]',
    content: t('tutorial:groceryList.addItem'),
    placement: 'bottom',
  },
  {
    target: '[data-tutorial="add-from-recipe"]',
    content: t('tutorial:groceryList.addFromRecipe'),
    placement: 'bottom',
  },
  {
    target: '[data-tutorial="check-item"]',
    content: t('tutorial:groceryList.checkItem'),
    placement: 'left',
  },
  {
    target: '[data-tutorial="move-to-pantry"]',
    content: t('tutorial:groceryList.moveToPantry'),
    placement: 'bottom',
  },
];

export const getMealPlanTutorialSteps = (t: TFunction): Step[] => [
  {
    target: 'body',
    content: t('tutorial:mealPlan.welcome'),
    placement: 'center',
  },
  {
    target: '[data-tutorial="calendar-view"]',
    content: t('tutorial:mealPlan.calendarView'),
    placement: 'bottom',
  },
  {
    target: '[data-tutorial="add-meal"]',
    content: t('tutorial:mealPlan.addMeal'),
    placement: 'bottom',
  },
  {
    target: '[data-tutorial="mark-cooked"]',
    content: t('tutorial:mealPlan.markCooked'),
    placement: 'bottom',
  },
];

export const getSettingsTutorialSteps = (t: TFunction): Step[] => [
  {
    target: 'body',
    content: t('tutorial:settings.welcome'),
    placement: 'center',
  },
  {
    target: '[data-tutorial="unit-system"]',
    content: t('tutorial:settings.unitSystem'),
    placement: 'right',
  },
  {
    target: '[data-tutorial="theme"]',
    content: t('tutorial:settings.theme'),
    placement: 'right',
  },
  {
    target: '[data-tutorial="language"]',
    content: t('tutorial:settings.language'),
    placement: 'right',
  },
  {
    target: '[data-tutorial="nutrition"]',
    content: t('tutorial:settings.nutrition'),
    placement: 'right',
  },
  {
    target: '[data-tutorial="export-data"]',
    content: t('tutorial:settings.exportData'),
    placement: 'right',
  },
];

export const getRecipeDetailTutorialSteps = (t: TFunction): Step[] => [
  {
    target: 'body',
    content: t('tutorial:recipeDetail.welcome'),
    placement: 'center',
  },
  {
    target: '[data-tutorial="ingredients-list"]',
    content: t('tutorial:recipeDetail.ingredients'),
    placement: 'right',
  },
  {
    target: '[data-tutorial="timer-button"]',
    content: t('tutorial:recipeDetail.timer'),
    placement: 'left',
  },
  {
    target: '[data-tutorial="cooking-steps"]',
    content: t('tutorial:recipeDetail.steps'),
    placement: 'top',
  },
  {
    target: '[data-tutorial="scale-servings"]',
    content: t('tutorial:recipeDetail.scale'),
    placement: 'bottom',
  },
  {
    target: '[data-tutorial="recipe-notes"]',
    content: t('tutorial:recipeDetail.notes'),
    placement: 'top',
  },
];

export const getKitchenPantryTutorialSteps = (t: TFunction): Step[] => [
  {
    target: 'body',
    content: t('tutorial:kitchenPantry.welcome'),
    placement: 'center',
  },
  {
    target: '[data-tutorial="add-location"]',
    content: t('tutorial:kitchenPantry.addLocation'),
    placement: 'bottom',
  },
  {
    target: '[data-tutorial="drag-drop"]',
    content: t('tutorial:kitchenPantry.dragDrop'),
    placement: 'top',
  },
  {
    target: '[data-tutorial="visual-view"]',
    content: t('tutorial:kitchenPantry.visualView'),
    placement: 'bottom',
  },
  {
    target: '[data-tutorial="quick-access"]',
    content: t('tutorial:kitchenPantry.quickAccess'),
    placement: 'top',
  },
];
