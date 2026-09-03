import type {
  AdminConfig,
  Announcement,
  ApiError,
  CalendarMeal,
  CalendarMealWithRecipe,
  ConsolidatedIngredient,
  CreateKitchenElementInput,
  CreateKitchenModelInput,
  CreateRecipeInput,
  CustomGroceryItem,
  ElementItemPlacement,
  Equipment,
  ExtractedRecipe,
  Folder,
  GroceryListRecipe,
  InstanceMember,
  InstanceWithDetails,
  KitchenElement,
  KitchenElementWithPlacements,
  KitchenModel,
  LoginResponse,
  MealType,
  MeResponse,
  MintTokenResponse,
  PantryItem,
  PantryItemInput,
  Profile,
  Recipe,
  RecipeNutrition,
  RecipeWithDetails,
  RegisterResponse,
  Settings,
  Tag,
  UnitConversion,
  UpdateKitchenElementInput,
  VerifyEmailResponse,
} from './types';

const API_PREFIX = '/api';

export class ApiClientError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
  }
}

export function isNetworkError(err: unknown): boolean {
  return err instanceof ApiClientError && err.status === 0;
}

function normalizeBaseUrl(url: string): string {
  let base = url.trim().replace(/\/+$/, '');
  if (base.length === 0) {
    throw new ApiClientError('Server URL is required.', 0);
  }
  if (!/^https?:\/\//i.test(base)) {
    base = `https://${base}`;
  }
  return base;
}

