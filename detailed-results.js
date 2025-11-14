const urlParams = new URLSearchParams(window.location.search);
const eventId = urlParams.get('id');
let eventData;
let enabledQuestions = [];
let allParticipants = [];
let currentSearchTerm = '';
let currentSort = { column: null, direction: 'asc' };

// Load event data from Firebase or localStorage
loadEventData();

// Set up real-time updates for Firebase
let realTimeListener = null;

async function loadEventData() {
    console.log('🔍 Loading detailed results for event ID:', eventId);
    
    // Show loading state
    showLoadingState();
    
    // Try Firebase first - this is the primary source for cross-device data
    try {
        console.log('🔥 Attempting Firebase load...');
        eventData = await window.FirebaseAPI.loadEvent(eventId);
        if (eventData && eventData.participants && eventData.participants.length > 0) {
            console.log('✅ Detailed results loaded from Firebase:', eventData.participants.length, 'participants');
            console.log('📊 Firebase event data:', JSON.stringify(eventData, null, 2));
            setupRealTimeUpdates();
            console.log('📊 Proceeding to load detailed results with Firebase data');
            loadDetailedResults();
            return; // Use Firebase data and exit - don't override with localStorage
        } else {
            console.log('⚠️ Event not found in Firebase or no participants - trying localStorage fallback');
        }
    } catch (error) {
        console.error('❌ Firebase load failed with error:', error);
        console.log('📁 Falling back to localStorage...');
    }
    
    // Only use localStorage as fallback if Firebase has no data
    console.log('📁 Checking localStorage for fallback data...');
    const localStorageData = localStorage.getItem(`event_${eventId}`);
    console.log('📁 Raw localStorage data:', localStorageData);
    
    const localEventData = JSON.parse(localStorageData || 'null');
    if (localEventData && localEventData.participants && localEventData.participants.length > 0) {
        console.log('✅ Detailed results loaded from localStorage fallback:', localEventData.participants.length, 'participants');
        console.log('📊 localStorage event data:', JSON.stringify(localEventData, null, 2));
        eventData = localEventData;
        setupLocalStoragePolling();
        console.log('📊 Proceeding to load detailed results with localStorage data');
        loadDetailedResults();
        return;
    }
    
    // Final fallback - no data found anywhere
    console.error('💥 CRITICAL: No event data found anywhere!');
    console.log('🔍 Debug info:', {
        eventId: eventId,
        currentURL: window.location.href,
        localStorage_keys: Object.keys(localStorage),
        firebase_available: typeof window.FirebaseAPI !== 'undefined'
    });
    showErrorState();
}

function setupRealTimeUpdates() {
    // Set up Firebase real-time listener if available
    if (window.FirebaseAPI && window.FirebaseAPI.onEventUpdate) {
        console.log('🔄 Setting up real-time updates...');
        realTimeListener = window.FirebaseAPI.onEventUpdate(eventId, (updatedEventData) => {
            if (updatedEventData && hasParticipantChanges(eventData, updatedEventData)) {
                console.log('🆕 Participant changes detected, updating detailed results...');
                eventData = updatedEventData;
                refreshDetailedResults();
            }
        });
    } else {
        // Fallback to polling every 5 seconds
        setupPolling();
    }
}

function setupLocalStoragePolling() {
    // Poll localStorage every 3 seconds for changes
    setInterval(() => {
        const updatedData = JSON.parse(localStorage.getItem(`event_${eventId}`) || 'null');
        if (updatedData && hasParticipantChanges(eventData, updatedData)) {
            console.log('🆕 Participant changes detected in localStorage, updating detailed results...');
            eventData = updatedData;
            refreshDetailedResults();
        }
    }, 3000);
}

function setupPolling() {
    // Poll Firebase every 5 seconds as fallback
    setInterval(async () => {
        try {
            const updatedData = await window.FirebaseAPI.loadEvent(eventId);
            
            // If main event document is empty, try individual documents
            if (updatedData && (!updatedData.participants || updatedData.participants.length === 0)) {
                console.log('🔄 Main event document empty, checking individual documents...');
                const individualParticipants = await window.FirebaseAPI.loadParticipantsFromIndividualDocs(eventId);
                if (individualParticipants && individualParticipants.length > 0) {
                    updatedData.participants = individualParticipants;
                }
            }
            
            if (updatedData && hasParticipantChanges(eventData, updatedData)) {
                console.log('🆕 Participant changes detected via polling, updating detailed results...');
                eventData = updatedData;
                refreshDetailedResults();
            }
        } catch (error) {
            // Silently handle polling errors
        }
    }, 5000);
}

