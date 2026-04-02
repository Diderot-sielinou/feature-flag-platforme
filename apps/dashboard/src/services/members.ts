import { apiClient } from './api-client';
import type { Member, PaginatedResponse, PaginationParams } from '@/types';

export type MemberRole = 'OWNER' | 'ADMIN' | 'EDITOR' | 'VIEWER';

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
    params?: PaginationParams
  ): Promise<PaginatedResponse<Member>> {
    const response = await apiClient.get(`/projects/${projectId}/members`, {
      params,
    });
    return response.data;
  },

  async get(projectId: string, memberId: string): Promise<Member> {
    const response = await apiClient.get(
      `/projects/${projectId}/members/${memberId}`
    );
    return response.data;
  },

  async invite(
    projectId: string,
    data: InviteMemberInput
  ): Promise<PendingInvitation> {
    const response = await apiClient.post(
      `/projects/${projectId}/members/invite`,
      data
    );
    return response.data;
  },

  async update(
    projectId: string,
    memberId: string,
    data: UpdateMemberInput
  ): Promise<Member> {
    const response = await apiClient.patch(
      `/projects/${projectId}/members/${memberId}`,
      data
    );
    return response.data;
  },

  async remove(projectId: string, memberId: string): Promise<void> {
    await apiClient.delete(`/projects/${projectId}/members/${memberId}`);
  },

  async listPendingInvitations(
    projectId: string
  ): Promise<PendingInvitation[]> {
    const response = await apiClient.get(
      `/projects/${projectId}/members/invitations`
    );
    return response.data;
  },

  async resendInvitation(
    projectId: string,
    invitationId: string
  ): Promise<void> {
    await apiClient.post(
      `/projects/${projectId}/members/invitations/${invitationId}/resend`
    );
  },

  async cancelInvitation(
    projectId: string,
    invitationId: string
  ): Promise<void> {
    await apiClient.delete(
      `/projects/${projectId}/members/invitations/${invitationId}`
    );
  },

  async transferOwnership(
    projectId: string,
    newOwnerId: string
  ): Promise<void> {
    await apiClient.post(`/projects/${projectId}/transfer-ownership`, {
      newOwnerId,
    });
  },

  async leaveProject(projectId: string): Promise<void> {
    await apiClient.post(`/projects/${projectId}/leave`);
  },
};
