const urlParams = new URLSearchParams(window.location.search);
const eventId = urlParams.get('id');
const eventData = JSON.parse(localStorage.getItem(`event_${eventId}`));

if (!eventData) {
    document.body.innerHTML = '<div class="container"><div class="card"><h1>Event not found</h1></div></div>';
} else {
    loadResults();
}

function loadResults() {
    document.getElementById('eventTitle').textContent = eventData.title + ' - Results';

    
    const resultsContainer = document.getElementById('participantsResults');
    resultsContainer.innerHTML = '';
    
    eventData.participants.forEach(participant => {
        const resultDiv = document.createElement('div');
        resultDiv.className = 'participant-result';
        
        const scorePercentage = ((participant.score + 25) / 50) * 100;
        
        resultDiv.innerHTML = `
            <div class="score-track">
                <div class="participant-avatar" style="left: ${scorePercentage}%">
                    ${participant.avatar}
                </div>
                <div class="participant-name-label" style="left: ${scorePercentage}%">
                    ${participant.name} (${participant.score > 0 ? '+' : ''}${participant.score})
                </div>
            </div>
        `;
        
        resultsContainer.appendChild(resultDiv);
    });
    

}