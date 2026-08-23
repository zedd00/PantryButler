-- ============================================================================
-- PANTRYBUTLER DATABASE SCHEMA
-- ============================================================================
-- PostgreSQL 16 schema for the PantryButler server.
-- Access control is enforced by the application middleware (JWT auth plus
-- instance membership); the database itself runs without row-level security.
-- ============================================================================

-- ============================================================================
-- SECTION 1: ENUMS AND TYPES
-- ============================================================================

CREATE TYPE user_role AS ENUM ('superadmin', 'admin', 'user', 'viewer');
CREATE TYPE difficulty_level AS ENUM ('easy', 'medium', 'hard');
CREATE TYPE meal_type AS ENUM ('breakfast', 'lunch', 'dinner', 'snack');
CREATE TYPE element_type AS ENUM (
  'upper_cabinet', 'lower_cabinet', 'countertop', 'sink', 'stove',
  'refrigerator', 'freezer', 'pantry', 'table', 'door', 'window', 'other'
);

-- ============================================================================
-- SECTION 2: USERS & TENANCY
-- ============================================================================

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  jwt_version INTEGER NOT NULL DEFAULT 0,
  email_verified_at TIMESTAMPTZ,
  pending_instance_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  username TEXT NOT NULL,
  display_name TEXT,
  role user_role NOT NULL DEFAULT 'user',
  instance_id UUID REFERENCES instances(id) ON DELETE CASCADE,
  profile_picture_url TEXT,
  email_notifications BOOLEAN DEFAULT true,
  default_page TEXT DEFAULT '/recipes',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login TIMESTAMPTZ
);

CREATE TABLE instance_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  can_edit_calendar BOOLEAN DEFAULT false,
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(instance_id, user_id)
);

-- ============================================================================
-- SECTION 3: RECIPE MANAGEMENT
-- ============================================================================

CREATE TABLE folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  owner_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  parent_folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  image_url TEXT,
  servings INTEGER NOT NULL DEFAULT 1,
  default_unit TEXT,
  cook_time_minutes INTEGER,
  wait_time_minutes INTEGER,
  total_time_minutes INTEGER,
  notes TEXT,
  is_public BOOLEAN DEFAULT false,
  imported_from_recipe_id UUID,
  imported_from_user_id UUID,
  imported_from_instance_id UUID,
  import_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  prep_time_minutes INTEGER,
  description TEXT,
  source_recipe_id UUID,
  is_seed_copy BOOLEAN DEFAULT false,
  public_slug TEXT,
  grid_recipe JSONB
);

CREATE TABLE recipe_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  preparation TEXT,
  quantity NUMERIC NOT NULL,
  unit TEXT NOT NULL,
  is_optional BOOLEAN DEFAULT false,
  substitutions TEXT,
  prep_style TEXT,
  notes TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  nutrition_food_id TEXT,
  group_name TEXT
);

CREATE TABLE recipe_equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  equipment_id UUID,
  equipment_name TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE recipe_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE recipe_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  section_id UUID NOT NULL REFERENCES recipe_sections(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL,
  instruction TEXT NOT NULL,
  image_url TEXT,
  timer_minutes INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(instance_id, name)
);

CREATE TABLE recipe_tags (
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (recipe_id, tag_id)
);

