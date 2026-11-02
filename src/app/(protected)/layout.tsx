import { requirePage } from "@/lib/auth";
import { Shell } from "@/components/shell";
export const dynamic = "force-dynamic";
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const s = await requirePage();
  return (
    <Shell
      name={`${s.user.firstName} ${s.user.lastName}`}
      verified={!!s.user.emailVerified}
    >
      {children}
    </Shell>
  );
}
