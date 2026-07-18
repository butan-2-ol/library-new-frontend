/**
 * Pending Review tab logic for dashboard.html.
 * Loaded via <script src="pendingReview.js"></script> after dashboard.js.
 *
 * Reuses the exact same auth pattern as dashboard.js:
 * localStorage 'authToken', sent as "Authorization: Bearer <token>".
 */

document.addEventListener("DOMContentLoaded", function () {
    const authToken = localStorage.getItem("authToken");
    if (!authToken) return; // dashboard.js already redirects to login in this case

    const listEl = document.getElementById("pending-review-list");
    const countEl = document.getElementById("pending-review-count");
    const sectionEl = document.getElementById("pending-review-section");
    const toggleBtn = document.getElementById("pending-review-btn");

    if (!listEl || !sectionEl) return; // markup not present on this page, skip silently

    function authHeaders() {
        return {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + authToken,
        };
    }

    // Toggle visibility, matching how the rest of the dashboard is laid
    // out (stacked sections, no existing tab system) — clicking the nav
    // button just shows/hides this section.
    if (toggleBtn) {
        toggleBtn.addEventListener("click", function () {
            const isHidden = sectionEl.style.display === "none" || !sectionEl.style.display;
            sectionEl.style.display = isHidden ? "block" : "none";
            if (isHidden) loadFlagged();
        });
    }

    async function loadFlagged() {
        listEl.innerHTML = '<p class="no-flagged">Loading…</p>';
        try {
            const res = await fetch(window.CONFIG.API_URL + "/review/flagged", {
                headers: authHeaders(),
            });
            if (res.status === 401) {
                window.location.href = "login.html";
                return;
            }
            if (!res.ok) throw new Error("Failed to load flagged registrations");
            const data = await res.json();
            renderList(data.flagged);
        } catch (err) {
            console.error("Load flagged error:", err);
            listEl.innerHTML = '<p class="no-flagged">Couldn\'t load pending reviews. Try refreshing.</p>';
        }
    }

    function renderList(items) {
        if (countEl) countEl.textContent = items.length > 0 ? "(" + items.length + ")" : "";

        if (items.length === 0) {
            listEl.innerHTML = '<p class="no-flagged">Nothing pending review right now.</p>';
            return;
        }

        listEl.innerHTML = items.map(renderCard).join("");

        items.forEach((item) => {
            const cardId = item.visitor_type + "-" + item.registration_id;

            const approveBtn = document.getElementById("approve-" + cardId);
            if (approveBtn) {
                approveBtn.addEventListener("click", function () {
                    approveFlagged(item.visitor_type, item.registration_id);
                });
            }

            const editBtn = document.getElementById("edit-" + cardId);
            if (editBtn) {
                editBtn.addEventListener("click", function () {
                    const fields = document.getElementById("edit-fields-" + cardId);
                    fields.style.display = fields.style.display === "block" ? "none" : "block";
                });
            }

            const saveBtn = document.getElementById("save-" + cardId);
            if (saveBtn) {
                saveBtn.addEventListener("click", function () {
                    const nameInput = document.getElementById("input-name-" + cardId);
                    const idInput = document.getElementById("input-id-" + cardId);
                    resolveFlagged(item.visitor_type, item.registration_id, nameInput.value.trim(), idInput.value.trim());
                });
            }
        });
    }

    function renderCard(item) {
        const cardId = item.visitor_type + "-" + item.registration_id;
        const ocrName = item.ocr_extracted_name || "(not detected)";
        const ocrId = item.ocr_extracted_id || "(not detected)";

        let duplicateNote = "";
        if (item.duplicate_match) {
            duplicateNote =
                '<div class="duplicate-note">\u26A0 Face closely matches another registered ' +
                escapeHtml(item.duplicate_match.visitor_type) +
                " record (" + escapeHtml(item.duplicate_match.registration_id) + "). Worth checking for a duplicate account.</div>";
        }

        let attemptsNote = "";
        if (item.ocr_attempts && item.ocr_attempts.length > 0) {
            attemptsNote =
                '<div class="compare-row"><span class="label">ID attempts:</span> ' +
                item.ocr_attempts.map(escapeHtml).join(", ") + "</div>";
        }

        return (
            '<div class="review-card">' +
            "<h4>" + escapeHtml(item.name) + " \u2014 " + escapeHtml(item.visitor_type) + " (" + escapeHtml(item.registration_id) + ")</h4>" +
            '<div class="compare-row"><span class="label">Typed name:</span> ' + escapeHtml(item.name) + "</div>" +
            '<div class="compare-row"><span class="label">Card read:</span> ' + escapeHtml(ocrName) + "</div>" +
            '<div class="compare-row"><span class="label">Typed ID:</span> ' + escapeHtml(item.id_value) + "</div>" +
            '<div class="compare-row"><span class="label">Card read:</span> ' + escapeHtml(ocrId) + "</div>" +
            attemptsNote +
            duplicateNote +
            '<div class="actions">' +
            '<button class="btn-approve" id="approve-' + cardId + '">Approve As-Is</button>' +
            '<button class="btn-edit" id="edit-' + cardId + '">Correct Details</button>' +
            "</div>" +
            '<div class="edit-fields" id="edit-fields-' + cardId + '">' +
            '<input type="text" id="input-name-' + cardId + '" placeholder="Correct name" value="' + escapeAttr(item.name) + '">' +
            '<input type="text" id="input-id-' + cardId + '" placeholder="Correct ID number" value="' + escapeAttr(item.id_value) + '">' +
            '<button class="btn-save" id="save-' + cardId + '">Save Correction</button>' +
            "</div>" +
            "</div>"
        );
    }

    async function approveFlagged(visitorType, registrationId) {
        try {
            const res = await fetch(
                window.CONFIG.API_URL + "/review/" + visitorType + "/" + registrationId + "/approve",
                {
                    method: "PUT",
                    headers: authHeaders(),
                    body: JSON.stringify({ reviewed_by: "librarian" }),
                }
            );
            if (res.status === 401) {
                window.location.href = "login.html";
                return;
            }
            if (!res.ok) throw new Error("Approve failed");
            loadFlagged();
        } catch (err) {
            console.error("Approve error:", err);
            alert("Couldn't approve this registration. Try again.");
        }
    }

    async function resolveFlagged(visitorType, registrationId, correctedName, correctedId) {
        try {
            const res = await fetch(
                window.CONFIG.API_URL + "/review/" + visitorType + "/" + registrationId + "/resolve",
                {
                    method: "PUT",
                    headers: authHeaders(),
                    body: JSON.stringify({
                        corrected_name: correctedName || null,
                        corrected_id: correctedId || null,
                        reviewed_by: "librarian",
                    }),
                }
            );
            if (res.status === 401) {
                window.location.href = "login.html";
                return;
            }
            if (!res.ok) throw new Error("Resolve failed");
            loadFlagged();
        } catch (err) {
            console.error("Resolve error:", err);
            alert("Couldn't save the correction. Try again.");
        }
    }

    function escapeHtml(str) {
        const div = document.createElement("div");
        div.textContent = str == null ? "" : String(str);
        return div.innerHTML;
    }
    function escapeAttr(str) {
        return escapeHtml(str).replace(/"/g, "&quot;");
    }

    // If the section starts visible, load right away.
    if (sectionEl.style.display !== "none") {
        loadFlagged();
    }
});