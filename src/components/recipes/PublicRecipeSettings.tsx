import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
import { Copy, Code, Check, Globe } from 'lucide-react';
import { toggleRecipePublic } from '@/api';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

interface PublicRecipeSettingsProps {
  recipeId: string;
  isPublic: boolean;
  publicSlug: string | null;
  onUpdate: (isPublic: boolean, publicSlug: string | null) => void;
}

export default function PublicRecipeSettings({ recipeId, isPublic, publicSlug, onUpdate }: PublicRecipeSettingsProps) {
  const { t } = useTranslation('recipes');
  const [loading, setLoading] = useState(false);
  const [showEmbedDialog, setShowEmbedDialog] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingState, setPendingState] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [embedCopied, setEmbedCopied] = useState(false);

  const publicUrl = publicSlug 
    ? `${window.location.origin}/r/${publicSlug}`
    : '';

  const embedCode = publicSlug
    ? `<div id="pantrybutler-recipe-card" data-recipe-slug="${publicSlug}"></div>\n<script src="${window.location.origin}/embed.js"></script>`
    : '';

  const handleToggle = (checked: boolean) => {
    setPendingState(checked);
    setShowConfirmDialog(true);
  };

  const handleConfirm = async () => {
    setShowConfirmDialog(false);
    setLoading(true);

    try {
      const result = await toggleRecipePublic(recipeId, pendingState);
      onUpdate(pendingState, result.publicSlug);
      
      // No toast messages - status changes are reflected in the UI
    } catch (error: any) {
      console.error('Error toggling public status:', error);
      toast.error(error.message || 'Failed to update recipe');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setLinkCopied(true);
      toast.success(t('public.linkCopied'));
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (error) {
      toast.error(t('public.copyLinkFailed'));
    }
  };

  const handleCopyEmbed = async () => {
    try {
      await navigator.clipboard.writeText(embedCode);
      setEmbedCopied(true);
      toast.success(t('public.embedCopied'));
      setTimeout(() => setEmbedCopied(false), 2000);
    } catch (error) {
      toast.error(t('public.copyEmbedFailed'));
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            {t('public.toggleLabel')}
          </CardTitle>
          <CardDescription>
            {t('public.toggleDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="public-toggle" className="text-base">
              {t('public.toggleLabel')}
            </Label>
            <Switch
              id="public-toggle"
              checked={isPublic}
              onCheckedChange={handleToggle}
              disabled={loading}
            />
          </div>

          {isPublic && publicSlug && (
            <div className="space-y-4 pt-4 border-t">
              <div className="space-y-2">
                <Label>{t('public.publicUrl')}</Label>
                <div className="flex gap-2">
                  <Input
                    value={publicUrl}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleCopyLink}
                  >
                    {linkCopied ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={() => setShowEmbedDialog(true)}
                className="w-full"
              >
                <Code className="h-4 w-4 mr-2" />
                {t('public.getEmbed')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Embed Code Dialog */}
      <Dialog open={showEmbedDialog} onOpenChange={setShowEmbedDialog}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('public.embedCode')}</DialogTitle>
            <DialogDescription>
              {t('public.embedDescription')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Textarea
              value={embedCode}
              readOnly
              rows={4}
              className="font-mono text-sm"
            />
            <Button
              type="button"
              onClick={handleCopyEmbed}
              className="w-full"
            >
              {embedCopied ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  {t('public.embedCopied')}
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  {t('public.copyLink')}
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingState ? t('public.toggleLabel') : 'Make Recipe Private'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingState ? t('public.makePublicConfirm') : t('public.makePrivateConfirm')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('import.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
