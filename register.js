document.addEventListener("DOMContentLoaded", function () {
    const visitorTypeSelect = document.getElementById("visitor-type");

    const fieldId = document.getElementById("field-user-id");
    const fieldDept = document.getElementById("field-user-dept");
    const fieldStatus = document.getElementById("field-staff-status");
    const fieldGender = document.getElementById("field-user-gender");
    const fieldEmail = document.getElementById("field-user-email");
    const fieldLevel = document.getElementById("field-user-level");

    // ---- Stage elements ----
    const stage1 = document.getElementById("stage-1");
    const stage2 = document.getElementById("stage-2");
    const stage3 = document.getElementById("stage-3");
    const progressStep1 = document.getElementById("progress-step-1");
    const progressStep2 = document.getElementById("progress-step-2");
    const progressStep3 = document.getElementById("progress-step-3");

    const stage1NextBtn = document.getElementById("stage1-next");
    const stage2BackBtn = document.getElementById("stage2-back");
    const stage2NextBtn = document.getElementById("stage2-next");
    const stage3Container = document.getElementById("stage3-container");

    const idCaptureSection = document.getElementById("id-capture-section");

    // ---- Face capture elements ----
    let storedFaceDescriptor = null;
    let duplicateFaceFlag = false; // informational only — server re-checks at submit
    const startBtn = document.getElementById("start-camera-btn");
    const captureBtn = document.getElementById("capture-face-btn");
    const video = document.getElementById("face-video");
    const canvas = document.getElementById("face-canvas");
    const faceStatus = document.getElementById("face-status");

    // ---- ID capture elements ----
    let capturedIdBlob = null;
    let idStream = null;
    const startIdBtn = document.getElementById("start-id-camera-btn");
    const captureIdBtn = document.getElementById("capture-id-btn");
    const retakeIdBtn = document.getElementById("retake-id-btn");
    const idVideo = document.getElementById("id-video");
    const idCanvas = document.getElementById("id-canvas");
    const idStatus = document.getElementById("id-status");

    // ---- ID verification state (the retry-then-flag logic) ----
    const MAX_ID_ATTEMPTS = 3;
    let idAttempts = 0;
    let idAttemptsLog = []; // each attempt's OCR-read ID number, for reviewer context
    let idVerificationStatus = null; // null | 'matched' | 'name_mismatch' | 'id_flagged'
    let lastOcrResult = null;

    const registrationForm = document.querySelector("form");

    function updateFormVisibility() {
        const selectedValue = visitorTypeSelect.value;

        fieldId.style.display = "none";
        fieldDept.style.display = "none";
        fieldStatus.style.display = "none";
        fieldGender.style.display = "none";
        fieldEmail.style.display = "none";
        fieldLevel.style.display = "none";

        if (selectedValue === "student") {
            fieldId.style.display = "block";
            fieldDept.style.display = "block";
            fieldGender.style.display = "block";
            fieldEmail.style.display = "block";
            fieldLevel.style.display = "block";
        } else if (selectedValue === "staff") {
            fieldId.style.display = "block";
            fieldDept.style.display = "block";
            fieldStatus.style.display = "block";
            fieldGender.style.display = "block";
            fieldEmail.style.display = "block";
        }

        idCaptureSection.style.display = selectedValue === "guest" ? "none" : "block";
        updateStage2ContinueState();
    }

    updateFormVisibility();
    visitorTypeSelect.addEventListener("change", updateFormVisibility);

    // =====================================================================
    // STAGE NAVIGATION
    // =====================================================================
    function goToStage(n) {
        [stage1, stage2, stage3].forEach((s) => s.classList.remove("active"));
        [progressStep1, progressStep2, progressStep3].forEach((s) => {
            s.classList.remove("active", "done");
        });

        if (n === 1) {
            stage1.classList.add("active");
            progressStep1.classList.add("active");
        } else if (n === 2) {
            stage2.classList.add("active");
            progressStep1.classList.add("done");
            progressStep2.classList.add("active");
        } else if (n === 3) {
            stage3.classList.add("active");
            progressStep1.classList.add("done");
            progressStep2.classList.add("done");
            progressStep3.classList.add("active");
        }
    }

    stage1NextBtn.addEventListener("click", function () {
        const consentCheckbox = document.getElementById("consent-checkbox");
        if (!consentCheckbox.checked) {
            alert("You must consent to data collection before continuing.");
            return;
        }

        const visitorType = visitorTypeSelect.value;
        if (!visitorType) {
            alert("Please select a visitor category first.");
            return;
        }

        const nameVal = document.getElementById("user-name").value.trim();
        const phoneVal = document.getElementById("user-phone").value.trim();
        if (!nameVal || !phoneVal) {
            alert("Please fill in your Name and Phone number before continuing.");
            return;
        }

        if (visitorType === "student") {
            const idVal = document.getElementById("user-id").value.trim();
            const deptVal = document.getElementById("user-dept").value;
            const genderVal = document.getElementById("user-gender").value;
            const emailVal = document.getElementById("user-email").value.trim();
            const levelVal = document.getElementById("user-level").value;
            if (!idVal || !deptVal || !genderVal || !emailVal || !levelVal) {
                alert("Please fill in all required Student fields.");
                return;
            }
        } else if (visitorType === "staff") {
            const idVal = document.getElementById("user-id").value.trim();
            const deptVal = document.getElementById("user-dept").value;
            const genderVal = document.getElementById("user-gender").value;
            const emailVal = document.getElementById("user-email").value.trim();
            const statusVal = document.getElementById("staff-status").value;
            if (!idVal || !deptVal || !genderVal || !emailVal || !statusVal) {
                alert("Please fill in all required Staff fields.");
                return;
            }
        }

        goToStage(2);
    });

    stage2BackBtn.addEventListener("click", function () {
        goToStage(1);
    });

    stage2NextBtn.addEventListener("click", function () {
        stopFaceCamera();
        stopIdCamera();
        goToStage(3);
        renderStage3();
    });

    function updateStage2ContinueState() {
        const visitorType = visitorTypeSelect.value;
        const idSatisfied = visitorType === "guest" || idVerificationStatus !== null;
        const faceSatisfied = !!storedFaceDescriptor;
        stage2NextBtn.disabled = !(idSatisfied && faceSatisfied);
    }

    // =====================================================================
    // ID CARD CAPTURE + RETRY-THEN-FLAG VERIFICATION (Stage 2)
    // =====================================================================
    startIdBtn.addEventListener("click", async function () {
        try {
            setIdStatus("Starting camera...", "");
            idStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 960 } },
            });
            idVideo.srcObject = idStream;
            await idVideo.play();

            startIdBtn.style.display = "none";
            captureIdBtn.style.display = "inline-block";
            setIdStatus("Fit your ID card in the frame, then capture.", "");
        } catch (err) {
            console.error("ID camera error:", err);
            setIdStatus("Could not start camera.", "error");
        }
    });

    captureIdBtn.addEventListener("click", function () {
        const vw = idVideo.videoWidth;
        const vh = idVideo.videoHeight;

        const guideW = vw * 0.90;
        const guideH = vh * 0.71;
        const guideX = (vw - guideW) / 2;
        const guideY = (vh - guideH) / 2;

        idCanvas.width = guideW;
        idCanvas.height = guideH;
        const ctx = idCanvas.getContext("2d");
        ctx.drawImage(idVideo, guideX, guideY, guideW, guideH, 0, 0, guideW, guideH);

        const quality = checkImageQuality(ctx, guideW, guideH);
        if (!quality.ok) {
            setIdStatus(quality.message, "error");
            return;
        }

        idCanvas.toBlob(
            async function (blob) {
                capturedIdBlob = blob;
                stopIdCamera();
                await verifyIdPhoto(blob);
            },
            "image/jpeg",
            0.92
        );
    });

    retakeIdBtn.addEventListener("click", async function () {
        retakeIdBtn.style.display = "none";
        startIdBtn.style.display = "inline-block";
        startIdBtn.click();
    });

    async function verifyIdPhoto(blob) {
        setIdStatus("Checking your ID…", "");

        const nameVal = document.getElementById("user-name").value.trim();
        const idVal = document.getElementById("user-id").value.trim();

        try {
            const body = new FormData();
            body.append("id_photo", blob, "id.jpg");
            body.append("name", nameVal);
            body.append("student_id", idVal);

            const res = await fetch(window.CONFIG.API_URL + "/ocr/verify", { method: "POST", body: body });
            if (!res.ok) throw new Error("OCR verification request failed");
            const result = await res.json();
            lastOcrResult = result;

            if (!result.requires_confirmation) {
                idVerificationStatus = "matched";
                setIdStatus("ID verified \u2713", "success");
                retakeIdBtn.style.display = "none";
            } else if (result.matches.id_number.match && !result.matches.name.match) {
                idVerificationStatus = "name_mismatch";
                setIdStatus("ID number verified. We'll confirm your name in the next step.", "success");
                retakeIdBtn.style.display = "none";
            } else {
                idAttempts++;
                idAttemptsLog.push(result.ocr_extracted.id_number || "(unreadable)");

                if (idAttempts < MAX_ID_ATTEMPTS) {
                    setIdStatus(
                        "ID number didn't match (attempt " + idAttempts + " of " + MAX_ID_ATTEMPTS + ") \u2014 please retake your photo, flat and well-lit.",
                        "warn"
                    );
                    retakeIdBtn.style.display = "inline-block";
                    idVerificationStatus = null;
                } else {
                    idVerificationStatus = "id_flagged";
                    setIdStatus(
                        "We couldn't verify your ID after a few tries. You can continue \u2014 this will be reviewed by library staff.",
                        "warn"
                    );
                    retakeIdBtn.style.display = "none";
                }
            }
        } catch (err) {
            console.error("OCR verify error:", err);
            idVerificationStatus = "id_flagged";
            setIdStatus("Couldn't process your ID photo. You can continue \u2014 this will be reviewed by staff.", "warn");
            retakeIdBtn.style.display = "none";
        }

        updateStage2ContinueState();
    }

    function setIdStatus(text, cls) {
        idStatus.textContent = text;
        idStatus.className = cls || "";
    }

    function checkImageQuality(ctx, w, h) {
        if (w < 400 || h < 250) {
            return { ok: false, message: "Move closer \u2014 the card needs to fill the frame." };
        }
        const imageData = ctx.getImageData(0, 0, w, h).data;
        let total = 0, count = 0;
        for (let i = 0; i < imageData.length; i += 400) {
            total += (imageData[i] + imageData[i + 1] + imageData[i + 2]) / 3;
            count++;
        }
        const avgBrightness = total / count;
        if (avgBrightness < 60) return { ok: false, message: "Too dark \u2014 find better lighting and retake." };
        if (avgBrightness > 235) return { ok: false, message: "Glare on the card \u2014 tilt it slightly and retake." };
        return { ok: true };
    }

    function stopIdCamera() {
        if (idStream) {
            idStream.getTracks().forEach((t) => t.stop());
            idStream = null;
        }
    }

    // =====================================================================
    // FACE CAPTURE + SILENT DUPLICATE CHECK (Stage 2)
    // =====================================================================
    startBtn.addEventListener("click", async () => {
        try {
            faceStatus.textContent = "Loading recognition models...";
            startBtn.disabled = true;

            await faceapi.nets.tinyFaceDetector.loadFromUri(window.CONFIG.MODEL_URL);
            await faceapi.nets.faceLandmark68Net.loadFromUri(window.CONFIG.MODEL_URL);
            await faceapi.nets.faceRecognitionNet.loadFromUri(window.CONFIG.MODEL_URL);

            faceStatus.textContent = "Starting camera stream...";

            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 300, height: 200 },
            });
            video.srcObject = stream;

            captureBtn.style.display = "inline-block";
            faceStatus.textContent = "Camera ready. Position your face.";
        } catch (error) {
            console.error("Camera/Model error:", error);
            faceStatus.textContent = "Failed to initialize camera or models.";
            startBtn.disabled = false;
        }
    });

    captureBtn.addEventListener("click", async () => {
        if (!video.srcObject) {
            faceStatus.textContent = "Camera is not running.";
            return;
        }

        faceStatus.textContent = "Analyzing face... stand still.";
        faceStatus.className = "";

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const detection = await faceapi
            .detectSingleFace(canvas, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks()
            .withFaceDescriptor();

        if (detection) {
            storedFaceDescriptor = Array.from(detection.descriptor);
            faceStatus.textContent = "Face captured successfully \u2713";
            faceStatus.className = "success";
            checkDuplicateFace(storedFaceDescriptor);
        } else {
            storedFaceDescriptor = null;
            faceStatus.textContent = "No face detected, try again.";
            faceStatus.className = "error";
        }

        updateStage2ContinueState();
    });

    async function checkDuplicateFace(descriptor) {
        try {
            const res = await fetch(window.CONFIG.API_URL + "/faces/check-duplicate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ face_descriptor: descriptor }),
            });
            if (!res.ok) return;
            const result = await res.json();
            duplicateFaceFlag = !!result.duplicate;

            if (duplicateFaceFlag) {
                faceStatus.textContent =
                    "Face captured \u2713 (this will be reviewed by staff before your account is finalized)";
                faceStatus.className = "warn";
            }
        } catch (err) {
            console.error("Duplicate face check error:", err);
        }
    }

    function stopFaceCamera() {
        const stream = video.srcObject;
        if (stream) {
            stream.getTracks().forEach((t) => t.stop());
        }
    }

    // =====================================================================
    // STAGE 3 — confirm (name-only correction if needed) & submit
    // =====================================================================
    function collectFormState() {
        const visitorType = visitorTypeSelect.value;
        return {
            visitorType: visitorType,
            name: document.getElementById("user-name").value.trim(),
            phone: document.getElementById("user-phone").value.trim(),
            id: document.getElementById("user-id") ? document.getElementById("user-id").value.trim() : "",
            dept: document.getElementById("user-dept") ? document.getElementById("user-dept").value : "",
            gender: document.getElementById("user-gender") ? document.getElementById("user-gender").value : "",
            email: document.getElementById("user-email") ? document.getElementById("user-email").value.trim() : "",
            level: document.getElementById("user-level") ? document.getElementById("user-level").value : "",
            staffStatus: document.getElementById("staff-status") ? document.getElementById("staff-status").value : "",
            faceDescriptor: storedFaceDescriptor,
        };
    }

    function renderStage3() {
        const formState = collectFormState();

        if (formState.visitorType === "guest" || idVerificationStatus === "matched") {
            renderCleanConfirm(formState);
        } else if (idVerificationStatus === "name_mismatch") {
            renderNameCorrection(formState);
        } else if (idVerificationStatus === "id_flagged") {
            renderPendingReview(formState);
        } else {
            renderCleanConfirm(formState);
        }
    }

    function renderCleanConfirm(formState) {
        stage3Container.innerHTML =
            '<h3>Looks good \u2713</h3>' +
            '<div class="field-row matched"><strong>Name:</strong> ' + escapeHtml(formState.name) + '</div>' +
            (formState.id ? '<div class="field-row matched"><strong>ID Number:</strong> ' + escapeHtml(formState.id) + '</div>' : '') +
            '<div class="stage-nav">' +
            '<button type="button" class="btn-back" id="stage3-back">Back</button>' +
            '<button type="button" id="confirm-submit-btn">Confirm & Submit</button>' +
            '</div>';
        wireStage3Back();
        document.getElementById("confirm-submit-btn").addEventListener("click", function () {
            submitRegistration(formState, { verification_status: "auto_approved" });
        });
    }

    function renderNameCorrection(formState) {
        const nameOcr = lastOcrResult.ocr_extracted.name;
        stage3Container.innerHTML =
            '<h3>Quick check \u2014 which name is correct?</h3>' +
            '<div class="field-row matched"><strong>ID Number:</strong> ' + escapeHtml(formState.id) + ' \u2713</div>' +
            '<div class="field-row mismatch">' +
            '<strong>Name:</strong>' +
            '<label><input type="radio" name="name-choice" value="' + escapeAttr(formState.name) + '" checked> You entered: ' + escapeHtml(formState.name) + '</label>' +
            '<label><input type="radio" name="name-choice" value="' + escapeAttr(nameOcr || "") + '"> ID shows: ' + escapeHtml(nameOcr || "(unreadable)") + '</label>' +
            '</div>' +
            '<div class="stage-nav">' +
            '<button type="button" class="btn-back" id="stage3-back">Back</button>' +
            '<button type="button" id="confirm-submit-btn">Confirm & Submit</button>' +
            '</div>';
        wireStage3Back();
        document.getElementById("confirm-submit-btn").addEventListener("click", function () {
            const selected = document.querySelector('input[name="name-choice"]:checked');
            const finalState = Object.assign({}, formState, { name: selected ? selected.value : formState.name });
            submitRegistration(finalState, {
                verification_status: "flagged",
                ocr_match_confidence: lastOcrResult.overall_confidence,
                ocr_extracted_name: nameOcr,
                ocr_extracted_id: lastOcrResult.ocr_extracted.id_number,
            });
        });
    }

    function renderPendingReview(formState) {
        stage3Container.innerHTML =
            '<h3>Almost done</h3>' +
            '<div class="notice-box">We couldn\'t automatically verify your ID card. Your registration will still go through, but a librarian will review it shortly.</div>' +
            '<div class="field-row matched"><strong>Name:</strong> ' + escapeHtml(formState.name) + '</div>' +
            '<div class="field-row matched"><strong>ID Number:</strong> ' + escapeHtml(formState.id) + '</div>' +
            '<div class="stage-nav">' +
            '<button type="button" class="btn-back" id="stage3-back">Back</button>' +
            '<button type="button" id="confirm-submit-btn">Submit</button>' +
            '</div>';
        wireStage3Back();
        document.getElementById("confirm-submit-btn").addEventListener("click", function () {
            submitRegistration(formState, {
                verification_status: "flagged",
                ocr_match_confidence: lastOcrResult ? lastOcrResult.overall_confidence : 0,
                ocr_extracted_name: lastOcrResult ? lastOcrResult.ocr_extracted.name : null,
                ocr_extracted_id: lastOcrResult ? lastOcrResult.ocr_extracted.id_number : null,
                ocr_attempts: idAttemptsLog,
            });
        });
    }

    function wireStage3Back() {
        document.getElementById("stage3-back").addEventListener("click", function () {
            goToStage(2);
        });
    }

    function submitRegistration(formState, verificationFields) {
        let apiEndpoint = "";
        let payload = {};

        if (formState.visitorType === "student") {
            apiEndpoint = window.CONFIG.API_URL + "/students";
            payload = {
                student_name: formState.name,
                student_phone: formState.phone,
                student_id: formState.id,
                student_dept: formState.dept,
                student_gender: formState.gender,
                student_email: formState.email,
                level: formState.level,
            };
        } else if (formState.visitorType === "staff") {
            apiEndpoint = window.CONFIG.API_URL + "/staff";
            payload = {
                staff_name: formState.name,
                staff_phone: formState.phone,
                staff_id: formState.id,
                staff_dept: formState.dept,
                staff_gender: formState.gender,
                staff_email: formState.email,
                status: formState.staffStatus,
            };
        } else if (formState.visitorType === "guest") {
            apiEndpoint = window.CONFIG.API_URL + "/guests";
            payload = {
                guest_name: formState.name,
                guest_phone: formState.phone,
            };
        }

        if (formState.faceDescriptor) {
            payload.face_data = formState.faceDescriptor;
        }
        Object.assign(payload, verificationFields);

        stage3Container.innerHTML = '<p class="processing">Submitting…</p>';

        fetch(apiEndpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        })
            .then(function (response) {
                if (!response.ok) {
                    return response.json().then(function (errData) {
                        throw new Error(errData.message || "Network response was not ok");
                    });
                }
                return response.json();
            })
            .then(function (data) {
                showSuccessScreen(data);
            })
            .catch(function (error) {
                console.error("Registration Error:", error);
                alert(error.message || "An error occurred during registration. Please try again.");
                goToStage(1);
            });
    }

    function showSuccessScreen(data) {
        stage3Container.innerHTML =
            '<div id="qr-result">' +
            '<h3>Registration Complete \u2713</h3>' +
            '<img src="' + data.data.qr_code + '" alt="Generated Registration QR Code" />' +
            '<p>' + escapeHtml(data.data.registration_id) + '</p>' +
            '<button type="button" id="print-qr-btn">Print QR Code</button>' +
            '<button type="button" id="register-another-btn">Register Another Visitor</button>' +
            '</div>';

        document.getElementById("print-qr-btn").addEventListener("click", function () {
            const printWindow = window.open("", "_blank");
            printWindow.document.write(
                '<html><body style="text-align:center; margin-top: 50px;">' +
                '<img src="' + data.data.qr_code + '" alt="QR Code"/>' +
                '<p>' + data.data.registration_id + '</p>' +
                '</body></html>'
            );
            printWindow.document.close();
            printWindow.print();
        });

        document.getElementById("register-another-btn").addEventListener("click", function () {
            resetEverything();
        });
    }

    function resetEverything() {
        registrationForm.reset();

        storedFaceDescriptor = null;
        duplicateFaceFlag = false;
        capturedIdBlob = null;
        idAttempts = 0;
        idAttemptsLog = [];
        idVerificationStatus = null;
        lastOcrResult = null;

        faceStatus.textContent = "No face captured yet.";
        faceStatus.className = "";
        captureBtn.style.display = "none";
        startBtn.disabled = false;

        setIdStatus("No ID photo captured yet.", "");
        captureIdBtn.style.display = "none";
        retakeIdBtn.style.display = "none";
        startIdBtn.style.display = "inline-block";

        updateFormVisibility();
        goToStage(1);
    }

    function escapeHtml(str) {
        const div = document.createElement("div");
        div.textContent = str == null ? "" : str;
        return div.innerHTML;
    }
    function escapeAttr(str) {
        return escapeHtml(str).replace(/"/g, "&quot;");
    }
});