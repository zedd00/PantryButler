import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '@/components/layouts/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { Trash2, Shield } from 'lucide-react';
import { getAllInstancesWithDetails, deleteInstanceCompletely, isSuperAdmin, type InstanceWithDetails } from '@/api';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';

export default function AdminInstances() {
  const navigate = useNavigate();
  const { t } = useTranslation(['admin', 'common']);
  const [instances, setInstances] = useState<InstanceWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSuperAdminUser, setIsSuperAdminUser] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [instanceToDelete, setInstanceToDelete] = useState<InstanceWithDetails | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        const authorized = await isSuperAdmin();
        if (cancelled) return;

        if (!authorized) {
          setLoading(false);
          toast.error(t('admin:instances.toasts.unauthorized'));
          navigate('/recipes');
          return;
        }

        setIsSuperAdminUser(true);
        setLoading(false);
        loadInstances();
      } catch {
        if (!cancelled) {
          setLoading(false);
          navigate('/recipes');
        }
      }
    };

    init();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadInstances = async () => {
    try {
      const data = await getAllInstancesWithDetails();
      setInstances(data);
    } catch (error: any) {
      toast.error(t('admin:instances.toasts.loadFailed', { error: error.message }));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (instance: InstanceWithDetails) => {
    setInstanceToDelete(instance);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!instanceToDelete) return;

    setDeleting(true);
    try {
      await deleteInstanceCompletely(instanceToDelete.id);
      toast.success(t('admin:instances.toasts.deleted', { name: instanceToDelete.name }));
      setDeleteDialogOpen(false);
      setInstanceToDelete(null);
      loadInstances(); // Reload the list
    } catch (error: any) {
      toast.error(t('admin:instances.toasts.deleteFailed', { error: error.message }));
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return t('admin:instances.formatDate.never');
    try {
      return format(new Date(dateString), 'MMM d, yyyy h:mm a');
    } catch {
      return t('admin:instances.formatDate.invalidDate');
    }
  };

  // Don't render anything if not admin
  if (!isSuperAdminUser) {
    return null;
  }

  return (
    <MainLayout>
      <div className="container mx-auto py-8 px-4 max-w-7xl">
        <div className="flex items-center gap-3 mb-6">
          <Shield className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">{t('admin:instances.headings.management')}</h1>
            <p className="text-muted-foreground">{t('admin:instances.text.description')}</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t('admin:instances.headings.all')}</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                {t('admin:instances.text.loading')}
              </div>
            ) : instances.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {t('admin:instances.text.empty')}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('admin:instances.table.instanceName')}</TableHead>
                      <TableHead>{t('admin:instances.table.creator')}</TableHead>
                      <TableHead>{t('admin:instances.table.created')}</TableHead>
                      <TableHead>{t('admin:instances.table.lastLogin')}</TableHead>
                      <TableHead className="text-right">{t('admin:instances.table.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {instances.map((instance) => (
                      <TableRow key={instance.id}>
                        <TableCell className="font-medium">{instance.name}</TableCell>
                        <TableCell className="text-muted-foreground">{instance.creator_email}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(instance.created_at)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(instance.last_login)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteClick(instance)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            {t('common:delete')}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="mt-6 p-4 bg-muted rounded-lg">
          <h3 className="font-medium mb-2">{t('admin:instances.headings.aboutDeletion')}</h3>
          <p className="text-sm text-muted-foreground">
            {t('admin:instances.text.deletionWarning')}
          </p>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin:instances.headings.deleteConfirm')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('admin:instances.deleteDialog.confirmText', { name: instanceToDelete?.name })}
              <br /><br />
              {t('admin:instances.deleteDialog.permanently')}
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>{t('admin:instances.deleteDialog.items.recipes')}</li>
                <li>{t('admin:instances.deleteDialog.items.pantry')}</li>
                <li>{t('admin:instances.deleteDialog.items.calendar')}</li>
                <li>{t('admin:instances.deleteDialog.items.settings')}</li>
                <li>{t('admin:instances.deleteDialog.items.memberships')}</li>
              </ul>
              <br />
              <strong className="text-destructive">{t('admin:instances.deleteDialog.cannotUndo')}</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t('common:cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? t('admin:instances.buttons.deleting') : t('admin:instances.buttons.deleteInstance')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
