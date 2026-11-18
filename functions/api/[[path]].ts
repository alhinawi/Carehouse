import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import {
  can,
  modules,
  moduleKeys,
  roles,
  validate,
  type ModuleKey,
  type RecordData,
} from "../../src/domain";
import { seedRecords } from "../../src/seed";
import { BUSY_ERROR, isBusyError } from "../../src/errors";
type Env = { DB: D1Database; ENCRYPTION_KEY: string };
type Session = {
  id: string;
  workspace_id: string;
  user_id: string | null;
  name: string;
  role: string;
  csrf: string;
  expires_at: string;
};
const app = new Hono<{
  Bindings: Env;
  Variables: { session: Session };
}>().basePath("/api");
app.use(
  "*",
  bodyLimit({
    maxSize: 140000,
    onError: (c) => c.json({ error: "Request is too large" }, 413),
  }),
);
const now = () => new Date().toISOString();
const uid = () => crypto.randomUUID();
// Bump the workspace data version on every records mutation so clients can
// revalidate their cached record list with a one-row read instead of
// re-reading the whole workspace.
async function touch(env: Env, workspace: string) {
  await env.DB.prepare(
    "UPDATE workspaces SET data_version=data_version+1 WHERE id=?",
  )
    .bind(workspace)
    .run();
}
const enc = new TextEncoder(),
  dec = new TextDecoder();
