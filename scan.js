document.addEventListener("DOMContentLoaded", function() {
    const visitorDetailsDiv = document.getElementById("visitor-details");
    const faceStatusText = document.getElementById("face-status");
    const faceVideo = document.getElementById("face-video");
    
    // UI Panel Containers
    const faceScanSection = document.getElementById("face-scanner-container");
    const qrScanSection = document.getElementById("qr-scanner-container");
    
    // Toggle Control Buttons
    const btnSwitchToQr = document.getElementById("btn-switch-to-qr");
    const btnSwitchToFace = document.getElementById("btn-switch-to-face");
    
    let html5QrcodeScanner = null;
    let faceMatcher = null;
    let isProcessingTransaction = false; // State lock to avoid rapid cross-scanning triggers
    let faceDetectionIntervalId = null;
    let videoStreamReference = null; // Remembers current video stream tracks so they can be explicitly shut off

  /**
 * CORE INITIALIZATION ORCHESTRATOR
 */
async function initKioskGate() {
    try {
        // Bind the button interactive state switch listeners
        setupToggleNavigation();

        // 1. Initialize and Load Facial Recognition Models
        faceStatusText.textContent = "Loading biometric formulas...";
        
        // Trust window.CONFIG.MODEL_URL directly without forcing the app-resources override
        let modelBaseUrl = window.CONFIG.MODEL_URL;

        console.log("Requesting models from protocol base:", modelBaseUrl);

        // Using direct load methods to protect the protocol string structure
        await faceapi.loadTinyFaceDetectorModel(modelBaseUrl);
        await faceapi.loadFaceLandmarkModel(modelBaseUrl);
        await faceapi.loadFaceRecognitionModel(modelBaseUrl);

        // 2. Sync Database Profiles
        faceStatusText.textContent = "Synchronizing database face matrices...";
        await loadRegisteredFaceTemplates();

        // 3. Boot directly into the Primary Mode: Facial Recognition
        if (faceMatcher) {
            startFaceCameraStream();
        } else {
            faceStatusText.textContent = "No face profiles active in system.";
        }

    } catch (error) {
        console.error("Initialization breakdown:", error);
        faceStatusText.textContent = "Failed to launch biometrics suite.";
        faceStatusText.style.color = "#dc2626";
    }
}


    /**
     * TOGGLE STATE NAVIGATION HANDLER
     */
    function setupToggleNavigation() {
        // Toggle view from Face Recognition to QR
        btnSwitchToQr.addEventListener("click", () => {
            stopFaceCameraStream(); // Completely shut down webcam tracking hardware

            faceScanSection.style.display = "none";
            qrScanSection.style.display = "block";

            startQRScanner(); // Spin up HTML5 QR scanner engine
        });

        // Toggle view from QR back to Face Recognition
        btnSwitchToFace.addEventListener("click", () => {
            stopQRScanner(); // Kill running instance of QR container engine

            qrScanSection.style.display = "none";
            faceScanSection.style.display = "block";

            startFaceCameraStream(); // Re-open webcam lens and begin face tracking loops
        });
    }

    /**
     * QR SCANNER CONTROLLER
     */
    function startQRScanner() {
        visitorDetailsDiv.innerHTML = `
            <h3>Gate Status</h3>
            <p>Scan your QR code stable in front of the lens box area.</p>
        `;

        html5QrcodeScanner = new Html5QrcodeScanner(
            "reader", 
            { fps: 10, qrbox: { width: 250, height: 250 } },
            false
        );
        
        html5QrcodeScanner.render(onQRScanSuccess, onQRScanFailure);
    }

    function stopQRScanner() {
        if (html5QrcodeScanner) {
            html5QrcodeScanner.clear().then(() => {
                html5QrcodeScanner = null;
            }).catch(error => {
                console.error("Failed to clean up QR element engine instance:", error);
            });
        }
    }

    function onQRScanSuccess(decodedText, decodedResult) {
        if (isProcessingTransaction) return;

        isProcessingTransaction = true;
        
        if (html5QrcodeScanner) {
            html5QrcodeScanner.clear().then(() => {
                html5QrcodeScanner = null;
                console.log("QR scanned successfully. Processing payload check...");
                processVisitData({ registration_id: decodedText });
            }).catch(error => {
                console.error("Failed to pause QR hardware handler:", error);
                isProcessingTransaction = false;
            });
        } else {
            processVisitData({ registration_id: decodedText });
        }
    }

    function onQRScanFailure(error) {
        // Silent block for scanning noise frames
    }

    /**
     * FACIAL RECOGNITION CONTROLLER
     */
    async function loadRegisteredFaceTemplates() {
        try {
            const response = await fetch(`${window.CONFIG.API_URL}/visits/faces`);
            const result = await response.json();

            if (!result.success || result.data.length === 0) {
                console.log("Zero face vectors recorded in system database.");
                return;
            }

            const labeledDescriptors = [];

            result.data.forEach(user => {
                if (user.face_data && Array.isArray(user.face_data)) {
                    const floatArray = new Float32Array(user.face_data);
                    const labelToken = `${user.registration_id}:${user.name}`;
                    
                    labeledDescriptors.push(
                        new faceapi.LabeledFaceDescriptors(labelToken, [floatArray])
                    );
                }
            });

            if (labeledDescriptors.length > 0) {
                faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, 0.5);
                console.log(`Face registration profile sync successful: ${labeledDescriptors.length} loaded.`);
            }

        } catch (err) {
            console.error("Failed to compile cloud face descriptor matrices:", err);
        }
    }

    async function startFaceCameraStream() {
        if (isProcessingTransaction) return;

        visitorDetailsDiv.innerHTML = `
            <h3>Gate Status</h3>
            <p>Please look directly at the biometric camera scanner.</p>
        `;

        try {
            videoStreamReference = await navigator.mediaDevices.getUserMedia({ 
                video: { width: 460, height: 240 } 
            });
            faceVideo.srcObject = videoStreamReference;

            faceVideo.onloadedmetadata = () => {
                faceVideo.play();
                faceStatusText.textContent = "Scanning area for faces... Mode: active";
                faceStatusText.style.color = "#059669";
                
                if (!faceDetectionIntervalId) {
                    faceDetectionIntervalId = setInterval(analyzeLiveVideoFrame, 2000);
                }
            };
        } catch (err) {
            console.error("Webcam video stream hardware block:", err);
            faceStatusText.textContent = "Webcam hardware missing or blocked.";
            faceStatusText.style.color = "#dc2626";
        }
    }

    function stopFaceCameraStream() {
        // Clear frame analysis interval loop instantly
        if (faceDetectionIntervalId) {
            clearInterval(faceDetectionIntervalId);
            faceDetectionIntervalId = null;
        }
        
        faceVideo.pause();

        // Release the physical webcam light indicator handle securely
        if (videoStreamReference) {
            videoStreamReference.getTracks().forEach(track => track.stop());
            videoStreamReference = null;
        }
        faceVideo.srcObject = null;
    }

    async function analyzeLiveVideoFrame() {
        if (isProcessingTransaction || !faceMatcher || faceVideo.paused || faceVideo.ended) return;

        const detection = await faceapi.detectSingleFace(faceVideo, new faceapi.TinyFaceDetectorOptions())
                                        .withFaceLandmarks()
                                        .withFaceDescriptor();

        if (detection) {
            const bestMatch = faceMatcher.findBestMatch(detection.descriptor);
            
            if (bestMatch.label !== 'unknown') {
                isProcessingTransaction = true; // Lock system tracking channels
                stopFaceCameraStream(); // Instantly shut down camera stream

                const [registration_id, name] = bestMatch.label.split(':');
                
                faceStatusText.textContent = `Match Found: ${name}! Accessing logs...`;
                faceStatusText.style.color = "#2563eb";

                processVisitData({ registration_id });
            }
        }
    }

    /**
     * UNIFIED ENDPOINT TRANSACTION HANDLER
     */
    function processVisitData(payload) {
        visitorDetailsDiv.innerHTML = "<h3>Processing</h3><p>Verifying gate authorizations, please hold...</p>";

        fetch(`${window.CONFIG.API_URL}/visits`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload) 
        })
        .then(response => {
            if (!response.ok) throw new Error("Verification rejected by endpoint.");
            return response.json();
        })
        .then(data => {
            visitorDetailsDiv.innerHTML = `
                <div style="text-align: center; padding: 20px 0;">
                    <svg width="72" height="72" viewBox="0 0 24 24" fill="none" style="margin: 0 auto 12px auto; display: block;">
                        <circle cx="12" cy="12" r="10" fill="#d1fae5" />
                        <polyline points="8 12 11 15 16 9" stroke="#059669" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" 
                            style="stroke-dasharray: 20; stroke-dashoffset: 20; animation: drawCheck 0.3s ease-out 0.15s forwards;" />
                    </svg>
                    <h3 style="color: #059669; font-weight: 700; margin-bottom: 4px;">Access Granted!</h3>
                    <p style="color: #64748b; font-size: 14px;">Log compiled. Resetting terminal channels...</p>
                </div>
            `;

            resetGateSystemDelayed();
        })
        .catch(error => {
            console.error("Verification Error:", error);
            
            visitorDetailsDiv.innerHTML = `
                <div style="text-align: center; padding: 20px 0;">
                    <svg width="72" height="72" viewBox="0 0 24 24" fill="none" style="margin: 0 auto 12px auto; display: block;">
                        <circle cx="12" cy="12" r="10" fill="#fee2e2" />
                        <line x1="15" y1="9" x2="9" y2="15" stroke="#dc2626" stroke-width="2.5" stroke-linecap="round" />
                        <line x1="9" y1="9" x2="15" y2="15" stroke="#dc2626" stroke-width="2.5" stroke-linecap="round" />
                    </svg>
                    <h3 style="color: #dc2626; font-weight: 700; margin-bottom: 4px;">Gate Refused</h3>
                    <p style="color: #64748b; font-size: 14px;">Token unknown or unauthorized. Re-routing...</p>
                </div>
            `;

            resetGateSystemDelayed();
        });
    }

    /**
     * RESET ROUTINE COORDINATOR
     */
    function resetGateSystemDelayed() {
        setTimeout(() => {
            isProcessingTransaction = false;

            // Make sure active QR scanner logic states are scrubbed
            stopQRScanner();

            // Default UI structure back to primary face verification view
            qrScanSection.style.display = "none";
            faceScanSection.style.display = "block";

            // Boot face biometrics camera system back up
            startFaceCameraStream();
        }, 3000);
    }

    // Append standard checkmark tracking animations
    const styleTag = document.createElement("style");
    styleTag.textContent = `
        @keyframes drawCheck {
            to { stroke-dashoffset: 0; }
        }
    `;
    document.head.appendChild(styleTag);

    // Boot Up System
    initKioskGate();
});