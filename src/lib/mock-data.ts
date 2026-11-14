// TEST DATA ONLY. Used when MOCK_DATA=true in .env.local.
// Delete this file when the real backend is ready.
import type { Doctor, Prescription, PrescriptionFilters, PrescriptionListResponse } from "./types";

export const MOCK_DOCTORS: Doctor[] = [
  { id: "d1", name: "Dr. K. M. Zobair Galib", npl: "0000122863" },
  { id: "d2", name: "Dr. Hertha Kovacek", npl: "0000122001" },
  { id: "d3", name: "Dr. Marquise Howe", npl: "0000122017" },
  { id: "d4", name: "Dr. Nusrat Jahan", npl: "0000122104" },
  { id: "d5", name: "Dr. Tanvir Hasan", npl: "0000122230" },
  { id: "d6", name: "Dr. Farhana Akter", npl: "0000122311" },
];

const PATIENTS = ["Ramim", "Ahanaf", "Mahsan", "Ayan", "Afridi", "Raisha Jannat", "Alisha", "Oyziha", "Tahsin", "Nabila"];
const BRANDS = [
  "Syrup Xinc 10mg/5ml", "Paediatric Drops Napa 80mg/ml", "Suppository Napa 60mg",
  "Powder for Suspension Azirox 200mg/5ml", "Syrup Ace 120mg/5ml", "Cream Ezex 0.05%",
  "Lotion Emoli 100 mg + 100 mg + 2.5 gm", "Syrup Bicozin", "Oral Saline Rice Saline",
  "Chewable Tablet M-Lucas 4mg", "Paediatric Drops Lytex 6 mg/ml", "IV Infusion Solo 0.9% w/v",
];
// pretend these are Navana brands
const NAVANA = new Set(["Syrup Xinc 10mg/5ml", "Syrup Bicozin", "Cream Ezex 0.05%", "Lotion Emoli 100 mg + 100 mg + 2.5 gm"]);

const ALL: Prescription[] = Array.from({ length: 137 }, (_, i) => {
  const doc = MOCK_DOCTORS[i % MOCK_DOCTORS.length];
  const day = new Date(Date.UTC(2026, 10, 12) - Math.floor(i / 3) * 86_400_000);
  const brandCount = 1 + ((i * 7) % 6);
  return {
    id: `p${i + 1}`,
    doctorId: doc.id,
    doctorName: doc.name,
    npl: doc.npl,
    patientName: PATIENTS[(i * 3) % PATIENTS.length],
    appointmentDate: day.toISOString().slice(0, 10),
    uploadedAt: new Date(day.getTime() + ((i * 37) % 600) * 60_000).toISOString(),
    brands: Array.from({ length: brandCount }, (_, j) => BRANDS[(i + j * 5) % BRANDS.length])
      .filter((b, k, arr) => arr.indexOf(b) === k)
      .map((name) => ({ name, isNavana: NAVANA.has(name) })),
  };
});

export function getMockPrescriptions(
  f: PrescriptionFilters,
  page: number,
  pageSize: number
): PrescriptionListResponse {
  const q = f.search?.toLowerCase();
  const rows = ALL.filter(
    (p) =>
      (!f.doctorId || p.doctorId === f.doctorId) &&
      (!f.from || p.appointmentDate >= f.from) &&
      (!f.to || p.appointmentDate <= f.to) &&
      (!q || p.patientName.toLowerCase().includes(q) || p.npl.includes(q) || p.doctorName.toLowerCase().includes(q))
  );
  const brands = rows.flatMap((p) => p.brands);
  return {
    items: rows.slice((page - 1) * pageSize, page * pageSize),
    total: rows.length,
    page,
    pageSize,
    stats: {
      totalPrescription: rows.length,
      totalBrand: brands.length,
      navanaBrand: brands.filter((b) => b.isNavana).length,
      totalDoctor: new Set(rows.map((p) => p.doctorId)).size,
    },
  };
}

// ---------- Doctor sessions (TEST DATA ONLY) ----------
import type { DoctorSession, DoctorSessionListResponse } from "./types";

const SESSIONS: DoctorSession[] = [
  ...Array.from({ length: 58 }, (_, i): DoctorSession => {
    const doc = MOCK_DOCTORS[i % 4];
    const login = new Date(Date.UTC(2026, 10, 12, 9) - i * 7.3 * 3_600_000);
    const stay = [18, 57, 340, 1260, 4100, 9300][i % 6] * 1000;
    return {
      id: `s${i + 1}`,
      doctorId: doc.id,
      doctorName: doc.name,
      npl: doc.npl,
      loginAt: login.toISOString(),
      logoutAt: i < 2 ? null : new Date(login.getTime() + stay).toISOString(), // first 2 = online now
    };
  }),
  // doctors who never logged in
  ...MOCK_DOCTORS.slice(4).map((d): DoctorSession => ({
    id: `never-${d.id}`, doctorId: d.id, doctorName: d.name, npl: d.npl, loginAt: null, logoutAt: null,
  })),
];

export function getMockSessions(f: PrescriptionFilters, page: number, pageSize: number): DoctorSessionListResponse {
  const q = f.search?.toLowerCase();
  const rows = SESSIONS.filter((s) => {
    const day = s.loginAt?.slice(0, 10);
    const inRange = (!f.from && !f.to) || (!!day && (!f.from || day >= f.from) && (!f.to || day <= f.to));
    return (
      (!f.doctorId || s.doctorId === f.doctorId) &&
      inRange &&
      (!q || s.doctorName.toLowerCase().includes(q) || s.npl.includes(q))
    );
  });
  const logins = rows.filter((s) => s.loginAt);
  const closed = logins.filter((s) => s.logoutAt);
  const totalStay = closed.reduce((sum, s) => sum + (Date.parse(s.logoutAt!) - Date.parse(s.loginAt!)) / 1000, 0);
  return {
    items: rows.slice((page - 1) * pageSize, page * pageSize),
    total: rows.length,
    page,
    pageSize,
    stats: {
      totalDoctor: new Set(rows.map((s) => s.doctorId)).size,
      activeNow: logins.filter((s) => !s.logoutAt).length,
      totalLogins: logins.length,
      avgStaySeconds: closed.length ? Math.round(totalStay / closed.length) : 0,
    },
  };
}
