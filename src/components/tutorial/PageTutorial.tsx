import { useEffect, useState } from 'react';
import { Joyride, STATUS, EVENTS } from 'react-joyride';
import type { Step, EventData } from 'react-joyride';
import { useTutorial } from '@/contexts/TutorialContext';
import { useTranslation } from 'react-i18next';

interface PageTutorialProps {
  tutorialId: string;
  steps: Step[];
  enabled?: boolean;
}

export function PageTutorial({ tutorialId, steps, enabled = true }: PageTutorialProps) {
  const { t } = useTranslation('tutorial');
  const { markTutorialCompleted, loading, completedTutorials } = useTutorial();
  const [run, setRun] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  useEffect(() => {
    const isCompleted = completedTutorials.has(tutorialId);

    // Only start if not completed, not already started, and conditions are met
    if (!loading && enabled && !isCompleted && !hasStarted) {
      const timer = setTimeout(() => {
        setRun(true);
        setHasStarted(true);
      }, 500);
      return () => clearTimeout(timer);
    } else if (isCompleted) {
      setRun(false);
    }
  }, [loading, enabled, tutorialId, completedTutorials, hasStarted]);

  const handleJoyrideCallback = (data: EventData) => {
    const { status, type, action } = data;

    // Mark as completed when tour finishes, is skipped, or is stopped
    const shouldComplete =
      status === STATUS.FINISHED ||
      status === STATUS.SKIPPED ||
      status === STATUS.PAUSED ||
      (type === EVENTS.TOUR_STATUS && action === 'stop');

    if (shouldComplete) {
      markTutorialCompleted(tutorialId);
      setRun(false);
    }
  };

  if (loading || !enabled) {
    return null;
  }

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous
      onEvent={handleJoyrideCallback}
      locale={{
        back: t('common.back'),
        close: t('common.close'),
        last: t('common.last'),
        next: t('common.next'),
        skip: t('common.skip'),
      }}
    />
  );
}
