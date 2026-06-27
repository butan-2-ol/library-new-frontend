document.addEventListener("DOMContentLoaded", function() {
    const visitorDetailsDiv = document.getElementById("visitor-details");
    let html5QrcodeScanner = null;

   
    // 1. Scanner Initialization Pipeline
    
    function startScanner() {
        // Reset the details box to your baseline layout instruction text
        visitorDetailsDiv.innerHTML = `
            <h3>Scanner Status</h3>
            <p>Ready! Position a registration QR code inside the camera viewbox.</p>
        `;

        html5QrcodeScanner = new Html5QrcodeScanner(
            "reader", 
            { fps: 10, qrbox: { width: 250, height: 250 } },
            /* verbose= */ false
        );
        
        html5QrcodeScanner.render(onScanSuccess, onScanFailure);
    }

   
    // 2. Scan Success / Interception Mechanics
   
    function onScanSuccess(decodedText, decodedResult) {
        // Stop scanning instantly so rapid fires or double-scans don't trip up the database
        html5QrcodeScanner.clear().then(() => {
            console.log("Scanner paused. Processing current checkout transaction...");
            processVisit(decodedText);
        }).catch(error => {
            console.error("Failed to clear scanner:", error);
        });
    }

    function onScanFailure(error) {
        // Silent failure to avoid flooding the developer terminal log matrix
    }

    
    // 3. API Processing & Automated Kiosk Loop
   
    function processVisit(qrData) {
        visitorDetailsDiv.innerHTML = "<h3>Processing</h3><p>Verifying visit logs, please hold...</p>";

        fetch("http://localhost:5002/api/visits", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ registration_id: qrData }) 
        })
        .then(response => {
            if (!response.ok) throw new Error("Verification rejected by endpoint.");
            return response.json();
        })
        .then(data => {
            // Render the animated success tick view screen inside your container card
            visitorDetailsDiv.innerHTML = `
                <div style="text-align: center; padding: 20px 0;">
                    <svg width="72" height="72" viewBox="0 0 24 24" fill="none" style="margin: 0 auto 12px auto; display: block;">
                        <circle cx="12" cy="12" r="10" fill="#d1fae5" />
                        <polyline points="8 12 11 15 16 9" stroke="#059669" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" 
                            style="stroke-dasharray: 20; stroke-dashoffset: 20; animation: drawCheck 0.3s ease-out 0.15s forwards;" />
                    </svg>
                    <h3 style="color: #059669; font-weight: 700; margin-bottom: 4px;">Visit Logged!</h3>
                    <p style="color: #64748b; font-size: 14px;">Next scan will begin in a moment...</p>
                </div>
            `;

            // CRITICAL: Automatically loop back and restart the scanner after exactly 3 seconds
            setTimeout(() => {
                startScanner();
            }, 3000);
        })
        .catch(error => {
            console.error("Verification Error:", error);
            
            // Show error visual state
            visitorDetailsDiv.innerHTML = `
                <div style="text-align: center; padding: 20px 0;">
                    <svg width="72" height="72" viewBox="0 0 24 24" fill="none" style="margin: 0 auto 12px auto; display: block;">
                        <circle cx="12" cy="12" r="10" fill="#fee2e2" />
                        <line x1="15" y1="9" x2="9" y2="15" stroke="#dc2626" stroke-width="2.5" stroke-linecap="round" />
                        <line x1="9" y1="9" x2="15" y2="15" stroke="#dc2626" stroke-width="2.5" stroke-linecap="round" />
                    </svg>
                    <h3 style="color: #dc2626; font-weight: 700; margin-bottom: 4px;">Scan Error</h3>
                    <p style="color: #64748b; font-size: 14px;">Invalid or unrecognized token. Resetting...</p>
                </div>
            `;

            // Reset loop on error too so the kiosk never locks up permanently
            setTimeout(() => {
                startScanner();
            }, 3000);
        });
    }

    // Append keyframe animation CSS styling rule explicitly for the checkmark line drawing effect
    const styleTag = document.createElement("style");
    styleTag.textContent = `
        @keyframes drawCheck {
            to { stroke-dashoffset: 0; }
        }
    `;
    document.head.appendChild(styleTag);

    // Initial deployment invocation execution kickstart
    startScanner();
});