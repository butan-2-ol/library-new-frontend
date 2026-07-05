document.addEventListener("DOMContentLoaded", function() {
    const visitorTypeSelect = document.getElementById("visitor-type");
    
    const fieldId = document.getElementById("field-user-id");
    const fieldDept = document.getElementById("field-user-dept");
    const fieldStatus = document.getElementById("field-staff-status");
    const fieldGender = document.getElementById("field-user-gender");
    const fieldEmail = document.getElementById("field-user-email");
    const fieldLevel = document.getElementById("field-user-level");

    // Variable to store the 128-digit floating-point face descriptor array (Optional)
    let storedFaceDescriptor = null;

    // Grab DOM Elements matching your HTML layout IDs
    const startBtn = document.getElementById('start-camera-btn');
    const captureBtn = document.getElementById('capture-face-btn');
    const video = document.getElementById('face-video');    
    const canvas = document.getElementById('face-canvas');  
    const faceStatus = document.getElementById('face-status');

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
        } 
        else if (selectedValue === "staff") {
            fieldId.style.display = "block";
            fieldDept.style.display = "block";
            fieldStatus.style.display = "block";
            fieldGender.style.display = "block";
            fieldEmail.style.display = "block";
        } 
    }

    updateFormVisibility();
    visitorTypeSelect.addEventListener("change", updateFormVisibility);
  
    const registrationForm = document.querySelector("form");
    const qrSection = document.getElementById("qr-section");

    // Unified Form Submission Handler
    registrationForm.addEventListener("submit", function(event) {
        event.preventDefault();

        const consentCheckbox = document.getElementById('consent-checkbox');
            if (!consentCheckbox.checked) {
                alert('You must consent to data collection before registering.');
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
            alert("Please fill in your Name and Phone number before submitting.");
            return;
        }

        let apiEndpoint = "";
        let payload = {};

        if (visitorType === "student") {
            const idVal = document.getElementById("user-id").value.trim();
            const deptVal = document.getElementById("user-dept").value.trim();
            const genderVal = document.getElementById("user-gender").value; 
            const emailVal = document.getElementById("user-email").value.trim();
            const levelVal = document.getElementById("user-level").value;

            if (!idVal || !deptVal || !genderVal || !emailVal  || !levelVal) {
                alert("Please fill in all required Student fields.");
                return;
            }

           apiEndpoint = `${window.CONFIG.API_URL}/students`;
            payload = {
                student_name: nameVal,
                student_phone: phoneVal,
                student_id: idVal,
                student_dept: deptVal,
                student_gender: genderVal,
                student_email: emailVal,
                level: levelVal
            };
        } 
        else if (visitorType === "staff") {
            const idVal = document.getElementById("user-id").value.trim();
            const deptVal = document.getElementById("user-dept").value.trim();
            const genderVal = document.getElementById("user-gender").value;
            const emailVal = document.getElementById("user-email").value.trim();
            const statusVal = document.getElementById("staff-status").value;

            if (!idVal || !deptVal || !genderVal || !emailVal || !statusVal) {
                alert("Please fill in all required Staff fields.");
                return;
            }

            apiEndpoint = `${window.CONFIG.API_URL}/staff`;
            payload = {
                staff_name: nameVal,
                staff_phone: phoneVal,
                staff_id: idVal,
                staff_dept: deptVal,
                staff_gender: genderVal,
                staff_email: emailVal,
                status: statusVal
            };
        } 
        else if (visitorType === "guest") {
            apiEndpoint = `${window.CONFIG.API_URL}/guests`;
            payload = {
                guest_name: nameVal,
                guest_phone: phoneVal
            };
        }

        // OPTIONAL FACE CAPTURE CHECK: If face data exists, append it seamlessly to the payload
        if (storedFaceDescriptor) {
            payload['face_data'] = storedFaceDescriptor;
        }

        fetch(apiEndpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        })
       .then(response => {
            if (!response.ok) {
                return response.json().then(errData => {
                    throw new Error(errData.message || "Network response was not ok");
                });
            }
            return response.json(); 
        })
        .then(data => {
            qrSection.innerHTML = "<h3>QR Code Section</h3>";

            const qrImage = document.createElement("img");
            qrImage.src = data.data.qr_code; 
            qrImage.alt = "Generated Registration QR Code";
            qrImage.style.marginTop = "15px";
            qrSection.appendChild(qrImage);

            const printButton = document.createElement("button");
            printButton.textContent = "Print QR Code";
            qrSection.appendChild(printButton);

            printButton.addEventListener("click", function() {
                const printWindow = window.open('', '_blank');
                printWindow.document.write(`
                    <html>
                        <body style="text-align:center; margin-top: 50px;">
                            <img src="${data.data.qr_code}" alt="QR Code"/>
                            <p>${data.data.registration_id}</p>
                        </body>
                    </html>
                `);
                printWindow.document.close();
                printWindow.print();
            });

            // Clean up: turn off camera hardware streams upon submission success
            const stream = video.srcObject;
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }

            registrationForm.reset();
            consentCheckbox.checked = false;
            storedFaceDescriptor = null; // Clear the temporary signature variable
            if (faceStatus) {
                faceStatus.textContent = "No face captured yet.";
                faceStatus.style.color = "";
            }
            if (captureBtn) captureBtn.style.display = 'none';
            if (startBtn) startBtn.disabled = false;
            
            updateFormVisibility();
        })
        .catch(error => {
            console.error("Registration Error:", error);
            alert(error.message || "An error occurred during registration. Please try again.");
        });
    });

    /**
     * CAMERA LOGIC: Handle "Start Camera" Click
     */
    startBtn.addEventListener('click', async () => {
        try {
            faceStatus.textContent = "Loading recognition models...";
            startBtn.disabled = true;

            // Updated to use absolute root path syntax to bypass directory structures
            await faceapi.nets.tinyFaceDetector.loadFromUri(window.CONFIG.MODEL_URL);
            await faceapi.nets.faceLandmark68Net.loadFromUri(window.CONFIG.MODEL_URL);
            await faceapi.nets.faceRecognitionNet.loadFromUri(window.CONFIG.MODEL_URL);
                        
            
            faceStatus.textContent = "Starting camera stream...";

            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { width: 300, height: 200 } 
            });
            video.srcObject = stream;

            captureBtn.style.display = 'inline-block';
            faceStatus.textContent = "Camera ready. Position your face.";
        } catch (error) {
            console.error("Camera/Model error:", error);
            faceStatus.textContent = "Failed to initialize camera or models.";
            startBtn.disabled = false;
        }
    });

    /**
     * CAMERA LOGIC: Handle "Capture Face" Click
     */
    captureBtn.addEventListener('click', async () => {
        if (!video.srcObject) {
            faceStatus.textContent = "Camera is not running.";
            return;
        }

        faceStatus.textContent = "Analyzing face... stand still.";

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const detection = await faceapi.detectSingleFace(canvas, new faceapi.TinyFaceDetectorOptions())
                                        .withFaceLandmarks()
                                        .withFaceDescriptor();

        if (detection) {
            storedFaceDescriptor = Array.from(detection.descriptor);
            faceStatus.textContent = "Face captured successfully";
            faceStatus.style.color = "#2b8a3e"; 
        } else {
            storedFaceDescriptor = null;
            faceStatus.textContent = "No face detected, try again ";
            faceStatus.style.color = "#c92a2a";
        }
    });
});