ALTER TABLE "membership_invitations" ADD COLUMN "platform_role" "platform_role";--> statement-breakpoint
ALTER TABLE "membership_invitations" ADD COLUMN "platform_grant_reason" varchar(1000);--> statement-breakpoint
ALTER TABLE "membership_invitations" ADD COLUMN "platform_granted_by_identity_id" uuid;--> statement-breakpoint
ALTER TABLE "membership_invitations" ADD CONSTRAINT "membership_invitations_platform_granted_by_identity_id_identities_id_fk" FOREIGN KEY ("platform_granted_by_identity_id") REFERENCES "public"."identities"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "membership_invitations" ADD CONSTRAINT "membership_invitation_platform_grant_check" CHECK ((
        "membership_invitations"."platform_role" IS NULL
        AND "membership_invitations"."platform_grant_reason" IS NULL
        AND "membership_invitations"."platform_granted_by_identity_id" IS NULL
      ) OR (
        "membership_invitations"."platform_role" IS NOT NULL
        AND "membership_invitations"."platform_grant_reason" IS NOT NULL
        AND "membership_invitations"."platform_granted_by_identity_id" IS NOT NULL
        AND "membership_invitations"."platform_grant_reason" = btrim("membership_invitations"."platform_grant_reason")
        AND char_length("membership_invitations"."platform_grant_reason") > 0
      ));