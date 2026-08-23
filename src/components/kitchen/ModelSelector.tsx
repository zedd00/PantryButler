import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Edit, Trash2 } from 'lucide-react';
import { updateKitchenModel, deleteKitchenModel } from '@/api';
import type { KitchenModel } from '@/types/types';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

interface ModelSelectorProps {
  models: KitchenModel[];
  selectedModel: KitchenModel | null;
  onModelChange: (model: KitchenModel) => void;
  onModelDeleted: (modelId: string) => void;
  onModelsUpdate: (models: KitchenModel[]) => void;
}

export default function ModelSelector({
  models,
  selectedModel,
  onModelChange,
  onModelDeleted,
  onModelsUpdate,
}: ModelSelectorProps) {
  const { t } = useTranslation(['kitchen', 'common']);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingName, setEditingName] = useState('');
  const [editingDescription, setEditingDescription] = useState('');

  const handleEdit = () => {
    if (!selectedModel) return;
    setEditingName(selectedModel.name);
    setEditingDescription(selectedModel.description || '');
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedModel) return;

    try {
      const updated = await updateKitchenModel(selectedModel.id, {
        name: editingName,
        description: editingDescription,
      });

      const updatedModels = models.map(m =>
        m.id === updated.id ? updated : m
      );
      onModelsUpdate(updatedModels);
      onModelChange(updated);
      setEditDialogOpen(false);
      toast.success(t('kitchen:updateSuccess'));
    } catch (error: any) {
      toast.error(t('kitchen:updateError', { message: error.message }));
    }
  };

  const handleDelete = async () => {
    if (!selectedModel) return;

    try {
      await deleteKitchenModel(selectedModel.id);
      onModelDeleted(selectedModel.id);
      setDeleteDialogOpen(false);
      toast.success(t('kitchen:deleteSuccess'));
    } catch (error: any) {
      toast.error(t('kitchen:deleteError', { message: error.message }));
    }
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <Select
          value={selectedModel?.id || ''}
          onValueChange={(value) => {
            const model = models.find(m => m.id === value);
            if (model) onModelChange(model);
          }}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder={t('kitchen:selectLayout')} />
          </SelectTrigger>
          <SelectContent>
            {models.map(model => (
              <SelectItem key={model.id} value={model.id}>
                {model.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleEdit}
          disabled={!selectedModel}
        >
          <Edit className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setDeleteDialogOpen(true)}
          disabled={!selectedModel}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('kitchen:editLayout')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">{t('common:name')}</Label>
              <Input
                id="name"
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                placeholder={t('kitchen:modelSelector.layoutNamePlaceholder')}
              />
            </div>
            <div>
              <Label htmlFor="description">{t('common:description')}</Label>
              <Textarea
                id="description"
                value={editingDescription}
                onChange={(e) => setEditingDescription(e.target.value)}
                placeholder={t('kitchen:modelSelector.layoutDescriptionPlaceholder')}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              {t('common:cancel')}
            </Button>
            <Button onClick={handleSaveEdit}>{t('common:save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('kitchen:deleteConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('kitchen:deleteConfirmMessage', { name: selectedModel?.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common:cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>{t('common:delete')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
