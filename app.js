let currentEventUrl = '';
let currentEventPin = '';

document.addEventListener('DOMContentLoaded', loadArchive);

document.getElementById('eventForm').addEventListener('submit', (e) => {
    e.preventDefault();
    
    const title = document.getElementById('eventTitle').value;
    const eventId = generateId();
    const eventPin = generatePin();
    const eventData = { title, pin: eventPin, participants: [] };
    
    // Save to Firebase and localStorage as backup
    saveEventToFirebase(eventId, eventData);
    localStorage.setItem(`event_${eventId}`, JSON.stringify(eventData));
    
    // Add to archive
    addToArchive({ id: eventId, title, pin: eventPin, url: `${window.location.origin}${window.location.pathname.replace('index.html', '')}questions.html?id=${eventId}` });
    
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

document.getElementById('closeModal').addEventListener('click', () => {
    document.getElementById('questionsModal').style.display = 'none';
});

window.addEventListener('click', (e) => {
    const modal = document.getElementById('questionsModal');
    if (e.target === modal) {
        modal.style.display = 'none';
    }
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
        const response = await fetch('https://firestore.googleapis.com/v1/projects/privilegespectrum/databases/(default)/documents/events/' + eventId, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                fields: {
                    title: { stringValue: eventData.title },
                    pin: { stringValue: eventData.pin },
                    participants: { arrayValue: { values: [] } },
                    createdAt: { timestampValue: new Date().toISOString() }
                }
            })
        });
        
        if (response.ok) {
            console.log('✅ Event saved to Firebase successfully');
        } else {
            const errorText = await response.text();
            console.error('❌ Firebase save failed:', errorText);
        }
    } catch (error) {
        console.error('❌ Firebase save network error:', error);
    }
}

function addToArchive(event) {
    let archive = JSON.parse(localStorage.getItem('eventArchive') || '[]');
    archive.unshift(event);
    archive = archive.slice(0, 5);
    localStorage.setItem('eventArchive', JSON.stringify(archive));
    loadArchive();
showCookieBanner();
}

function loadArchive() {
    const archive = JSON.parse(localStorage.getItem('eventArchive') || '[]');
    const archiveContainer = document.getElementById('eventArchive');
    const archiveSection = document.getElementById('archiveSection');
    
    if (archive.length > 0) {
        archiveSection.style.display = 'block';
        archiveContainer.innerHTML = archive.map(event => {
            // Update old event.html URLs to questions.html
            const updatedUrl = event.url.replace('event.html', 'questions.html');
            return `
                <div class="archive-item">
                    <div class="archive-title">${event.title}</div>
                    <div class="archive-details">
                        <span class="archive-pin">PIN: ${event.pin}</span>
                        <a href="${updatedUrl}" class="archive-link" target="_blank">Open Event</a>
                    </div>
                </div>
            `;
        }).join('');
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