CREATE TABLE public_recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL UNIQUE REFERENCES recipes(id) ON DELETE CASCADE,
  public_slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  servings INTEGER NOT NULL DEFAULT 1,
  prep_time_minutes INTEGER,
  cook_time_minutes INTEGER,
  wait_time_minutes INTEGER,
  total_time_minutes INTEGER,
  default_unit TEXT,
  notes TEXT,
  ingredients JSONB NOT NULL DEFAULT '[]'::jsonb,
  sections JSONB NOT NULL DEFAULT '[]'::jsonb,
  equipment JSONB NOT NULL DEFAULT '[]'::jsonb,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  owner_username TEXT,
  instance_name TEXT,
  is_public BOOLEAN DEFAULT false,
  owner_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  instance_id UUID REFERENCES instances(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- SECTION 4: PANTRY AND INVENTORY
-- ============================================================================

CREATE TABLE pantry_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  ingredient_name TEXT NOT NULL,
  preparation TEXT,
  unit TEXT,
  amount NUMERIC DEFAULT 0,
  price NUMERIC,
  price_size NUMERIC,
  substitutions TEXT,
  notes TEXT,
  auto_created BOOLEAN DEFAULT false,
  source_recipe_id UUID REFERENCES recipes(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  location TEXT,
  expiration_date DATE,
  default_display_unit TEXT,
  nutrition_food_id TEXT,
  is_unlimited BOOLEAN DEFAULT false
);

CREATE TABLE equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  location TEXT,
  notes TEXT,
  auto_created BOOLEAN DEFAULT false,
  source_recipe_id UUID REFERENCES recipes(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE custom_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  location_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(instance_id, location_name)
);

-- ============================================================================
-- SECTION 5: CALENDAR AND MEAL PLANNING
-- ============================================================================

CREATE TABLE calendar_meals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  meal_date DATE NOT NULL,
  meal_type TEXT NOT NULL,
  recipe_id UUID REFERENCES recipes(id) ON DELETE CASCADE,
  is_cooked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE grocery_list_recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  servings INTEGER,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE custom_grocery_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  quantity NUMERIC DEFAULT 1,
  unit TEXT NOT NULL,
  is_purchased BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- SECTION 6: UNIT CONVERSIONS AND SETTINGS
-- ============================================================================

CREATE TABLE unit_conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID REFERENCES instances(id) ON DELETE CASCADE,
  ingredient_name TEXT NOT NULL,
  tbsp_to_g NUMERIC,
  tsp_to_g NUMERIC,
  oz_to_g NUMERIC,
  cup_to_g NUMERIC,
  fl_oz_to_ml NUMERIC,
  fl_oz_to_l NUMERIC,
  ml_to_pint NUMERIC,
  ml_to_quart NUMERIC,
  ml_to_gallon NUMERIC,
  l_to_pint NUMERIC,
  l_to_quart NUMERIC,
  l_to_gallon NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(instance_id, ingredient_name)
);

CREATE TABLE settings (
  instance_id UUID PRIMARY KEY REFERENCES instances(id) ON DELETE CASCADE,
  preferred_unit_system TEXT DEFAULT 'metric',
  dark_mode BOOLEAN DEFAULT false,
  vibrant_mode BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  nutrition_enabled BOOLEAN DEFAULT true,
  currency TEXT NOT NULL DEFAULT 'USD',
  cost_tracking_enabled BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ
);

CREATE INDEX idx_announcements_instance_id ON announcements(instance_id);

CREATE TABLE user_announcement_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  instance_id UUID NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, announcement_id, instance_id)
);

CREATE TABLE user_dismissed_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  instance_id UUID NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  dismissed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, announcement_id, instance_id)
);

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  instance_id UUID REFERENCES instances(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT,
  message TEXT,
  link TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- SECTION 8: KITCHEN LAYOUT FEATURE
-- ============================================================================

CREATE TABLE kitchen_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  canvas_width INTEGER NOT NULL DEFAULT 800,
  canvas_height INTEGER NOT NULL DEFAULT 600,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE kitchen_elements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id UUID NOT NULL REFERENCES kitchen_models(id) ON DELETE CASCADE,
  element_type element_type NOT NULL,
  custom_name TEXT,
  x INTEGER NOT NULL,
  y INTEGER NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  rotation INTEGER DEFAULT 0,
  shelves JSONB DEFAULT '[]'::jsonb,
  custom_color TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE element_item_placements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  element_id UUID NOT NULL REFERENCES kitchen_elements(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL,
  item_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(element_id, item_type, item_id)
);

-- ============================================================================
-- SECTION 9: NUTRITION FEATURES
-- ============================================================================

CREATE TABLE nutrition_foods (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  calories NUMERIC,
  protein_g NUMERIC,
  carbs_g NUMERIC,
  fat_g NUMERIC,
  fiber_g NUMERIC,
  sugar_g NUMERIC,
  sodium_mg NUMERIC,
  cholesterol_mg NUMERIC,
  serving_size JSONB,
  serving_unit TEXT,
  serving_grams NUMERIC,
  nutrition_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  alternate_names TEXT[],
  tbsp_to_g NUMERIC,
  tsp_to_g NUMERIC,
  oz_to_g NUMERIC,
  cup_to_g NUMERIC,
  fl_oz_to_ml NUMERIC,
  fl_oz_to_l NUMERIC,
  ml_to_pint NUMERIC,
  ml_to_quart NUMERIC,
  ml_to_gallon NUMERIC,
  l_to_pint NUMERIC,
  l_to_quart NUMERIC,
  l_to_gallon NUMERIC,
  name_es TEXT,
  name_fr TEXT,
  name_hi TEXT,
  name_it TEXT,
  name_sq TEXT,
  name_zh TEXT,
  alternate_names_es TEXT[],
  alternate_names_fr TEXT[],
  alternate_names_hi TEXT[],
  alternate_names_it TEXT[],
  alternate_names_sq TEXT[],
  alternate_names_zh TEXT[]
);

CREATE TABLE custom_nutrition (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  instance_id UUID NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  ingredient_name TEXT NOT NULL,
  calories NUMERIC NOT NULL DEFAULT 0,
  protein_g NUMERIC NOT NULL DEFAULT 0,
  carbs_g NUMERIC NOT NULL DEFAULT 0,
  fat_g NUMERIC NOT NULL DEFAULT 0,
  fiber_g NUMERIC NOT NULL DEFAULT 0,
  sugar_g NUMERIC NOT NULL DEFAULT 0,
  sodium_mg NUMERIC NOT NULL DEFAULT 0,
  cholesterol_mg NUMERIC NOT NULL DEFAULT 0,
  serving_size TEXT NOT NULL,
  serving_unit TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- SECTION 10: TUTORIALS
-- ============================================================================

CREATE TABLE user_tutorials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tutorial_id TEXT NOT NULL,
  completed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, tutorial_id)
);

