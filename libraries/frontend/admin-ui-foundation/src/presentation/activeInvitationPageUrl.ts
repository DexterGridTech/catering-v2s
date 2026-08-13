export type InvitationPageLinkSource = {
  status: string;
  invitationPageUrl?: string | null;
};

/**
 * Invitation validity belongs to the workspace-IAM owner. Consumers must not
 * reinterpret expiresAt locally: only the owner's ACTIVE readback may expose
 * its public invitation entry.
 */
export function activeInvitationPageUrl(invitation: InvitationPageLinkSource): string | undefined {
  const invitationPageUrl = invitation.invitationPageUrl?.trim();
  return invitation.status === 'ACTIVE' && invitationPageUrl ? invitationPageUrl : undefined;
}