const b64 = (v: Uint8Array) => btoa(String.fromCharCode(...v));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
// Cache the non-extractable AES-GCM key per isolate: deriving it used to run
// once per encrypt/decrypt call and dominated CPU on record-heavy requests.
const keyCache = new Map<string, Promise<CryptoKey>>();
async function key(secret: string) {
  if (!secret || secret.length < 32)
    throw new Error("Encryption key is not configured");
  let cached = keyCache.get(secret);
  if (!cached) {
    cached = crypto.subtle
      .digest("SHA-256", enc.encode(secret))
      .then((digest) =>
        crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, [
          "encrypt",
          "decrypt",
        ]),
      );
    cached.catch(() => keyCache.delete(secret));
    keyCache.set(secret, cached);
  }
  return cached;
}
async function encrypt(data: unknown, secret: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  return (
    b64(iv) +
    "." +
    b64(
      new Uint8Array(
        await crypto.subtle.encrypt(
          { name: "AES-GCM", iv },
          await key(secret),
          enc.encode(JSON.stringify(data)),
        ),
      ),
    )
  );
}
async function decrypt(data: string, secret: string) {
  const [iv, cipher] = data.split(".");
  return JSON.parse(
    dec.decode(
      await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: unb64(iv) },
        await key(secret),
        unb64(cipher),
      ),
    ),
  );
}
// PBKDF2-SHA-256 at 100,000 iterations. This is the highest iteration count
// WebCrypto on Workers accepts, and a single verify already costs several
// times the free plan's 10 ms CPU budget, so everything else on the
// authentication path is kept as cheap as possible. Never lower the count:
// the iterations are what makes a stolen database expensive to crack.
async function passwordHash(
  password: string,
  salt = crypto.getRandomValues(new Uint8Array(16)),
) {
  const material = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const hash = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    material,
    256,
  );
  return b64(salt) + "." + b64(new Uint8Array(hash));
}
function constantEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++)
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}
async function log(
  env: Env,
  s: Session,
  action: string,
  module: string,
  id = "",
  detail = "",
) {
  await env.DB.prepare("INSERT INTO audit_logs VALUES(?,?,?,?,?,?,?,?,?)")
    .bind(
      uid(),
      s.workspace_id,
      s.name,
      s.role,
      action,
      module,
      id,
      detail,
      now(),
    )
    .run();
}
async function createRecord(
  env: Env,
  workspace: string,
  module: ModuleKey,
  data: Record<string, unknown>,
  id = uid(),
  demo = 0,
) {
  const payload = await encrypt(data, env.ENCRYPTION_KEY);
  return env.DB.prepare(
    "INSERT INTO records (id,workspace_id,module,name,status,department,patient_id,staff_id,scheduled_at,amount,payload,created_at,updated_at,duration,demo) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
  ).bind(
    id,
    workspace,
    module,
    "[encrypted]",
    String(data.status),
    String(data.department || ""),
    data.patientId || null,
    data.staffId || null,
    data.scheduledAt || null,
    Number(data.amount || 0),
    payload,
    now(),
    now(),
    Number(data.duration || 30),
    demo,
  );
}
async function unpack(env: Env, row: any): Promise<RecordData> {
  return {
    ...(await decrypt(row.payload, env.ENCRYPTION_KEY)),
    id: row.id,
    module: row.module,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    demo: !!row.demo,
  };
}
// Insert the fictional seed set flagged demo=1 so demo mode can later remove
// exactly these rows without touching real data. Encrypts run concurrently
// against the cached key instead of one awaited key derivation per row.
async function seedDemoRecords(env: Env, workspace: string) {
  const records = seedRecords();
  const ids = Object.fromEntries(records.map((r) => [r.id, uid()]));
  const statements = await Promise.all(
    records.map(({ module, id: oldId, ...data }) => {
      if (data.patientId) data.patientId = ids[String(data.patientId)];
      if (data.staffId) data.staffId = ids[String(data.staffId)];
      return createRecord(env, workspace, module, data, ids[oldId], 1);
    }),
  );
  await env.DB.batch(statements);
  return statements.length;
}
async function initWorkspace(env: Env, name: string) {
  const id = uid();
  await env.DB.prepare(
    "INSERT INTO workspaces (id,name,demo,retention_days,created_at) VALUES(?,?,1,90,?)",
  )
    .bind(id, name, now())
    .run();
  await seedDemoRecords(env, id);
  await touch(env, id);
  return id;
}
async function startSession(
  c: any,
  workspace: string,
  name: string,
  role: string,
  userId: string | null,
) {
  const s = {
    id: uid() + uid(),
    workspace_id: workspace,
    user_id: userId,
    name,
    role,
    csrf: uid(),
    expires_at: new Date(Date.now() + 8 * 3600000).toISOString(),
  };
  await c.env.DB.prepare("INSERT INTO sessions VALUES(?,?,?,?,?,?,?)")
    .bind(s.id, workspace, userId, name, role, s.csrf, s.expires_at)
    .run();
  const old = getCookie(c, "careline_session");
  setCookie(c, "careline_session", s.id, {
    httpOnly: true,
    secure: new URL(c.req.url).protocol === "https:",
    sameSite: "Strict",
    path: "/",
    maxAge: 28800,
  });
  // Old-session cleanup and the audit write do not change the response, so
  // they run after it and sign-in returns without waiting on two D1 writes.
  c.executionCtx.waitUntil(
    (async () => {
      if (old)
        await c.env.DB.prepare("DELETE FROM sessions WHERE id=?")
          .bind(old)
          .run();
      await log(c.env, s, "sign-in", "session");
    })(),
  );
  return c.json({ user: { name, role }, csrf: s.csrf });
}
app.use("*", async (c, next) => {
  c.header("Cache-Control", "no-store");
  c.header("X-Content-Type-Options", "nosniff");
  if (["POST", "PUT", "PATCH", "DELETE"].includes(c.req.method)) {
    const origin = c.req.header("Origin");
    if (!origin || origin !== new URL(c.req.url).origin)
      return c.json({ error: "Invalid request origin" }, 403);
    const len = Number(c.req.header("content-length") || 0);
    if (len > (c.req.path.startsWith("/api/documents/") ? 140000 : 65536))
      return c.json({ error: "Request is too large" }, 413);
  }
  await next();
});
app.use("/auth/*", async (c, next) => {
  if (c.req.method === "POST") {
    const ip = c.req.header("CF-Connecting-IP") || "local";
    const k = "auth:" + ip;
    const limit = await c.env.DB.prepare(
      "SELECT * FROM auth_limits WHERE key=?",
    )
      .bind(k)
      .first<any>();
    const t = Date.now();
    if (limit && limit.reset_at > t && limit.attempts >= 30)
      return c.json(
        { error: "Too many attempts. Try again in 15 minutes." },
        429,
      );
    await c.env.DB.prepare(
      "INSERT INTO auth_limits VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN reset_at<? THEN 1 ELSE attempts+1 END, reset_at=CASE WHEN reset_at<? THEN excluded.reset_at ELSE reset_at END",
    )
      .bind(k, t + 900000, t, t)
      .run();
  }
  await next();
});
app.get("/locale", (c) => {
  const country = (c.req.raw as any).cf?.country;
  const languages = c.req.header("Accept-Language") || "";
  return c.json({
    language:
      country === "EG" || /(^|,)\s*ar(?:-|;|,|$)/i.test(languages)
        ? "ar"
        : "en",
  });
});
app.post("/auth/demo", async (c) => {
  const body = await c.req.json();
  const role = String(body.role || "admin");
  if (!roles.includes(role as any))
    return c.json({ error: "Invalid role" }, 400);
  const workspace = await initWorkspace(c.env, "Fictional Careline Hospital");
  return startSession(c, workspace, "Demo " + role, role, null);
});
app.post("/auth/register", async (c) => {
  const b = await c.req.json();
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email || "") ||
    String(b.password || "").length < 12 ||
    String(b.password || "").length > 128 ||
    !String(b.name || "").trim() ||
    String(b.name).length > 100
  )
    return c.json(
      {
        error: "Enter a name, valid email and a password of 12–128 characters.",
      },
      400,
    );
  if (
    await c.env.DB.prepare("SELECT id FROM users WHERE email=?")
      .bind(String(b.email).toLowerCase())
      .first()
  )
    return c.json({ error: "Unable to create account. Try signing in." }, 409);
  const workspace = await initWorkspace(c.env, "Fictional Careline Hospital"),
    id = uid();
  await c.env.DB.prepare("INSERT INTO users VALUES(?,?,?,?,?,?,?)")
    .bind(
      id,
      workspace,
      String(b.email).toLowerCase(),
      b.name,
      await passwordHash(b.password),
      "admin",
      now(),
    )
    .run();
  return startSession(c, workspace, b.name, "admin", id);
});
app.post("/auth/login", async (c) => {
  const b = await c.req.json();
  if (String(b.password || "").length > 128)
    return c.json({ error: "Invalid email or password" }, 401);
  const u = await c.env.DB.prepare("SELECT * FROM users WHERE email=?")
    .bind(String(b.email || "").toLowerCase())
    .first<any>();
  if (
    !u ||
    !constantEqual(
      await passwordHash(
        String(b.password || ""),
        unb64(u.password_hash.split(".")[0]),
      ),
      u.password_hash,
    )
  )
    return c.json({ error: "Invalid email or password" }, 401);
  return startSession(c, u.workspace_id, u.name, u.role, u.id);
});
app.use("*", async (c, next) => {
  const token = getCookie(c, "careline_session");
  const session = token
    ? await c.env.DB.prepare(
        "SELECT * FROM sessions WHERE id=? AND expires_at>?",
      )
        .bind(token, now())
        .first<Session>()
    : null;
  if (!session) return c.json({ error: "Sign in to continue" }, 401);
  if (
    ["POST", "PUT", "PATCH", "DELETE"].includes(c.req.method) &&
    c.req.header("X-CSRF-Token") !== session.csrf
  )
    return c.json(
      { error: "Session verification failed. Refresh and try again." },
      403,
    );
  c.set("session", session);
  await next();
});
app.get("/session", async (c) => {
  const s = c.get("session"),
    ws = await c.env.DB.prepare(
      "SELECT name,retention_days,demo FROM workspaces WHERE id=?",
    )
      .bind(s.workspace_id)
      .first();
  return c.json({
    user: { name: s.name, role: s.role },
    csrf: s.csrf,
    workspace: ws,
  });
});
app.post("/logout", async (c) => {
  await c.env.DB.prepare("DELETE FROM sessions WHERE id=?")
    .bind(c.get("session").id)
    .run();
  deleteCookie(c, "careline_session", { path: "/" });
  return c.json({ ok: true });
});
app.get("/records", async (c) => {
  const s = c.get("session");
  const allowed = moduleKeys.filter((m) => can(s.role, m));
  if (!allowed.length) return c.json({ records: [], version: 0 });
  // Hot-path revalidation: a client that already holds the current version
  // costs one primary-key read instead of re-reading every workspace row.
  const known = Number(c.req.query("v") || 0);
  const wsVersion = await c.env.DB.prepare(
    "SELECT data_version FROM workspaces WHERE id=?",
  )
    .bind(s.workspace_id)
    .first<any>();
  const version = Number(wsVersion?.data_version || 0);
  if (known && known === version) return c.json({ unchanged: true, version });
  const result = await c.env.DB.prepare(
    `SELECT * FROM records WHERE workspace_id=? AND module IN (${allowed.map(() => "?").join(",")}) ORDER BY created_at DESC LIMIT 2000`,
  )
    .bind(s.workspace_id, ...allowed)
    .all();
  await log(
    c.env,
    s,
    "read",
    "records",
    "",
    JSON.stringify({
      recordIds: result.results.map((r) => r.id),
      scope: "authorized list",
    }),
  );
  const records = [];
  for (const row of result.results) {
    const r = await unpack(c.env, row);
    if (s.role === "pharmacist" && r.module === "emr" && r.status !== "Signed")
      continue;
    if (
      !["admin", "doctor", "nurse"].includes(s.role) &&
      r.module === "patients"
    ) {
      for (const f of [
        "allergies",
        "conditions",
        "history",
        "nationalId",
        "document",
        "documentUrl",
        "emergencyContact",
      ])
        delete r[f];
    }
    if (s.role === "pharmacist" && r.module === "emr") {
      for (const f of ["clinicalNotes", "treatment", "vitals", "followUp"])
        delete r[f];
      r.name = "Prescription · " + r.id.slice(0, 8);
    }
    if (
      ["billing", "pharmacist", "lab"].includes(s.role) &&
      r.module === "patients"
    ) {
      for (const k of Object.keys(r)) {
        if (
          ![
            "id",
            "name",
            "module",
            "status",
            "version",
            "createdAt",
            "updatedAt",
          ].includes(k)
        )
          delete r[k];
      }
    }
    records.push(r);
  }
  return c.json({ records, version });
});
async function checkRefs(
  env: Env,
  s: Session,
  module: ModuleKey,
  data: Record<string, unknown>,
  id?: string,
) {
  if (data.department) {
    const departmentRows = await env.DB.prepare(
      "SELECT * FROM records WHERE workspace_id=? AND module='departments'",
    )
      .bind(s.workspace_id)
      .all();
    let exists = false;
    for (const row of departmentRows.results) {
      const d = await unpack(env, row);
      if (d.name === data.department) {
        exists = true;
        break;
      }
    }
    if (!exists) return "Choose an existing department";
  }
  for (const [field, expected] of [
    ["patientId", "patients"],
    ["staffId", "staff"],
  ]) {
    if (data[field]) {
      const row = await env.DB.prepare(
        "SELECT module FROM records WHERE id=? AND workspace_id=?",
      )
        .bind(data[field], s.workspace_id)
        .first<any>();
      if (!row || row.module !== expected) return "Invalid linked " + field;
    }
  }
  if (
    module === "appointments" &&
    !["Cancelled", "No-show"].includes(String(data.status))
  ) {
    const doctorRow = await env.DB.prepare(
      "SELECT * FROM records WHERE id=? AND workspace_id=?",
    )
      .bind(data.staffId, s.workspace_id)
      .first<any>();
    const staff = await unpack(env, doctorRow);
    if (staff.job !== "Doctor") return "Appointments require a doctor";
    if (["On leave", "Off duty"].includes(staff.status))
      return "Doctor is unavailable";
    const date = String(data.scheduledAt),
      time = date.slice(11, 16),
      day = new Date(date.slice(0, 10) + "T12:00:00Z").getUTCDay();
    if (
      !String(staff.workingDays).split(",").includes(String(day)) ||
      time < String(staff.scheduleStart) ||
      time >= String(staff.scheduleEnd)
    )
      return "Appointment is outside the doctor schedule";
    const end = new Date(date).getTime() + Number(data.duration) * 60000;
    if (
      new Date(date.slice(0, 10) + "T" + String(staff.scheduleEnd)).getTime() <
      end
    )
      return "Appointment ends after the doctor shift";
    const existing = await env.DB.prepare(
      "SELECT * FROM records WHERE workspace_id=? AND module='appointments' AND staff_id=? AND status NOT IN ('Cancelled','No-show') AND id!=?",
    )
      .bind(s.workspace_id, data.staffId, id || "")
      .all<any>();
    for (const row of existing.results) {
      const other = await unpack(env, row);
      const start = new Date(date).getTime(),
        os = new Date(String(other.scheduledAt)).getTime(),
        oe = os + Number(other.duration) * 60000;
      if (start < oe && end > os)
        return "This doctor already has an overlapping appointment";
    }
  }
  if (module === "beds" && data.patientId) {
    const bed = await env.DB.prepare(
      "SELECT id FROM records WHERE workspace_id=? AND module='beds' AND patient_id=? AND status='Occupied' AND id!=?",
    )
      .bind(s.workspace_id, data.patientId, id || "")
      .first();
    if (bed) return "Patient already has a bed. Use Transfer instead.";
  }
  return null;
}
function cleanData(module: ModuleKey, b: any) {
  return Object.fromEntries(
    [...modules[module].fields.map((f) => f.key), "status"]
      .filter((k) => b[k] !== undefined)
      .map((k) => [k, typeof b[k] === "string" ? b[k].trim() : b[k]]),
  );
}
app.post("/records/:module", async (c) => {
  const s = c.get("session"),
    m = c.req.param("module") as ModuleKey;
  if (!moduleKeys.includes(m) || !can(s.role, m, true))
    return c.json(
      { error: "You do not have permission to create this record" },
      403,
    );
  const data = cleanData(m, await c.req.json());
  if (m === "pharmacy" && data.status !== "Quarantined")
    data.status =
      Number(data.stock) === 0
        ? "Out of stock"
        : Number(data.stock) <= Number(data.reorder)
          ? "Low stock"
          : "In stock";
  if (m === "billing") {
    data.paid = 0;
    data.payments = [];
    if (!["Draft", "Issued"].includes(String(data.status)))
      return c.json({ error: "New invoices must be Draft or Issued" }, 400);
  }
  const errors = validate(m, data);
  if (errors.length) return c.json({ error: errors.join(". ") }, 400);
  const refError = await checkRefs(c.env, s, m, data);
  if (refError) return c.json({ error: refError }, 409);
  const id = uid();
  await (await createRecord(c.env, s.workspace_id, m, data, id)).run();
  await touch(c.env, s.workspace_id);
  await log(c.env, s, "create", m, id);
  return c.json({ id }, 201);
});
app.put("/records/:module/:id", async (c) => {
  const s = c.get("session"),
    m = c.req.param("module") as ModuleKey,
    id = c.req.param("id");
  if (!moduleKeys.includes(m) || !can(s.role, m, true))
    return c.json(
      { error: "You do not have permission to edit this record" },
      403,
    );
  const row = await c.env.DB.prepare(
    "SELECT * FROM records WHERE id=? AND workspace_id=? AND module=?",
  )
    .bind(id, s.workspace_id, m)
    .first<any>();
  if (!row) return c.json({ error: "Record not found" }, 404);
  const old = await unpack(c.env, row),
    b = await c.req.json();
  if (Number(b.version) !== row.version)
    return c.json({ error: "Record changed. Refresh before editing." }, 409);
  if (m === "emr" && old.status === "Signed")
    return c.json(
      { error: "Signed records are immutable. Add a new encounter." },
      409,
    );
  const data = { ...old, ...cleanData(m, b) };
  if (m === "departments" && data.name !== old.name) {
    const linkedDepartment = await c.env.DB.prepare(
      "SELECT id FROM records WHERE workspace_id=? AND department=? LIMIT 1",
    )
      .bind(s.workspace_id, old.name)
      .first();
    if (linkedDepartment)
      return c.json(
        {
          error:
            "Reassign linked staff, appointments and beds before renaming this department",
        },
        409,
      );
  }

  if (m === "pharmacy" && data.status !== "Quarantined")
    data.status =
      Number(data.stock) === 0
        ? "Out of stock"
        : Number(data.stock) <= Number(data.reorder)
          ? "Low stock"
          : "In stock";
  if (m === "billing") {
    data.paid = old.paid || 0;
    data.payments = old.payments || [];
    if (Number(data.amount) < Number(data.paid))
      return c.json(
        { error: "Invoice total cannot be less than payments" },
        400,
      );
    if (Number(data.paid) > 0)
      data.status =
        Number(data.paid) >= Number(data.amount) ? "Paid" : "Partially paid";
    else if (["Paid", "Partially paid"].includes(data.status))
      return c.json(
        { error: "Use Record payment to update payment status" },
        400,
      );
  }
  const errors = validate(m, data);
  if (errors.length) return c.json({ error: errors.join(". ") }, 400);
  const err = await checkRefs(c.env, s, m, data, id);
  if (err) return c.json({ error: err }, 409);
  const result = await c.env.DB.prepare(
    "UPDATE records SET status=?,department=?,patient_id=?,staff_id=?,scheduled_at=?,amount=?,duration=?,payload=?,version=version+1,updated_at=? WHERE id=? AND workspace_id=? AND version=?",
  )
    .bind(
      data.status,
      String(data.department || ""),
      data.patientId || null,
      data.staffId || null,
      data.scheduledAt || null,
      Number(data.amount || 0),
      Number(data.duration || 30),
      await encrypt(data, c.env.ENCRYPTION_KEY),
      now(),
      id,
      s.workspace_id,
      row.version,
    )
    .run();
  if (!result.meta.changes)
    return c.json({ error: "Record changed. Refresh before editing." }, 409);
  await touch(c.env, s.workspace_id);
  await log(c.env, s, "update", m, id);
  return c.json({ ok: true });
});
app.delete("/records/:module/:id", async (c) => {
  const s = c.get("session"),
    m = c.req.param("module") as ModuleKey,
    id = c.req.param("id");
  if (s.role !== "admin")
    return c.json({ error: "Only administrators can delete records" }, 403);
  const row = await c.env.DB.prepare(
    "SELECT * FROM records WHERE id=? AND workspace_id=? AND module=?",
  )
    .bind(id, s.workspace_id, m)
    .first<any>();
  if (!row) return c.json({ error: "Record not found" }, 404);
  if (
    (m === "emr" && row.status === "Signed") ||
    (m === "beds" && row.status === "Occupied")
  )
    return c.json(
      { error: "Signed encounters and occupied beds cannot be deleted" },
      409,
    );
  const data = await unpack(c.env, row);
  if (m === "billing" && Number(data.paid) > 0)
    return c.json({ error: "Paid invoices must be retained" }, 409);
  if (m === "departments") {
    const linkedDepartment = await c.env.DB.prepare(
      "SELECT id FROM records WHERE workspace_id=? AND department=? LIMIT 1",
    )
      .bind(s.workspace_id, data.name)
      .first();
    if (linkedDepartment)
      return c.json(
        { error: "This department has linked records and must be retained" },
        409,
      );
  }
  const docs = await c.env.DB.prepare(
    "SELECT id FROM documents WHERE workspace_id=? AND patient_id=? LIMIT 1",
  )
    .bind(s.workspace_id, id)
    .first();
  if (docs)
    return c.json(
      {
        error:
          "Remove linked demonstration documents before deleting the patient",
      },
      409,
    );
  const linked = await c.env.DB.prepare(
    "SELECT id FROM records WHERE workspace_id=? AND (patient_id=? OR staff_id=?) LIMIT 1",
  )
    .bind(s.workspace_id, id, id)
    .first();
  if (linked)
    return c.json(
      { error: "This record has linked records and must be retained" },
      409,
    );
  await c.env.DB.prepare("DELETE FROM records WHERE id=? AND workspace_id=?")
    .bind(id, s.workspace_id)
    .run();
  await touch(c.env, s.workspace_id);
  await log(c.env, s, "delete", m, id);
  return c.json({ ok: true });
});
app.post("/workflow/:module/:id", async (c) => {
  const s = c.get("session"),
    m = c.req.param("module") as ModuleKey,
    id = c.req.param("id");
  if (!can(s.role, m, true))
    return c.json(
      { error: "You do not have permission for this workflow" },
      403,
    );
  const b = await c.req.json(),
    row = await c.env.DB.prepare(
      "SELECT * FROM records WHERE id=? AND workspace_id=? AND module=?",
    )
      .bind(id, s.workspace_id, m)
      .first<any>();
  if (!row) return c.json({ error: "Record not found" }, 404);
  const data = await unpack(c.env, row);
  let action = "";
  if (m === "pharmacy" && b.action === "dispense") {
    const qty = Number(b.quantity);
    if (!Number.isInteger(qty) || qty < 1 || qty > Number(data.stock))
      return c.json(
        { error: "Enter a whole quantity within available stock" },
        400,
      );
    if (
      String(data.expiry) < now().slice(0, 10) ||
      data.status === "Quarantined"
    )
      return c.json(
        { error: "Expired or quarantined medicines cannot be dispensed" },
        409,
      );
    const encounterRow = await c.env.DB.prepare(
      "SELECT * FROM records WHERE id=? AND workspace_id=? AND module='emr' AND status='Signed'",
    )
      .bind(String(b.encounterId || ""), s.workspace_id)
      .first<any>();
    if (!encounterRow)
      return c.json({ error: "A signed encounter reference is required" }, 400);
    const encounter = await unpack(c.env, encounterRow);
    if (
      !encounter.prescription ||
      String(encounter.prescription).startsWith("No active prescription")
    )
      return c.json(
        { error: "This encounter has no active prescription" },
        409,
      );
    data.stock = Number(data.stock) - qty;
    data.status =
      Number(data.stock) === 0
        ? "Out of stock"
        : Number(data.stock) <= Number(data.reorder)
          ? "Low stock"
          : "In stock";
    data.dispenses = [
      ...(Array.isArray(data.dispenses) ? data.dispenses : []),
      { quantity: qty, encounterId: encounterRow.id, at: now(), actor: s.name },
    ];
    action = "dispense";
  } else if (m === "billing" && b.action === "payment") {
    const amount = Number(b.amount),
      paid = Number(data.paid || 0);
    if (
      ["Draft", "Void"].includes(data.status) ||
      !Number.isFinite(amount) ||
      Math.abs(Math.round(amount * 100) - amount * 100) > 0.00001 ||
      amount <= 0 ||
      amount > Number(data.amount) - paid
    )
      return c.json(
        {
          error:
            "Enter a payment no greater than the outstanding amount on an issued invoice",
        },
        400,
      );
    if (!["Cash", "Card", "Bank transfer", "Insurance"].includes(b.method))
      return c.json({ error: "Select a valid payment method" }, 400);
    data.paid = Math.round((paid + amount) * 100) / 100;
    data.status =
      Number(data.paid) >= Number(data.amount) ? "Paid" : "Partially paid";
    data.payments = [
      ...(Array.isArray(data.payments) ? data.payments : []),
      { amount, method: b.method, at: now(), actor: s.name },
    ];
    action = "payment";
  } else if (m === "beds" && b.action === "discharge") {
    if (data.status !== "Occupied")
      return c.json({ error: "Only occupied beds can be discharged" }, 409);
    data.lastAdmission = {
      patientId: data.patientId,
      admittedAt: data.admittedAt,
      dischargedAt: now(),
    };
    data.patientId = "";
    data.status = "Cleaning";
    action = "discharge";
  } else if (m === "beds" && b.action === "transfer") {
    const target = await c.env.DB.prepare(
      "SELECT * FROM records WHERE id=? AND workspace_id=? AND module='beds' AND status='Available'",
    )
      .bind(String(b.targetId), s.workspace_id)
      .first<any>();
    if (data.status !== "Occupied" || !target)
      return c.json(
        {
          error:
            "Transfer requires an occupied bed and an available destination",
        },
        409,
      );
    const dest = await unpack(c.env, target);
    dest.patientId = data.patientId;
    dest.admittedAt = data.admittedAt;
    dest.status = "Occupied";
    dest.notes = "Transferred from " + data.name;
    data.patientId = "";
    data.status = "Cleaning";
    const guardId = uid();
    const results = await c.env.DB.batch([
      c.env.DB.prepare(
        "UPDATE records SET patient_id=NULL,status='Cleaning',payload=?,version=version+1,updated_at=? WHERE id=? AND version=?",
      ).bind(await encrypt(data, c.env.ENCRYPTION_KEY), now(), id, row.version),
      c.env.DB.prepare("INSERT INTO mutation_guards VALUES(?,changes())").bind(
        guardId + "-1",
      ),
      c.env.DB.prepare(
        "UPDATE records SET patient_id=?,status='Occupied',payload=?,version=version+1,updated_at=? WHERE id=? AND version=?",
      ).bind(
        dest.patientId,
        await encrypt(dest, c.env.ENCRYPTION_KEY),
        now(),
        target.id,
        target.version,
      ),
      c.env.DB.prepare("INSERT INTO mutation_guards VALUES(?,changes())").bind(
        guardId + "-2",
      ),
      c.env.DB.prepare("DELETE FROM mutation_guards WHERE id IN (?,?)").bind(
        guardId + "-1",
        guardId + "-2",
      ),
    ]);
    if (!results[0].meta.changes || !results[2].meta.changes)
      return c.json(
        { error: "Beds changed. Refresh to verify transfer." },
        409,
      );
    await touch(c.env, s.workspace_id);
    await log(c.env, s, "transfer", m, id, "Bed transfer");
    return c.json({ ok: true });
  } else return c.json({ error: "Unsupported workflow" }, 400);
  const result = await c.env.DB.prepare(
    "UPDATE records SET status=?,patient_id=?,payload=?,version=version+1,updated_at=? WHERE id=? AND workspace_id=? AND version=?",
  )
    .bind(
      data.status,
      data.patientId || null,
      await encrypt(data, c.env.ENCRYPTION_KEY),
      now(),
      id,
      s.workspace_id,
      row.version,
    )
    .run();
  if (!result.meta.changes)
    return c.json({ error: "Record changed. Refresh and try again." }, 409);
  await touch(c.env, s.workspace_id);
  await log(c.env, s, action, m, id);
  return c.json({ ok: true });
});
app.post("/access/:module/:id", async (c) => {
  const s = c.get("session"),
    module = c.req.param("module"),
    id = c.req.param("id");
  if (!can(s.role, module)) return c.json({ error: "Access denied" }, 403);
  const row = await c.env.DB.prepare(
    "SELECT id FROM records WHERE id=? AND workspace_id=? AND module=?",
  )
    .bind(id, s.workspace_id, module)
    .first();
  if (!row) return c.json({ error: "Record not found" }, 404);
  await log(c.env, s, "view", module, id);
  return c.json({ ok: true });
});
app.get("/audit", async (c) => {
  const s = c.get("session");
  if (!["admin", "auditor"].includes(s.role))
    return c.json({ error: "Audit access is restricted" }, 403);
  const r = await c.env.DB.prepare(
    "SELECT actor,role,action,module,record_id,detail,created_at FROM audit_logs WHERE workspace_id=? ORDER BY created_at DESC LIMIT 250",
  )
    .bind(s.workspace_id)
    .all();
  return c.json({ logs: r.results });
});
app.put("/settings", async (c) => {
  const s = c.get("session");
  if (s.role !== "admin")
    return c.json({ error: "Administrator access required" }, 403);
  const b = await c.req.json(),
    days = Number(b.retentionDays);
  if (!Number.isInteger(days) || days < 7 || days > 3650)
    return c.json({ error: "Retention must be 7–3650 days" }, 400);
  await c.env.DB.prepare("UPDATE workspaces SET retention_days=? WHERE id=?")
    .bind(days, s.workspace_id)
    .run();
  await log(c.env, s, "settings", "retention", "", "Retention policy updated");
  return c.json({ ok: true });
});
// Demo mode: administrators fill the workspace with the flagged fictional
// seed set, or remove exactly the flagged rows. Real data is never touched.
app.post("/settings/demo", async (c) => {
  const s = c.get("session");
  if (s.role !== "admin")
    return c.json({ error: "Administrator access required" }, 403);
  const b = await c.req.json().catch(() => ({}) as any);
  if (b.on) {
    const existing = await c.env.DB.prepare(
      "SELECT COUNT(*) AS n FROM records WHERE workspace_id=? AND demo=1",
    )
      .bind(s.workspace_id)
      .first<any>();
    const added =
      existing && Number(existing.n) > 0
        ? 0
        : await seedDemoRecords(c.env, s.workspace_id);
    await touch(c.env, s.workspace_id);
    await log(c.env, s, "settings", "demo", "", "Demo data enabled");
    return c.json({ ok: true, demo: true, added });
  }
  await c.env.DB.prepare(
    "DELETE FROM documents WHERE workspace_id=? AND patient_id IN (SELECT id FROM records WHERE workspace_id=? AND demo=1)",
  )
    .bind(s.workspace_id, s.workspace_id)
    .run();
  const removed = await c.env.DB.prepare(
    "DELETE FROM records WHERE workspace_id=? AND demo=1",
  )
    .bind(s.workspace_id)
    .run();
  await touch(c.env, s.workspace_id);
  await log(c.env, s, "settings", "demo", "", "Demo data removed");
  return c.json({ ok: true, demo: false, removed: removed.meta.changes });
});
app.get("/documents/:patientId", async (c) => {
  const s = c.get("session");
  if (!["admin", "doctor", "nurse"].includes(s.role))
    return c.json({ error: "Clinical access required" }, 403);
  const result = await c.env.DB.prepare(
    "SELECT id,filename,mime_type,byte_size,created_at FROM documents WHERE workspace_id=? AND patient_id=? ORDER BY created_at DESC",
  )
    .bind(s.workspace_id, c.req.param("patientId"))
    .all();
  await log(c.env, s, "read", "documents", c.req.param("patientId"));
  return c.json({ documents: result.results });
});
app.post("/documents/:patientId", async (c) => {
  const s = c.get("session");
  if (!["admin", "doctor"].includes(s.role))
    return c.json({ error: "Doctor or administrator access required" }, 403);
  const patient = await c.env.DB.prepare(
    "SELECT id FROM records WHERE id=? AND workspace_id=? AND module='patients'",
  )
    .bind(c.req.param("patientId"), s.workspace_id)
    .first();
  if (!patient) return c.json({ error: "Patient not found" }, 404);
  const body = await c.req.formData();
  const file = body.get("file");
  if (!file || typeof file === "string")
    return c.json({ error: "Choose a file" }, 400);
  if (
    !["application/pdf", "image/png", "image/jpeg"].includes(file.type) ||
    file.size > 131072 ||
    file.size < 1
  )
    return c.json(
      { error: "Choose a PDF, PNG or JPEG up to 128 KB. Demo files only." },
      400,
    );
  const count = await c.env.DB.prepare(
    "SELECT COUNT(*) AS n FROM documents WHERE workspace_id=? AND patient_id=?",
  )
    .bind(s.workspace_id, c.req.param("patientId"))
    .first<any>();
  if (count.n >= 10)
    return c.json(
      { error: "Maximum 10 demonstration documents per patient" },
      400,
    );
  const bytes = new Uint8Array(await file.arrayBuffer());
  const isPDF =
      bytes[0] === 37 && bytes[1] === 80 && bytes[2] === 68 && bytes[3] === 70,
    isPNG =
      bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71,
    isJPEG = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (
    (file.type === "application/pdf" && !isPDF) ||
    (file.type === "image/png" && !isPNG) ||
    (file.type === "image/jpeg" && !isJPEG)
  )
    return c.json(
      { error: "File content does not match the selected type" },
      400,
    );
  const id = uid(),
    filename = file.name.replace(/[^a-zA-Z0-9._ -]/g, "_").slice(0, 100);
  await c.env.DB.prepare("INSERT INTO documents VALUES(?,?,?,?,?,?,?,?)")
    .bind(
      id,
      s.workspace_id,
      c.req.param("patientId"),
      filename,
      file.type,
      file.size,
      await encrypt({ data: b64(bytes) }, c.env.ENCRYPTION_KEY),
      now(),
    )
    .run();
  await log(c.env, s, "upload", "documents", id);
  return c.json({ id }, 201);
});
app.get("/document/:id", async (c) => {
  const s = c.get("session");
  if (!["admin", "doctor", "nurse"].includes(s.role))
    return c.json({ error: "Clinical access required" }, 403);
  const row = await c.env.DB.prepare(
    "SELECT * FROM documents WHERE id=? AND workspace_id=?",
  )
    .bind(c.req.param("id"), s.workspace_id)
    .first<any>();
  if (!row) return c.json({ error: "Document not found" }, 404);
  const payload = await decrypt(row.payload, c.env.ENCRYPTION_KEY);
  await log(c.env, s, "download", "documents", row.id);
  c.header("Content-Type", row.mime_type);
  c.header(
    "Content-Disposition",
    'attachment; filename="' + row.filename.replace(/["\r\n]/g, "_") + '"',
  );
  c.header("Content-Security-Policy", "default-src 'none'; sandbox");
  return c.body(unb64(payload.data));
});
app.delete("/document/:id", async (c) => {
  const s = c.get("session");
  if (s.role !== "admin")
    return c.json({ error: "Administrator access required" }, 403);
  await c.env.DB.prepare("DELETE FROM documents WHERE id=? AND workspace_id=?")
    .bind(c.req.param("id"), s.workspace_id)
    .run();
  await log(c.env, s, "delete", "documents", c.req.param("id"));
  return c.json({ ok: true });
});
app.get("/users", async (c) => {
  const s = c.get("session");
  if (s.role !== "admin" || !s.user_id)
    return c.json({ error: "Private administrator account required" }, 403);
  const users = await c.env.DB.prepare(
    "SELECT id,name,email,role,created_at FROM users WHERE workspace_id=? ORDER BY created_at",
  )
    .bind(s.workspace_id)
    .all();
  return c.json({ users: users.results });
});
app.post("/users", async (c) => {
  const s = c.get("session");
  if (s.role !== "admin" || !s.user_id)
    return c.json({ error: "Private administrator account required" }, 403);
  const b = await c.req.json();
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email || "") ||
    String(b.password || "").length < 12 ||
    String(b.password || "").length > 128 ||
    !String(b.name || "").trim() ||
    String(b.name).length > 100 ||
    !roles.includes(b.role) ||
    b.role === "admin"
  )
    return c.json(
      {
        error:
          "Enter valid details, a non-administrator role and a password of 12–128 characters.",
      },
      400,
    );
  const count = await c.env.DB.prepare(
    "SELECT COUNT(*) AS n FROM users WHERE workspace_id=?",
  )
    .bind(s.workspace_id)
    .first<any>();
  if (count.n >= 20)
    return c.json(
      { error: "Demonstration workspaces support up to 20 users." },
      400,
    );
  await c.env.DB.prepare("INSERT INTO users VALUES(?,?,?,?,?,?,?)")
    .bind(
      uid(),
      s.workspace_id,
      String(b.email).toLowerCase(),
      b.name,
      await passwordHash(b.password),
      b.role,
      now(),
    )
    .run();
  await log(c.env, s, "create", "users", "", "Team member created");
  return c.json({ ok: true }, 201);
});
app.put("/users/:id", async (c) => {
  const s = c.get("session");
  if (s.role !== "admin" || !s.user_id)
    return c.json({ error: "Private administrator account required" }, 403);
  const id = c.req.param("id"),
    b = await c.req.json();
  if (id === s.user_id)
    return c.json({ error: "You cannot change your own role" }, 400);
  if (!roles.includes(b.role) || b.role === "admin")
    return c.json({ error: "Choose a non-administrator role" }, 400);
  await c.env.DB.prepare(
    "UPDATE users SET role=? WHERE id=? AND workspace_id=?",
  )
    .bind(b.role, id, s.workspace_id)
    .run();
  await c.env.DB.prepare(
    "DELETE FROM sessions WHERE user_id=? AND workspace_id=?",
  )
    .bind(id, s.workspace_id)
    .run();
  await log(
    c.env,
    s,
    "update",
    "users",
    id,
    "Role changed and sessions revoked",
  );
  return c.json({ ok: true });
});
app.delete("/users/:id", async (c) => {
  const s = c.get("session");
  if (s.role !== "admin" || !s.user_id)
    return c.json({ error: "Private administrator account required" }, 403);
  const id = c.req.param("id");
  if (id === s.user_id)
    return c.json({ error: "You cannot remove your own account" }, 400);
  await c.env.DB.batch([
    c.env.DB.prepare(
      "DELETE FROM sessions WHERE user_id=? AND workspace_id=?",
    ).bind(id, s.workspace_id),
    c.env.DB.prepare("DELETE FROM users WHERE id=? AND workspace_id=?").bind(
      id,
      s.workspace_id,
    ),
  ]);
  await log(c.env, s, "delete", "users", id);
  return c.json({ ok: true });
});
app.onError((err, c) => {
  console.error(err.message);
  if (err.message.includes("overlaps") || err.message.includes("CHECK"))
    return c.json(
      {
        error:
          "A concurrent update conflicted with this operation. Refresh and try again.",
      },
      409,
    );
  if (err.message.includes("UNIQUE"))
    return c.json(
      { error: "A conflicting record already exists. Refresh and try again." },
      409,
    );
  if (isBusyError(err)) return c.json({ error: BUSY_ERROR }, 503);
  return c.json(
    { error: "The request could not be completed. Please try again." },
    500,
  );
});
export const onRequest: PagesFunction<Env> = (context) =>
  app.fetch(context.request, context.env, context as any);