-- ============================================================================
-- SECTION 11: RATE LIMITING & AUDIT
-- ============================================================================

-- ============================================================================
-- SECTION 12: INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX idx_profiles_instance_id ON profiles(instance_id);
CREATE INDEX idx_instance_members_instance_id ON instance_members(instance_id);
CREATE INDEX idx_instance_members_user_id ON instance_members(user_id);

CREATE INDEX idx_folders_instance_id ON folders(instance_id);
CREATE INDEX idx_recipes_instance_id ON recipes(instance_id);
CREATE INDEX idx_recipes_folder_id ON recipes(folder_id);
CREATE INDEX idx_recipes_is_public ON recipes(is_public) WHERE is_public = true;
CREATE INDEX idx_recipe_ingredients_recipe_id ON recipe_ingredients(recipe_id);
CREATE INDEX idx_recipe_equipment_recipe_id ON recipe_equipment(recipe_id);
CREATE INDEX idx_recipe_sections_recipe_id ON recipe_sections(recipe_id);
CREATE INDEX idx_recipe_steps_section_id ON recipe_steps(section_id);
CREATE INDEX idx_tags_instance_id ON tags(instance_id);
CREATE INDEX idx_public_recipes_recipe_id ON public_recipes(recipe_id);
CREATE INDEX idx_public_recipes_slug ON public_recipes(public_slug);

CREATE INDEX idx_pantry_items_instance_id ON pantry_items(instance_id);
CREATE INDEX idx_equipment_instance_id ON equipment(instance_id);
CREATE INDEX idx_custom_locations_instance_id ON custom_locations(instance_id);

CREATE INDEX idx_calendar_meals_instance_id ON calendar_meals(instance_id);
CREATE INDEX idx_calendar_meals_meal_date ON calendar_meals(meal_date);
CREATE INDEX idx_grocery_list_recipes_instance_id ON grocery_list_recipes(instance_id);
CREATE INDEX idx_grocery_list_recipes_user_id ON grocery_list_recipes(user_id);
CREATE INDEX idx_grocery_list_recipes_recipe_id ON grocery_list_recipes(recipe_id);


CREATE INDEX idx_user_announcement_views_user ON user_announcement_views(user_id);
CREATE INDEX idx_user_announcement_views_announcement ON user_announcement_views(announcement_id);
CREATE INDEX idx_user_dismissed_announcements_user ON user_dismissed_announcements(user_id);
CREATE INDEX idx_user_dismissed_announcements_announcement ON user_dismissed_announcements(announcement_id);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read) WHERE is_read = false;

CREATE INDEX idx_kitchen_models_instance_id ON kitchen_models(instance_id);
CREATE INDEX idx_kitchen_elements_model_id ON kitchen_elements(model_id);
CREATE INDEX idx_element_placements_element ON element_item_placements(element_id);
CREATE INDEX idx_element_placements_item ON element_item_placements(item_type, item_id);

