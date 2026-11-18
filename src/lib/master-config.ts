// All simple ERP "name lists" (same shape: data_id, name_desc, is_active, ...).
// To add a new page later (Dose, Duration, ...) just add one entry here.
export type MasterKey = "generic" | "form" | "cc" | "oe" | "diagnosis" | "investigation" | "procedure" | "advice" | "handout" | "dose" | "instruction" | "history" | "speciality";

export type MasterConfig = {
  path: string; // ERP path
  title: string; // page title (list)
  singular: string; // "Brand Form"
  basePath: string; // admin page URL
  /** No ERP API yet: saved on this PC in data/<local.file>.json, starting with local.seed */
  local?: { file: string; seed: string[] };
  /** For Rx sections (CC, OE, Diagnosis...): the section_id inside rx-section-data */
  sectionId?: number;
  /** Label of the main field (default "Name") and whether it is a multi-line box */
  nameLabel?: string;
  nameMultiline?: boolean;
  /** Show the বাংলা / English switch (Banglish → Bangla while typing) */
  banglaTyping?: boolean;
  /** Optional second field (erpField = ERP column). multiline = big text box */
  extra?: { label: string; erpField: string; placeholder: string; max: number; multiline?: boolean };
};

export const MASTER: Record<MasterKey, MasterConfig> = {
  generic: { path: "rx-data/rx-generic", title: "Generic", singular: "Generic", basePath: "/system/generic" },
  form: {
    path: "rx-data/rx-form",
    title: "Brand Form Short",
    singular: "Brand Form",
    basePath: "/system/brand-form-short",
    // NOTE: the ERP sample has no "short" column. Change erpField when the ERP team confirms the name.
    extra: { label: "Short", erpField: "short_desc", placeholder: "Write short name (e.g. Tab)", max: 50 },
  },
  cc: {
    path: "rx-data/rx-section-data",
    sectionId: 134,
    title: "Chief Complaints",
    singular: "Chief Complaint",
    basePath: "/system/cc",
  },
  oe: {
    path: "rx-data/rx-section-data",
    sectionId: 135,
    title: "On Examination",
    singular: "On Examination",
    basePath: "/system/oe",
  },
  diagnosis: {
    path: "rx-data/rx-section-data",
    sectionId: 136,
    title: "Diagnosis",
    singular: "Diagnosis",
    basePath: "/system/diagnosis",
  },
  // ERP has two investigation sections: 137 = Investigation Advice (tests to order), 138 = Investigation Report.
  // The old panel's "Investigation" list = tests to order → 137.
  investigation: {
    path: "rx-data/rx-section-data",
    sectionId: 137,
    title: "Investigation",
    singular: "Investigation",
    basePath: "/system/investigation",
  },
  procedure: {
    path: "rx-data/rx-section-data",
    sectionId: 139,
    title: "Procedure",
    singular: "Procedure",
    basePath: "/system/procedure",
  },
  advice: {
    path: "rx-data/rx-section-data",
    sectionId: 153,
    title: "Advice",
    singular: "Advice",
    basePath: "/system/advice",
    nameLabel: "Title",
    nameMultiline: true,
    banglaTyping: true,
    extra: { label: "Text", erpField: "data_details", placeholder: "Write advice text", max: 5000, multiline: true },
  },
  handout: {
    path: "rx-data/rx-section-data",
    sectionId: 154,
    title: "Handout",
    singular: "Handout",
    basePath: "/system/handout",
    nameLabel: "Title",
    nameMultiline: true,
    banglaTyping: true,
    extra: { label: "Text", erpField: "data_details", placeholder: "Write handout text", max: 5000, multiline: true },
  },
  // Same shape as rx-form (data_id, name_desc, ...) — checked in the app's models
  dose: { path: "rx-data/rx-dose", title: "Dose", singular: "Dose", basePath: "/system/dose", banglaTyping: true },
  instruction: { path: "rx-data/rx-instruction", title: "Instruction", singular: "Instruction", basePath: "/system/instruction", banglaTyping: true },
  // History = Clinical History section (140). Drug History (141) / Other History (155) can be added the same way.
  // No ERP API for Speciality yet → saved on this PC (data/speciality.json). Same 48 items as the old panel.
  speciality: {
    path: "",
    title: "Specialty",
    singular: "Specialty",
    basePath: "/system/speciality",
    local: {
      file: "speciality",
      seed: [
        "Hematology",
        "Orthodontics",
        "Gastrologist/Hepatology",
        "Intensive care medicine specialist",
        "Diabetologist",
        "Oral & Maxillofacial surgeon",
        "Dentist/Dental surgeon",
        "Gynecologist & Obstetrician",
        "Opthalmologist (Eye specialist)",
        "ENT specialist",
        "Pediatric Surgeon",
        "Plastic, Reconstructive & Cosmetic surgeon",
        "Surgical Oncologist / Cancer surgeons",
        "Neurosurgeon",
        "Orthopedic surgeon",
        "Urologist & Andrologist",
        "Cardiovascular & thoracic surgeon",
        "Colorectal surgeon",
        "Hepatobiliary & Pancreatic surgeon",
        "General & Laparoscopic surgeon",
        "Family Physician / Family Medicine Specialist",
        "General Physician",
        "Sexual Medicine specialist",
        "Ultrasonologist",
        "Radiology & Imaging specialist",
        "Pathology & Laboratory medicine specialist",
        "Physical medicine & Physiotherapy specialist",
        "Infertility specialist",
        "Anesthesiologist",
        "Anesthesia & Pain care medicine specialist",
        "Emergency & Critical Care specialist",
        "Pediatric Oncologist",
        "Pediatric Psychiatrist",
        "Pediatric Neurologist",
        "Pediatric Cardiologist",
        "Pediatric Medicine specialist/Pediatrician",
        "Haematologist (Blood cancer & blood disease specialist)",
        "Medical / Radiation Oncologist",
        "Neuclear medicine specialist",
        "Dermatologist & Venereologist",
        "Endocrinologist & Diabetologist",
        "Psychiatrist",
        "Neurologist",
        "Nephrologist",
        "Pulmonologist/Respiratory medicine (chest specialist)",
        "Rheumatologist",
        "Cardiologist/Interventional cardiologist",
        "Medicine/Internal medicine specialist",
      ],
    },
  },
  history: {
    path: "rx-data/rx-section-data",
    sectionId: 140,
    title: "History",
    singular: "History",
    basePath: "/system/history",
  },
};

export const isMasterKey = (k: string): k is MasterKey => k in MASTER;

export type MasterItem = {
  id: string;
  name: string;
  extra: string;
  group: string; // Rx sections only ("All" = system list)
  isActive: boolean;
  isSystem: boolean;
  createdBy: number | null;
  createdAt: string;
};

export type MasterListResponse = { items: MasterItem[]; total: number; page: number; pageSize: number };
