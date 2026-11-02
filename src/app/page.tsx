import Link from "next/link";
import {
  ArrowRight,
  ArrowLeftRight,
  ShieldCheck,
  Check,
  LockKeyhole,
  Music2,
} from "lucide-react";
import { Brand } from "@/components/brand";
import { Theme } from "@/components/theme";
import { platforms, PlatformIcon } from "@/components/platforms";
import { platformAvailability } from "@/lib/platforms/availability";
export default function Home() {
  const available = platformAvailability();
  return (
    <>
      <nav className="landing-nav">
        <Brand />
        <div>
          <Theme />
          <Link href="/login">Log in</Link>
          <Link className="button secondary" href="/register">
            Sign up free <ArrowRight size={14} />
          </Link>
        </div>
      </nav>
      <main>
        <section className="landing-hero">
          <div className="eyebrow">
            <span /> PHASE 01 · FREE & OPEN TO EVERYONE
          </div>
          <h1>
            Your music.
            <br />
            <span>No boundaries.</span>
          </h1>
          <p>
            Your playlists are a part of you. Take them to your next music
            platform, without starting from scratch.
          </p>
          <div className="hero-actions">
            <Link href="/register" className="button primary">
              Give your playlists a new home <ArrowRight size={16} />
            </Link>
            <Link href="#how-it-works" className="button secondary">
              See how it works
            </Link>
          </div>
          <div className="hero-proof">
            <span>
              <Check size={13} /> Free to get started
            </span>
            <span>
              <ShieldCheck size={13} /> Secure connections
            </span>
            <span>
              <Check size={13} /> No invite needed
            </span>
          </div>
        </section>
        <div
          className="landing-preview"
          aria-label="Illustration of a playlist transfer"
        >
          <div className="preview-top">
            <span />
            <span />
            <span />
            <b>playlistconverter / your next soundtrack</b>
            <LockKeyhole size={12} />
          </div>
          <div className="preview-body">
            <div className="preview-account">
              <PlatformIcon id="spotify" />
              <div>
                <b>The late night mix</b>
                <small>Spotify · Your playlist</small>
              </div>
            </div>
            <div className="preview-center">
              <ArrowLeftRight size={24} />
            </div>
            <div className="preview-account">
              <PlatformIcon id="youtube" />
              <div>
                <b>The late night mix</b>
                <small>YouTube Music · New home</small>
              </div>
            </div>
          </div>
          <div className="preview-bottom">
            <span>
              <ShieldCheck size={13} /> Your soundtrack stays yours.
            </span>
            <span>Preview every track before it moves.</span>
          </div>
        </div>
        <div className="landing-platforms">
          {platforms.map((p) => (
            <div key={p.id}>
              <PlatformIcon id={p.id} />
              {p.name}
              <small style={{ display: "block", fontSize: 10 }}>
                {available[p.id as keyof typeof available]
                  ? "Direct + CSV"
                  : "CSV import / export"}
              </small>
            </div>
          ))}
        </div>
        <section className="landing-section" id="how-it-works">
          <div className="eyebrow">A FRESH START, WITHOUT THE REBUILD</div>
          <h2>Three moves. A whole new soundtrack.</h2>
          <div className="feature-grid">
            <article className="feature-box">
              <span>01 / CONNECT</span>
              <h3>Choose your next stop.</h3>
              <p>
                Choose your platforms. Use official consent for an enabled
                connection, or bring a CSV from any platform. Each card shows
                the available transport.
              </p>
            </article>
            <article className="feature-box">
              <span>02 / MAKE IT YOURS</span>
              <h3>A little more control.</h3>
              <p>
                Review each track. Keep explicit songs, skip them, or look for a
                clean version. Nothing moves without your say.
              </p>
            </article>
            <article className="feature-box">
              <span>03 / BRING IT ALONG</span>
              <h3>Press play, somewhere new.</h3>
              <p>
                We match your music, create your playlist, and give you a
                detailed report. CSV exports are available for every platform.
              </p>
            </article>
          </div>
        </section>
        <section
          className="landing-section"
          style={{ textAlign: "center", paddingTop: 20 }}
        >
          <Music2
            size={30}
            style={{ color: "var(--accent)", margin: "0 auto 20px" }}
          />
          <h2>Good music deserves to travel.</h2>
          <p>No payment. No whitelist. Just you and your music.</p>
          <Link href="/register" className="button primary">
            Sign up free <ArrowRight size={15} />
          </Link>
          <p style={{ fontSize: 10, marginTop: 20 }}>
            Direct integrations depend on provider approval. CSV import/export
            is available for platforms without a direct integration.
          </p>
        </section>
      </main>
      <footer className="landing-footer">
        <span>
          © {new Date().getFullYear()} Playlist Converter · Not affiliated with
          any streaming platform.
        </span>
        <div>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/contact">Contact</Link>
          <Link href="/login">Log in</Link>
        </div>
      </footer>
    </>
  );
}