function refreshDetailedResults() {
    // Update stored participants data
    allParticipants = [...eventData.participants];
    
    // Re-render table with new data
    setTimeout(() => {
        buildTable();
        updateSearchCount();
    }, 100);
}

// Helper function to detect participant changes
function hasParticipantChanges(oldData, newData) {
    if (!oldData || !newData) return true;
    if (oldData.participants.length !== newData.participants.length) return true;
    
    // Create sets of participant IDs for comparison
    const oldIds = new Set(oldData.participants.map(p => p.id));
    const newIds = new Set(newData.participants.map(p => p.id));
    
    // Check if any participants were added or removed
    if (oldIds.size !== newIds.size) return true;
    for (let id of oldIds) {
        if (!newIds.has(id)) return true;
    }
    for (let id of newIds) {
        if (!oldIds.has(id)) return true;
    }
    
    // Check for score, name, avatar, or answer changes
    for (let i = 0; i < oldData.participants.length; i++) {
        const oldParticipant = oldData.participants[i];
        const newParticipant = newData.participants.find(p => p.id === oldParticipant.id);
        
        if (!newParticipant || 
            oldParticipant.score !== newParticipant.score || 
            oldParticipant.name !== newParticipant.name ||
            oldParticipant.avatar !== newParticipant.avatar ||
            JSON.stringify(oldParticipant.answers) !== JSON.stringify(newParticipant.answers)) {
            return true;
        }
    }
    
    return false;
}

// Clean up listener when page unloads
window.addEventListener('beforeunload', () => {
    if (realTimeListener && typeof realTimeListener === 'function') {
        realTimeListener();
    }
});

function loadDetailedResults() {
    hideLoadingState();
    
    if (!eventData || !eventData.participants || eventData.participants.length === 0) {
        showErrorState();
        return;
    }
    
    // Set page title
    document.getElementById('eventTitle').textContent = eventData.title + ' - Detailed Results';
    
    // Store all participants for search functionality
    allParticipants = [...eventData.participants];
    
    // Determine which questions were enabled for this event
    determineEnabledQuestions();
    
    // Build the detailed results table
    buildTable();
    
    // Update summary statistics
    updateSummaryStats();
    
    // Set up search functionality
    setupSearchFunctionality();
    
    // Set up back button
    setupBackButton();
    
    // Update search results count
    updateSearchCount();
}

function determineEnabledQuestions() {
    if (typeof questions === 'undefined') {
        console.warn('Questions array not found');
        enabledQuestions = [];
        return;
    }
    
    // Get disabled questions from event data if available, otherwise infer from participant answers
    let disabledQuestions = [];
    
    // First, try to get disabled questions from event data if available
    if (eventData && eventData.disabledQuestions && Array.isArray(eventData.disabledQuestions)) {
        disabledQuestions = eventData.disabledQuestions;
        console.log('📋 Using disabled questions from event data:', disabledQuestions);
    } else {
        // Fallback: infer from participant answers (for older events without stored disabled questions)
        console.log('📋 Event has no stored disabled questions, inferring from participant answers...');
        
        if (eventData && eventData.participants && eventData.participants.length > 0) {
            // Get all question indices that have been answered by any participant
            const answeredQuestionIndices = new Set();
            eventData.participants.forEach(participant => {
                if (participant.answers) {
                    // Handle both object format {16: 1} and array format [null, null, ..., 1, 0, ...]
                    if (Array.isArray(participant.answers)) {
                        participant.answers.forEach((answer, index) => {
                            if (answer !== null && answer !== undefined) {
                                answeredQuestionIndices.add(index);
                            }
                        });
                    } else {
                        Object.keys(participant.answers).forEach(index => {
                            answeredQuestionIndices.add(parseInt(index));
                        });
                    }
                }
            });
            
            console.log('📋 All answered question indices:', Array.from(answeredQuestionIndices).sort((a, b) => a - b));
            console.log('📋 Total questions in questions.js:', questions.length);
            
            // Assume questions not answered by anyone were disabled
            disabledQuestions = [];
            for (let i = 0; i < questions.length; i++) {
                if (!answeredQuestionIndices.has(i)) {
                    disabledQuestions.push(i);
                }
            }
            console.log('📋 Inferred disabled questions from participant answers:', disabledQuestions);
        } else {
            // Last resort: use empty array (all questions enabled)
            console.log('📋 No participant data available, assuming all questions were enabled');
            disabledQuestions = [];
        }
    }
    
    // Filter out disabled questions to get the event's actual question set
    enabledQuestions = questions.filter((_, index) => !disabledQuestions.includes(index));
    
    console.log(`📊 Event uses ${enabledQuestions.length} out of ${questions.length} total questions`);
    console.log(`📊 Enabled questions (indices):`, questions.map((_, index) => index).filter(index => !disabledQuestions.includes(index)));
}

