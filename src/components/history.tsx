"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  History as HistoryIcon,
  Trash2,
  RotateCcw,
  ExternalLink,
} from "lucide-react";
import { request } from "@/lib/client";
import { platforms, platformLabel } from "./platforms";
import { Button } from "./ui/button";
type Transfer = {
  id: string;
  sourceName: string;
  source: string;
  destination: string;
  destinationName: string;
  destinationUrl?: string;
  total: number;
  matched: number;
  notFound: number;
  excluded: number;
  cleanReplaced: number;
  status: string;
  error?: string;
  createdAt: string;
  includeExplicit: boolean;
  cleanMode: string;
  tracks?: {
    title: string;
    artist: string;
    result: string;
    confidence: number | null;
  }[];
};
export function History() {
  const [data, setData] = useState<{
      items: Transfer[];
      total: number;
      page: number;
    }>({ items: [], total: 0, page: 1 }),
    [search, setSearch] = useState(""),
    [platform, setPlatform] = useState(""),
    [status, setStatus] = useState(""),
    [sort, setSort] = useState("desc"),
    [page, setPage] = useState(1),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const timer = setTimeout(
      () =>
        request<typeof data>(
          "/api/transfers?" +
            new URLSearchParams({
              search,
              platform,
              status,
              sort,
              page: String(page),
            }),
        )
          .then((d) => {
            if (active) setData(d);
          })
          .catch((e) => {
            if (active) setError(e.message);
          }),
      200,
    );
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [search, platform, status, sort, page]);
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <span /> EVERY MOVE, ALL IN ONE PLACE
          </div>
          <h1>
            Your playlist journeys<span>.</span>
          </h1>
          <p>Your transfer history is private and belongs only to you.</p>
        </div>
        <Link href="/converter" className="button primary">
          New transfer <ArrowRight size={15} />
        </Link>
      </div>
      <div className="content-card">
        <div className="history-filters">
          <input
            aria-label="Search transfers"
            placeholder="Search playlists…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          <select
            aria-label="Filter platform"
            value={platform}
            onChange={(e) => {
              setPlatform(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All platforms</option>
            {platforms.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            {["completed", "partial", "failed", "pending", "processing"].map(
              (s) => (
                <option key={s}>{s}</option>
              ),
            )}
          </select>
          <select
            aria-label="Sort transfers"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="desc">Newest first</option>
            <option value="asc">Oldest first</option>
          </select>
        </div>
        {error && (
          <div role="alert" className="error-box">
            {error}
          </div>
        )}
        {data.items.length ? (
          <div className="table-scroll">
            <table className="history-table">
              <thead>
                <tr>
                  <th>Playlist / Date</th>
                  <th>From → To</th>
                  <th>Track results</th>
                  <th>Status</th>
                  <th>Report</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <Link href={"/history/" + t.id}>
                        <b>{t.sourceName}</b>
                      </Link>
                      <small>{new Date(t.createdAt).toLocaleString()}</small>
                    </td>
                    <td>
                      {platformLabel(t.source)} → {platformLabel(t.destination)}
                    </td>
                    <td>
                      {t.status === "legacy"
                        ? "Earlier release — no remote playlist"
                        : `${t.matched}/${t.total} transferred`}
                      <small>
                        {t.notFound} not found · {t.excluded} excluded
                      </small>
                    </td>
                    <td>
                      <span className={"status-badge " + t.status}>
                        {t.status}
                      </span>
                    </td>
                    <td>
                      <Link href={"/history/" + t.id}>
                        View{" "}
                        <ArrowRight size={12} style={{ display: "inline" }} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <HistoryIcon size={32} />
            <h3>
              {search || platform || status
                ? "No matching transfers."
                : "A clean slate. A world of music."}
            </h3>
            <p>
              {search || platform || status
                ? "Try adjusting your filters."
                : "Your transfers will appear here after your first playlist move."}
            </p>
          </div>
        )}
        <div className="pagination">
          <span>
            {data.total} transfers · Page {page} of{" "}
            {Math.max(1, Math.ceil(data.total / 10))}
          </span>
          <div>
            <Button
              variant="outline"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              disabled={page * 10 >= data.total}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
export function HistoryDetail({ id }: { id: string }) {
  const [t, setT] = useState<Transfer | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const router = useRouter();
  useEffect(() => {
    request<Transfer>("/api/transfers/" + id)
      .then(setT)
      .catch((e) => setError(e.message));
  }, [id]);
  async function action(kind: "delete" | "rerun") {
    setBusy(true);
    try {
      await request(
        "/api/transfers/" + id,
        kind === "delete" ? "DELETE" : "POST",
        {},
      );
      router.push(kind === "delete" ? "/history" : "/converter");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Link href="/history" className="text-button">
        ← All transfers
      </Link>
      <div className="page-heading" style={{ marginTop: 25 }}>
        <div>
          <div className="eyebrow">TRANSFER REPORT</div>
          <h1>
            {t?.sourceName || "Transfer details"}
            <span>.</span>
          </h1>
          <p>
            {t &&
              `${platformLabel(t.source)} → ${platformLabel(t.destination)} · ${new Date(t.createdAt).toLocaleString()}`}
          </p>
        </div>
        {t && <span className={"status-badge " + t.status}>{t.status}</span>}
      </div>
      {error && (
        <div role="alert" className="error-box">
          {error}
        </div>
      )}
      {t && (
        <div className="content-card">
          <p>
            {t.error ||
              `Explicit tracks: ${t.includeExplicit ? "included" : t.cleanMode === "replace" ? "replace with clean where available" : "excluded"}`}
          </p>
          <div className="result-counts">
            <div>
              <b>{t.status === "legacy" ? 0 : t.matched}</b>
              <span>Transferred</span>
            </div>
            <div>
              <b>{t.notFound}</b>
              <span>Not found</span>
            </div>
            <div>
              <b>{t.cleanReplaced}</b>
              <span>Clean versions</span>
            </div>
            <div>
              <b>{t.excluded}</b>
              <span>Explicit excluded</span>
            </div>
          </div>
          <div className="history-details-actions">
            {t.destinationUrl && (
              <a
                className="button secondary"
                href={t.destinationUrl}
                target="_blank"
                rel="noreferrer"
              >
                Open playlist <ExternalLink size={14} />
              </a>
            )}
            <Button
              disabled={busy || t.status === "legacy"}
              variant="outline"
              onClick={() => action("rerun")}
            >
              <RotateCcw size={14} /> Re-run transfer
            </Button>
            <Button
              disabled={busy}
              variant="ghost"
              onClick={() => {
                if (
                  confirm(
                    "Delete this history entry? The destination playlist will remain.",
                  )
                )
                  action("delete");
              }}
            >
              <Trash2 size={14} /> Delete entry
            </Button>
          </div>
          {["pending", "processing"].includes(t.status) && (
            <Button
              variant="outline"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await request("/api/transfers/" + id + "/tick", "POST", {});
                  setT(await request<Transfer>("/api/transfers/" + id));
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Continue saved transfer
            </Button>
          )}
          <div className="report-rows">
            {t.tracks?.map((x, i) => (
              <div key={i}>
                <span>
                  {x.title}
                  <small>{x.artist}</small>
                </span>
                <span className={x.result === "review" ? "warning-text" : ""}>
                  {x.result.replaceAll("_", " ")}
                  {x.confidence !== null &&
                    ` · ${Math.round(x.confidence * 100)}%`}
                  {x.result === "review" && " · check this match"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
