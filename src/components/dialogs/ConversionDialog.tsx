import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Search } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api-client';
import { useTranslation } from 'react-i18next';
import type { UnitConversion } from '@/types/types';

interface ConversionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ingredientName: string | null;
  onConversionsUpdated?: () => void;
  instanceId?: string;
}

export function ConversionDialog({ open, onOpenChange, ingredientName, onConversionsUpdated, instanceId }: ConversionDialogProps) {
  const { t } = useTranslation('common');
  const [conversion, setConversion] = useState<Partial<UnitConversion>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && ingredientName) {
      loadConversion();
    }
  }, [open, ingredientName]);

  // Auto-calculate related conversions when a value changes
  const updateConversionWithCalculations = (field: keyof UnitConversion, value: number | null) => {
    const newConversion = { ...conversion, [field]: value };

    if (value !== null && value > 0) {
      // If tsp_to_g is set, calculate related conversions
      if (field === 'tsp_to_g') {
        newConversion.tbsp_to_g = value * 3; // 1 tbsp = 3 tsp
        newConversion.cup_to_g = value * 48; // 1 cup = 48 tsp
      }
      // If tbsp_to_g is set, calculate related conversions
      else if (field === 'tbsp_to_g') {
        newConversion.tsp_to_g = value / 3; // 1 tsp = 1/3 tbsp
        newConversion.cup_to_g = value * 16; // 1 cup = 16 tbsp
      }
      // If cup_to_g is set, calculate related conversions
      else if (field === 'cup_to_g') {
        newConversion.tbsp_to_g = value / 16; // 1 tbsp = 1/16 cup
        newConversion.tsp_to_g = value / 48; // 1 tsp = 1/48 cup
      }
      // If oz_to_g is set (weight ounce)
      else if (field === 'oz_to_g') {
        // 1 oz = 28.35 g (standard), but this is ingredient-specific
        // Don't auto-calculate from oz since it's weight-based
      }
      // If fl_oz_to_ml is set, calculate related conversions
      else if (field === 'fl_oz_to_ml') {
        newConversion.fl_oz_to_l = value / 1000; // ml to liters
      }
      // If fl_oz_to_l is set
      else if (field === 'fl_oz_to_l') {
        newConversion.fl_oz_to_ml = value * 1000; // liters to ml
      }
      // If ml_to_pint is set
      else if (field === 'ml_to_pint') {
        newConversion.ml_to_quart = value / 2; // 1 quart = 2 pints
        newConversion.ml_to_gallon = value / 8; // 1 gallon = 8 pints
      }
      // If ml_to_quart is set
      else if (field === 'ml_to_quart') {
        newConversion.ml_to_pint = value * 2; // 1 quart = 2 pints
        newConversion.ml_to_gallon = value / 4; // 1 gallon = 4 quarts
      }
      // If ml_to_gallon is set
      else if (field === 'ml_to_gallon') {
        newConversion.ml_to_pint = value * 8; // 1 gallon = 8 pints
        newConversion.ml_to_quart = value * 4; // 1 gallon = 4 quarts
      }
      // If l_to_pint is set
      else if (field === 'l_to_pint') {
        newConversion.l_to_quart = value / 2; // 1 quart = 2 pints
        newConversion.l_to_gallon = value / 8; // 1 gallon = 8 pints
        newConversion.ml_to_pint = value / 1000; // 1 L = 1000 ml
      }
      // If l_to_quart is set
      else if (field === 'l_to_quart') {
        newConversion.l_to_pint = value * 2; // 1 quart = 2 pints
        newConversion.l_to_gallon = value / 4; // 1 gallon = 4 quarts
        newConversion.ml_to_quart = value / 1000; // 1 L = 1000 ml
      }
      // If l_to_gallon is set
      else if (field === 'l_to_gallon') {
        newConversion.l_to_pint = value * 8; // 1 gallon = 8 pints
        newConversion.l_to_quart = value * 4; // 1 gallon = 4 quarts
        newConversion.ml_to_gallon = value / 1000; // 1 L = 1000 ml
      }
    }

    setConversion(newConversion);
  };

  const loadConversion = async () => {
    if (!ingredientName) return;
    
    setLoading(true);
    try {
      let customConversion: any = null;
      try {
        const params = new URLSearchParams({ ingredient_name: ingredientName });
        if (instanceId) params.set('instance_id', instanceId);
        const conversions = await api.get<any[]>(`/api/conversions?${params.toString()}`);
        customConversion = conversions.length > 0 ? conversions[0] : null;
      } catch {
        // No conversion found
      }

      if (customConversion) {
        setConversion(customConversion);
      } else {
        let nutritionFoods: any = null;
        try {
          const foods = await api.get<any[]>(`/api/nutrition/search?q=${encodeURIComponent(ingredientName)}`);
          nutritionFoods = foods.length > 0 ? foods[0] : null;
        } catch {
          // No nutrition food found via search
        }

        if (!nutritionFoods) {
          try {
            const allFoods = await api.get<any[]>('/api/nutrition/foods');
            const lower = ingredientName.toLowerCase();
            nutritionFoods = allFoods?.find((f: any) =>
              f.name?.toLowerCase().includes(lower)
            ) || null;
          } catch {
            // Fallback failed
          }
        }

        if (nutritionFoods) {
          setConversion({
            ingredient_name: ingredientName,
            tbsp_to_g: nutritionFoods.tbsp_to_g,
            tsp_to_g: nutritionFoods.tsp_to_g,
            oz_to_g: nutritionFoods.oz_to_g,
            cup_to_g: nutritionFoods.cup_to_g,
            fl_oz_to_ml: nutritionFoods.fl_oz_to_ml,
            fl_oz_to_l: nutritionFoods.fl_oz_to_l,
            ml_to_pint: nutritionFoods.ml_to_pint,
            ml_to_quart: nutritionFoods.ml_to_quart,
            ml_to_gallon: nutritionFoods.ml_to_gallon,
            l_to_pint: nutritionFoods.l_to_pint,
            l_to_quart: nutritionFoods.l_to_quart,
            l_to_gallon: nutritionFoods.l_to_gallon,
          });
        } else {
          setConversion({ ingredient_name: ingredientName });
        }
      }
    } catch (error: any) {
      console.error('Failed to load conversion:', error);
      toast.error(t('dialogs.conversionDialog.conversionLoadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!ingredientName) return;
    if (!instanceId) {
      toast.error(t('dialogs.conversionDialog.conversionSaveFailed'));
      return;
    }

    setSaving(true);
    try {
      const dataToSave = {
        ingredient_name: ingredientName,
        instance_id: instanceId,
        tbsp_to_g: conversion.tbsp_to_g || null,
        tsp_to_g: conversion.tsp_to_g || null,
        oz_to_g: conversion.oz_to_g || null,
        cup_to_g: conversion.cup_to_g || null,
        fl_oz_to_ml: conversion.fl_oz_to_ml || null,
        fl_oz_to_l: conversion.fl_oz_to_l || null,
        ml_to_pint: conversion.ml_to_pint || null,
        ml_to_quart: conversion.ml_to_quart || null,
        ml_to_gallon: conversion.ml_to_gallon || null,
        l_to_pint: conversion.l_to_pint || null,
        l_to_quart: conversion.l_to_quart || null,
        l_to_gallon: conversion.l_to_gallon || null,
        notes: conversion.notes || null
      };

      await api.post('/api/conversions', dataToSave);

      toast.success(t('dialogs.conversionDialog.conversionSaved'));
      onConversionsUpdated?.();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Failed to save conversion:', error);
      toast.error(t('dialogs.conversionDialog.conversionSaveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const getDuckDuckGoLink = (fromUnit: string, toUnit: string) => {
    const query = `${ingredientName} ${fromUnit} to ${toUnit}`;
    return `https://duckduckgo.com/?q=${encodeURIComponent(query)}`;
  };

  const ConversionField = ({ 
    label, 
    field, 
    fromUnit, 
    toUnit 
  }: { 
    label: string; 
    field: keyof UnitConversion; 
    fromUnit: string; 
    toUnit: string;
  }) => (
    <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
      <div>
        <Label htmlFor={field as string} className="text-sm">{label}</Label>
        <Input
          id={field as string}
          type="number"
          step="0.01"
          placeholder={t('dialogs.conversionDialog.enterValue')}
          value={conversion[field] as number || ''}
          onChange={(e) => {
            const value = e.target.value ? parseFloat(e.target.value) : null;
            updateConversionWithCalculations(field, value);
          }}
        />
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => window.open(getDuckDuckGoLink(fromUnit, toUnit), '_blank')}
        title={t('dialogs.conversionDialog.searchConversion')}
      >
        <Search className="h-4 w-4 mr-1" />
        {t('dialogs.conversionDialog.search')}
      </Button>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {t('dialogs.conversionDialog.title', { ingredient: ingredientName || 'Ingredient' })}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <p className="text-sm text-muted-foreground">{t('dialogs.conversionDialog.loading')}</p>
        ) : (
          <div className="space-y-6">
            {/* Volume to Weight Conversions */}
            <div>
              <h3 className="text-sm font-medium mb-3">{t('dialogs.conversionDialog.volumeToWeight')}</h3>
              <div className="grid gap-3">
                <ConversionField label={t('dialogs.conversionDialog.tablespoonToGrams')} field="tbsp_to_g" fromUnit="tablespoon" toUnit="grams" />
                <ConversionField label={t('dialogs.conversionDialog.teaspoonToGrams')} field="tsp_to_g" fromUnit="teaspoon" toUnit="grams" />
                <ConversionField label={t('dialogs.conversionDialog.ounceToGrams')} field="oz_to_g" fromUnit="ounce" toUnit="grams" />
                <ConversionField label={t('dialogs.conversionDialog.cupToGrams')} field="cup_to_g" fromUnit="cup" toUnit="grams" />
              </div>
            </div>

            {/* Imperial to Metric Volume */}
            <div>
              <h3 className="text-sm font-medium mb-3">{t('dialogs.conversionDialog.imperialToMetric')}</h3>
              <div className="grid gap-3">
                <ConversionField label={t('dialogs.conversionDialog.fluidOunceToMilliliters')} field="fl_oz_to_ml" fromUnit="fluid ounce" toUnit="milliliters" />
                <ConversionField label={t('dialogs.conversionDialog.fluidOunceToLiters')} field="fl_oz_to_l" fromUnit="fluid ounce" toUnit="liters" />
              </div>
            </div>

            {/* Metric to Imperial Volume */}
            <div>
              <h3 className="text-sm font-medium mb-3">{t('dialogs.conversionDialog.metricToImperial')}</h3>
              <div className="grid gap-3">
                <ConversionField label={t('dialogs.conversionDialog.milliliterToPint')} field="ml_to_pint" fromUnit="milliliter" toUnit="pint" />
                <ConversionField label={t('dialogs.conversionDialog.milliliterToQuart')} field="ml_to_quart" fromUnit="milliliter" toUnit="quart" />
                <ConversionField label={t('dialogs.conversionDialog.milliliterToGallon')} field="ml_to_gallon" fromUnit="milliliter" toUnit="gallon" />
                <ConversionField label={t('dialogs.conversionDialog.literToPint')} field="l_to_pint" fromUnit="liter" toUnit="pint" />
                <ConversionField label={t('dialogs.conversionDialog.literToQuart')} field="l_to_quart" fromUnit="liter" toUnit="quart" />
                <ConversionField label={t('dialogs.conversionDialog.literToGallon')} field="l_to_gallon" fromUnit="liter" toUnit="gallon" />
              </div>
            </div>

            {/* Notes */}
            <div>
              <Label htmlFor="notes">{t('notes')}</Label>
              <Input
                id="notes"
                placeholder={t('dialogs.conversionDialog.optionalNotes')}
                value={conversion.notes || ''}
                onChange={(e) => setConversion({ ...conversion, notes: e.target.value })}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('dialogs.conversionDialog.cancel')}
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? t('dialogs.conversionDialog.saving') : t('dialogs.conversionDialog.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
