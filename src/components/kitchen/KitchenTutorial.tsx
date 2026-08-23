import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface TutorialStep {
  title: string;
  content: string;
}

interface TutorialProps {
  type: 'layout-editor' | 'pantry';
  onComplete: () => void;
}

export default function KitchenTutorial({ type, onComplete }: TutorialProps) {
  const { t } = useTranslation(['kitchen', 'common']);
  const [open, setOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const steps: TutorialStep[] = type === 'layout-editor'
    ? t('kitchen:kitchenTutorial.layoutEditorSteps', { returnObjects: true }) as TutorialStep[]
    : t('kitchen:kitchenTutorial.pantrySteps', { returnObjects: true }) as TutorialStep[];
  const storageKey = `kitchen-tutorial-${type}-completed`;

  useEffect(() => {
    const completed = localStorage.getItem(storageKey);
    if (!completed) {
      setOpen(true);
    }
  }, [storageKey]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    localStorage.setItem(storageKey, 'true');
    setOpen(false);
    onComplete();
  };

  const handleSkip = () => {
    localStorage.setItem(storageKey, 'true');
    setOpen(false);
    onComplete();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{steps[currentStep].title}</DialogTitle>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-4"
            onClick={handleSkip}
          >
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>
        
        <div className="py-6">
          <p className="text-muted-foreground leading-relaxed">
            {steps[currentStep].content}
          </p>
        </div>

        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {t('kitchen:kitchenTutorial.stepOf', { current: currentStep + 1, total: steps.length })}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentStep === 0}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              {t('common:previous')}
            </Button>
            <Button onClick={handleNext}>
              {currentStep === steps.length - 1 ? (
                t('kitchen:kitchenTutorial.getStarted')
              ) : (
                <>
                  {t('common:next')}
                  <ChevronRight className="h-4 w-4 ml-1" />
                </>
              )}
            </Button>
          </div>
        </div>

        <DialogFooter className="sm:justify-start">
          <Button variant="ghost" size="sm" onClick={handleSkip}>
            {t('kitchen:kitchenTutorial.skipTutorial')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
