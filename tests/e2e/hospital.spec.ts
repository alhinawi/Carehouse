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
