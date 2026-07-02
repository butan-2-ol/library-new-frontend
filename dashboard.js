document.addEventListener("DOMContentLoaded", function() {
    // Check for authorization token and redirect if missing
    const authToken = localStorage.getItem('authToken');
    if (!authToken) {
        window.location.href = 'login.html';
        return;
    }

    document.getElementById('logout-btn').addEventListener('click', function() {
        localStorage.removeItem('authToken');
        window.location.href = 'login.html';
    });

    // DOM references for metrics display
    const countStudentSpan = document.getElementById("count-student");
    const countStaffSpan = document.getElementById("count-staff");
    const countGuestSpan = document.getElementById("count-guest");
    const metricsFilterSelect = document.getElementById("metrics-filter");

    // DOM references for real-time feed and search elements
    const visitorFeedBody = document.getElementById("visitor-feed-body");
    const noDataRow = document.getElementById("no-data-row");
    const searchTypeSelect = document.getElementById("search-type");
    const searchInput = document.getElementById("search-input");
    const searchButton = document.getElementById("search-button");
    const searchResultsBody = document.getElementById("search-results-body");
    
    // DOM reference for Export CSV button
    const exportBtn = document.getElementById('export-btn');

    // Fetch metric counts on initial dashboard load
    fetchSummaryMetrics();

    // Re-fetch metrics whenever the time period dropdown changes
    if (metricsFilterSelect) {
        metricsFilterSelect.addEventListener("change", fetchSummaryMetrics);
    }

    // Establish real-time connection with backend server
    const socket = io("https://library-2-backend.onrender.com");

    // Handle real-time notification of a new visit log
    socket.on("new-visit", function(visitData) {
        if (noDataRow) {
            noDataRow.remove();
        }

        const type = visitData.visitor_type || "guest"; 
        const name = visitData.visitor_name || "Unknown";
        const details = visitData.registration_id || "N/A";
        const timestamp = new Date().toLocaleTimeString();

        // Increment counts instantly for today/all_time, or trigger database sync for complex ranges
        if (metricsFilterSelect && (metricsFilterSelect.value === "today" || metricsFilterSelect.value === "all_time")) {
            incrementLocalCount(type);
        } else {
            fetchSummaryMetrics();
        }

        // Prepend the new live record row to the real-time activity stream
        const newRow = document.createElement("tr");
        newRow.innerHTML = `
            <td><strong>${timestamp}</strong></td>
            <td>${name}</td>
            <td><span class="badge-${type}">${type.toUpperCase()}</span></td>
            <td>${details}</td>
        `;
        
        visitorFeedBody.insertBefore(newRow, visitorFeedBody.firstChild);
    });
  
    // Handle database historical record query lookup
    if (searchButton) {
        searchButton.addEventListener("click", function() {
            const type = searchTypeSelect.value; 
            const query = searchInput.value.trim();

            if (!type) {
                alert("Please select a category type to search.");
                return;
            }
            if (!query) {
                alert("Please enter a name, phone, or ID to look up records.");
                return;
            }

            searchResultsBody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; color: #64748b;">
                        Searching database entries...
                    </td>
                </tr>
            `;

            const endpoint = `https://library-2-backend.onrender.com/api/${type}/search?q=${encodeURIComponent(query)}`;

            // Execute authenticated GET request to query database entries
            fetch(endpoint, {
                method: "GET",
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                }
            })
            .then(response => {
                if (!response.ok) throw new Error("Database search failed.");
                return response.json();
            })
            .then(data => {
                const records = data.data || data;
                searchResultsBody.innerHTML = "";

                if (!records || records.length === 0) {
                    searchResultsBody.innerHTML = `
                        <tr>
                            <td colspan="6" style="text-align: center; color: #ef4444;">No matching records found.</td>
                        </tr>
                    `;
                    return;
                }

                // Map database results dynamically into result table row elements
                records.forEach(row => {
                    const regId = row.registration_id || "N/A";
                    const name = row.student_name || row.staff_name || row.guest_name || "N/A";
                    const phone = row.student_phone || row.staff_phone || row.guest_phone || "N/A";
                    const userId = row.student_id || row.staff_id || "N/A";

                    let visitorDisplayType = "";
                    let badgeClass = "";

                    if (type === "students") {
                        visitorDisplayType = "Student";
                        badgeClass = "student";
                    } else if (type === "staff") {
                        visitorDisplayType = "Staff";
                        badgeClass = "staff";
                    } else if (type === "guests") {
                        visitorDisplayType = "Guest";
                        badgeClass = "guest";
                    }

                    const tr = document.createElement("tr");
                    tr.innerHTML = `
                        <td><strong>${regId}</strong></td>
                        <td>${name}</td>
                        <td>${phone}</td>
                        <td><span class="badge-${badgeClass}">${visitorDisplayType}</span></td>
                        <td><code>${userId}</code></td>
                        <td><button class="log-visit-btn" data-id="${regId}">Log Visit</button></td>
                    `;
                    
                    searchResultsBody.appendChild(tr);
                });

                // Attach click handlers to trigger visit logging confirmations
                document.querySelectorAll('.log-visit-btn').forEach(btn => {
                    btn.addEventListener('click', function() {
                        const registrationId = this.dataset.id;
                        const row = this.closest('tr');
                        const visitorName = row.cells[1].textContent;

                        const proceed = confirm(`Log check-in visit for ${visitorName}?`);
                        if (!proceed) return;

                        // Post visit entry payload with JWT authorization context header
                        fetch('https://library-2-backend.onrender.com/api/visits', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${authToken}`
                            },
                            body: JSON.stringify({ registration_id: registrationId })
                        })
                        .then(res => {
                            if (!res.ok) throw new Error("Log network response failed.");
                            return res.json();
                        })
                        .then(data => {
                            alert(`Visit logged successfully for ${data.data.visitor_name}`);
                        })
                        .catch(err => {
                            console.error(err);
                            alert('Failed to log visit record.');
                        });
                    });
                });
            })
            .catch(error => {
                console.error("Search Query Error:", error);
                searchResultsBody.innerHTML = `
                    <tr>
                        <td colspan="6" style="text-align: center; color: #ef4444; font-weight: 500;">
                            An error occurred while fetching records. Please verify server state.
                    </td>
                    </tr>
                `;
            });
        });
    }

    // Trigger search submission if user clicks the Enter key inside the text field
    if (searchInput) {
        searchInput.addEventListener("keypress", function(e) {
            if (e.key === "Enter") {
                searchButton.click();
            }
        });
    }
  
    // Retrieve aggregated tracking analytics metrics for selected time filter
    function fetchSummaryMetrics() {
        const selectedFilter = metricsFilterSelect ? metricsFilterSelect.value : 'today';

        fetch(`https://library-2-backend.onrender.com/api/visits/summary?filter=${selectedFilter}`, {
            method: "GET",
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            }
        })
        .then(response => {
            if (!response.ok) throw new Error("Failed to pull summary stats.");
            return response.json();
        })
        .then(data => {
            const summary = data.data || data;

            if (countStudentSpan) countStudentSpan.textContent = "0";
            if (countStaffSpan) countStaffSpan.textContent = "0";
            if (countGuestSpan) countGuestSpan.textContent = "0";

            // Loop through aggregated categories and distribute stats to correct display slots
            summary.forEach(item => {
                if (item.visitor_type === 'student' && countStudentSpan) countStudentSpan.textContent = item.total_visits;
                if (item.visitor_type === 'staff' && countStaffSpan) countStaffSpan.textContent = item.total_visits;
                if (item.visitor_type === 'guest' && countGuestSpan) countGuestSpan.textContent = item.total_visits;
            });
        })
        .catch(error => {
            console.error("Metrics Pull Error:", error);
        });
    }

    // Increment numeric count views locally to mirror socket updates
    function incrementLocalCount(type) {
        if (type === "student" && countStudentSpan) {
            countStudentSpan.textContent = parseInt(countStudentSpan.textContent || "0") + 1;
        } else if (type === "staff" && countStaffSpan) {
            countStaffSpan.textContent = parseInt(countStaffSpan.textContent || "0") + 1;
        } else if (type === "guest" && countGuestSpan) {
            countGuestSpan.textContent = parseInt(countGuestSpan.textContent || "0") + 1;
        }
    }

    // --- FRONTEND MULTI-API EXPORT LOGIC ---
    if (exportBtn) {
        exportBtn.addEventListener('click', async () => {
            // Visual feedback: disable button while fetching
            exportBtn.disabled = true;
            exportBtn.innerText = "Exporting...";

            // Match current dashboard selection dropdown filter
            const selectedFilter = metricsFilterSelect ? metricsFilterSelect.value : 'today';

            try {
                // Headers using exact 'authToken' key
                const headers = {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                };

                // Fetch student lists, staff lists, guest lists, and summary metrics in parallel
                const [studentsRes, staffRes, guestsRes, summaryRes] = await Promise.all([
                    fetch('https://library-2-backend.onrender.com/api/students', { headers }),
                    fetch('https://library-2-backend.onrender.com/api/staff', { headers }),
                    fetch('https://library-2-backend.onrender.com/api/guests', { headers }),
                    fetch(`https://library-2-backend.onrender.com/api/visits/summary?filter=${selectedFilter}`, { headers })
                ]);

                if (!studentsRes.ok || !staffRes.ok || !guestsRes.ok || !summaryRes.ok) {
                    throw new Error("One or more backend endpoints failed to respond.");
                }

                // Parse responses to JSON
                const studentsData = await studentsRes.json();
                const staffData = await staffRes.json();
                const guestsData = await guestsRes.json();
                const summaryData = await summaryRes.json();

                // Extracted using  exact database model endpoints structural keys
                const students = studentsData.students || [];
                const staff = staffData.allStaff || [];
                const guests = guestsData.allGuests || [];
                const summary = summaryData.data || summaryData;

                let csvContent = "";

                // Helper utility to safely escape characters for a valid CSV format
                const escapeCSV = (val) => {
                    if (val === null || val === undefined) return "";
                    let stringVal = String(val);
                    if (stringVal.includes(',') || stringVal.includes('"') || stringVal.includes('\n')) {
                        return `"${stringVal.replace(/"/g, '""')}"`;
                    }
                    return stringVal;
                };

                // SECTION 1: Summary Counts
                csvContent += ` VISIT SUMMARY COUNTS (Filter: ${selectedFilter.toUpperCase()}) \n`;
                csvContent += "Visitor Type,Total Visits\n";
                if (Array.isArray(summary)) {
                    summary.forEach(item => {
                        csvContent += `${escapeCSV(item.visitor_type)},${escapeCSV(item.total_visits)}\n`;
                    });
                }
                csvContent += "\n\n";

                // SECTION 2: Students Data Table
                csvContent += "STUDENT REGISTRANTS\n";
                if (Array.isArray(students) && students.length > 0) {
                    const headersList = Object.keys(students[0]);
                    csvContent += headersList.map(escapeCSV).join(",") + "\n";
                    students.forEach(row => {
                        csvContent += headersList.map(h => escapeCSV(row[h])).join(",") + "\n";
                    });
                } else {
                    csvContent += "No student data records found.\n";
                }
                csvContent += "\n\n";

                // SECTION 3: Staff Data Table
                csvContent += "STAFF REGISTRANTS\n";
                if (Array.isArray(staff) && staff.length > 0) {
                    const headersList = Object.keys(staff[0]);
                    csvContent += headersList.map(escapeCSV).join(",") + "\n";
                    staff.forEach(row => {
                        csvContent += headersList.map(h => escapeCSV(row[h])).join(",") + "\n";
                    });
                } else {
                    csvContent += "No staff data records found.\n";
                }
                csvContent += "\n\n";

                // SECTION 4: Guests Data Table
                csvContent += "=== GUEST REGISTRANTS ===\n";
                if (Array.isArray(guests) && guests.length > 0) {
                    const headersList = Object.keys(guests[0]);
                    csvContent += headersList.map(escapeCSV).join(",") + "\n";
                    guests.forEach(row => {
                        csvContent += headersList.map(h => escapeCSV(row[h])).join(",") + "\n";
                    });
                } else {
                    csvContent += "No guest data records found.\n";
                }

                // Compile into blob payload and trigger the window download action
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                
                const dateStamp = new Date().toISOString().slice(0, 10);
                link.setAttribute("href", url);
                link.setAttribute("download", `library_dashboard_export_${dateStamp}.csv`);
                link.style.visibility = 'hidden';
                
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

            } catch (error) {
                console.error("Export System Error:", error);
                alert(`Failed to export dashboard data: ${error.message}`);
            } finally {
                // Restore button text and enable state
                exportBtn.disabled = false;
                exportBtn.innerText = "Export CSV";
            }
        });
    }
});