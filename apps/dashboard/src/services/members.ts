import apiClient, { endpoints } from './api-client';
import type { PaginatedResponse, PaginationParams } from '@/types';

export type MemberRole = 'OWNER' | 'ADMIN' | 'EDITOR' | 'VIEWER';

export interface Member {
  id: string;
  userId: string;
  projectId: string;
  role: MemberRole;
  user: {
    id: string;
    email: string;
    fullName: string | null;
    avatarUrl: string | null;
  };
  createdAt: string;
  updatedAt: string;
}

export interface InviteMemberInput {
  email: string;
  role: MemberRole;
}

export interface UpdateMemberInput {
  role: MemberRole;
}

export interface PendingInvitation {
  id: string;
  email: string;
  role: MemberRole;
  invitedBy: {
    id: string;
    fullName: string;
  };
  invitedAt: string;
  expiresAt: string;
}

export const membersService = {
  async list(
    projectId: string,
    params?: PaginationParams,
  ): Promise<PaginatedResponse<Member>> {
    const response = await apiClient.get(endpoints.members.list(projectId), {
      params,
    });
    return response.data;
  },

  async get(projectId: string, memberId: string): Promise<Member> {
    const response = await apiClient.get(
      endpoints.members.get(projectId, memberId),
    );
    return response.data;
  },

  async invite(
    projectId: string,
    data: InviteMemberInput,
  ): Promise<PendingInvitation> {
    const response = await apiClient.post(
      endpoints.members.invite(projectId),
      data,
    );
    return response.data;
  },

  async update(
    projectId: string,
    memberId: string,
    data: UpdateMemberInput,
  ): Promise<Member> {
    const response = await apiClient.put(
      endpoints.members.update(projectId, memberId),
      data,
    );
    return response.data;
  },

  async remove(projectId: string, memberId: string): Promise<void> {
    await apiClient.delete(endpoints.members.remove(projectId, memberId));
  },

  async resendInvitation(
    projectId: string,
    invitationId: string,
  ): Promise<void> {
    await apiClient.post(
      endpoints.members.resendInvite(projectId, invitationId),
    );
  },
};
