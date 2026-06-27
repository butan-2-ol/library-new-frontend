document.addEventListener("DOMContentLoaded", function() {
    // 1. Grab references to the dropdown and the dynamic field wrappers
    const visitorTypeSelect = document.getElementById("visitor-type");
    
    const fieldId = document.getElementById("field-user-id");
    const fieldDept = document.getElementById("field-user-dept");
    const fieldStatus = document.getElementById("field-staff-status");
    const fieldGender = document.getElementById("field-user-gender");
    const fieldEmail = document.getElementById("field-user-email");

    // 2. Define the main function to handle visibility logic
    function updateFormVisibility() {
        const selectedValue = visitorTypeSelect.value;

        // Reset: Hide all optional fields by default
        fieldId.style.display = "none";
        fieldDept.style.display = "none";
        fieldStatus.style.display = "none";
        fieldGender.style.display = "none";
        fieldEmail.style.display = "none";

        // Apply conditional logic based on the selection
        if (selectedValue === "student") {
            fieldId.style.display = "block";
            fieldDept.style.display = "block";
            fieldGender.style.display = "block";
            fieldEmail.style.display = "block";
        } 
        else if (selectedValue === "staff") {
            fieldId.style.display = "block";
            fieldDept.style.display = "block";
            fieldStatus.style.display = "block";
            fieldGender.style.display = "block";
            fieldEmail.style.display = "block";
        } 
        else if (selectedValue === "guest") {
            // Only 'name' and 'phone' remain visible
        }
    }

    // 3. Run on page load to hide optional fields initially
    updateFormVisibility();

    // 4. Run every time the visitor type dropdown changes
    visitorTypeSelect.addEventListener("change", updateFormVisibility);

    // ==========================================================================
    // 5. Form Submission & Validation Logic
    // ==========================================================================
    const registrationForm = document.querySelector("form");
    const qrSection = document.getElementById("qr-section");

    registrationForm.addEventListener("submit", function(event) {
        // Prevent the default page reload on form submission
        event.preventDefault();

        const visitorType = visitorTypeSelect.value;
        if (!visitorType) {
            alert("Please select a visitor category first.");
            return;
        }

        // 5a. Extract baseline elements shared by all visitor tracks
        const nameVal = document.getElementById("user-name").value.trim();
        const phoneVal = document.getElementById("user-phone").value.trim();

        // Standard validation: Every single registration needs a name and phone
        if (!nameVal || !phoneVal) {
            alert("Please fill in your Name and Phone number before submitting.");
            return;
        }

        let apiEndpoint = "";
        let payload = {};

        // 5b. Map endpoints and enforce conditional data checks per category
        if (visitorType === "student") {
            const idVal = document.getElementById("user-id").value.trim();
            const deptVal = document.getElementById("user-dept").value.trim();
            const genderVal = document.getElementById("user-gender").value; // select box doesn't need trim
            const emailVal = document.getElementById("user-email").value.trim();

            // Guard rails against empty student metrics
            if (!idVal || !deptVal || !genderVal || !emailVal) {
                alert("Please fill in all required Student fields.");
                return;
            }

            apiEndpoint = "https://library-2-backend.onrender.com/api/students";
            payload = {
                student_name: nameVal,
                student_phone: phoneVal,
                student_id: idVal,
                student_dept: deptVal,
                student_gender: genderVal,
                student_email: emailVal
            };
        } 
        else if (visitorType === "staff") {
            const idVal = document.getElementById("user-id").value.trim();
            const deptVal = document.getElementById("user-dept").value.trim();
            const genderVal = document.getElementById("user-gender").value;
            const emailVal = document.getElementById("user-email").value.trim();
            const statusVal = document.getElementById("staff-status").value;

            // Guard rails against empty staff metrics
            if (!idVal || !deptVal || !genderVal || !emailVal || !statusVal) {
                alert("Please fill in all required Staff fields.");
                return;
            }

            apiEndpoint = "https://library-2-backend.onrender.com/api/staff";
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
            // Already validated name and phone fields above!
            apiEndpoint = "https://library-2-backend.onrender.com/api/guests";
            payload = {
                guest_name: nameVal,
                guest_phone: phoneVal
            };
        }

        // Send the structured data to the backend API via a POST request
        fetch(apiEndpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error("Network response was not ok");
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

            // Optional: Resets form inputs back to blank after a successful registration checkout
            registrationForm.reset();
            updateFormVisibility();
        })
        .catch(error => {
            console.error("Registration Error:", error);
            alert("An error occurred during registration. Please try again.");
        });
    });
});