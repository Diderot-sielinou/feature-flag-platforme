import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  membersService,
  InviteMemberInput,
  UpdateMemberInput,
} from '@/services';
import type { Member, PaginationParams } from '@/types';
import { toast } from '@/components/ui/toast';

export const memberKeys = {
  all: ['members'] as const,
  lists: () => [...memberKeys.all, 'list'] as const,
  list: (projectId: string, params?: PaginationParams) =>
    [...memberKeys.lists(), projectId, params] as const,
  details: () => [...memberKeys.all, 'detail'] as const,
  detail: (projectId: string, memberId: string) =>
    [...memberKeys.details(), projectId, memberId] as const,
  invitations: (projectId: string) =>
    [...memberKeys.all, 'invitations', projectId] as const,
};

export function useMembers(projectId: string, params?: PaginationParams) {
  return useQuery({
    queryKey: memberKeys.list(projectId, params),
    queryFn: () => membersService.list(projectId, params),
    enabled: !!projectId,
  });
}

export function useMember(projectId: string, memberId: string) {
  return useQuery({
    queryKey: memberKeys.detail(projectId, memberId),
    queryFn: () => membersService.get(projectId, memberId),
    enabled: !!projectId && !!memberId,
  });
}

export function usePendingInvitations(projectId: string) {
  return useQuery({
    queryKey: memberKeys.invitations(projectId),
    queryFn: () => membersService.listPendingInvitations(projectId),
    enabled: !!projectId,
  });
}

export function useInviteMember(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: InviteMemberInput) =>
      membersService.invite(projectId, data),
    onSuccess: (invitation) => {
      queryClient.invalidateQueries({
        queryKey: memberKeys.invitations(projectId),
      });
      toast.success({
        title: 'Invitation sent',
        description: `An invitation has been sent to ${invitation.email}`,
      });
    },
    onError: (error: Error) => {
      toast.error({
        title: 'Failed to send invitation',
        description: error.message,
      });
    },
  });
}

export function useUpdateMember(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      memberId,
      data,
    }: {
      memberId: string;
      data: UpdateMemberInput;
    }) => membersService.update(projectId, memberId, data),
    onSuccess: (updatedMember) => {
      queryClient.invalidateQueries({ queryKey: memberKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: memberKeys.detail(projectId, updatedMember.id),
      });
      toast.success({
        title: 'Role updated',
        description: `${updatedMember.user.fullName}'s role has been updated`,
      });
    },
    onError: (error: Error) => {
      toast.error({
        title: 'Failed to update role',
        description: error.message,
      });
    },
  });
}

export function useRemoveMember(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (memberId: string) =>
      membersService.remove(projectId, memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: memberKeys.lists() });
      toast.success('Member removed');
    },
    onError: (error: Error) => {
      toast.error({
        title: 'Failed to remove member',
        description: error.message,
      });
    },
  });
}

export function useResendInvitation(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (invitationId: string) =>
      membersService.resendInvitation(projectId, invitationId),
    onSuccess: () => {
      toast.success('Invitation resent');
    },
    onError: (error: Error) => {
      toast.error({
        title: 'Failed to resend invitation',
        description: error.message,
      });
    },
  });
}

export function useCancelInvitation(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (invitationId: string) =>
      membersService.cancelInvitation(projectId, invitationId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: memberKeys.invitations(projectId),
      });
      toast.success('Invitation cancelled');
    },
    onError: (error: Error) => {
      toast.error({
        title: 'Failed to cancel invitation',
        description: error.message,
      });
    },
  });
}

export function useTransferOwnership(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (newOwnerId: string) =>
      membersService.transferOwnership(projectId, newOwnerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: memberKeys.lists() });
      toast.success('Ownership transferred');
    },
    onError: (error: Error) => {
      toast.error({
        title: 'Failed to transfer ownership',
        description: error.message,
      });
    },
  });
}

export function useLeaveProject(projectId: string) {
  return useMutation({
    mutationFn: () => membersService.leaveProject(projectId),
    onSuccess: () => {
      toast.success('You have left the project');
      // Redirect will be handled by the component
    },
    onError: (error: Error) => {
      toast.error({
        title: 'Failed to leave project',
        description: error.message,
      });
    },
  });
}
