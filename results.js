const urlParams = new URLSearchParams(window.location.search);
const eventId = urlParams.get('id');
let eventData;

// Load event data from Firebase or localStorage
loadEventData();

// Set up real-time updates for Firebase
let realTimeListener = null;

async function loadEventData() {
    // Try Firebase first
    try {
        eventData = await window.FirebaseAPI.loadEvent(eventId);
        if (eventData) {
            console.log('✅ Results loaded from Firebase:', eventData.participants.length, 'participants');
            setupRealTimeUpdates();
        } else {
            console.log('⚠️ Event not found in Firebase');
        }
    } catch (error) {
        console.log('⚠️ Firebase load failed:', error.message);
    }
    
    // Fallback to localStorage
    if (!eventData) {
        eventData = JSON.parse(localStorage.getItem(`event_${eventId}`) || 'null');
        if (eventData) {
            console.log('📁 Results loaded from localStorage:', eventData.participants.length, 'participants');
            setupLocalStoragePolling();
        }
    }
    
    
    if (!eventData) {
        document.body.innerHTML = '<div class="container"><div class="card"><h1>Event not found</h1></div></div>';
    } else {
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
                eventData = updatedEventData;
                refreshResults();
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
            eventData = updatedData;
            refreshResults();
        }
    }, 3000);
}

function setupPolling() {
    // Poll Firebase every 5 seconds as fallback
    setInterval(async () => {
        try {
            const updatedData = await window.FirebaseAPI.loadEvent(eventId);
            if (updatedData && hasParticipantChanges(eventData, updatedData)) {
                console.log('🆕 Participant changes detected via polling, updating results...');
                eventData = updatedData;
                refreshResults();
            }
        } catch (error) {
            // Silently handle polling errors
        }
    }, 5000);
}

function refreshResults() {
    // Clear existing participants
    const existingParticipants = document.querySelectorAll('.participant-marker');
    existingParticipants.forEach(p => p.remove());
    
    // Reload results with animation
    setTimeout(() => {
        loadResults();
    }, 100);
    
    // Show brief notification
    showUpdateNotification();
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
    
    // Check for score or name changes
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

// Clean up listener when page unloads
window.addEventListener('beforeunload', () => {
    if (realTimeListener && typeof realTimeListener === 'function') {
        realTimeListener();
    }
});

function loadResults() {
    document.getElementById('eventTitle').textContent = eventData.title + ' - Results';

    // Position participants on the spectrum bar
    const spectrumBar = document.querySelector('.spectrum-bar');
    
    // Center spectrum on 0 position for mobile devices
    centerSpectrumOnZero();
    
    // Sort participants by score for easier conflict detection
    const sortedParticipants = [...eventData.participants].sort((a, b) => a.score - b.score);
    
    // Detect conflicts (participants within ±3 score range)
    const participantRows = new Map();
    const usedPositions = new Map(); // Track used positions for each row
    
    sortedParticipants.forEach(participant => {
        // Calculate position based on score (-25 to +25 maps to 0% to 100%)
        let scorePercentage = ((participant.score + 25) / 50) * 100;
        
        // Default to center row
        let assignedRow = 2;
        
        // Check for visual overlap with existing participants
        let needsDifferentRow = false;
        
        for (let [existingParticipant, existingData] of participantRows) {
            const positionDiff = Math.abs(scorePercentage - existingData.position);
            
            // If positions would overlap visually (within 8% horizontal distance)
            if (positionDiff < 8) {
                needsDifferentRow = true;
                break;
            }
        }
        
        if (needsDifferentRow) {
            // Find available row (prefer center, then 1, then 3)
            const rowPreference = [2, 1, 3];
            
            for (let preferredRow of rowPreference) {
                let rowAvailable = true;
                
                for (let [existingParticipant, existingData] of participantRows) {
                    if (existingData.row === preferredRow) {
                        const positionDiff = Math.abs(scorePercentage - existingData.position);
                        if (positionDiff < 8) { // Too close in same row
                            rowAvailable = false;
                            break;
                        }
                    }
                }
                
                if (rowAvailable) {
                    assignedRow = preferredRow;
                    break;
                }
            }
        }
        
        participantRows.set(participant, {
            row: assignedRow,
            position: scorePercentage
        });
    });
    
    // Create participant elements
    participantRows.forEach((data, participant) => {
        const participantDiv = document.createElement('div');
        participantDiv.className = 'participant-marker';
        
        // Only set data-row if not default center position
        if (data.row !== 2) {
            participantDiv.setAttribute('data-row', data.row);
        }
        
        participantDiv.innerHTML = `
            <div class="participant-container" style="left: ${data.position}%">
                <div class="participant-avatar">${participant.avatar}</div>
                <div class="participant-name-label">${participant.name} (${participant.score > 0 ? '+' : ''}${participant.score})</div>
            </div>
        `;
        
        spectrumBar.appendChild(participantDiv);
    });
}