export class ApiClient {
  readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = normalizeBaseUrl(baseUrl);
  }

  async request<T>(
    path: string,
    opts: { method?: string; token?: string | null; body?: unknown } = {},
  ): Promise<T> {
    const headers: Record<string, string> = {};
    let body: string | undefined;

    if (opts.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(opts.body);
    }
    if (opts.token) {
      headers.Authorization = `Bearer ${opts.token}`;
    }

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${API_PREFIX}${path}`, {
        method: opts.method ?? 'GET',
        headers,
        body,
      });
    } catch {
      throw new ApiClientError(
        'Could not reach the server. Check the URL and your connection.',
        0,
      );
    }

    const text = await response.text();
    let data: unknown = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = null;
      }
    }

    if (!response.ok) {
      const err = (data as ApiError) ?? {};
      const code = typeof err.error === 'string' ? err.error : undefined;
      const message =
        err.error && err.error !== code ? err.error : `Request failed (${response.status})`;
      throw new ApiClientError(message, response.status, code);
    }

    return data as T;
  }
}

const TOKENS_PATH = '/tokens';
const AUTH_PATH = '/auth';
const PANTRY_PATH = '/pantry';

export function login(client: ApiClient, email: string, password: string): Promise<LoginResponse> {
  return client.request<LoginResponse>(`${AUTH_PATH}/login`, {
    method: 'POST',
    body: { email, password, remember_me: true },
  });
}

export function fetchMe(client: ApiClient, token: string): Promise<MeResponse> {
  return client.request<MeResponse>(`${AUTH_PATH}/me`, { token });
}

export function register(
  client: ApiClient,
  email: string,
  password: string,
  instanceName?: string,
): Promise<RegisterResponse> {
  return client.request<RegisterResponse>(`${AUTH_PATH}/register`, {
    method: 'POST',
    body: { email, password, instance_name: instanceName },
  });
}

export function verifyEmail(
  client: ApiClient,
  token: string,
): Promise<VerifyEmailResponse> {
  return client.request<VerifyEmailResponse>(
    `${AUTH_PATH}/verify-email?token=${encodeURIComponent(token)}`,
  );
}

export function resendVerification(
  client: ApiClient,
  email: string,
): Promise<{ success: boolean }> {
  return client.request<{ success: boolean }>(`${AUTH_PATH}/resend-verification`, {
    method: 'POST',
    body: { email },
  });
}

export function mintApiToken(
  client: ApiClient,
  jwtToken: string,
  instanceId: string,
): Promise<MintTokenResponse> {
  return client.request<MintTokenResponse>(TOKENS_PATH, {
    method: 'POST',
    token: jwtToken,
    body: {
      instance_id: instanceId,
      name: 'PantryButler Mobile',
      scopes: ['all'],
    },
  });
}

export function updateProfile(
  client: ApiClient,
  jwtToken: string,
  profileId: string,
  data: { display_name?: string | null; avatar_url?: string | null },
): Promise<Profile> {
  return client.request<Profile>(`/profiles/${profileId}`, {
    method: 'PUT',
    token: jwtToken,
    body: data,
  });
}

export function changePassword(
  client: ApiClient,
  jwtToken: string,
  currentPassword: string,
  newPassword: string,
): Promise<{ message: string; token: string }> {
  return client.request<{ message: string; token: string }>(`${AUTH_PATH}/change-password`, {
    method: 'POST',
    token: jwtToken,
    body: { currentPassword, password: newPassword },
  });
}

// --- User management (instance members) ---

export function listInstanceMembers(
  client: ApiClient,
  token: string,
  instanceId: string,
): Promise<InstanceMember[]> {
  return client.request<InstanceMember[]>(withInstance('/profiles', instanceId), { token });
}

export function registerUser(
  client: ApiClient,
  email: string,
  password: string,
): Promise<{ token: string; user: { id: string; email: string } }> {
  return client.request<{ token: string; user: { id: string; email: string } }>(
    `${AUTH_PATH}/register`,
    { method: 'POST', body: { email, password } },
  );
}

export function addInstanceMember(
  client: ApiClient,
  jwtToken: string,
  instanceId: string,
  userId: string,
  role: string,
): Promise<{ id: string }> {
  return client.request<{ id: string }>('/instance-members', {
    method: 'POST',
    token: jwtToken,
    body: { user_id: userId, instance_id: instanceId, role },
  });
}

export function updateInstanceMember(
  client: ApiClient,
  jwtToken: string,
  userId: string,
  instanceId: string,
  data: { role?: string; can_edit_calendar?: boolean },
): Promise<{ id: string }> {
  return client.request<{ id: string }>(`/instance-members/${userId}`, {
    method: 'PUT',
    token: jwtToken,
    body: { instance_id: instanceId, ...data },
  });
}

export function deleteProfile(
  client: ApiClient,
  jwtToken: string,
  profileId: string,
): Promise<{ message: string }> {
  return client.request<{ message: string }>(`/profiles/${profileId}`, {
    method: 'DELETE',
    token: jwtToken,
  });
}

export function listPantry(client: ApiClient, token: string, instanceId: string): Promise<PantryItem[]> {
  return client.request<PantryItem[]>(
    `${PANTRY_PATH}?instance_id=${encodeURIComponent(instanceId)}`,
    { token },
  );
}

export function createPantryItem(
  client: ApiClient,
  token: string,
  input: PantryItemInput,
): Promise<PantryItem> {
  return client.request<PantryItem>(PANTRY_PATH, { method: 'POST', token, body: input });
}

export function updatePantryItem(
  client: ApiClient,
  token: string,
  id: string,
  input: Partial<PantryItemInput>,
): Promise<PantryItem> {
  return client.request<PantryItem>(`${PANTRY_PATH}/${id}`, {
    method: 'PUT',
    token,
    body: input,
  });
}

export function deletePantryItem(
  client: ApiClient,
  token: string,
  id: string,
): Promise<{ message: string }> {
  return client.request<{ message: string }>(`${PANTRY_PATH}/${id}`, {
    method: 'DELETE',
    token,
  });
}

const RECIPES_PATH = '/recipes';
const FOLDERS_PATH = '/folders';
const TAGS_PATH = '/tags';
const EQUIPMENT_PATH = '/equipment';
const EXTRACT_RECIPE_PATH = '/extract-recipe';
const NUTRITION_PATH = '/nutrition';
const GROCERY_PATH = '/grocery';
const CALENDAR_PATH = '/calendar';
const SETTINGS_PATH = '/settings';

function withInstance(path: string, instanceId: string): string {
  return `${path}?instance_id=${encodeURIComponent(instanceId)}`;
}

// --- Folders ---

export function getAllFolders(client: ApiClient, token: string, instanceId: string): Promise<Folder[]> {
  return client.request<Folder[]>(withInstance(FOLDERS_PATH, instanceId), { token });
}

export function createFolder(
  client: ApiClient,
  token: string,
  name: string,
  instanceId: string,
  parentFolderId?: string | null,
): Promise<Folder> {
  return client.request<Folder>(FOLDERS_PATH, {
    method: 'POST',
    token,
    body: { name, instance_id: instanceId, parent_folder_id: parentFolderId ?? null },
  });
}

export function updateFolderName(
  client: ApiClient,
  token: string,
  id: string,
  name: string,
): Promise<Folder> {
  return client.request<Folder>(`${FOLDERS_PATH}/${id}`, { method: 'PUT', token, body: { name } });
}

export function deleteFolder(
  client: ApiClient,
  token: string,
  id: string,
): Promise<{ message: string }> {
  return client.request<{ message: string }>(`${FOLDERS_PATH}/${id}`, { method: 'DELETE', token });
}

// --- Tags ---

export function getAllTags(client: ApiClient, token: string, instanceId: string): Promise<Tag[]> {
  return client.request<Tag[]>(withInstance(TAGS_PATH, instanceId), { token });
}

// --- Equipment ---

export function getAllEquipment(client: ApiClient, token: string, instanceId: string): Promise<Equipment[]> {
  return client.request<Equipment[]>(withInstance(EQUIPMENT_PATH, instanceId), { token });
}

export function createEquipment(
  client: ApiClient,
  token: string,
  name: string,
  location: string | undefined,
  instanceId: string,
): Promise<Equipment> {
  return client.request<Equipment>(EQUIPMENT_PATH, {
    method: 'POST',
    token,
    body: { name, location: location ?? null, instance_id: instanceId },
  });
}

export function updateEquipment(
  client: ApiClient,
  token: string,
  id: string,
  data: { name?: string; location?: string | null },
): Promise<Equipment> {
  return client.request<Equipment>(`${EQUIPMENT_PATH}/${id}`, { method: 'PUT', token, body: data });
}

export function deleteEquipment(client: ApiClient, token: string, id: string): Promise<{ message: string }> {
  return client.request<{ message: string }>(`${EQUIPMENT_PATH}/${id}`, { method: 'DELETE', token });
}

// --- Custom locations ---
const LOCATIONS_PATH = '/locations';

export function getCustomLocations(client: ApiClient, token: string, instanceId: string): Promise<string[]> {
  return client.request<string[]>(withInstance(LOCATIONS_PATH, instanceId), { token });
}

export function addCustomLocation(
  client: ApiClient,
  token: string,
  instanceId: string,
  locationName: string,
): Promise<void> {
  return client.request<void>(LOCATIONS_PATH, {
    method: 'POST',
    token,
    body: { instance_id: instanceId, location_name: locationName },
  });
}

// --- Kitchen layout ---
const KITCHEN_PATH = '/kitchen';

export function getKitchenModels(client: ApiClient, token: string, instanceId: string): Promise<KitchenModel[]> {
  return client.request<KitchenModel[]>(withInstance(`${KITCHEN_PATH}/models`, instanceId), { token });
}

export function createKitchenModel(
  client: ApiClient,
  token: string,
  input: CreateKitchenModelInput,
  instanceId: string,
): Promise<KitchenModel> {
  return client.request<KitchenModel>(`${KITCHEN_PATH}/models`, {
    method: 'POST',
    token,
    body: { ...input, instance_id: instanceId },
  });
}

export function updateKitchenModel(
  client: ApiClient,
  token: string,
  modelId: string,
  updates: Partial<CreateKitchenModelInput>,
): Promise<KitchenModel> {
  return client.request<KitchenModel>(`${KITCHEN_PATH}/models/${modelId}`, { method: 'PUT', token, body: updates });
}

export function deleteKitchenModel(
  client: ApiClient,
  token: string,
  modelId: string,
): Promise<{ message: string }> {
  return client.request<{ message: string }>(`${KITCHEN_PATH}/models/${modelId}`, { method: 'DELETE', token });
}

export function getKitchenElements(
  client: ApiClient,
  token: string,
  modelId: string,
): Promise<KitchenElementWithPlacements[]> {
  return client.request<KitchenElementWithPlacements[]>(`${KITCHEN_PATH}/models/${modelId}/elements`, { token });
}

export function createKitchenElement(
  client: ApiClient,
  token: string,
  input: CreateKitchenElementInput,
): Promise<KitchenElement> {
  return client.request<KitchenElement>(`${KITCHEN_PATH}/elements`, { method: 'POST', token, body: input });
}

export function updateKitchenElement(
  client: ApiClient,
  token: string,
  elementId: string,
  updates: UpdateKitchenElementInput,
): Promise<KitchenElement> {
  return client.request<KitchenElement>(`${KITCHEN_PATH}/elements/${elementId}`, { method: 'PUT', token, body: updates });
}

export function deleteKitchenElement(
  client: ApiClient,
  token: string,
  elementId: string,
): Promise<{ message: string }> {
  return client.request<{ message: string }>(`${KITCHEN_PATH}/elements/${elementId}`, { method: 'DELETE', token });
}

export function createElementPlacement(
  client: ApiClient,
  token: string,
  elementId: string,
  itemType: 'ingredient' | 'equipment',
  itemId: string,
): Promise<ElementItemPlacement> {
  return client.request<ElementItemPlacement>(`${KITCHEN_PATH}/placements`, {
    method: 'POST',
    token,
    body: { element_id: elementId, item_type: itemType, item_id: itemId },
  });
}

export function deleteElementPlacementByItem(
  client: ApiClient,
  token: string,
  elementId: string,
  itemType: 'ingredient' | 'equipment',
  itemId: string,
): Promise<{ message: string }> {
  return client.request<{ message: string }>(`${KITCHEN_PATH}/placements/by-item`, {
    method: 'DELETE',
    token,
    body: { element_id: elementId, item_type: itemType, item_id: itemId },
  });
}

// --- Recipes ---

export function getAllRecipes(
  client: ApiClient,
  token: string,
  instanceId: string,
  folderId?: string,
  tagId?: string,
): Promise<Recipe[]> {
  let path = withInstance(RECIPES_PATH, instanceId);
  if (folderId) path += `&folder_id=${encodeURIComponent(folderId)}`;
  if (tagId) path += `&tag_id=${encodeURIComponent(tagId)}`;
  return client.request<Recipe[]>(path, { token });
}

export function getRecipeById(
  client: ApiClient,
  token: string,
  id: string,
): Promise<RecipeWithDetails | null> {
  return client.request<RecipeWithDetails | null>(`${RECIPES_PATH}/${id}`, { token });
}

export function createRecipe(
  client: ApiClient,
  token: string,
  input: Omit<CreateRecipeInput, 'servings'> & { servings: number },
  instanceId: string,
): Promise<Recipe> {
  return client.request<Recipe>(RECIPES_PATH, {
    method: 'POST',
    token,
    body: { ...input, instance_id: instanceId },
  });
}

export function updateRecipe(
  client: ApiClient,
  token: string,
  id: string,
  input: Record<string, unknown>,
): Promise<Recipe> {
  return client.request<Recipe>(`${RECIPES_PATH}/${id}`, { method: 'PUT', token, body: input });
}

export function deleteRecipe(client: ApiClient, token: string, id: string): Promise<{ message: string }> {
  return client.request<{ message: string }>(`${RECIPES_PATH}/${id}`, { method: 'DELETE', token });
}

export function toggleRecipePublic(
  client: ApiClient,
  token: string,
  id: string,
  isPublic: boolean,
): Promise<{ publicSlug: string | null }> {
  return client.request<{ publicSlug: string | null }>(`${RECIPES_PATH}/${id}/public`, {
    method: 'PUT',
    token,
    body: { is_public: isPublic },
  });
}

export function extractRecipe(
  client: ApiClient,
  token: string,
  url: string,
): Promise<{ recipe: ExtractedRecipe }> {
  return client.request<{ recipe: ExtractedRecipe }>(EXTRACT_RECIPE_PATH, {
    method: 'POST',
    token,
    body: { url },
  });
}

export function calculateNutrition(
  client: ApiClient,
  ingredients: { name: string; quantity: number | null; unit: string | null; nutrition_food_id?: string | null }[],
  servings: number,
): Promise<RecipeNutrition | null> {
  return client.request<RecipeNutrition | null>(`${NUTRITION_PATH}/calculate`, {
    method: 'POST',
    body: { ingredients, servings },
  });
}

// --- Grocery ---

export function getGroceryListRecipes(
  client: ApiClient,
  token: string,
  instanceId: string,
): Promise<GroceryListRecipe[]> {
  return client.request<GroceryListRecipe[]>(withInstance(`${GROCERY_PATH}/recipes`, instanceId), { token });
}

export function addRecipeToGroceryList(
  client: ApiClient,
  token: string,
  instanceId: string,
  recipeId: string,
  servings?: number,
): Promise<GroceryListRecipe> {
  return client.request<GroceryListRecipe>(`${GROCERY_PATH}/recipes`, {
    method: 'POST',
    token,
    body: { instance_id: instanceId, recipe_id: recipeId, servings },
  });
}

export function removeRecipeFromGroceryList(
  client: ApiClient,
  token: string,
  recipeId: string,
): Promise<{ message: string }> {
  return client.request<{ message: string }>(`${GROCERY_PATH}/recipes/${recipeId}`, {
    method: 'DELETE',
    token,
  });
}

export function clearGroceryList(
  client: ApiClient,
  token: string,
  instanceId: string,
): Promise<{ message: string }> {
  return client.request<{ message: string }>(`${GROCERY_PATH}/recipes?instance_id=${encodeURIComponent(instanceId)}`, {
    method: 'DELETE',
    token,
  });
}

export function consolidateGroceryList(
  client: ApiClient,
  token: string,
  instanceId: string,
): Promise<ConsolidatedIngredient[]> {
  return client.request<ConsolidatedIngredient[]>(`${GROCERY_PATH}/consolidate`, {
    method: 'POST',
    token,
    body: { instance_id: instanceId },
  });
}

export function getCustomGroceryItems(
  client: ApiClient,
  token: string,
  instanceId: string,
): Promise<CustomGroceryItem[]> {
  return client.request<CustomGroceryItem[]>(withInstance(`${GROCERY_PATH}/custom`, instanceId), { token });
}

export function createCustomGroceryItem(
  client: ApiClient,
  token: string,
  instanceId: string,
  item: { name: string; quantity: number; unit: string },
): Promise<CustomGroceryItem> {
  return client.request<CustomGroceryItem>(`${GROCERY_PATH}/custom`, {
    method: 'POST',
    token,
    body: { instance_id: instanceId, ...item },
  });
}

export function updateCustomGroceryItem(
  client: ApiClient,
  token: string,
  id: string,
  data: { is_purchased?: boolean; name?: string; quantity?: number; unit?: string },
): Promise<CustomGroceryItem> {
  return client.request<CustomGroceryItem>(`${GROCERY_PATH}/custom/${id}`, {
    method: 'PUT',
    token,
    body: data,
  });
}

export function deleteCustomGroceryItem(
  client: ApiClient,
  token: string,
  id: string,
): Promise<{ message: string }> {
  return client.request<{ message: string }>(`${GROCERY_PATH}/custom/${id}`, { method: 'DELETE', token });
}

// --- Calendar ---

export function getCalendarMeals(
  client: ApiClient,
  token: string,
  instanceId: string,
  startDate: string,
  endDate: string,
): Promise<CalendarMealWithRecipe[]> {
  return client.request<CalendarMealWithRecipe[]>(
    `${CALENDAR_PATH}?instance_id=${encodeURIComponent(instanceId)}&start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}`,
    { token },
  );
}

export function createCalendarMeal(
  client: ApiClient,
  token: string,
  instanceId: string,
  recipeId: string,
  mealDate: string,
  mealType: MealType,
): Promise<CalendarMeal> {
  return client.request<CalendarMeal>(CALENDAR_PATH, {
    method: 'POST',
    token,
    body: { instance_id: instanceId, recipe_id: recipeId, meal_date: mealDate, meal_type: mealType },
  });
}

export function deleteCalendarMeal(
  client: ApiClient,
  token: string,
  mealId: string,
): Promise<{ message: string }> {
  return client.request<{ message: string }>(`${CALENDAR_PATH}/${mealId}`, { method: 'DELETE', token });
}

export function markMealCooked(
  client: ApiClient,
  token: string,
  mealId: string,
): Promise<{ message: string }> {
  return client.request<{ message: string }>(`${CALENDAR_PATH}/${mealId}/cook`, {
    method: 'POST',
    token,
  });
}

// --- Settings ---

export function getSettings(
  client: ApiClient,
  token: string,
  instanceId: string,
): Promise<Settings | null> {
  return client.request<Settings | null>(withInstance(SETTINGS_PATH, instanceId), { token });
}

export function updateSettings(
  client: ApiClient,
  token: string,
  instanceId: string,
  updates: Partial<Settings>,
): Promise<Settings> {
  return client.request<Settings>(SETTINGS_PATH, {
    method: 'PUT',
    token,
    body: { instance_id: instanceId, ...updates },
  });
}

const ANNOUNCEMENTS_PATH = '/announcements';

export function getActiveAnnouncements(
  client: ApiClient,
  token: string,
  instanceId: string,
): Promise<Announcement[]> {
  return client.request<Announcement[]>(withInstance(`${ANNOUNCEMENTS_PATH}/active-list`, instanceId), { token });
}

export function getAllAnnouncements(
  client: ApiClient,
  token: string,
  instanceId: string,
): Promise<Announcement[]> {
  return client.request<Announcement[]>(withInstance(ANNOUNCEMENTS_PATH, instanceId), { token });
}

export function createAnnouncement(
  client: ApiClient,
  token: string,
  instanceId: string,
  title: string,
  message: string,
): Promise<Announcement> {
  return client.request<Announcement>(ANNOUNCEMENTS_PATH, {
    method: 'POST',
    token,
    body: { instance_id: instanceId, title, message },
  });
}

export function updateAnnouncement(
  client: ApiClient,
  token: string,
  id: string,
  data: { title?: string; message?: string; is_active?: boolean },
): Promise<{ message: string }> {
  return client.request<{ message: string }>(`${ANNOUNCEMENTS_PATH}/${id}`, { method: 'PUT', token, body: data });
}

export function deleteAnnouncement(
  client: ApiClient,
  token: string,
  id: string,
): Promise<{ message: string }> {
  return client.request<{ message: string }>(`${ANNOUNCEMENTS_PATH}/${id}`, { method: 'DELETE', token });
}

export function markAnnouncementViewed(
  client: ApiClient,
  token: string,
  id: string,
  instanceId: string,
): Promise<{ message: string }> {
  return client.request<{ message: string }>(`${ANNOUNCEMENTS_PATH}/${id}/view`, {
    method: 'POST',
    token,
    body: { instance_id: instanceId },
  });
}

// --- Admin (superadmin, JWT-only) ---
const ADMIN_PATH = '/admin';

export function isSuperAdmin(client: ApiClient, jwt: string): Promise<boolean> {
  return client
    .request<unknown>(`${ADMIN_PATH}/instances`, { token: jwt })
    .then(() => true)
    .catch(() => false);
}

export function getInstancesWithDetails(client: ApiClient, jwt: string): Promise<InstanceWithDetails[]> {
  return client.request<InstanceWithDetails[]>(`${ADMIN_PATH}/instances`, { token: jwt });
}

export function deleteInstanceCompletely(client: ApiClient, jwt: string, instanceId: string): Promise<{ message: string }> {
  return client.request<{ message: string }>(`${ADMIN_PATH}/instances/${instanceId}`, { method: 'DELETE', token: jwt });
}

export function getAdminConfig(client: ApiClient, jwt: string): Promise<AdminConfig> {
  return client.request<AdminConfig>(`${ADMIN_PATH}/config`, { token: jwt });
}

export function updateAdminConfig(
  client: ApiClient,
  jwt: string,
  input: { require_email_verification?: boolean; external_url?: string | null; reset_smtp?: boolean },
): Promise<{ success: boolean }> {
  return client.request<{ success: boolean }>(`${ADMIN_PATH}/config`, { method: 'PUT', token: jwt, body: input });
}

const CONVERSIONS_PATH = '/conversions';

export function getAllConversions(
  client: ApiClient,
  token: string,
  instanceId: string,
): Promise<UnitConversion[]> {
  return client.request<UnitConversion[]>(withInstance(CONVERSIONS_PATH, instanceId), { token });
}
