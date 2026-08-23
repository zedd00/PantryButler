import { useEffect, useState } from 'react';
import MainLayout from '@/components/layouts/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Plus } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { getKitchenModels, createKitchenModel } from '@/api';
import type { KitchenModel } from '@/types/types';
import ModelSelector from '@/components/kitchen/ModelSelector';
import KitchenCanvas from '@/components/kitchen/KitchenCanvas';
import ElementPalette from '@/components/kitchen/ElementPalette';
import KitchenTutorial from '@/components/kitchen/KitchenTutorial';
import { useTranslation } from 'react-i18next';

export default function KitchenLayoutEditor() {
  const { t } = useTranslation(['kitchen', 'common']);
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [models, setModels] = useState<KitchenModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<KitchenModel | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile) {
      loadData();
    }
  }, [profile]);

  const loadData = async () => {
    if (!profile) return;
    
    try {
      setLoading(true);
      const modelsData = await getKitchenModels(profile.id);
      
      setModels(modelsData);
      
      if (modelsData.length > 0 && !selectedModel) {
        setSelectedModel(modelsData[0]);
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
      toast.success(t('kitchen:createSuccess'));
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
      <div className="flex flex-col min-h-screen">
        {/* Header */}
        <div className="border-b bg-background shrink-0">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/pantry/layout')}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  {t('kitchen:backToPantry')}
                </Button>
                <h1 className="text-2xl font-semibold">{t('kitchen:title')}</h1>
              </div>
              
              <div className="flex items-center gap-2">
                {models.length > 0 && (
                  <ModelSelector
                    models={models}
                    selectedModel={selectedModel}
                    onModelChange={handleModelChange}
                    onModelDeleted={handleModelDeleted}
                    onModelsUpdate={setModels}
                  />
                )}
                <Button onClick={handleCreateModel}>
                  <Plus className="h-4 w-4 mr-2" />
                  {t('kitchen:newLayout')}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        {models.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <Card className="max-w-md w-full">
              <CardHeader>
                <CardTitle>{t('kitchen:kitchenLayoutEditor.createYourLayout')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  {t('kitchen:kitchenLayoutEditor.designDescription')}
                </p>
                <Button onClick={handleCreateModel} className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  {t('kitchen:kitchenLayoutEditor.createFirstLayoutButton')}
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : selectedModel ? (
          <div className="flex-1 flex overflow-hidden">
            {/* Left Panel - Element Palette */}
            <div className="w-64 shrink-0 border-r bg-muted/30 overflow-y-auto">
              <ElementPalette />
            </div>

            {/* Center Canvas Area */}
            <div className="flex-1 min-w-0 overflow-auto bg-background">
              <KitchenCanvas
                model={selectedModel}
                mode="edit"
              />
            </div>
          </div>
        ) : null}
      </div>

      {/* Tutorial */}
      <KitchenTutorial
        type="layout-editor"
        onComplete={() => {}}
      />
    </MainLayout>
  );
}
