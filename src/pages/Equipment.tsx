import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '@/components/layouts/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Package, LayoutGrid, AlertTriangle } from 'lucide-react';
import { getAllEquipment, createEquipment, updateEquipment, deleteEquipment, checkEquipmentUsage, getCustomLocations, addCustomLocation, getKitchenElementLocations } from '@/api';
import type { Equipment } from '@/types/types';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { PageTutorial } from '@/components/tutorial/PageTutorial';
import { getEquipmentTutorialSteps } from '@/components/tutorial/tutorialSteps';
import { useTranslation } from 'react-i18next';

const COMMON_LOCATIONS = ['Cabinet', 'Drawer', 'Counter', 'Stove Cupboard', 'Oven Drawer', 'Knife Block', 'Pantry', 'Refrigerator'];

export default function EquipmentPage() {
  const { t } = useTranslation(['tutorial', 'pantry', 'common']);
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [equipmentToDelete, setEquipmentToDelete] = useState<Equipment | null>(null);
  const [deleteWarning, setDeleteWarning] = useState<{ recipes: Array<{ id: string; title: string }> } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(15); // Show 15 items per page
  const [customLocations, setCustomLocations] = useState<string[]>([]);
  const [kitchenLocations, setKitchenLocations] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [location, setLocation] = useState('Cabinet');
  const [customLocation, setCustomLocation] = useState('');
  const [isAddingNewLocation, setIsAddingNewLocation] = useState(false);

  // All available locations (default + custom + kitchen). Once a kitchen
  // layout with elements exists, the generic defaults are no longer offered —
  // only the real kitchen/custom locations are.
  const allLocations = [
    ...(kitchenLocations.length > 0 ? [] : COMMON_LOCATIONS),
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
    loadEquipment();
  }, []);

  const loadEquipment = async () => {
    try {
      const [data, customLocs, kitchenLocs] = await Promise.all([
        getAllEquipment(),
        profile ? getCustomLocations(profile.instance_id) : Promise.resolve([]),
        profile ? getKitchenElementLocations(profile.id) : Promise.resolve([])
      ]);
      // Sort by location by default
      const sorted = data.sort((a, b) => {
        const locA = a.location || '';
        const locB = b.location || '';
        return locA.localeCompare(locB);
      });
      setEquipment(sorted);
      setCustomLocations(customLocs);
      setKitchenLocations(kitchenLocs);
    } catch (error: any) {
      toast.error(t('pantry:equipmentPage.toasts.loadError', { message: error.message }));
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error(t('pantry:equipmentPage.toasts.nameRequired'));
      return;
    }

    let finalLocation = location;
    
    // Handle "Add New..." selection
    if (location === 'Add New...') {
      if (!customLocation.trim()) {
        toast.error(t('pantry:equipmentPage.toasts.locationRequired'));
        return;
      }
      finalLocation = customLocation.trim();
      // Add to custom locations
      if (profile) {
        try {
          await addCustomLocation(profile.instance_id, finalLocation);
        } catch (error: any) {
          toast.error(t('pantry:equipmentPage.toasts.customLocationAddError', { message: error.message }));
          return;
        }
      }
    }

    try {
      await createEquipment(name, finalLocation);
      toast.success(t('pantry:equipmentPage.toasts.addSuccess'));
      setDialogOpen(false);
      resetForm();
      loadEquipment();
    } catch (error: any) {
      toast.error(t('pantry:equipmentPage.toasts.saveError', { message: error.message }));
    }
  };

  const handleDeleteClick = async (eq: Equipment) => {
    try {
      // Check if equipment is used in recipes
      const usage = await checkEquipmentUsage(eq.id);
      
      setEquipmentToDelete(eq);
      
      if (usage.isUsed) {
        // Show warning dialog with list of recipes
        setDeleteWarning({ recipes: usage.recipes });
      } else {
        setDeleteWarning(null);
      }
      
      setDeleteDialogOpen(true);
    } catch (error: any) {
      toast.error(t('pantry:equipmentPage.toasts.usageCheckError', { message: error.message }));
    }
  };

  const handleDelete = async () => {
    if (!equipmentToDelete) return;

    try {
      await deleteEquipment(equipmentToDelete.id);
      toast.success(t('pantry:equipmentPage.toasts.deleteSuccess'));
      setDeleteDialogOpen(false);
      setEquipmentToDelete(null);
      setDeleteWarning(null);
      loadEquipment();
    } catch (error: any) {
      toast.error(t('pantry:equipmentPage.toasts.deleteError', { message: error.message }));
    }
  };

  const resetForm = () => {
    setName('');
    setLocation(kitchenLocations.length > 0 ? kitchenLocations[0] : 'Cabinet');
    setCustomLocation('');
    setIsAddingNewLocation(false);
  };

  const filteredEquipment = equipment.filter(eq =>
    eq.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (eq.location || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Pagination
  const totalPages = Math.ceil(filteredEquipment.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedEquipment = filteredEquipment.slice(startIndex, endIndex);

  // Reset to page 1 when search term changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  return (
    <MainLayout>
      <PageTutorial tutorialId="equipment-page" steps={getEquipmentTutorialSteps(t)} />
      <div className="space-y-8">
        {/* Navigation Links */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/pantry/ingredients')}
          >
            <Package className="h-4 w-4 mr-2" />
            {t('pantry:equipmentPage.navIngredients')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/pantry/layout')}
          >
            <LayoutGrid className="h-4 w-4 mr-2" />
            {t('pantry:equipmentPage.navPantryLayout')}
          </Button>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold">{t('pantry:equipmentPage.title')}</h1>
            <p className="text-muted-foreground mt-1">{t('pantry:equipmentPage.subtitle')}</p>
          </div>
          <Button onClick={() => { resetForm(); setDialogOpen(true); }} data-tutorial="add-equipment">
            <Plus className="mr-2 h-4 w-4" />
            {t('pantry:equipmentPage.addEquipment')}
          </Button>
        </div>

        <div className="flex gap-4">
          <Input
            placeholder={t('pantry:equipmentPage.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
            data-tutorial="search-equipment"
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t('pantry:equipmentPage.listTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {/* Header Row */}
              <div className="grid grid-cols-12 gap-4 p-3 font-semibold text-sm border-b border-border">
                <div className="col-span-6">{t('pantry:equipmentPage.tableName')}</div>
                <div className="col-span-5">{t('pantry:equipmentPage.tableLocation')}</div>
                <div className="col-span-1 text-right">{t('pantry:equipmentPage.tableActions')}</div>
              </div>

              {/* Data Rows */}
              {filteredEquipment.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {t('pantry:equipmentPage.noEquipment')}
                </div>
              ) : (
                <>
                  {paginatedEquipment.map((eq, index) => (
                  <div key={eq.id} className="grid grid-cols-12 gap-4 p-3 border border-border rounded hover:bg-accent/50 transition-colors">
                    <div className="col-span-6 flex items-center font-medium">
                      {eq.name}
                    </div>
                    <div className="col-span-5 flex items-center" data-tutorial={index === 0 ? "equipment-location" : undefined}>
                      <Select
                        value={eq.location || 'Cabinet'}
                        onValueChange={async (value) => {
                          if (value === 'Add New...') {
                            const newLoc = prompt(t('pantry:equipmentPage.enterNewLocation'));
                            if (newLoc && newLoc.trim() && profile) {
                              try {
                                await addCustomLocation(profile.instance_id, newLoc.trim());
                                await updateEquipment(eq.id, eq.name, newLoc.trim());
                                await loadEquipment();
                                toast.success(t('pantry:equipmentPage.toasts.locationUpdateSuccess'));
                              } catch (error: any) {
                                toast.error(t('pantry:equipmentPage.toasts.locationUpdateError', { message: error.message }));
                              }
                            }
                          } else {
                            try {
                              await updateEquipment(eq.id, eq.name, value);
                              await loadEquipment();
                              toast.success(t('pantry:equipmentPage.toasts.locationUpdateSuccess'));
                            } catch (error: any) {
                              toast.error(t('pantry:equipmentPage.toasts.locationUpdateError', { message: error.message }));
                            }
                          }
                        }}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {getLocationOptions(eq.location || 'Cabinet').map(loc => (
                            <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-1 flex items-center justify-end">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleDeleteClick(eq)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
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
                  {t('pantry:equipmentPage.showingRange', {
                    start: startIndex + 1,
                    end: Math.min(endIndex, filteredEquipment.length),
                    total: filteredEquipment.length,
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('pantry:equipmentPage.addEquipment')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t('pantry:equipmentPage.equipmentName')}</Label>
              <Input 
                value={name} 
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSave();
                  }
                }}
                placeholder={t('pantry:equipmentPage.namePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('pantry:equipmentPage.location')}</Label>
              <Select 
                value={location} 
                onValueChange={(value) => {
                  setLocation(value);
                  setIsAddingNewLocation(value === 'Add New...');
                  if (value !== 'Add New...') {
                    setCustomLocation('');
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {getLocationOptions(location).map(loc => (
                    <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isAddingNewLocation && (
                <Input
                  placeholder={t('pantry:equipmentPage.newLocationPlaceholder')}
                  value={customLocation}
                  onChange={(e) => setCustomLocation(e.target.value)}
                  className="mt-2"
                />
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('common:cancel')}</Button>
            <Button onClick={handleSave}>{t('common:save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              {t('pantry:equipmentPage.deleteDialogTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              {deleteWarning && deleteWarning.recipes.length > 0 ? (
                <>
                  <p className="text-pretty">
                    <strong>{equipmentToDelete?.name}</strong> {t('pantry:equipmentPage.usedInRecipes', { count: deleteWarning.recipes.length })}:
                  </p>
                  <ul className="list-disc list-inside space-y-1 pl-2">
                    {deleteWarning.recipes.map(recipe => (
                      <li key={recipe.id} className="text-sm">
                        {recipe.title}
                      </li>
                    ))}
                  </ul>
                  <p className="text-pretty">
                    {t('pantry:equipmentPage.deleteWarningDescription')}
                  </p>
                </>
              ) : (
                <p className="text-pretty">
                  {t('pantry:equipmentPage.deleteConfirmMessage', { name: equipmentToDelete?.name })}
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common:cancel')}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('pantry:equipmentPage.deleteAnyway')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
