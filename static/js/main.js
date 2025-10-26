const chartInstances={};
function myFunction() {
  var x = document.getElementById("navDemo");
  if (x.className.indexOf("w3-show") == -1) {
    x.className += " w3-show";
  } else {
    x.className = x.className.replace("w3-show", "");
  }
}

//----------Teacher Dashboard----//
function showUploadData()
{
document.getElementById('teacher-content').innerHTML=`
<h4><strong>Upload Data</strong></h4>
<div class="p-3 mb-4 border rounded-3" style="background-color: #1f3d43ff;color:white;">
<label>Class ID:</label>
<input type="text" id="classIdUpload" class="form-select rounded-3 w-50"><br><br>
<label for="sem">Semester:</label>
<select id="sem" name="sem" required class="form-select rounded-3 w-50">
            <option value="" disabled selected>Select a semester</option>
            <option value="sem1">Semester 1</option>
            <option value="sem2">Semester 2</option>
            <option value="sem3">Semester 3</option>
            <option value="sem4">Semester 4</option>
        </select><br><br>
<label for="model">Type of exam:</label>
<select id="model" name="model" required class="form-select rounded-3 w-50">
            <option value="" disabled selected>Select a model</option>
            <option value="model1">Model 1</option>
            <option value="model2">Model 2</option>
        </select><br><br>
<label>Upload CSV:</label>
<input type="file" id="csvFile" accept=".csv" class="form-select rounded-3 w-50"><br><br>
<button  class="rounded-3 btn-lg" type="button" onclick="uploadData()">Upload</button>
</form>
</div>
`;

document.getElementById('result').innerHTML = '';
}

function showClassPerformance()
{
   document.getElementById('teacher-content').innerHTML = `
<h4><strong>Class Performance</strong></h4>
<div class="p-3 mb-4 border rounded-3" style="background-color: #1f3d43ff;color:white;">
<form id="classForm">
<label>Class ID:</label>
<input class="form-select rounded-3 w-50" type="text" id="classIdPerformance"><br><br>
<button type="button" class="rounded-3 btn-lg" onclick="submitClassPerformance()">Submit</button>
</form>
</div>
<button type='button' id='printButton' onclick='printResults()' style="display:none; margin-top: 15px;">Print to pdf</button>
<div id="result" style="margin-top: 20px;">
     <p class="w3-text-gray">Enter a Class ID and click Submit to view the report.</p>
</div>
    `;
}

function showStudentPerformanceLookup() {
    document.getElementById('teacher-content').innerHTML = `
<h4>Student Performance Lookup</h4>
<div class="p-3 mb-4 border rounded-3" style="background-color: #1f3d43ff;color:white;">
<form id="studentLookupForm">
<label>Student Register Number:</label>
<input class="form-select rounded-3 w-50" type="text" id="regNoLookup" required><br><br>
<button type="button"class="rounded-3 btn-lg" onclick="submitStudentPerformance()">View Report</button>
</form>
</div>
<div id="result" style="margin-top: 20px;">
    <p class="w3-text-gray">Enter a Register Number and click View Report.</p>
</div>
    `;
}

function submitStudentPerformance() {
    const regNo = document.getElementById('regNoLookup').value;
    const resultDiv = document.getElementById('result');

    if (!regNo) {
        resultDiv.innerHTML = '<p class="w3-text-red">Please enter the Student Register Number.</p>';
        return;
    }
    
    // Clear previous results and show loading message
    resultDiv.innerHTML = `<p>Loading student performance for ${regNo}...</p>`;

    // Call the API endpoint: /api/student_performance/<register_no>
    fetch(`/api/student_performance/${regNo}`)
    .then(response => {
        if (response.status === 404) {
             return response.json().then(err => {
                 throw new Error(err.message || 'Performance data not found for this Register Number.');
             });
        }
        if (!response.ok) {
             return response.json().then(err => {
                 throw new Error(err.message || response.statusText);
             });
        }
        return response.json();
    })
    .then(data => {
        // Data is an array containing one student object
        if (data && data.length > 0) {
            // Use the existing student rendering function
            renderStudentResult(resultDiv, data[0]);
        } else {
            resultDiv.innerHTML = `<p class="w3-text-red">No performance data found for Register No: ${regNo}.</p>`;
        }
    })
    .catch(error => {
        resultDiv.innerHTML = `<p class="w3-text-red">Error fetching data: ${error.message}.</p>`;
        console.error('Fetch error:', error);
    });
}

