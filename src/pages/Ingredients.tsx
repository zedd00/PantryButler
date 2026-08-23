import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '@/components/layouts/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus, Edit, Trash2, ArrowUpDown, MoreVertical, ArrowLeftRight, AlertTriangle, Wrench, LayoutGrid } from 'lucide-react';
import { getPantryItems, createPantryItem, updatePantryItem, deletePantryItem, checkPantryItemUsage, getSettings, getAllConversions, getCustomLocations, addCustomLocation, getKitchenElementLocations } from '@/api';
import type { PantryItem, Settings, UnitConversion, NutritionFood } from '@/types/types';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { api } from '@/lib/api-client';
import { formatAmount } from '@/lib/format';
import { formatCurrency } from '@/lib/cost';
import { ConversionDialog } from '@/components/dialogs/ConversionDialog';
import { NutritionFoodSearch } from '@/components/nutrition/NutritionFoodSearch';
import { PageTutorial } from '@/components/tutorial/PageTutorial';
import { getIngredientsTutorialSteps } from '@/components/tutorial/tutorialSteps';
import { useTranslation } from 'react-i18next';

type SortField = 'name' | 'location';
type SortOrder = 'asc' | 'desc';

const COMMON_UNITS = ['g', 'kg', 'ml', 'L', 'oz', 'lb', 'cup', 'tbsp', 'tsp', 'whole', 'cloves', 'pinch'];
const DEFAULT_LOCATIONS = ['Pantry', 'Refrigerator', 'Freezer', 'Spice Rack', 'Cabinet', 'Counter', 'Stove Cupboard', 'Drawer'];

// Helper to get default unit based on system setting
const getDefaultUnit = (unitSystem: string): string => {
  switch (unitSystem) {
    case 'metric':
    case 'metric_weights':
      return 'g';
    case 'imperial':
    case 'imperial_volume':
      return 'oz';
    default:
      return 'g';
  }
};

