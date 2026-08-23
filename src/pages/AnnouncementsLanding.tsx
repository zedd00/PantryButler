import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '@/components/layouts/MainLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Megaphone, Calendar, Plus } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getActiveAnnouncements, markAnnouncementViewed, createAnnouncement, isSuperAdmin, getCurrentUserRole } from '@/api';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';

interface Announcement {
  id: string;
  title: string;
  message: string;
  created_at: string;
  is_active: boolean;
}

export default function AnnouncementsLanding() {
  const { t } = useTranslation('common');
  const { profile, currentInstance } = useAuth();
  const navigate = useNavigate();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadAnnouncements();
    checkManageAccess();
  }, [profile, currentInstance]);

  const checkManageAccess = async () => {
    if (!currentInstance) {
      setCanManage(false);
      return;
    }
    try {
      const [role, isSuperAdminUser] = await Promise.all([getCurrentUserRole(), isSuperAdmin()]);
      setCanManage(role === 'admin' || isSuperAdminUser);
    } catch {
      setCanManage(false);
    }
  };

  const handleCreate = async () => {
    if (!title.trim() || !message.trim()) {
      toast.error(t('announcements.titleAndMessageRequired'));
      return;
    }
    if (!currentInstance) return;

    try {
      await createAnnouncement(currentInstance.id, title, message);
      toast.success(t('announcements.createdSuccess'));
      setDialogOpen(false);
      setTitle('');
      setMessage('');
      loadAnnouncements();
    } catch (error: any) {
      toast.error(error.message || t('announcements.loadFailed'));
    }
  };

  const loadAnnouncements = async () => {
    setLoading(true);
    setError(null);

    if (!currentInstance) {
      setAnnouncements([]);
      setLoading(false);
      return;
    }

    try {
      const data = await getActiveAnnouncements(currentInstance.id);
      setAnnouncements(data || []);
      
      // Mark all as viewed if we have profile and instance
      if (profile && currentInstance && data && data.length > 0) {
        // We do this in parallel to be faster
        await Promise.allSettled(
          data.map(announcement => 
            markAnnouncementViewed(profile.id, announcement.id, currentInstance.id)
          )
        );
        
        // Dispatch an event to notify other components to refresh counts
        window.dispatchEvent(new CustomEvent('notifications-refreshed'));
      }
    } catch (error: any) {
      console.error('[AnnouncementsLanding] Failed to load announcements:', error);
      const errorMessage = error.message || 'Unknown error';
      setError(errorMessage);
      
      // Show user-friendly error message
      if (errorMessage.includes('permission denied') || errorMessage.includes('RLS')) {
        toast.error(t('announcements.permissionDenied'));
      } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
        toast.error(t('announcements.networkError'));
      } else {
        toast.error(t('announcements.loadFailed'));
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-4">
            <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-sm text-muted-foreground font-light tracking-wide">{t('announcements.loading')}</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-3xl mx-auto py-12 px-6">
        <header className="mb-16 space-y-2">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-3 text-primary mb-4">
                <Megaphone className="h-5 w-5" />
                <span className="text-xs font-medium uppercase tracking-[0.2em]">{t('announcements.updatesHeading')}</span>
              </div>
              <h1 className="text-4xl font-light tracking-tight text-foreground">{t('announcements.heading')}</h1>
              <p className="text-muted-foreground font-light">{t('announcements.description')}</p>
            </div>
            {canManage && (
              <Button onClick={() => setDialogOpen(true)} className="shrink-0">
                <Plus className="mr-2 h-4 w-4" />
                {t('announcements.newAnnouncement')}
              </Button>
            )}
          </div>
        </header>

        {error ? (
          <div className="py-24 text-center border rounded-lg bg-destructive/10 border-destructive/20">
            <Megaphone className="h-10 w-10 text-destructive/50 mx-auto mb-4" />
            <p className="text-destructive font-light mb-4">{error}</p>
            <button 
              onClick={loadAnnouncements}
              className="text-sm font-light tracking-[0.2em] uppercase text-primary hover:text-primary/80 transition-minimal border-b border-primary pb-1"
            >
              {t('tryAgain')}
            </button>
          </div>
        ) : announcements.length === 0 ? (
          <div className="py-24 text-center border rounded-lg bg-muted/30">
            <Megaphone className="h-10 w-10 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground font-light">{t('announcements.empty')}</p>
          </div>
        ) : (
          <>
            <div className="space-y-12">
              {announcements.map((announcement) => (
                <article key={announcement.id} className="group space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <h2 className="text-2xl font-normal text-foreground group-hover:text-primary transition-minimal leading-tight">
                      {announcement.title}
                    </h2>
                    <Badge variant="secondary" className="font-light tracking-wide px-2 py-0 h-5 bg-muted text-muted-foreground border-none">
                      {t('active')}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center gap-2 text-xs text-muted-foreground font-light tracking-wider uppercase">
                    <Calendar className="h-3.5 w-3.5" />
                    {format(new Date(announcement.created_at), 'MMMM d, yyyy')}
                  </div>

                  <div className="text-base text-muted-foreground font-light leading-relaxed whitespace-pre-wrap pt-2">
                    {announcement.message}
                  </div>
                  
                  <div className="pt-8 border-b border-muted w-full opacity-50"></div>
                </article>
              ))}
            </div>

            <div className="pt-12 pb-24 text-center">
              <button 
                onClick={() => navigate('/recipes')}
                className="text-sm font-light tracking-[0.2em] uppercase text-muted-foreground hover:text-primary transition-minimal border-b border-transparent hover:border-primary pb-1"
              >
                {t('announcements.continueToRecipes')}
              </button>
            </div>
          </>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('announcements.createTitle')}</DialogTitle>
            <DialogDescription>
              {t('announcements.createDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-announcement-title">{t('announcements.titleLabel')}</Label>
              <Input
                id="new-announcement-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('announcements.titlePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-announcement-message">{t('announcements.messageLabel')}</Label>
              <Textarea
                id="new-announcement-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t('announcements.messagePlaceholder')}
                rows={6}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t('cancel')}
            </Button>
            <Button onClick={handleCreate}>
              {t('create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}