//----------Student Dashboard----------//
function showPerformance()
{
    // 1. Update the content to show loading state immediately
    const contentDiv = document.getElementById('student-content');
    contentDiv.innerHTML = `
        <h2>My Performance Report</h2>
        <div id="student-result" style="margin-top: 20px;">
            <p class="w3-text-blue">Loading your performance report...</p>
        </div>
    `;
    
    fetchStudentPerformance();
}

/**
 * New function to fetch performance data for the logged-in student.
 * It does NOT take the register number as input.
 */
function fetchStudentPerformance() {
    const resultDiv = document.getElementById('student-result');
    
    // Call the API endpoint which will use the session to identify the user
    // We are now calling a simple URL '/api/my_performance'
    fetch(`/api/my_performance`)
    .then(response => {
        if (response.status === 404) {
             // Handle case where student data is not found
            return response.json().then(err => {
                throw new Error(err.message || 'Performance data not found for your account.');
            });
        }
        if (!response.ok) {
            // Handle other server errors (e.g., unauthorized)
            return response.json().then(err => {
                throw new Error(err.message || response.statusText);
            });
        }
        return response.json();
    })
    .then(data => {
        // Data is an array containing one student object
        if (data && data.length > 0) {
            // Use the existing rendering function
            renderStudentResult(resultDiv, data[0]);
        } else {
            resultDiv.innerHTML = `<p class="w3-text-red">No performance data found for your account.</p>`;
        }
    })
    .catch(error => {
        resultDiv.innerHTML = `<p class="w3-text-red">Error fetching data: ${error.message}.</p>`;
        console.error('Fetch error:', error);
    });
}
/**
 * Renders the detailed performance report for a single student.
 *
 */
function renderStudentResult(resultDiv, studentData) {
    const overallDisplayResult = getDisplayPerformance(studentData.Overall_Result);
    const overallColorClass = getColorClass(overallDisplayResult);

    let html = `
        <div class="w3-card-4 w3-margin-top">
            <header class="w3-container w3-blue-grey">
                <h4 class="w3-padding-small">Performance Report: ${studentData.student_name}</h4>
            </header>
            
            <div class="w3-container w3-padding">
                <p><strong>Register No:</strong> ${studentData.register_No}</p>
                <p><strong>Class ID/Semester:</strong> ${studentData.class_id}/${studentData.semester}</p>
                <p><strong>Overall ML Prediction:</strong> 
                    <span class="w3-tag w3-large w3-round ${overallColorClass}">${overallDisplayResult}</span>
                </p>
                <hr>

                <div class="w3-row-padding w3-margin-bottom">

                    <div class="w3-half">
                        <h5 style="margin-top: 16px;">Subject Mark Performance</h5>
                        <div style="margin-bottom: 30px;">
                            <canvas id="markChart"></canvas>
                        </div>
                    </div>
                    
                    <div class="w3-half">
                        <h5 style="margin-top: 16px;">Subject Attendance Level</h5>
                        <div style="margin-bottom: 30px;">
                            <canvas id="attendanceChart"></canvas>
                        </div>
                    </div>

                </div>
                <hr>

                <h5>Subject-Wise Breakdown</h5>
                <table class="w3-table-all w3-hoverable w3-small">
                    <thead>
                        <tr class="w3-light-grey">
                            <th>Subject</th>
                            <th>Series Mark</th>
                            <th>Attendance (%)</th>
                            <th>ML Subject Level</th>
                            <th>ML Attendance Level</th>
                        </tr>
                    </thead>
                    <tbody>
    `;

    // Subject Breakdown Table
    (studentData.subject_details || []).forEach(subject => {
        const subjectLevel = getDisplayPerformance(subject.Sub_Mark_Level); 
        const subjectColor = getColorClass(subjectLevel);
        const attendanceLevel = getDisplayPerformance(subject.Sub_Attn_Level);
        const attendanceColor = getColorClass(attendanceLevel);
        const seriesMark = parseFloat(subject.subject_mark).toFixed(2); 
        
        html += `
            <tr>
                <td>${subject.subject}</td>
                <td>${seriesMark}</td>
                <td>${subject.attendance}</td>
                <td><span class="w3-tag w3-round ${subjectColor}">${subjectLevel}</span></td>
                <td><span class="w3-tag w3-round ${attendanceColor}">${attendanceLevel}</span></td>
            </tr>
        `;
    });

    html += `
                    </tbody>
                </table>
                <hr>
                
                <div id="student-recommendations">
                    </div>
            </div>
        </div>
    `;

    resultDiv.innerHTML = html;
    
    // Call the function to display personalized recommendations
    renderStudentRecommendations(document.getElementById('student-recommendations'), studentData);
    
    // Charts are now called AFTER the canvas elements are in the DOM
    createCharts(studentData);
}
/**
 * Renders personalized recommendations based on the student's prediction levels.
 */