export default function Ingredients() {
  const { t } = useTranslation(['tutorial', 'pantry', 'common']);
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [pantryItems, setPantryItems] = useState<PantryItem[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [, setConversions] = useState<UnitConversion[]>([]);
  const [, setNutritionFoods] = useState<any[]>([]);
  const [customLocations, setCustomLocations] = useState<string[]>([]);
  const [kitchenLocations, setKitchenLocations] = useState<string[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [conversionDialogOpen, setConversionDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ id: string; name: string } | null>(null);
  const [deleteWarning, setDeleteWarning] = useState<{ recipes: Array<{ id: string; title: string }> } | null>(null);
  const [editingItem, setEditingItem] = useState<PantryItem | null>(null);
  const [selectedItemForConversion, setSelectedItemForConversion] = useState<PantryItem | null>(null);
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingAmounts, setEditingAmounts] = useState<Record<string, number>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(15); // Show 15 items per page

  // Form fields
  const [ingredientName, setIngredientName] = useState('');
  const [unit, setUnit] = useState('g');
  const [amount, setAmount] = useState(0);
  const [location, setLocation] = useState('Pantry');
  const [customLocation, setCustomLocation] = useState('');
  const [isAddingNewLocation, setIsAddingNewLocation] = useState(false);
  const [selectedNutritionFood, setSelectedNutritionFood] = useState<NutritionFood | null>(null);
  const [isUnlimited, setIsUnlimited] = useState(false);
  const [price, setPrice] = useState('');
  const [priceSize, setPriceSize] = useState('');

  // All available locations (default + custom + kitchen). Once a kitchen
  // layout with elements exists, the generic defaults are no longer offered —
  // only the real kitchen/custom locations are.
  const allLocations = [
    ...(kitchenLocations.length > 0 ? [] : DEFAULT_LOCATIONS),
    ...customLocations,
    ...kitchenLocations,
    'Add New...',
  ];

  // Keep the currently-selected value in its own dropdown even when it is a
  // default location that is no longer offered for new selections.
  const getLocationOptions = (currentValue: string): string[] => {
    return allLocations.includes(currentValue) ? allLocations : [currentValue, ...allLocations];
  };

  useEffect(() => {
    if (profile) {
      loadData();
    }
  }, [profile]);

  const loadData = async () => {
    if (!profile) return;
    try {
      const [items, userSettings, convs, customLocs, kitchenLocs, nutritionData] = await Promise.all([
        getPantryItems(profile.id),
        getSettings(),
        getAllConversions(),
        getCustomLocations(profile.instance_id),
        getKitchenElementLocations(profile.id),
        api.get<any[]>('/api/nutrition/foods')
      ]);
      setPantryItems(items);
      setSettings(userSettings);
      setConversions(convs);
      setCustomLocations(customLocs);
      setKitchenLocations(kitchenLocs);
      setNutritionFoods(nutritionData || []);
      
      // Set default unit based on system setting
      if (userSettings) {
        const defaultUnit = getDefaultUnit(userSettings.preferred_unit_system);
        setUnit(defaultUnit);
      }
    } catch (error: any) {
      toast.error(t('pantry:ingredientsPage.toasts.loadError', { message: error.message }));
    }
  };

  const handleSaveItem = async () => {
    if (!profile) return;

    if (!ingredientName.trim()) {
      toast.error(t('pantry:ingredientsPage.toasts.nameRequired'));
      return;
    }

    let finalLocation = location;
    
    // Handle "Add New..." selection
    if (location === 'Add New...') {
      if (!customLocation.trim()) {
        toast.error(t('pantry:ingredientsPage.toasts.locationRequired'));
        return;
      }
      finalLocation = customLocation.trim();
      // Add to custom locations
      try {
        await addCustomLocation(profile.instance_id, finalLocation);
      } catch (error: any) {
        // Continue even if adding fails (might be duplicate)
      }
    }
    
    // If no location selected and not adding new, use default
    if (!finalLocation || finalLocation === 'Add New...') {
      finalLocation = kitchenLocations.length > 0 ? kitchenLocations[0] : 'Pantry';
    }

    const finalPrice = price.trim() === '' ? null : Number(price);
    if (price.trim() !== '' && !Number.isFinite(finalPrice)) {
      toast.error(t('pantry:ingredientsPage.toasts.invalidPrice'));
      return;
    }

    const finalPriceSize = priceSize.trim() === '' ? null : Number(priceSize);
    if (priceSize.trim() !== '' && !Number.isFinite(finalPriceSize)) {
      toast.error(t('pantry:ingredientsPage.toasts.invalidPrice'));
      return;
    }

    try {
      const numericAmount = Number(amount) || 0;
      const finalUnit = unit || 'g';
      if (editingItem) {
        await updatePantryItem(editingItem.id, { 
          ingredient_name: ingredientName, 
          unit: finalUnit, 
          amount: numericAmount, 
          price: finalPrice,
          price_size: finalPriceSize,
          location: finalLocation,
          default_display_unit: unit,
          nutrition_food_id: selectedNutritionFood?.id || null,
          is_unlimited: isUnlimited,
        });
        toast.success(t('pantry:ingredientsPage.toasts.updateSuccess'));
      } else {
        await createPantryItem(profile.id, { 
          ingredient_name: ingredientName, 
          unit: finalUnit, 
          amount: numericAmount, 
          price: finalPrice,
          price_size: finalPriceSize,
          location: finalLocation,
          default_display_unit: unit,
          nutrition_food_id: selectedNutritionFood?.id || null,
          is_unlimited: isUnlimited,
        });
        toast.success(t('pantry:ingredientsPage.toasts.addSuccess'));
      }
      
      setDialogOpen(false);
      resetForm();
      loadData();
    } catch (error: any) {
      toast.error(t('pantry:ingredientsPage.toasts.saveError', { message: error.message }));
    }
  };

  const handleDeleteItem = async (id: string, name: string) => {
    try {
      // Check if item is used in recipes
      const usage = await checkPantryItemUsage(id);
      
      if (usage.isUsed) {
        // Show warning dialog with list of recipes
        setItemToDelete({ id, name });
        setDeleteWarning({ recipes: usage.recipes });
        setDeleteDialogOpen(true);
      } else {
        // Delete immediately if not used
        await deletePantryItem(id);
        toast.success(t('pantry:ingredientsPage.toasts.deleteSuccess'));
        loadData();
      }
    } catch (error: any) {
      toast.error(t('pantry:ingredientsPage.toasts.usageCheckError', { message: error.message }));
    }
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    
    try {
      await deletePantryItem(itemToDelete.id);
      toast.success(t('pantry:ingredientsPage.toasts.deleteSuccess'));
      setDeleteDialogOpen(false);
      setItemToDelete(null);
      setDeleteWarning(null);
      loadData();
    } catch (error: any) {
      toast.error(t('pantry:ingredientsPage.toasts.deleteError', { message: error.message }));
    }
  };

  const handleUpdateAmount = async (item: PantryItem, newAmount: number) => {
    try {
      await updatePantryItem(item.id, { amount: newAmount });
      setPantryItems(prev => prev.map(i => i.id === item.id ? { ...i, amount: newAmount } : i));
      // Clear editing state
      setEditingAmounts(prev => {
        const updated = { ...prev };
        delete updated[item.id];
        return updated;
      });
      toast.success(t('pantry:ingredientsPage.toasts.amountUpdateSuccess'));
    } catch (error: any) {
      toast.error(t('pantry:ingredientsPage.toasts.amountUpdateError', { message: error.message }));
    }
  };

  const handleAmountChange = (itemId: string, value: number) => {
    setEditingAmounts(prev => ({ ...prev, [itemId]: value }));
  };

  const handleAmountBlur = (item: PantryItem) => {
    const editedAmount = editingAmounts[item.id];
    if (editedAmount !== undefined && editedAmount !== item.amount) {
      handleUpdateAmount(item, editedAmount);
    }
  };

  const handleUpdateLocation = async (item: PantryItem, newLocation: string) => {
    try {
      await updatePantryItem(item.id, { location: newLocation });
      setPantryItems(prev => prev.map(i => i.id === item.id ? { ...i, location: newLocation } : i));
      toast.success(t('pantry:ingredientsPage.toasts.locationUpdateSuccess'));
    } catch (error: any) {
      toast.error(t('pantry:ingredientsPage.toasts.locationUpdateError', { message: error.message }));
    }
  };

  const resetForm = () => {
    setIngredientName('');
    // Use system default
    const defaultUnit = settings ? getDefaultUnit(settings.preferred_unit_system) : 'g';
    setUnit(defaultUnit);
    setAmount(0);
    setLocation(kitchenLocations.length > 0 ? kitchenLocations[0] : 'Pantry');
    setCustomLocation('');
    setIsAddingNewLocation(false);
    setEditingItem(null);
    setSelectedNutritionFood(null);
    setIsUnlimited(false);
    setPrice('');
    setPriceSize('');
  };

  // When ingredient name changes, check if it exists and use its default_display_unit
  const handleIngredientNameChange = (name: string) => {
    setIngredientName(name);
    
    // Find existing ingredient with same name (case-insensitive)
    const existingItem = pantryItems.find(
      item => item.ingredient_name.toLowerCase() === name.toLowerCase()
    );
    
    // If found and has default_display_unit, use it
    if (existingItem && existingItem.default_display_unit) {
      setUnit(existingItem.default_display_unit);
    }
  };

  const openEditDialog = async (item: PantryItem) => {
    setEditingItem(item);
    setIngredientName(item.ingredient_name);
    setUnit(item.unit);
    setAmount(Number(item.amount));
    
    // Load nutrition food if matched
    if (item.nutrition_food_id) {
      try {
        const { getNutritionFoodById } = await import('@/api/nutrition');
        const nutritionFood = await getNutritionFoodById(item.nutrition_food_id);
        setSelectedNutritionFood(nutritionFood);
      } catch (error) {
        console.error('Error loading nutrition food:', error);
      }
    }
    
    // Check if location is in default, custom, or kitchen locations
    const isKnownLocation = [...DEFAULT_LOCATIONS, ...customLocations, ...kitchenLocations].includes(item.location || '');
    if (isKnownLocation) {
      setLocation(item.location || 'Pantry');
      setCustomLocation('');
      setIsAddingNewLocation(false);
    } else {
      setLocation('Add New...');
      setCustomLocation(item.location || '');
      setIsAddingNewLocation(true);
    }
    setIsUnlimited(item.is_unlimited ?? false);
    setPrice(item.price ? String(item.price) : '');
    setPriceSize(item.price_size ? String(item.price_size) : '');
    setDialogOpen(true);
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Filter and sort items
  const filteredAndSortedItems = pantryItems
    .filter(item => 
      item.ingredient_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.location || '').toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      let compareValue = 0;
      
      if (sortField === 'name') {
        compareValue = a.ingredient_name.localeCompare(b.ingredient_name);
      } else if (sortField === 'location') {
        const locA = a.location || '';
        const locB = b.location || '';
        compareValue = locA.localeCompare(locB);
      }
      
      return sortOrder === 'asc' ? compareValue : -compareValue;
    });

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedItems.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedItems = filteredAndSortedItems.slice(startIndex, endIndex);

  // Reset to page 1 when search term changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const openConversionDialog = (item: PantryItem) => {
    setSelectedItemForConversion(item);
    setConversionDialogOpen(true);
  };

  // Display the price below the amount. When a price_size was recorded (the
  // size the price covers, e.g. "$3.99 / 500 g"), show the price per that size.
  // Otherwise show the derived per-unit price (price / amount on hand). Unlimited
  // items treat the price as the per-unit price directly.
  const formatItemUnitPrice = (item: PantryItem): string => {
    const itemPrice = item.price === null || item.price === undefined ? null : Number(item.price);
    if (itemPrice === null || !Number.isFinite(itemPrice)) {
      return t('pantry:ingredientsPage.noPrice');
    }
    const itemSize = item.price_size === null || item.price_size === undefined ? null : Number(item.price_size);
    const hasSize = itemSize !== null && Number.isFinite(itemSize) && itemSize > 0;
    if (item.is_unlimited) {
      return t('pantry:ingredientsPage.unitPrice', { price: formatCurrency(itemPrice, settings?.currency), unit: item.unit });
    }
    const basis = hasSize ? itemSize : Number(item.amount);
    if (basis <= 0) {
      return t('pantry:ingredientsPage.noPrice');
    }
    if (hasSize) {
      return t('pantry:ingredientsPage.pricePerSize', {
        price: formatCurrency(itemPrice, settings?.currency),
        size: formatAmount(itemSize),
        unit: item.unit,
      });
    }
    return t('pantry:ingredientsPage.unitPrice', { price: formatCurrency(itemPrice / basis, settings?.currency), unit: item.unit });
  };

  return (
    <MainLayout>
      <PageTutorial tutorialId="ingredients-page" steps={getIngredientsTutorialSteps(t)} />
      <div className="space-y-8">
        {/* Navigation Links */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/pantry/equipment')}
          >
            <Wrench className="h-4 w-4 mr-2" />
            {t('pantry:ingredientsPage.navEquipment')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/pantry/layout')}
          >
            <LayoutGrid className="h-4 w-4 mr-2" />
            {t('pantry:ingredientsPage.navPantryLayout')}
          </Button>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold">{t('pantry:ingredientsPage.title')}</h1>
            <p className="text-muted-foreground mt-1">{t('pantry:ingredientsPage.subtitle')}</p>
          </div>
          <Button onClick={() => { resetForm(); setDialogOpen(true); }} data-tutorial="add-ingredient">
            <Plus className="mr-2 h-4 w-4" />
            {t('pantry:ingredientsPage.addIngredient')}
          </Button>
        </div>

        <div className="flex gap-4">
          <Input
            placeholder={t('pantry:ingredientsPage.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
            data-tutorial="search-ingredients"
          />
          <div className="flex gap-2" data-tutorial="filter-location">
            <Button
              variant="outline"
              onClick={() => toggleSort('name')}
              className="gap-2"
            >
              {t('pantry:ingredientsPage.sortByName')}
              <ArrowUpDown className="h-4 w-4" />
              {sortField === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
            </Button>
            <Button
              variant="outline"
              onClick={() => toggleSort('location')}
              className="gap-2"
            >
              {t('pantry:ingredientsPage.sortByLocation')}
              <ArrowUpDown className="h-4 w-4" />
              {sortField === 'location' && (sortOrder === 'asc' ? '↑' : '↓')}
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t('pantry:ingredientsPage.inventoryTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {/* Header Row */}
              <div className="grid grid-cols-12 gap-4 p-3 font-semibold text-sm border-b border-border">
                <div className="col-span-4">{t('pantry:ingredientsPage.tableIngredient')}</div>
                <div className="col-span-3">{t('pantry:ingredientsPage.tableAmount')}</div>
                <div className="col-span-3">{t('pantry:ingredientsPage.tableLocation')}</div>
                <div className="col-span-2 text-right">{t('pantry:ingredientsPage.tableActions')}</div>
              </div>

              {/* Data Rows */}
              {filteredAndSortedItems.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {t('pantry:ingredientsPage.noIngredients')}
                </div>
              ) : (
                <>
                  {paginatedItems.map((item, index) => (
                  <div key={item.id} className="grid grid-cols-12 gap-4 p-3 border border-border rounded hover:bg-accent/50 transition-colors" data-tutorial={index === 0 ? "ingredient-row" : undefined}>
                    <div className="col-span-4 flex items-center font-medium gap-2">
                      {item.ingredient_name}
                      {item.auto_created && (
                        <span className="inline-flex items-center rounded-full border border-dashed border-amber-400 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                          {t('pantry:ingredientsPage.needsSetup')}
                        </span>
                      )}
                    </div>
                    <div className="col-span-3 flex flex-col justify-center gap-1">
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={editingAmounts[item.id] !== undefined ? editingAmounts[item.id] : item.amount}
                          onChange={(e) => handleAmountChange(item.id, parseFloat(e.target.value) || 0)}
                          onBlur={() => handleAmountBlur(item)}
                          className="w-24"
                          min="0"
                          step="0.1"
                        />
                        <span className="text-sm text-muted-foreground">{item.unit}</span>
                        {settings && settings.nutrition_enabled && !item.nutrition_food_id && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => openEditDialog(item)}
                                  className="focus:outline-none"
                                >
                                  <AlertTriangle className="h-4 w-4 text-warning cursor-pointer hover:text-warning/80" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{t('pantry:ingredientsPage.notMatchedToNutrition')}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground" title={t('pantry:ingredientsPage.pricePaid')}>
                        {formatItemUnitPrice(item)}
                      </p>
                    </div>
                    <div className="col-span-3 flex items-center">
                      <Select
                        value={item.location || 'Pantry'}
                        onValueChange={(value) => handleUpdateLocation(item, value)}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {getLocationOptions(item.location || 'Pantry').filter(loc => loc !== 'Add New...').map(loc => (
                            <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2 flex items-center justify-end gap-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="icon" data-tutorial={index === 0 ? "ingredient-actions" : undefined}>
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditDialog(item)}>
                            <Edit className="h-4 w-4 mr-2" />
                            {t('common:edit')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openConversionDialog(item)}>
                            <ArrowLeftRight className="h-4 w-4 mr-2" />
                            {t('pantry:ingredientsPage.addConversion')}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => handleDeleteItem(item.id, item.ingredient_name)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            {t('common:delete')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
                </>
              )}
            </div>
            
            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t border-border">
                <div className="text-sm text-muted-foreground">
                  {t('pantry:ingredientsPage.showingRange', {
                    start: startIndex + 1,
                    end: Math.min(endIndex, filteredAndSortedItems.length),
                    total: filteredAndSortedItems.length,
                  })}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    {t('common:previous')}
                  </Button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      return (
                        <Button
                          key={pageNum}
                          variant={currentPage === pageNum ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setCurrentPage(pageNum)}
                          className="w-10"
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    {t('common:next')}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingItem ? t('pantry:ingredientsPage.editIngredient') : t('pantry:ingredientsPage.addIngredient')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t('pantry:ingredientsPage.ingredientName')}</Label>
              <Input 
                value={ingredientName} 
                onChange={(e) => handleIngredientNameChange(e.target.value)}
                placeholder={t('pantry:ingredientsPage.ingredientNamePlaceholder')}
              />
            </div>
            
            {/* Nutrition Food Search */}
            <NutritionFoodSearch
              ingredientName={ingredientName}
              selectedFoodId={selectedNutritionFood?.id || null}
              onSelect={setSelectedNutritionFood}
            />
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('pantry:ingredientsPage.amountInPantry')}</Label>
                <Input 
                  type="number" 
                  value={amount} 
                  onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                  min="0"
                  step="0.1"
                />
              </div>
              <div className="space-y-2">
                <Label>{t('pantry:ingredientsPage.unit')}</Label>
                <Select value={unit} onValueChange={setUnit}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COMMON_UNITS.map(u => (
                      <SelectItem key={u} value={u}>{u}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('common:price')}</Label>
              <Input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                min="0"
                step="0.01"
                placeholder={t('pantry:ingredientsPage.pricePaidPlaceholder')}
              />
              {!isUnlimited && (
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={priceSize}
                    onChange={(e) => setPriceSize(e.target.value)}
                    min="0"
                    step="0.01"
                    placeholder={t('pantry:ingredientsPage.priceSizePlaceholder')}
                  />
                  <span className="text-sm text-muted-foreground shrink-0">{unit}</span>
                </div>
              )}
              {isUnlimited ? (
                <p className="text-xs text-muted-foreground">
                  {t('pantry:ingredientsPage.pricePerUnitHint', { unit })}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {t('pantry:ingredientsPage.priceSizeHint', { unit })}
                </p>
              )}
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="unlimited">{t('pantry:ingredientsPage.unlimitedSupply')}</Label>
                <p className="text-sm text-muted-foreground">{t('pantry:ingredientsPage.alwaysAvailable')}</p>
              </div>
              <Switch
                id="unlimited"
                checked={isUnlimited}
                onCheckedChange={setIsUnlimited}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('pantry:ingredientsPage.location')}</Label>
              <Select 
                value={location || 'Pantry'} 
                onValueChange={(value) => {
                  setLocation(value);
                  setIsAddingNewLocation(value === 'Add New...');
                  if (value !== 'Add New...') {
                    setCustomLocation('');
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('pantry:ingredientsPage.selectLocationPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {getLocationOptions(location || 'Pantry').map(loc => (
                    <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isAddingNewLocation && (
                <Input
                  placeholder={t('pantry:ingredientsPage.newLocationPlaceholder')}
                  value={customLocation}
                  onChange={(e) => setCustomLocation(e.target.value)}
                  className="mt-2"
                />
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('common:cancel')}</Button>
            <Button onClick={handleSaveItem}>{t('common:save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Conversion Dialog */}
      <ConversionDialog
        open={conversionDialogOpen}
        onOpenChange={setConversionDialogOpen}
        ingredientName={selectedItemForConversion?.ingredient_name || null}
        onConversionsUpdated={async () => {
          const newConversions = await getAllConversions();
          setConversions(newConversions);
        }}
        instanceId={profile?.instance_id}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              {t('pantry:ingredientsPage.deleteDialogTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              {deleteWarning && deleteWarning.recipes.length > 0 ? (
                <>
                  <p className="text-pretty">
                    <strong>{itemToDelete?.name}</strong> {t('pantry:ingredientsPage.usedInRecipes', { count: deleteWarning.recipes.length })}:
                  </p>
                  <ul className="list-disc list-inside space-y-1 pl-2">
                    {deleteWarning.recipes.map(recipe => (
                      <li key={recipe.id} className="text-sm">
                        {recipe.title}
                      </li>
                    ))}
                  </ul>
                  <p className="text-pretty">
                    {t('pantry:ingredientsPage.deleteWarningDescription')}
                  </p>
                </>
              ) : (
                <p className="text-pretty">
                  {t('pantry:ingredientsPage.deleteConfirmMessage', { name: itemToDelete?.name })}
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common:cancel')}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('pantry:ingredientsPage.deleteAnyway')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
