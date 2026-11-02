import { HistoryDetail } from "@/components/history";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <HistoryDetail id={(await params).id} />;
}
