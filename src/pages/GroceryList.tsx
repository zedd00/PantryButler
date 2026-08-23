import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import MainLayout from '@/components/layouts/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Search, AlertCircle, Info, X, Plus } from 'lucide-react';
import { consolidateGroceryList, createPantryItem, getPantryItems, getSettings, getAllConversions, getCustomGroceryItems, updatePantryItem, updateCustomGroceryItem } from '@/api';
import type { ConsolidatedIngredient, UnitConversion, Settings, PantryItem, CreatePantryItemInput } from '@/types/types';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { formatAmount } from '@/lib/format';
import { convertQuantity, getPreferredUnits, normalizeUnit, isVolumeUnit, hasDensityAnchor } from '@/lib/conversions';
import { computeIngredientCost, formatCurrency } from '@/lib/cost';
import { PageTutorial } from '@/components/tutorial/PageTutorial';
import { getGroceryListTutorialSteps } from '@/components/tutorial/tutorialSteps';
import { useTranslation } from 'react-i18next';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const PANTRY_UNITS = [
  'whole', 'kg', 'g', 'oz', 'lb', 'L', 'ml', 'cup', 'fl oz', 'tbsp', 'tsp', 'pint', 'quart', 'gallon',
];

const nameKey = (name: string): string => (name || '').trim().toLowerCase();

// Helper function to convert ingredient to preferred unit
const convertIngredientToPreferred = (
  ingredient: ConsolidatedIngredient,
  preferredUnits: string[],
  conversions: UnitConversion[]
): { quantity: number; unit: string; originalQuantity?: number; originalUnit?: string; converted: boolean } => {
  // Don't convert if no preferred units
  if (!preferredUnits.length) {
    return { quantity: ingredient.quantity, unit: ingredient.unit, converted: false };
  }

  // Try to find an explicit conversion for this ingredient
  const result = convertQuantity(
    ingredient.quantity,
    ingredient.unit,
    preferredUnits[0], // Try first preferred unit
    ingredient.name,
    conversions
  );
  
  // Only use the conversion if it was actually found in the conversions table
  // Check if there's a matching conversion entry for this ingredient
  const hasExplicitConversion = conversions.some(c => {
    const matchesIngredient = c.ingredient_name === ingredient.name ||
                              c.ingredient_name === null ||
                              (c.ingredient_name && c.ingredient_name.toLowerCase() === ingredient.name.toLowerCase());
    if (!matchesIngredient) return false;

    const fromUnit = normalizeUnit(ingredient.unit || '');
    const targetUnit = normalizeUnit(preferredUnits[0] || '');
    if (fromUnit === targetUnit) return true;

    // Volume↔weight needs the ingredient's density anchor; same-system
    // conversions are fixed and always available.
    const crossSystem = isVolumeUnit(fromUnit) !== isVolumeUnit(targetUnit);
    return crossSystem ? hasDensityAnchor(c) : true;
  });
  
  if (result.converted && hasExplicitConversion) {
    return {
      quantity: result.quantity,
      unit: preferredUnits[0],
      originalQuantity: ingredient.quantity,
      originalUnit: ingredient.unit,
      converted: true,
    };
  }

  // No explicit conversion found, return original
  return { quantity: ingredient.quantity, unit: ingredient.unit, converted: false };
};

