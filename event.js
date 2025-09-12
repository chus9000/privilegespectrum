const urlParams = new URLSearchParams(window.location.search);
const eventId = urlParams.get('id');
let eventData;
let participant;

// Load event data from Firebase or localStorage
loadEventData();

async function loadEventData() {
    // Try Firebase first
    try {
        const response = await fetch(`https://firestore.googleapis.com/v1/projects/privilegespectrum/databases/(default)/documents/events/${eventId}`);
        if (response.ok) {
            const firebaseData = await response.json();
            console.log('🔍 Firebase raw data:', firebaseData);
            
            if (firebaseData.fields) {
                eventData = {
                    title: firebaseData.fields.title?.stringValue || 'Unknown Event',
                    pin: firebaseData.fields.pin?.stringValue || '000000',
                    participants: firebaseData.fields.participants?.arrayValue?.values?.map(v => JSON.parse(v.stringValue)) || []
                };
                console.log('✅ Event loaded from Firebase:', eventData.title);
            } else {
                console.log('⚠️ Firebase data missing fields structure');
            }
        } else {
            console.log('⚠️ Firebase response not ok:', response.status);
        }
    } catch (error) {
        console.log('⚠️ Firebase load failed, using localStorage:', error.message);
    }
    
    // Fallback to localStorage
    if (!eventData) {
        eventData = JSON.parse(localStorage.getItem(`event_${eventId}`));
        if (eventData) {
            console.log('📁 Event loaded from localStorage:', eventData.title);
        }
    }
    
    if (!eventData) {
        console.log('❌ Event not found in Firebase or localStorage for ID:', eventId);
        document.body.innerHTML = '<div class="container"><div class="card"><h1>Event not found</h1><p>Event ID: ' + eventId + '</p></div></div>';
    } else {
        setupPinEntry();
    }
}

function setupPinEntry() {
    // Display event title on PIN screen
    document.getElementById('eventTitlePin').textContent = eventData.title;
    
    // Check if participant already exists for this event
    const savedParticipant = localStorage.getItem(`participant_${eventId}`);
    if (savedParticipant) {
        participant = JSON.parse(savedParticipant);
        document.getElementById('pinContainer').style.display = 'none';
        document.getElementById('eventContent').style.display = 'block';
        loadEvent();
        return;
    }
    
    document.getElementById('submitPin').addEventListener('click', () => {
        const enteredPin = document.getElementById('pinInput').value.trim();
        if (enteredPin === eventData.pin.toString()) {
            document.getElementById('pinContainer').style.display = 'none';
            document.getElementById('eventContent').style.display = 'block';
            loadEvent();
        } else {
            alert('Invalid PIN. Please try again.');
            document.getElementById('pinInput').value = '';
        }
    });
    
    // Allow Enter key to submit PIN
    document.getElementById('pinInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            document.getElementById('submitPin').click();
        }
    });
}

function loadEvent() {
    document.getElementById('eventTitle').textContent = eventData.title;
    
    // Use existing participant or generate new one
    if (!participant) {
        participant = generateParticipant();
        localStorage.setItem(`participant_${eventId}`, JSON.stringify(participant));
    }
    
    document.getElementById('participantName').textContent = participant.name;
    document.getElementById('participantAvatar').textContent = participant.avatar;
    
    const questionsContainer = document.getElementById('questionsContainer');
    
    // Filter out disabled questions
    const disabledQuestions = JSON.parse(localStorage.getItem('disabledQuestions') || '[]');
    const enabledQuestions = questions.filter((_, index) => !disabledQuestions.includes(index));
    
    enabledQuestions.forEach((question, displayIndex) => {
        const originalIndex = questions.indexOf(question);
        const questionDiv = document.createElement('div');
        questionDiv.className = 'question-block';
        questionDiv.innerHTML = `
            <h4>${displayIndex + 1}. ${question.text}</h4>
            <div class="question-options">
                <div class="question-option" onclick="selectAnswer(${originalIndex}, 1, this)" id="q${originalIndex}_yes">
                    <span>Yes</span>
                </div>
                <div class="question-option" onclick="selectAnswer(${originalIndex}, 0, this)" id="q${originalIndex}_no">
                    <span>No</span>
                </div>
            </div>
        `;
        questionsContainer.appendChild(questionDiv);
    });
    
    // Update progress text with actual enabled question count
    const enabledCount = questions.length - disabledQuestions.length;
    document.getElementById('progressText').textContent = `0/${enabledCount} completed`;
    
    document.getElementById('resultsLink').href = `results.html?id=${eventId}`;
}

function selectAnswer(questionIndex, answer, element) {
    participant.answers = participant.answers || {};
    participant.answers[questionIndex] = answer;
    
    // Update selection state
    document.getElementById(`q${questionIndex}_yes`).classList.remove('selected');
    document.getElementById(`q${questionIndex}_no`).classList.remove('selected');
    element.classList.add('selected');
    
    // Calculate score
    participant.score = 0;
    questions.forEach((question, index) => {
        if (participant.answers[index] === 1) {
            participant.score += question.value;
        }
    });
    
    // Update progress
    const answered = Object.keys(participant.answers).length;
    const disabledQuestions = JSON.parse(localStorage.getItem('disabledQuestions') || '[]');
    const total = questions.length - disabledQuestions.length;
    const percentage = (answered / total) * 100;
    
    document.getElementById('progressFill').style.width = `${percentage}%`;
    document.getElementById('progressText').textContent = `${answered}/${total} completed`;
    
    // Check if all questions answered
    const resultsLink = document.getElementById('resultsLink');
    if (answered === total) {
        resultsLink.classList.remove('disabled');
        resultsLink.style.pointerEvents = 'auto';
    }
    
    updateParticipant();
}

async function updateParticipant() {
    const existingIndex = eventData.participants.findIndex(p => p.name === participant.name);
    if (existingIndex >= 0) {
        eventData.participants[existingIndex] = participant;
    } else {
        eventData.participants.push(participant);
    }
    
    // Save to both Firebase and localStorage
    localStorage.setItem(`event_${eventId}`, JSON.stringify(eventData));
    localStorage.setItem(`participant_${eventId}`, JSON.stringify(participant));
    
    try {
        await fetch(`https://firestore.googleapis.com/v1/projects/privilegespectrum/databases/(default)/documents/events/${eventId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fields: {
                    participants: {
                        arrayValue: {
                            values: eventData.participants.map(p => ({ stringValue: JSON.stringify(p) }))
                        }
                    }
                }
            })
        });
    } catch (error) {
        console.error('Firebase update failed:', error);
    }
}

function generateParticipant() {
    const adjectives = ['Happy', 'Clever', 'Brave', 'Gentle', 'Swift', 'Bright', 'Calm', 'Bold', 'Kind', 'Wise'];
    const nouns = ['Tiger', 'Eagle', 'Wolf', 'Bear', 'Fox', 'Lion', 'Owl', 'Deer', 'Hawk', 'Panda'];
    const avatars = ['🐱', '🐶', '🦊', '🐻', '🐼', '🦁', '🐯', '🐸', '🐵', '🦄'];
    
    const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    
    return {
        name: `${adjective} ${noun}`,
        avatar: avatars[Math.floor(Math.random() * avatars.length)],
        score: 0,
        answers: {}
    };
}
