const urlParams = new URLSearchParams(window.location.search);
const eventId = urlParams.get('id');
let eventData;
let participant;

// Load event data from Firebase or localStorage
loadEventData();

async function loadEventData() {
    // Try Firebase first
    try {
        eventData = await window.FirebaseAPI.loadEvent(eventId);
        if (eventData) {
            console.log('✅ Event loaded from Firebase:', eventData.title);
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
            console.log('📁 Event loaded from localStorage:', eventData.title);
        }
    }
    
    if (!eventData) {
        console.log('❌ Event not found for ID:', eventId);
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
        console.log('Entered PIN:', enteredPin, 'Expected:', eventData.pin);
        
        if (enteredPin === eventData.pin.toString()) {
            console.log('PIN correct, loading event...');
            document.getElementById('pinContainer').style.display = 'none';
            document.getElementById('eventContent').style.display = 'block';
            loadEvent();
        } else {
            console.log('PIN incorrect');
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
        
        // Add new participant to event data and save to Firebase
        const existingIndex = eventData.participants.findIndex(p => p.id === participant.id);
        if (existingIndex === -1) {
            eventData.participants.push(participant);
            // Don't call updateParticipant here to avoid async issues during initial load
            localStorage.setItem(`event_${eventId}`, JSON.stringify(eventData));
        }
    } else {
        // For existing participants, ensure they have an ID (backward compatibility)
        if (!participant.id) {
            participant.id = generateUniqueId();
            localStorage.setItem(`participant_${eventId}`, JSON.stringify(participant));
        }
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
    
    // Restore answers after questions are rendered
    restoreAnswers();
    
    // Initialize progress after loading questions
    initializeProgress();
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
    
    updateProgress();
    updateParticipant();
}

function updateProgress() {
    const answered = Object.keys(participant.answers || {}).length;
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
}

function restoreAnswers() {
    // Restore answers and update UI after questions are rendered
    if (participant && participant.answers) {
        Object.keys(participant.answers).forEach(questionIndex => {
            const answer = participant.answers[questionIndex];
            const selectedElement = document.getElementById(`q${questionIndex}_${answer === 1 ? 'yes' : 'no'}`);
            if (selectedElement) {
                selectedElement.classList.add('selected');
            }
        });
    }
}

function initializeProgress() {
    // Initialize progress on page load
    if (participant && participant.answers) {
        updateProgress();
    }
}

async function updateParticipant() {
    console.log('🔄 updateParticipant called for:', participant.name, 'Score:', participant.score);
    console.log('🔄 Current eventData participants:', eventData.participants.length);
    
    // Update local eventData first
    const existingIndex = eventData.participants.findIndex(p => p.id === participant.id);
    if (existingIndex >= 0) {
        console.log('🔄 Updating existing participant at index:', existingIndex);
        eventData.participants[existingIndex] = participant;
    } else {
        console.log('➕ Adding new participant to eventData');
        eventData.participants.push(participant);
    }
    
    console.log('📊 Updated eventData participants count:', eventData.participants.length);
    console.log('📊 All participants:', eventData.participants.map(p => ({ name: p.name, score: p.score })));
    
    // Save to localStorage immediately for offline functionality
    console.log('💾 Saving to localStorage...');
    localStorage.setItem(`event_${eventId}`, JSON.stringify(eventData));
    localStorage.setItem(`participant_${eventId}`, JSON.stringify(participant));
    console.log('✅ Saved to localStorage');
    
    // Use the new updateParticipant method for Firebase to avoid race conditions
    try {
        console.log('🔥 Attempting Firebase update...');
        const success = await window.FirebaseAPI.updateParticipant(eventId, participant);
        if (success) {
            console.log('✅ Participant updated in Firebase using atomic update');
        } else {
            console.error('❌ Firebase participant update failed');
        }
    } catch (error) {
        console.error('❌ Firebase participant update failed:', error);
    }
}

function generateParticipant() {
    const adjectives = ['Happy', 'Clever', 'Brave', 'Gentle', 'Swift', 'Bright', 'Calm', 'Bold', 'Kind', 'Wise'];
    const nouns = ['Tiger', 'Eagle', 'Wolf', 'Bear', 'Fox', 'Lion', 'Owl', 'Deer', 'Hawk', 'Panda'];
    const avatars = ['🐱', '🐶', '🦊', '🐻', '🐼', '🦁', '🐯', '🐸', '🐵', '🦄'];
    
    const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    
    return {
        id: generateUniqueId(),
        name: `${adjective} ${noun}`,
        avatar: avatars[Math.floor(Math.random() * avatars.length)],
        score: 0,
        answers: {}
    };
}

// Counter to prevent same-millisecond collisions
let idCounter = 0;

function generateUniqueId() {
    // Multiple entropy sources for maximum uniqueness
    const timestamp = Date.now().toString(36);
    const performanceTime = performance.now().toString(36).replace('.', '');
    const randomPart1 = Math.random().toString(36).substr(2, 8);
    const randomPart2 = Math.random().toString(36).substr(2, 8);
    const counter = (++idCounter).toString(36);
    
    // Combine all entropy sources
    return `${timestamp}-${performanceTime}-${randomPart1}-${randomPart2}-${counter}`;
}

// Available animal emojis for selection
const availableEmojis = [
    '🐱', '🐶', '🦊', '🐻', '🐼', '🦁', '🐯', '🐸', '🐵', '🦄',
    '🐰', '🐨', '🐷', '🐮', '🐹', '🐭', '🐺', '🦝', '🦔', '🐧',
    '🐥', '🐣', '🐤', '🦆', '🦅', '🦉', '🦜', '🐢', '🐍', '🦎',
    '🐙', '🦑', '🦐', '🦀', '🐠', '🐟', '🐡', '🦈', '🐳', '🐋',
    '🦒', '🐘', '🦏', '🦛', '🐪', '🐫', '🦘', '🦌', '🐄', '🐂',
    '🐎', '🦓', '🐖', '🐏', '🐑', '🐐', '🦙', '🦥', '🐿️', '🦫'
];

// Name editing functionality
function editName() {
    const nameElement = document.getElementById('participantName');
    const nameInput = document.getElementById('nameInput');
    
    nameInput.value = nameElement.textContent;
    nameElement.style.display = 'none';
    nameInput.style.display = 'block';
    nameInput.focus();
    nameInput.select();
}

function saveName() {
    const nameElement = document.getElementById('participantName');
    const nameInput = document.getElementById('nameInput');
    
    const newName = nameInput.value.trim();
    if (newName && newName !== participant.name) {
        participant.name = newName;
        nameElement.textContent = newName;
        updateParticipant();
    }
    
    nameInput.style.display = 'none';
    nameElement.style.display = 'block';
}

function handleNameKeypress(event) {
    if (event.key === 'Enter') {
        saveName();
    } else if (event.key === 'Escape') {
        const nameElement = document.getElementById('participantName');
        const nameInput = document.getElementById('nameInput');
        
        nameInput.style.display = 'none';
        nameElement.style.display = 'block';
    }
}

// Emoji selector functionality
function openEmojiSelector() {
    const modal = document.getElementById('emojiModal');
    const emojiGrid = document.getElementById('emojiGrid');
    
    // Clear existing emojis
    emojiGrid.innerHTML = '';
    
    // Create emoji buttons
    availableEmojis.forEach(emoji => {
        const emojiButton = document.createElement('div');
        emojiButton.className = 'emoji-option';
        emojiButton.textContent = emoji;
        emojiButton.onclick = () => selectEmoji(emoji);
        
        // Highlight current emoji
        if (emoji === participant.avatar) {
            emojiButton.classList.add('selected');
        }
        
        emojiGrid.appendChild(emojiButton);
    });
    
    modal.style.display = 'block';
}

function selectEmoji(emoji) {
    participant.avatar = emoji;
    document.getElementById('participantAvatar').textContent = emoji;
    updateParticipant();
    closeEmojiSelector();
}

function closeEmojiSelector() {
    document.getElementById('emojiModal').style.display = 'none';
}

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('emojiModal');
    if (event.target === modal) {
        closeEmojiSelector();
    }
}
