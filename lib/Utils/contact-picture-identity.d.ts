export type ContactPictureIdentityContext = {
    getPNForLID: (lid: string) => Promise<string | null>;
    getLIDForPN: (pn: string) => Promise<string | null>;
    meId: string | undefined;
    meLid: string | undefined;
};
/**
 * Resolve the best-effort contact identity for a profile-picture notification.
 * `from` must be the already-normalized individual JID (never a group jid).
 *
 * Returns the fields to merge into a `contacts.update` entry. When `from` is a LID we
 * attempt to resolve the PN (and vice-versa) so consumers can correlate the change with a
 * cached contact regardless of which addressing form they store. For non-saved contacts WA
 * omits the canonical identity, so resolution may fail — in that case we still return the
 * raw LID so the event is never empty.
 */
export declare function resolveContactPictureIdentity(from: string, ctx: ContactPictureIdentityContext): Promise<{
    id: string;
    lid?: string;
    phoneNumber?: string;
}>;
//# sourceMappingURL=contact-picture-identity.d.ts.map