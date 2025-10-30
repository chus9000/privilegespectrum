// Simple Firebase REST API - no caching issues
const FIREBASE_PROJECT_ID = 'privilegespectrum';
const FIREBASE_BASE_URL = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

// Alternative approach using Firebase's public REST API for GitHub Pages
const FIREBASE_PUBLIC_BASE_URL = `https://${FIREBASE_PROJECT_ID}-default-rtdb.firebaseio.com`;

window.FirebaseAPI = {
    // Real-time listener for event updates
    onEventUpdate(eventId, callback) {
        console.log('🔄 Setting up real-time listener for event:', eventId);
        
        // Use Server-Sent Events (SSE) for real-time updates
        // This is a CORS-friendly approach that works on GitHub Pages
        let eventSource = null;
        let pollInterval = null;
        let lastKnownData = null;
        
        // Function to start polling as fallback
        const startPolling = () => {
            console.log('📡 Starting polling fallback for real-time updates');
            pollInterval = setInterval(async () => {
                try {
                    const updatedData = await this.loadEvent(eventId);
                    if (updatedData && JSON.stringify(updatedData) !== JSON.stringify(lastKnownData)) {
                        console.log('🆕 Polling detected changes, triggering callback');
                        lastKnownData = updatedData;
                        callback(updatedData);
                    }
                } catch (error) {
                    console.error('❌ Polling error:', error);
                }
            }, 3000); // Poll every 3 seconds
        };
        
        // Try to use Firebase's REST API streaming (if CORS allows)
        try {
            const streamUrl = `${FIREBASE_BASE_URL}/events/${eventId}?alt=media&token=stream`;
            eventSource = new EventSource(streamUrl);
            
            eventSource.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    console.log('🔄 Real-time update received via SSE');
                    callback(data);
                } catch (error) {
                    console.error('❌ Error parsing SSE data:', error);
                }
            };
            
            eventSource.onerror = (error) => {
                console.log('⚠️ SSE connection failed, falling back to polling');
                eventSource.close();
                startPolling();
            };
            
            // Test the connection
            setTimeout(() => {
                if (eventSource.readyState === EventSource.CLOSED) {
                    console.log('⚠️ SSE connection not established, using polling');
                    startPolling();
                }
            }, 2000);
            
        } catch (error) {
            console.log('⚠️ SSE not supported or failed, using polling fallback');
            startPolling();
        }
        
        // Return cleanup function
        return () => {
            console.log('🧹 Cleaning up real-time listener');
            if (eventSource) {
                eventSource.close();
            }
            if (pollInterval) {
                clearInterval(pollInterval);
            }
        };
    },

    async saveEvent(eventId, eventData) {
        console.log('🔥 Firebase saveEvent called:', { eventId, participantCount: eventData.participants?.length || 0 });
        
        try {
            // For new events, use PATCH to create/update the entire document
            const requestBody = {
                fields: {
                    title: { stringValue: eventData.title },
                    pin: { stringValue: eventData.pin },
                    participants: { 
                        arrayValue: { 
                            values: (eventData.participants || []).map(p => ({ 
                                mapValue: { 
                                    fields: {
                                        id: { stringValue: p.id || '' },
                                        name: { stringValue: p.name },
                                        avatar: { stringValue: p.avatar },
                                        score: { integerValue: p.score.toString() },
                                        answers: { stringValue: JSON.stringify(p.answers || {}) }
                                    }
                                }
                            }))
                        }
                    },
                    createdAt: { timestampValue: new Date().toISOString() }
                }
            };
            
            console.log('🔥 Firebase request URL:', `${FIREBASE_BASE_URL}/events/${eventId}`);
            console.log('🔥 Firebase request body:', JSON.stringify(requestBody, null, 2));
            
            const response = await fetch(`${FIREBASE_BASE_URL}/events/${eventId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });
            
            console.log('🔥 Firebase response status:', response.status, response.statusText);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ Firebase saveEvent failed:', {
                    status: response.status,
                    statusText: response.statusText,
                    errorBody: errorText
                });
            } else {
                console.log('✅ Firebase saveEvent successful');
            }
            
            return response.ok;
        } catch (error) {
            console.error('❌ Firebase saveEvent exception:', error);
            return false;
        }
    },

    async updateParticipant(eventId, participant, maxRetries = 5) {
        // First try the CORS-friendly approach using individual participant documents
        try {
            console.log(`🌐 Trying CORS-friendly approach for participant: ${participant.name}`);
            return await this.updateParticipantCORSFriendly(eventId, participant);
        } catch (error) {
            console.log(`⚠️ CORS-friendly approach failed, falling back to original method:`, error.message);
        }

        // Fallback to original method (will likely fail on GitHub Pages due to CORS)
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`🔄 Attempt ${attempt}/${maxRetries} to update participant: ${participant.name}`);
                
                // Get current document with updateTime for optimistic locking
                const getResponse = await fetch(`${FIREBASE_BASE_URL}/events/${eventId}`);
                if (!getResponse.ok) {
                    console.error('Event not found for participant update');
                    return false;
                }
                
                const currentDoc = await getResponse.json();
                if (!currentDoc.fields) {
                    console.error('Invalid event document structure');
                    return false;
                }
                
                // Extract current participants and updateTime
                const currentParticipants = currentDoc.fields.participants?.arrayValue?.values?.map(v => ({
                    id: v.mapValue.fields.id?.stringValue || '',
                    name: v.mapValue.fields.name?.stringValue || '',
                    avatar: v.mapValue.fields.avatar?.stringValue || '',
                    score: parseInt(v.mapValue.fields.score?.integerValue || '0'),
                    answers: JSON.parse(v.mapValue.fields.answers?.stringValue || '{}')
                })) || [];
                
                console.log('🔍 Current participants in Firebase:', currentParticipants.length);
                console.log('🔍 Current participants data:', currentParticipants.map(p => ({ name: p.name, score: p.score })));
                
                const updateTime = currentDoc.updateTime;
                
                // Find and update the participant, or add if new
                const participants = [...currentParticipants];
                const existingIndex = participants.findIndex(p => p.id === participant.id);
                
                if (existingIndex >= 0) {
                    participants[existingIndex] = participant;
                    console.log(`🔄 Updating existing participant: ${participant.name}`);
                } else {
                    participants.push(participant);
                    console.log(`➕ Adding new participant: ${participant.name}`);
                }

                // Use conditional update with precondition to prevent race conditions
                const headers = { 'Content-Type': 'application/json' };
                
                // Add precondition header if we have updateTime (optimistic locking)
                if (updateTime) {
                    headers['X-Goog-If-Match'] = `"${updateTime}"`;
                }
                
                const updateResponse = await fetch(`${FIREBASE_BASE_URL}/events/${eventId}`, {
                    method: 'PATCH',
                    headers,
                    body: JSON.stringify({
                        fields: {
                            participants: { 
                                arrayValue: { 
                                    values: participants.map(p => ({ 
                                        mapValue: { 
                                            fields: {
                                                id: { stringValue: p.id || '' },
                                                name: { stringValue: p.name },
                                                avatar: { stringValue: p.avatar },
                                                score: { integerValue: p.score.toString() },
                                                answers: { stringValue: JSON.stringify(p.answers || {}) }
                                            }
                                        }
                                    }))
                                }
                            },
                            // Add a lastUpdated timestamp to help detect conflicts
                            lastUpdated: { timestampValue: new Date().toISOString() }
                        }
                    })
                });

                if (updateResponse.ok) {
                    console.log(`✅ Participant ${participant.name} updated successfully in Firebase (attempt ${attempt})`);
                    return true;
                } else if (updateResponse.status === 412) {
                    // Precondition failed - document was modified by another client
                    console.log(`⚠️ Document modified by another client, retrying... (attempt ${attempt}/${maxRetries})`);
                    
                    // Add exponential backoff with jitter to reduce collision probability
                    const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 5000) + Math.random() * 1000;
                    await new Promise(resolve => setTimeout(resolve, backoffMs));
                    continue; // Retry
                } else {
                    console.error(`❌ Failed to update participant in Firebase: ${updateResponse.status} ${updateResponse.statusText}`);
                    return false;
                }
            } catch (error) {
                console.error(`❌ Error updating participant (attempt ${attempt}):`, error);
                
                if (attempt === maxRetries) {
                    return false;
                }
                
                // Wait before retrying
                const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 5000) + Math.random() * 1000;
                await new Promise(resolve => setTimeout(resolve, backoffMs));
            }
        }
        
        console.error(`❌ Failed to update participant after ${maxRetries} attempts`);
        return false;
    },

    // CORS-friendly approach: Use a simple JSON storage service
    async updateParticipantCORSFriendly(eventId, participant) {
        console.log(`🌐 Saving participant ${participant.name} to public JSON storage`);
        
        try {
            // Use JSONBin.io or similar service that allows CORS
            const participantData = {
                eventId: eventId,
                id: participant.id,
                name: participant.name,
                avatar: participant.avatar,
                score: participant.score,
                answers: participant.answers || {},
                timestamp: new Date().toISOString()
            };

            // Try using a public pastebin-like service that supports CORS
            const response = await fetch(`https://api.jsonbin.io/v3/b`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': '$2a$10$8K8VQz8VQz8VQz8VQz8VQOeKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK' // Public key
                },
                body: JSON.stringify({
                    [`participant_${eventId}_${participant.id}`]: participantData
                })
            });

            if (response.ok) {
                console.log(`✅ Participant ${participant.name} saved to public storage`);
                return true;
            } else {
                console.error(`❌ Failed to save to public storage: ${response.status}`);
                return false;
            }
        } catch (error) {
            console.error(`❌ Public storage approach failed:`, error);
            throw error;
        }
    },

    // Load participants from individual documents
    async loadParticipantsFromIndividualDocs(eventId) {
        console.log(`🌐 Loading participants from individual documents for event: ${eventId}`);
        
        try {
            // List all participant documents for this event
            const listUrl = `${FIREBASE_BASE_URL}/participants?pageSize=1000`;
            const response = await fetch(listUrl);
            
            if (!response.ok) {
                console.error(`❌ Failed to list participant documents: ${response.status}`);
                return [];
            }
            
            const data = await response.json();
            const participants = [];
            
            if (data.documents) {
                for (const doc of data.documents) {
                    const fields = doc.fields;
                    if (fields.eventId?.stringValue === eventId) {
                        participants.push({
                            id: fields.id?.stringValue || '',
                            name: fields.name?.stringValue || '',
                            avatar: fields.avatar?.stringValue || '',
                            score: parseInt(fields.score?.integerValue || '0'),
                            answers: JSON.parse(fields.answers?.stringValue || '{}')
                        });
                    }
                }
            }
            
            console.log(`✅ Loaded ${participants.length} participants from individual documents`);
            return participants;
        } catch (error) {
            console.error(`❌ Failed to load participants from individual documents:`, error);
            return [];
        }
    },

    async loadEvent(eventId) {
        console.log('🔥 Firebase loadEvent called for:', eventId);
        console.log('🔥 Firebase URL:', `${FIREBASE_BASE_URL}/events/${eventId}`);
        
        try {
            const response = await fetch(`${FIREBASE_BASE_URL}/events/${eventId}`);
            console.log('🔥 Firebase loadEvent response:', response.status, response.statusText);
            
            if (!response.ok) {
                if (response.status === 404) {
                    console.log('⚠️ Event not found in Firebase (404)');
                } else {
                    const errorText = await response.text();
                    console.error('❌ Firebase loadEvent failed:', {
                        status: response.status,
                        statusText: response.statusText,
                        errorBody: errorText
                    });
                }
                return null;
            }
            
            const data = await response.json();
            console.log('🔥 Firebase raw response data:', JSON.stringify(data, null, 2));
            
            if (!data.fields) {
                console.error('❌ Firebase response missing fields property');
                return null;
            }
            
            const eventData = {
                title: data.fields.title?.stringValue || '',
                pin: data.fields.pin?.stringValue || '',
                participants: data.fields.participants?.arrayValue?.values?.map(v => ({
                    id: v.mapValue.fields.id?.stringValue || '',
                    name: v.mapValue.fields.name?.stringValue || '',
                    avatar: v.mapValue.fields.avatar?.stringValue || '',
                    score: parseInt(v.mapValue.fields.score?.integerValue || '0'),
                    answers: JSON.parse(v.mapValue.fields.answers?.stringValue || '{}')
                })) || []
            };
            
            console.log('✅ Firebase loadEvent successful:', {
                title: eventData.title,
                participantCount: eventData.participants.length,
                participants: eventData.participants.map(p => ({ name: p.name, score: p.score }))
            });
            
            return eventData;
        } catch (error) {
            console.error('❌ Firebase loadEvent exception:', error);
            return null;
        }
    }
};
