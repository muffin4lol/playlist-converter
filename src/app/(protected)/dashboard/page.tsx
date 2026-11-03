import Link from "next/link";
import { NewTransferLink } from "@/components/new-transfer-link";
import { ArrowRight, ArrowLeftRight, History } from "lucide-react";
import { requirePage } from "@/lib/auth";
import { platformLabel } from "@/components/platforms";
import { db } from "@/lib/db";
export default async function Dashboard() {
  const s = await requirePage();
  const [count, aggregate, recent] = await Promise.all([
    db.transfer.count({ where: { userId: s.userId } }),
    db.transfer.aggregate({
      where: { userId: s.userId },
      _sum: { matched: true },
    }),
    db.transfer.findMany({
      where: { userId: s.userId },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <span /> YOUR MUSIC AT A GLANCE
          </div>
          <h1>
            Welcome back, {s.user.firstName}
            <span>.</span>
          </h1>
          <p>New destinations for the music you love.</p>
        </div>
        <NewTransferLink href="/converter" className="button primary">
          New transfer <ArrowRight size={15} />
        </NewTransferLink>
      </div>
      <div className="stats-grid">
        <div className="stat-card">
          <span>Total transfers</span>
          <b>{count}</b>
        </div>
        <div className="stat-card">
          <span>Tracks moved</span>
          <b>{aggregate._sum.matched ?? 0}</b>
        </div>
        <div className="stat-card">
          <span>Your plan</span>
          <b style={{ color: "var(--accent)" }}>Free</b>
        </div>
      </div>
      <div className="content-card">
        <h3>Recent transfers</h3>
        {recent.length ? (
          <div className="table-scroll">
            <table className="history-table">
              <thead>
                <tr>
                  <th>Playlist</th>
                  <th>Route</th>
                  <th>Tracks moved</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <Link href={"/history/" + t.id}>{t.sourceName}</Link>
                    </td>
                    <td>
                      {platformLabel(t.source)} → {platformLabel(t.destination)}
                    </td>
                    <td>
                      {t.matched} / {t.total}
                    </td>
                    <td>
                      <span className={"status-badge " + t.status}>
                        {t.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <ArrowLeftRight size={32} />
            <h3>Your next chapter is waiting.</h3>
            <p>
              Start your first transfer and bring your favorite playlist along.
            </p>
            <NewTransferLink href="/converter" className="button primary">
              Convert a playlist <ArrowRight size={14} />
            </NewTransferLink>
          </div>
        )}
      </div>
      <Link className="button secondary" href="/history">
        <History size={15} /> See all history
      </Link>
    </>
  );
}
