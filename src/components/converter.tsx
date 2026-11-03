"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  CheckCircle2,
  ExternalLink,
  LoaderCircle,
  LockKeyhole,
  Music2,
  ShieldCheck,
} from "lucide-react";
import { platforms, PlatformIcon, platformLabel } from "./platforms";
import { Button } from "./ui/button";
import { request, errorMessage } from "@/lib/client";
import { authorizeMusicKit, disconnectMusicKit } from "@/lib/musickit-client";
import { explicitSelection } from "@/lib/matching";
import { playlistReference } from "@/lib/platforms/playlist-url";
import { wizardSchema, type WizardState } from "@/lib/validation";
import type { Playlist, Track } from "@/lib/platforms/types";

type Connection = {
  platform: string;
  role: string;
  displayName: string;
  avatar?: string;
};
type Report = {
  id: string;
  status: string;
  matched: number;
  total: number;
  notFound: number;
  excluded: number;
  destinationUrl?: string;
  error?: string;
  tracks: {
    id: string;
    title: string;
    artist: string;
    result: string;
    confidence: number | null;
  }[];
};
const initial: WizardState = {
  version: 2,
  step: 0,
  source: "",
  destination: "",
  inputMode: "account",
  playlistUrl: "",
  playlistName: "My playlist",
  includeExplicit: true,
  cleanMode: "skip",
  tracks: [],
};
const steps = ["Source", "Playlist", "Destination", "Convert & save"];
export function Converter() {
  const [state, setState] = useState<WizardState>(initial);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [available, setAvailable] = useState<Record<string, boolean>>({});
  const [publicAvailable, setPublicAvailable] = useState<
    Record<string, boolean>
  >({});
  const [ready, setReady] = useState(false),
    [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false),
    [running, setRunning] = useState(false);
  const [error, setError] = useState(""),
    [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [report, setReport] = useState<Report | null>(null),
    [transferId, setTransferId] = useState("");
  const [matches, setMatches] = useState<
    Record<
      string,
      {
        title: string;
        artist: string;
        confidence: number | null;
        result: string;
      }
    >
  >({});
  const [youtubeTesting, setYoutubeTesting] = useState(false);
  async function refresh() {
    const data = await request<{
      state: WizardState | null;
      connections: Connection[];
      verified: boolean;
      availability: Record<string, boolean>;
      publicAvailability: Record<string, boolean>;
      youtubeTesting: boolean;
    }>("/api/wizard");
    setConnections(data.connections);
    setVerified(data.verified);
    setAvailable(data.availability);
    setPublicAvailable(data.publicAvailability);
    setYoutubeTesting(data.youtubeTesting);
    return data;
  }
  useEffect(() => {
    let active = true;
    // New-transfer navigation resets only the draft; history and connections stay intact.
    const startNew =
      new URLSearchParams(window.location.search).get("new") === "1";
    const load = async () => {
      if (startNew) {
        await request("/api/wizard", "DELETE");
        // Consume the intent: refresh/OAuth returns should resume this new draft.
        window.history.replaceState(window.history.state, "", "/converter");
      }
      return request<Awaited<ReturnType<typeof refresh>>>("/api/wizard");
    };
    load()
      .then((data) => {
        if (!active) return;
        setConnections(data.connections);
        setVerified(data.verified);
        setAvailable(data.availability);
        setPublicAvailable(data.publicAvailability);
        setYoutubeTesting(data.youtubeTesting);
        if (data.state) {
          setState(data.state);
          if (data.state.transferId) {
            setTransferId(data.state.transferId);
            request<Report>(`/api/transfers/${data.state.transferId}`)
              .then((result) => {
                if (active) setReport(result);
              })
              .catch((e) => {
                if (active) setError(errorMessage(e));
              });
          }
        }
        const outcome = new URLSearchParams(window.location.search).get(
          "connection",
        );
        if (outcome)
          setError(
            outcome === "denied"
              ? "Authorization was cancelled. Your selections are saved; try connecting again."
              : "Authorization failed or expired. Please reconnect; your selections are saved.",
          );
        setReady(true);
      })
      .catch((e) => {
        setError(errorMessage(e));
        setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);
  async function save(next: WizardState) {
    await request("/api/wizard", "PUT", wizardSchema.parse(next));
    setState(next);
  }
  async function action(work: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await work();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  const connected = (role: string) =>
    connections.find(
      (c) =>
        c.role === role &&
        c.platform === (role === "source" ? state.source : state.destination),
    );
  async function connect(role: "source" | "destination") {
    await action(async () => {
      await save(state);
      const platform = role === "source" ? state.source : state.destination;
      if (platform === "apple") {
        const { developerToken } = await request<{ developerToken: string }>(
          "/api/musickit",
        );
        const token = await authorizeMusicKit(developerToken);
        await request("/api/musickit", "POST", { token, role });
        await refresh();
      } else {
        const { url } = await request<{ url: string }>(
          `/api/platforms/${platform}/connect`,
          "POST",
          { role },
        );
        window.location.assign(url);
      }
    });
  }
  async function loadPlaylists() {
    await action(async () =>
      setPlaylists(
        await request<Playlist[]>(`/api/platforms/${state.source}/playlists`),
      ),
    );
  }
  async function loadPlaylist(id?: string) {
    await action(async () => {
      const reference = id
        ? undefined
        : playlistReference(state.source, state.playlistUrl);
      const endpoint = id
        ? `/api/platforms/${state.source}/playlist?id=${encodeURIComponent(id)}`
        : `/api/platforms/${state.source}/public?url=${encodeURIComponent(state.playlistUrl)}`;
      const playlist = await request<{ name: string; tracks: Track[] }>(
        endpoint,
      );
      await save({
        ...state,
        playlistId: id || reference?.id,
        sourcePlaylistName: playlist.name,
        playlistName: playlist.name,
        tracks: playlist.tracks,
      });
      setMatches({});
    });
  }
  function explicit(include: boolean) {
    setState({
      ...state,
      includeExplicit: include,
      tracks: explicitSelection(state.tracks, include, state.cleanMode),
    });
    setMatches({});
  }
  async function preview() {
    await action(async () => {
      await save(state);
      const result: typeof matches = {};
      // Sequential API requests respect provider quotas; transfers revalidate every match.
      for (const track of state.tracks.filter(
        (t) =>
          t.selected ||
          (!state.includeExplicit &&
            state.cleanMode === "replace" &&
            t.explicit === true),
      )) {
        result[track.id] = await request("/api/matches", "POST", {
          destination: state.destination,
          track,
          clean: !track.selected && state.cleanMode === "replace",
        });
        setMatches({ ...result });
      }
    });
  }
  async function run(id?: string) {
    setBusy(true);
    setRunning(true);
    setError("");
    try {
      let job = id || transferId;
      if (!job) {
        await save({ ...state, step: 3 });
        const created = await request<{ id: string }>(
          "/api/convert",
          "POST",
          state,
        );
        job = created.id;
        setTransferId(job);
        await save({ ...state, step: 3, transferId: job });
      }
      while (true) {
        await request(`/api/transfers/${job}/tick`, "POST", {});
        const progress = await request<Report>(`/api/transfers/${job}`);
        setReport(progress);
        if (
          progress.error ||
          !["pending", "processing"].includes(progress.status)
        )
          break;
        await new Promise((resolve) => setTimeout(resolve, 350));
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
      setRunning(false);
    }
  }
  const selected = state.tracks.filter((t) => t.selected).length;
  const excluded = state.tracks.filter(
    (t) => !t.selected && t.explicit === true && !state.includeExplicit,
  ).length;
  const done =
    report && ["completed", "partial", "failed"].includes(report.status);
  const progress = report
    ? Math.round(
        (report.tracks.filter(
          (t) =>
            !["pending", "ready", "ready_clean", "adding"].includes(t.result),
        ).length /
          Math.max(report.total, 1)) *
          100,
      )
    : 0;
  function connectionCard(role: "source" | "destination") {
    const platform = role === "source" ? state.source : state.destination,
      account = connected(role);
    return (
      <div className="connect-stage">
        <PlatformIcon id={platform} size="large" />
        <h3>
          {account
            ? `Connected as ${account.displayName}`
            : `Connect to ${platformLabel(platform)}`}
        </h3>
        <p>
          {role === "source"
            ? "Read access lets us list your playlists and their songs. We do not change your source library."
            : "We use your permission to create a new playlist and add your matched songs to your destination library."}
        </p>
        {platform === "youtube" && (
          <p>
            {role === "destination"
              ? "Google’s YouTube write scope also covers viewing, editing and deleting videos, ratings, comments and captions. We use it only for the requested playlist transfer."
              : "Google will request read-only YouTube access."}{" "}
            {youtubeTesting
              ? "Google test-account restrictions apply."
              : "Google may show an unverified-app warning and user limits until its review is complete."}
          </p>
        )}
        {["apple", "soundcloud"].includes(platform) && (
          <p>
            This provider grants broader library access rather than separate
            read/write permissions. Review the official consent screen.
          </p>
        )}
        {account ? (
          <>
            <span className="connected-badge">
              <CheckCircle2 size={14} /> Connected
            </span>
            {account.avatar && (
              <Image
                unoptimized
                src={account.avatar}
                width={40}
                height={40}
                alt={`${account.displayName} profile`}
                style={{ borderRadius: "50%" }}
              />
            )}
            <button
              className="text-button"
              disabled={busy}
              onClick={() =>
                action(async () => {
                  if (platform === "apple") await disconnectMusicKit();
                  await request(
                    `/api/platforms/${platform}/disconnect`,
                    "POST",
                    {},
                  );
                  await refresh();
                })
              }
            >
              Disconnect
            </button>
          </>
        ) : (
          <Button
            disabled={busy || !available[platform]}
            onClick={() => connect(role)}
          >
            Connect to {platformLabel(platform)} <ExternalLink size={15} />
          </Button>
        )}
        <small>
          Official provider authorization only. We never collect your
          music-service password. Tokens are encrypted, tied to your app
          session, and refreshed where supported. Expired MusicKit/Deezer
          authorization requires reconnecting.
        </small>
      </div>
    );
  }
  return (
    <>
      <div className="page-heading">
        <div className="eyebrow">YOUR MUSIC. NO BOUNDARIES.</div>
        <h1>
          Give your playlists a new home<span>.</span>
        </h1>
        <p>
          Choose a source. Connect a destination. Save directly to your library.
        </p>
      </div>
      <div className="converter-layout">
        <div>
          <nav className="wizard-steps" aria-label="Conversion progress">
            {steps.map((label, i) => (
              <div
                key={label}
                className={
                  i === state.step ? "active" : i < state.step ? "done" : ""
                }
                aria-current={i === state.step ? "step" : undefined}
              >
                <span>{i < state.step ? <Check size={15} /> : i + 1}</span>
                {label}
              </div>
            ))}
          </nav>
          <section className="content-card wizard-card" aria-busy={busy}>
            <div className="eyebrow">STEP {state.step + 1} OF 4</div>
            <h2>
              {
                [
                  "Choose your source platform",
                  "Choose how to provide your playlist",
                  "Choose destination and connect",
                  done
                    ? "Your transfer results"
                    : "Convert and save to your library",
                ][state.step]
              }
            </h2>
            {!ready && <p>Loading your saved selections…</p>}
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            {ready && !verified && (
              <div className="connection-notice">
                <ShieldCheck size={20} />
                <p>
                  Verify your email before connecting accounts or converting
                  playlists.
                </p>
                <Button
                  disabled={busy}
                  onClick={() =>
                    action(async () => {
                      await request("/api/auth/resend", "POST", {});
                      setError(
                        "Verification email sent. Follow the link, then refresh this page.",
                      );
                    })
                  }
                >
                  Resend verification email
                </Button>
              </div>
            )}
            {ready && verified && (
              <>
                {state.step === 0 && (
                  <>
                    <p>Select the service holding your original playlist.</p>
                    <div
                      className="platform-grid"
                      role="group"
                      aria-label="Source platform"
                    >
                      {platforms.map((p) => (
                        <button
                          key={p.id}
                          className={`platform-card ${state.source === p.id ? "selected" : ""}`}
                          aria-pressed={state.source === p.id}
                          disabled={
                            busy || (!available[p.id] && !publicAvailable[p.id])
                          }
                          onClick={() => {
                            setState({
                              ...initial,
                              source: p.id,
                              inputMode: available[p.id] ? "account" : "url",
                              destination:
                                state.destination === p.id
                                  ? ""
                                  : state.destination,
                            });
                            setPlaylists([]);
                            setMatches({});
                            setReport(null);
                            setTransferId("");
                          }}
                        >
                          <PlatformIcon id={p.id} />
                          <b>{p.name}</b>
                          <small>
                            {available[p.id]
                              ? "Account or playlist link"
                              : publicAvailable[p.id]
                                ? "Public playlist links"
                                : "Not configured"}
                          </small>
                        </button>
                      ))}
                    </div>
                    <p>
                      Amazon Music and Pandora have no supported official
                      integration here and are unavailable. Disabled services
                      need approved app credentials.
                    </p>
                  </>
                )}
                {state.step === 1 && (
                  <>
                    <div
                      className="feature-grid"
                      role="group"
                      aria-label="Playlist input method"
                    >
                      <button
                        className={`platform-card ${state.inputMode === "account" ? "selected" : ""}`}
                        disabled={busy || !available[state.source]}
                        onClick={() =>
                          setState({ ...state, inputMode: "account" })
                        }
                      >
                        <Music2 size={22} />
                        <b>
                          Load from my {platformLabel(state.source)} account
                        </b>
                        <small>
                          Sign in on the official provider page, then pick a
                          playlist.
                        </small>
                      </button>
                      <button
                        className={`platform-card ${state.inputMode === "url" ? "selected" : ""}`}
                        disabled={busy}
                        onClick={() => setState({ ...state, inputMode: "url" })}
                      >
                        <ExternalLink size={22} />
                        <b>Paste playlist URL</b>
                        <small>
                          Public playlist access uses the provider’s official
                          API.
                        </small>
                      </button>
                    </div>
                    {state.inputMode === "account" ? (
                      <>
                        {connectionCard("source")}
                        {connected("source") && (
                          <>
                            <Button disabled={busy} onClick={loadPlaylists}>
                              Load my playlists
                            </Button>
                            <div className="playlist-grid">
                              {playlists.map((p) => (
                                <button
                                  className={`playlist-choice ${state.playlistId === p.id ? "selected" : ""}`}
                                  key={p.id}
                                  disabled={busy}
                                  onClick={() => loadPlaylist(p.id)}
                                >
                                  <b>{p.name}</b>
                                  <small>{p.count || ""} tracks</small>
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </>
                    ) : (
                      <div className="field">
                        <label htmlFor="playlist-url">
                          {platformLabel(state.source)} playlist URL
                        </label>
                        <input
                          id="playlist-url"
                          type="url"
                          placeholder="https://…"
                          value={state.playlistUrl}
                          onChange={(e) =>
                            setState({ ...state, playlistUrl: e.target.value })
                          }
                        />
                        <Button
                          disabled={busy || !state.playlistUrl}
                          onClick={() => loadPlaylist()}
                        >
                          Load playlist
                        </Button>
                        {!publicAvailable[state.source] && (
                          <p>
                            Anonymous public-link reads are not configured or
                            supported for this provider. Use the account option
                            to authorize access. Private playlists always
                            require authorization.
                          </p>
                        )}
                      </div>
                    )}
                    {!!state.tracks.length && (
                      <div className="connection-notice">
                        <CheckCircle2 size={20} />
                        <p>
                          <b>{state.sourcePlaylistName}</b> ·{" "}
                          {state.tracks.length} tracks loaded. Your selection is
                          saved when you continue.
                        </p>
                      </div>
                    )}
                  </>
                )}
                {state.step === 2 && (
                  <>
                    <p>
                      Choose a different music service for the new playlist.
                      Only configured direct destinations can be connected.
                    </p>
                    <div
                      className="platform-grid"
                      role="group"
                      aria-label="Destination platform"
                    >
                      {platforms
                        .filter((p) => p.id !== state.source)
                        .map((p) => (
                          <button
                            key={p.id}
                            className={`platform-card ${state.destination === p.id ? "selected" : ""}`}
                            aria-pressed={state.destination === p.id}
                            disabled={busy || !available[p.id]}
                            onClick={() => {
                              setState({ ...state, destination: p.id });
                              setMatches({});
                            }}
                          >
                            <PlatformIcon id={p.id} />
                            <b>{p.name}</b>
                            <small>
                              {available[p.id]
                                ? "Save to your account"
                                : "Not configured"}
                            </small>
                          </button>
                        ))}
                    </div>
                    {!platforms.some(
                      (p) => p.id !== state.source && available[p.id],
                    ) && (
                      <p role="status">
                        No different destination is configured yet. The operator
                        must add approved provider credentials before this
                        source can be converted.
                      </p>
                    )}
                    {state.destination && connectionCard("destination")}
                  </>
                )}
                {state.step === 3 && (
                  <>
                    <p>
                      {platformLabel(state.source)} →{" "}
                      {platformLabel(state.destination)} ·{" "}
                      {state.sourcePlaylistName}
                    </p>
                    {!report && (
                      <>
                        <label className="field-label" htmlFor="playlist-name">
                          New playlist name
                        </label>
                        <input
                          id="playlist-name"
                          value={state.playlistName}
                          maxLength={200}
                          onChange={(e) =>
                            setState({ ...state, playlistName: e.target.value })
                          }
                        />
                        <div className="explicit-control">
                          <div>
                            <b>Include explicit songs</b>
                            <p>Your playlist, your choice.</p>
                          </div>
                          <button
                            type="button"
                            className={`toggle ${state.includeExplicit ? "on" : ""}`}
                            role="switch"
                            aria-checked={state.includeExplicit}
                            aria-label="Include explicit songs"
                            onClick={() => explicit(!state.includeExplicit)}
                          >
                            <span />
                          </button>
                        </div>
                        {!state.includeExplicit && (
                          <div className="transport-options">
                            <label>
                              <input
                                type="radio"
                                name="clean"
                                checked={state.cleanMode === "skip"}
                                onChange={() =>
                                  setState({ ...state, cleanMode: "skip" })
                                }
                              />{" "}
                              Skip explicit tracks
                            </label>
                            <label>
                              <input
                                type="radio"
                                name="clean"
                                checked={state.cleanMode === "replace"}
                                onChange={() =>
                                  setState({ ...state, cleanMode: "replace" })
                                }
                              />{" "}
                              Replace with clean version if available
                            </label>
                          </div>
                        )}
                        <p aria-live="polite">
                          {selected} of {state.tracks.length} tracks selected (
                          {excluded} explicit excluded)
                        </p>
                        <div
                          className="track-list"
                          style={{ maxHeight: 420, overflowY: "auto" }}
                        >
                          {state.tracks.map((t, i) => (
                            <label key={`${t.id}-${i}`} className="track-row">
                              <input
                                type="checkbox"
                                checked={t.selected}
                                onChange={(e) => {
                                  setState({
                                    ...state,
                                    tracks: state.tracks.map((x, n) =>
                                      n === i
                                        ? { ...x, selected: e.target.checked }
                                        : x,
                                    ),
                                  });
                                  setMatches({});
                                }}
                              />
                              <span>{i + 1}</span>
                              <span>
                                <b>{t.title}</b>
                                <small>
                                  {t.artist}
                                  {t.album ? ` · ${t.album}` : ""}
                                </small>
                              </span>
                              <small>
                                {t.explicit === true
                                  ? "Explicit"
                                  : t.explicit === null
                                    ? "Rating unknown"
                                    : "Clean"}
                              </small>
                              {matches[t.id] && (
                                <small>
                                  {matches[t.id].confidence === null
                                    ? "Not found"
                                    : `${Math.round(matches[t.id].confidence! * 100)}% · ${matches[t.id].result}`}
                                </small>
                              )}
                            </label>
                          ))}
                        </div>
                        <p>
                          Unknown ratings are not treated as clean. YouTube does
                          not expose a reliable explicit-content flag. Review
                          low-confidence matches before saving.
                        </p>
                        <Button disabled={busy} onClick={preview}>
                          Preview matches
                        </Button>
                        <Button
                          disabled={
                            busy ||
                            !state.playlistName.trim() ||
                            (!selected && state.cleanMode !== "replace")
                          }
                          onClick={() => run()}
                        >
                          Convert and save to {platformLabel(state.destination)}{" "}
                          <ArrowRight size={15} />
                        </Button>
                      </>
                    )}
                    {report && (
                      <>
                        <div
                          role="progressbar"
                          aria-label="Transfer progress"
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={progress}
                          style={{
                            height: 10,
                            background: "var(--border)",
                            borderRadius: 10,
                            margin: "24px 0",
                          }}
                        >
                          <div
                            style={{
                              width: `${progress}%`,
                              height: "100%",
                              background: "var(--accent)",
                              borderRadius: 10,
                            }}
                          />
                        </div>
                        <p aria-live="polite">
                          {running
                            ? "Matching and saving your songs…"
                            : report.status}{" "}
                          · {report.matched} of {report.total} tracks
                          transferred
                        </p>
                        <div className="result-counts">
                          <div>
                            <b>{report.matched}</b>
                            <span>Transferred</span>
                          </div>
                          <div>
                            <b>{report.notFound}</b>
                            <span>Not found</span>
                          </div>
                          <div>
                            <b>{report.excluded}</b>
                            <span>Explicit excluded</span>
                          </div>
                        </div>
                        {report.error && <p role="alert">{report.error}</p>}
                        {report.destinationUrl && (
                          <a
                            className="button primary"
                            target="_blank"
                            rel="noreferrer"
                            href={report.destinationUrl}
                          >
                            Open new playlist <ExternalLink size={15} />
                          </a>
                        )}
                        {!!report.notFound && (
                          <>
                            <h3>Tracks we could not match</h3>
                            <ul>
                              {report.tracks
                                .filter((t) => t.result === "not_found")
                                .map((t) => (
                                  <li key={t.id}>
                                    {t.title} — {t.artist}
                                  </li>
                                ))}
                            </ul>
                          </>
                        )}
                        {!running &&
                          ["pending", "processing"].includes(report.status) && (
                            <>
                              <Button
                                disabled={busy}
                                onClick={() => connect("destination")}
                              >
                                Reconnect destination
                              </Button>
                              <Button
                                disabled={busy}
                                onClick={() => run(report.id)}
                              >
                                Resume transfer
                              </Button>
                            </>
                          )}
                        {!running && (
                          <Button
                            onClick={() =>
                              action(async () => {
                                setReport(null);
                                setTransferId("");
                                setMatches({});
                                await save(initial);
                              })
                            }
                          >
                            Convert another playlist
                          </Button>
                        )}
                      </>
                    )}
                  </>
                )}
                <div className="wizard-footer">
                  <span>
                    <LockKeyhole size={14} /> Official connections. Your
                    passwords stay with the provider.
                  </span>
                  <div>
                    {state.step > 0 && (
                      <Button
                        disabled={busy || !!report}
                        onClick={() =>
                          action(() => save({ ...state, step: state.step - 1 }))
                        }
                      >
                        <ArrowLeft size={14} /> Back
                      </Button>
                    )}
                    {state.step < 3 && (
                      <Button
                        disabled={
                          busy ||
                          (state.step === 0 && !state.source) ||
                          (state.step === 1 && !state.tracks.length) ||
                          (state.step === 2 &&
                            (!state.destination || !connected("destination")))
                        }
                        onClick={() =>
                          action(() => save({ ...state, step: state.step + 1 }))
                        }
                      >
                        Continue <ArrowRight size={15} />
                      </Button>
                    )}
                  </div>
                </div>
                {busy && (
                  <p role="status">
                    <LoaderCircle size={16} className="spin" />{" "}
                    {running ? "Transfer in progress" : "Working…"}
                  </p>
                )}
              </>
            )}
          </section>
        </div>
        <aside className="converter-aside">
          <div className="content-card">
            <div className="eyebrow">THE NEXT CHAPTER</div>
            <h3>
              Same music.
              <br />
              New possibilities.
            </h3>
            <div className="connection-notice">
              <PlatformIcon id={state.source || "spotify"} />
              <ArrowRight size={18} />
              <PlatformIcon id={state.destination || "youtube"} />
            </div>
            <p>
              Every completed transfer creates a playlist in your connected
              destination account.
            </p>
            <p>Your original playlist stays unchanged.</p>
            <small>
              Rollback and hotfix for first release · direct library transfers
            </small>
          </div>
        </aside>
      </div>
    </>
  );
}
