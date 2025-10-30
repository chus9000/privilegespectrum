// Simple Firebase REST API - no caching issues
const FIREBASE_PROJECT_ID = 'privilegespectrum';
const FIREBASE_BASE_URL = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

window.FirebaseAPI = {
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
