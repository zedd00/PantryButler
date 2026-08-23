import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface CustomNutritionData {
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
}

interface CustomNutritionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ingredientName: string;
  onSave: (data: CustomNutritionData) => void;
}

export function CustomNutritionDialog({ open, onOpenChange, ingredientName, onSave }: CustomNutritionDialogProps) {
  const { t } = useTranslation('common');
  const [formData, setFormData] = useState<CustomNutritionData>({
    calories: 0,
    protein_g: 0,
    carbs_g: 0,
    fat_g: 0,
    fiber_g: 0,
    sugar_g: 0,
    sodium_mg: 0,
    cholesterol_mg: 0,
    serving_size: '100',
    serving_unit: 'g',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onOpenChange(false);
  };

  const handleNumberChange = (field: keyof CustomNutritionData, value: string) => {
    const numValue = parseFloat(value) || 0;
    setFormData(prev => ({ ...prev, [field]: numValue }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{t('dialogs.nutritionDialog.title')}</DialogTitle>
          <DialogDescription>
            {t('dialogs.nutritionDialog.description', { ingredient: ingredientName })}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto min-h-0 space-y-4 pr-2">
            {/* Serving Size */}
            <div className="bg-muted/30 p-4 rounded-md space-y-3">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {t('dialogs.nutritionDialog.infoText')}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="serving_size">{t('dialogs.nutritionDialog.servingSize')}</Label>
                  <Input
                    id="serving_size"
                    type="number"
                    step="0.1"
                    value={formData.serving_size}
                    onChange={(e) => setFormData(prev => ({ ...prev, serving_size: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="serving_unit">{t('dialogs.nutritionDialog.unit')}</Label>
                  <Input
                    id="serving_unit"
                    type="text"
                    value={formData.serving_unit}
                    onChange={(e) => setFormData(prev => ({ ...prev, serving_unit: e.target.value }))}
                    placeholder={t('dialogs.nutritionDialog.unitPlaceholder')}
                    required
                  />
                </div>
              </div>
            </div>

            <Tabs defaultValue="macros" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="macros">{t('dialogs.nutritionDialog.macronutrients')}</TabsTrigger>
                <TabsTrigger value="other">{t('dialogs.nutritionDialog.otherNutrients')}</TabsTrigger>
              </TabsList>

              <TabsContent value="macros" className="space-y-4 mt-4">
                {/* Calories */}
                <div className="space-y-2">
                  <Label htmlFor="calories">{t('dialogs.nutritionDialog.calories')} {t('dialogs.nutritionDialog.required')}</Label>
                  <Input
                    id="calories"
                    type="number"
                    step="1"
                    value={formData.calories}
                    onChange={(e) => handleNumberChange('calories', e.target.value)}
                    required
                  />
                </div>

                {/* Protein */}
                <div className="space-y-2">
                  <Label htmlFor="protein">{t('dialogs.nutritionDialog.protein')} {t('dialogs.nutritionDialog.required')}</Label>
                  <Input
                    id="protein"
                    type="number"
                    step="0.1"
                    value={formData.protein_g}
                    onChange={(e) => handleNumberChange('protein_g', e.target.value)}
                    required
                  />
                </div>

                {/* Carbohydrates */}
                <div className="space-y-2">
                  <Label htmlFor="carbs">{t('dialogs.nutritionDialog.carbohydrates')} {t('dialogs.nutritionDialog.required')}</Label>
                  <Input
                    id="carbs"
                    type="number"
                    step="0.1"
                    value={formData.carbs_g}
                    onChange={(e) => handleNumberChange('carbs_g', e.target.value)}
                    required
                  />
                </div>

                {/* Fat */}
                <div className="space-y-2">
                  <Label htmlFor="fat">{t('dialogs.nutritionDialog.totalFat')} {t('dialogs.nutritionDialog.required')}</Label>
                  <Input
                    id="fat"
                    type="number"
                    step="0.1"
                    value={formData.fat_g}
                    onChange={(e) => handleNumberChange('fat_g', e.target.value)}
                    required
                  />
                </div>
              </TabsContent>

              <TabsContent value="other" className="space-y-4 mt-4">
                {/* Fiber */}
                <div className="space-y-2">
                  <Label htmlFor="fiber">{t('dialogs.nutritionDialog.dietaryFiber')}</Label>
                  <Input
                    id="fiber"
                    type="number"
                    step="0.1"
                    value={formData.fiber_g}
                    onChange={(e) => handleNumberChange('fiber_g', e.target.value)}
                  />
                </div>

                {/* Sugar */}
                <div className="space-y-2">
                  <Label htmlFor="sugar">{t('dialogs.nutritionDialog.totalSugars')}</Label>
                  <Input
                    id="sugar"
                    type="number"
                    step="0.1"
                    value={formData.sugar_g}
                    onChange={(e) => handleNumberChange('sugar_g', e.target.value)}
                  />
                </div>

                {/* Sodium */}
                <div className="space-y-2">
                  <Label htmlFor="sodium">{t('dialogs.nutritionDialog.sodium')}</Label>
                  <Input
                    id="sodium"
                    type="number"
                    step="1"
                    value={formData.sodium_mg}
                    onChange={(e) => handleNumberChange('sodium_mg', e.target.value)}
                  />
                </div>

                {/* Cholesterol */}
                <div className="space-y-2">
                  <Label htmlFor="cholesterol">{t('dialogs.nutritionDialog.cholesterol')}</Label>
                  <Input
                    id="cholesterol"
                    type="number"
                    step="1"
                    value={formData.cholesterol_mg}
                    onChange={(e) => handleNumberChange('cholesterol_mg', e.target.value)}
                  />
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <DialogFooter className="shrink-0 mt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('dialogs.nutritionDialog.cancel')}
            </Button>
            <Button type="submit">
              {t('dialogs.nutritionDialog.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
