import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, XCircle, Loader2, AlertCircle } from 'lucide-react';
import { api, setToken } from '@/lib/api-client';
import { useTranslation } from 'react-i18next';

interface SetupStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'running' | 'success' | 'error';
  message?: string;
}

export default function Setup() {
  const { t } = useTranslation(['admin', 'common']);
  const [config, setConfig] = useState({
    adminEmail: '',
    adminPassword: '',
    adminPasswordConfirm: '',
  });

  const [steps, setSteps] = useState<SetupStep[]>([
    {
      id: 'test-connection',
      title: t('admin:setup.steps.testConnection.title'),
      description: t('admin:setup.steps.testConnection.description'),
      status: 'pending',
    },
    {
      id: 'seed-nutrition',
      title: t('admin:setup.steps.seedNutrition.title'),
      description: t('admin:setup.steps.seedNutrition.description'),
      status: 'pending',
    },
    {
      id: 'create-admin',
      title: t('admin:setup.steps.createAdmin.title'),
      description: t('admin:setup.steps.createAdmin.description'),
      status: 'pending',
    },
    {
      id: 'validate',
      title: t('admin:setup.steps.validate.title'),
      description: t('admin:setup.steps.validate.description'),
      status: 'pending',
    },
  ]);

  const [isRunning, setIsRunning] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [setupComplete, setSetupComplete] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const updateStepStatus = (
    stepId: string,
    status: 'pending' | 'running' | 'success' | 'error',
    message?: string
  ) => {
    setSteps((prev) =>
      prev.map((step) =>
        step.id === stepId ? { ...step, status, message } : step
      )
    );
  };

  const validateForm = (): string[] => {
    const errors: string[] = [];

    if (!config.adminEmail) errors.push(t('admin:setup.errors.adminEmailRequired'));
    if (!config.adminPassword) errors.push(t('admin:setup.errors.adminPasswordRequired'));
    if (config.adminPassword !== config.adminPasswordConfirm) {
      errors.push(t('admin:setup.errors.passwordsMismatch'));
    }
    if (config.adminPassword && config.adminPassword.length < 8) {
      errors.push(t('admin:setup.errors.passwordMinLength'));
    }

    return errors;
  };

  const runSetup = async () => {
    const validationErrors = validateForm();
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors([]);
    setIsRunning(true);
    setCurrentStep(0);

    try {
      // Step 1: Test Connection
      setCurrentStep(1);
      updateStepStatus('test-connection', 'running');

      const healthResult = await api.get<any>('/api/health');

      if (!healthResult || healthResult.status !== 'ok') {
        throw new Error(t('admin:setup.errors.dbTestFailed'));
      }

      updateStepStatus('test-connection', 'success', t('admin:setup.status.dbConnected'));

      // Step 2: Seed Nutrition Data
      setCurrentStep(2);
      updateStepStatus('seed-nutrition', 'running');

      const nutritionData = await fetch('/setup/nutrition_foods.json').then((r) => r.json());

      const seedResult = await api.post<any>('/api/admin/seed-nutrition', { nutritionData });

      updateStepStatus(
        'seed-nutrition',
        'success',
        t('admin:setup.status.seeded', { count: seedResult.insertedCount })
      );

      // Step 3: Create Admin User
      setCurrentStep(3);
      updateStepStatus('create-admin', 'running');

      await api.post('/api/setup/create-admin', {
        email: config.adminEmail,
        password: config.adminPassword,
      });

      updateStepStatus('create-admin', 'success', t('admin:setup.status.superadminCreated', { email: config.adminEmail }));

      // Step 4: Validate Setup
      setCurrentStep(4);
      updateStepStatus('validate', 'running');

      // The /api/admin/validate endpoint is auth-gated once any user exists (the
      // superadmin was just created above), so sign in with the new admin to
      // pass the check and confirm the credentials work end-to-end.
      const loginResult = await api.post<{ token: string }>('/api/auth/login', {
        email: config.adminEmail,
        password: config.adminPassword,
      });
      setToken(loginResult.token);

      const validateResult = await api.get<any>('/api/admin/validate');

      const validationMessage = t('admin:setup.status.validation', {
        foods: validateResult.nutritionCount,
        users: validateResult.userCount,
        instances: validateResult.instanceCount,
      });

      updateStepStatus('validate', 'success', validationMessage);

      setSetupComplete(true);
      setCurrentStep(5);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t('admin:setup.errors.unknown');
      setErrors([errorMessage]);

      const currentStepId = steps[currentStep - 1]?.id;
      if (currentStepId) {
        updateStepStatus(currentStepId, 'error', errorMessage);
      }
    } finally {
      setIsRunning(false);
    }
  };

  const getStepIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Loader2 className="h-5 w-5 animate-spin text-primary" />;
      case 'success':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-destructive" />;
      default:
        return <div className="h-5 w-5 rounded-full border-2 border-muted" />;
    }
  };

  const progress = (currentStep / (steps.length + 1)) * 100;

  if (setupComplete) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-10 w-10 text-green-600" />
            </div>
            <CardTitle className="text-2xl">{t('admin:setup.complete.title')}</CardTitle>
            <CardDescription>
              {t('admin:setup.complete.description')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>{t('admin:setup.complete.importantLabel')}</strong>{' '}
                {t('admin:setup.complete.securityWarning')}
              </AlertDescription>
            </Alert>

            <div className="space-y-2 rounded-lg border p-4">
              <h3 className="font-semibold">{t('admin:setup.complete.adminCredentials')}</h3>
              <p className="text-sm text-muted-foreground">
                {t('admin:setup.complete.emailLabel')} <span className="font-mono">{config.adminEmail}</span>
              </p>
              <p className="text-sm text-muted-foreground">
                {t('admin:setup.complete.passwordLabel')} <span className="font-mono">••••••••</span>
              </p>
            </div>

            <div className="space-y-2 rounded-lg border p-4">
              <h3 className="font-semibold">{t('admin:setup.complete.nextSteps')}</h3>
              <ol className="list-inside list-decimal space-y-1 text-sm text-muted-foreground">
                {(t('admin:setup.complete.nextStepsItems', { returnObjects: true }) as string[]).map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ol>
            </div>

            <Button className="w-full" onClick={() => (window.location.href = '/login')}>
              {t('admin:setup.complete.goToLogin')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-4xl">
        <CardHeader>
          <CardTitle className="text-2xl">{t('admin:setup.headings.title')}</CardTitle>
          <CardDescription>
            {t('admin:setup.text.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {errors.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <ul className="list-inside list-disc">
                  {errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {!isRunning && (
            <div className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">{t('admin:setup.headings.adminAccount')}</h3>

                <div className="space-y-2">
                  <Label htmlFor="adminEmail">{t('admin:setup.labels.adminEmail')}</Label>
                  <Input
                    id="adminEmail"
                    type="email"
                    placeholder={t('admin:setup.placeholders.adminEmail')}
                    value={config.adminEmail}
                    onChange={(e) => setConfig({ ...config, adminEmail: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="adminPassword">{t('admin:setup.labels.adminPassword')}</Label>
                  <Input
                    id="adminPassword"
                    type="password"
                    placeholder="••••••••"
                    value={config.adminPassword}
                    onChange={(e) => setConfig({ ...config, adminPassword: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">{t('admin:setup.labels.minCharacters')}</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="adminPasswordConfirm">{t('admin:setup.labels.confirmPassword')}</Label>
                  <Input
                    id="adminPasswordConfirm"
                    type="password"
                    placeholder="••••••••"
                    value={config.adminPasswordConfirm}
                    onChange={(e) =>
                      setConfig({ ...config, adminPasswordConfirm: e.target.value })
                    }
                  />
                </div>
              </div>

              <Button className="w-full" size="lg" onClick={runSetup}>
                {t('admin:setup.buttons.startSetup')}
              </Button>
            </div>
          )}

          {isRunning && (
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t('admin:setup.progress.label')}</span>
                  <span className="font-medium">{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>

              <div className="space-y-3">
                {steps.map((step) => (
                  <div
                    key={step.id}
                    className="flex items-start gap-3 rounded-lg border p-4"
                  >
                    <div className="mt-0.5">{getStepIcon(step.status)}</div>
                    <div className="flex-1 space-y-1">
                      <h4 className="font-medium">{step.title}</h4>
                      <p className="text-sm text-muted-foreground">{step.description}</p>
                      {step.message && (
                        <p className="text-sm text-muted-foreground">{step.message}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
