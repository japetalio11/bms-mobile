import type {
  AuthUser,
  MotherRecord,
  PregnancyRecord,
  PrenatalVisitRecord,
  DeliveryOutcomeRecord,
  SupplementRecord,
} from "../config/api";

interface HealthReportData {
  user: AuthUser;
  motherRecord: MotherRecord | null;
  activePregnancy?: PregnancyRecord | null;
  visits?: PrenatalVisitRecord[];
  deliveries?: DeliveryOutcomeRecord[];
  supplements?: SupplementRecord[];
}

export function generateHealthReportHtml(data: HealthReportData): string {
  const {
    user,
    motherRecord,
    activePregnancy,
    visits = [],
    deliveries = [],
    supplements = [],
  } = data;

  const fullName =
    [user.first_name, user.middle_name, user.last_name].filter(Boolean).join(" ") ||
    "Patient Record";
  const dateGenerated = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const facilityName =
    user.facility?.facility_name || user.facility_name || "Barangay Health Center & Maternal Care";

  const allVisits: PrenatalVisitRecord[] = [...visits];
  if (activePregnancy?.prenatalVisits) {
    activePregnancy.prenatalVisits.forEach((v) => {
      if (!allVisits.some((x) => x.visit_id === v.visit_id)) {
        allVisits.push(v);
      }
    });
  }
  if (motherRecord?.pregnancies) {
    motherRecord.pregnancies.forEach((p) => {
      if (p.prenatalVisits) {
        p.prenatalVisits.forEach((v) => {
          if (!allVisits.some((x) => x.visit_id === v.visit_id)) {
            allVisits.push(v);
          }
        });
      }
    });
  }

  const allDeliveries: DeliveryOutcomeRecord[] = [...deliveries];
  if (motherRecord?.pregnancies) {
    motherRecord.pregnancies.forEach((p) => {
      if (p.deliveryOutcomes) {
        p.deliveryOutcomes.forEach((d) => {
          if (!allDeliveries.some((x) => x.delivery_id === d.delivery_id)) {
            allDeliveries.push(d);
          }
        });
      }
    });
  }

  const visitsRows =
    allVisits.length > 0
      ? allVisits
          .map(
            (v, idx) => `
    <tr>
      <td style="text-align: center;">${idx + 1}</td>
      <td>${v.visit_date ? new Date(v.visit_date).toLocaleDateString() : "—"}</td>
      <td style="text-align: center;">${v.age_of_gestation_weeks ? `${v.age_of_gestation_weeks} wks` : "—"}</td>
      <td style="text-align: center; font-weight: 600;">${v.bp_systolic && v.bp_diastolic ? `${v.bp_systolic}/${v.bp_diastolic}` : "—"}</td>
      <td style="text-align: center;">${v.weight_kg ? `${v.weight_kg} kg` : "—"}</td>
      <td style="text-align: center;">${v.fundic_height_cm ? `${v.fundic_height_cm} cm` : "—"}</td>
      <td style="text-align: center;">${v.fetal_heart_tone_bpm ? `${v.fetal_heart_tone_bpm} bpm` : "—"}</td>
      <td style="text-align: center;">
        <span class="badge ${v.risk_level_assessed?.toLowerCase().includes("high") ? "badge-danger" : "badge-success"}">
          ${v.risk_level_assessed || "Standard"}
        </span>
      </td>
    </tr>
  `
          )
          .join("")
      : `<tr><td colspan="8" style="text-align: center; color: #71717a; padding: 14px;">No prenatal visits recorded.</td></tr>`;

  const supplementRows =
    supplements.length > 0
      ? supplements
          .map(
            (s, idx) => `
    <tr>
      <td style="text-align: center;">${idx + 1}</td>
      <td style="font-weight: 600;">${s.supplement_type || "Medication"}</td>
      <td style="text-align: center;">${s.tablets_given_count || "—"} tablets</td>
      <td style="text-align: center;">
        <span class="badge ${s.is_completed ? "badge-success" : "badge-warning"}">
          ${s.is_completed ? "Completed" : "Ongoing / Prescribed"}
        </span>
      </td>
    </tr>
  `
          )
          .join("")
      : `<tr><td colspan="4" style="text-align: center; color: #71717a; padding: 12px;">No active prescriptions logged.</td></tr>`;

  let newbornsHtml = "";
  if (allDeliveries.length > 0) {
    const deliveryCards = allDeliveries
      .map((d, dIdx) => {
        const nbs = d.newbornRecords || [];
        const nbRows =
          nbs.length > 0
            ? nbs
                .map(
                  (nb, nIdx) => `
        <tr>
          <td style="text-align: center;">#${nIdx + 1}</td>
          <td style="font-weight: 600;">${nb.sex || "Not specified"}</td>
          <td style="text-align: center;">${nb.birth_weight_kg ? `${nb.birth_weight_kg} kg` : "—"}</td>
          <td style="text-align: center; font-weight: 600;">${nb.apgar_score !== undefined ? `${nb.apgar_score}/10` : "—"}</td>
          <td style="text-align: center;">${nb.status_at_birth || "Live Birth"}</td>
        </tr>
      `
                )
                .join("")
            : `<tr><td colspan="5" style="text-align: center; color: #71717a;">No infant specifics listed</td></tr>`;

        return `
        <div style="margin-bottom: 16px; border: 1px solid #e4e4e7; border-radius: 8px; padding: 12px; background: #fafafa;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <strong style="color: #0284c7;">Delivery Event #${dIdx + 1}</strong>
            <span style="color: #71717a; font-size: 12px;">${d.delivery_date ? new Date(d.delivery_date).toLocaleDateString() : "Recorded Date"}</span>
          </div>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; font-size: 12px; margin-bottom: 10px;">
            <div><strong>Mode:</strong> ${d.mode_of_delivery || "Standard Vaginal"}</div>
            <div><strong>Facility:</strong> ${d.place_of_delivery || "Health Center"}</div>
            <div><strong>Complications:</strong> ${d.delivery_complications || "None Reported"}</div>
          </div>
          <table style="width: 100%; border-collapse: collapse; font-size: 12px; background: #ffffff;">
            <thead>
              <tr style="background: #f1f5f9;">
                <th style="padding: 6px; border: 1px solid #e2e8f0;">Infant</th>
                <th style="padding: 6px; border: 1px solid #e2e8f0;">Sex</th>
                <th style="padding: 6px; border: 1px solid #e2e8f0;">Birth Weight</th>
                <th style="padding: 6px; border: 1px solid #e2e8f0;">APGAR Score</th>
                <th style="padding: 6px; border: 1px solid #e2e8f0;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${nbRows}
            </tbody>
          </table>
        </div>
      `;
      })
      .join("");

    newbornsHtml = `
      <div class="section">
        <div class="section-title">Delivery & Newborn Records</div>
        ${deliveryCards}
      </div>
    `;
  }

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Maternal Health Record Summary</title>
        <style>
          @page {
            size: A4;
            margin: 15mm 15mm 15mm 15mm;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #18181b;
            line-height: 1.4;
            font-size: 12px;
            margin: 0;
            padding: 0;
          }
          .header {
            border-bottom: 2px solid #0284c7;
            padding-bottom: 12px;
            margin-bottom: 16px;
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
          }
          .header-left h1 {
            font-size: 18px;
            color: #0284c7;
            margin: 0 0 4px 0;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .header-left p {
            margin: 0;
            color: #52525b;
            font-size: 12px;
            font-weight: 500;
          }
          .header-right {
            text-align: right;
            font-size: 11px;
            color: #71717a;
          }
          .section {
            margin-bottom: 16px;
          }
          .section-title {
            font-size: 13px;
            font-weight: 700;
            color: #0f172a;
            border-bottom: 1px solid #e2e8f0;
            padding-bottom: 4px;
            margin-bottom: 8px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .info-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 8px;
            background: #f8fafc;
            padding: 10px;
            border-radius: 6px;
            border: 1px solid #e2e8f0;
            font-size: 11.5px;
          }
          .info-item {
            margin-bottom: 4px;
          }
          .info-label {
            color: #64748b;
            font-size: 10.5px;
            text-transform: uppercase;
            display: block;
          }
          .info-value {
            font-weight: 600;
            color: #0f172a;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 6px;
            font-size: 11.5px;
          }
          th {
            background: #f1f5f9;
            color: #334155;
            font-weight: 700;
            text-align: left;
            padding: 6px 8px;
            border: 1px solid #cbd5e1;
            font-size: 10.5px;
            text-transform: uppercase;
          }
          td {
            padding: 6px 8px;
            border: 1px solid #e2e8f0;
          }
          tr:nth-child(even) {
            background: #f8fafc;
          }
          .badge {
            display: inline-block;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 10px;
            font-weight: 700;
          }
          .badge-success {
            background: #dcfce7;
            color: #15803d;
          }
          .badge-warning {
            background: #fef3c7;
            color: #b45309;
          }
          .badge-danger {
            background: #fee2e2;
            color: #b91c1c;
          }
          .footer {
            margin-top: 24px;
            border-top: 1px solid #e2e8f0;
            padding-top: 12px;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            font-size: 10px;
            color: #71717a;
          }
          .confidential {
            color: #ef4444;
            font-weight: 600;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="header-left">
            <h1>${facilityName}</h1>
            <p>Maternal & Child Health Care Information System</p>
          </div>
          <div class="header-right">
            <div><strong>Date Exported:</strong> ${dateGenerated}</div>
            <div><strong>Patient ID:</strong> ${motherRecord?.mother_id || user.user_id}</div>
            <div class="confidential">CONFIDENTIAL MEDICAL DOCUMENT</div>
          </div>
        </div>

        <!-- Patient Demographics -->
        <div class="section">
          <div class="section-title">Patient Identification & Demographics</div>
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">Full Name</span>
              <span class="info-value">${fullName}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Date of Birth</span>
              <span class="info-value">${motherRecord?.birth_date ? new Date(motherRecord.birth_date).toLocaleDateString() : "—"}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Civil Status</span>
              <span class="info-value">${motherRecord?.civil_status || "—"}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Blood Type</span>
              <span class="info-value">${motherRecord?.blood_type || "—"}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Contact Number</span>
              <span class="info-value">${user.phone_number || "—"}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Email Address</span>
              <span class="info-value">${user.email || "—"}</span>
            </div>
            <div class="info-item" style="grid-column: span 2;">
              <span class="info-label">Home Address</span>
              <span class="info-value">${user.address || "—"}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Family Serial No.</span>
              <span class="info-value">${motherRecord?.family_serial_no || "—"}</span>
            </div>
          </div>
        </div>

        <!-- Obstetric History -->
        <div class="section">
          <div class="section-title">Obstetric & Pregnancy Overview</div>
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">Gravidity / Parity</span>
              <span class="info-value">G${activePregnancy?.gravida ?? 0} P${activePregnancy?.parity ?? 0}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Pregnancy Status</span>
              <span class="info-value">${activePregnancy?.pregnancy_status || "Active Registration"}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Registration Date</span>
              <span class="info-value">${activePregnancy?.date_of_registration ? new Date(activePregnancy.date_of_registration).toLocaleDateString() : "—"}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Last Menstrual Period (LMP)</span>
              <span class="info-value">${activePregnancy?.lmp_date ? new Date(activePregnancy.lmp_date).toLocaleDateString() : "—"}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Est. Date of Delivery (EDD)</span>
              <span class="info-value">${activePregnancy?.lmp_date ? new Date(new Date(activePregnancy.lmp_date).getTime() + 280 * 24 * 60 * 60 * 1000).toLocaleDateString() : "—"}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Healthcare Facility</span>
              <span class="info-value">${facilityName}</span>
            </div>
          </div>
        </div>

        <!-- Prenatal Checkups -->
        <div class="section">
          <div class="section-title">Prenatal Visit Records & Vitals Log</div>
          <table>
            <thead>
              <tr>
                <th style="width: 25px; text-align: center;">#</th>
                <th>Visit Date</th>
                <th style="text-align: center;">Gest. Age</th>
                <th style="text-align: center;">BP (mmHg)</th>
                <th style="text-align: center;">Weight</th>
                <th style="text-align: center;">Fundic Ht</th>
                <th style="text-align: center;">FHR</th>
                <th style="text-align: center;">Assessment</th>
              </tr>
            </thead>
            <tbody>
              ${visitsRows}
            </tbody>
          </table>
        </div>

        <!-- Prescriptions & Supplements -->
        <div class="section">
          <div class="section-title">Medication & Supplement Logs</div>
          <table>
            <thead>
              <tr>
                <th style="width: 25px; text-align: center;">#</th>
                <th>Prescription / Supplement</th>
                <th style="text-align: center;">Dosage / Quantity</th>
                <th style="text-align: center;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${supplementRows}
            </tbody>
          </table>
        </div>

        <!-- Newborn / Delivery Records if any -->
        ${newbornsHtml}

        <!-- Footer -->
        <div class="footer">
          <div>
            This document is generated directly from the Barangay Maternal Care System (BMS).<br>
            Intended for patient personal records, medical transfer, or clinical consultation.
          </div>
          <div style="text-align: right;">
            Page 1 of 1 • System Export
          </div>
        </div>
      </body>
    </html>
  `;
}
