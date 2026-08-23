import { useEffect, useState, useCallback } from 'react';
import MainLayout from '@/components/layouts/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { getSettings, updateSettings, getCurrentUserRole, getSetupFiles, getSetupFileContent, getNutritionCount, importNutritionBatch, exportNutritionFoods, isSuperAdmin, type SetupFile } from '@/api';
import type { Settings, UnitSystem } from '@/types/types';
import { useTutorial } from '@/contexts/TutorialContext';
import { toast } from 'sonner';
import { useTheme } from 'next-themes';
import { useTranslation } from 'react-i18next';
import { Download, Loader2, RotateCcw, Upload, FileJson, Server, Database, Info, CheckCircle2, AlertTriangle } from 'lucide-react';
import { exportAllRecipesToZip } from '@/lib/bulk-export';
import { PageTutorial } from '@/components/tutorial/PageTutorial';
import { getSettingsTutorialSteps } from '@/components/tutorial/tutorialSteps';
import { useDropzone } from 'react-dropzone';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ApiTokensCard } from '@/components/settings/ApiTokensCard';

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { t, i18n } = useTranslation(['settings', 'common', 'tutorial']);
  const { resetAllTutorials, completedTutorials } = useTutorial();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [preferredUnit, setPreferredUnit] = useState<UnitSystem>('metric');
  const [darkMode, setDarkMode] = useState(false);
  const [vibrantMode, setVibrantMode] = useState(false);
  const [nutritionEnabled, setNutritionEnabled] = useState(false);
  const [currency, setCurrency] = useState('USD');
  const [costTrackingEnabled, setCostTrackingEnabled] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isServerAdmin, setIsServerAdmin] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState({ current: 0, total: 0 });
  const [serverFiles, setServerFiles] = useState<SetupFile[]>([]);
  const [nutritionCount, setNutritionCount] = useState<number | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<{ fileName: string; fileSize: number; data: any[]; count: number }[]>([]);
  const [importing, setImporting] = useState<string | null>(null);
  const [importResults, setImportResults] = useState<{ fileName: string; imported: number; error?: string }[]>([]);
  const [exportingNutrition, setExportingNutrition] = useState(false);

  useEffect(() => {
    loadSettings();
    checkAdminRole();
  }, []);

  useEffect(() => {
    if (isServerAdmin) {
      getSetupFiles().then(setServerFiles).catch(() => {});
      getNutritionCount().then(setNutritionCount).catch(() => {});
    }
  }, [isServerAdmin]);

  const checkAdminRole = async () => {
    try {
      const role = await getCurrentUserRole();
      setIsAdmin(role === 'admin');
    } catch (error) {
      console.error('Failed to check admin role:', error);
    }
    try {
      setIsServerAdmin(await isSuperAdmin());
    } catch (error) {
      console.error('Failed to check superadmin role:', error);
    }
  };

  const onImportDrop = useCallback((acceptedFiles: File[]) => {
    for (const file of acceptedFiles) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          const parsed = JSON.parse(text);
          const data = Array.isArray(parsed) ? parsed : [parsed];
          setUploadedFiles(prev => [...prev, {
            fileName: file.name,
            fileSize: file.size,
            data,
            count: data.length,
          }]);
        } catch {
          toast.error(t('settings:imports.parseError', { file: file.name }));
        }
      };
      reader.readAsText(file);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: onImportDrop,
    accept: { 'application/json': ['.json'] },
    multiple: true,
  });

  const runImport = async (fileName: string, data: any[]) => {
    setImporting(fileName);
    try {
      const batchSize = 500;
      let total = 0;
      for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize);
        const result = await importNutritionBatch(batch);
        total += result.imported;
        if (i + batchSize < data.length) {
          toast.loading(t('settings:imports.progress', { total, count: data.length }), { id: 'import-progress' });
        } else {
          toast.dismiss('import-progress');
        }
      }
      setImportResults(prev => [...prev, { fileName, imported: total }]);
      const count = await getNutritionCount();
      setNutritionCount(count);
      toast.success(t('settings:imports.success', { total, fileName }));
    } catch (error: any) {
      setImportResults(prev => [...prev, { fileName, imported: 0, error: error.message }]);
      toast.error(t('settings:imports.failed', { error: error.message }));
    } finally {
      setImporting(null);
    }
  };

  const importServerFile = async (file: SetupFile) => {
    try {
      const { data } = await getSetupFileContent(file.name);
      await runImport(file.name, data);
      setServerFiles(prev => prev.filter(f => f.name !== file.name));
    } catch (error: any) {
      toast.error(t('settings:imports.loadFailed', { file: file.name, error: error.message }));
    }
  };

  const handleExportNutrition = async () => {
    setExportingNutrition(true);
    try {
      const data = await exportNutritionFoods();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nutrition_export_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(t('settings:imports.exportSuccess', { count: data.length.toLocaleString() }));
    } catch (error: any) {
      toast.error(t('settings:imports.exportFailed', { error: error.message }));
    } finally {
      setExportingNutrition(false);
    }
  };

  useEffect(() => {
    setDarkMode(theme === 'dark');
  }, [theme]);

  // Apply vibrant mode on load
  useEffect(() => {
    if (settings?.vibrant_mode) {
      document.documentElement.classList.add('vibrant-mode');
    } else {
      document.documentElement.classList.remove('vibrant-mode');
    }
  }, [settings]);

  const loadSettings = async () => {
    try {
      const data = await getSettings();
      if (data) {
        setSettings(data);
        setPreferredUnit(data.preferred_unit_system);
        setDarkMode(data.dark_mode);
        setVibrantMode(data.vibrant_mode || false);
        setNutritionEnabled(data.nutrition_enabled || false);
        setCurrency(data.currency || 'USD');
        setCostTrackingEnabled(data.cost_tracking_enabled ?? true);
      }
    } catch (error: any) {
      toast.error(t('settings:settingsPage.settingsLoadFailed', { error: error.message }));
    }
  };

  const handleSave = async () => {
    if (!isAdmin) {
      toast.error(t('settings:settingsPage.onlyAdminsModify'));
      return;
    }

    try {
      await updateSettings({ 
        preferred_unit_system: preferredUnit, 
        dark_mode: darkMode, 
        vibrant_mode: vibrantMode,
        nutrition_enabled: nutritionEnabled,
        currency,
        cost_tracking_enabled: costTrackingEnabled
      });
      toast.success(t('settings:settingsPage.settingsSaved'));
      loadSettings();
      
      // Apply vibrant mode class to document
      if (vibrantMode) {
        document.documentElement.classList.add('vibrant-mode');
      } else {
        document.documentElement.classList.remove('vibrant-mode');
      }
    } catch (error: any) {
      toast.error(t('settings:settingsPage.settingsSaveFailed', { error: error.message }));
    }
  };

  const handleDarkModeToggle = async (checked: boolean) => {
    setDarkMode(checked);
    setTheme(checked ? 'dark' : 'light');
    
    // Auto-save dark mode setting
    try {
      await updateSettings({ 
        preferred_unit_system: preferredUnit, 
        dark_mode: checked, 
        vibrant_mode: vibrantMode,
        nutrition_enabled: nutritionEnabled,
        currency,
        cost_tracking_enabled: costTrackingEnabled
      });
      toast.success(t('settings:settingsPage.darkModeUpdated'));
    } catch (error: any) {
      toast.error(t('settings:settingsPage.darkModeSaveFailed', { error: error.message }));
      // Revert on error
      setDarkMode(!checked);
      setTheme(!checked ? 'dark' : 'light');
    }
  };

  const handleVibrantModeToggle = async (checked: boolean) => {
    if (!isAdmin) {
      toast.error(t('settings:settingsPage.onlyAdminsVibrant'));
      return;
    }
    
    setVibrantMode(checked);
    
    // Apply vibrant mode class immediately
    if (checked) {
      document.documentElement.classList.add('vibrant-mode');
    } else {
      document.documentElement.classList.remove('vibrant-mode');
    }
    
    // Auto-save vibrant mode setting
    try {
      await updateSettings({ 
        preferred_unit_system: preferredUnit, 
        dark_mode: darkMode, 
        vibrant_mode: checked,
        nutrition_enabled: nutritionEnabled,
        currency,
        cost_tracking_enabled: costTrackingEnabled
      });
      toast.success(t('settings:settingsPage.vibrantModeUpdated'));
    } catch (error: any) {
      toast.error(t('settings:settingsPage.vibrantModeSaveFailed', { error: error.message }));
      // Revert on error
      setVibrantMode(!checked);
      if (!checked) {
        document.documentElement.classList.add('vibrant-mode');
      } else {
        document.documentElement.classList.remove('vibrant-mode');
      }
    }
  };

  const handleNutritionToggle = async (checked: boolean) => {
    if (!isAdmin) {
      toast.error(t('settings:settingsPage.onlyAdminsNutrition'));
      return;
    }
    
    setNutritionEnabled(checked);
    
    // Auto-save nutrition setting
    try {
      await updateSettings({ 
        preferred_unit_system: preferredUnit, 
        dark_mode: darkMode, 
        vibrant_mode: vibrantMode,
        nutrition_enabled: checked,
        currency,
        cost_tracking_enabled: costTrackingEnabled
      });
      toast.success(t('settings:settingsPage.nutritionUpdated'));
    } catch (error: any) {
      toast.error(t('settings:settingsPage.nutritionSaveFailed', { error: error.message }));
      // Revert on error
      setNutritionEnabled(!checked);
    }
  };

  const handleCostTrackingToggle = async (checked: boolean) => {
    if (!isAdmin) {
      toast.error(t('settings:settingsPage.onlyAdminsCost'));
      return;
    }
    
    setCostTrackingEnabled(checked);
    
    // Auto-save cost tracking setting
    try {
      await updateSettings({ 
        preferred_unit_system: preferredUnit, 
        dark_mode: darkMode, 
        vibrant_mode: vibrantMode,
        nutrition_enabled: nutritionEnabled,
        currency,
        cost_tracking_enabled: checked
      });
      toast.success(t('settings:settingsPage.costTrackingUpdated'));
    } catch (error: any) {
      toast.error(t('settings:settingsPage.costTrackingSaveFailed', { error: error.message }));
      // Revert on error
      setCostTrackingEnabled(!checked);
    }
  };

  const handleCurrencyChange = async (newCurrency: string) => {
    if (!isAdmin) {
      toast.error(t('settings:settingsPage.onlyAdminsCurrency'));
      return;
    }

    const previous = currency;
    setCurrency(newCurrency);

    // Auto-save currency so cost displays update everywhere immediately
    try {
      await updateSettings({
        preferred_unit_system: preferredUnit,
        dark_mode: darkMode,
        vibrant_mode: vibrantMode,
        nutrition_enabled: nutritionEnabled,
        currency: newCurrency,
        cost_tracking_enabled: costTrackingEnabled
      });
      toast.success(t('settings:settingsPage.currencyUpdated'));
    } catch (error: any) {
      toast.error(t('settings:settingsPage.currencySaveFailed', { error: error.message }));
      // Revert on error
      setCurrency(previous);
    }
  };

  const handleExportAllRecipes = async () => {
    setIsExporting(true);
    setExportProgress({ current: 0, total: 0 });

    try {
      await exportAllRecipesToZip((current, total) => {
        setExportProgress({ current, total });
      });
      
      toast.success(t('settings:settingsPage.recipesExported'));
    } catch (error: any) {
      console.error('Export error:', error);
      toast.error(error.message || t('settings:settingsPage.recipesExportFailed'));
    } finally {
      setIsExporting(false);
      setExportProgress({ current: 0, total: 0 });
    }
  };

  return (
    <MainLayout>
      <PageTutorial tutorialId="settings-page" steps={getSettingsTutorialSteps(t)} />
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-semibold">{t('settings:title')}</h1>
          <p className="text-muted-foreground mt-1">{t('settings:accountSettings')}</p>
        </div>

        <Card data-tutorial="unit-system">
          <CardHeader>
            <CardTitle>{t('settings:unitSettings')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="unit-system">{t('settings:preferredUnitSystem')}</Label>
              <Select
                value={preferredUnit}
                onValueChange={(v) => setPreferredUnit(v as UnitSystem)}
                disabled={!isAdmin}
              >
                <SelectTrigger id="unit-system">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="metric">{t('settings:metricSystem')}</SelectItem>
                  <SelectItem value="metric_weights">{t('settings:settingsPage.metricWeights')}</SelectItem>
                  <SelectItem value="imperial">{t('settings:imperialSystem')}</SelectItem>
                  <SelectItem value="imperial_volume">{t('settings:settingsPage.imperialVolume')}</SelectItem>
                  <SelectItem value="ratio">{t('settings:settingsPage.ratio')}</SelectItem>
                  <SelectItem value="bakers_percentage">{t('settings:settingsPage.bakersPercentage')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">{t('settings:currency')}</Label>
              <Select
                value={currency}
                onValueChange={handleCurrencyChange}
                disabled={!isAdmin}
              >
                <SelectTrigger id="currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">{t('settings:currencies.USD')}</SelectItem>
                  <SelectItem value="EUR">{t('settings:currencies.EUR')}</SelectItem>
                  <SelectItem value="GBP">{t('settings:currencies.GBP')}</SelectItem>
                  <SelectItem value="CAD">{t('settings:currencies.CAD')}</SelectItem>
                  <SelectItem value="AUD">{t('settings:currencies.AUD')}</SelectItem>
                  <SelectItem value="JPY">{t('settings:currencies.JPY')}</SelectItem>
                  <SelectItem value="INR">{t('settings:currencies.INR')}</SelectItem>
                  <SelectItem value="CNY">{t('settings:currencies.CNY')}</SelectItem>
                  <SelectItem value="CHF">{t('settings:currencies.CHF')}</SelectItem>
                  <SelectItem value="SEK">{t('settings:currencies.SEK')}</SelectItem>
                  <SelectItem value="NZD">{t('settings:currencies.NZD')}</SelectItem>
                  <SelectItem value="ZAR">{t('settings:currencies.ZAR')}</SelectItem>
                  <SelectItem value="ALL">{t('settings:currencies.ALL')}</SelectItem>
                  <SelectItem value="MXN">{t('settings:currencies.MXN')}</SelectItem>
                  <SelectItem value="TWD">{t('settings:currencies.TWD')}</SelectItem>
                  <SelectItem value="HKD">{t('settings:currencies.HKD')}</SelectItem>
                  <SelectItem value="SGD">{t('settings:currencies.SGD')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {!isAdmin && (
              <p className="text-xs text-muted-foreground">{t('settings:settingsPage.onlyAdminsSetting')}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('settings:display')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div 
              className="flex items-center justify-between gap-4 py-2 cursor-pointer"
              onClick={() => handleDarkModeToggle(!darkMode)}
              data-tutorial="theme"
            >
              <div className="space-y-0.5 flex-1">
                <Label htmlFor="dark-mode" className="text-base cursor-pointer">{t('settings:darkMode')}</Label>
                <p className="text-sm text-muted-foreground">{t('settings:settingsPage.darkModeToggleDescription')}</p>
              </div>
              <Switch
                id="dark-mode"
                checked={darkMode}
                onCheckedChange={handleDarkModeToggle}
                className="shrink-0"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
            
            <div 
              className={`flex items-center justify-between gap-4 py-2 ${!isAdmin ? 'opacity-50' : 'cursor-pointer'}`}
              onClick={() => isAdmin && handleVibrantModeToggle(!vibrantMode)}
            >
              <div className="space-y-0.5 flex-1">
                <Label htmlFor="vibrant-mode" className="text-base cursor-pointer">{t('settings:vibrantMode')}</Label>
                <p className="text-sm text-muted-foreground">{t('settings:vibrantModeDescription')}</p>
              </div>
              <Switch
                id="vibrant-mode"
                checked={vibrantMode}
                onCheckedChange={handleVibrantModeToggle}
                disabled={!isAdmin}
                className="shrink-0"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
            
            <div 
              className={`flex items-center justify-between gap-4 py-2 ${!isAdmin ? 'opacity-50' : 'cursor-pointer'}`}
              onClick={() => isAdmin && handleNutritionToggle(!nutritionEnabled)}
              data-tutorial="nutrition"
            >
              <div className="space-y-0.5 flex-1">
                <Label htmlFor="nutrition-enabled" className="text-base cursor-pointer">{t('settings:nutritionInformation')}</Label>
                <p className="text-sm text-muted-foreground">{t('settings:nutritionDescription')}</p>
              </div>
              <Switch
                id="nutrition-enabled"
                checked={nutritionEnabled}
                onCheckedChange={handleNutritionToggle}
                disabled={!isAdmin}
                className="shrink-0"
                onClick={(e) => e.stopPropagation()}
              />
            </div>

            <div 
              className={`flex items-center justify-between gap-4 py-2 ${!isAdmin ? 'opacity-50' : 'cursor-pointer'}`}
              onClick={() => isAdmin && handleCostTrackingToggle(!costTrackingEnabled)}
              data-tutorial="cost-tracking"
            >
              <div className="space-y-0.5 flex-1">
                <Label htmlFor="cost-tracking-enabled" className="text-base cursor-pointer">{t('settings:costTracking')}</Label>
                <p className="text-sm text-muted-foreground">{t('settings:costTrackingDescription')}</p>
              </div>
              <Switch
                id="cost-tracking-enabled"
                checked={costTrackingEnabled}
                onCheckedChange={handleCostTrackingToggle}
                disabled={!isAdmin}
                className="shrink-0"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
            {!isAdmin && (
              <p className="text-xs text-muted-foreground">{t('settings:settingsPage.onlyAdminsSettings')}</p>
            )}
          </CardContent>
        </Card>

        <Card data-tutorial="language">
          <CardHeader>
            <CardTitle>{t('settings:language')}</CardTitle>
            <CardDescription>{t('settings:selectLanguage')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="language">{t('settings:currentLanguage')}</Label>
              <Select
                value={i18n.language}
                onValueChange={(lang) => {
                  i18n.changeLanguage(lang);
                  toast.success(t('settings:languageChanged'));
                }}
              >
                <SelectTrigger id="language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">{t('settings:languages.en')}</SelectItem>
                  <SelectItem value="sq">{t('settings:languages.sq')}</SelectItem>
                  <SelectItem value="it">{t('settings:languages.it')}</SelectItem>
                  <SelectItem value="es">{t('settings:languages.es')}</SelectItem>
                  <SelectItem value="fr">{t('settings:languages.fr')}</SelectItem>
                  <SelectItem value="zh">{t('settings:languages.zh')}</SelectItem>
                  <SelectItem value="hi">{t('settings:languages.hi')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card data-tutorial="export-data">
          <CardHeader>
            <CardTitle>{t('settings:exportRecipesTitle')}</CardTitle>
            <CardDescription>{t('settings:exportRecipesDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {t('settings:exportRecipesInfo')}
              </p>
              <Button 
                onClick={handleExportAllRecipes}
                disabled={isExporting}
                className="w-full md:w-auto"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {exportProgress.total > 0 
                      ? t('settings:exportingProgress', { current: exportProgress.current, total: exportProgress.total })
                      : t('settings:exporting')
                    }
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    {t('settings:exportAllRecipes')}
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('settings:tutorials.title')}</CardTitle>
            <CardDescription>
              {t('settings:tutorials.description')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                <p className="mb-2">
                  {t('settings:tutorials.completed', { count: completedTutorials.size })}
                </p>
                {completedTutorials.size > 0 && (
                  <p className="text-xs">
                    {Array.from(completedTutorials).join(', ')}
                  </p>
                )}
              </div>
              <Button 
                onClick={async () => {
                  await resetAllTutorials();
                  toast.success(t('settings:tutorials.resetSuccess'));
                  window.location.reload();
                }}
                variant="outline"
                className="w-full md:w-auto"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                {t('settings:tutorials.resetAll')}
              </Button>
            </div>
          </CardContent>
        </Card>

        <ApiTokensCard />

        {isServerAdmin && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                {t('settings:imports.title')}
              </CardTitle>
              <CardDescription>{t('settings:imports.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {nutritionCount !== null && (
                <div className={`flex items-center gap-2 rounded-lg border px-4 py-3 ${
                  nutritionCount > 0 ? 'border-green-200' : 'border-amber-200'
                }`}>
                  {nutritionCount > 0 ? (
                    <><CheckCircle2 className="h-5 w-5 text-green-600" /><span className="text-sm font-medium">{t('settings:imports.recordsInDatabase', { count: nutritionCount.toLocaleString() })}</span></>
                  ) : (
                    <><Info className="h-5 w-5 text-amber-600" /><span className="text-sm font-medium">{t('settings:imports.noData')}</span></>
                  )}
                </div>
              )}

              {serverFiles.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium flex items-center gap-2"><Server className="h-4 w-4" />{t('settings:imports.availableOnServer')}</p>
                  {serverFiles.map((file) => (
                    <div key={file.name} className="flex items-center justify-between rounded-lg border p-3">
                      <div className="flex items-center gap-3">
                        <FileJson className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">{file.name}</p>
                          <p className="text-xs text-muted-foreground">{(file.sizeBytes / 1024 / 1024).toFixed(1)} MB</p>
                        </div>
                      </div>
                      <Button size="sm" onClick={() => importServerFile(file)} disabled={importing !== null}>
                        {importing === file.name ? <Loader2 className="h-4 w-4 animate-spin" /> : t('common:import')}
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                  isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-muted-foreground/50'
                }`}
              >
                <input {...getInputProps()} />
                <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm font-medium">{t('settings:imports.uploadJsonFile')}</p>
                <p className="text-xs text-muted-foreground mt-1">{t('settings:imports.dropFile')}</p>
              </div>

              {uploadedFiles.length > 0 && (
                <div className="space-y-2">
                  {uploadedFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <p className="text-sm font-medium">{file.fileName}</p>
                        <p className="text-xs text-muted-foreground">{(file.fileSize / 1024 / 1024).toFixed(1)} MB &middot; {t('settings:imports.records', { count: file.count.toLocaleString() })}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setUploadedFiles(prev => prev.filter((_, i) => i !== index))} disabled={importing !== null}>{t('common:remove')}</Button>
                        <Button size="sm" onClick={async () => { await runImport(file.fileName, file.data); setUploadedFiles(prev => prev.filter((_, i) => i !== index)); }} disabled={importing !== null}>
                          {importing === file.fileName ? <Loader2 className="h-4 w-4 animate-spin" /> : t('common:import')}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {importResults.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('settings:imports.file')}</TableHead>
                      <TableHead>{t('settings:imports.imported')}</TableHead>
                      <TableHead>{t('common:status')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importResults.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{r.fileName}</TableCell>
                        <TableCell>{r.imported.toLocaleString()}</TableCell>
                        <TableCell>
                          {r.error ? (
                            <span className="flex items-center gap-1 text-destructive text-sm">
                              <AlertTriangle className="h-4 w-4" /> {r.error}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-green-600 text-sm">
                              <CheckCircle2 className="h-4 w-4" /> {t('common:success')}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              <div className="border-t pt-4">
                <p className="text-sm text-muted-foreground mb-2">{t('settings:imports.exportDescription')}</p>
                <Button
                  onClick={handleExportNutrition}
                  disabled={exportingNutrition}
                  variant="outline"
                  className="w-full md:w-auto"
                >
                  {exportingNutrition ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  {t('settings:imports.exportButton')}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {isAdmin && (
          <div className="flex justify-end">
            <Button onClick={handleSave}>{t('settings:settingsPage.saveSettings')}</Button>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
