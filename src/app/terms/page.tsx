import { Brand } from "@/components/brand";
import { OperatorContact } from "@/components/operator-contact";
export default function Page() {
  return (
    <main className="legal-page">
      <Brand />
      <h1>Terms of Use</h1>
      <p>
        Last updated: November 2, 2026. Phase 1 provides free, open registration
        without invitations.
      </p>
      <OperatorContact />
      <h2>Your use</h2>
      <p>
        Only connect accounts you control and playlists you have permission to
        access. Respect provider terms, copyright, quotas, and applicable law.
        This app copies playlist metadata and creates playlists; it does not
        download or distribute music.
      </p>
      <h2>Platform availability</h2>
      <p>
        Direct transfers depend on provider credentials, approval, permissions,
        catalog availability, and quotas. Platforms without a supported official
        integration are unavailable. YouTube playlist support is provided
        through the YouTube Data API; availability in YouTube Music can differ.
        Clean versions and matches are not guaranteed.
      </p>
      <h2>Your responsibility</h2>
      <p>
        Review low-confidence matches and inspect interrupted transfers before
        rerunning them. Keep your account secure. You may export and delete your
        data at any time.
      </p>
      <h2>Service and affiliation</h2>
      <p>
        The software is provided under the MIT License, without warranty to the
        extent permitted by law. Nothing in these terms removes mandatory
        consumer or data protection rights. Playlist Converter is not affiliated
        with, sponsored by, or endorsed by any streaming platform. Platform
        names and marks belong to their owners.
      </p>
    </main>
  );
}
