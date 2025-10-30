// Firebase Realtime Database - CORS-friendly for GitHub Pages - v3.1 - CACHE BUST
const FIREBASE_PROJECT_ID = 'privilegespectrum';
const FIREBASE_RTDB_URL = `https://${FIREBASE_PROJECT_ID}-default-rtdb.europe-west1.firebasedatabase.app/`;

console.log('🔥🔥🔥 Firebase Config v3.1 loaded - Using Realtime Database for CORS compatibility 🔥🔥🔥');
console.log('🚀 RTDB URL:', FIREBASE_RTDB_URL);

window.FirebaseAPI = {
    // Real-time listener for event updates using Firebase Realtime Database
    onEventUpdate(eventId, callback) {
        console.log('🔄 Setting up real-time listener for event:', eventId);
        
        let pollInterval = null;
        let lastKnownData = null;
        
        // Use polling with Firebase Realtime Database (CORS-friendly)
        const startPolling = () => {
            console.log('📡 Starting RTDB polling for real-time updates');
            pollInterval = setInterval(async () => {
                try {
                    const updatedData = await this.loadEvent(eventId);
                    if (updatedData && JSON.stringify(updatedData) !== JSON.stringify(lastKnownData)) {
                        console.log('🆕 RTDB polling detected changes, triggering callback');
                        lastKnownData = updatedData;
                        callback(updatedData);
                    }
                } catch (error) {
                    console.error('❌ RTDB polling error:', error);
                }
            }, 2000); // Poll every 2 seconds for better responsiveness
        };
        
        // Start polling immediately
        startPolling();
        
        // Return cleanup function
        return () => {
            console.log('🧹 Cleaning up real-time listener');
            if (pollInterval) {
                clearInterval(pollInterval);
            }
        };
    },

    async saveEvent(eventId, eventData) {
        console.log('🔥 Firebase RTDB saveEvent called:', { eventId, participantCount: eventData.participants?.length || 0 });
        
        try {
            // Use Firebase Realtime Database REST API (CORS-friendly)
            const url = `${FIREBASE_RTDB_URL}/events/${eventId}.json`;
            const requestBody = {
                title: eventData.title,
                pin: eventData.pin,
                participants: eventData.participants || [],
                createdAt: new Date().toISOString()
            };
            
            console.log('🔥 Firebase RTDB request URL:', url);
            console.log('🔥 Firebase RTDB request body:', JSON.stringify(requestBody, null, 2));
            
            const response = await fetch(url, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });
            
            console.log('🔥 Firebase RTDB response status:', response.status, response.statusText);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ Firebase RTDB saveEvent failed:', {
                    status: response.status,
                    statusText: response.statusText,
                    errorBody: errorText
                });
            } else {
                console.log('✅ Firebase RTDB saveEvent successful');
            }
            
            return response.ok;
        } catch (error) {
            console.error('❌ Firebase RTDB saveEvent exception:', error);
            return false;
        }
    },

    async updateParticipant(eventId, participant) {
        console.log(`🔄 RTDB updateParticipant called for: ${participant.name}, Score: ${participant.score}`);
        
        try {
            // First, get current event data
            const currentEvent = await this.loadEvent(eventId);
            if (!currentEvent) {
                console.error('❌ Event not found for participant update');
                return false;
            }
            
            // Find and update the participant, or add if new
            const participants = [...(currentEvent.participants || [])];
            const existingIndex = participants.findIndex(p => p.id === participant.id);
            
            if (existingIndex >= 0) {
                participants[existingIndex] = participant;
                console.log(`🔄 Updating existing participant: ${participant.name}`);
            } else {
                participants.push(participant);
                console.log(`➕ Adding new participant: ${participant.name}`);
            }
            
            // Update the participants array in Firebase RTDB
            const url = `${FIREBASE_RTDB_URL}/events/${eventId}/participants.json`;
            const response = await fetch(url, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(participants)
            });
            
            if (response.ok) {
                console.log(`✅ Participant ${participant.name} updated successfully in Firebase RTDB`);
                return true;
            } else {
                const errorText = await response.text();
                console.error(`❌ Failed to update participant in Firebase RTDB: ${response.status} ${response.statusText}`, errorText);
                return false;
            }
        } catch (error) {
            console.error(`❌ Error updating participant in RTDB:`, error);
            return false;
        }
    },

    // Load participants from individual documents (not needed for RTDB)
    async loadParticipantsFromIndividualDocs(eventId) {
        console.log(`🌐 RTDB doesn't use individual documents, loading from main event`);
        const eventData = await this.loadEvent(eventId);
        return eventData ? eventData.participants || [] : [];
    },

    async loadEvent(eventId) {
        console.log('🔥 Firebase RTDB loadEvent called for:', eventId);
        
        try {
            const url = `${FIREBASE_RTDB_URL}/events/${eventId}.json`;
            console.log('🔥 Firebase RTDB URL:', url);
            
            const response = await fetch(url);
            console.log('🔥 Firebase RTDB loadEvent response:', response.status, response.statusText);
            
            if (!response.ok) {
                if (response.status === 404) {
                    console.log('⚠️ Event not found in Firebase RTDB (404)');
                } else {
                    const errorText = await response.text();
                    console.error('❌ Firebase RTDB loadEvent failed:', {
                        status: response.status,
                        statusText: response.statusText,
                        errorBody: errorText
                    });
                }
                return null;
            }
            
            const data = await response.json();
            console.log('🔥 Firebase RTDB raw response data:', JSON.stringify(data, null, 2));
            
            if (!data) {
                console.log('⚠️ Event not found in Firebase RTDB (null response)');
                return null;
            }
            
            const eventData = {
                title: data.title || '',
                pin: data.pin || '',
                participants: data.participants || []
            };
            
            console.log('✅ Firebase RTDB loadEvent successful:', {
                title: eventData.title,
                participantCount: eventData.participants.length,
                participants: eventData.participants.map(p => ({ name: p.name, score: p.score }))
            });
            
            return eventData;
        } catch (error) {
            console.error('❌ Firebase RTDB loadEvent exception:', error);
            return null;
        }
    }
};