export default function GroceryList() {
  const { t, i18n } = useTranslation(['tutorial', 'grocery', 'common']);
  const { profile } = useAuth();
  const [ingredients, setIngredients] = useState<ConsolidatedIngredient[]>([]);
  const [customItems, setCustomItems] = useState<any[]>([]);
  const [purchased, setPurchased] = useState<Set<string>>(new Set());
  const [removed, setRemoved] = useState<Set<string>>(new Set()); // Track removed items
  const [searchTerm, setSearchTerm] = useState('');
  const [settings, setSettings] = useState<Settings | null>(null);
  const [conversions, setConversions] = useState<UnitConversion[]>([]);
  const [addToPantryDialog, setAddToPantryDialog] = useState<{ open: boolean; itemId: string; itemName: string } | null>(null);
  const [pantryItems, setPantryItems] = useState<PantryItem[]>([]);
  const [purchaseDialog, setPurchaseDialog] = useState<{ open: boolean; name: string; amount: number }>({ open: false, name: '', amount: 0 });
  const [purchasePrice, setPurchasePrice] = useState('');
  const [purchaseUnit, setPurchaseUnit] = useState('whole');
  const [customPrice, setCustomPrice] = useState('');
  const [customAmount, setCustomAmount] = useState(1);
  const [customUnit, setCustomUnit] = useState('whole');

  useEffect(() => {
    if (profile) {
      loadGroceryList();
      loadSettings();
      loadConversions();
    }
  }, [profile]);

  const loadSettings = async () => {
    try {
      const data = await getSettings();
      setSettings(data);
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const loadConversions = async () => {
    try {
      const data = await getAllConversions();
      setConversions(data);
    } catch (error) {
      console.error('Failed to load conversions:', error);
    }
  };

  const loadGroceryList = async () => {
    if (!profile) return;
    try {
      const [consolidated, pantryData] = await Promise.all([
        consolidateGroceryList(profile.id),
        getPantryItems(profile.id),
      ]);

      setPantryItems(pantryData);

      // Filter out items that have an unlimited pantry match
      const filtered = consolidated.filter(ing => {
        const hasUnlimited = pantryData.some(
          p => (p.ingredient_name || '').toLowerCase() === ing.name.toLowerCase() && p.is_unlimited
        );
        return !hasUnlimited;
      });
      setIngredients(filtered);
      
      // Load custom items
      const customData = await getCustomGroceryItems(profile.id);
      setCustomItems(customData.filter(i => !i.is_purchased) || []);
    } catch (error: any) {
      toast.error(t('grocery:groceryList.errorLoadingList', { error: error.message }));
    }
  };

  const handleTogglePurchased = (name: string) => {
    const key = nameKey(name);
    const newPurchased = new Set(purchased);
    if (newPurchased.has(key)) {
      newPurchased.delete(key);
    } else {
      newPurchased.add(key);
    }
    setPurchased(newPurchased);
  };

  const handleAddToPantryClick = (name: string, quantity: number, incomingUnit: string) => {
    setPurchasePrice('');
    setPurchaseUnit(incomingUnit ? normalizeUnit(incomingUnit) : 'whole');
    setPurchaseDialog({ open: true, name, amount: quantity });
  };

  const confirmAddToPantry = async () => {
    if (!profile || !purchaseDialog.name) return;
    const name = purchaseDialog.name;
    const unit = purchaseUnit || 'whole';
    const amount = purchaseDialog.amount;

    const priceStr = purchasePrice.trim();
    const parsedPrice = priceStr === '' ? null : parseFloat(priceStr);
    const hasPrice = parsedPrice !== null && Number.isFinite(parsedPrice) && parsedPrice >= 0;

    try {
      const existingItem = pantryItems.find(
        item => item.ingredient_name.toLowerCase() === name.toLowerCase() &&
                normalizeUnit(item.unit || 'whole') === unit
      );

      if (existingItem) {
        const newAmount = Number(existingItem.amount) + amount;
        const updates: Partial<CreatePantryItemInput> = { amount: newAmount };
        if (hasPrice) {
          const existingPrice = existingItem.price === null || existingItem.price === undefined
            ? null
            : Number(existingItem.price);
          updates.price = (existingPrice !== null && Number.isFinite(existingPrice) ? existingPrice : 0) + (parsedPrice ?? 0);
          updates.price_size = newAmount;
        }
        await updatePantryItem(existingItem.id, updates);
        toast.success(t('grocery:groceryList.pantryUpdated', { name, amount: formatAmount(amount), unit }));
      } else {
        await createPantryItem(profile.id, {
          ingredient_name: name,
          unit,
          amount,
          location: 'Pantry',
          default_display_unit: unit,
          nutrition_food_id: null,
          ...(hasPrice ? { price: parsedPrice, price_size: amount } : {}),
        });
        toast.success(t('grocery:groceryList.pantryAdded', { name }));
      }

      setPantryItems(await getPantryItems(profile.id));
      setPurchasePrice('');
      setPurchaseDialog({ open: false, name: '', amount: 0 });
    } catch (error: any) {
      toast.error(t('grocery:groceryList.errorAddingToPantry', { error: error.message }));
    }
  };

  const handleRemoveItem = (name: string) => {
    const key = nameKey(name);
    const newRemoved = new Set(removed);
    newRemoved.add(key);
    setRemoved(newRemoved);
    toast.success(t('grocery:groceryList.itemRemoved', { name }));
  };

  const handlePurchaseCustomItem = async (itemId: string, itemName: string) => {
    if (!profile) return;

    // Show dialog asking if they want to add to pantry
    setCustomPrice('');
    setCustomAmount(1);
    setCustomUnit('whole');
    setAddToPantryDialog({ open: true, itemId, itemName });
  };

  const confirmPurchaseCustomItem = async (addToPantry: boolean) => {
    if (!profile || !addToPantryDialog) return;

    const { itemId, itemName } = addToPantryDialog;
    const amount = customAmount > 0 ? customAmount : 1;
    const unit = customUnit || 'whole';

    const priceStr = customPrice.trim();
    const parsedPrice = priceStr === '' ? null : parseFloat(priceStr);
    const hasPrice = parsedPrice !== null && Number.isFinite(parsedPrice) && parsedPrice >= 0;

    try {
      // Mark as purchased
      await updateCustomGroceryItem(itemId, { is_purchased: true });

      // Add to pantry if requested
      if (addToPantry) {
        // Merge into an existing pantry item with the same name instead of
        // creating a duplicate (mirrors confirmAddToPantry).
        const existingItem = pantryItems.find(
          item => item.ingredient_name.toLowerCase() === itemName.toLowerCase()
        );

        if (existingItem) {
          const newAmount = Number(existingItem.amount) + amount;
          const updates: Partial<CreatePantryItemInput> = { amount: newAmount };
          if (hasPrice) {
            const existingPrice = existingItem.price === null || existingItem.price === undefined
              ? null
              : Number(existingItem.price);
            updates.price = (existingPrice !== null && Number.isFinite(existingPrice) ? existingPrice : 0) + (parsedPrice ?? 0);
            updates.price_size = newAmount;
          }
          await updatePantryItem(existingItem.id, updates);
          toast.success(t('grocery:groceryList.pantryUpdated', { name: itemName, amount: formatAmount(amount), unit }));
        } else {
          await createPantryItem(profile.id, {
            ingredient_name: itemName,
            unit,
            amount,
            location: 'Pantry',
            default_display_unit: unit,
            nutrition_food_id: null,
            ...(hasPrice ? { price: parsedPrice, price_size: amount } : {}),
          });
          toast.success(t('grocery:groceryList.customPurchasedAndAdded', { name: itemName }));
        }
      } else {
        toast.success(t('grocery:groceryList.customMarkedPurchased', { name: itemName }));
      }

      setCustomPrice('');
      setAddToPantryDialog(null);
      loadGroceryList();
    } catch (error: any) {
      toast.error(t('grocery:groceryList.errorMarkingPurchased', { error: error.message }));
    }
  };

  const filteredIngredients = ingredients.filter(ing => {
    const key = nameKey(ing.name);
    return ing.name.toLowerCase().includes(searchTerm.toLowerCase()) && !removed.has(key);
  });

  const preferredUnits = settings ? getPreferredUnits(settings.preferred_unit_system) : [];

  // Consolidate each ingredient (across unit spellings and, where a conversion
  // exists, across different units) into a single line in the preferred unit.
  // Portions that cannot be converted are surfaced as a flagged extra line so
  // they are never silently dropped or miscounted.
  type GroceryLine = {
    key: string;
    name: string;
    qty: number;
    unit: string;
    converted: boolean;
    extras: { qty: number; unit: string }[];
    substitutes: string[]; // keys of lines that this line can substitute
  };

  const groupBy = new Map<string, ConsolidatedIngredient[]>();
  for (const ing of filteredIngredients) {
    const k = nameKey(ing.name);
    if (!groupBy.has(k)) groupBy.set(k, []);
    groupBy.get(k)!.push(ing);
  }

  const lineByKey = new Map<string, GroceryLine>();
  const buildLines: GroceryLine[] = [];

  for (const [k, rows] of groupBy) {
    const extras: { qty: number; unit: string }[] = [];
    let qty: number | null = null;
    let unit = 'whole';
    let converted = false;

    if (preferredUnits.length) {
      const target = preferredUnits[0];
      let total = 0;
      let used = false;
      for (const row of rows) {
        const nu = normalizeUnit(row.unit) || 'whole';
        if (nu === target) {
          total += row.quantity;
          used = true;
        } else {
          const c = convertQuantity(row.quantity, row.unit, target, row.name, conversions);
          if (c.converted) {
            total += c.quantity;
            used = true;
            if (Math.abs(c.quantity - row.quantity) > 1e-9) converted = true;
          } else {
            extras.push({ qty: row.quantity, unit: nu });
          }
        }
      }
      if (used) {
        qty = total;
        unit = target;
      }
    }

    if (qty === null) {
      const first = rows[0];
      qty = first.quantity;
      unit = normalizeUnit(first.unit) || 'whole';
      for (const row of rows.slice(1)) extras.push({ qty: row.quantity, unit: normalizeUnit(row.unit) || 'whole' });
    }

    const line: GroceryLine = {
      key: k,
      name: rows[0].name,
      qty,
      unit,
      converted,
      extras,
      substitutes: [],
    };
    buildLines.push(line);
    lineByKey.set(k, line);
  }

  // Resolve substitution relationships between the consolidated lines.
  for (const line of buildLines) {
    const subNames = new Set<string>();
    for (const row of groupBy.get(line.key) || []) {
      const raw = row.original_ingredients?.[0]?.substitutions;
      if (raw) raw.split(',').map(s => s.trim().toLowerCase()).forEach(s => subNames.add(s));
    }
    line.substitutes = Array.from(subNames)
      .map(nameKey)
      .filter(key => key !== line.key && lineByKey.has(key));
  }

  const groceryLines = buildLines;

  // Estimate total grocery cost from pantry unit prices (only when cost tracking is enabled)
  let estimatedTotal: number | null = null;
  if (settings?.cost_tracking_enabled) {
    let total = 0;
    let hasAnyCost = false;
    const addCost = (name: string, quantity: number, unit: string) => {
      const result = computeIngredientCost({ ingredient: { name, quantity, unit }, pantryItems, conversions });
      if (result.cost !== null && Number.isFinite(result.cost)) {
        total += result.cost;
        hasAnyCost = true;
      }
    };
    for (const line of groceryLines) {
      if (removed.has(line.key)) continue;
      addCost(line.name, line.qty, line.unit);
      for (const ex of line.extras) addCost(line.name, ex.qty, ex.unit);
    }
    estimatedTotal = hasAnyCost ? total : null;
  }

  return (
    <MainLayout>
      <PageTutorial tutorialId="grocery-list-page" steps={getGroceryListTutorialSteps(t)} />
      <div className="space-y-8">
        <div>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-semibold">{t('grocery:title')}</h1>
              <p className="text-muted-foreground mt-1">{t('grocery:groceryList.consolidatedFromRecipes')}</p>
            </div>
            <Link to="/grocery-list-creation">
              <Button variant="outline" data-tutorial="add-from-recipe">{t('grocery:groceryList.manageRecipes')}</Button>
            </Link>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('grocery:groceryList.searchIngredients')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <CardTitle>{t('grocery:groceryList.shoppingList')}</CardTitle>
              {estimatedTotal !== null && (
                <p className="text-sm font-medium text-muted-foreground shrink-0">
                  {t('grocery:estimatedCost')}: {formatCurrency(estimatedTotal, settings?.currency, i18n.language)}
                </p>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {groceryLines.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                {t('grocery:groceryList.noItemsDescription')}
              </p>
            ) : (
              <div className="space-y-3">
                {groceryLines.map((line, index) => (
                    <div key={line.key}>
                      <div className="flex items-center justify-between p-3 border border-border rounded gap-3" data-tutorial={index === 0 ? "check-item" : undefined}>
                        <div className="flex items-center gap-3 flex-1">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div>
                                  <Checkbox
                                    checked={purchased.has(line.key)}
                                    onCheckedChange={() => handleTogglePurchased(line.name)}
                                  />
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-xs">{t('grocery:groceryList.markAsPurchased')}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <div className="flex-1">
                            <p className="font-medium">{line.name}</p>
                            <div className="flex items-center gap-2">
                              <p className="text-sm text-muted-foreground">
                                {formatAmount(line.qty)} {line.unit}
                              </p>
                              {line.converted && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p className="text-xs">{t('grocery:groceryList.convertedToPreferred')}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {purchased.has(line.key) && (
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => handleAddToPantryClick(line.name, line.qty, line.unit)}
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              {t('grocery:groceryList.addToPantry')}
                            </Button>
                          )}
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => handleRemoveItem(line.name)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                    <p className="text-xs">{t('grocery:groceryList.removeFromListAlreadyHave')}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </div>

                      {/* Show portions with no conversion as flagged extra lines */}
                      {line.extras.map((ex, i) => (
                        <div key={`${line.key}-extra-${i}`} className="flex items-center gap-3 p-3 border border-dashed border-border rounded mt-2 ml-8 bg-accent/30">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{line.name}</p>
                              <Badge variant="outline" className="text-xs">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                {t('grocery:groceryList.noConversion')}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {formatAmount(ex.qty)} {ex.unit}
                            </p>
                          </div>
                        </div>
                      ))}

                      {/* Show substitutes as adjacent rows */}
                      {line.substitutes.map((subKey) => {
                        const sub = lineByKey.get(subKey)!;

                        return (
                          <div key={subKey} className="flex items-center justify-between p-3 border border-border rounded mt-2 ml-8 bg-accent/50 gap-3">
                            <div className="flex items-center gap-3 flex-1">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div>
                                      <Checkbox
                                        checked={purchased.has(sub.key)}
                                        onCheckedChange={() => handleTogglePurchased(sub.name)}
                                      />
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="text-xs">{t('grocery:groceryList.markAsPurchased')}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="font-medium">{sub.name}</p>
                                  <Badge variant="outline" className="text-xs">
                                    <AlertCircle className="h-3 w-3 mr-1" />
                                    {t('grocery:groceryList.substituteFor', { name: line.name })}
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {formatAmount(sub.qty)} {sub.unit}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {purchased.has(sub.key) && (
                                <Button
                                  variant="default"
                                  size="sm"
                                  onClick={() => handleAddToPantryClick(sub.name, sub.qty, sub.unit)}
                                >
                                  <Plus className="h-3 w-3 mr-1" />
                                  {t('grocery:groceryList.addToPantry')}
                                </Button>
                              )}
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => handleRemoveItem(sub.name)}
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="text-xs">{t('grocery:groceryList.removeFromListAlreadyHave')}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>

        {customItems.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>{t('grocery:groceryList.customItems')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {customItems.map((item) => {
                  const preferredUnits = settings ? getPreferredUnits(settings.preferred_unit_system) : [];
                  const customConverted = convertIngredientToPreferred(
                    { 
                      name: item.item_name, 
                      quantity: item.quantity, 
                      unit: item.unit, 
                      is_substitution: false,
                      original_ingredients: []
                    },
                    preferredUnits,
                    conversions
                  );
                  
                  return (
                    <div key={item.id} className="flex items-center gap-3 p-3 border border-border rounded bg-muted/30">
                      <Checkbox
                        checked={false}
                        onCheckedChange={() => handlePurchaseCustomItem(item.id, item.item_name)}
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{item.item_name}</p>
                          <Badge variant="secondary" className="text-xs">{t('grocery:groceryList.custom')}</Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm text-muted-foreground">
                            {formatAmount(customConverted.quantity)} {customConverted.unit}
                          </p>
                          {customConverted.converted && customConverted.originalQuantity && customConverted.originalUnit && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-xs">{t('grocery:groceryList.original', { amount: formatAmount(customConverted.originalQuantity), unit: customConverted.originalUnit })}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Add to Pantry - Amount Dialog */}
      <Dialog open={purchaseDialog.open} onOpenChange={(open) => !open && setPurchaseDialog({ open: false, name: '', amount: 0 })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('grocery:groceryList.addToPantry')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              {t('grocery:groceryList.howMuchPurchased', { name: <strong>{purchaseDialog.name}</strong> })}
            </p>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="0"
                step="0.01"
                value={purchaseDialog.amount || ''}
                onChange={(e) => setPurchaseDialog({ ...purchaseDialog, amount: parseFloat(e.target.value) || 0 })}
              />
              <Select value={purchaseUnit} onValueChange={setPurchaseUnit}>
                <SelectTrigger className="w-[130px]" aria-label={t('grocery:groceryList.selectUnit')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PANTRY_UNITS.map((unit) => (
                    <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="purchase-price">{t('grocery:groceryList.enterPrice')}</Label>
              <Input
                id="purchase-price"
                type="number"
                min="0"
                step="0.01"
                placeholder={t('grocery:groceryList.pricePlaceholder')}
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPurchaseDialog({ open: false, name: '', amount: 0 })}>
              {t('common:cancel')}
            </Button>
            <Button onClick={confirmAddToPantry}>{t('grocery:groceryList.addToPantry')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add to Pantry Dialog */}
      <AlertDialog open={addToPantryDialog?.open || false} onOpenChange={(open) => !open && setAddToPantryDialog(null)}>
        <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('grocery:groceryList.addToPantryQuestion')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('grocery:groceryList.addToPantryConfirm', { name: addToPantryDialog?.itemName })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5 py-2">
            <Label htmlFor="custom-amount">{t('grocery:groceryList.amount')}</Label>
            <div className="flex items-center gap-2">
              <Input
                id="custom-amount"
                type="number"
                min="0"
                step="0.01"
                value={customAmount}
                onChange={(e) => setCustomAmount(parseFloat(e.target.value) || 0)}
              />
              <Select value={customUnit} onValueChange={setCustomUnit}>
                <SelectTrigger className="w-[130px]" aria-label={t('grocery:groceryList.selectUnit')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PANTRY_UNITS.map((unit) => (
                    <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5 py-2">
            <Label htmlFor="custom-price">{t('grocery:groceryList.enterPrice')}</Label>
            <Input
              id="custom-price"
              type="number"
              min="0"
              step="0.01"
              placeholder={t('grocery:groceryList.pricePlaceholder')}
              value={customPrice}
              onChange={(e) => setCustomPrice(e.target.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => confirmPurchaseCustomItem(false)}>
              {t('grocery:groceryList.noJustMarkPurchased')}
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmPurchaseCustomItem(true)}>
              {t('grocery:groceryList.yesAddToPantry')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
