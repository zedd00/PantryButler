import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '@/components/layouts/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Edit, Trash2, Megaphone } from 'lucide-react';
import { getAllAnnouncements, createAnnouncement, updateAnnouncement, deleteAnnouncement, isSuperAdmin } from '@/api';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next';

interface Announcement {
  id: string;
  title: string;
  message: string;
  created_at: string;
  is_active: boolean;
}

export default function AdminAnnouncements() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { t } = useTranslation(['admin', 'common']);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [announcementToDelete, setAnnouncementToDelete] = useState<Announcement | null>(null);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [isActive, setIsActive] = useState(true);

  const instanceId = profile?.instance_id;

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    try {
      const isSuperAdminUser = await isSuperAdmin();
      if (!isSuperAdminUser) {
        toast.error(t('admin:announcements.toasts.accessDenied'));
        navigate('/recipes');
        return;
      }
      if (!instanceId) {
        toast.error(t('admin:announcements.toasts.accessDenied'));
        navigate('/recipes');
        return;
      }
      loadAnnouncements();
    } catch (error: any) {
      toast.error(t('admin:announcements.toasts.verifyFailed'));
      navigate('/recipes');
    }
  };

  const loadAnnouncements = async () => {
    if (!instanceId) return;
    try {
      const data = await getAllAnnouncements(instanceId);
      setAnnouncements(data);
    } catch (error: any) {
      toast.error(t('admin:announcements.toasts.loadFailed', { error: error.message }));
      if (error.message.includes('Forbidden') || error.message.includes('Unauthorized')) {
        navigate('/recipes');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (announcement?: Announcement) => {
    if (announcement) {
      setEditingAnnouncement(announcement);
      setTitle(announcement.title);
      setMessage(announcement.message);
      setIsActive(announcement.is_active);
    } else {
      setEditingAnnouncement(null);
      setTitle('');
      setMessage('');
      setIsActive(true);
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingAnnouncement(null);
    setTitle('');
    setMessage('');
    setIsActive(true);
  };

  const handleSave = async () => {
    if (!title.trim() || !message.trim()) {
      toast.error(t('admin:announcements.toasts.titleAndMessageRequired'));
      return;
    }

    try {
      if (editingAnnouncement) {
        await updateAnnouncement(editingAnnouncement.id, title, message, isActive);
        toast.success(t('admin:announcements.toasts.updated'));
      } else {
        if (!instanceId) {
          toast.error(t('admin:announcements.toasts.saveFailed', { error: 'No instance selected' }));
          return;
        }
        await createAnnouncement(instanceId, title, message);
        toast.success(t('admin:announcements.toasts.created'));
      }
      handleCloseDialog();
      loadAnnouncements();
    } catch (error: any) {
      toast.error(t('admin:announcements.toasts.saveFailed', { error: error.message }));
    }
  };

  const handleDeleteClick = (announcement: Announcement) => {
    setAnnouncementToDelete(announcement);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!announcementToDelete) return;

    try {
      await deleteAnnouncement(announcementToDelete.id);
      toast.success(t('admin:announcements.toasts.deleted'));
      setDeleteDialogOpen(false);
      setAnnouncementToDelete(null);
      loadAnnouncements();
    } catch (error: any) {
      toast.error(t('admin:announcements.toasts.deleteFailed', { error: error.message }));
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold">{t('admin:announcements.headings.management')}</h1>
            <p className="text-muted-foreground mt-1">
              {t('admin:announcements.text.description')}
            </p>
          </div>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="mr-2 h-4 w-4" />
            {t('admin:announcements.buttons.new')}
          </Button>
        </div>

        <div className="space-y-4">
          {announcements.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Megaphone className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  {t('admin:announcements.text.empty')}
                </p>
              </CardContent>
            </Card>
          ) : (
            announcements.map((announcement) => (
              <Card key={announcement.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <CardTitle className="text-xl">{announcement.title}</CardTitle>
                        {announcement.is_active ? (
                          <Badge variant="default">{t('admin:announcements.badges.active')}</Badge>
                        ) : (
                          <Badge variant="secondary">{t('admin:announcements.badges.inactive')}</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {t('common:created')} {format(new Date(announcement.created_at), 'PPP')}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleOpenDialog(announcement)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleDeleteClick(announcement)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground whitespace-pre-wrap">
                    {announcement.message}
                  </p>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Create/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingAnnouncement ? t('admin:announcements.headings.edit') : t('admin:announcements.headings.create')}
              </DialogTitle>
              <DialogDescription>
                {editingAnnouncement
                  ? t('admin:announcements.text.editHint')
                  : t('admin:announcements.text.createHint')}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">{t('admin:announcements.labels.title')}</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t('admin:announcements.placeholders.title')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="message">{t('admin:announcements.labels.message')}</Label>
                <Textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={t('admin:announcements.placeholders.message')}
                  rows={6}
                />
              </div>
              {editingAnnouncement && (
                <div className="flex items-center space-x-2">
                  <Switch
                    id="is-active"
                    checked={isActive}
                    onCheckedChange={setIsActive}
                  />
                  <Label htmlFor="is-active">{t('admin:announcements.labels.active')}</Label>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleCloseDialog}>
                {t('common:cancel')}
              </Button>
              <Button onClick={handleSave}>
                {editingAnnouncement ? t('common:update') : t('common:create')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('admin:announcements.dialogs.deleteTitle')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('admin:announcements.dialogs.deleteDescription', { title: announcementToDelete?.title })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('common:cancel')}</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteConfirm}>{t('common:delete')}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </MainLayout>
  );
}
