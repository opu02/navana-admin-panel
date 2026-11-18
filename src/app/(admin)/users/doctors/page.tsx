import { UserList } from "@/components/users/user-list";

// Doctors come from the ERP (GET rx-data/user-create + rx-doctor-chamber), see lib/doctor-directory.ts.
// Old doctors that were saved on this website only are shown too, with a "Website only" badge.
export default function DoctorListPage() {
  return <UserList type="Doctor" />;
}