function buildTable() {
    const table = document.getElementById('detailedTable');
    const headerRow = document.getElementById('tableHeader');
    const tableBody = document.getElementById('tableBody');
    
    // Clear existing question columns and rows
    const existingQuestionHeaders = headerRow.querySelectorAll('th:not(.sticky-col)');
    existingQuestionHeaders.forEach(header => header.remove());
    tableBody.innerHTML = '';
    
    // Set up sorting for existing sticky columns
    setupColumnSorting();
    
    // Add question column headers
    enabledQuestions.forEach((question, index) => {
        const questionIndex = questions.indexOf(question);
        const th = document.createElement('th');
        th.className = 'question-col sortable';
        th.style.cursor = 'pointer';
        th.setAttribute('data-column', `question-${questionIndex}`);
        th.innerHTML = `
            <div class="question-header">
                <div class="question-number">Q${questionIndex + 1}</div>
                <div class="question-text" title="${question.text}">
                    ${question.text.length > 120 ? question.text.substring(0, 120) + '...' : question.text}
                </div>
                <div class="sort-indicator">⇅</div>
            </div>
        `;
        
        // Add click handler for sorting
        th.addEventListener('click', () => handleColumnSort(`question-${questionIndex}`));
        
        headerRow.appendChild(th);
    });
    
    // Sort participants based on current sort settings
    const sortedParticipants = getSortedParticipants();
    
    // Add summary row with percentages first (at the top)
    addSummaryRow();
    
    // Add participant rows
    sortedParticipants.forEach(participant => {
        const row = document.createElement('tr');
        row.className = 'participant-row';
        row.setAttribute('data-participant-id', participant.id);
        
        // Apply search filter if active
        const matchesSearch = doesParticipantMatchSearch(participant, currentSearchTerm);
        if (currentSearchTerm && !matchesSearch) {
            row.classList.add('filtered-out');
        }
        
        // Row number column
        const rowNumberCell = document.createElement('td');
        rowNumberCell.className = 'sticky-col row-number-cell';
        rowNumberCell.textContent = sortedParticipants.indexOf(participant) + 1;
        row.appendChild(rowNumberCell);
        
        // Avatar column
        const avatarCell = document.createElement('td');
        avatarCell.className = 'sticky-col avatar-cell';
        avatarCell.innerHTML = `<div class="participant-avatar-small">${participant.avatar}</div>`;
        row.appendChild(avatarCell);
        
        // Name column
        const nameCell = document.createElement('td');
        nameCell.className = 'sticky-col name-cell';
        nameCell.textContent = participant.name;
        row.appendChild(nameCell);
        
        // Score column
        const scoreCell = document.createElement('td');
        scoreCell.className = 'sticky-col score-cell';
        scoreCell.innerHTML = `<span class="score-badge ${participant.score >= 0 ? 'positive' : 'negative'}">${participant.score > 0 ? '+' : ''}${participant.score}</span>`;
        row.appendChild(scoreCell);
        
        // Calculate positive and negative sums
        const { positiveSum, negativeSum } = calculateParticipantSums(participant);
        
        // Positive sum column
        const positiveSumCell = document.createElement('td');
        positiveSumCell.className = 'sticky-col positive-sum-cell';
        positiveSumCell.innerHTML = `<span class="sum-badge positive">${positiveSum === 0 ? '0' : '+' + positiveSum}</span>`;
        row.appendChild(positiveSumCell);
        
        // Negative sum column
        const negativeSumCell = document.createElement('td');
        negativeSumCell.className = 'sticky-col negative-sum-cell';
        negativeSumCell.innerHTML = `<span class="sum-badge negative">${negativeSum === 0 ? '0' : '-' + negativeSum}</span>`;
        row.appendChild(negativeSumCell);
        
        // Question answer columns
        enabledQuestions.forEach((question, index) => {
            const questionIndex = questions.indexOf(question);
            const answerCell = document.createElement('td');
            answerCell.className = 'answer-cell';
            
            let answer = null;
            if (participant.answers) {
                // Handle both object format {16: 1} and array format [null, null, ..., 1, 0, ...]
                if (Array.isArray(participant.answers)) {
                    answer = participant.answers[questionIndex];
                } else {
                    answer = participant.answers[questionIndex];
                }
            }
            
            if (answer === 1) {
                // Yes answer - participant gets the point value
                answerCell.innerHTML = `<span class="answer-badge yes">${question.value > 0 ? '+' : ''}${question.value}</span>`;
            } else if (answer === 0) {
                // No answer - participant gets 0 points
                answerCell.innerHTML = `<span class="answer-badge no">0</span>`;
            } else {
                // No answer recorded
                answerCell.innerHTML = `<span class="answer-badge na">-</span>`;
            }
            
            row.appendChild(answerCell);
        });
        
        tableBody.appendChild(row);
    });
    
    // Update sort indicators after table is built
    updateSortIndicators();
}

