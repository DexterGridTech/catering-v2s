export type InvitationRouteFacts = Readonly<{
  groupWorkspaceKey: string;
  invitationToken: string;
}>;

export type InvitationPageLinkSource = {
  status: string;
  routeFacts?: InvitationRouteFacts | null;
};

function invitationRoutePath(routeFacts: InvitationRouteFacts): string | undefined {
  const groupWorkspaceKey = routeFacts.groupWorkspaceKey.trim();
  const invitationToken = routeFacts.invitationToken.trim();
  if (!groupWorkspaceKey || !invitationToken) return undefined;
  return `/operations/invitations/${encodeURIComponent(groupWorkspaceKey)}/${encodeURIComponent(invitationToken)}`;
}

/**
 * Invitation validity belongs to the workspace-IAM owner. Consumers must not
 * reinterpret expiresAt locally: only the owner's ACTIVE readback may expose
 * its public invitation entry.
 */
export function activeInvitationPageUrl(invitation: InvitationPageLinkSource): string | undefined {
  if (invitation.status !== 'ACTIVE') return undefined;
  if (!invitation.routeFacts) return undefined;
  return invitationRoutePath(invitation.routeFacts);
}
