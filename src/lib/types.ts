// Shared types. The ASP.NET Core API (Step 10) must return the same shape.

export type Doctor = {
  id: string;
  name: string;
  npl: string;
};

export type Brand = {
  name: string;
  isNavana: boolean; // true = a Navana Pharma brand
};

export type Prescription = {
  id: string;
  doctorId: string;
  doctorName: string;
  npl: string;
  patientName: string;
  appointmentDate: string; // "2026-12-23"
  uploadedAt: string; // ISO date-time, e.g. "2025-12-24T04:55:07Z"
  brands: Brand[];
};

export type PrescriptionStats = {
  totalPrescription: number;
  totalBrand: number;
  navanaBrand: number;
  totalDoctor: number;
};

export type PrescriptionFilters = {
  doctorId?: string;
  from?: string; // "yyyy-mm-dd"
  to?: string; // "yyyy-mm-dd"
  search?: string;
};

export type PrescriptionListResponse = {
  items: Prescription[];
  total: number;
  page: number;
  pageSize: number;
  stats: PrescriptionStats;
};

export const EMPTY_STATS: PrescriptionStats = {
  totalPrescription: 0,
  totalBrand: 0,
  navanaBrand: 0,
  totalDoctor: 0,
};

// ---------- Doctor report ----------
export type DoctorSession = {
  id: string;
  doctorId: string;
  doctorName: string;
  npl: string;
  loginAt: string | null; // null = never logged in
  logoutAt: string | null; // null + loginAt set = still logged in
};

export type DoctorSessionStats = {
  totalDoctor: number;
  activeNow: number;
  totalLogins: number;
  avgStaySeconds: number;
};

export type DoctorSessionListResponse = {
  items: DoctorSession[];
  total: number;
  page: number;
  pageSize: number;
  stats: DoctorSessionStats;
};

export const EMPTY_SESSION_STATS: DoctorSessionStats = {
  totalDoctor: 0,
  activeNow: 0,
  totalLogins: 0,
  avgStaySeconds: 0,
};