function renderStudentRecommendations(recommendationDiv, studentData) {
    const poorSubjects = [];
    const needImprovementSubjects = [];
    const overallResult = getDisplayPerformance(studentData.Overall_Result);


    // --- FIX 2: Changed .subjects to .subject_details and added || [] safety check ---
    (studentData.subject_details || []).forEach(subject => {
        const subjectLevel = getDisplayPerformance(subject.Sub_Mark_Level);
        if (subjectLevel === 'Poor') {
            poorSubjects.push(subject.subject);
        } else if (subjectLevel === 'Need Improvement') {
            needImprovementSubjects.push(subject.subject);
        }
    });

    let recHTML = '<h5>Recommendations:</h5>';
    let hasRecs = false;

    if (poorSubjects.length > 0) {
        hasRecs = true;
        recHTML += `
            <div class="w3-panel w3-border w3-red w3-round-large w3-padding-16">
                <h6>🚨 Urgent Focus Required in: ${poorSubjects.join(', ')}</h6>
                <p>These subjects are predicted to be at risk. You must increase study time, review challenging topics, and consult your faculty immediately.</p>
            </div>
        `;
    }

    if (needImprovementSubjects.length > 0) {
        hasRecs = true;
        recHTML += `
            <div class="w3-panel w3-border w3-yellow w3-round-large w3-padding-16">
                <h6>🟡 Focus Areas: ${needImprovementSubjects.join(', ')}</h6>
                <p>You are on track but performance can be significantly boosted. Regular revision and practicing extra problem sets are key to achieving an Excellent level.</p>
            </div>
        `;
    }
    
    if (overallResult === 'Excellent' && !hasRecs) {
        recHTML += `
            <div class="w3-panel w3-border w3-green w3-round-large w3-padding-16">
                <h6>✅ Congratulations!</h6>
                <p>Your overall performance is predicted to be **Excellent**. Keep up the great work and maintain consistency in all your subjects.</p>
            </div>
        `;
    } else if (!hasRecs) {
        // Fallback for an overall good/unknown student with no specific subject issues
        recHTML += `<p>Review your results above. Continue to track your progress and work hard!</p>`;
    }


    recommendationDiv.innerHTML = recHTML;
}

function uploadData(){
    const classId=document.getElementById("classIdUpload").value;
    const semester=document.getElementById("sem").value;
    const model=document.getElementById("model").value;
    const fileInput=document.getElementById("csvFile");
    const file=fileInput.files[0];

    if(!classId || !semester || !model || !file){
        alert("Please fill all form fields and select a csv file");
        return;
    }
    
    // Show loading indicator in the result div
    

    const formData=new FormData();
    formData.append("class_id", classId);
    formData.append("semester",semester);
    formData.append("model",model);
    formData.append("csv_file",file);

    fetch("/upload_data", {
        method: "POST",
        body:formData
    })
    .then(response =>{
    if (!response.ok) {
        // Attempt to read error message from the JSON body
        return response.json().catch(() => {
            // If response is not JSON, throw a generic error with status text
            throw new Error(`Upload failed with status: ${response.status} ${response.statusText}`);
        }).then(err => {
            // Use the message field from the server's JSON error response
            throw new Error(err.message || 'Server returned an error.');
        });
    }
    return response.json();
})
    .then(data => {
        alert(data.message || "Upload complete");
    })
    .catch(error => {
        resultDiv.innerHTML = `<p class="w3-text-red w3-large">❌ Error: ${error.message}</p>`;
    console.error('Upload Error:', error);
    });
}

