import { UserList } from "@/components/users/user-list";

// For now: doctors created on this website (Create User → Type = Doctor).
// TODO: when the ERP gives a doctor-list API, load the real doctors here instead.
export default function DoctorListPage() {
  return <UserList type="Doctor" />;
}
