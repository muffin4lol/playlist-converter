import { Brand } from "@/components/brand";

export default async function Contact({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const params = await searchParams;
  return (
    <main className="legal-page">
      <Brand />
      <h1>Contact & privacy requests</h1>
      <p>
        Contact Sahil Dhole, the operator of Playlist Converter, for support or
        questions about your personal data. Never include passwords, access
        tokens, or payment details.
      </p>
      {params.sent && (
        <p role="status">
          Your message was sent. We will reply to the email address you
          provided.
        </p>
      )}
      {params.error && (
        <p role="alert">
          Your message could not be sent. Check the fields and try again later.
          Name and email are required; messages must be 10–3000 characters.
        </p>
      )}
      <form
        action="/api/contact"
        method="post"
        style={{ display: "grid", gap: 16, maxWidth: 540 }}
      >
        <label>
          Your name
          <input
            name="name"
            autoComplete="name"
            required
            minLength={1}
            maxLength={120}
          />
        </label>
        <label>
          Your email
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
          />
        </label>
        <label>
          Message
          <textarea
            name="message"
            required
            minLength={10}
            maxLength={3000}
            rows={7}
            style={{
              width: "100%",
              background: "var(--surface)",
              color: "inherit",
              border: "1px solid var(--border)",
              padding: 12,
              borderRadius: 10,
            }}
          />
        </label>
        <p>
          We use your name, email and message to respond to this request. It is
          delivered to the operator’s mailbox and isn’t added to your transfer
          history.
        </p>
        <button className="button primary" type="submit">
          Send message
        </button>
      </form>
    </main>
  );
}