function addSummaryRow() {
    const tableBody = document.getElementById('tableBody');
    
    // Create summary row
    const summaryRow = document.createElement('tr');
    summaryRow.className = 'summary-row';
    
    // Row number column - empty or label
    const rowNumberCell = document.createElement('td');
    rowNumberCell.className = 'sticky-col row-number-cell summary-cell';
    rowNumberCell.textContent = '%';
    summaryRow.appendChild(rowNumberCell);
    
    // Avatar column - empty
    const avatarCell = document.createElement('td');
    avatarCell.className = 'sticky-col avatar-cell summary-cell';
    avatarCell.innerHTML = '<span class="summary-label">Summary</span>';
    summaryRow.appendChild(avatarCell);
    
    // Name column - label
    const nameCell = document.createElement('td');
    nameCell.className = 'sticky-col name-cell summary-cell';
    nameCell.innerHTML = '<strong>Response %</strong>';
    summaryRow.appendChild(nameCell);
    
    // Score column - empty
    const scoreCell = document.createElement('td');
    scoreCell.className = 'sticky-col score-cell summary-cell';
    scoreCell.innerHTML = '-';
    summaryRow.appendChild(scoreCell);
    
    // Positive sum column - empty
    const positiveSumCell = document.createElement('td');
    positiveSumCell.className = 'sticky-col positive-sum-cell summary-cell';
    positiveSumCell.innerHTML = '-';
    summaryRow.appendChild(positiveSumCell);
    
    // Negative sum column - empty
    const negativeSumCell = document.createElement('td');
    negativeSumCell.className = 'sticky-col negative-sum-cell summary-cell';
    negativeSumCell.innerHTML = '-';
    summaryRow.appendChild(negativeSumCell);
    
    // Question percentage columns
    enabledQuestions.forEach((question) => {
        const questionIndex = questions.indexOf(question);
        const percentageCell = document.createElement('td');
        percentageCell.className = 'answer-cell summary-cell';
        
        // Calculate percentages for this question
        let yesCount = 0;
        let noCount = 0;
        let totalAnswered = 0;
        
        allParticipants.forEach(participant => {
            let answer = null;
            if (participant.answers) {
                if (Array.isArray(participant.answers)) {
                    answer = participant.answers[questionIndex];
                } else {
                    answer = participant.answers[questionIndex];
                }
            }
            
            if (answer === 1) {
                yesCount++;
                totalAnswered++;
            } else if (answer === 0) {
                noCount++;
                totalAnswered++;
            }
            // Skip null/undefined answers in percentage calculation
        });
        
        if (totalAnswered > 0) {
            const yesPercentage = Math.round((yesCount / totalAnswered) * 100);
            const noPercentage = Math.round((noCount / totalAnswered) * 100);
            
            percentageCell.innerHTML = `
                <div class="percentage-summary">
                    <div class="yes-percentage">Yes: ${yesPercentage}%</div>
                    <div class="no-percentage">No: ${noPercentage}%</div>
                </div>
            `;
        } else {
            percentageCell.innerHTML = '<div class="percentage-summary">No responses</div>';
        }
        
        summaryRow.appendChild(percentageCell);
    });
    
    tableBody.appendChild(summaryRow);
}

