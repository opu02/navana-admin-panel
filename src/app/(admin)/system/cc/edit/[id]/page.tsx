import { notFound } from "next/navigation";
import { MasterManager } from "@/components/system/master-manager";

export default async function EditChiefComplaintPage({ params }: { params: Promise<{ id: string }> }) {
  const id = decodeURIComponent((await params).id);
  if (!/^[A-Za-z0-9_\-]{1,200}$/.test(id)) notFound();
  return <MasterManager key={id} listKey="cc" editId={id} />;
}
