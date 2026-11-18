import { test, expect } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
const screenshots = process.env.SCREENSHOT_DIR || "test-results/screenshots";
mkdirSync(screenshots, { recursive: true });
const origin = "http://127.0.0.1:8788";
async function demo(page: any, role = "admin") {
  await page.goto("/");
  await page
    .getByRole("combobox", { name: "Choose your role" })
    .selectOption(role);
  await page.getByRole("button", { name: "Start demo" }).click();
  await expect(
    page.getByRole("heading", { name: "Hospital overview", exact: true }),
  ).toBeVisible();
  await expect(page.locator("main")).toContainText("12");
}
async function call(page: any, path: string, method = "GET", body?: unknown) {
  return page.evaluate(
    async ({ path, method, body }: any) => {
      const s = (await (await fetch("/api/session")).json()) as any;
      const r = await fetch("/api" + path, {
        method,
        headers: { "Content-Type": "application/json", "X-CSRF-Token": s.csrf },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      return { status: r.status, body: await r.json() };
    },
    { path, method, body },
  );
}
test("unauthenticated reads and forged origins are blocked", async ({
  request,
}) => {
  expect((await request.get("/api/records")).status()).toBe(401);
  expect(
    (
      await request.post("/api/auth/demo", {
        data: { role: "admin" },
        headers: { Origin: "https://attacker.invalid" },
      })
    ).status(),
  ).toBe(403);
});
test("patient CRUD persists after reload and validates references", async ({
  page,
}) => {
  await demo(page);
  await page
    .locator("nav")
    .getByRole("button", { name: "Patients", exact: true })
    .click();
  await page.getByRole("button", { name: "Add patient", exact: true }).click();
  await page.getByLabel("Full name").fill("Fictional QA Patient");
  await page.getByRole("dialog").getByLabel("Date of birth").fill("1990-01-02");
  await page.getByRole("dialog").getByLabel("Sex").selectOption("Female");
  await page.getByRole("button", { name: "Create record" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByPlaceholder("Search records...").fill("Fictional QA Patient");
  await expect(page.locator("tbody")).toContainText("Fictional QA Patient");
  await page.reload();
  await page.getByPlaceholder("Search records...").fill("Fictional QA Patient");
  await expect(page.locator("tbody")).toContainText("Fictional QA Patient");
  const data = await call(page, "/records");
  const r = (data.body as any).records.find(
    (r: any) => r.name === "Fictional QA Patient",
  );
  expect(
    (
      await call(page, `/records/patients/${r.id}`, "PUT", {
        ...r,
        name: "Fictional QA Updated",
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await call(page, `/records/patients/${r.id}`, "PUT", {
        ...r,
        name: "Stale update",
      })
    ).status,
  ).toBe(409);
  expect((await call(page, `/records/patients/${r.id}`, "DELETE")).status).toBe(
    200,
  );
});
test("clinical, billing, bed, pharmacy workflow protections", async ({
  page,
}) => {
  await demo(page);
  const all = (await call(page, "/records")).body as any;
  const rows = all.records;
  const signed = rows.find(
    (r: any) => r.module === "emr" && r.status === "Signed",
  );
  expect(
    (
      await call(page, `/records/emr/${signed.id}`, "PUT", {
        ...signed,
        clinicalNotes: "Tampered",
      })
    ).status,
  ).toBe(409);
  expect((await call(page, `/records/emr/${signed.id}`, "DELETE")).status).toBe(
    409,
  );
  const invoice = rows.find(
    (r: any) => r.module === "billing" && r.status === "Issued",
  );
  expect(
    (
      await call(page, `/workflow/billing/${invoice.id}`, "POST", {
        action: "payment",
        amount: 100000,
        method: "Cash",
      })
    ).status,
  ).toBe(400);
  expect(
    (
      await call(page, `/workflow/billing/${invoice.id}`, "POST", {
        action: "payment",
        amount: 100,
        method: "Cash",
      })
    ).status,
  ).toBe(200);
  expect(
    (await call(page, `/records/billing/${invoice.id}`, "DELETE")).status,
  ).toBe(409);
  const bed = rows.find(
      (r: any) => r.module === "beds" && r.status === "Occupied",
    ),
    dest = rows.find(
      (r: any) => r.module === "beds" && r.status === "Available",
    );
  expect(
    (
      await call(page, `/workflow/beds/${bed.id}`, "POST", {
        action: "transfer",
        targetId: dest.id,
      })
    ).status,
  ).toBe(200);
  let after = (await call(page, "/records")).body as any;
  expect(after.records.find((r: any) => r.id === bed.id).status).toBe(
    "Cleaning",
  );
  expect(after.records.find((r: any) => r.id === dest.id).patientId).toBe(
    bed.patientId,
  );
  expect(
    (
      await call(page, `/workflow/beds/${dest.id}`, "POST", {
        action: "discharge",
      })
    ).status,
  ).toBe(200);
  const med = rows.find(
    (r: any) => r.module === "pharmacy" && Number(r.stock) > 0,
  );
  expect(
    (
      await call(page, `/workflow/pharmacy/${med.id}`, "POST", {
        action: "dispense",
        quantity: 1,
        encounterId: signed.id,
      })
    ).status,
  ).toBe(409);
  const draft = rows.find(
    (r: any) => r.module === "emr" && r.status === "Draft",
  );
  expect(
    (
      await call(page, `/records/emr/${draft.id}`, "PUT", {
        ...draft,
        status: "Signed",
        prescription:
          "Fictional prescription: QA medicine, demonstration only.",
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await call(page, `/workflow/pharmacy/${med.id}`, "POST", {
        action: "dispense",
        quantity: 1,
        encounterId: draft.id,
      })
    ).status,
  ).toBe(200);
  const appt = rows.find(
    (r: any) =>
      r.module === "appointments" &&
      r.status === "Scheduled" &&
      r.staffId !==
        rows.find(
          (s: any) => s.module === "staff" && s.status === "In consultation",
        )?.id,
  );
  expect(
    (
      await call(page, "/records/appointments", "POST", {
        ...appt,
        status: "Scheduled",
      })
    ).status,
  ).toBe(409);
  expect(
    (await call(page, `/records/patients/${bed.patientId}`, "DELETE")).status,
  ).toBe(409);
});
test("RBAC is enforced on server, not just navigation", async ({ page }) => {
  await demo(page, "reception");
  expect((await call(page, "/audit")).status).toBe(403);
  expect(
    (await call(page, "/records/emr", "POST", { name: "Not allowed" })).status,
  ).toBe(403);
  const rows = ((await call(page, "/records")).body as any).records;
  expect(rows.some((r: any) => r.module === "emr")).toBe(false);
  const p = rows.find((r: any) => r.module === "patients");
  expect(p.allergies).toBeUndefined();
  expect(p.nationalId).toBeUndefined();
  expect((await call(page, `/records/patients/${p.id}`, "DELETE")).status).toBe(
    403,
  );
  expect(
    (await call(page, "/settings", "PUT", { retentionDays: 30 })).status,
  ).toBe(403);
});
test("demo workspaces are isolated and CSRF is required", async ({
  page,
  browser,
}) => {
  await demo(page);
  const id = ((await call(page, "/records")).body as any).records[0].id;
  const context = await browser.newContext();
  const other = await context.newPage();
  await demo(other);
  const rows = ((await call(other, "/records")).body as any).records;
  expect(rows.some((r: any) => r.id === id)).toBe(false);
  expect((await call(other, `/records/patients/${id}`, "DELETE")).status).toBe(
    404,
  );
  const status = await page.evaluate(async () => {
    const r = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ retentionDays: 30 }),
    });
    return r.status;
  });
  expect(status).toBe(403);
  await context.close();
});
test("private signup, staff login and session revocation work", async ({
  page,
  browser,
}) => {
  await page.goto("/");
  const email = `qa-${Date.now()}@example.test`,
    password = randomBytes(20).toString("base64url");
  const registered = await page.evaluate(
    async ({ email, password }) => {
      const r = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "QA Administrator", email, password }),
      });
      return r.status;
    },
    { email, password },
  );
  expect(registered).toBe(200);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Hospital overview", exact: true }),
  ).toBeVisible();
  const staffEmail = `staff-${Date.now()}@example.test`;
  expect(
    (
      await call(page, "/users", "POST", {
        name: "QA Clinician",
        email: staffEmail,
        password,
        role: "doctor",
      })
    ).status,
  ).toBe(201);
  const context = await browser.newContext(),
    other = await context.newPage();
  await other.goto("/");
  await other.getByLabel("Email address").fill(staffEmail);
  await other.getByLabel("Password", { exact: true }).fill(password);
  await other.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    other.getByRole("heading", { name: "Hospital overview", exact: true }),
  ).toBeVisible();
  const users = ((await call(page, "/users")).body as any).users;
  const staff = users.find((u: any) => u.email === staffEmail);
  expect(
    (await call(page, `/users/${staff.id}`, "PUT", { role: "nurse" })).status,
  ).toBe(200);
  expect((await call(other, "/records")).status).toBe(401);
  await context.close();
});
test("all modules render, Arabic and mobile have no overflow", async ({
  page,
}) => {
  await demo(page);
  const pages = [
    "patients",
    "appointments",
    "emr",
    "staff",
    "departments",
    "beds",
    "pharmacy",
    "lab",
    "billing",
    "hr",
    "reports",
    "audit",
    "settings",
  ];
  for (const m of pages) {
    await page.goto("/#" + m);
    await page.waitForTimeout(120);
    await expect(page.locator("main h1")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `${screenshots}/hms-${m}.png`,
      fullPage: true,
    });
  }
  await page.goto("/#dashboard");
  await page.getByRole("button", { name: "Change language" }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await page.screenshot({
    path: `${screenshots}/hms-arabic.png`,
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: `${screenshots}/hms-mobile.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("encrypted document upload, download and permissions", async ({
  page,
}) => {
  await demo(page);
  const patient = ((await call(page, "/records")).body as any).records.find(
    (r: any) => r.module === "patients",
  );
  const result = await page.evaluate(
    async ({ id }) => {
      const s = (await (await fetch("/api/session")).json()) as any;
      const form = new FormData();
      form.append(
        "file",
        new File(
          ["%PDF-1.4\nFictional test document\n%%EOF"],
          "fictional-test.pdf",
          { type: "application/pdf" },
        ),
      );
      const response = await fetch("/api/documents/" + id, {
        method: "POST",
        headers: { "X-CSRF-Token": s.csrf },
        body: form,
      });
      return { status: response.status, body: (await response.json()) as any };
    },
    { id: patient.id },
  );
  expect(result.status).toBe(201);
  const doc = await page.request.get("/api/document/" + result.body.id);
  expect(doc.status()).toBe(200);
  expect(doc.headers()["content-disposition"]).toContain("attachment");
  expect(await doc.text()).toContain("Fictional test document");
  expect(
    (await call(page, "/document/" + result.body.id, "DELETE")).status,
  ).toBe(200);
  const after = ((await call(page, "/documents/" + patient.id)).body as any)
    .documents;
  expect(after.length).toBe(0);
});
test("Arabic browser defaults to Arabic, explicit English persists", async ({
  browser,
}) => {
  const context = await browser.newContext({
    locale: "ar-EG",
    timezoneId: "Africa/Cairo",
  });
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await page.getByRole("button", { name: "English", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await context.close();
});
test("mobile brand returns home on every module and account menu replaces initials", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await demo(page);
  for (const m of [
    "patients",
    "appointments",
    "emr",
    "staff",
    "departments",
    "beds",
    "pharmacy",
    "lab",
    "billing",
    "hr",
    "reports",
    "audit",
    "settings",
  ]) {
    await page.goto("/#" + m);
    const home = page
      .locator("header")
      .getByRole("link", { name: "Carehouse home" });
    await expect(home).toBeVisible();
    await home.click();
    await expect(
      page.getByRole("heading", { name: "Hospital overview", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.goto("/#patients");
  await page
    .locator("header")
    .getByRole("button", { name: "Account", exact: true })
    .click();
  await expect(page.getByRole("menu")).toContainText("Demo user");
  await expect(page.getByRole("menuitem", { name: "Sign out" })).toBeVisible();
  await page.screenshot({
    path: `${screenshots}/carehouse-mobile-account-en.png`,
    fullPage: false,
  });
  await page.getByRole("menuitem", { name: /Language/ }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await page.screenshot({
    path: `${screenshots}/carehouse-mobile-account-ar.png`,
    fullPage: false,
  });
  await page.getByRole("button", { name: "اقفل", exact: true }).click();
  await expect(
    page.locator("header").getByRole("link", { name: "Carehouse، الرئيسية" }),
  ).toBeVisible();
  await page.screenshot({
    path: `${screenshots}/carehouse-mobile-header-ar.png`,
    fullPage: false,
  });
  await page
    .locator("header")
    .getByRole("link", { name: "Carehouse، الرئيسية" })
    .click();
  await expect(
    page.getByRole("heading", { name: "متابعة المستشفى", exact: true }),
  ).toBeVisible();
});
test("demo mode toggle fills the workspace and removes only flagged rows", async ({
  page,
}) => {
  await demo(page);
  await page
    .locator("nav")
    .getByRole("button", { name: "Patients", exact: true })
    .click();
  await page.getByRole("button", { name: "Add patient", exact: true }).click();
  await page.getByLabel("Full name").fill("Fictional Real Keeper");
  await page.getByRole("dialog").getByLabel("Date of birth").fill("1991-05-06");
  await page.getByRole("dialog").getByLabel("Sex").selectOption("Male");
  await page.getByRole("button", { name: "Create record" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByPlaceholder("Search records...")
    .fill("Fictional Real Keeper");
  await expect(page.locator("tbody")).toContainText("Fictional Real Keeper");
  await page.getByPlaceholder("Search records...").fill("");
  await page
    .getByRole("button", { name: "Settings", exact: true })
    .first()
    .click();
  const toggle = page.getByRole("switch", { name: "Demo mode" });
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await page
    .locator("nav")
    .getByRole("button", { name: "Patients", exact: true })
    .click();
  await page.getByPlaceholder("Search records...").fill("Adam Nabil");
  await expect(page.locator("tbody")).not.toContainText("Adam Nabil");
  await page
    .getByPlaceholder("Search records...")
    .fill("Fictional Real Keeper");
  await expect(page.locator("tbody")).toContainText("Fictional Real Keeper");
  await page
    .getByRole("button", { name: "Settings", exact: true })
    .first()
    .click();
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await page
    .locator("nav")
    .getByRole("button", { name: "Patients", exact: true })
    .click();
  await page.getByPlaceholder("Search records...").fill("Adam Nabil");
  await expect(page.locator("tbody")).toContainText("Adam Nabil");
});
test("Arabic login page keeps brand and language toggle apart at 390px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem("carehouse-lang", "ar"));
  await page.goto("/");
  const brand = page.getByRole("link", { name: "Carehouse home" });
  const langToggle = page.getByRole("button", { name: "English" });
  await expect(brand).toBeVisible();
  await expect(langToggle).toBeVisible();
  const a = (await brand.boundingBox())!;
  const b = (await langToggle.boundingBox())!;
  const overlap =
    a.x < b.x + b.width &&
    b.x < a.x + a.width &&
    a.y < b.y + b.height &&
    b.y < a.y + a.height;
  expect(overlap).toBe(false);
});
test("Arabic login shows localized server errors", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("carehouse-lang", "ar"));
  await page.goto("/");
  await page.getByLabel("الإيميل").fill("no-such-user@example.test");
  await page.getByLabel("كلمة السر").fill("wrong-password-1");
  await page.getByRole("button", { name: "دخول" }).click();
  await expect(page.getByText("الإيميل أو كلمة السر غلط")).toBeVisible();
});
test("record list revalidates by version instead of re-reading rows", async ({
  page,
}) => {
  await demo(page);
  const first = await call(page, "/records");
  expect(first.status).toBe(200);
  expect(first.body.records.length).toBeGreaterThan(0);
  const version = first.body.version;
  const again = await call(page, "/records?v=" + version);
  expect(again.status).toBe(200);
  expect(again.body.unchanged).toBe(true);
  await call(page, "/records/patients", "POST", {
    name: "Fictional Version Bump",
    dob: "1990-01-01",
    sex: "Female",
    status: "Active",
  });
  const afterChange = await call(page, "/records?v=" + version);
  expect(afterChange.status).toBe(200);
  expect(afterChange.body.unchanged).toBeUndefined();
  expect(afterChange.body.version).toBeGreaterThan(version);
  expect(
    afterChange.body.records.some(
      (r: any) => r.name === "Fictional Version Bump",
    ),
  ).toBe(true);
});

test("reception cannot read or overwrite protected patient fields", async ({
  page,
  browser,
}) => {
  await page.goto("/");
  const email = `rbac-admin-${Date.now()}@example.test`;
  const staffEmail = `rbac-reception-${Date.now()}@example.test`;
  const password = randomBytes(20).toString("base64url");
  const registered = await page.evaluate(
    async ({ email, password }) => {
      const r = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Fictional RBAC Admin", email, password }),
      });
      return r.status;
    },
    { email, password },
  );
  expect(registered).toBe(200);
  const patient = ((await call(page, "/records")).body as any).records.find(
    (r: any) => r.module === "patients",
  );
  expect(
    (
      await call(page, "/users", "POST", {
        name: "Fictional Reception",
        email: staffEmail,
        password,
        role: "reception",
      })
    ).status,
  ).toBe(201);
  const context = await browser.newContext();
  const reception = await context.newPage();
  await reception.goto("/");
  await reception.getByLabel("Email address").fill(staffEmail);
  await reception.getByLabel("Password", { exact: true }).fill(password);
  await reception.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    reception.getByRole("heading", { name: "Hospital overview", exact: true }),
  ).toBeVisible();
  const visible = (
    (await call(reception, "/records")).body as any
  ).records.find((r: any) => r.id === patient.id);
  const protectedFields = [
    "allergies",
    "conditions",
    "history",
    "bloodGroup",
    "nationalId",
    "document",
    "documentUrl",
    "emergencyContact",
  ];
  for (const field of protectedFields) {
    expect(visible[field]).toBeUndefined();
    expect(
      (
        await call(reception, `/records/patients/${patient.id}`, "PUT", {
          ...visible,
          [field]: "",
          name: "Must not persist",
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await call(reception, "/records/patients", "POST", {
          name: "Must not create",
          dob: "1991-05-06",
          sex: "Male",
          status: "Active",
          [field]: "",
        })
      ).status,
    ).toBe(403);
  }
  await reception.goto("/#patients");
  await reception
    .getByRole("button", { name: "Add patient", exact: true })
    .click();
  for (const label of [
    "Allergies",
    "Chronic conditions",
    "Medical history",
    "Blood group",
    "Patient identifier",
    "Emergency contact",
  ])
    await expect(
      reception.getByRole("dialog").getByLabel(label, { exact: true }),
    ).toHaveCount(0);
  await expect(
    reception.getByText(
      "Registration details only. Protected patient fields are managed by the clinical team.",
    ),
  ).toBeVisible();
  await reception.screenshot({
    path: `${screenshots}/reception-registration-en.png`,
  });
  await reception
    .getByRole("dialog")
    .getByLabel("Full name")
    .fill("Fictional Reception Registration");
  await reception
    .getByRole("dialog")
    .getByLabel("Date of birth")
    .fill("1991-05-06");
  await reception.getByRole("dialog").getByLabel("Sex").selectOption("Male");
  await reception.getByRole("button", { name: "Create record" }).click();
  await expect(reception.getByRole("dialog")).toHaveCount(0);
  expect(
    (
      await call(reception, `/records/patients/${patient.id}`, "PUT", {
        ...visible,
        name: "Fictional Demographics Updated",
      })
    ).status,
  ).toBe(200);
  const after = ((await call(page, "/records")).body as any).records.find(
    (r: any) => r.id === patient.id,
  );
  expect(after.name).toBe("Fictional Demographics Updated");
  for (const field of protectedFields)
    expect(after[field]).toEqual(patient[field]);
  await reception.getByRole("button", { name: "Change language" }).click();
  await reception.setViewportSize({ width: 390, height: 844 });
  await reception
    .getByRole("button", { name: "أضف مريض", exact: true })
    .click();
  await expect(reception.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(
    reception.getByText("Record saved", { exact: true }),
  ).toHaveCount(0, { timeout: 10000 });
  await reception.screenshot({
    path: `${screenshots}/reception-registration-ar-mobile.png`,
  });
  expect(
    await reception.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await context.close();
});

test("demo removal preserves uploaded documents and manually linked records", async ({
  page,
}) => {
  await demo(page);
  const rows = ((await call(page, "/records")).body as any).records;
  const patient = rows.find((r: any) => r.module === "patients");
  const staff = rows.find((r: any) => r.module === "staff");
  const lab = rows.find((r: any) => r.module === "lab");
  const linkedLab = await call(page, "/records/lab", "POST", {
    ...lab,
    name: "Fictional linked lab",
    status: "Requested",
  });
  expect(linkedLab.status).toBe(201);
  const linkedDepartment = await call(page, "/records/staff", "POST", {
    ...staff,
    name: "Fictional manually added doctor",
  });
  expect(linkedDepartment.status).toBe(201);
  const uploaded = await page.evaluate(
    async ({ id }) => {
      const s = await (await fetch("/api/session")).json();
      const form = new FormData();
      form.append(
        "file",
        new File(
          ["%PDF-1.4\nFictional safety test\n%%EOF"],
          "fictional-preserved.pdf",
          { type: "application/pdf" },
        ),
      );
      const r = await fetch("/api/documents/" + id, {
        method: "POST",
        headers: { "X-CSRF-Token": s.csrf },
        body: form,
      });
      return { status: r.status, body: await r.json() };
    },
    { id: patient.id },
  );
  expect(uploaded.status).toBe(201);
  await page.goto("/#settings");
  await page.getByRole("switch", { name: "Demo mode" }).click();
  await expect(
    page.getByText(
      "Demo data has linked records or uploaded documents. Remove those links explicitly before turning demo mode off.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.getByRole("switch", { name: "Demo mode" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await page.screenshot({
    path: `${screenshots}/demo-removal-blocked-en.png`,
    fullPage: true,
  });
  const download = await page.request.get("/api/document/" + uploaded.body.id);
  expect(download.status()).toBe(200);
  expect(await download.text()).toContain("Fictional safety test");
  expect(((await call(page, "/records")).body as any).records).toHaveLength(
    rows.length + 2,
  );
  expect(
    (await call(page, "/document/" + uploaded.body.id, "DELETE")).status,
  ).toBe(200);
  // Linked patient/doctor references remain protected even without documents.
  expect(
    (await call(page, "/settings/demo", "POST", { on: false })).status,
  ).toBe(409);
  expect(
    (await call(page, "/records/lab/" + (linkedLab.body as any).id, "DELETE"))
      .status,
  ).toBe(200);
  // Department references have no SQL foreign key, so test them separately.
  expect(
    (await call(page, "/settings/demo", "POST", { on: false })).status,
  ).toBe(409);
  await page.getByRole("button", { name: "Change language" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("switch", { name: "الوضع التجريبي" }).click();
  await expect(
    page.getByText(
      "البيانات التجريبية مرتبطة بسجلات أو مستندات مرفوعة. راجع الروابط دي وشيلها بنفسك قبل ما تقفل الوضع التجريبي.",
      { exact: true },
    ),
  ).toBeVisible();
  await page.screenshot({
    path: `${screenshots}/demo-removal-blocked-ar-mobile.png`,
    fullPage: true,
  });
  expect(
    (
      await call(
        page,
        "/records/staff/" + (linkedDepartment.body as any).id,
        "DELETE",
      )
    ).status,
  ).toBe(200);
  expect(
    (await call(page, "/settings/demo", "POST", { on: false })).status,
  ).toBe(200);
  expect(((await call(page, "/records")).body as any).records).toEqual([]);
});