function showAllPredictions() {
    // Clear the main content area and add a loading message
    const contentDiv = document.getElementById('teacher-content');
    contentDiv.innerHTML = `<h4>All Student Predictions</h4><p>Loading data...</p>`;
   
    // Fetch and render the data
    fetchAndRenderPredictions();
}

function fetchAndRenderPredictions() {
    const resultDiv = document.getElementById('result');
    
    fetch('/api/predictions')
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.json();
    })
    .then(data => {
        if (data.length === 0) {
            resultDiv.innerHTML = `<h4>All Student Predictions</h4><p>No prediction data available.</p>`;
            return;
        }

        let tableHTML = `
            <h4>All Student Predictions (Grouped View)</h4>
            <table class="table table-striped prediction-table w3-table-all w3-hoverable">
                <thead>
                    <tr class="w3-light-grey">
                        <th>REGISTER NO</th>
                        <th>STUDENT NAME</th>
                        <th>CLASS/SEM</th>
                        <th>OVERALL RESULT</th>
                        <th>SUBJECT</th>
                        <th>SERIES MARK</th>
                        <th>ATTENDANCE (%)</th>
                        <th>SUBJECT LEVEL (ML)</th>
                        <th>ATTENDANCE LEVEL (ML)</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        data.forEach(student => {
            // --- FIX 3A: Changed .subjects.length to .subject_details.length and added || [] safety check ---
            const rowSpan = (student.subject_details || []).length;
           
            // Calculate the display result for the overall performance
            const overallDisplayResult = getDisplayPerformance(student.Overall_Result);
            
            // Loop through each subject for the current student
            // --- FIX 3B: Changed .subjects.forEach to .subject_details.forEach and added || [] safety check ---
            (student.subject_details || []).forEach((subject, index) => {
                tableHTML += '<tr>';

                // Only print student details on the first row (index 0)
                if (index === 0) {
                    tableHTML += `<td rowspan="${rowSpan}">${student.register_No}</td>`;
                    tableHTML += `<td rowspan="${rowSpan}">${student.student_name}</td>`;
                    tableHTML += `<td rowspan="${rowSpan}">${student.class_id}/${student.semester}</td>`;
                    // USE getDisplayPerformance() HERE FOR CONSISTENCY
                    tableHTML += `<td rowspan="${rowSpan}"><span class="w3-tag w3-round ${getColorClass(overallDisplayResult)}">${overallDisplayResult}</span></td>`;
                }
               
                // Calculate display results for subject levels
                const subjectDisplayResult = getDisplayPerformance(subject.Sub_Mark_Level); // Note: Corrected to Sub_Mark_Level
                const attendanceDisplayResult = getDisplayPerformance(subject.Sub_Attn_Level); // Note: Corrected to Sub_Attn_Level

                // Add subject-specific columns for every row
                tableHTML += `<td>${subject.subject}</td>`; // Note: Corrected to subject.subject
                tableHTML += `<td>${parseFloat(subject.subject_mark).toFixed(2)}</td>`; // Note: Corrected to subject.subject_mark
                tableHTML += `<td>${subject.attendance}</td>`; // Note: Corrected to subject.attendance
                // USE getDisplayPerformance() HERE FOR CONSISTENCY
                tableHTML += `<td><span class="w3-tag w3-round ${getColorClass(subjectDisplayResult)}">${subjectDisplayResult}</span></td>`;
                // USE getDisplayPerformance() HERE FOR CONSISTENCY
                tableHTML += `<td><span class="w3-tag w3-round ${getColorClass(attendanceDisplayResult)}">${attendanceDisplayResult}</span></td>`;

                tableHTML += '</tr>';
            });
        });

        tableHTML += `
                </tbody>
            </table>
        `;
       
        contentDiv.innerHTML = tableHTML;
    })
    .catch(error => {
        resultDiv.innerHTML = `<p class="w3-text-red">❌ Error fetching data: ${error.message}.</p>`;
        console.error('Fetch error:', error);
    });
}

// Helper function to assign a color class based on the prediction level
function getColorClass(level) {
    if (!level) return 'w3-grey';
    const lowerLevel = level.toLowerCase();
    if (lowerLevel.includes('good') || lowerLevel.includes('pass') || lowerLevel.includes('excellent')) {
        return 'w3-green';
    } else if (lowerLevel.includes('average') || lowerLevel.includes('satisfactory') || lowerLevel.includes('improvement')) {
        return 'w3-yellow';
    } else if (lowerLevel.includes('poor') || lowerLevel.includes('fail') || lowerLevel.includes('unknown')) { // Included 'unknown' for the fallback
        return 'w3-red';
    }
    return 'w3-light-blue'; // Default for other categories
}

/**
 * Maps the ML model's numeric output (0, 1, 2) to descriptive text.
 * @param {string|number} level The raw prediction level from the database.
 * @returns {string} The display phrase for the level.
 */

// *** UPDATED FOR ROBUSTNESS (kept from last revision) ***
function getDisplayPerformance(level) {
    // Check if the level is null, undefined, not a string, or just whitespace
    if (!level || typeof level !== 'string' || level.trim() === '') return 'N/A';
    
    // Trim whitespace and convert to lowercase for comparison
    const lowerLevel = level.toLowerCase().trim();
    
    // Map the expected database prediction levels to the desired display phrases
    if (lowerLevel == 2) {
        return 'Excellent';
    } else if (lowerLevel== 1) {
        return 'Need Improvement';
    } else if (lowerLevel == 0) {
        return 'Poor';
    }
    
    // Fallback for any unexpected non-empty string value
    return "Unknown level"; 
}


function submitClassPerformance() {
    const classId = document.getElementById('classIdPerformance').value;
    const resultDiv = document.getElementById('result');
    document.getElementById('printButton').style.display = 'none';

    if (!classId) {
        resultDiv.innerHTML = '<p class="w3-text-red">Please enter a Class ID.</p>';
        return;
    }

    resultDiv.innerHTML = `<p class="w3-text-blue">Loading class performance for ${classId}...</p>`;

    fetch(`/api/class_performance/${classId}`)
    .then(response => {
        if (!response.ok) {
            return response.json().then(err => {
                throw new Error(err.message || response.statusText);
            });
        }
        return response.json();
    })
    .then(data => {
        if (data.length === 0) {
            resultDiv.innerHTML = `<p class="w3-text-red">No prediction data available for Class ID: ${classId}.</p>`;
            return;
        }

        // --- NEW RENDERING LOGIC ---
        const reportTitle = `<h4 class="w3-border-bottom w3-border-light-grey w3-padding-16">Class Performance Report: ${classId}</h4>`;
        resultDiv.innerHTML = reportTitle;

        // 1. Overall Student Performance
        renderClassSummary(resultDiv, data);

        // 2. Subject-Wise Performance Charts (Separated)
        // --- FIX 4: Changed .subjects to .subject_details and added || [] safety check ---
        const subjectNames = data.length > 0 
            ? Array.from(new Set((data[0].subject_details || []).map(s => s.subject))) 
            : [];
        
        if (subjectNames.length > 0) {
            resultDiv.insertAdjacentHTML('beforeend', '<h5 class="w3-margin-top w3-border-bottom w3-padding-small">Subject-Wise Performance</h5>');
            
            // Create a container for the individual charts, showing two charts per row (w3-half)
            let chartsHTML = '<div id="individualChartsContainer" class="row mt-4">'; 
subjectNames.forEach((subjectName) => {
    chartsHTML += `
        <div class="col-lg-3 col-sm-6 mb-4"> 
            <div class="card shadow-sm h-100 p-2 text-center"> 
                <h6 class="card-title">${subjectName} Performance Levels</h6>
                
                <div> 
                    <canvas id="chart_${subjectName}"></canvas>
                </div>
            </div>
        </div>`;
});
chartsHTML += '</div>';
resultDiv.insertAdjacentHTML('beforeend', chartsHTML);
            
            // Initialize charts individually
            subjectNames.forEach(subjectName => {
                initializeIndividualChart(data, subjectName); 
            });
        }

        // 3. Attention List
        renderAttentionList(resultDiv, data);
       
        document.getElementById('printButton').style.display = 'block'; // Show the print button
    })
    .catch(error => {
       resultDiv.innerHTML = `<p class="w3-text-red">❌ Error: ${error.message}</p>`;
       console.error('Fetch error:', error);
    });
}

/**
 * Renders summary table showing each student's overall performance, using display phrases.
 */
function renderClassSummary(resultDiv, data) {
    let tableHTML = `
<h5>Overall Student Performance</h5>
<table class="table table-striped w3-table-all w3-hoverable" style="margin-top: 0 !important;">
<thead>
<tr class="w3-light-grey">
<th>REGISTER NO</th>
<th>STUDENT NAME</th>
<th>OVERALL RESULT (ML)</th>
</tr>
</thead>
<tbody>
    `;

    data.forEach(student => {
       
        const displayResult = getDisplayPerformance(student.Overall_Result); 
        const colorClass = getColorClass(displayResult);

        tableHTML += `
            <tr>
                <td>${student.register_No}</td>
                <td>${student.student_name}</td>
                <td><span class="w3-tag w3-round ${colorClass}">${displayResult}</span></td>
            </tr>
        `;
    });

    tableHTML += `
            </tbody>
        </table>
    `;

    resultDiv.insertAdjacentHTML('beforeend', tableHTML);
}


/**
 * Renders a list of students categorized as "Poor" in more than 2 subject marks.
 * Logic updated per user request: Only checks subject marks (excluding attendance/overall result)
 * and requires poor performance in MORE THAN TWO subjects (i.e., 3 or 4).
 */
function renderAttentionList(resultDiv, data) {
    const attentionStudents = [];
    
    data.forEach(student => {
        const issues = [];
        let poorSubjectCount = 0;

        // 1. Check Subject-wise Mark Performance (Mark Level only)
        // --- FIX 5: Changed .subjects.forEach to .subject_details.forEach and added || [] safety check ---
        (student.subject_details || []).forEach(subject => {
            const subjectLevel = getDisplayPerformance(subject.Sub_Mark_Level);

            if (subjectLevel === 'Poor') {
                poorSubjectCount++;
                // 🎯 UPDATED: Show the series mark instead of the level text ('Poor')
                const mark = parseFloat(subject.subject_mark).toFixed(2);
                issues.push(`Subject Mark in ${subject.subject}: ${mark}`);
            }
        });

        // 2. Add student to the Attention List only if poorSubjectCount is > 2 (i.e., 3 or 4 subjects)
        if (poorSubjectCount > 2) { 
            attentionStudents.push({
                name: student.student_name,
                regNo: student.register_No,
                issues: issues
            });
        }
    });

    let attentionHTML = '<h5 class="w3-margin-top w3-border-bottom w3-padding-small w3-text-red">Students Requiring Attention (Poor in >2 Subjects)</h5>';

    if (attentionStudents.length === 0) {
        attentionHTML += '<p class="w3-text-green">No students met the criteria (Poor in more than 2 subjects).</p>';
    } else {
        attentionHTML += '<ul class="w3-ul w3-card-4">';
        attentionStudents.forEach(student => {
            attentionHTML += `<li class="w3-hover-red">
                <b>${student.name} (${student.regNo})</b>: Needs urgent academic attention in:
                <ul>`;
            student.issues.forEach(issue => {
                attentionHTML += `<li>${issue}</li>`;
            });
            attentionHTML += '</ul></li>';
        });
        attentionHTML += '</ul>';
    }
    
    resultDiv.insertAdjacentHTML('beforeend', attentionHTML);
}


/**
 * Initializes and displays the Chart.js bar chart for subject performance levels.
 */
function initializeIndividualChart(data, targetSubject) {
    // 1. Aggregate Data for the targetSubject
    const levelCounts = { 'Excellent': 0, 'Need Improvement': 0, 'Poor': 0, 'N/A': 0, 'Unknown level': 0 };

    data.forEach(student => {
        // --- FIX 6: Changed .subjects.find to .subject_details.find and added || [] safety check ---
        // Find the subject data for the current student
        const subjectData = (student.subject_details || []).find(s => s.subject === targetSubject);
        if (subjectData) {
            // Use getDisplayPerformance to normalize the level (0, 1, 2) into a string ('Poor', 'Need Improvement', 'Excellent')
            const level = getDisplayPerformance(subjectData.Sub_Mark_Level); 
            
            // Increment the count for the specific level
            if (levelCounts.hasOwnProperty(level)) {
                levelCounts[level]++;
            } else {
                levelCounts['Unknown level']++; // Fallback for unexpected results
            }
        }
    });

    // Combine 'Poor' and 'Unknown level' counts for display simplicity
    levelCounts['Poor'] += levelCounts['Unknown level'] + levelCounts['N/A'];
    
    // 2. Prepare Chart Data Structure (only for the main levels)
    const labels = ['Excellent', 'Need Improvement', 'Poor']; 
    const chartData = [
        levelCounts['Excellent'], 
        levelCounts['Need Improvement'], 
        levelCounts['Poor']
    ];
    
    const colors = [
        getColorCode('Excellent'), 
        getColorCode('Need Improvement'), 
        getColorCode('Poor')
    ];

    // Filter out levels with 0 students to keep the chart clean
    const filteredLabels = [];
    const filteredData = [];
    const filteredColors = [];
    
    labels.forEach((label, index) => {
        if (chartData[index] > 0) {
            filteredLabels.push(label);
            filteredData.push(chartData[index]);
            filteredColors.push(colors[index]);
        }
    });
    
    // Check if there's any data to display
    const ctx = document.getElementById(`chart_${targetSubject}`);
    if (filteredData.length === 0 || !ctx) {
        if (ctx && ctx.parentNode) {
            ctx.parentNode.innerHTML = `<p class="w3-text-red">No valid prediction data available for ${targetSubject}.</p>`;
        }
        return;
    }
    
    // Destroy previous chart instance if it exists to prevent double-rendering errors
    if (window.chartInstances && window.chartInstances[`chart_${targetSubject}`]) {
        window.chartInstances[`chart_${targetSubject}`].destroy();
    }
    
    // Store new chart instance
    if (!window.chartInstances) window.chartInstances = {};

    window.chartInstances[`chart_${targetSubject}`] = new Chart(ctx.getContext('2d'), {
        type: 'pie',
        data: {
            labels: filteredLabels,
            datasets: [{
                data: filteredData,
                backgroundColor: filteredColors,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'bottom' },
                title: { 
                    display: false, // Title is handled by the h6 above the canvas
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed !== null) {
                                label += context.parsed;
                                // Calculate percentage
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = Math.round((context.parsed / total) * 100);
                                label += ` (${percentage}%)`;
                            }
                            return label;
                        }
                    }
                }
            }
        }
    });
}

// Function to print the results div content
function printResults() {
    // Get the content of the result div
    const content = document.getElementById('result').innerHTML;
    const originalTitle = document.title;

    // Create a new window for printing
    const printWindow = window.open('', '', 'height=600,width=800');
    printWindow.document.write('<html><head><title>GradeTrack Report</title>');
    // Include all necessary CSS files for Bootstrap and W3.CSS styling
    printWindow.document.write('<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet" />');
    printWindow.document.write('<link rel="stylesheet" href="https://www.w3schools.com/w3css/4/w3.css">');
    printWindow.document.write('<style>@media print { canvas { max-width: 100% !important; height: auto !important; } .w3-row-padding { display: flex; flex-wrap: wrap; } .w3-half { width: 48%; margin: 1%; } h4 { color: #024950 !important; } }</style>');
    printWindow.document.write('</head><body>');
    printWindow.document.write(content);
    printWindow.document.write('</body></html>');
    printWindow.document.close();

    // The timeout ensures the content is rendered before printing is called
    printWindow.onload = function() {
        printWindow.print();
        // Closing the window is not always possible or desired immediately
        // printWindow.close(); 
    };
}

/**
 * Assigns a W3.CSS color class based on the display level.
 * @param {string} level The display phrase (e.g., 'Excellent', 'Poor').
 * @returns {string} The W3.CSS color class.
 */
// Helper function to assign a color class based on the prediction level
function getColorClass(level) {
   if (!level) return 'w3-grey';
    const lowerLevel = level.toLowerCase();
    if (lowerLevel.includes('excellent')) {
        return 'w3-green';
    } else if (lowerLevel.includes('improvement')) {
        return 'w3-yellow';
    } else if (lowerLevel.includes('poor') || lowerLevel.includes('n/a') || lowerLevel.includes('unknown')) {
        return 'w3-red';
    }
    return 'w3-light-blue';
}

/**
 * Assigns a HEX color code for Chart.js based on the display level.
 * @param {string} level The display phrase (e.g., 'Excellent', 'Poor').
 * @returns {string} The HEX color code.
 */

// Helper function to assign a color code for the chart
function getColorCode(level) {
    const lowerLevel = level.toLowerCase();
    if (lowerLevel.includes('excellent')) {
        return '#4CAF50'; // Green
    } else if (lowerLevel.includes('improvement')) {
        return '#ffc107'; // Yellow
    } else if (lowerLevel.includes('poor') || lowerLevel.includes('n/a') || lowerLevel.includes('unknown')) {
        return '#f44336'; // Red
    }
    return '#2196F3'; // Blue
}
/**
 * Creates and displays the subject mark and attendance bar charts (vertical orientation).
 * @param {object} predictionData The aggregated prediction object for the student.
 */
function createCharts(predictionData) {
    // ⭐ CORRECTED FIX: Destroy ONLY the active chart instances 
    ['markChart', 'attendanceChart'].forEach(id => {
        if (chartInstances[id]) {
            chartInstances[id].destroy();
            delete chartInstances[id];
        }
    });

    const subjects = [];
    const markLevels = [];
    const attendanceLevels = [];
    const markColors = [];
    const attendanceColors = [];
    
    // --- Data Preparation (Simplified - Removed unused distribution logic) ---
    predictionData.subject_details.forEach(sub => {
        subjects.push(sub.subject);
        markLevels.push(sub.Sub_Mark_Level);
        attendanceLevels.push(sub.Sub_Attn_Level);
        markColors.push(getColorCode(sub.Sub_Mark_Level));
        attendanceColors.push(getColorCode(sub.Sub_Attn_Level));
    });

    // -------------------------------------------------------------
    // --- 1. Subject Mark Performance Bar Chart (Vertical) ---
    // -------------------------------------------------------------
    const markCtx = document.getElementById('markChart');
    if (markCtx) {
        chartInstances['markChart'] = new Chart(markCtx, { 
            type: 'bar',
            data: {
                labels: subjects,
                datasets: [{
                    label: 'Mark Performance Level',
                    data: Array(subjects.length).fill(1), 
                    backgroundColor: markColors,
                    borderColor: markColors.map(c => c.replace('30', '50')), 
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                indexAxis: 'x', // Vertical bars
                scales: {
                    x: {
                        display: true,
                        beginAtZero: true,
                        ticks: {
                            autoSkip: false,
                            maxRotation: 90,
                            minRotation: 90 
                        },
                        title: { 
                            display: true, 
                            text: 'Subject' 
                        } 
                    },
                    y: {
                        display: false,
                        beginAtZero: true,
                        max: 1
                    }
                },
                plugins: {
                    legend: { display: false },
                    title: { display: true, text: 'Subject Performance Level by Subject' },
                    tooltip: { callbacks: { label: function(context) { 
                                // ⭐ FIX 1: Run the raw data through getDisplayPerformance
                                const levelText = getDisplayPerformance(markLevels[context.dataIndex]);
                                return context.label + ': ' + levelText; 
                            }} }
                }
            }
        });
    }

    // -------------------------------------------------------------
    // --- 2. Subject Attendance Bar Chart (Vertical) ---
    // -------------------------------------------------------------
    const attnCtx = document.getElementById('attendanceChart');
    if (attnCtx) {
        chartInstances['attendanceChart'] = new Chart(attnCtx, { 
            type: 'bar',
            data: {
                labels: subjects,
                datasets: [{
                    label: 'Attendance Level',
                    data: Array(subjects.length).fill(1),
                    backgroundColor: attendanceColors,
                    borderColor: attendanceColors.map(c => c.replace('30', '50')),
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                indexAxis: 'x', // Vertical bars
                scales: {
                    x: {
                        display: true,
                        beginAtZero: true,
                        ticks: {
                            autoSkip: false,
                            maxRotation: 90,
                            minRotation: 90 
                        },
                        title: { 
                            display: true, 
                            text: 'Subject' 
                        } 
                    },
                    y: {
                        display: false,
                        beginAtZero: true,
                        max: 1
                    }
                },
                plugins: {
                    legend: { display: false },
                    title: { display: true, text: 'Attendance Level by Subject' },
                    tooltip: { callbacks: {label: function(context) { 
                                // ⭐ FIX 2: Run the raw data through getDisplayPerformance
                                const levelText = getDisplayPerformance(attendanceLevels[context.dataIndex]);
                                return context.label + ': ' + levelText; 
                            } } }
                }
            }
        });
    }
    
    // NOTE: The unused logic for the 'levelDistributionChart' (pie/distribution bar) 
    // was removed to keep the function clean.
}