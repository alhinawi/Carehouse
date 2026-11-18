import { describe, it, expect } from "vitest";
import { can, validate, modules } from "../src/domain";
import { seedRecords } from "../src/seed";
describe("Server permission model", () => {
  it("blocks reception from EMR and billing changes", () => {
    expect(can("reception", "emr")).toBe(false);
    expect(can("reception", "billing", true)).toBe(false);
  });
  it("allows clinical authoring only for doctors/admin", () => {
    expect(can("doctor", "emr", true)).toBe(true);
    expect(can("nurse", "emr", true)).toBe(false);
    expect(can("auditor", "patients")).toBe(false);
  });
  it("allows lab and pharmacy minimum patient lookups", () => {
    expect(can("lab", "patients")).toBe(true);
    expect(can("pharmacist", "patients", true)).toBe(false);
  });
  it("rejects unknown roles and modules", () => {
    expect(can("hacker", "patients", true)).toBe(false);
    expect(can("doctor", "unknown")).toBe(false);
  });
});
describe("Record validation", () => {
  it("requires key fields", () =>
    expect(validate("patients", { status: "Active" })).toContain(
      "Full name is required",
    ));
  it("rejects future DOB", () =>
    expect(
      validate("patients", {
        name: "Demo",
        dob: "2099-01-01",
        sex: "Male",
        status: "Active",
      }),
    ).toContain("Date of birth cannot be in the future"));
  it("requires patient for occupied bed", () =>
    expect(
      validate("beds", {
        name: "B1",
        ward: "A",
        room: "1",
        department: "Emergency",
        bedType: "ICU",
        status: "Occupied",
      }),
    ).toContain("Select a patient before admission"));
  it("requires result before lab completion", () =>
    expect(validate("lab", { status: "Completed" })).toContain(
      "Enter a result before completion",
    ));
  it("rejects non-HTTPS documents", () =>
    expect(
      validate("patients", {
        name: "Demo",
        dob: "1990-01-01",
        sex: "Male",
        status: "Active",
        documentUrl: "javascript:alert(1)",
      }),
    ).toContain("Document URL (https only) must use https"));
  it("rejects negative inventory and fractions", () => {
    expect(validate("pharmacy", { status: "In stock", stock: -1 })).toContain(
      "Units in stock must be a valid non-negative number",
    );
    expect(
      validate("pharmacy", { status: "In stock", stock: 1.5, reorder: 1 }),
    ).toContain("Stock and reorder levels must be whole numbers");
  });
  it("rejects unsigned clinical plan", () =>
    expect(validate("emr", { status: "Signed" })).toContain(
      "Clinical notes and treatment are required before signing",
    ));
  it("validates every seeded demo record", () => {
    for (const { module, id, ...data } of seedRecords()) {
      expect(validate(module, data), `${module} ${id}`).toEqual([]);
    }
  });
  it("has fields and statuses for every module", () => {
    expect(Object.keys(modules)).toHaveLength(10);
    for (const m of Object.values(modules)) {
      expect(m.fields.length).toBeGreaterThan(3);
      expect(m.statuses.length).toBeGreaterThan(0);
    }
  });
});
describe("Localized server errors", () => {
  it("every API error message has an Arabic translation", async () => {
    const { readFileSync } = await import("node:fs");
    const { ar } = await import("../src/i18n");
    const source = readFileSync(
      new URL("../functions/api/[[path]].ts", import.meta.url),
      "utf8",
    );
    const messages = [...source.matchAll(/error: "([^"]+)"/g)].map((m) => m[1]);
    const missing = [...new Set(messages)].filter((m) => !ar[m]);
    expect(missing).toEqual([]);
  });
});
describe("Busy error classification", () => {
  it("maps D1 resource exhaustion to a clear busy error", async () => {
    const { isBusyError, BUSY_ERROR } = await import("../src/errors");
    expect(BUSY_ERROR.length).toBeGreaterThan(10);
    expect(
      isBusyError(
        Object.assign(new Error("D1_ERROR"), {
          cause: new Error("exceeded maximum number of rows read per day"),
        }),
      ),
    ).toBe(true);
    expect(isBusyError(new Error("too many rows written"))).toBe(true);
    expect(isBusyError(new Error("UNIQUE constraint failed"))).toBe(false);
    expect(
      isBusyError(new Error("Appointment overlaps an existing appointment")),
    ).toBe(false);
  });
});

describe("Patient field policy", () => {
  it("protects clinical fields from nonclinical roles, including blood group", async () => {
    const {
      canAccessPatientField,
      forbiddenPatientFields,
      protectedPatientFields,
    } = await import("../src/domain");
    for (const role of [
      "reception",
      "billing",
      "pharmacist",
      "lab",
      "hr",
      "auditor",
    ]) {
      for (const field of protectedPatientFields) {
        expect(canAccessPatientField(role, field)).toBe(false);
        expect(forbiddenPatientFields(role, { [field]: "" })).toEqual([field]);
      }
    }
    expect(
      forbiddenPatientFields("reception", {
        name: "Fictional",
        phone: "01000000000",
      }),
    ).toEqual([]);
    for (const role of ["admin", "doctor", "nurse"]) {
      expect(
        forbiddenPatientFields(role, {
          allergies: "Fictional allergy",
          bloodGroup: "O+",
        }),
      ).toEqual([]);
    }
  });
});
