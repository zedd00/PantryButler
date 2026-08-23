import { useEffect, useState } from 'react';
import MainLayout from '@/components/layouts/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { getAllProfiles, deleteProfile } from '@/api';
import type { Profile, UserRole } from '@/types/types';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { api } from '@/lib/api-client';
import { useTranslation } from 'react-i18next';
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

export default function UserManagement() {
  const { profile: currentProfile } = useAuth();
  const { t } = useTranslation(['admin', 'common']);
  const [users, setUsers] = useState<Profile[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [userToDelete, setUserToDelete] = useState<Profile | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [canEditCalendar, setCanEditCalendar] = useState(true);

  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('user');

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      if (!currentProfile?.instance_id) {
        toast.error(t('admin:userManagement.toasts.noInstance'));
        return;
      }

      // Fetch profiles with their roles
      const profiles = await getAllProfiles();
      const usersWithRoles = (profiles || []).map((p: any) => ({
        ...p,
        can_edit_calendar: true,
      }));

      setUsers(usersWithRoles);
    } catch (error: any) {
      toast.error(t('admin:userManagement.toasts.loadFailed', { error: error.message }));
    }
  };

  const handleAddUser = async () => {
    if (!newUsername || !newPassword) {
      toast.error(t('admin:userManagement.toasts.usernamePasswordRequired'));
      return;
    }

    try {
      // Use the self‑hosted domain (consistent with AuthContext)
      const email = `${newUsername}@pantrybutler.local`;
      const reg = await api.post<{ user: { id: string } }>('/api/auth/register', { email, password: newPassword });

      // Register creates a personal instance; add the user to the current instance so they appear here
      await api.post('/api/instance-members', {
        user_id: reg.user.id,
        instance_id: currentProfile?.instance_id,
        role: newRole,
      });

      toast.success(t('admin:userManagement.toasts.created'));
      setDialogOpen(false);
      resetForm();
      loadUsers(); // Immediate refresh, no timeout
    } catch (error: any) {
      toast.error(t('admin:userManagement.toasts.createFailed', { error: error.message }));
    }
  };

  const handleUpdateRole = async (userId: string, newRole: UserRole) => {
    try {
      if (!currentProfile?.instance_id) {
        toast.error(t('admin:userManagement.toasts.noInstance'));
        return;
      }

      // Check if demoting the last admin
      const adminCount = users.filter((u: any) => u.role === 'admin').length;
      if (newRole === 'user' && userId === currentProfile?.id && adminCount === 1) {
        toast.error(t('admin:userManagement.toasts.cannotDemoteLastAdmin'));
        return;
      }

      // Update role in instance_members table
      await api.put(`/api/instance-members/${userId}`, { role: newRole, instance_id: currentProfile.instance_id });

      toast.success(t('admin:userManagement.toasts.roleUpdated'));
      loadUsers();
    } catch (error: any) {
      toast.error(t('admin:userManagement.toasts.roleUpdateFailed', { error: error.message }));
    }
  };

  const handleUpdatePermissions = async () => {
    if (!editingUser) return;

    try {
      // Update instance_members table with can_edit_calendar
      await api.put(`/api/instance-members/${editingUser.id}`, { can_edit_calendar: canEditCalendar, instance_id: currentProfile?.instance_id });

      toast.success(t('admin:userManagement.toasts.permissionsUpdated'));
      setEditDialogOpen(false);
      setEditingUser(null);
      loadUsers();
    } catch (error: any) {
      toast.error(t('admin:userManagement.toasts.permissionsUpdateFailed', { error: error.message }));
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    if (userToDelete.id === currentProfile?.id) {
      toast.error(t('admin:userManagement.toasts.cannotDeleteOwn'));
      return;
    }

    try {
      await deleteProfile(userToDelete.id);
      toast.success(t('admin:userManagement.toasts.deleted'));
      setDeleteDialogOpen(false);
      setUserToDelete(null);
      loadUsers();
    } catch (error: any) {
      toast.error(t('admin:userManagement.toasts.deleteFailed', { error: error.message }));
    }
  };

  const resetForm = () => {
    setNewUsername('');
    setNewPassword('');
    setNewRole('user');
    setEditingUser(null);
  };

  const filteredUsers = users.filter(u =>
    u.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <MainLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold">{t('admin:userManagement.headings.management')}</h1>
            <p className="text-muted-foreground mt-1">{t('admin:userManagement.text.description')}</p>
          </div>
          <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" />
            {t('admin:userManagement.buttons.addUser')}
          </Button>
        </div>

        <div className="flex gap-4">
          <Input
            placeholder={t('admin:userManagement.placeholders.search')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t('admin:userManagement.headings.users')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {filteredUsers.map((user) => (
                <div key={user.id} className="flex items-center justify-between p-4 border border-border rounded">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{user.username}</p>
                      <Badge variant={(user as any).role === 'admin' ? 'default' : 'outline'}>
                        {(user as any).role || 'user'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {t('common:created')}: {new Date(user.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingUser(user);
                        setCanEditCalendar((user as any).can_edit_calendar ?? true);
                        setEditDialogOpen(true);
                      }}
                    >
                      <Edit className="mr-1 h-4 w-4" />
                      {t('common:edit')}
                    </Button>
                    <Select
                      value={(user as any).role || 'user'}
                      onValueChange={(role) => handleUpdateRole(user.id, role as UserRole)}
                      disabled={
                        user.id === currentProfile?.id &&
                        users.filter((u: any) => u.role === 'admin').length === 1
                      }
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">{t('admin:userManagement.roles.user')}</SelectItem>
                        <SelectItem value="admin">{t('admin:userManagement.roles.admin')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        setUserToDelete(user);
                        setDeleteDialogOpen(true);
                      }}
                      disabled={user.id === currentProfile?.id}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin:userManagement.headings.addUser')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t('admin:userManagement.labels.username')}</Label>
              <Input value={newUsername} onChange={(e) => setNewUsername(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t('admin:userManagement.labels.password')}</Label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t('admin:userManagement.labels.role')}</Label>
              <Select value={newRole} onValueChange={(v) => setNewRole(v as UserRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">{t('admin:userManagement.roles.user')}</SelectItem>
                  <SelectItem value="admin">{t('admin:userManagement.roles.admin')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('common:cancel')}</Button>
            <Button onClick={handleAddUser}>{t('admin:userManagement.buttons.addUser')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin:userManagement.headings.editPermissions')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t('admin:userManagement.labels.username')}</Label>
              <Input value={editingUser?.username || ''} disabled />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="calendar-permission"
                checked={canEditCalendar}
                onCheckedChange={(checked) => setCanEditCalendar(checked as boolean)}
              />
              <Label htmlFor="calendar-permission" className="cursor-pointer">
                {t('admin:userManagement.labels.canEditCalendar')}
              </Label>
            </div>
            <p className="text-sm text-muted-foreground">
              {t('admin:userManagement.text.calendarPermissionHint')}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>{t('common:cancel')}</Button>
            <Button onClick={handleUpdatePermissions}>{t('admin:userManagement.buttons.saveChanges')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin:userManagement.headings.deleteUser')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('admin:userManagement.text.deleteDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common:cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUser}>{t('common:delete')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}