CREATE INDEX idx_nutrition_foods_name ON nutrition_foods(name);
CREATE INDEX idx_nutrition_foods_category ON nutrition_foods(category);
CREATE INDEX idx_nutrition_foods_serving_unit ON nutrition_foods(serving_unit);
CREATE INDEX idx_nutrition_foods_alternate_names ON nutrition_foods USING gin(alternate_names);
CREATE INDEX idx_pantry_items_nutrition_food_id ON pantry_items(nutrition_food_id);
CREATE INDEX idx_recipe_ingredients_nutrition_food_id ON recipe_ingredients(nutrition_food_id);

CREATE INDEX idx_custom_nutrition_user_instance ON custom_nutrition(user_id, instance_id);
CREATE INDEX idx_custom_nutrition_ingredient_name ON custom_nutrition(ingredient_name);

CREATE INDEX idx_user_tutorials_user_id ON user_tutorials(user_id);

-- ============================================================================
-- SECTION 13: FUNCTIONS
-- ============================================================================

-- Bulk insert nutrition data from JSON array
CREATE OR REPLACE FUNCTION bulk_insert_nutrition(data_json JSONB)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  item JSONB;
  count INTEGER := 0;
BEGIN
  FOR item IN SELECT * FROM jsonb_array_elements(data_json)
  LOOP
    INSERT INTO nutrition_foods (
      id, name, category, calories, protein_g, carbs_g, fat_g,
      fiber_g, sugar_g, sodium_mg, cholesterol_mg,
      serving_size, serving_unit, serving_grams, nutrition_data
    ) VALUES (
      item->>'id',
      item->>'name',
      item->>'category',
      (item->>'calories')::NUMERIC,
      (item->>'protein_g')::NUMERIC,
      (item->>'carbs_g')::NUMERIC,
      (item->>'fat_g')::NUMERIC,
      (item->>'fiber_g')::NUMERIC,
      (item->>'sugar_g')::NUMERIC,
      (item->>'sodium_mg')::NUMERIC,
      (item->>'cholesterol_mg')::NUMERIC,
      (item->'serving_size')::JSONB,
      item->>'serving_unit',
      NULLIF(item->>'serving_grams', '')::NUMERIC,
      (item->'nutrition_data')::JSONB
    )
    ON CONFLICT (id) DO NOTHING;

    count := count + 1;
  END LOOP;

  RETURN count;
END;
$$;

COMMENT ON FUNCTION bulk_insert_nutrition IS 'Bulk insert nutrition data from JSON array';

