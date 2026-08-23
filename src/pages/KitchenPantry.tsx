import { useEffect, useState } from 'react';
import MainLayout from '@/components/layouts/MainLayout';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowLeft, Edit, Plus } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { getKitchenModels, createKitchenModel, getPantryItems, getAllEquipment } from '@/api';
import type { KitchenModel, PantryItem, Equipment } from '@/types/types';
import ModelSelector from '@/components/kitchen/ModelSelector';
import KitchenCanvas from '@/components/kitchen/KitchenCanvas';
import ItemInventory from '@/components/kitchen/ItemInventory';
import KitchenTutorial from '@/components/kitchen/KitchenTutorial';
import { useTranslation } from 'react-i18next';
import { PageTutorial } from '@/components/tutorial/PageTutorial';
import { getKitchenPantryTutorialSteps } from '@/components/tutorial/tutorialSteps';

export default function KitchenPantry() {
  const { t } = useTranslation(['tutorial', 'kitchen', 'common']);
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [models, setModels] = useState<KitchenModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<KitchenModel | null>(null);
  const [ingredients, setIngredients] = useState<PantryItem[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSetupDialog, setShowSetupDialog] = useState(false);

  useEffect(() => {
    if (profile) {
      loadData();
    }
  }, [profile]);

  const loadData = async () => {
    if (!profile) return;
    
    try {
      setLoading(true);
      const [modelsData, ingredientsData, equipmentData] = await Promise.all([
        getKitchenModels(profile.id),
        getPantryItems(profile.id),
        getAllEquipment(),
      ]);
      
      setModels(modelsData);
      setIngredients(ingredientsData);
      setEquipment(equipmentData);
      
      if (modelsData.length > 0 && !selectedModel) {
        setSelectedModel(modelsData[0]);
      } else if (modelsData.length === 0) {
        setShowSetupDialog(true);
      }
    } catch (error: any) {
      toast.error(t('kitchen:loadError', { message: error.message }));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateModel = async () => {
    if (!profile) return;
    
    try {
      const newModel = await createKitchenModel(
        profile.id,
        {
          name: `Kitchen Layout ${models.length + 1}`,
          description: 'New kitchen layout',
        },
        profile.instance_id // Pass instance_id from profile
      );
      
      setModels([newModel, ...models]);
      setSelectedModel(newModel);
      setShowSetupDialog(false);
      toast.success(t('kitchen:createSuccess'));
      
      // Navigate to editor to set up the layout
      navigate('/kitchen-layout-editor');
    } catch (error: any) {
      toast.error(t('kitchen:createError', { message: error.message }));
    }
  };

  const handleModelChange = (model: KitchenModel) => {
    setSelectedModel(model);
  };

  const handleModelDeleted = (modelId: string) => {
    const updatedModels = models.filter(m => m.id !== modelId);
    setModels(updatedModels);
    
    if (selectedModel?.id === modelId) {
      setSelectedModel(updatedModels.length > 0 ? updatedModels[0] : null);
    }
    
    if (updatedModels.length === 0) {
      setShowSetupDialog(true);
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-screen">
          <p className="text-muted-foreground">{t('kitchen:loading')}</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <PageTutorial tutorialId="kitchen-pantry-page" steps={getKitchenPantryTutorialSteps(t)} />
      <div className="flex flex-col min-h-screen">
        {/* Header */}
        <div className="border-b bg-background shrink-0">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/pantry')}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  {t('kitchen:backToPantry')}
                </Button>
                <h1 className="text-2xl font-semibold">{t('kitchen:kitchenPantry')}</h1>
              </div>
              
              <div className="flex items-center gap-2">
                {models.length > 0 && (
                  <>
                    <ModelSelector
                      models={models}
                      selectedModel={selectedModel}
                      onModelChange={handleModelChange}
                      onModelDeleted={handleModelDeleted}
                      onModelsUpdate={setModels}
                      data-tutorial="quick-access"
                    />
                    <Button
                      variant="outline"
                      onClick={() => navigate('/kitchen-layout-editor')}
                      data-tutorial="add-location"
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      {t('kitchen:editLayout')}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        {selectedModel ? (
          <div className="flex-1 flex overflow-hidden">
            {/* Center Canvas Area */}
            <div className="flex-1 min-w-0 overflow-auto bg-background" data-tutorial="visual-view">
              <KitchenCanvas
                model={selectedModel}
                mode="pantry"
                ingredients={ingredients}
                equipment={equipment}
              />
            </div>

            {/* Right Panel - Item Inventory */}
            <div className="w-80 shrink-0 border-l bg-muted/30 overflow-y-auto" data-tutorial="drag-drop">
              <ItemInventory
                ingredients={ingredients}
                equipment={equipment}
              />
            </div>
          </div>
        ) : null}
      </div>

      {/* Setup Dialog */}
      <Dialog open={showSetupDialog} onOpenChange={setShowSetupDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('kitchen:kitchenPantryPage.setupDialogTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-muted-foreground">
              {t('kitchen:kitchenPantryPage.setupDialogDescription')}
            </p>
            <div className="flex gap-2">
              <Button onClick={handleCreateModel} className="flex-1">
                <Plus className="h-4 w-4 mr-2" />
                {t('kitchen:createLayout')}
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowSetupDialog(false)}
              >
                {t('common:cancel')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Tutorial */}
      <KitchenTutorial
        type="pantry"
        onComplete={() => {}}
      />
    </MainLayout>
  );
}
