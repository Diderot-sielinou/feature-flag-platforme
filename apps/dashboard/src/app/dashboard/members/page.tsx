'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, AlertCircle, Trash2, Plus, Mail } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from '@/components/ui/toast';
import { ConfirmDialog } from '@/components/shared';
import { getInitials, getRoleColor } from '@/lib/utils';
import { useCurrentProject } from '@/stores';
import { useMembers, useInviteMember, useRemoveMember } from '@/hooks/useMembers';

export default function MembersPage() {
  const project = useCurrentProject();
  const { data: membersData, isLoading } = useMembers(project?.id || '');
  const inviteMember = useInviteMember(project?.id || '');
  const removeMember = useRemoveMember(project?.id || '');

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<string>('VIEWER');
  const [removeTarget, setRemoveTarget] = useState<{ id: string; name: string } | null>(null);

  const members = membersData?.data || [];

  const handleInvite = async () => {
    if (!inviteEmail || !project) return;
    await inviteMember.mutateAsync({
      email: inviteEmail,
      role: inviteRole as 'ADMIN' | 'EDITOR' | 'VIEWER',
    });
    toast.success(`Invitation sent to ${inviteEmail}`);
    setInviteEmail('');
    setInviteRole('VIEWER');
    setInviteOpen(false);
  };

  if (!project) {
    return (
      <div className="text-center py-20">
        <AlertCircle className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
        <h2 className="text-lg font-medium mb-2">No project selected</h2>
        <p className="text-muted-foreground mb-4">Select a project first to manage team members.</p>
        <Link href="/dashboard/projects">
          <Button variant="glow">Go to Projects</Button>
        </Link>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold">Team Members</h1>
          <p className="text-muted-foreground mt-1">
            Manage access for <span className="font-medium text-foreground">{project.name}</span>
          </p>
        </div>
        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <DialogTrigger asChild>
            <Button variant="glow" className="gap-2">
              <Plus className="h-4 w-4" />
              Invite Member
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite Team Member</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="colleague@company.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="role">Role</Label>
                <Select value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                    <SelectItem value="EDITOR">Editor</SelectItem>
                    <SelectItem value="VIEWER">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleInvite} disabled={!inviteEmail || inviteMember.isPending} className="w-full gap-2">
                <Mail className="h-4 w-4" />
                {inviteMember.isPending ? 'Sending...' : 'Send Invitation'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
        </div>
      ) : members.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Users className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No team members yet</h3>
            <p className="text-muted-foreground">Invite team members to collaborate on this project.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {members.map((member) => (
              <motion.div key={member.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <Card variant="interactive">
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-4">
                      <Avatar>
                        <AvatarImage src={member.user?.avatarUrl || undefined} />
                        <AvatarFallback>
                          {getInitials(member.user?.fullName || member.user?.email || '?')}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{member.user?.fullName || 'Unknown'}</p>
                        <p className="text-sm text-muted-foreground">{member.user?.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className={getRoleColor(member.role)}>{member.role}</Badge>
                      {member.role !== 'OWNER' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            setRemoveTarget({
                              id: member.userId || member.id,
                              name: member.user?.fullName || member.user?.email || 'this member',
                            })
                          }
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <ConfirmDialog
        open={!!removeTarget}
        onOpenChange={() => setRemoveTarget(null)}
        title="Remove Member"
        description={`Are you sure you want to remove "${removeTarget?.name}" from this project?`}
        confirmLabel="Remove"
        variant="destructive"
        onConfirm={async () => {
          if (removeTarget) {
            await removeMember.mutateAsync({ projectId: project.id, userId: removeTarget.id });
            toast.success('Member removed');
            setRemoveTarget(null);
          }
        }}
      />
    </motion.div>
  );
}
