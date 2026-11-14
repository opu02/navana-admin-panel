import { notFound } from "next/navigation";
import { DurationManager } from "@/components/system/duration-manager";

export default async function EditDurationPage({ params }: { params: Promise<{ id: string }> }) {
  const id = decodeURIComponent((await params).id);
  if (!/^[A-Za-z0-9_\-]{1,200}$/.test(id)) notFound();
  return <DurationManager key={id} editId={id} />;
}
