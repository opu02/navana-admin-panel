import { notFound } from "next/navigation";
import { UserFormCard } from "@/components/users/user-form";

export default async function EditUserPage({
  params, searchParams,
}: { params: Promise<{ id: string }>; searchParams: Promise<{ back?: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const back = (await searchParams).back === "doctors" ? "/users/doctors" : "/users/admins";
  return <UserFormCard key={id} editId={id} backTo={back} />;
}
