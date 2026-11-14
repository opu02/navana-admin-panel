import { notFound } from "next/navigation";
import { MasterManager } from "@/components/system/master-manager";

export default async function EditAdvicePage({ params }: { params: Promise<{ id: string }> }) {
  const id = decodeURIComponent((await params).id);
  if (!/^[A-Za-z0-9_\-]{1,200}$/.test(id)) notFound();
  return <MasterManager key={id} listKey="advice" editId={id} />;
}
