export interface LoginResponse {
  token: string;
  user: { id: string; email: string };
}

export interface Instance {
  id: string;
  role: string;
  name: string;
  created_at: string;
}

export interface MeResponse {
  profile: Profile;
  instances: Instance[];
}

export interface RegisterResponse {
  token?: string;
  user?: { id: string; email: string };
  requiresEmailVerification?: boolean;
  email?: string;
}

export interface VerifyEmailResponse {
  token: string;
  user: { id: string; email: string };
}

export interface Profile {
  id: string;
  email: string;
  username?: string | null;
  instance_id: string | null;
  instance_name: string | null;
  role: string;
  display_name?: string | null;
  avatar_url?: string | null;
  [key: string]: unknown;
}

export interface MintTokenResponse {
  token: string;
  id: string;
  user_id: string;
  instance_id: string;
  name: string;
  scopes: string[];
  expires_at: string | null;
  created_at: string;
}

export interface PantryItem {
  id: string;
  instance_id: string;
  user_id: string;
  ingredient_name: string;
  preparation: string | null;
  unit: string;
  amount: number;
  price: number | null;
  price_size: number | null;
  location: string | null;
  notes: string | null;
  default_display_unit: string | null;
  nutrition_food_id: string | null;
  is_unlimited: boolean;
  auto_created: boolean;
  created_at: string;
  updated_at: string;
}

export interface PantryItemInput {
  ingredient_name: string;
  preparation?: string | null;
  unit: string;
  amount: number;
  price?: number | null;
  price_size?: number | null;
  location?: string | null;
  notes?: string | null;
  default_display_unit?: string | null;
  nutrition_food_id?: string | null;
  is_unlimited?: boolean;
  instance_id: string;
}

export interface ApiError {
  error?: string;
  required?: string;
  message?: string;
}

export type UserRole = 'user' | 'admin' | 'viewer';

export interface ProfileFull {
  id: string;
  username: string;
  display_name: string;
  avatar_url?: string | null;
  instance_id: string;
  created_at: string;
  role?: UserRole | string;
}

export interface InstanceMember {
  id: string;
  email: string;
  username?: string | null;
  display_name?: string | null;
  role: string;
  created_at: string;
}

export interface Folder {
  id: string;
  name: string;
  owner_id: string;
  instance_id: string;
  parent_folder_id: string | null;
  created_at: string;
}

export interface Tag {
  id: string;
  name: string;
  instance_id: string;
  created_at: string;
}

export interface Equipment {
  id: string;
  instance_id: string;
  name: string;
  location: string | null;
  created_at: string;
}

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
  is_public: boolean;
  public_slug: string | null;
  created_at: string;
  updated_at: string;
  tags?: Tag[];
  folder?: Folder;
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
  group_name: string | null;
  nutrition_food_id: string | null;
}

export interface RecipeSectionWithSteps {
  id: string;
  recipe_id: string;
  title: string;
  order_index: number;
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

export interface RecipeWithDetails extends Recipe {
  equipment?: { id: string; recipe_id: string; equipment_id: string; order_index: number }[];
  ingredients?: RecipeIngredient[];
  sections?: RecipeSectionWithSteps[];
  owner?: ProfileFull;
}

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
  equipment?: string[];
  grid_recipe?: unknown;
  ingredients: Omit<RecipeIngredient, 'id' | 'recipe_id'>[];
  sections: {
    title: string;
    order_index: number;
    steps: Omit<RecipeStep, 'id' | 'recipe_id' | 'section_id'>[];
  }[];
}

export interface ExtractedIngredientGroup {
  title?: string;
  ingredients: string[];
}

export interface ExtractedRecipe {
  title: string;
  description?: string;
  image_url?: string;
  servings?: number;
  prep_time_minutes?: number;
  cook_time_minutes?: number;
  total_time_minutes?: number;
  ingredients: string[];
  ingredient_groups?: ExtractedIngredientGroup[];
  instructions: string[];
}

export interface NutritionTotals {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sugar_g: number;
  sodium_mg: number;
  cholesterol_mg: number;
  calcium_mg?: number;
  iron_mg?: number;
  magnesium_mg?: number;
  phosphorus_mg?: number;
  potassium_mg?: number;
  zinc_mg?: number;
  copper_mg?: number;
  manganese_mg?: number;
  selenium_mcg?: number;
  vitamin_a_mcg?: number;
  vitamin_c_mg?: number;
  vitamin_d_mcg?: number;
  vitamin_e_mg?: number;
  vitamin_k_mcg?: number;
  thiamin_mg?: number;
  riboflavin_mg?: number;
  niacin_mg?: number;
  vitamin_b6_mg?: number;
  folate_mcg?: number;
  vitamin_b12_mcg?: number;
  pantothenic_acid_mg?: number;
  choline_mg?: number;
}

export interface IngredientNutrition {
  ingredient_name: string;
  matched_food_id: string | null;
  matched_food_name: string | null;
  quantity: number | null;
  unit: string | null;
  grams: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sugar_g: number;
  sodium_mg: number;
  cholesterol_mg: number;
  [key: string]: number | string | null;
}

export interface RecipeNutrition {
  total: NutritionTotals;
  per_serving: NutritionTotals;
  ingredients: IngredientNutrition[];
  matched_count: number;
  total_count: number;
}

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

export interface ConsolidatedIngredient {
  name: string;
  quantity: number;
  unit: string;
  is_substitution: boolean;
  substitution_for?: string;
  original_ingredients: RecipeIngredient[];
}

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface CalendarMeal {
  id: string;
  user_id: string;
  instance_id: string;
  recipe_id: string;
  meal_date: string;
  meal_type: MealType;
  is_cooked: boolean;
  created_at: string;
}

export interface CalendarMealWithRecipe extends CalendarMeal {
  recipe?: {
    id: string;
    title: string;
    description: string | null;
    image_url: string | null;
    servings: number;
  };
}

export type UnitSystem =
  | 'metric'
  | 'metric_weights'
  | 'imperial'
  | 'imperial_volume'
  | 'ratio'
  | 'bakers_percentage';

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

export interface Announcement {
  id: string;
  instance_id: string;
  title: string;
  message: string;
  created_at: string;
  is_active: boolean;
  created_by: string | null;
  expires_at: string | null;
}

export interface InstanceWithDetails {
  id: string;
  name: string;
  created_at: string;
  created_by: string;
  last_login: string | null;
  creator: { id: string; display_name: string | null; username: string | null } | null;
}

export interface AdminSmtpConfig {
  host: string;
  port: number;
  username: string;
  from: string;
  secure: boolean;
  passwordSet: boolean;
}

export interface AdminConfig {
  require_email_verification: boolean;
  require_email_verification_override: boolean | null;
  external_url: string;
  external_url_override: string | null;
  smtp: AdminSmtpConfig;
}

export interface UnitConversion {
  id: string;
  instance_id: string | null;
  ingredient_name: string;
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
  notes: string | null;
  created_at: string;
  updated_at: string;
}
