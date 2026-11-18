export const roles = [
  "admin",
  "doctor",
  "nurse",
  "reception",
  "pharmacist",
  "lab",
  "billing",
  "hr",
  "auditor",
] as const;
export type Role = (typeof roles)[number];
export const moduleKeys = [
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
] as const;
export type ModuleKey = (typeof moduleKeys)[number];
export type Field = {
  key: string;
  label: string;
  ar: string;
  type?: string;
  required?: boolean;
  options?: string[];
  ref?: ModuleKey;
  min?: number;
  max?: number;
};
export type Module = {
  title: string;
  ar: string;
  singular: string;
  arSingular: string;
  subtitle: string;
  arSubtitle: string;
  fields: Field[];
  statuses: string[];
};
const text = (
  key: string,
  label: string,
  ar: string,
  required = false,
  type = "text",
): Field => ({ key, label, ar, required, type });
const select = (
  key: string,
  label: string,
  ar: string,
  options: string[],
  required = false,
): Field => ({ key, label, ar, options, required, type: "select" });
const patient: Field = {
  key: "patientId",
  label: "Patient",
  ar: "المريض",
  required: true,
  ref: "patients",
};
const doctor: Field = {
  key: "staffId",
  label: "Doctor",
  ar: "الدكتور",
  required: true,
  ref: "staff",
};
export const departments = [
  "Emergency",
  "Cardiology",
  "Pediatrics",
  "Surgery",
  "Internal Medicine",
  "Radiology",
  "Laboratory",
];
const department = select(
  "department",
  "Department",
  "القسم",
  departments,
  true,
);
export const modules: Record<ModuleKey, Module> = {
  patients: {
    title: "Patients",
    ar: "المرضى",
    singular: "patient",
    arSingular: "مريض",
    subtitle: "A clearer picture of every patient.",
    arSubtitle: "كل تفاصيل المريض في مكان واحد.",
    statuses: ["Active", "Follow-up", "Discharged", "Emergency"],
    fields: [
      text("name", "Full name", "الاسم بالكامل", true),
      text("dob", "Date of birth", "تاريخ الميلاد", true, "date"),
      select("sex", "Sex", "النوع", ["Female", "Male"], true),
      text("phone", "Phone", "الموبايل"),
      text("nationalId", "Patient identifier", "رقم هوية المريض"),
      select("bloodGroup", "Blood group", "فصيلة الدم", [
        "Unknown",
        "A+",
        "A-",
        "B+",
        "B-",
        "AB+",
        "AB-",
        "O+",
        "O-",
      ]),
      text("allergies", "Allergies", "الحساسية", false, "textarea"),
      text(
        "conditions",
        "Chronic conditions",
        "الأمراض المزمنة",
        false,
        "textarea",
      ),
      text("emergencyContact", "Emergency contact", "جهة اتصال للطوارئ"),
      text("history", "Medical history", "التاريخ المرضي", false, "textarea"),
      text("document", "Document title / note", "عنوان المستند / ملاحظة"),
      text(
        "documentUrl",
        "Document URL (https only)",
        "رابط المستند (https فقط)",
        false,
        "url",
      ),
    ],
  },
  appointments: {
    title: "Appointments",
    ar: "المواعيد",
    singular: "appointment",
    arSingular: "ميعاد",
    subtitle: "Keep every visit moving, from booking to follow-up.",
    arSubtitle: "نظّم كل زيارة من الحجز للمتابعة.",
    statuses: [
      "Scheduled",
      "Checked-in",
      "In consultation",
      "Completed",
      "Cancelled",
      "No-show",
    ],
    fields: [
      patient,
      doctor,
      department,
      text(
        "scheduledAt",
        "Date and time",
        "التاريخ والوقت",
        true,
        "datetime-local",
      ),
      select(
        "duration",
        "Duration (minutes)",
        "المدة بالدقايق",
        ["15", "30", "45", "60"],
        true,
      ),
      text("name", "Reason for visit", "سبب الزيارة", true),
      select("priority", "Priority", "الأولوية", [
        "Routine",
        "Urgent",
        "Emergency",
      ]),
      text("notes", "Booking notes", "ملاحظات الحجز", false, "textarea"),
    ],
  },
  emr: {
    title: "Medical records",
    ar: "الملفات الطبية",
    singular: "encounter",
    arSingular: "كشف",
    subtitle: "Connected clinical notes and a complete care timeline.",
    arSubtitle: "ملاحظات الكشف وخطة العلاج بالترتيب.",
    statuses: ["Draft", "Signed"],
    fields: [
      patient,
      doctor,
      text(
        "name",
        "Diagnosis / encounter title",
        "التشخيص / عنوان الكشف",
        true,
      ),
      text(
        "clinicalNotes",
        "Clinical notes",
        "ملاحظات الكشف",
        true,
        "textarea",
      ),
      text("treatment", "Treatment plan", "خطة العلاج", false, "textarea"),
      text(
        "prescription",
        "Prescription and dosage",
        "الروشتة والجرعات",
        false,
        "textarea",
      ),
      text("vitals", "Vitals (BP, pulse, temperature)", "العلامات الحيوية"),
      text("followUp", "Follow-up date", "تاريخ المتابعة", false, "date"),
    ],
  },
  staff: {
    title: "Doctors & staff",
    ar: "الدكاترة والفريق",
    singular: "team member",
    arSingular: "عضو فريق",
    subtitle: "Great care starts with a connected team.",
    arSubtitle: "رعاية أحسن بفريق شغّال مع بعض.",
    statuses: ["Available", "In consultation", "On leave", "Off duty"],
    fields: [
      text("name", "Full name", "الاسم بالكامل", true),
      select(
        "job",
        "Position",
        "الوظيفة",
        ["Doctor", "Nurse", "Technician", "Receptionist", "Administrator"],
        true,
      ),
      text("specialty", "Specialty", "التخصص", true),
      department,
      text("email", "Work email", "إيميل الشغل", false, "email"),
      text("phone", "Phone", "الموبايل"),
      text("scheduleStart", "Shift starts", "بداية الشيفت", true, "time"),
      text("scheduleEnd", "Shift ends", "نهاية الشيفت", true, "time"),
      text(
        "workingDays",
        "Working days (0=Sun, 6=Sat)",
        "أيام الشغل (0=الأحد، 6=السبت)",
        true,
      ),
      text("license", "License reference", "رقم الترخيص"),
    ],
  },
  departments: {
    title: "Departments",
    ar: "الأقسام",
    singular: "department",
    arSingular: "قسم",
    subtitle: "One hospital. Every specialty, working together.",
    arSubtitle: "كل تخصصات المستشفى في مكان واحد.",
    statuses: ["Operational", "Busy", "Maintenance"],
    fields: [
      text("name", "Department name", "اسم القسم", true),
      text("head", "Department lead", "مسؤول القسم"),
      text("location", "Floor / location", "الدور / المكان", true),
      text("phone", "Extension", "الرقم الداخلي"),
      text("capacity", "Daily capacity", "الطاقة اليومية", true, "number"),
      text("notes", "Services", "الخدمات", false, "textarea"),
    ],
  },
  beds: {
    title: "Inpatient & beds",
    ar: "الإقامة والسراير",
    singular: "bed",
    arSingular: "سرير",
    subtitle: "The right bed, ready at the right time.",
    arSubtitle: "اعرف كل سرير متاح وإدارة الإقامة.",
    statuses: ["Available", "Occupied", "Cleaning", "Maintenance"],
    fields: [
      text("name", "Bed number", "رقم السرير", true),
      text("ward", "Ward", "العنبر", true),
      text("room", "Room", "الأوضة", true),
      department,
      select(
        "bedType",
        "Bed type",
        "نوع السرير",
        ["Standard", "Private", "ICU", "Pediatric"],
        true,
      ),
      { ...patient, required: false },
      text("admittedAt", "Admission date", "تاريخ الدخول", false, "date"),
      text(
        "notes",
        "Admission / transfer notes",
        "ملاحظات الدخول والنقل",
        false,
        "textarea",
      ),
    ],
  },
  pharmacy: {
    title: "Pharmacy",
    ar: "الصيدلية",
    singular: "medicine",
    arSingular: "دواء",
    subtitle: "Safer stock, fewer shortages.",
    arSubtitle: "تابع المخزون وتواريخ الصلاحية.",
    statuses: ["In stock", "Low stock", "Out of stock", "Quarantined"],
    fields: [
      text("name", "Medicine / strength", "الدواء / التركيز", true),
      text("sku", "SKU / batch", "الكود / التشغيلة", true),
      text("stock", "Units in stock", "الكمية المتاحة", true, "number"),
      text("reorder", "Reorder level", "حد إعادة الطلب", true, "number"),
      text("expiry", "Expiry date", "تاريخ الصلاحية", true, "date"),
      text("supplier", "Supplier", "المورّد", true),
      text("amount", "Unit price (EGP)", "سعر الوحدة (جنيه)", true, "number"),
      text("notes", "Storage / notes", "التخزين / ملاحظات", false, "textarea"),
    ],
  },
  lab: {
    title: "Lab & radiology",
    ar: "المعمل والأشعة",
    singular: "request",
    arSingular: "طلب",
    subtitle: "From request to result, without the wait.",
    arSubtitle: "من طلب التحليل لظهور النتيجة.",
    statuses: [
      "Requested",
      "Collected",
      "Processing",
      "Completed",
      "Cancelled",
    ],
    fields: [
      patient,
      doctor,
      text("name", "Test / imaging request", "التحليل / الأشعة", true),
      select("kind", "Service", "الخدمة", ["Laboratory", "Radiology"], true),
      select(
        "priority",
        "Priority",
        "الأولوية",
        ["Routine", "Urgent", "Emergency"],
        true,
      ),
      text("scheduledAt", "Requested at", "وقت الطلب", true, "datetime-local"),
      text("result", "Result / report", "النتيجة / التقرير", false, "textarea"),
      text("referenceRange", "Reference range", "المعدل الطبيعي"),
      text(
        "reportUrl",
        "Report URL (https only)",
        "رابط التقرير (https فقط)",
        false,
        "url",
      ),
    ],
  },
  billing: {
    title: "Billing & insurance",
    ar: "الحسابات والتأمين",
    singular: "invoice",
    arSingular: "فاتورة",
    subtitle: "Clear billing, from service to settlement.",
    arSubtitle: "حسابات واضحة من الخدمة لحد الدفع.",
    statuses: ["Draft", "Issued", "Partially paid", "Paid", "Void"],
    fields: [
      patient,
      text("name", "Service description", "وصف الخدمة", true),
      text(
        "amount",
        "Invoice total (EGP)",
        "إجمالي الفاتورة (جنيه)",
        true,
        "number",
      ),
      text("dueDate", "Due date", "تاريخ الاستحقاق", true, "date"),
      text("insurer", "Insurance provider", "شركة التأمين"),
      text("claimId", "Claim reference", "رقم المطالبة"),
      select("claimStatus", "Claim status", "حالة المطالبة", [
        "Not applicable",
        "Pending",
        "Submitted",
        "Approved",
        "Rejected",
      ]),
      text("notes", "Billing notes", "ملاحظات الحسابات", false, "textarea"),
    ],
  },
  hr: {
    title: "Human resources",
    ar: "شؤون العاملين",
    singular: "HR record",
    arSingular: "سجل موظف",
    subtitle: "Take care of the people who care.",
    arSubtitle: "كل ما يخص الفريق من حضور ومرتبات.",
    statuses: ["Present", "Absent", "On leave", "Scheduled"],
    fields: [
      {
        key: "staffId",
        label: "Staff member",
        ar: "الموظف",
        required: true,
        ref: "staff",
      },
      text("name", "Record title", "عنوان السجل", true),
      select(
        "kind",
        "Record type",
        "نوع السجل",
        ["Attendance", "Shift", "Leave", "Payroll"],
        true,
      ),
      text(
        "scheduledAt",
        "Date / shift starts",
        "التاريخ / بداية الشيفت",
        true,
        "datetime-local",
      ),
      text(
        "shiftEnd",
        "Shift / leave ends",
        "نهاية الشيفت / الإجازة",
        false,
        "datetime-local",
      ),
      text(
        "amount",
        "Base salary (EGP)",
        "المرتب الأساسي (جنيه)",
        false,
        "number",
      ),
      text("bonus", "Bonus (EGP)", "الحوافز (جنيه)", false, "number"),
      text("deduction", "Deduction (EGP)", "الخصومات (جنيه)", false, "number"),
      select("approval", "Approval", "الموافقة", [
        "Pending",
        "Approved",
        "Rejected",
      ]),
      text("notes", "Notes", "ملاحظات", false, "textarea"),
    ],
  },
};
const grants: Record<string, ModuleKey[]> = {
  doctor: [
    "patients",
    "appointments",
    "emr",
    "staff",
    "departments",
    "beds",
    "lab",
  ],
  nurse: ["patients", "appointments", "staff", "departments", "beds", "lab"],
  reception: ["patients", "appointments", "staff", "departments", "beds"],
  pharmacist: ["patients", "emr", "pharmacy", "staff", "departments"],
  lab: ["patients", "lab", "staff", "departments"],
  billing: ["patients", "billing", "departments"],
  hr: ["staff", "departments", "hr"],
  auditor: [],
};
const writes: Record<string, ModuleKey[]> = {
  doctor: ["emr", "appointments", "lab"],
  nurse: ["beds"],
  reception: ["patients", "appointments"],
  pharmacist: ["pharmacy"],
  lab: ["lab"],
  billing: ["billing"],
  hr: ["staff", "hr"],
};
export function can(role: string, module: string, write = false) {
  return (
    role === "admin" ||
    (write ? writes[role] : grants[role])?.includes(module as ModuleKey) ||
    false
  );
}
export type RecordData = {
  id: string;
  module: ModuleKey;
  name: string;
  status: string;
  department?: string;
  patientId?: string;
  staffId?: string;
  scheduledAt?: string;
  amount?: number;
  version: number;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
};
export function validate(module: ModuleKey, data: Record<string, unknown>) {
  const errors: string[] = [];
  for (const f of modules[module].fields) {
    const v = data[f.key];
    if (
      f.required &&
      (v === undefined || v === null || String(v).trim() === "")
    )
      errors.push(`${f.label} is required`);
    if (v !== undefined && v !== null && String(v) !== "") {
      if (String(v).length > 10000) errors.push(`${f.label} is too long`);
      if (
        f.type === "number" &&
        (!Number.isFinite(Number(v)) || Number(v) < 0 || Number(v) > 1e9)
      )
        errors.push(`${f.label} must be a valid non-negative number`);
      if (f.options && !f.options.includes(String(v)))
        errors.push(`${f.label} is invalid`);
      if (
        ["date", "datetime-local"].includes(f.type || "") &&
        !Number.isFinite(new Date(String(v)).getTime())
      )
        errors.push(`${f.label} is invalid`);
      if (f.type === "time" && !/^([01]\d|2[0-3]):[0-5]\d$/.test(String(v)))
        errors.push(`${f.label} is invalid`);
      if (f.type === "email" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(v)))
        errors.push(`${f.label} is invalid`);
      if (f.type === "url" && !/^https:\/\//.test(String(v)))
        errors.push(`${f.label} must use https`);
    }
  }
  if (!modules[module].statuses.includes(String(data.status)))
    errors.push("Invalid status");
  if (
    module === "patients" &&
    String(data.dob) > new Date().toISOString().slice(0, 10)
  )
    errors.push("Date of birth cannot be in the future");
  if (module === "beds" && data.status === "Occupied" && !data.patientId)
    errors.push("Select a patient before admission");
  if (module === "beds" && data.status !== "Occupied" && data.patientId)
    errors.push("Only occupied beds can have a patient");
  if (module === "lab" && data.status === "Completed" && !data.result)
    errors.push("Enter a result before completion");
  if (
    module === "emr" &&
    data.status === "Signed" &&
    (!data.clinicalNotes || !data.treatment)
  )
    errors.push("Clinical notes and treatment are required before signing");
  if (
    module === "staff" &&
    (!/^[0-6](,[0-6])*$/.test(String(data.workingDays)) ||
      String(data.scheduleStart) >= String(data.scheduleEnd))
  )
    errors.push("Enter valid working days and a shift ending after its start");
  if (
    module === "pharmacy" &&
    (!Number.isInteger(Number(data.stock)) ||
      !Number.isInteger(Number(data.reorder)))
  )
    errors.push("Stock and reorder levels must be whole numbers");
  if (["billing", "pharmacy", "hr"].includes(module)) {
    for (const k of ["amount", "bonus", "deduction"]) {
      const n = Number(data[k] || 0);
      if (Math.abs(Math.round(n * 100) - n * 100) > 0.00001)
        errors.push("Money amounts must have at most two decimal places");
    }
  }
  if (
    module === "hr" &&
    data.shiftEnd &&
    String(data.shiftEnd) < String(data.scheduledAt)
  )
    errors.push("End time must be after start time");
  if (
    module === "hr" &&
    data.kind === "Payroll" &&
    Number(data.deduction || 0) >
      Number(data.amount || 0) + Number(data.bonus || 0)
  )
    errors.push("Deductions cannot exceed salary and bonus");
  if (
    module === "departments" &&
    (!Number.isInteger(Number(data.capacity)) || Number(data.capacity) < 1)
  )
    errors.push("Capacity must be a positive whole number");
  return errors;
}
