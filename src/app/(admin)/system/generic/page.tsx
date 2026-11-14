import { MasterManager } from "@/components/system/master-manager";

// Generic list from the ERP (rx-data/rx-generic) — the same list the app uses
export default function GenericPage() {
  return <MasterManager listKey="generic" />;
}
