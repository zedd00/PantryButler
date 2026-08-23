import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Info } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

interface NutritionData {
  servings: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sugar_g: number;
  sodium_mg: number;
  cholesterol_mg: number;
  // Micronutrients
  calcium_mg?: number;
  iron_mg?: number;
  magnesium_mg?: number;
  phosphorus_mg?: number;
  potassium_mg?: number;
  zinc_mg?: number;
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
}

interface NutritionLabelProps {
  nutrition: NutritionData;
  className?: string;
}

export default function NutritionLabel({ nutrition, className = '' }: NutritionLabelProps) {
  const { t } = useTranslation('recipes');
  const perServing = {
    calories: Math.round(nutrition.calories / nutrition.servings),
    protein: (nutrition.protein_g / nutrition.servings).toFixed(1),
    carbs: (nutrition.carbs_g / nutrition.servings).toFixed(1),
    fat: (nutrition.fat_g / nutrition.servings).toFixed(1),
    fiber: (nutrition.fiber_g / nutrition.servings).toFixed(1),
    sugar: (nutrition.sugar_g / nutrition.servings).toFixed(1),
    sodium: Math.round(nutrition.sodium_mg / nutrition.servings),
    cholesterol: Math.round(nutrition.cholesterol_mg / nutrition.servings),
  };

  // Helper to check if micronutrients exist
  const hasMicronutrients = nutrition.calcium_mg || nutrition.iron_mg || nutrition.vitamin_a_mcg || 
    nutrition.vitamin_c_mg || nutrition.vitamin_d_mcg || nutrition.potassium_mg;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {t('nutritionLabel.nutritionFacts')}
          <Info className="h-4 w-4 text-muted-foreground" />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="border-2 border-foreground p-2 font-sans">
          {/* Header */}
          <div className="border-b-8 border-foreground pb-1">
            <h3 className="text-3xl font-bold">{t('nutritionLabel.nutritionFacts')}</h3>
            <p className="text-sm">{t('nutritionLabel.servingsPerRecipe', { servings: nutrition.servings })}</p>
          </div>

          {/* Serving Size */}
          <div className="border-b-4 border-foreground py-1">
            <p className="text-sm font-semibold">{t('nutritionLabel.servingSize', { servings: nutrition.servings })}</p>
          </div>

          {/* Calories */}
          <div className="border-b-8 border-foreground py-2">
            <div className="flex items-end justify-between">
              <span className="text-sm font-semibold">{t('nutritionLabel.amountPerServing')}</span>
            </div>
            <div className="flex items-end justify-between">
              <span className="text-2xl font-bold">{t('calories')}</span>
              <span className="text-3xl font-bold">{perServing.calories}</span>
            </div>
          </div>

          {/* Daily Value Header */}
          <div className="border-b border-foreground py-1 text-right">
            <span className="text-sm font-semibold">{t('nutritionLabel.dailyValue')}</span>
          </div>

          {/* Nutrients */}
          <div className="space-y-0">
            {/* Total Fat */}
            <div className="flex justify-between border-b border-foreground py-1">
              <span className="font-semibold">
                <span className="font-bold">{t('nutritionLabel.totalFat')}</span> {perServing.fat}g
              </span>
              <span className="font-bold">{Math.round((parseFloat(perServing.fat) / 78) * 100)}%</span>
            </div>

            {/* Cholesterol */}
            <div className="flex justify-between border-b border-foreground py-1">
              <span className="font-semibold">
                <span className="font-bold">{t('nutritionLabel.cholesterol')}</span> {perServing.cholesterol}mg
              </span>
              <span className="font-bold">{Math.round((perServing.cholesterol / 300) * 100)}%</span>
            </div>

            {/* Sodium */}
            <div className="flex justify-between border-b border-foreground py-1">
              <span className="font-semibold">
                <span className="font-bold">{t('sodium')}</span> {perServing.sodium}mg
              </span>
              <span className="font-bold">{Math.round((perServing.sodium / 2300) * 100)}%</span>
            </div>

            {/* Total Carbohydrate */}
            <div className="flex justify-between border-b border-foreground py-1">
              <span className="font-semibold">
                <span className="font-bold">{t('nutritionLabel.totalCarbohydrate')}</span> {perServing.carbs}g
              </span>
              <span className="font-bold">{Math.round((parseFloat(perServing.carbs) / 275) * 100)}%</span>
            </div>

            {/* Dietary Fiber - indented */}
            <div className="flex justify-between border-b border-foreground py-1 pl-4">
              <span>{t('nutritionLabel.dietaryFiber')} {perServing.fiber}g</span>
              <span className="font-bold">{Math.round((parseFloat(perServing.fiber) / 28) * 100)}%</span>
            </div>

            {/* Total Sugars - indented */}
            <div className="flex justify-between border-b border-foreground py-1 pl-4">
              <span>{t('nutritionLabel.totalSugars')} {perServing.sugar}g</span>
              <span></span>
            </div>

            {/* Protein */}
            <div className="flex justify-between border-b-8 border-foreground py-1">
              <span className="font-semibold">
                <span className="font-bold">{t('protein')}</span> {perServing.protein}g
              </span>
              <span></span>
            </div>

            {/* Micronutrients - only show if we have data */}
            {hasMicronutrients && (
              <div className="space-y-0 pt-2">
                {nutrition.vitamin_d_mcg && nutrition.vitamin_d_mcg > 0 && (
                  <div className="flex justify-between border-b border-foreground py-1">
                    <span>{t('nutritionLabel.vitaminD')} {(nutrition.vitamin_d_mcg / nutrition.servings).toFixed(1)}mcg</span>
                    <span className="font-bold">{Math.round(((nutrition.vitamin_d_mcg / nutrition.servings) / 20) * 100)}%</span>
                  </div>
                )}
                {nutrition.calcium_mg && nutrition.calcium_mg > 0 && (
                  <div className="flex justify-between border-b border-foreground py-1">
                    <span>{t('nutritionLabel.calcium')} {Math.round(nutrition.calcium_mg / nutrition.servings)}mg</span>
                    <span className="font-bold">{Math.round((nutrition.calcium_mg / nutrition.servings / 1300) * 100)}%</span>
                  </div>
                )}
                {nutrition.iron_mg && nutrition.iron_mg > 0 && (
                  <div className="flex justify-between border-b border-foreground py-1">
                    <span>{t('nutritionLabel.iron')} {(nutrition.iron_mg / nutrition.servings).toFixed(1)}mg</span>
                    <span className="font-bold">{Math.round(((nutrition.iron_mg / nutrition.servings) / 18) * 100)}%</span>
                  </div>
                )}
                {nutrition.potassium_mg && nutrition.potassium_mg > 0 && (
                  <div className="flex justify-between border-b border-foreground py-1">
                    <span>{t('nutritionLabel.potassium')} {Math.round(nutrition.potassium_mg / nutrition.servings)}mg</span>
                    <span className="font-bold">{Math.round((nutrition.potassium_mg / nutrition.servings / 4700) * 100)}%</span>
                  </div>
                )}
                {nutrition.vitamin_a_mcg && nutrition.vitamin_a_mcg > 0 && (
                  <div className="flex justify-between border-b border-foreground py-1">
                    <span>{t('nutritionLabel.vitaminA')} {Math.round(nutrition.vitamin_a_mcg / nutrition.servings)}mcg</span>
                    <span className="font-bold">{Math.round((nutrition.vitamin_a_mcg / nutrition.servings / 900) * 100)}%</span>
                  </div>
                )}
                {nutrition.vitamin_c_mg && nutrition.vitamin_c_mg > 0 && (
                  <div className="flex justify-between border-b border-foreground py-1">
                    <span>{t('nutritionLabel.vitaminC')} {(nutrition.vitamin_c_mg / nutrition.servings).toFixed(1)}mg</span>
                    <span className="font-bold">{Math.round(((nutrition.vitamin_c_mg / nutrition.servings) / 90) * 100)}%</span>
                  </div>
                )}
                {nutrition.vitamin_e_mg && nutrition.vitamin_e_mg > 0 && (
                  <div className="flex justify-between border-b border-foreground py-1">
                    <span>{t('nutritionLabel.vitaminE')} {(nutrition.vitamin_e_mg / nutrition.servings).toFixed(1)}mg</span>
                    <span className="font-bold">{Math.round(((nutrition.vitamin_e_mg / nutrition.servings) / 15) * 100)}%</span>
                  </div>
                )}
                {nutrition.vitamin_k_mcg && nutrition.vitamin_k_mcg > 0 && (
                  <div className="flex justify-between border-b border-foreground py-1">
                    <span>{t('nutritionLabel.vitaminK')} {(nutrition.vitamin_k_mcg / nutrition.servings).toFixed(1)}mcg</span>
                    <span className="font-bold">{Math.round(((nutrition.vitamin_k_mcg / nutrition.servings) / 120) * 100)}%</span>
                  </div>
                )}
                {nutrition.thiamin_mg && nutrition.thiamin_mg > 0 && (
                  <div className="flex justify-between border-b border-foreground py-1">
                    <span>{t('nutritionLabel.thiamin')} {(nutrition.thiamin_mg / nutrition.servings).toFixed(2)}mg</span>
                    <span className="font-bold">{Math.round(((nutrition.thiamin_mg / nutrition.servings) / 1.2) * 100)}%</span>
                  </div>
                )}
                {nutrition.riboflavin_mg && nutrition.riboflavin_mg > 0 && (
                  <div className="flex justify-between border-b border-foreground py-1">
                    <span>{t('nutritionLabel.riboflavin')} {(nutrition.riboflavin_mg / nutrition.servings).toFixed(2)}mg</span>
                    <span className="font-bold">{Math.round(((nutrition.riboflavin_mg / nutrition.servings) / 1.3) * 100)}%</span>
                  </div>
                )}
                {nutrition.niacin_mg && nutrition.niacin_mg > 0 && (
                  <div className="flex justify-between border-b border-foreground py-1">
                    <span>{t('nutritionLabel.niacin')} {(nutrition.niacin_mg / nutrition.servings).toFixed(1)}mg</span>
                    <span className="font-bold">{Math.round(((nutrition.niacin_mg / nutrition.servings) / 16) * 100)}%</span>
                  </div>
                )}
                {nutrition.vitamin_b6_mg && nutrition.vitamin_b6_mg > 0 && (
                  <div className="flex justify-between border-b border-foreground py-1">
                    <span>{t('nutritionLabel.vitaminB6')} {(nutrition.vitamin_b6_mg / nutrition.servings).toFixed(2)}mg</span>
                    <span className="font-bold">{Math.round(((nutrition.vitamin_b6_mg / nutrition.servings) / 1.7) * 100)}%</span>
                  </div>
                )}
                {nutrition.folate_mcg && nutrition.folate_mcg > 0 && (
                  <div className="flex justify-between border-b border-foreground py-1">
                    <span>{t('nutritionLabel.folate')} {Math.round(nutrition.folate_mcg / nutrition.servings)}mcg</span>
                    <span className="font-bold">{Math.round((nutrition.folate_mcg / nutrition.servings / 400) * 100)}%</span>
                  </div>
                )}
                {nutrition.vitamin_b12_mcg && nutrition.vitamin_b12_mcg > 0 && (
                  <div className="flex justify-between border-b border-foreground py-1">
                    <span>{t('nutritionLabel.vitaminB12')} {(nutrition.vitamin_b12_mcg / nutrition.servings).toFixed(1)}mcg</span>
                    <span className="font-bold">{Math.round(((nutrition.vitamin_b12_mcg / nutrition.servings) / 2.4) * 100)}%</span>
                  </div>
                )}
                {nutrition.pantothenic_acid_mg && nutrition.pantothenic_acid_mg > 0 && (
                  <div className="flex justify-between border-b border-foreground py-1">
                    <span>{t('nutritionLabel.pantothenicAcid')} {(nutrition.pantothenic_acid_mg / nutrition.servings).toFixed(1)}mg</span>
                    <span className="font-bold">{Math.round(((nutrition.pantothenic_acid_mg / nutrition.servings) / 5) * 100)}%</span>
                  </div>
                )}
                {nutrition.phosphorus_mg && nutrition.phosphorus_mg > 0 && (
                  <div className="flex justify-between border-b border-foreground py-1">
                    <span>{t('nutritionLabel.phosphorus')} {Math.round(nutrition.phosphorus_mg / nutrition.servings)}mg</span>
                    <span className="font-bold">{Math.round((nutrition.phosphorus_mg / nutrition.servings / 1250) * 100)}%</span>
                  </div>
                )}
                {nutrition.magnesium_mg && nutrition.magnesium_mg > 0 && (
                  <div className="flex justify-between border-b border-foreground py-1">
                    <span>{t('nutritionLabel.magnesium')} {Math.round(nutrition.magnesium_mg / nutrition.servings)}mg</span>
                    <span className="font-bold">{Math.round((nutrition.magnesium_mg / nutrition.servings / 420) * 100)}%</span>
                  </div>
                )}
                {nutrition.zinc_mg && nutrition.zinc_mg > 0 && (
                  <div className="flex justify-between border-b border-foreground py-1">
                    <span>{t('nutritionLabel.zinc')} {(nutrition.zinc_mg / nutrition.servings).toFixed(1)}mg</span>
                    <span className="font-bold">{Math.round(((nutrition.zinc_mg / nutrition.servings) / 11) * 100)}%</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="pt-2 text-xs space-y-1">
            <p>{t('nutritionLabel.disclaimer')}</p>
            <p className="text-muted-foreground">
              {t('nutritionLabel.nutritionProvidedBy')}{' '}
              <Link to="/attribution" className="text-primary hover:underline">
                OpenNutrition
              </Link>
              . {t('nutritionLabel.valuesAreEstimates')}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
