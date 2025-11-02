let currentEventUrl = '';
let currentEventPin = '';

document.addEventListener('DOMContentLoaded', () => {
    loadArchive();
    showCookieBanner();
    updateQuestionCounter();
});

document.getElementById('eventForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const title = document.getElementById('eventTitle').value;
    const eventId = generateId();
    const eventPin = generatePin();
    
    // Include disabled questions in event data
    const disabledQuestions = JSON.parse(localStorage.getItem('disabledQuestions') || '[]');
    const eventData = { 
        title, 
        pin: eventPin, 
        participants: [],
        disabledQuestions: disabledQuestions
    };
    
    console.log('📋 Creating event with disabled questions:', disabledQuestions);
    
    // Save to Firebase and localStorage as backup
    await saveEventToFirebase(eventId, eventData);
    localStorage.setItem(`event_${eventId}`, JSON.stringify(eventData));
    
    // Add to archive
    addToArchive({ 
        id: eventId, 
        title, 
        pin: eventPin, 
        url: `${window.location.origin}${window.location.pathname.replace('index.html', '')}questions.html?id=${eventId}`,
        createdAt: new Date().toISOString()
    });
    
    currentEventUrl = `${window.location.origin}${window.location.pathname.replace('index.html', '')}questions.html?id=${eventId}`;
    currentEventPin = eventPin;
    
    showEventCreated();
});

function showEventCreated() {
    document.getElementById('createForm').style.display = 'none';
    document.getElementById('eventCreated').style.display = 'block';
    document.getElementById('eventUrl').value = currentEventUrl;
    document.getElementById('eventPin').value = currentEventPin;
    document.getElementById('newEventBanner').style.display = 'block';
}

function showCreateForm() {
    document.getElementById('createForm').style.display = 'block';
    document.getElementById('eventCreated').style.display = 'none';
    document.getElementById('newEventBanner').style.display = 'none';
    document.getElementById('eventTitle').value = '';
}

document.getElementById('copyBtn').addEventListener('click', () => {
    document.getElementById('eventUrl').select();
    navigator.clipboard.writeText(currentEventUrl);
});

document.getElementById('copyPinBtn').addEventListener('click', () => {
    document.getElementById('eventPin').select();
    navigator.clipboard.writeText(currentEventPin);
});

document.getElementById('goToEvent').addEventListener('click', () => {
    window.location.href = currentEventUrl;
});

document.getElementById('newEventBanner').addEventListener('click', showCreateForm);

document.getElementById('reviewQuestions').addEventListener('click', (e) => {
    e.preventDefault();
    showQuestionsModal();
});

document.getElementById('cancelQuestions').addEventListener('click', () => {
    document.getElementById('questionsModal').style.display = 'none';
});

document.getElementById('saveQuestions').addEventListener('click', () => {
    document.getElementById('questionsModal').style.display = 'none';
    updateQuestionCounter();
});


function showQuestionsModal() {
    const modal = document.getElementById('questionsModal');
    const questionsList = document.getElementById('questionsList');
    
    // Get disabled questions from localStorage
    const disabledQuestions = JSON.parse(localStorage.getItem('disabledQuestions') || '[]');
    
    questionsList.innerHTML = questions.map((question, index) => {
        const isDisabled = disabledQuestions.includes(index);
        return `
            <div class="question-item ${isDisabled ? 'disabled' : ''}">
                <div class="question-text">${question.text}</div>
                <button class="toggle-btn" onclick="toggleQuestion(${index})">
                    ${isDisabled ? 'Add' : 'Remove'}
                </button>
            </div>
        `;
    }).join('');
    
    modal.style.display = 'block';
}

function toggleQuestion(index) {
    let disabledQuestions = JSON.parse(localStorage.getItem('disabledQuestions') || '[]');
    
    if (disabledQuestions.includes(index)) {
        disabledQuestions = disabledQuestions.filter(i => i !== index);
    } else {
        disabledQuestions.push(index);
    }
    
    localStorage.setItem('disabledQuestions', JSON.stringify(disabledQuestions));
    showQuestionsModal(); // Refresh the modal
}

function generateId() {
    return Math.random().toString(36).substr(2, 9);
}

function generatePin() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Firebase functions
async function saveEventToFirebase(eventId, eventData) {
    try {
        const success = await window.FirebaseAPI.saveEvent(eventId, eventData);
        if (success) {
            console.log('✅ Event saved to Firebase successfully');
        } else {
            console.error('❌ Firebase save failed');
            throw new Error('Firebase save failed');
        }
    } catch (error) {
        console.error('❌ Firebase save error:', error);
        throw error;
    }
}

function addToArchive(event) {
    let archive = JSON.parse(localStorage.getItem('eventArchive') || '[]');
    archive.unshift(event);
    archive = archive.slice(0, 5);
    localStorage.setItem('eventArchive', JSON.stringify(archive));
    loadArchive();
}

function loadArchive() {
    const archive = JSON.parse(localStorage.getItem('eventArchive') || '[]');
    const archiveContainer = document.getElementById('eventArchive');
    const archiveSection = document.getElementById('archiveSection');
    
    if (archive.length > 0) {
        archiveSection.style.display = 'block';
        archiveContainer.innerHTML = archive.map((event, index) => {
            // Update old event.html URLs to questions.html
            const updatedUrl = event.url.replace('event.html', 'questions.html');
            
            // Format the creation date
            let formattedDate = '';
            if (event.createdAt) {
                const date = new Date(event.createdAt);
                formattedDate = date.toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric',
                    year: 'numeric'
                });
            }
            
            return `
                <div class="archive-item">
                    <div class="archive-header">
                        <div class="archive-title">${event.title}</div>
                        ${formattedDate ? `<div class="archive-date">${formattedDate}</div>` : ''}
                    </div>
                    <div class="archive-details">
                        <span class="archive-pin">PIN: ${event.pin}</span>
                        <div class="archive-actions">
                            <button class="archive-btn open-btn" onclick="window.open('${updatedUrl}', '_blank')">Open Event</button>
                            <button class="archive-btn delete-btn" onclick="deleteEvent(${index})" title="Delete event"></button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    } else {
        archiveSection.style.display = 'none';
    }
}

function deleteEvent(index) {
    if (confirm('Are you sure you want to delete this event from your archive?')) {
        let archive = JSON.parse(localStorage.getItem('eventArchive') || '[]');
        archive.splice(index, 1);
        localStorage.setItem('eventArchive', JSON.stringify(archive));
        loadArchive();
    }
}

// Cookie banner functions
function showCookieBanner() {
    const cookieConsent = localStorage.getItem('cookieConsent');
    if (!cookieConsent) {
        document.getElementById('cookieBanner').style.display = 'block';
    }
}

document.getElementById('acceptCookies').addEventListener('click', () => {
    localStorage.setItem('cookieConsent', 'accepted');
    document.getElementById('cookieBanner').style.display = 'none';
});

function updateQuestionCounter() {
    const disabledQuestions = JSON.parse(localStorage.getItem('disabledQuestions') || '[]');
    const totalQuestions = questions.length;
    const enabledQuestions = totalQuestions - disabledQuestions.length;
    
    const counterElement = document.getElementById('questionCount');
    if (counterElement) {
        counterElement.textContent = `(${enabledQuestions})`;
    }
}
