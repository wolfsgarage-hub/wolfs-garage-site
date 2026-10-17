# Instagram owner entry, public site v2.04

Paired with the existing Wolfs-admin Studio v39.0.0 and Social Queue v1.2.0.

/post-maker and /social-queue are nonpermanent redirects to the existing admin's established raw.githack.com origin. They do not proxy credentials, serve a second app, change the admin authentication policy, change public navigation, activate Instagram, or modify content records. Both owner entry paths are marked noindex/nofollow. Existing directory, events, API, asset, subscription and other route behavior is unchanged.

Control parity: Studio generates and checkpoints photo packages, saves pending posts to the existing Supabase review queue, and displays the shared two-week line. Social Queue remains the review/approval and explicit ARM LIVE control. The public entry URLs route to those same controls instead of an independent interface.

Rollback removes only the two new redirects/headers and restores the prior version metadata. The admin, cloud drafts, media, and all original public routes remain independent of these convenience entry URLs.