function updateSummaryStats() {
    const totalParticipants = allParticipants.length;
    const totalQuestions = enabledQuestions.length;
    const averageScore = totalParticipants > 0 
        ? (allParticipants.reduce((sum, p) => sum + p.score, 0) / totalParticipants).toFixed(1)
        : 0;
    
    document.getElementById('totalParticipants').textContent = totalParticipants;
    document.getElementById('totalQuestions').textContent = totalQuestions;
    document.getElementById('averageScore').textContent = averageScore;
}

function setupSearchFunctionality() {
    const searchInput = document.getElementById('searchInput');
    const searchToggle = document.getElementById('searchToggle');
    const searchContainer = document.getElementById('searchContainer');
    
    if (!searchInput || !searchToggle || !searchContainer) return;
    
    // Toggle search container visibility
    searchToggle.addEventListener('click', () => {
        const isVisible = searchContainer.style.display !== 'none';
        
        if (isVisible) {
            // Hide search
            searchContainer.style.display = 'none';
            searchToggle.classList.remove('active');
            // Clear search when hiding
            searchInput.value = '';
            handleSearchInput({ target: { value: '' } });
        } else {
            // Show search
            searchContainer.style.display = 'block';
            searchToggle.classList.add('active');
            // Focus on input
            setTimeout(() => searchInput.focus(), 100);
        }
    });
    
    // Close search when clicking outside
    document.addEventListener('click', (e) => {
        if (!searchToggle.contains(e.target) && !searchContainer.contains(e.target)) {
            searchContainer.style.display = 'none';
            searchToggle.classList.remove('active');
        }
    });
    
    // Remove existing event listeners to prevent duplicates
    searchInput.removeEventListener('input', handleSearchInput);
    searchInput.removeEventListener('keyup', handleSearchInput);
    
    // Add search event listeners
    searchInput.addEventListener('input', handleSearchInput);
    searchInput.addEventListener('keyup', handleSearchInput);
    
    // Clear search on escape key
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            searchInput.value = '';
            handleSearchInput({ target: { value: '' } });
            searchContainer.style.display = 'none';
            searchToggle.classList.remove('active');
        }
    });
}

function handleSearchInput(event) {
    const searchTerm = event.target.value.toLowerCase().trim();
    currentSearchTerm = searchTerm;
    
    // Apply search filter to all participant rows
    const participantRows = document.querySelectorAll('.participant-row');
    let visibleCount = 0;
    
    participantRows.forEach(row => {
        const participantId = row.getAttribute('data-participant-id');
        const participant = allParticipants.find(p => p.id === participantId);
        
        if (participant) {
            const matches = doesParticipantMatchSearch(participant, searchTerm);
            
            if (searchTerm === '' || matches) {
                row.classList.remove('filtered-out');
                visibleCount++;
            } else {
                row.classList.add('filtered-out');
            }
        }
    });
    
    // Update search results count
    updateSearchCount(visibleCount, allParticipants.length);
}

function doesParticipantMatchSearch(participant, searchTerm) {
    if (!searchTerm) return true;
    
    const name = participant.name.toLowerCase();
    const score = participant.score.toString();
    const avatar = participant.avatar.toLowerCase();
    
    return name.includes(searchTerm) || 
           score.includes(searchTerm) || 
           avatar.includes(searchTerm);
}

function updateSearchCount(visibleCount = null, totalCount = null) {
    const searchCountElement = document.getElementById('searchCount');
    if (!searchCountElement) return;
    
    if (visibleCount === null) {
        visibleCount = allParticipants.length;
        totalCount = allParticipants.length;
    }
    
    if (currentSearchTerm) {
        searchCountElement.textContent = `${visibleCount} of ${totalCount} participants`;
        searchCountElement.style.display = 'block';
    } else {
        searchCountElement.textContent = `${totalCount} participants`;
        searchCountElement.style.display = 'block';
    }
}

function setupBackButton() {
    const backButton = document.getElementById('backToResults');
    if (backButton) {
        backButton.addEventListener('click', () => {
            window.location.href = `results.html?id=${eventId}`;
        });
    }
    
    // Set up CSV download button
    const downloadButton = document.getElementById('downloadCSV');
    if (downloadButton) {
        downloadButton.addEventListener('click', downloadCSV);
    }
}

