import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Clock, Play, Pause, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface StepTimerProps {
  minutes: number;
  stepNumber?: number;
  variant?: 'compact' | 'button'; // compact = current style, button = "Start X min timer" style
}

export function StepTimer({ minutes, stepNumber, variant = 'compact' }: StepTimerProps) {
  const { t } = useTranslation('recipes');
  const [timeLeft, setTimeLeft] = useState(minutes * 60); // Convert to seconds
  const [isRunning, setIsRunning] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const intervalRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Preload audio on mount
  useEffect(() => {
    // Try to load the audio file
    const audioPath = '/timer.wav';
    console.log('Attempting to load audio from:', audioPath);
    console.log('Full URL would be:', window.location.origin + audioPath);
    
    const audio = new Audio(audioPath);
    audio.preload = 'auto';
    
    audio.oncanplaythrough = () => {
      console.log('Timer audio loaded successfully');
      console.log('Audio duration:', audio.duration, 'seconds');
      audioRef.current = audio;
    };
    
    audio.onerror = (e) => {
      console.error('Failed to load timer.wav:', e);
      console.error('Audio error details:', audio.error);
      console.error('Audio error code:', audio.error?.code);
      console.error('Audio error message:', audio.error?.message);
    };
    
    audio.onloadstart = () => {
      console.log('Started loading timer.wav from:', audioPath);
    };
    
    audio.onloadeddata = () => {
      console.log('Audio data loaded');
    };
    
    audio.load();
    
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (isRunning && timeLeft > 0) {
      intervalRef.current = window.setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            setIsRunning(false);
            setIsFinished(true);
            playNotification();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning, timeLeft]);

  const playNotification = () => {
    // Use browser notification API (silent - we'll play our own sound)
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(t('timerComplete'), {
        body: stepNumber ? t('stepTimer.timerForStep', { stepNumber }) : t('stepTimer.timerFinished'),
        icon: '/favicon.ico',
        silent: true, // Don't play system sound - we'll play our custom sound
      });
    }
    
    console.log('Timer finished, attempting to play sound');
    console.log('Audio ref exists:', !!audioRef.current);
    
    // Play sound 3 times using preloaded audio
    if (audioRef.current) {
      let playCount = 0;
      const maxPlays = 3;
      
      const playSound = () => {
        if (playCount < maxPlays && audioRef.current) {
          console.log(`Playing sound, attempt ${playCount + 1}/${maxPlays}`);
          audioRef.current.currentTime = 0;
          audioRef.current.play()
            .then(() => {
              console.log('Sound playing successfully');
            })
            .catch(error => {
              console.error('Failed to play notification sound:', error);
              console.error('Error name:', error.name);
              console.error('Error message:', error.message);
            });
          playCount++;
        }
      };
      
      // Play first time immediately
      playSound();
      
      // Set up event listener to play again when sound ends
      const onEnded = () => {
        console.log('Sound ended, playing next iteration');
        playSound();
      };
      
      audioRef.current.addEventListener('ended', onEnded);
      
      // Clean up listener after all plays are done
      setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.removeEventListener('ended', onEnded);
          console.log('Cleaned up audio event listener');
        }
      }, audioRef.current.duration * maxPlays * 1000 + 1000);
    } else {
      console.error('Audio not loaded - audioRef.current is null');
    }
  };

  const requestNotificationPermission = () => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  };

  const toggleTimer = () => {
    if (!isRunning) {
      requestNotificationPermission();
    }
    setIsRunning(!isRunning);
    setIsFinished(false);
  };

  const resetTimer = () => {
    setIsRunning(false);
    setTimeLeft(minutes * 60);
    setIsFinished(false);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <>
      {variant === 'button' ? (
        // Button variant - "Start X min timer" style
        <div className="flex items-center gap-2">
          {!isRunning && timeLeft === minutes * 60 ? (
            <Button
              size="sm"
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={toggleTimer}
            >
              <Clock className="mr-2 h-4 w-4" />
              {t('stepTimer.startMinTimer', { minutes })}
            </Button>
          ) : (
            <>
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md ${
                isFinished ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
              }`}>
                <Clock className="h-4 w-4" />
                <span className="font-mono text-sm font-semibold">
                  {formatTime(timeLeft)}
                </span>
              </div>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={toggleTimer}
                  className="h-8 w-8 p-0"
                >
                  {isRunning ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                </Button>
                {timeLeft !== minutes * 60 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={resetTimer}
                    className="h-8 w-8 p-0"
                  >
                    <RotateCcw className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      ) : (
        // Compact variant - original style
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4" />
            <span className={`font-mono ${isFinished ? 'text-primary font-semibold' : ''}`}>
              {formatTime(timeLeft)}
            </span>
          </div>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              onClick={toggleTimer}
              className="h-7 w-7 p-0"
            >
              {isRunning ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
            </Button>
            {timeLeft !== minutes * 60 && (
              <Button
                size="sm"
                variant="outline"
                onClick={resetTimer}
                className="h-7 w-7 p-0"
              >
                <RotateCcw className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
