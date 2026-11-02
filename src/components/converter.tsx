"use client";
import { authorizeMusicKit, disconnectMusicKit } from "@/lib/musickit-client";
import { useState, useEffect, useCallback } from "react";
import Image from "next/image";

import {
  ArrowRight,
  ArrowLeft,
  ArrowLeftRight,
  ShieldCheck,
  LockKeyhole,
  Check,
  Link2,
  Upload,
  Music2,
  Info,
  ChevronRight,
  Search,
  Download,
  ExternalLink,
  LoaderCircle,
  CheckCircle2,
} from "lucide-react";
import {
  platforms as allPlatforms,
  PlatformIcon,
  platformLabel,
} from "./platforms";
import { Button } from "./ui/button";
import { request, errorMessage } from "@/lib/client";
import type { Track, Playlist } from "@/lib/platforms/types";
import { explicitSelection } from "@/lib/matching";
import { importCsv } from "@/lib/csv";
type PreviewMatch = {
  confidence: number | null;
  title: string;
  artist: string;
  result: string;
};
type State = {
  step: number;
  source: string;
  sourceTransport?: "direct" | "csv";
  destinationTransport?: "direct" | "csv";
  destination: string;
  playlistId?: string;
  playlistName: string;
  sourcePlaylistName?: string;
  includeExplicit: boolean;
  cleanMode: "skip" | "replace";
  tracks: Track[];
};
type Connection = {
  platform: string;
  role: string;
  displayName: string;
  avatar?: string;
};
const initial: State = {
  step: 0,
  source: "spotify",
  sourceTransport: "direct",
  destinationTransport: "direct",
  destination: "youtube",
  playlistName: "My playlist",
  includeExplicit: true,
  cleanMode: "skip",
  tracks: [],
};
const steps = [
  "Platforms",
  "Source",
  "Playlist",
  "Review",
  "Destination",
  "Transfer",
  "Results",
];
export function Converter() {
  const [youtubeTesting, setYoutubeTesting] = useState(false);
  const [availability, setAvailability] = useState<Record<string, boolean>>({});
  const platforms = allPlatforms.map((p) => ({
    ...p,
    mode: availability[p.id] ? p.mode : "CSV",
  }));
  const [s, setS] = useState<State>(initial),
    [ready, setReady] = useState(false),
    [connections, setConnections] = useState<Connection[]>([]),
    [verified, setVerified] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [playlists, setPlaylists] = useState<Playlist[]>([]),
    [url, setUrl] = useState(""),
    [search, setSearch] = useState(""),
    [transferId, setTransferId] = useState(""),
    [report, setReport] = useState<{
      status: string;
      total: number;
      matched: number;
      notFound: number;
      excluded: number;
      cleanReplaced: number;
      destinationUrl?: string;
      error?: string;
      tracks: {
        result: string;
        title: string;
        artist: string;
        confidence: number | null;
      }[];
    } | null>(null);
  useEffect(() => {
    request<{
      state: State | null;
      connections: Connection[];
      verified: boolean;
      availability: Record<string, boolean>;
      youtubeTesting: boolean;
    }>("/api/wizard")
      .then((d) => {
        setAvailability(d.availability);
        setYoutubeTesting(d.youtubeTesting);
        const restored = d.state || initial;
        setS({
          ...restored,
          step: restored.step === 5 ? 4 : restored.step,
          sourceTransport: d.availability[restored.source]
            ? restored.sourceTransport
            : "csv",
          destinationTransport: d.availability[restored.destination]
            ? restored.destinationTransport
            : "csv",
        });
        setConnections(d.connections);
        setVerified(d.verified);
        const connectionResult = new URLSearchParams(
          window.location.search,
        ).get("connection");
        if (connectionResult)
          setError(
            connectionResult === "denied"
              ? "Connection was cancelled. You can try again or choose CSV transport."
              : "Connection failed or expired. Please reconnect your platform.",
          );
        setReady(true);
      })
      .catch((e) => setError(e.message));
  }, []);
  const save = useCallback(async (value: State) => {
    await request("/api/wizard", "PUT", value);
  }, []);
  async function next(step: number) {
    setError("");
    setBusy(true);
    try {
      const n = { ...s, step };
      await save(n);
      setS(n);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  const src = {
      ...platforms.find((p) => p.id === s.source)!,
      ...(s.sourceTransport === "csv" ? { mode: "CSV" } : {}),
    },
    dst = {
      ...platforms.find((p) => p.id === s.destination)!,
      ...(s.destinationTransport === "csv" ? { mode: "CSV" } : {}),
    };
  const connection = (role: string) =>
    connections.find(
      (c) =>
        c.role === role &&
        c.platform === (role === "source" ? s.source : s.destination),
    );
  async function connect(role: "source" | "destination") {
    setBusy(true);
    try {
      await save(s);
      const platform = role === "source" ? s.source : s.destination;
      if (platform === "apple") {
        const config = await request<{ developerToken: string }>(
          "/api/musickit",
        );
        const token = await authorizeMusicKit(config.developerToken);
        await request("/api/musickit", "POST", { token, role });
        const data = await request<{ connections: Connection[] }>(
          "/api/wizard",
        );
        setConnections(data.connections);
        setBusy(false);
      } else {
        const { url } = await request<{ url: string }>(
          `/api/platforms/${platform}/connect`,
          "POST",
          { role },
        );
        window.location.assign(url);
      }
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }
  async function loadPlaylists() {
    setBusy(true);
    setError("");
    try {
      setPlaylists(
        await request<Playlist[]>(`/api/platforms/${s.source}/playlists`),
      );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function pick(id: string) {
    setBusy(true);
    setError("");
    try {
      const p = await request<{ name: string; tracks: Track[] }>(
        `/api/platforms/${s.source}/playlist?id=${encodeURIComponent(id)}`,
      );
      const n = {
        ...s,
        step: 3,
        playlistId: id,
        playlistName: p.name,
        sourcePlaylistName: p.name,
        tracks: p.tracks,
      };
      await save(n);
      setS(n);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  const [matches, setMatches] = useState<Record<number, PreviewMatch>>({});
  async function previewMatches() {
    setBusy(true);
    setError("");
    setMatches({});
    try {
      for (let i = 0; i < s.tracks.length; i++) {
        const track = s.tracks[i];
        const clean =
          !s.includeExplicit &&
          track.explicit === true &&
          !track.selected &&
          s.cleanMode === "replace";
        if (!track.selected && !clean) continue;
        const result = await request<PreviewMatch>("/api/matches", "POST", {
          destination: s.destination,
          track,
          clean,
        });
        setMatches((current) => ({ ...current, [i]: result }));
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function start() {
    setBusy(true);
    setError("");
    try {
      await save(s);
      const d = await request<{ id: string }>("/api/convert", "POST", s);
      setTransferId(d.id);
      setS({ ...s, step: 5 });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (s.step !== 5 || !transferId) return;
    let cancelled = false;
    async function run() {
      try {
        await request(`/api/transfers/${transferId}/tick`, "POST", {});
        const r = await request<NonNullable<typeof report>>(
          `/api/transfers/${transferId}`,
        );
        if (cancelled) return;
        setReport(r);
        if (["completed", "partial", "failed"].includes(r.status)) {
          setS((v) => ({ ...v, step: 6 }));
          return;
        }
        timer = setTimeout(run, 350);
      } catch (e) {
        if (!cancelled) setError(errorMessage(e));
      }
    }
    let timer: ReturnType<typeof setTimeout>;
    run();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [s.step, transferId]);
  const selected = s.tracks.filter((t) => t.selected).length,
    excluded = s.tracks.filter((t) => t.explicit && !t.selected).length;
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <span /> YOUR MUSIC. NO BOUNDARIES.
          </div>
          <h1>
            Give your playlists a new home<span>.</span>
          </h1>
          <p>Different platform. Same soundtrack. Bring your music along.</p>
        </div>
        <span className="phase-pill">
          <span /> Free for everyone
        </span>
      </div>
      <div className="wizard-layout">
        <div className="wizard-main">
          <div className="stepper" aria-label="Conversion progress">
            {steps.map((label, i) => (
              <div
                key={label}
                aria-current={i === s.step ? "step" : undefined}
                className={
                  "step " +
                  (i === s.step ? "current" : i < s.step ? "done" : "")
                }
              >
                <span>{i < s.step ? <Check size={13} /> : i + 1}</span>
                <small>{label}</small>
                {i < 6 && <div className="step-line" />}
              </div>
            ))}
          </div>
          <section className="converter-panel">
            <div className="panel-heading">
              <div>
                <span className="overline">
                  STEP {String(s.step + 1).padStart(2, "0")} OF 07
                </span>
                <h2>
                  {
                    [
                      "Where is your music going?",
                      "Connect your source account",
                      "Pick your playlist",
                      "Make it your mix",
                      "Connect your destination",
                      "A new home for your music",
                      "Your transfer report",
                    ][s.step]
                  }
                </h2>
                <p>
                  {
                    [
                      "Choose the platform you’re leaving and the one you’re heading to.",
                      "You’ll sign in securely on the platform’s own website.",
                      "Choose from your library, paste a link, or upload a CSV.",
                      "Check the tracks you want to take with you.",
                      dst.mode === "CSV"
                        ? "Export the selected tracks as a CSV file."
                        : dst.id === "tidal"
                          ? "Grant permission to create an unlisted playlist."
                          : dst.id === "deezer"
                            ? "Grant permission to create a playlist with Deezer’s default visibility."
                            : "Grant permission to create a playlist in your destination account.",
                      "Keep this page open. Your progress is saved after every track.",
                      "Every track accounted for. Download your results below.",
                    ][s.step]
                  }
                </p>
              </div>
              <span className="panel-icon">
                <ArrowLeftRight size={21} />
              </span>
            </div>
            {error && (
              <div role="alert" className="error-box">
                {error}
              </div>
            )}
            {s.step === 0 && (
              <>
                <div className="platform-selectors">
                  <div>
                    <label className="field-label">
                      <span className="direction-label">FROM</span> Source
                      platform
                    </label>
                    <div
                      className="platform-grid"
                      role="group"
                      aria-label="Source platform"
                    >
                      {platforms.map((p) => (
                        <button
                          key={p.id}
                          onClick={() =>
                            setS({
                              ...s,
                              source: p.id,
                              sourceTransport: availability[p.id]
                                ? "direct"
                                : "csv",
                              tracks: [],
                              playlistId: undefined,
                              sourcePlaylistName: undefined,
                              playlistName: "My playlist",
                            })
                          }
                          className={
                            "platform-card " +
                            (s.source === p.id ? "selected" : "")
                          }
                          aria-pressed={s.source === p.id}
                        >
                          <PlatformIcon id={p.id} />
                          <b>{p.name}</b>
                          <small>
                            {p.mode !== "CSV"
                              ? "Direct transfer"
                              : "CSV import"}
                          </small>
                          {s.source === p.id && (
                            <span className="selection-check">
                              <Check size={11} />
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button
                    className="swap-button"
                    aria-label="Swap source and destination"
                    onClick={() =>
                      setS({
                        ...s,
                        source: s.destination,
                        destination: s.source,
                        sourceTransport: s.destinationTransport,
                        destinationTransport: s.sourceTransport,
                        tracks: [],
                        playlistId: undefined,
                        sourcePlaylistName: undefined,
                        playlistName: "My playlist",
                      })
                    }
                  >
                    <ArrowLeftRight size={17} />
                  </button>
                  <div>
                    <label className="field-label">
                      <span className="direction-label to">TO</span> Destination
                      platform
                    </label>
                    <div
                      className="platform-grid"
                      role="group"
                      aria-label="Destination platform"
                    >
                      {platforms.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => {
                            setMatches({});
                            setS({
                              ...s,
                              destination: p.id,
                              destinationTransport: availability[p.id]
                                ? "direct"
                                : "csv",
                            });
                          }}
                          className={
                            "platform-card " +
                            (s.destination === p.id ? "selected" : "")
                          }
                          aria-pressed={s.destination === p.id}
                        >
                          <PlatformIcon id={p.id} />
                          <b>{p.name}</b>
                          <small>
                            {p.mode !== "CSV"
                              ? "Direct transfer"
                              : "CSV export"}
                          </small>
                          {s.destination === p.id && (
                            <span className="selection-check">
                              <Check size={11} />
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="transport-options">
                  <label>
                    <input
                      type="checkbox"
                      checked={s.sourceTransport === "csv"}
                      disabled={!availability[s.source]}
                      onChange={(e) =>
                        setS({
                          ...s,
                          sourceTransport: e.target.checked ? "csv" : "direct",
                        })
                      }
                    />{" "}
                    Import source from CSV
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={s.destinationTransport === "csv"}
                      disabled={!availability[s.destination]}
                      onChange={(e) =>
                        setS({
                          ...s,
                          destinationTransport: e.target.checked
                            ? "csv"
                            : "direct",
                        })
                      }
                    />{" "}
                    Export destination as CSV
                  </label>
                </div>
                <div className="connection-notice">
                  <LockKeyhole size={17} />
                  <p>
                    <b>Your passwords stay yours.</b> You’ll connect securely
                    through each platform. We never see your streaming
                    passwords.
                  </p>
                </div>
              </>
            )}
            {(s.step === 1 || s.step === 4) &&
              (() => {
                const role = s.step === 1 ? "source" : "destination",
                  p = role === "source" ? src : dst,
                  c = connection(role);
                return (
                  <div className="connect-stage">
                    <PlatformIcon id={p.id} size="large" />
                    <h3>
                      {c
                        ? `Connected to ${p.name}`
                        : p.mode === "CSV"
                          ? `${p.name} · CSV ${role === "source" ? "import" : "export"}`
                          : `Connect ${p.name}`}
                    </h3>
                    <p>
                      {c
                        ? c.displayName
                        : p.mode === "CSV"
                          ? "CSV transport copies playlist metadata through a file. It does not connect to the platform or create a remote playlist."
                          : role === "source"
                            ? "We need to list your playlists and their tracks. SoundCloud and MusicKit do not offer a separate read-only scope; review their broader consent permissions. We will not change your source library."
                            : p.id === "youtube"
                              ? "Google’s required YouTube write permission includes viewing, editing, and deleting videos, ratings, comments, and captions. This converter uses it to create a private playlist and add your selected tracks. Review Google’s permission screen before approving."
                              : "Write access lets us create a playlist and add your selected tracks. TIDAL playlists are unlisted, Deezer uses provider defaults. SoundCloud and MusicKit can require broader permissions; review provider consent."}
                    </p>
                    {c ? (
                      <>
                        {c.avatar && (
                          <Image
                            unoptimized
                            src={c.avatar}
                            alt={`${c.displayName} profile`}
                            width={40}
                            height={40}
                            style={{ borderRadius: "50%" }}
                          />
                        )}
                        <span className="connected-badge">
                          <CheckCircle2 size={14} /> Connected
                        </span>
                        <button
                          className="text-button"
                          onClick={async () => {
                            try {
                              if (p.id === "apple") await disconnectMusicKit();
                              const r = await request<{ message: string }>(
                                `/api/platforms/${p.id}/disconnect`,
                                "POST",
                                {},
                              );
                              setConnections(
                                connections.filter((x) => x.platform !== p.id),
                              );
                              setError(r.message);
                            } catch (e) {
                              setError(errorMessage(e));
                            }
                          }}
                        >
                          Disconnect
                        </button>
                      </>
                    ) : (
                      p.mode !== "CSV" && (
                        <Button disabled={busy} onClick={() => connect(role)}>
                          Connect securely <ExternalLink size={15} />
                        </Button>
                      )
                    )}
                    <small>
                      {p.id === "youtube" &&
                        p.mode !== "CSV" &&
                        youtubeTesting && (
                          <span
                            role="note"
                            style={{ display: "block", marginBottom: 12 }}
                          >
                            Google connection is currently in testing and only
                            works for approved Google test accounts. App
                            registration is open to everyone; CSV import/export
                            is available without Google access.
                          </span>
                        )}
                      {p.id === "youtube" &&
                        p.mode !== "CSV" &&
                        !youtubeTesting && (
                          <span
                            role="note"
                            style={{ display: "block", marginBottom: 12 }}
                          >
                            Google may show an unverified-app notice while
                            sensitive permissions await approval. A provider
                            user cap can apply. Review Google’s consent screen
                            before continuing.
                          </span>
                        )}
                      {p.mode !== "CSV"
                        ? "Tokens are encrypted and tied to your app session."
                        : "CSV files contain track metadata only. No platform credentials needed."}
                    </small>
                  </div>
                );
              })()}
            {s.step === 4 &&
              dst.mode !== "CSV" &&
              connection("destination") && (
                <div className="match-preview">
                  <div className="track-tools">
                    <span>Review destination matches before transferring</span>
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={previewMatches}
                    >
                      {busy ? "Matching…" : "Preview matches"}
                    </Button>
                  </div>
                  <div className="track-list">
                    {Object.entries(matches).map(([position, m]) => {
                      const i = Number(position),
                        t = s.tracks[i];
                      return (
                        <label className="track-row" key={position}>
                          <input
                            aria-label={`Include ${t.title}`}
                            type="checkbox"
                            checked={t.selected}
                            onChange={(e) =>
                              setS({
                                ...s,
                                tracks: s.tracks.map((t, j) =>
                                  j === i
                                    ? { ...t, selected: e.target.checked }
                                    : t,
                                ),
                              })
                            }
                          />
                          <span className="track-name">
                            <b>{t.title}</b>
                            <small>
                              {m.title
                                ? `${m.title} · ${m.artist}`
                                : "No suitable match"}
                            </small>
                          </span>
                          <span
                            className={
                              m.result === "Review match"
                                ? "warning-text"
                                : "track-duration"
                            }
                          >
                            {m.confidence !== null
                              ? Math.round(m.confidence * 100) + "% · "
                              : ""}
                            {m.result}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  <p className="muted-note">
                    Uncheck a match to leave it behind. Catalog matches are
                    checked again during transfer.
                  </p>
                </div>
              )}
            {s.step === 2 && (
              <div className="playlist-stage">
                {src.mode !== "CSV" && (
                  <>
                    <Button
                      variant="outline"
                      onClick={loadPlaylists}
                      disabled={busy || !connection("source")}
                    >
                      <Music2 size={16} /> Load my playlists
                    </Button>
                    <div className="playlist-list">
                      {playlists.map((p) => (
                        <button key={p.id} onClick={() => pick(p.id)}>
                          <span className="playlist-art">
                            <Music2 />
                          </span>
                          <span>
                            <b>{p.name}</b>
                            <small>{p.count} tracks</small>
                          </span>
                          <ChevronRight size={17} />
                        </button>
                      ))}
                    </div>
                    <div className="input-row">
                      <Link2 size={17} />
                      <input
                        aria-label="Public playlist URL"
                        placeholder="Paste a public playlist URL"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                      />
                      <Button
                        variant="outline"
                        disabled={!url || busy}
                        onClick={() => pick(url)}
                      >
                        Import
                      </Button>
                    </div>
                    <div className="divider">or import a CSV</div>
                  </>
                )}
                <label className="upload-area">
                  <Upload size={26} />
                  <b>Drop your playlist into a new world</b>
                  <span>Choose a CSV · up to 1,000 tracks</span>
                  <small>
                    Columns: title, artist, duration (ms), isrc, explicit
                  </small>
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    aria-label="Import playlist CSV"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        if (file.size > 1000000)
                          throw new Error("CSV must be under 1 MB");
                        const tracks = importCsv(await file.text());
                        if (!tracks.length)
                          throw new Error("CSV has no tracks");
                        const n = {
                          ...s,
                          step: 3,
                          playlistName: file.name.replace(/\.csv$/i, ""),
                          sourcePlaylistName: file.name.replace(/\.csv$/i, ""),
                          tracks,
                        };
                        await save(n);
                        setS(n);
                      } catch (e) {
                        setError(errorMessage(e));
                      }
                    }}
                  />
                </label>
              </div>
            )}
            {s.step === 3 && (
              <>
                <label className="name-field">
                  Playlist name
                  <input
                    maxLength={200}
                    value={s.playlistName}
                    onChange={(e) =>
                      setS({ ...s, playlistName: e.target.value })
                    }
                  />
                </label>
                <div className="explicit-card">
                  <div>
                    <span className="explicit-symbol">E</span>
                    <div>
                      <b>Include explicit songs</b>
                      <p>Your playlist, your choice.</p>
                    </div>
                  </div>
                  <button
                    role="switch"
                    aria-checked={s.includeExplicit}
                    aria-label="Include explicit songs"
                    className={"switch " + (s.includeExplicit ? "on" : "")}
                    onClick={() =>
                      setS({
                        ...s,
                        includeExplicit: !s.includeExplicit,
                        tracks: explicitSelection(
                          s.tracks,
                          !s.includeExplicit,
                          s.cleanMode,
                        ),
                      })
                    }
                  >
                    <span />
                  </button>
                </div>
                {!s.includeExplicit && (
                  <div className="radio-options">
                    {(["skip", "replace"] as const).map((mode) => (
                      <label key={mode}>
                        <input
                          type="radio"
                          checked={s.cleanMode === mode}
                          onChange={() => setS({ ...s, cleanMode: mode })}
                        />
                        {mode === "replace"
                          ? "Replace with clean version if available"
                          : "Skip explicit tracks"}
                      </label>
                    ))}
                  </div>
                )}
                <div className="track-tools">
                  <span>
                    <b>{selected}</b> of {s.tracks.length} tracks selected{" "}
                    <small>({excluded} explicit excluded)</small>
                  </span>
                  <div className="search-input">
                    <Search size={15} />
                    <input
                      placeholder="Find a track"
                      aria-label="Search tracks"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                </div>
                <div className="track-list">
                  {s.tracks
                    .map((t, i) => ({ ...t, index: i }))
                    .filter((t) =>
                      (t.title + " " + t.artist)
                        .toLowerCase()
                        .includes(search.toLowerCase()),
                    )
                    .map((t) => (
                      <label className="track-row" key={t.index}>
                        <input
                          type="checkbox"
                          checked={t.selected}
                          onChange={(e) =>
                            setS({
                              ...s,
                              tracks: s.tracks.map((x, i) =>
                                i === t.index
                                  ? { ...x, selected: e.target.checked }
                                  : x,
                              ),
                            })
                          }
                        />
                        <span className="track-number">{t.index + 1}</span>
                        <span className="track-name">
                          <b>
                            {t.title}{" "}
                            {t.explicit && (
                              <span className="explicit-tag">E</span>
                            )}
                          </b>
                          <small>{t.artist}</small>
                        </span>
                        <span className="track-duration">
                          {Math.floor(t.duration / 60000)}:
                          {String(Math.floor(t.duration / 1000) % 60).padStart(
                            2,
                            "0",
                          )}
                        </span>
                      </label>
                    ))}
                </div>
                <p className="muted-note">
                  Unknown explicit ratings are labeled by the provider as
                  unknown and are not automatically excluded. YouTube does not
                  expose a reliable explicit flag.
                </p>
              </>
            )}
            {(s.step === 5 || s.step === 6) && (
              <div className="result-stage">
                {s.step === 5 ? (
                  <LoaderCircle className="spin" size={40} />
                ) : (
                  <CheckCircle2 size={44} />
                )}
                <h3>
                  {s.step === 5
                    ? "Moving your soundtrack…"
                    : report?.status === "failed"
                      ? "Transfer needs attention"
                      : "Your music made the move."}
                </h3>
                <p>
                  {report?.error ||
                    `${platformLabel(s.source, s.sourceTransport)} → ${platformLabel(s.destination, s.destinationTransport)}`}
                </p>
                <div
                  className="progress-track"
                  role="progressbar"
                  aria-label="Transfer progress"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={
                    report
                      ? Math.round(
                          (100 *
                            report.tracks.filter(
                              (t) => !["pending", "adding"].includes(t.result),
                            ).length) /
                            report.total,
                        )
                      : 0
                  }
                >
                  <span
                    style={{
                      width: report
                        ? `${(100 * report.tracks.filter((t) => !["pending", "adding"].includes(t.result)).length) / report.total}%`
                        : "3%",
                    }}
                  />
                </div>
                <div className="result-counts">
                  <div>
                    <b>{report?.matched ?? 0}</b>
                    <span>{dst.mode === "CSV" ? "Exported" : "Matched"}</span>
                  </div>
                  <div>
                    <b>{report?.notFound ?? 0}</b>
                    <span>Not found</span>
                  </div>
                  <div>
                    <b>{report?.cleanReplaced ?? 0}</b>
                    <span>Clean versions</span>
                  </div>
                  <div>
                    <b>{report?.excluded ?? 0}</b>
                    <span>Excluded</span>
                  </div>
                </div>
                {s.step === 6 && (
                  <>
                    <div className="result-actions">
                      <a
                        className="button primary"
                        href={`/api/transfers/${transferId}?format=${dst.mode === "CSV" ? "playlist" : "csv"}`}
                      >
                        <Download size={15} />{" "}
                        {dst.mode === "CSV"
                          ? "Download playlist CSV"
                          : "Download CSV report"}
                      </a>
                      {report?.destinationUrl && (
                        <a
                          className="button secondary"
                          href={report.destinationUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open playlist <ExternalLink size={15} />
                        </a>
                      )}
                    </div>
                    <div className="report-rows">
                      {report?.tracks.map((t, i) => (
                        <div key={i}>
                          <span>
                            {t.title}
                            <small>{t.artist}</small>
                          </span>
                          <span
                            className={
                              t.result === "review" ? "warning-text" : ""
                            }
                          >
                            {t.result.replaceAll("_", " ")}
                            {t.confidence !== null &&
                              ` · ${Math.round(t.confidence * 100)}%`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
            <div className="panel-footer">
              <span className="footer-hint">
                <ShieldCheck size={15} /> Secure by design. Free by default.
              </span>
              <div>
                {s.step > 0 && s.step < 5 && (
                  <Button
                    variant="ghost"
                    onClick={() => next(s.step - 1)}
                    disabled={busy}
                  >
                    <ArrowLeft size={15} /> Back
                  </Button>
                )}
                {s.step < 5 && (
                  <Button
                    disabled={
                      !ready ||
                      busy ||
                      !verified ||
                      (s.step === 1 &&
                        src.mode !== "CSV" &&
                        !connection("source")) ||
                      (s.step === 2 && !s.tracks.length) ||
                      (s.step === 4 &&
                        dst.mode !== "CSV" &&
                        !connection("destination"))
                    }
                    onClick={() => (s.step === 4 ? start() : next(s.step + 1))}
                  >
                    {busy ? (
                      <LoaderCircle className="spin" size={15} />
                    ) : s.step === 4 ? (
                      "Start transfer"
                    ) : (
                      "Continue"
                    )}
                    <ArrowRight size={16} />
                  </Button>
                )}
                {s.step === 6 && (
                  <Button
                    onClick={() => {
                      setS(initial);
                      setReport(null);
                      setTransferId("");
                      save(initial).catch((e) => setError(e.message));
                    }}
                  >
                    Convert another <ArrowRight size={16} />
                  </Button>
                )}
              </div>
            </div>
          </section>
          <div className="below-panel">
            <LockKeyhole size={13} /> We store your account details and transfer
            history. Never your platform passwords.
          </div>
        </div>
        <aside className="wizard-aside">
          <div className="journey-card">
            <span className="overline">THE NEXT CHAPTER</span>
            <h3>
              Same music.
              <br />
              <span>New possibilities.</span>
            </h3>
            <div className="journey-visual">
              <span className="orbit orbit-one" />
              <span className="orbit orbit-two" />
              <div className="record">
                <div className="record-label">
                  <Music2 size={24} />
                </div>
              </div>
              <span className="floating-note note-one">♪</span>
              <span className="floating-note note-two">♫</span>
            </div>
            <div className="journey-route">
              <PlatformIcon id={s.source} />
              <div className="route-dots">
                ····
                <ArrowRight size={15} />
                ····
              </div>
              <PlatformIcon id={s.destination} />
            </div>
            <div className="journey-caption">
              {platformLabel(s.source, s.sourceTransport)}
              <ArrowRight size={12} />
              {platformLabel(s.destination, s.destinationTransport)}
            </div>
          </div>
          <div className="expect-card">
            <h4>A little peace of mind</h4>
            <div>
              <ShieldCheck />
              <span>
                <b>Official connections</b>
                <small>
                  Sign in on the platform itself.
                  <br />
                  Your credentials stay private.
                </small>
              </span>
            </div>
            <div>
              <Music2 />
              <span>
                <b>A smarter match</b>
                <small>
                  ISRC first. Title, artist, and
                  <br />
                  duration when it matters.
                </small>
              </span>
            </div>
            <div>
              <CheckCircle2 />
              <span>
                <b>You’re in control</b>
                <small>
                  Review every track and choose
                  <br />
                  what comes along.
                </small>
              </span>
            </div>
          </div>
          <div className="tip-card">
            <Info size={16} />
            <p>
              <b>A note on platform access</b>
              <br />
              Direct transfers depend on API approval. Platforms marked CSV use
              import/export.
            </p>
          </div>
        </aside>
      </div>
      <div className="bottom-features">
        <span>
          <ShieldCheck size={15} /> Encrypted connections
        </span>
        <span>
          <Music2 size={15} /> Your playlists stay yours
        </span>
        <span>
          <CheckCircle2 size={15} /> No subscription required
        </span>
      </div>
    </>
  );
}
