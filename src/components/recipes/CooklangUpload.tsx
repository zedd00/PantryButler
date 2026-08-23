import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Upload, FileText, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { CooklangParser } from '@/lib/cooklang-parser';
import { detectTimerMinutes } from '@/lib/recipe-timers';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useTranslation } from 'react-i18next';

interface CooklangUploadProps {
  onRecipeParsed: (recipe: any) => void;
  buttonVariant?: 'default' | 'outline' | 'ghost';
  buttonSize?: 'default' | 'sm' | 'lg';
}

export default function CooklangUpload({ onRecipeParsed, buttonVariant = 'outline', buttonSize = 'default' }: CooklangUploadProps) {
  const { t } = useTranslation(['recipes', 'common']);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewRecipe, setPreviewRecipe] = useState<any>(null);
  const [pasteText, setPasteText] = useState('');
  const [excludedEquipment, setExcludedEquipment] = useState<Set<string>>(new Set());

  const toggleEquipment = (name: string) => {
    setExcludedEquipment(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file extension
    if (!file.name.endsWith('.cook')) {
      toast.error(t('cooklangUpload.uploadCookFile'));
      e.target.value = '';
      return;
    }

    try {
      setUploading(true);

      // Read file content
      const content = await file.text();

      // Parse Cooklang
      const parsed = CooklangParser.parse(content);

      // Convert to recipe format
      const recipe = convertCooklangToRecipe(parsed);

      // Show preview
      setPreviewRecipe(recipe);
      setExcludedEquipment(new Set());
      toast.success(t('cooklangUpload.parsedSuccess'));
    } catch (error: any) {
      console.error('Error parsing .cook file:', error);
      toast.error(t('cooklangUpload.failedToParse', { error: error.message }));
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handlePasteText = () => {
    if (!pasteText.trim()) {
      toast.error(t('cooklangUpload.pasteCookText'));
      return;
    }

    try {
      setUploading(true);

      // Parse Cooklang
      const parsed = CooklangParser.parse(pasteText);

      // Convert to recipe format
      const recipe = convertCooklangToRecipe(parsed);

      // Show preview
      setPreviewRecipe(recipe);
      setExcludedEquipment(new Set());
      toast.success(t('cooklangUpload.parsedSuccess'));
      setPasteText('');
    } catch (error: any) {
      console.error('Error parsing .cook text:', error);
      toast.error(t('cooklangUpload.failedToParse', { error: error.message }));
    } finally {
      setUploading(false);
    }
  };

  const convertCooklangToRecipe = (parsed: any) => {
    // Extract metadata
    const title = parsed.metadata.title || parsed.metadata.name || 'Untitled Recipe';
    const description = parsed.metadata.description || parsed.metadata.desc || '';
    const servings = parsed.metadata.servings ? parseInt(parsed.metadata.servings) : 4;
    const prepTime = parsed.metadata.prep_time || parsed.metadata['prep time'];
    const cookTime = parsed.metadata.cook_time || parsed.metadata['cook time'];
    const totalTime = parsed.metadata.total_time || parsed.metadata['total time'];
    const tags = parsed.metadata.tags ? parsed.metadata.tags.split(',').map((t: string) => t.trim()) : [];
    const source = parsed.metadata.source || '';
    const author = parsed.metadata.author || '';

    // Parse time strings to minutes
    const parseTimeString = (timeStr?: string): number => {
      if (!timeStr) return 0;
      
      // Match patterns like "30 minutes", "1 hour", "1h 30m"
      const hourMatch = timeStr.match(/(\d+)\s*(?:hour|hr|h)/i);
      const minMatch = timeStr.match(/(\d+)\s*(?:minute|min|m)/i);
      
      let minutes = 0;
      if (hourMatch) minutes += parseInt(hourMatch[1]) * 60;
      if (minMatch) minutes += parseInt(minMatch[1]);
      
      // If just a number, assume minutes
      if (!hourMatch && !minMatch) {
        const num = parseInt(timeStr);
        if (!isNaN(num)) minutes = num;
      }
      
      return minutes;
    };

    const prepTimeMinutes = parseTimeString(prepTime);
    const cookTimeMinutes = parseTimeString(cookTime);
    const totalTimeMinutes = parseTimeString(totalTime) || (prepTimeMinutes + cookTimeMinutes);

    // Convert ingredients
    const ingredients = parsed.ingredients.map((ing: any, index: number) => ({
      name: ing.name,
      quantity: ing.quantity || 0,
      unit: CooklangParser.normalizeUnit(ing.unit),
      preparation: ing.preparation || '',
      is_optional: false,
      order_index: index,
    }));

    // Convert cookware to equipment
    const equipment = parsed.cookware.map((cw: any) => cw.name);

    // Convert steps to sections (preserving parsed section structure)
    const convertStep = (step: any, index: number) => {
      // Calculate timer from step timers, falling back to the instruction text
      let timerMinutes = 0;
      if (step.timers && step.timers.length > 0) {
        timerMinutes = step.timers.reduce((total: number, timer: any) => {
          return total + CooklangParser.convertTimeToMinutes(timer.duration, timer.unit);
        }, 0);
      } else {
        timerMinutes = detectTimerMinutes(step.instruction || '');
      }

      return {
        instruction: step.instruction,
        image_url: '',
        timer_minutes: timerMinutes,
        order_index: index,
      };
    };

    const sections = (parsed.sections && parsed.sections.length > 0)
      ? parsed.sections.map((section: any, sectionIndex: number) => ({
          title: section.title || 'Instructions',
          order_index: sectionIndex,
          steps: section.steps.map(convertStep),
        }))
      : [{
          title: 'Instructions',
          order_index: 0,
          steps: parsed.steps.map(convertStep),
        }];

    // Build notes from metadata
    const notes: string[] = [];
    if (source) notes.push(`Source: ${source}`);
    if (author) notes.push(`Author: ${author}`);
    
    // Add any other metadata as notes
    for (const [key, value] of Object.entries(parsed.metadata)) {
      if (!['title', 'name', 'description', 'desc', 'servings', 'prep_time', 'prep time', 'cook_time', 'cook time', 'total_time', 'total time', 'tags', 'source', 'author'].includes(key)) {
        notes.push(`${key}: ${value}`);
      }
    }

    return {
      title,
      description,
      servings,
      prep_time_minutes: prepTimeMinutes,
      cook_time_minutes: cookTimeMinutes,
      wait_time_minutes: 0,
      total_time_minutes: totalTimeMinutes,
      ingredients,
      equipment,
      sections,
      tags,
      notes: notes.join('\n'),
      image_url: '',
    };
  };

  const handleImport = () => {
    if (previewRecipe) {
      onRecipeParsed({
        ...previewRecipe,
        equipment: previewRecipe.equipment.filter((name: string) => !excludedEquipment.has(name)),
      });
      setPreviewRecipe(null);
      setExcludedEquipment(new Set());
      setDialogOpen(false);
      toast.success(t('importSuccess'));
    }
  };

  const handleCancel = () => {
    setPreviewRecipe(null);
    setExcludedEquipment(new Set());
    setDialogOpen(false);
  };

  return (
    <>
      <Button
        variant={buttonVariant}
        size={buttonSize}
        onClick={() => setDialogOpen(true)}
      >
        <Upload className="h-4 w-4 mr-2" />
        {t('cooklangUpload.importCookFile')}
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('cooklangUpload.importCooklangTitle')}</DialogTitle>
            <DialogDescription>
              {t('cooklangUpload.importCookDescription')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {!previewRecipe ? (
              <>
                <div>
                  <Label htmlFor="cook-file">{t('cooklangUpload.selectCookFile')}</Label>
                  <input
                    id="cook-file"
                    type="file"
                    accept=".cook"
                    onChange={handleFileUpload}
                    disabled={uploading}
                    className="block w-full mt-2 text-sm text-muted-foreground
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-md file:border-0
                      file:text-sm file:font-medium
                      file:bg-primary file:text-primary-foreground
                      hover:file:bg-primary/90
                      file:cursor-pointer cursor-pointer"
                  />
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">{t('cooklangUpload.orPasteText')}</span>
                  </div>
                </div>

                <div>
                  <Label htmlFor="cook-text">{t('cooklangUpload.pasteCookTextLabel')}</Label>
                  <textarea
                    id="cook-text"
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    disabled={uploading}
                    placeholder={t('cooklangUpload.pastePlaceholder')}
                    className="w-full mt-2 min-h-[120px] p-3 text-sm rounded-md border border-input bg-background"
                  />
                  <Button
                    onClick={handlePasteText}
                    disabled={uploading || !pasteText.trim()}
                    className="mt-2"
                    size="sm"
                  >
                    {t('cooklangUpload.parseText')}
                  </Button>
                </div>

                <Alert>
                  <FileText className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-2">
                      <p className="font-medium">{t('cooklangUpload.cooklangFormat')}</p>
                      <ul className="text-sm space-y-1 ml-4 list-disc">
                        <li>{t('cooklangUpload.ingredientsColon')} <code className="bg-muted px-1 rounded">@flour{'{'}2%cups{'}'}</code></li>
                        <li>{t('cooklangUpload.cookwareColon')} <code className="bg-muted px-1 rounded">#pot</code></li>
                        <li>{t('cooklangUpload.timersColon')} <code className="bg-muted px-1 rounded">~{'{'}25%minutes{'}'}</code></li>
                        <li>{t('cooklangUpload.metadataColon')} <code className="bg-muted px-1 rounded">---&#10;title: Recipe Name&#10;---</code></li>
                      </ul>
                      <p className="text-sm mt-2">
                        {t('cooklangUpload.learnMoreAt')}{' '}
                        <a
                          href="https://cooklang.org"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          cooklang.org
                        </a>
                      </p>
                    </div>
                  </AlertDescription>
                </Alert>
              </>
            ) : (
              <div className="space-y-4">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {t('cooklangUpload.previewNote')}
                  </AlertDescription>
                </Alert>

                <div className="space-y-3 border rounded-lg p-4 bg-muted/50">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{t('cooklangUpload.title')}</p>
                    <p className="font-semibold">{previewRecipe.title}</p>
                  </div>

                  {previewRecipe.description && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{t('cooklangUpload.description')}</p>
                      <p className="text-sm">{previewRecipe.description}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{t('servings')}</p>
                      <p className="text-sm">{previewRecipe.servings}</p>
                    </div>
                    {previewRecipe.prep_time_minutes > 0 && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">{t('prepTime')}</p>
                        <p className="text-sm">{previewRecipe.prep_time_minutes} min</p>
                      </div>
                    )}
                    {previewRecipe.cook_time_minutes > 0 && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">{t('cookTime')}</p>
                        <p className="text-sm">{previewRecipe.cook_time_minutes} min</p>
                      </div>
                    )}
                  </div>

                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{t('shared.ingredientsCount', { count: previewRecipe.ingredients.length })}</p>
                    <ul className="text-sm space-y-1 mt-1">
                      {previewRecipe.ingredients.slice(0, 5).map((ing: any, i: number) => (
                        <li key={i}>
                          {ing.quantity > 0 ? `${ing.quantity} ${ing.unit} ` : ''}{ing.name}
                        </li>
                      ))}
                      {previewRecipe.ingredients.length > 5 && (
                        <li className="text-muted-foreground">{t('cooklangUpload.andMore', { count: previewRecipe.ingredients.length - 5 })}</li>
                      )}
                    </ul>
                  </div>

                  {previewRecipe.equipment.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{t('shared.equipmentCount', { count: previewRecipe.equipment.length })}</p>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {previewRecipe.equipment.map((name: string) => (
                          <label
                            key={name}
                            className="inline-flex items-center gap-1.5 text-sm cursor-pointer px-2 py-0.5 rounded border border-border hover:bg-muted/50"
                          >
                            <input
                              type="checkbox"
                              checked={!excludedEquipment.has(name)}
                              onChange={() => toggleEquipment(name)}
                              className="h-3.5 w-3.5"
                            />
                            {name}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{t('cooklangUpload.sectionsCount', { count: previewRecipe.sections.length })}</p>
                    {previewRecipe.sections.slice(0, 3).map((section: any, sIdx: number) => (
                      <div key={sIdx} className="mt-1">
                        <p className="text-sm font-semibold">{section.title} ({section.steps.length})</p>
                        <ul className="text-sm space-y-1">
                          {section.steps.slice(0, 3).map((step: any, i: number) => (
                            <li key={i} className="line-clamp-2">
                              {i + 1}. {step.instruction}
                            </li>
                          ))}
                          {section.steps.length > 3 && (
                            <li className="text-muted-foreground">{t('cooklangUpload.andMoreSteps', { count: section.steps.length - 3 })}</li>
                          )}
                        </ul>
                      </div>
                    ))}
                    {previewRecipe.sections.length > 3 && (
                      <li className="text-muted-foreground mt-1 list-none">
                        {t('cooklangUpload.andMoreSections', { count: previewRecipe.sections.length - 3 })}
                      </li>
                    )}
                  </div>

                  {previewRecipe.tags.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{t('tags')}</p>
                      <p className="text-sm">{previewRecipe.tags.join(', ')}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={uploading}
            >
              {t('common:cancel')}
            </Button>
            {previewRecipe && (
              <Button onClick={handleImport}>
                {t('importRecipe')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
