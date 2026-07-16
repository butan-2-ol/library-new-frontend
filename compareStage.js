/**
 * Stage 3 — send the captured ID photo + Stage 1/2 data to /api/ocr/verify,
 * then either fast-path to submit (clean match) or show a correction UI
 * (mismatch) before the registrant confirms and the record is written.
 *
 * Assumes formState is an object collected across Stages 1-2, e.g.:
 *   { name, student_id, department, hall, campus, phone, email, level,
 *     face_data, id_photo_blob }
 */

async function runVerification(formState, { apiBase = "/api" } = {}) {
  const body = new FormData();
  body.append("id_photo", formState.id_photo_blob, "id.jpg");
  body.append("name", formState.name);
  body.append("student_id", formState.student_id);

  const res = await fetch(`${apiBase}/ocr/verify`, { method: "POST", body });
  if (!res.ok) {
    throw new Error("OCR verification request failed");
  }
  return res.json(); // { ocr_extracted, matches, overall_confidence, requires_confirmation }
}

/**
 * Renders the Stage 3 screen into `container`. Calls `onSubmit` with the
 * final, confirmed data once the registrant is done — that's the only
 * point that should trigger POST /api/students.
 */
async function renderStage3(container, formState, onSubmit) {
  container.innerHTML = `<p class="processing">Checking your details…</p>`;

  let result;
  try {
    result = await runVerification(formState);
  } catch (err) {
    // OCR totally failed (bad network, unreadable image, etc.) — don't
    // block registration, just flag it for admin review with no OCR data.
    onSubmit(buildFinalPayload(formState, {
      verification_status: "flagged",
      ocr_match_confidence: 0,
    }));
    return;
  }

  if (!result.requires_confirmation) {
    // Clean match — skip the correction UI entirely, go straight to a
    // quick confirm-and-submit so the common case stays fast.
    renderCleanConfirm(container, formState, result, onSubmit);
  } else {
    renderMismatchCorrection(container, formState, result, onSubmit);
  }
}

function renderCleanConfirm(container, formState, result, onSubmit) {
  container.innerHTML = `
    <div class="stage3-clean">
      <h3>Looks good ✓</h3>
      <p><strong>Name:</strong> ${escapeHtml(formState.name)}</p>
      <p><strong>ID Number:</strong> ${escapeHtml(formState.student_id)}</p>
      <button id="confirm-submit">Confirm & Submit</button>
    </div>
  `;
  container.querySelector("#confirm-submit").addEventListener("click", () => {
    onSubmit(buildFinalPayload(formState, {
      verification_status: "auto_approved",
      ocr_match_confidence: result.overall_confidence,
    }));
  });
}

function renderMismatchCorrection(container, formState, result, onSubmit) {
  const fields = [
    { key: "name", label: "Name", formVal: formState.name, ocrVal: result.ocr_extracted.name, match: result.matches.name.match },
    { key: "student_id", label: "ID Number", formVal: formState.student_id, ocrVal: result.ocr_extracted.id_number, match: result.matches.id_number.match },
    { key: "program", label: "Programme", formVal: formState.program, ocrVal: result.ocr_extracted.program, match: result.matches.program.match },
  ];

  container.innerHTML = `
    <div class="stage3-mismatch">
      <h3>We noticed a difference — please confirm which is correct</h3>
      ${fields.map((f) => renderFieldRow(f)).join("")}
      <button id="confirm-submit">Confirm & Submit</button>
    </div>
  `;

  container.querySelector("#confirm-submit").addEventListener("click", () => {
    const corrected = {};
    fields.forEach((f) => {
      const selected = container.querySelector(`input[name="${f.key}"]:checked`);
      corrected[f.key] = selected ? selected.value : f.formVal;
    });

    onSubmit(buildFinalPayload({ ...formState, ...corrected }, {
      verification_status: "flagged", // still flagged for the audit trail, but resolved in-session
      ocr_match_confidence: result.overall_confidence,
      ocr_extracted_name: result.ocr_extracted.name,
      ocr_extracted_id: result.ocr_extracted.id_number,
      ocr_extracted_program: result.ocr_extracted.program,
    }));
  });
}

function renderFieldRow(f) {
  if (f.match) {
    // Matched fields don't need a choice — just show them, no radio buttons.
    return `<div class="field-row matched"><strong>${f.label}:</strong> ${escapeHtml(f.formVal)} ✓</div>`;
  }

  const rowId = `field-${f.key}`;
  return `
    <div class="field-row mismatch">
      <strong>${f.label}:</strong>
      <label>
        <input type="radio" name="${f.key}" value="${escapeAttr(f.formVal)}" checked>
        You entered: ${escapeHtml(f.formVal)}
      </label>
      <label>
        <input type="radio" name="${f.key}" value="${escapeAttr(f.ocrVal || "")}">
        ID shows: ${escapeHtml(f.ocrVal || "(unreadable)")}
      </label>
    </div>
  `;
}

function buildFinalPayload(formState, verificationFields) {
  // Strip the raw photo blob before this goes to /api/students — it was
  // only ever needed for the /ocr/verify call.
  const { id_photo_blob, ...rest } = formState;
  return { ...rest, ...verificationFields };
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}
function escapeAttr(str) {
  return escapeHtml(str).replace(/"/g, "&quot;");
}

export { renderStage3, runVerification };