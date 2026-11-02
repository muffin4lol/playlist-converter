import { Brand } from "@/components/brand";
import { OperatorContact } from "@/components/operator-contact";
export default function Page() {
  return (
    <main className="legal-page">
      <Brand />
      <h1>Privacy Policy</h1>
      <p>
        Last updated: November 2, 2026. This policy describes how Playlist
        Converter processes your data.
      </p>
      <OperatorContact />
      <h2>What we store</h2>
      <p>
        First and last name, email, bcrypt password hash, email verification
        status, session identifiers (hashed), security counters, temporary
        wizard state, transfer metadata and track results. Platform tokens are
        encrypted with AES-256-GCM, tied to your session, and unavailable after
        the session expires. Expired database records must be removed by the
        daily scheduled cleanup.
      </p>
      <h2>What we never collect</h2>
      <p>
        Your streaming platform passwords, payment details, or audio files.
        Platform login happens on the provider’s official consent screen, or
        through Apple MusicKit authorization. No advertising trackers are
        installed.
      </p>
      <h2>Why we process data</h2>
      <p>
        We use account details and an essential session cookie to authenticate
        you, provide transfers you request, protect against abuse, send
        verification and reset emails, and display your private history. Your
        email provider and connected streaming platforms process requests under
        their own policies.
      </p>
      <h2>Your controls</h2>
      <p>
        Contact form submissions deliver your name, reply email, and message to
        the operator’s mailbox to respond to your request. They are not added to
        transfer history. Do not include passwords or access tokens. You can
        request deletion through the same contact form.
      </p>
      <p>
        Export your account and history from Account settings. Delete individual
        history entries, all history, or your account. Disconnect platform
        accounts in the converter. Provider consent may also need removal in the
        provider’s account settings. External playlists remain until you remove
        them there.
      </p>
      <h2>Retention and contact</h2>
      <p>
        Account and history records remain until you delete them. Verification
        tokens expire after 24 hours, reset tokens after 30 minutes, and
        sessions after 24 hours. Contact the deployment operator for access,
        correction, erasure, or privacy concerns using the contact published
        alongside their deployment.
      </p>
    </main>
  );
}
