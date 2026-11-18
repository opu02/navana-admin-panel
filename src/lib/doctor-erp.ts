// Creates a doctor (and chambers) in the ERP.
//   POST rx-data/user-create        { doc_code, full_name, phone_no, chamber_name, chamber_address }
//   POST rx-data/rx-doctor-chamber  { doc_user_id, doc_code, chamber_name, chamber_address, created_by }
// A doctor can have many chambers: the FIRST one goes with user-create, the others use rx-doctor-chamber.
import "server-only";
import { ErpError, erpFetch } from "./erp";
import type { Session } from "./session";
import { padNpl, type DoctorCreateForm } from "./user-schema";
import { assertDoctorFree, saveErpDoctorExtras } from "./user-store";
import { assertDoctorFreeInErp, findErpUserIdByPhone, invalidateDoctors } from "./doctor-directory";
import { assertSecretKey } from "./secret-box";

type Any = Record<string, unknown>;

/** Look for the first positive integer under one of these keys (the response shape is not documented yet) */
function findNumber(v: unknown, keys: string[], depth = 0): number | null {
  if (!v || typeof v !== "object" || depth > 4) return null;
  if (Array.isArray(v)) {
    for (const x of v) {
      const r = findNumber(x, keys, depth + 1);
      if (r) return r;
    }
    return null;
  }
  const o = v as Any;
  for (const k of Object.keys(o)) {
    if (keys.includes(k.toLowerCase())) {
      const n = Number(o[k]);
      if (Number.isInteger(n) && n > 0) return n;
    }
  }
  for (const k of Object.keys(o)) {
    const r = findNumber(o[k], keys, depth + 1);
    if (r) return r;
  }
  return null;
}

/** The ERP can answer HTTP 200 and still say "error" in the body: catch that */
function assertErpOk(res: unknown, what: string) {
  const first = (Array.isArray((res as Any)?.items) ? (res as { items: unknown[] }).items[0] : res) as Any | null;
  if (!first || typeof first !== "object") return;
  const status = String(first.status ?? "").toLowerCase();
  const bad =
    first.success === false ||
    String(first.is_success ?? "").toLowerCase() === "false" ||
    ["error", "fail", "failed", "failure"].includes(status);
  if (bad) throw new ErpError(502, String(first.message || `The ERP did not accept the ${what}.`));
}

export type ErpDoctorResult = { erpUserId: number | null; docCode: string };

/** Step 1: create the doctor + first chamber */
export async function erpCreateDoctor(s: Session, f: DoctorCreateForm): Promise<ErpDoctorResult> {
  const docCode = padNpl(f.npl);
  const first = f.chambers[0];
  const res = await erpFetch<unknown>("rx-data/user-create", {
    method: "POST",
    token: s.erpToken,
    body: {
      doc_code: docCode,
      full_name: f.name.trim(),
      phone_no: f.phone.trim(),
      chamber_name: first.name.trim(),
      chamber_address: first.address.trim(),
    },
  });
  assertErpOk(res, "doctor");
  const erpUserId = findNumber(res, ["doc_user_id", "user_id", "userid", "id"]);
  if (!erpUserId) console.error("[ERP] user-create did not return a user id. Response:", JSON.stringify(res)?.slice(0, 500));
  return { erpUserId, docCode };
}

/** Step 2 (extra chambers): add one chamber to an existing ERP doctor */
export async function erpAddChamber(
  s: Session, d: { erpUserId: number; docCode: string; name: string; address: string }
): Promise<{ erpChamberId: number | null }> {
  const res = await erpFetch<unknown>("rx-data/rx-doctor-chamber", {
    method: "POST",
    token: s.erpToken,
    body: {
      doc_user_id: d.erpUserId,
      doc_code: d.docCode,
      chamber_name: d.name.trim(),
      chamber_address: d.address.trim(),
      created_by: String(s.userId),
    },
  });
  assertErpOk(res, "chamber");
  return { erpChamberId: findNumber(res, ["chamber_id"]) };
}

/**
 * Whole "Create User → Doctor" flow:
 *  1) ERP user-create (doctor + first chamber)  2) every extra chamber → ERP rx-doctor-chamber
 * Nothing is stored on the website any more: the Doctor List reads the doctors back from the ERP.
 * If an extra chamber fails the doctor is still created: the failed ones come back in `warnings`.
 */
export async function createDoctor(
  s: Session, f: DoctorCreateForm
): Promise<{ name: string; erpUserId: number | null; warnings: string[] }> {
  assertSecretKey(); // the password is kept (encrypted) on this website: fail BEFORE anything is created in the ERP
  await assertDoctorFree(f.npl, f.phone, f.email); // doctor saved on this website with the same NPL / phone / email
  await assertDoctorFreeInErp(s, f.npl, f.phone); // doctor that is already in the ERP
  const { erpUserId: idFromErp, docCode } = await erpCreateDoctor(s, f);
  invalidateDoctors(s.userId);

  const warnings: string[] = [];
  let erpUserId = idFromErp;
  if (f.chambers.length > 1) {
    // the first chamber was sent together with user-create; the others need the new user's id
    if (!erpUserId) erpUserId = await findErpUserIdByPhone(s, f.phone).catch(() => null);
    for (const c of f.chambers.slice(1)) {
      try {
        if (!erpUserId) throw new Error("the ERP did not return the doctor's user id");
        await erpAddChamber(s, { erpUserId, docCode, name: c.name, address: c.address });
      } catch (e) {
        warnings.push(`Chamber "${c.name}" was not saved: ${e instanceof Error ? e.message : "unknown error"}`);
      }
    }
    invalidateDoctors(s.userId);
  }

  // The ERP has no column for email / password / specialty / designation / organization / address / BMDC:
  // keep them on this website, linked to the ERP doctor. A failure here must not hide that the doctor WAS created.
  try {
    await saveErpDoctorExtras(f, erpUserId, s.userId);
  } catch (e) {
    console.error("[doctor] extra details could not be saved on the website:", e);
    warnings.push(`The doctor is in the ERP, but email / password / specialty etc. could not be saved on this website: ${e instanceof Error ? e.message : "unknown error"}`);
  }
  return { name: f.name.trim(), erpUserId, warnings };
}