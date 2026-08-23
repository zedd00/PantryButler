// User and Profile Types
export type UserRole = 'user' | 'admin' | 'viewer';

export interface Profile {
  id: string;
  username: string; // Full email address
  display_name: string;
  avatar_url?: string | null; // Profile picture URL
  instance_id: string;
  created_at: string;
}

// Instance Types
export interface Instance {
  id: string;
  name: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface InstanceMember {
  id: string;
  instance_id: string;
  user_id: string;
  role: UserRole;
  can_edit_calendar: boolean;
  joined_at: string;
}

// Equipment Types
export interface Equipment {
  id: string;
  instance_id: string;
  name: string;
  location: string | null;
  created_at: string;
}

// Notification Types
export interface Notification {
  id: string;
  user_id: string;
  instance_id: string;
  type: 'conversion_warning' | 'import_success' | 'import_failure';
  title: string;
  message: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

// Folder Types
export interface Folder {
  id: string;
  name: string;
  owner_id: string;
  instance_id: string;
  parent_folder_id: string | null; // For nested folders
  created_at: string;
}

// Tag Types
export interface Tag {
  id: string;
  name: string;
  instance_id: string;
  created_at: string;
}

// Recipe Types
export interface Recipe {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  folder_id: string | null;
  owner_id: string;
  instance_id: string;
  prep_time_minutes: number | null;
  cook_time_minutes: number | null;
  servings: number;
  notes: string | null;
  imported_from_recipe_id: string | null; // Source recipe ID
  imported_from_user_id: string | null;
  imported_from_instance_id: string | null;
  import_count: number;
  is_public: boolean;
  public_slug: string | null;
  source_recipe_id: string | null; // If copied from seed recipe
  is_seed_copy: boolean; // Indicates if copied from seed library
  grid_recipe?: GridRecipe | null; // Optional grid (recipe_grid-style) representation
  created_at: string;
  updated_at: string;
}

// Grid recipe (recipe_grid style) tree
export interface GridIngredientNode {
  type: 'ingredient';
  ingredientOrderIndex: number; // index into recipe.ingredients
}

export interface GridStepNode {
  type: 'step';
  text: string; // short label, limited to 60 chars
  inputs: GridRecipeNode[];
}

export type GridRecipeNode = GridIngredientNode | GridStepNode;

export interface GridRecipe {
  root: GridStepNode;
}

export interface RecipeWithDetails extends Recipe {
  folder?: Folder;
  tags?: Tag[];
  equipment?: RecipeEquipment[];
  ingredients?: RecipeIngredient[];
  sections?: RecipeSectionWithSteps[];
  owner?: Profile;
  imported_from_user_name?: string | null;
  imported_from_instance_name?: string | null;
}

export interface RecipeEquipment {
  id: string;
  recipe_id: string;
  equipment_id: string;
  order_index: number;
}

export interface RecipeIngredient {
  id: string;
  recipe_id: string;
  name: string;
  preparation: string | null;
  quantity: number;
  unit: string;
  is_optional: boolean;
  order_index: number;
  substitutions: string | null;
  notes: string | null;
  prep_style: string | null;
  nutrition_food_id: string | null;
  group_name: string | null;
}

export interface RecipeSection {
  id: string;
  recipe_id: string;
  title: string;
  order_index: number;
}

export interface RecipeSectionWithSteps extends RecipeSection {
  steps: RecipeStep[];
}

export interface RecipeStep {
  id: string;
  recipe_id: string;
  section_id: string | null;
  order_index: number;
  instruction: string;
  image_url: string | null;
  timer_minutes: number | null;
}

// Pantry Types
export interface PantryItem {
  id: string;
  user_id: string;
  instance_id: string;
  ingredient_name: string;
  preparation: string | null;
  unit: string;
  amount: number;
  price: string | null;
  price_size: string | null;
  location: string | null;
  notes: string | null;
  substitutions: string | null;
  default_display_unit: string | null;
  nutrition_food_id: string | null;
  auto_created?: boolean;
  is_unlimited?: boolean;
  created_at: string;
  updated_at: string;
}

// Nutrition Food Types
export interface NutritionFood {
  id: string;
  name: string;
  alternate_names: string[];
  category: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sugar_g: number;
  sodium_mg: number;
  cholesterol_mg: number;
  serving_size: {
    common: { unit: string; quantity: number };
    metric: { unit: string; quantity: number };
  } | null;
  serving_unit: string | null;
  serving_grams: number | null;
  tbsp_to_g: number | null;
  tsp_to_g: number | null;
  oz_to_g: number | null;
  cup_to_g: number | null;
  fl_oz_to_ml: number | null;
  fl_oz_to_l: number | null;
  ml_to_pint: number | null;
  ml_to_quart: number | null;
  ml_to_gallon: number | null;
  l_to_pint: number | null;
  l_to_quart: number | null;
  l_to_gallon: number | null;
  nutrition_data: any;
  created_at: string;
}

// Custom Nutrition Types
export interface CustomNutrition {
  id: string;
  user_id: string;
  instance_id: string;
  ingredient_name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sugar_g: number;
  sodium_mg: number;
  cholesterol_mg: number;
  serving_size: string;
  serving_unit: string;
  created_at: string;
  updated_at: string;
}

// Unit Conversion Types
export interface UnitConversion {
  id: string;
  instance_id: string | null;
  ingredient_name: string;
  