function calculateParticipantSums(participant) {
    let positiveSum = 0;
    let negativeSum = 0;
    
    enabledQuestions.forEach((question) => {
        const questionIndex = questions.indexOf(question);
        let answer = null;
        
        if (participant.answers) {
            // Handle both object format {16: 1} and array format [null, null, ..., 1, 0, ...]
            if (Array.isArray(participant.answers)) {
                answer = participant.answers[questionIndex];
            } else {
                answer = participant.answers[questionIndex];
            }
        }
        
        // Only count if participant answered "Yes" (answer === 1)
        if (answer === 1) {
            if (question.value > 0) {
                positiveSum += question.value;
            } else {
                negativeSum += Math.abs(question.value);
            }
        }
    });
    
    return { positiveSum, negativeSum };
}

function downloadCSV() {
    if (!eventData || !allParticipants || allParticipants.length === 0) {
        alert('No data available to download');
        return;
    }
    
    // Prepare CSV headers
    const headers = ['#', 'Avatar', 'Name', 'Score', 'Positives', 'Negatives'];
    
    // Add question headers
    enabledQuestions.forEach((question, index) => {
        const questionIndex = questions.indexOf(question);
        headers.push(`Q${questionIndex + 1} (${question.value > 0 ? '+' : ''}${question.value})`);
    });
    
    // Prepare CSV rows
    const rows = [headers];
    
    // Sort participants using current sort for consistent ordering
    const sortedParticipants = getSortedParticipants();
    
    sortedParticipants.forEach(participant => {
        // Skip filtered out participants if search is active
        if (currentSearchTerm && !doesParticipantMatchSearch(participant, currentSearchTerm)) {
            return;
        }
        
        const { positiveSum, negativeSum } = calculateParticipantSums(participant);
        const rowNumber = sortedParticipants.indexOf(participant) + 1;
        const row = [
            rowNumber,
            participant.avatar,
            participant.name,
            participant.score,
            positiveSum,
            negativeSum
        ];
        
        // Add question answers
        enabledQuestions.forEach((question) => {
            const questionIndex = questions.indexOf(question);
            let answer = null;
            
            if (participant.answers) {
                if (Array.isArray(participant.answers)) {
                    answer = participant.answers[questionIndex];
                } else {
                    answer = participant.answers[questionIndex];
                }
            }
            
            if (answer === 1) {
                // Yes answer - participant gets the point value
                row.push(question.value);
            } else if (answer === 0) {
                // No answer - participant gets 0 points
                row.push(0);
            } else {
                // No answer recorded
                row.push('');
            }
        });
        
        rows.push(row);
    });
    
    // Convert to CSV string
    const csvContent = rows.map(row => 
        row.map(cell => {
            // Escape quotes and wrap in quotes if contains comma, quote, or newline
            const cellStr = String(cell);
            if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
                return `"${cellStr.replace(/"/g, '""')}"`;
            }
            return cellStr;
        }).join(',')
    ).join('\n');
    
    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        
        // Generate filename with event title and timestamp
        const eventTitle = eventData.title || 'Event';
        const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const filename = `${eventTitle}-detailed-results-${timestamp}.csv`;
        
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

// Sorting functionality
function setupColumnSorting() {
    // Make existing sticky column headers sortable
    const avatarHeader = document.querySelector('.avatar-col');
    const nameHeader = document.querySelector('.name-col');
    const scoreHeader = document.querySelector('.score-col');
    const positiveSumHeader = document.querySelector('.positive-sum-col');
    const negativeSumHeader = document.querySelector('.negative-sum-col');
    
    // Add sortable class and click handlers
    [avatarHeader, nameHeader, scoreHeader, positiveSumHeader, negativeSumHeader].forEach(header => {
        if (header) {
            header.classList.add('sortable');
            header.style.cursor = 'pointer';
            
            // Add sort indicator
            if (!header.querySelector('.sort-indicator')) {
                const sortIndicator = document.createElement('div');
                sortIndicator.className = 'sort-indicator';
                sortIndicator.textContent = '⇅';
                header.appendChild(sortIndicator);
            }
            
            // Set data-column attribute for identification
            if (header.classList.contains('avatar-col')) {
                header.setAttribute('data-column', 'avatar');
                header.addEventListener('click', () => handleColumnSort('avatar'));
            } else if (header.classList.contains('name-col')) {
                header.setAttribute('data-column', 'name');
                header.addEventListener('click', () => handleColumnSort('name'));
            } else if (header.classList.contains('score-col')) {
                header.setAttribute('data-column', 'score');
                header.addEventListener('click', () => handleColumnSort('score'));
            } else if (header.classList.contains('positive-sum-col')) {
                header.setAttribute('data-column', 'positive-sum');
                header.addEventListener('click', () => handleColumnSort('positive-sum'));
            } else if (header.classList.contains('negative-sum-col')) {
                header.setAttribute('data-column', 'negative-sum');
                header.addEventListener('click', () => handleColumnSort('negative-sum'));
            }
        }
    });
}

