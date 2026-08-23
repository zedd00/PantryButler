import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import type { PantryItem, Equipment } from '@/types/types';
import { Package, Wrench } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ItemInventoryProps {
  ingredients: PantryItem[];
  equipment: Equipment[];
}

export default function ItemInventory({ ingredients, equipment }: ItemInventoryProps) {
  const { t } = useTranslation(['kitchen']);
  const [ingredientSearch, setIngredientSearch] = useState('');
  const [equipmentSearch, setEquipmentSearch] = useState('');

  const filteredIngredients = ingredients.filter(item =>
    item.ingredient_name.toLowerCase().includes(ingredientSearch.toLowerCase())
  );

  const filteredEquipment = equipment.filter(item =>
    item.name.toLowerCase().includes(equipmentSearch.toLowerCase())
  );

  const handleDragStart = (
    e: React.DragEvent,
    itemType: 'ingredient' | 'equipment',
    itemId: string,
    itemName: string
  ) => {
    e.dataTransfer.setData('itemType', itemType);
    e.dataTransfer.setData('itemId', itemId);
    e.dataTransfer.setData('itemName', itemName);
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <Card className="h-full rounded-none border-0 shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{t('kitchen:itemInventory')}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Tabs defaultValue="ingredients" className="w-full">
          <TabsList className="w-full grid grid-cols-2 mx-4">
            <TabsTrigger value="ingredients">{t('kitchen:ingredients')}</TabsTrigger>
            <TabsTrigger value="equipment">{t('kitchen:equipment')}</TabsTrigger>
          </TabsList>

          <TabsContent value="ingredients" className="mt-0">
            <div className="px-4 py-3">
              <Input
                placeholder={t('kitchen:searchIngredients')}
                value={ingredientSearch}
                onChange={(e) => setIngredientSearch(e.target.value)}
                className="h-9"
              />
            </div>
            <ScrollArea className="h-[calc(100vh-16rem)]">
              <div className="px-4 pb-4 space-y-1">
                {filteredIngredients.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    {ingredientSearch ? t('kitchen:noMatchingIngredients') : t('kitchen:noIngredients')}
                  </p>
                ) : (
                  filteredIngredients.map((item) => (
                    <div
                      key={item.id}
                      draggable
                      onDragStart={(e) =>
                        handleDragStart(e, 'ingredient', item.id, item.ingredient_name)
                      }
                      className="flex items-center gap-2 p-2 rounded border bg-card hover:bg-accent hover:text-accent-foreground cursor-move transition-colors"
                    >
                      <Package className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {item.ingredient_name}
                        </p>
                        {item.preparation && (
                          <p className="text-xs text-muted-foreground truncate">
                            {item.preparation}
                          </p>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground shrink-0">
                        {item.amount} {item.unit}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="equipment" className="mt-0">
            <div className="px-4 py-3">
              <Input
                placeholder={t('kitchen:searchEquipment')}
                value={equipmentSearch}
                onChange={(e) => setEquipmentSearch(e.target.value)}
                className="h-9"
              />
            </div>
            <ScrollArea className="h-[calc(100vh-16rem)]">
              <div className="px-4 pb-4 space-y-1">
                {filteredEquipment.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    {equipmentSearch ? t('kitchen:noMatchingEquipment') : t('kitchen:noEquipment')}
                  </p>
                ) : (
                  filteredEquipment.map((item) => (
                    <div
                      key={item.id}
                      draggable
                      onDragStart={(e) =>
                        handleDragStart(e, 'equipment', item.id, item.name)
                      }
                      className="flex items-center gap-2 p-2 rounded border bg-card hover:bg-accent hover:text-accent-foreground cursor-move transition-colors"
                    >
                      <Wrench className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.name}</p>
                        {item.location && (
                          <p className="text-xs text-muted-foreground truncate">
                            {item.location}
                          </p>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
