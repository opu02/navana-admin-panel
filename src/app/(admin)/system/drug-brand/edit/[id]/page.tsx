import { notFound } from "next/navigation";
import { BrandManager } from "@/components/system/brand-manager";

export default async function EditDrugBrandPage({ params }: { params: Promise<{ id: string }> }) {
  const id = decodeURIComponent((await params).id);
  if (!/^[A-Za-z0-9_\-]{1,200}$/.test(id)) notFound();
  return <BrandManager key={id} editId={id} />;
}
