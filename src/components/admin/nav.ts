import {
  LayoutDashboard, FileText, Stethoscope, Settings, Users, BadgeCheck, type LucideIcon,
} from "lucide-react";

export type NavItem = {
  label: string;
  href?: string;
  icon: LucideIcon;
  children?: { label: string; href: string }[];
};

export type NavGroup = { title: string; items: NavItem[] };

// TODO: change the submenu items to match the old panel exactly
export const NAV: NavGroup[] = [
  {
    title: "Overview",
    items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }],
  },
  {
    title: "Reports",
    items: [
      { label: "Prescription Report", href: "/reports/prescription", icon: FileText },
      { label: "Doctor Report", href: "/reports/doctor", icon: Stethoscope },
    ],
  },
  {
    title: "Management",
    items: [
      {
        label: "System", icon: Settings,
        children: [
          { label: "Generic", href: "/system/generic" },
          { label: "Drug Brand", href: "/system/drug-brand" },
          { label: "Brand Form Short", href: "/system/brand-form-short" },
          { label: "CC", href: "/system/cc" },
          { label: "OE", href: "/system/oe" },
          { label: "Diagnosis", href: "/system/diagnosis" },
          { label: "Investigation", href: "/system/investigation" },
          { label: "Procedure", href: "/system/procedure" },
          { label: "Advice", href: "/system/advice" },
          { label: "Handout", href: "/system/handout" },
          { label: "Dose", href: "/system/dose" },
          { label: "Instruction", href: "/system/instruction" },
          { label: "Duration", href: "/system/duration" },
          { label: "Specialty", href: "/system/speciality" },
          { label: "History", href: "/system/history" },
        ],
      },
      {
        label: "Users", icon: Users,
        children: [
          { label: "Create User", href: "/users/create" },
          { label: "User Role", href: "/users/roles" },
          { label: "Admin User List", href: "/users/admins" },
          { label: "Doctor List", href: "/users/doctors" },
        ],
      },
      {
        label: "License", icon: BadgeCheck,
        children: [
          { label: "All Licenses", href: "/license" },
          { label: "Add License", href: "/license/new" },
        ],
      },
    ],
  },
];

export const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/profile": "Profile Update",
  "/reports/prescription": "Prescription Report",
  "/reports/doctor": "Doctor Report",
  "/system/generic": "Generic",
  "/system/drug-brand": "Add New Drug",
  "/system/brand-form-short": "Brand Form Short",
  "/system/cc": "Chief Complaints",
  "/system/oe": "On Examination",
  "/system/diagnosis": "Diagnosis",
  "/system/investigation": "Investigation",
  "/system/procedure": "Procedure",
  "/system/advice": "Add New Advice",
  "/system/handout": "Add New Handout",
  "/system/dose": "Dose",
  "/system/instruction": "Instruction",
  "/system/duration": "Duration",
  "/system/speciality": "Specialty",
  "/system/history": "History",
  "/users/create": "Add New User",
  "/users/roles": "User Role",
  "/users/admins": "List of Admin User",
  "/users/doctors": "List of Doctor",
  "/license": "License",
  "/license/new": "Add License",
};

// Titles for pages with an id in the URL
export function pageTitle(pathname: string) {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  if (pathname.startsWith("/system/generic/edit/")) return "Edit Generic";
  if (pathname.startsWith("/system/drug-brand/edit/")) return "Edit Drug Brand";
  if (pathname.startsWith("/system/brand-form-short/edit/")) return "Edit Brand Form Short";
  if (pathname.startsWith("/system/cc/edit/")) return "Edit Chief Complaint";
  if (pathname.startsWith("/system/oe/edit/")) return "Edit On Examination";
  if (pathname.startsWith("/system/diagnosis/edit/")) return "Edit Diagnosis";
  if (pathname.startsWith("/system/investigation/edit/")) return "Edit Investigation";
  if (pathname.startsWith("/system/procedure/edit/")) return "Edit Procedure";
  if (pathname.startsWith("/system/advice/edit/")) return "Edit Advice";
  if (pathname.startsWith("/system/handout/edit/")) return "Edit Handout";
  if (pathname.startsWith("/users/edit/")) return "Edit User";
  for (const [k, t] of [["speciality", "Specialty"], ["dose", "Dose"], ["instruction", "Instruction"], ["duration", "Duration"], ["history", "History"]]) {
    if (pathname.startsWith(`/system/${k}/edit/`)) return `Edit ${t}`;
  }
  return "";
}
