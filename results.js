const urlParams = new URLSearchParams(window.location.search);
const eventId = urlParams.get('id');
let eventData;

// Load event data from Firebase or localStorage
loadEventData();

// Set up real-time updates for Firebase
let realTimeListener = null;

async function loadEventData() {
    console.log('🔍 Loading event data for ID:', eventId);
    
    // Try Firebase first
    try {
        console.log('🔥 Attempting Firebase load...');
        eventData = await window.FirebaseAPI.loadEvent(eventId);
        if (eventData) {
            console.log('✅ Results loaded from Firebase:', eventData.participants.length, 'participants');
            console.log('📊 Firebase event data:', JSON.stringify(eventData, null, 2));
            setupRealTimeUpdates();
        } else {
            console.log('⚠️ Event not found in Firebase - received null/undefined');
        }
    } catch (error) {
        console.error('❌ Firebase load failed with error:', error);
        console.error('❌ Error details:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
    }
    
    // Fallback to localStorage - ALWAYS check first for current participant
    console.log('📁 Checking localStorage for current participant...');
    const localStorageData = localStorage.getItem(`event_${eventId}`);
    console.log('📁 Raw localStorage data:', localStorageData);
    
    const localEventData = JSON.parse(localStorageData || 'null');
    if (localEventData && localEventData.participants && localEventData.participants.length > 0) {
        console.log('✅ Results loaded from localStorage:', localEventData.participants.length, 'participants');
        console.log('📊 localStorage event data:', JSON.stringify(localEventData, null, 2));
        eventData = localEventData; // Use localStorage data as primary source
        setupLocalStoragePolling();
    } else {
        console.log('📁 No participant data found in localStorage, trying individual documents...');
        
        // Try loading participants from individual documents if localStorage is empty
        if (!eventData || !eventData.participants || eventData.participants.length === 0) {
            console.log('🌐 Trying to load participants from individual documents...');
            try {
                const individualParticipants = await window.FirebaseAPI.loadParticipantsFromIndividualDocs(eventId);
                if (individualParticipants && individualParticipants.length > 0) {
                    console.log('✅ Results loaded from individual participant documents:', individualParticipants.length, 'participants');
                    if (eventData) {
                        eventData.participants = individualParticipants;
                    } else {
                        // Create minimal event data structure
                        eventData = {
                            title: 'Event Results',
                            pin: '',
                            participants: individualParticipants
                        };
                    }
                    setupPolling(); // Use Firebase polling for individual docs
                } else {
                    console.log('⚠️ No participants found in individual documents either');
                }
            } catch (error) {
                console.error('❌ Failed to load individual participant documents:', error);
            }
        }
    }
    
    // Final check - if still no data
    if (!eventData || !eventData.participants || eventData.participants.length === 0) {
        console.log('📁 Trying localStorage fallback...');
        const localStorageData = localStorage.getItem(`event_${eventId}`);
        console.log('📁 Raw localStorage data:', localStorageData);
        
        const localEventData = JSON.parse(localStorageData || 'null');
        if (localEventData && localEventData.participants && localEventData.participants.length > 0) {
            console.log('✅ Results loaded from localStorage:', localEventData.participants.length, 'participants');
            console.log('� localStorage event data:', JSON.stringify(localEventData, null, 2));
            eventData = localEventData; // Use localStorage data instead
            setupLocalStoragePolling();
        } else {
            console.log('❌ No participant data found in localStorage either');
            console.log('📁 All localStorage keys:', Object.keys(localStorage));
            console.log('📁 Event-specific keys:', Object.keys(localStorage).filter(key => key.includes(eventId)));
        }
    }
    
    if (!eventData) {
        console.error('💥 CRITICAL: No event data found anywhere!');
        console.log('🔍 Debug info:', {
            eventId: eventId,
            currentURL: window.location.href,
            localStorage_keys: Object.keys(localStorage),
            firebase_available: typeof window.FirebaseAPI !== 'undefined'
        });
        document.body.innerHTML = '<div class="container"><div class="card"><h1>Event not found</h1><p>Event ID: ' + eventId + '</p><p>Check console for debug information</p></div></div>';
    } else {
        console.log('� Proceeding to load results with event data');
        loadResults();
    }
}

function setupRealTimeUpdates() {
    // Set up Firebase real-time listener if available
    if (window.FirebaseAPI && window.FirebaseAPI.onEventUpdate) {
        console.log('🔄 Setting up real-time updates...');
        realTimeListener = window.FirebaseAPI.onEventUpdate(eventId, (updatedEventData) => {
            if (updatedEventData && hasParticipantChanges(eventData, updatedEventData)) {
                console.log('🆕 Participant changes detected, updating results...');
                const hadNewParticipants = hasNewParticipants(eventData, updatedEventData);
                eventData = updatedEventData;
                refreshResults(hadNewParticipants);
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
            console.log('🆕 Participant changes detected in localStorage, updating results...');
            const hadNewParticipants = hasNewParticipants(eventData, updatedData);
            eventData = updatedData;
            refreshResults(hadNewParticipants);
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
                console.log('🆕 Participant changes detected via polling, updating results...');
                const hadNewParticipants = hasNewParticipants(eventData, updatedData);
                eventData = updatedData;
                refreshResults(hadNewParticipants);
            }
        } catch (error) {
            // Silently handle polling errors
        }
    }, 5000);
}

function refreshResults(showNewParticipantNotification = false) {
    // Update stored participants data
    allParticipants = [...eventData.participants];
    
    // Re-render participants with new data
    setTimeout(() => {
        renderParticipants();
        updateSearchCount();
    }, 100);
    
    // Only show notification if there are actually new participants
    if (showNewParticipantNotification) {
        showUpdateNotification();
    }
}

function showUpdateNotification() {
    // Create temporary notification
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #10b981;
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        font-weight: 600;
        z-index: 1000;
        animation: slideIn 0.3s ease;
    `;
    notification.textContent = `New participant joined! (${eventData.participants.length} total)`;
    
    // Add animation keyframes
    if (!document.querySelector('#notification-styles')) {
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

function centerSpectrumOnZero() {
    // Only apply centering on mobile devices (width <= 920px)
    if (window.innerWidth <= 920) {
        const spectrumContainer = document.querySelector('.spectrum-container');
        if (spectrumContainer) {
            // Calculate the scroll position to center on 0
            // The spectrum is 1024px wide on mobile, center (0 position) is at 512px
            const spectrumWidth = 1024;
            const viewportWidth = window.innerWidth;
            
            // Center position should show 0 in the middle of the viewport
            // 0 is at 50% of the spectrum width, so scroll to center that position
            const zeroPosition = spectrumWidth * 0.5; // 512px
            const centerPosition = zeroPosition - (viewportWidth / 2);
            
            // Use setTimeout to ensure DOM is ready and apply centering
            setTimeout(() => {
                spectrumContainer.scrollLeft = centerPosition;
            }, 50);
        }
    }
}

// Handle window resize to re-center if needed
window.addEventListener('resize', () => {
    if (eventData) {
        centerSpectrumOnZero();
    }
});

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
    
    // Check for score, name, or avatar changes
    for (let i = 0; i < oldData.participants.length; i++) {
        const oldParticipant = oldData.participants[i];
        const newParticipant = newData.participants.find(p => p.id === oldParticipant.id);
        
        if (!newParticipant || 
            oldParticipant.score !== newParticipant.score || 
            oldParticipant.name !== newParticipant.name ||
            oldParticipant.avatar !== newParticipant.avatar) {
            return true;
        }
    }
    
    return false;
}

// Helper function to detect if new participants were added (not just changes)
function hasNewParticipants(oldData, newData) {
    if (!oldData || !newData) return false;
    
    // Only return true if the participant count increased
    return newData.participants.length > oldData.participants.length;
}

// Clean up listener when page unloads
window.addEventListener('beforeunload', () => {
    if (realTimeListener && typeof realTimeListener === 'function') {
        realTimeListener();
    }
});

// Global variables for search functionality
let allParticipants = [];
let currentSearchTerm = '';

function loadResults() {
    document.getElementById('eventTitle').textContent = eventData.title + ' - Results';

    // Position participants on the spectrum bar
    const spectrumBar = document.querySelector('.spectrum-bar');
    
    // Center spectrum on 0 position for mobile devices
    centerSpectrumOnZero();
    
    // Store all participants for search functionality
    allParticipants = [...eventData.participants];
    
    // Apply dynamic row allocation and render participants
    renderParticipants();
    
    // Set up search functionality
    setupSearchFunctionality();
    
    // Update search results count
    updateSearchCount();
}

function renderParticipants() {
    const spectrumBar = document.querySelector('.spectrum-bar');
    
    // Clear existing participants
    const existingParticipants = spectrumBar.querySelectorAll('.participant-marker');
    existingParticipants.forEach(p => p.remove());
    
    // Sort participants by score for consistent ordering
    const sortedParticipants = [...allParticipants].sort((a, b) => a.score - b.score);
    
    // Simple round-robin allocation across 20 rows
    const participantRows = allocateDynamicRows(sortedParticipants);
    
    // Create participant elements
    participantRows.forEach((data, participant) => {
        const participantDiv = document.createElement('div');
        participantDiv.className = 'participant-marker';
        participantDiv.setAttribute('data-participant-id', participant.id);
        
        // Set row data attribute for positioning
        participantDiv.setAttribute('data-row', data.row);
        
        // Apply search filter if active
        const matchesSearch = doesParticipantMatchSearch(participant, currentSearchTerm);
        if (currentSearchTerm && !matchesSearch) {
            participantDiv.classList.add('filtered-out');
        }
        
        participantDiv.innerHTML = `
            <div class="participant-container" style="left: ${data.position}%" onclick="showParticipantModal('${participant.id}')">
                <div class="participant-avatar">${participant.avatar}</div>
                <div class="participant-name-label">${participant.name} (${participant.score > 0 ? '+' : ''}${participant.score})</div>
            </div>
        `;
        
        spectrumBar.appendChild(participantDiv);
    });
}

function allocateDynamicRows(sortedParticipants) {
    const participantRows = new Map();
    
    console.log(`🚀 Starting simple round-robin allocation for ${sortedParticipants.length} participants across 20 rows`);
    
    // Simple round-robin distribution across exactly 20 rows
    sortedParticipants.forEach((participant, index) => {
        // Calculate position based on score (-25 to +25 maps to 0% to 100%)
        const scorePercentage = ((participant.score + 25) / 50) * 100;
        
        // Round-robin: cycle through rows 0-19
        const assignedRow = index % 20;
        
        console.log(`👤 ${participant.name} (${participant.score}) → Row ${assignedRow}`);
        
        participantRows.set(participant, {
            row: assignedRow,
            position: scorePercentage
        });
    });
    
    return participantRows;
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
    
    // Apply search filter to all participants
    const participantMarkers = document.querySelectorAll('.participant-marker');
    let visibleCount = 0;
    
    participantMarkers.forEach(marker => {
        const participantId = marker.getAttribute('data-participant-id');
        const participant = allParticipants.find(p => p.id === participantId);
        
        if (participant) {
            const matches = doesParticipantMatchSearch(participant, searchTerm);
            
            if (searchTerm === '' || matches) {
                marker.classList.remove('filtered-out');
                visibleCount++;
            } else {
                marker.classList.add('filtered-out');
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

// Modal functionality
function showParticipantModal(participantId) {
    const participant = allParticipants.find(p => p.id === participantId);
    if (!participant) return;
    
    // Calculate statistics
    const stats = calculateParticipantStats(participant);
    
    // Populate modal content
    document.getElementById('modalAvatar').textContent = participant.avatar;
    document.getElementById('modalName').textContent = participant.name;
    document.getElementById('modalScore').textContent = `Score: ${participant.score > 0 ? '+' : ''}${participant.score}`;
    
    // Populate statistics
    document.getElementById('privilegeComparison').textContent = stats.privilegeComparison;
    document.getElementById('privilegeComparison').className = `stat-value ${stats.privilegeClass}`;
    
    document.getElementById('modeComparison').textContent = stats.modeComparison;
    document.getElementById('modeComparison').className = `stat-value ${stats.modeClass}`;
    
    document.getElementById('medianComparison').textContent = stats.medianComparison;
    document.getElementById('medianComparison').className = `stat-value ${stats.medianClass}`;
    
    // Show modal
    document.getElementById('participantModal').style.display = 'block';
}

function calculateParticipantStats(participant) {
    const scores = allParticipants.map(p => p.score);
    const totalParticipants = scores.length;
    
    // Calculate how many participants have lower scores (less privileged)
    const lessPrivilegedCount = scores.filter(score => score < participant.score).length;
    
    // Calculate mode (most frequent score)
    const scoreFrequency = {};
    scores.forEach(score => {
        scoreFrequency[score] = (scoreFrequency[score] || 0) + 1;
    });
    const maxFrequency = Math.max(...Object.values(scoreFrequency));
    const modes = Object.keys(scoreFrequency).filter(score => scoreFrequency[score] === maxFrequency).map(Number);
    const mode = modes.length === 1 ? modes[0] : modes[0]; // Use first mode if multiple
    
    // Calculate median
    const sortedScores = [...scores].sort((a, b) => a - b);
    const median = sortedScores.length % 2 === 0
        ? (sortedScores[sortedScores.length / 2 - 1] + sortedScores[sortedScores.length / 2]) / 2
        : sortedScores[Math.floor(sortedScores.length / 2)];
    
    // Calculate differences
    const modeDifference = participant.score - mode;
    const medianDifference = participant.score - median;
    
    // Format results with "You are:" prefix
    const privilegeComparison = `${lessPrivilegedCount} participants out of ${totalParticipants} are less privileged than you`;
    
    const modeComparison = modeDifference === 0 
        ? "You scored exactly at the mode"
        : `${Math.abs(modeDifference)} points ${modeDifference > 0 ? 'above' : 'below'} the mode`;
    
    const medianComparison = medianDifference === 0 
        ? "You scored exactly at the median"
        : `${Math.abs(medianDifference)} points ${medianDifference > 0 ? 'above' : 'below'} the median`;
    
    return {
        privilegeComparison,
        modeComparison,
        medianComparison,
        privilegeClass: '',
        modeClass: '',
        medianClass: ''
    };
}

function closeModal() {
    document.getElementById('participantModal').style.display = 'none';
}

// Set up modal event listeners when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Close modal when clicking the close button
    const closeBtn = document.getElementById('closeModal');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeModal);
    }
    
    // Close modal when clicking outside of it
    const modal = document.getElementById('participantModal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });
    }
    
    // Close modal with Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeModal();
        }
    });
});