function handleColumnSort(column) {
    // Toggle sort direction if same column, otherwise set to ascending
    if (currentSort.column === column) {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort.column = column;
        currentSort.direction = 'asc';
    }
    
    // Update sort indicators
    updateSortIndicators();
    
    // Re-render table with new sort
    buildTable();
}

function updateSortIndicators() {
    // Reset all sort indicators
    document.querySelectorAll('.sort-indicator').forEach(indicator => {
        indicator.textContent = '⇅';
        indicator.className = 'sort-indicator';
    });
    
    // Update active sort indicator
    if (currentSort.column) {
        const activeHeader = document.querySelector(`[data-column="${currentSort.column}"]`);
        if (activeHeader) {
            const indicator = activeHeader.querySelector('.sort-indicator');
            if (indicator) {
                indicator.textContent = currentSort.direction === 'asc' ? '↑' : '↓';
                indicator.className = `sort-indicator active ${currentSort.direction}`;
            }
        }
    }
}

function getSortedParticipants() {
    if (!currentSort.column) {
        // Default sort by score descending
        return [...allParticipants].sort((a, b) => b.score - a.score);
    }
    
    return [...allParticipants].sort((a, b) => {
        let valueA, valueB;
        
        switch (currentSort.column) {
            case 'avatar':
                valueA = a.avatar.toLowerCase();
                valueB = b.avatar.toLowerCase();
                break;
                
            case 'name':
                valueA = a.name.toLowerCase();
                valueB = b.name.toLowerCase();
                break;
                
            case 'score':
                valueA = a.score;
                valueB = b.score;
                break;
                
            case 'positive-sum':
                valueA = calculateParticipantSums(a).positiveSum;
                valueB = calculateParticipantSums(b).positiveSum;
                break;
                
            case 'negative-sum':
                valueA = calculateParticipantSums(a).negativeSum;
                valueB = calculateParticipantSums(b).negativeSum;
                break;
                
            default:
                // Handle question columns
                if (currentSort.column.startsWith('question-')) {
                    const questionIndex = parseInt(currentSort.column.replace('question-', ''));
                    
                    // Get answer values for sorting
                    let answerA = null;
                    let answerB = null;
                    
                    if (a.answers) {
                        answerA = Array.isArray(a.answers) ? a.answers[questionIndex] : a.answers[questionIndex];
                    }
                    if (b.answers) {
                        answerB = Array.isArray(b.answers) ? b.answers[questionIndex] : b.answers[questionIndex];
                    }
                    
                    // Convert to sortable values: Yes=1, No=0, null/undefined=-1
                    valueA = answerA === 1 ? 1 : answerA === 0 ? 0 : -1;
                    valueB = answerB === 1 ? 1 : answerB === 0 ? 0 : -1;
                } else {
                    // Fallback to score
                    valueA = a.score;
                    valueB = b.score;
                }
                break;
        }
        
        // Perform comparison based on data type
        let comparison = 0;
        
        if (typeof valueA === 'string' && typeof valueB === 'string') {
            comparison = valueA.localeCompare(valueB);
        } else {
            comparison = valueA - valueB;
        }
        
        // Apply sort direction
        return currentSort.direction === 'asc' ? comparison : -comparison;
    });
}

function showLoadingState() {
    document.getElementById('loadingState').style.display = 'block';
    document.getElementById('errorState').style.display = 'none';
    document.querySelector('.detailed-results-content .results-summary').style.display = 'none';
    document.querySelector('.detailed-results-content .table-container').style.display = 'none';
}

function hideLoadingState() {
    document.getElementById('loadingState').style.display = 'none';
    document.querySelector('.detailed-results-content .results-summary').style.display = 'block';
    document.querySelector('.detailed-results-content .table-container').style.display = 'block';
}

function showErrorState() {
    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('errorState').style.display = 'block';
    document.querySelector('.detailed-results-content .results-summary').style.display = 'none';
    document.querySelector('.detailed-results-content .table-container').style.display = 'none';
}
