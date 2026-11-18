import type { ModuleKey } from "./domain";
export function seedRecords() {
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "Africa/Cairo",
  });
  const yesterday = new Date(Date.now() - 86400000).toLocaleDateString(
    "en-CA",
    { timeZone: "Africa/Cairo" },
  );
  const rows: { module: ModuleKey; id: string; [key: string]: unknown }[] = [];
  const add = (module: ModuleKey, id: string, data: Record<string, unknown>) =>
    rows.push({ module, id, ...data });
  const deps = [
    "Emergency",
    "Cardiology",
    "Pediatrics",
    "Surgery",
    "Internal Medicine",
    "Radiology",
    "Laboratory",
  ];
  deps.forEach((name, i) =>
    add("departments", `dep${i}`, {
      name,
      status: i === 0 ? "Busy" : "Operational",
      head: [
        "Dr. Maya Hassan",
        "Dr. Adam Farouk",
        "Dr. Layla Karim",
        "Dr. Omar Nabil",
        "Dr. Lina Adel",
        "Dr. Youssef Sami",
        "Dr. Nour Khaled",
      ][i],
      location: `Floor ${(i % 4) + 1}`,
      phone: `20${i}`,
      capacity: 40 + i * 5,
      notes: "Consultations, follow-up care and specialist services.",
    }),
  );
  const staff = [
    ["Dr. Maya Hassan", "Emergency", "Emergency medicine"],
    ["Dr. Adam Farouk", "Cardiology", "Consultant cardiologist"],
    ["Dr. Layla Karim", "Pediatrics", "Pediatric consultant"],
    ["Dr. Omar Nabil", "Surgery", "General surgery"],
    ["Dr. Lina Adel", "Internal Medicine", "Internal medicine"],
    ["Dr. Youssef Sami", "Radiology", "Diagnostic radiology"],
    ["Dr. Nour Khaled", "Laboratory", "Clinical pathology"],
    ["Salma Tarek", "Cardiology", "Senior nursing"],
  ];
  staff.forEach(([name, department, specialty], i) =>
    add("staff", `s${i}`, {
      name,
      department,
      specialty,
      job: i === 7 ? "Nurse" : "Doctor",
      status: i === 3 ? "In consultation" : "Available",
      email: `staff${i + 1}@example.test`,
      phone: "01000000000",
      scheduleStart: "08:00",
      scheduleEnd: "20:00",
      workingDays: "0,1,2,3,4,5,6",
      license: `DEMO-LIC-${100 + i}`,
    }),
  );
  const patients = [
    ["Mariam Saleh", "Female", "1994-07-12", "A+", "Penicillin", "Asthma"],
    ["Ahmed Mostafa", "Male", "1968-03-22", "O+", "None known", "Hypertension"],
    [
      "Nour Ibrahim",
      "Female",
      "2018-09-06",
      "B+",
      "None known",
      "None reported",
    ],
    [
      "Karim Adel",
      "Male",
      "1987-11-14",
      "AB+",
      "Sulfa medicines",
      "Type 2 diabetes",
    ],
    ["Sara Mahmoud", "Female", "1991-02-19", "O-", "Latex", "None reported"],
    [
      "Youssef Hassan",
      "Male",
      "1976-06-30",
      "A-",
      "None known",
      "Hypertension",
    ],
    ["Hana Samir", "Female", "2001-01-25", "B-", "None known", "None reported"],
    ["Omar Saeed", "Male", "1999-08-10", "O+", "None known", "None reported"],
    ["Farida Ali", "Female", "1959-10-08", "A+", "Aspirin", "Arthritis"],
    ["Ziad Tamer", "Male", "2014-05-04", "B+", "None known", "None reported"],
    [
      "Dina Khaled",
      "Female",
      "1983-12-18",
      "AB-",
      "None known",
      "None reported",
    ],
    ["Adam Nabil", "Male", "1990-04-15", "O+", "None known", "None reported"],
  ];
  patients.forEach(([name, sex, dob, bloodGroup, allergies, conditions], i) =>
    add("patients", `p${i}`, {
      name,
      sex,
      dob,
      bloodGroup,
      allergies,
      conditions,
      status: i === 7 ? "Emergency" : i % 3 === 0 ? "Follow-up" : "Active",
      phone: "01000000000",
      nationalId: `DEMO-${String(1000 + i)}`,
      emergencyContact: "Fictional family contact · 01000000000",
      history: "Fictional demonstration record. Not a real patient.",
    }),
  );
  const times = [
    "08:30",
    "09:00",
    "09:30",
    "10:00",
    "10:30",
    "11:00",
    "11:30",
    "12:00",
    "13:00",
    "14:00",
    "15:00",
    "16:00",
  ];
  patients.forEach((p, i) =>
    add("appointments", `a${i}`, {
      name: [
        "Follow-up consultation",
        "Routine check-up",
        "Pediatric consultation",
        "Pre-operative review",
      ][i % 4],
      patientId: `p${i}`,
      staffId: `s${i % 5}`,
      department: staff[i % 5][1],
      scheduledAt: `${today}T${times[i]}`,
      duration: "30",
      priority: i === 7 ? "Emergency" : "Routine",
      status: ["Completed", "Checked-in", "In consultation", "Scheduled"][
        i % 4
      ],
      notes: "Fictional demonstration appointment.",
    }),
  );
  for (let i = 0; i < 24; i++)
    add("beds", `b${i}`, {
      name: `B-${String(i + 1).padStart(2, "0")}`,
      ward: i < 8 ? "East wing" : i < 16 ? "West wing" : "Critical care",
      room: `${Math.floor(i / 2) + 101}`,
      department: deps[i % 5],
      bedType: i > 19 ? "ICU" : i % 4 === 0 ? "Private" : "Standard",
      status:
        i < 8
          ? "Occupied"
          : i === 8
            ? "Cleaning"
            : i === 9
              ? "Maintenance"
              : "Available",
      patientId: i < 8 ? `p${i}` : "",
      admittedAt: i < 8 ? yesterday : "",
      notes: i < 8 ? "Admitted for observation. Fictional patient." : "",
    });
  for (let i = 0; i < 5; i++)
    add("emr", `e${i}`, {
      name: [
        "Asthma review",
        "Blood pressure review",
        "Routine pediatric assessment",
        "Diabetes follow-up",
        "Wellness consultation",
      ][i],
      patientId: `p${i}`,
      staffId: `s${i}`,
      status: i === 4 ? "Draft" : "Signed",
      clinicalNotes:
        "Fictional clinical encounter for software demonstration only. Patient stable during review.",
      treatment:
        "Demonstration plan. Not medical advice. Schedule follow-up with the treating clinician.",
      prescription: "No active prescription in this fictional encounter.",
      vitals: "BP 120/80 · Pulse 76 · Temperature 36.7°C",
      followUp: today,
    });
  const meds = [
    ["Paracetamol 500mg", 420, 50, "2028-09-30", 12],
    ["Amoxicillin 500mg", 18, 40, "2028-03-31", 45],
    ["Metformin 500mg", 240, 30, "2028-12-31", 36],
    ["Salbutamol inhaler", 32, 15, "2028-06-30", 85],
    ["Normal saline 500ml", 96, 25, "2028-07-31", 24],
    ["Amlodipine 5mg", 0, 20, "2028-08-31", 32],
    ["Surgical gloves (box)", 80, 20, "2029-01-31", 110],
    ["Cetirizine 10mg", 150, 25, "2028-11-30", 18],
  ];
  meds.forEach(([name, stock, reorder, expiry, amount], i) =>
    add("pharmacy", `m${i}`, {
      name,
      stock,
      reorder,
      expiry,
      amount,
      supplier: i % 2 ? "Delta Medical Supplies (demo)" : "Nile Pharma (demo)",
      sku: `DEMO-RX-${i + 100}`,
      status:
        Number(stock) === 0
          ? "Out of stock"
          : Number(stock) < Number(reorder)
            ? "Low stock"
            : "In stock",
      notes: "Fictional inventory. Not for clinical use.",
    }),
  );
  for (let i = 0; i < 7; i++)
    add("lab", `l${i}`, {
      name: [
        "Complete blood count",
        "Chest X-ray",
        "HbA1c",
        "Lipid profile",
        "Abdominal ultrasound",
        "Renal function",
        "ECG",
      ][i],
      patientId: `p${i}`,
      staffId: `s${i % 5}`,
      kind: i === 1 || i === 4 ? "Radiology" : "Laboratory",
      priority: i === 1 ? "Urgent" : "Routine",
      scheduledAt: `${today}T09:00`,
      status: i < 2 ? "Completed" : i < 4 ? "Processing" : "Requested",
      result:
        i < 2
          ? "Fictional result: review with treating clinician. No clinical interpretation intended."
          : "",
      referenceRange: "See laboratory reference interval.",
    });
  for (let i = 0; i < 10; i++)
    add("billing", `i${i}`, {
      name: [
        "Consultation & assessment",
        "Laboratory services",
        "Inpatient care",
      ][i % 3],
      patientId: `p${i}`,
      amount: 350 + i * 125,
      dueDate: today,
      status: i < 5 ? "Paid" : i < 7 ? "Partially paid" : "Issued",
      paid: i < 5 ? 350 + i * 125 : i < 7 ? 200 : 0,
      payments:
        i < 5
          ? [
              {
                amount: 350 + i * 125,
                method: "Cash",
                at: `${today}T10:00:00Z`,
              },
            ]
          : i < 7
            ? [{ amount: 200, method: "Cash", at: `${today}T10:00:00Z` }]
            : [],
      insurer: i % 2 ? "Demo Health Insurance" : "",
      claimStatus: i % 2 ? "Submitted" : "Not applicable",
      claimId: i % 2 ? `CLM-DEMO-${100 + i}` : "",
    });
  for (let i = 0; i < 8; i++)
    add("hr", `h${i}`, {
      name: `${i < 4 ? "Attendance" : "Monthly payroll"} · ${staff[i][0]}`,
      staffId: `s${i}`,
      kind: i < 4 ? "Attendance" : "Payroll",
      status: i === 3 ? "On leave" : "Present",
      scheduledAt: `${today}T08:00`,
      shiftEnd: `${today}T16:00`,
      amount: i < 4 ? 0 : 15000,
      bonus: i < 4 ? 0 : 1000,
      deduction: 0,
      approval: "Approved",
      notes: "Fictional employee record.",
    });
  return rows;
}