-- Handle new user registration (called explicitly by the application, not by a trigger)
CREATE OR REPLACE FUNCTION handle_new_user(
  p_user_id UUID,
  p_email TEXT,
  p_instance_name TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_instance_id UUID;
  user_instance_name TEXT;
  is_first_user BOOLEAN;
  v_username TEXT;
BEGIN
  v_username := SPLIT_PART(p_email, '@', 1);

  -- Create default instance if no name provided
  IF p_instance_name IS NULL THEN
    user_instance_name := 'Kitchen ' || v_username;
  ELSE
    user_instance_name := p_instance_name;
  END IF;

  INSERT INTO instances (name, created_by)
  VALUES (user_instance_name, p_user_id)
  RETURNING id INTO user_instance_id;

  -- First user in the whole system is superadmin
  SELECT NOT EXISTS (
    SELECT 1 FROM profiles
  ) INTO is_first_user;

  -- Create profile. The very first user in the whole system is superadmin;
  -- every other user is the creator (first member) of their own new instance,
  -- so they become an admin of it.
  INSERT INTO profiles (id, email, username, display_name, role, instance_id)
  VALUES (
    p_user_id, p_email, v_username, v_username,
    CASE WHEN is_first_user THEN 'superadmin'::user_role ELSE 'admin'::user_role END,
    user_instance_id
  )
  ON CONFLICT (id) DO NOTHING;

  -- Add to instance_members (creator is the first member of their own instance → admin)
  -- The creator can manage their own calendar, so can_edit_calendar is true.
  INSERT INTO instance_members (instance_id, user_id, role, can_edit_calendar)
  VALUES (user_instance_id, p_user_id, 'admin', true)
  ON CONFLICT (instance_id, user_id) DO NOTHING;

  -- Create default settings
  INSERT INTO settings (instance_id, preferred_unit_system, dark_mode, vibrant_mode, nutrition_enabled)
  VALUES (user_instance_id, 'metric', false, false, true)
  ON CONFLICT (instance_id) DO NOTHING;

  RETURN user_instance_id;
END;
$$;

COMMENT ON FUNCTION handle_new_user IS 'Creates instance, profile, membership, and settings for a new user. Called by the application after user registration.';

-- Promote last remaining user in an instance to admin
CREATE OR REPLACE FUNCTION promote_last_user_to_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  remaining_count INTEGER;
  remaining_user_id UUID;
BEGIN
  SELECT COUNT(*) INTO remaining_count
  FROM instance_members
  WHERE instance_id = OLD.instance_id;

  IF remaining_count = 1 THEN
    SELECT user_id INTO remaining_user_id
    FROM instance_members
    WHERE instance_id = OLD.instance_id
    LIMIT 1;

    UPDATE instance_members
    SET role = 'admin'
    WHERE instance_id = OLD.instance_id AND user_id = remaining_user_id;

    UPDATE profiles
    SET role = 'admin'::user_role
    WHERE id = remaining_user_id
      AND role <> 'superadmin';
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS promote_last_user_trigger ON instance_members;
CREATE TRIGGER promote_last_user_trigger
  AFTER DELETE ON instance_members
  FOR EACH ROW
  EXECUTE FUNCTION promote_last_user_to_admin();

-- ============================================================================
-- SECTION 14: INPUT SANITIZATION TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION sanitize_text(input_text TEXT)
RETURNS TEXT AS $$
BEGIN
  IF input_text IS NULL THEN
    RETURN NULL;
  END IF;
  input_text := regexp_replace(input_text, '<[^>]*>', '', 'g');
  input_text := regexp_replace(input_text, 'javascript:', '', 'gi');
  input_text := regexp_replace(input_text, 'on\w+\s*=', '', 'gi');
  input_text := regexp_replace(input_text, 'data:', '', 'gi');
  input_text := regexp_replace(input_text, 'vbscript:', '', 'gi');
  RETURN trim(input_text);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION sanitize_recipe()
RETURNS TRIGGER AS $$
BEGIN
  NEW.title := sanitize_text(NEW.title);
  NEW.description := sanitize_text(NEW.description);
  NEW.notes := sanitize_text(NEW.notes);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sanitize_recipe_trigger ON recipes;
CREATE TRIGGER sanitize_recipe_trigger
BEFORE INSERT OR UPDATE ON recipes
FOR EACH ROW EXECUTE FUNCTION sanitize_recipe();

CREATE OR REPLACE FUNCTION sanitize_equipment()
RETURNS TRIGGER AS $$
BEGIN
  NEW.name := sanitize_text(NEW.name);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sanitize_equipment_trigger ON equipment;
CREATE TRIGGER sanitize_equipment_trigger
BEFORE INSERT OR UPDATE ON equipment
FOR EACH ROW EXECUTE FUNCTION sanitize_equipment();

CREATE OR REPLACE FUNCTION sanitize_custom_location()
RETURNS TRIGGER AS $$
BEGIN
  NEW.location_name := sanitize_text(NEW.location_name);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sanitize_custom_location_trigger ON custom_locations;
CREATE TRIGGER sanitize_custom_location_trigger
BEFORE INSERT OR UPDATE ON custom_locations
FOR EACH ROW EXECUTE FUNCTION sanitize_custom_location();

CREATE OR REPLACE FUNCTION sanitize_pantry_item()
RETURNS TRIGGER AS $$
BEGIN
  NEW.ingredient_name := sanitize_text(NEW.ingredient_name);
  NEW.notes := sanitize_text(NEW.notes);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sanitize_pantry_item_trigger ON pantry_items;
CREATE TRIGGER sanitize_pantry_item_trigger
BEFORE INSERT OR UPDATE ON pantry_items
FOR EACH ROW EXECUTE FUNCTION sanitize_pantry_item();

CREATE OR REPLACE FUNCTION sanitize_instance()
RETURNS TRIGGER AS $$
BEGIN
  NEW.name := sanitize_text(NEW.name);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sanitize_instance_trigger ON instances;
CREATE TRIGGER sanitize_instance_trigger
BEFORE INSERT OR UPDATE ON instances
FOR EACH ROW EXECUTE FUNCTION sanitize_instance();

CREATE OR REPLACE FUNCTION sanitize_folder()
RETURNS TRIGGER AS $$
BEGIN
  NEW.name := sanitize_text(NEW.name);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sanitize_folder_trigger ON folders;
CREATE TRIGGER sanitize_folder_trigger
BEFORE INSERT OR UPDATE ON folders
FOR EACH ROW EXECUTE FUNCTION sanitize_folder();

CREATE OR REPLACE FUNCTION sanitize_kitchen_element()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.custom_name IS NOT NULL THEN
    NEW.custom_name := sanitize_text(NEW.custom_name);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sanitize_kitchen_element_trigger ON kitchen_elements;
CREATE TRIGGER sanitize_kitchen_element_trigger
BEFORE INSERT OR UPDATE ON kitchen_elements
FOR EACH ROW EXECUTE FUNCTION sanitize_kitchen_element();

CREATE OR REPLACE FUNCTION sanitize_recipe_ingredient()
RETURNS TRIGGER AS $$
BEGIN
  NEW.name := sanitize_text(NEW.name);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sanitize_recipe_ingredient_trigger ON recipe_ingredients;
CREATE TRIGGER sanitize_recipe_ingredient_trigger
BEFORE INSERT OR UPDATE ON recipe_ingredients
FOR EACH ROW EXECUTE FUNCTION sanitize_recipe_ingredient();

CREATE OR REPLACE FUNCTION sanitize_announcement()
RETURNS TRIGGER AS $$
BEGIN
  NEW.title := sanitize_text(NEW.title);
  NEW.message := sanitize_text(NEW.message);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sanitize_announcement_trigger ON announcements;
CREATE TRIGGER sanitize_announcement_trigger
BEFORE INSERT OR UPDATE ON announcements
FOR EACH ROW EXECUTE FUNCTION sanitize_announcement();

-- ============================================================================
-- SECTION: API ACCESS (OAuth2 + long-lived tokens)
-- Mirrors server/src/db/migrations.ts. token_hash/code_hash are SHA-256 digests
-- of the pb_ secrets; plaintext is never stored.
-- ============================================================================

CREATE TABLE api_tokens (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  instance_id       UUID NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  token_hash        TEXT NOT NULL UNIQUE,
  name              TEXT NOT NULL,
  scopes            TEXT[] NOT NULL DEFAULT '{all}',
  expires_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_from_ip   TEXT,
  last_used_at      TIMESTAMPTZ,
  last_used_ip      TEXT,
  revoked_at        TIMESTAMPTZ,
  revoked_reason    TEXT
);
CREATE INDEX idx_api_tokens_user ON api_tokens(user_id);
CREATE INDEX idx_api_tokens_hash ON api_tokens(token_hash);

CREATE TABLE oauth_clients (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  redirect_uri    TEXT NOT NULL,
  default_scopes  TEXT[] NOT NULL DEFAULT '{}',
  is_dev          BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE oauth_codes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       TEXT NOT NULL REFERENCES oauth_clients(client_id),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  instance_id     UUID NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  redirect_uri    TEXT NOT NULL,
  code_hash       TEXT NOT NULL UNIQUE,
  scope           TEXT[] NOT NULL,
  code_challenge  TEXT NOT NULL,
  expires_at      TIMESTAMPTZ NOT NULL,
  used_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_oauth_codes_hash ON oauth_codes(code_hash);

-- Uploaded files, bound to the uploader so deletes can be ownership-checked.
CREATE TABLE user_files (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  path        TEXT NOT NULL UNIQUE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_user_files_user ON user_files(user_id);

-- Explicit user consent for an OAuth client (protects against login-CSRF /
-- clickjacking of the authorization step). Absence of a row means consent
-- has not been granted yet and the SPA must ask the user first.
CREATE TABLE oauth_consents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id   TEXT NOT NULL REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, client_id)
);

-- Email verification: one-time, expiring tokens for confirming an instance
-- creator's email address (SHA-256 of the raw token; plaintext never stored).
CREATE TABLE email_verification_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_email_verification_tokens_user ON email_verification_tokens(user_id);
CREATE INDEX idx_email_verification_tokens_hash ON email_verification_tokens(token_hash);

-- Global (non per-instance) application configuration, editable by a
-- superadmin through the admin config page. Values are JSONB; a key's absence
-- means "fall back to the environment default".
CREATE TABLE system_config (
  config_key TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