  // Volume to weight conversions (for cooking)
  tbsp_to_g: number | null;
  tsp_to_g: number | null;
  oz_to_g: number | null;
  cup_to_g: number | null;
  
  // Volume conversions (imperial to metric)
  fl_oz_to_ml: number | null;
  fl_oz_to_l: number | null;
  
  // Volume conversions (metric to imperial)
  ml_to_pint: number | null;
  ml_to_quart: number | null;
  ml_to_gallon: number | null;
  l_to_pint: number | null;
  l_to_quart: number | null;
  l_to_gallon: number | null;
  
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// Grocery List Types
export interface GroceryListRecipe {
  id: string;
  user_id: string;
  instance_id: string;
  recipe_id: string;
  servings?: number | null;
  added_at: string;
}

export interface CustomGroceryItem {
  id: string;
  instance_id: string;
  created_by: string;
  item_name: string;
  quantity: number;
  unit: string;
  is_purchased: boolean;
  created_at: string;
}

export interface ApiToken {
  id: string;
  instance_id: string;
  name: string;
  scopes: string[];
  expires_at: string | null;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

export interface ConsolidatedIngredient {
  name: string;
  quantity: number;
  unit: string;
  is_substitution: boolean;
  substitution_for?: string;
  original_ingredients: RecipeIngredient[];
}

// Calendar Types
export interface CalendarMeal {
  id: string;
  user_id: string;
  instance_id: string;
  recipe_id: string;
  meal_date: string;
  meal_type: string;
  is_cooked: boolean;
  created_at: string;
}

export interface CalendarMealWithRecipe extends CalendarMeal {
  recipe?: Recipe;
}

// Settings Types
export type UnitSystem = 'metric' | 'metric_weights' | 'imperial' | 'imperial_volume' | 'ratio' | 'bakers_percentage';

export interface Settings {
  id: string;
  instance_id: string;
  preferred_unit_system: UnitSystem;
  dark_mode: boolean;
  vibrant_mode: boolean;
  nutrition_enabled: boolean;
  currency: string;
  cost_tracking_enabled: boolean;
  updated_at: string;
}

// Form Types for Creating/Updating
export interface CreateRecipeInput {
  title: string;
  description?: string;
  image_url?: string;
  folder_id?: string;
  prep_time_minutes?: number;
  cook_time_minutes?: number;
  servings: number;
  notes?: string | null;
  tags?: string[];
  equipment?: string[]; // Equipment IDs
  grid_recipe?: GridRecipe | null; // Optional grid recipe tree
  ingredients: Omit<RecipeIngredient, 'id' | 'recipe_id'>[];
  sections: {
    title: string;
    order_index: number;
    steps: Omit<RecipeStep, 'id' | 'recipe_id' | 'section_id'>[];
  }[];
}

export interface UpdateRecipeInput extends Partial<CreateRecipeInput> {
  id: string;
}

export interface CreatePantryItemInput {
  ingredient_name: string;
  preparation?: string;
  unit: string;
  amount: number;
  price?: number | null;
  price_size?: number | null;
  location?: string;
  notes?: string;
  default_display_unit?: string;
  nutrition_food_id?: string | null;
  is_unlimited?: boolean;
}

// Kitchen Layout Types
export type ElementType = 
  | 'upper_cabinet' 
  | 'lower_cabinet' 
  | 'door' 
  | 'window' 
  | 'sink' 
  | 'stove' 
  | 'refrigerator'
  | 'freezer'
  | 'countertop' 
  | 'pantry' 
  | 'table' 
  | 'other';

export interface KitchenModel {
  id: string;
  user_id: string;
  instance_id: string;
  name: string;
  description: string | null;
  canvas_width: number;
  canvas_height: number;
  created_at: string;
  updated_at: string;
}

export interface Shelf {
  name: string;
  height_percent: number;
}

export interface KitchenElement {
  id: string;
  model_id: string;
  element_type: ElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  custom_name: string | null;
  custom_color: string | null;
  shelves: Shelf[];
  created_at: string;
}

export interface ElementItemPlacement {
  id: string;
  element_id: string;
  item_type: 'ingredient' | 'equipment';
  item_id: string;
  created_at: string;
}

export interface KitchenElementWithPlacements extends KitchenElement {
  placements?: ElementItemPlacement[];
}

export interface CreateKitchenModelInput {
  name: string;
  description?: string;
  canvas_width?: number;
  canvas_height?: number;
}

export interface CreateKitchenElementInput {
  model_id: string;
  element_type: ElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  custom_name?: string;
}

export interface UpdateKitchenElementInput {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  rotation?: number;
  custom_name?: string | null;
  custom_color?: string | null;
  shelves?: Shelf[];
}
