// Simple Firebase REST API - no caching issues
const FIREBASE_PROJECT_ID = 'privilegespectrum';
const FIREBASE_BASE_URL = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

window.FirebaseAPI = {
    async saveEvent(eventId, eventData) {
        const response = await fetch(`${FIREBASE_BASE_URL}/events/${eventId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
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
            })
        });
        return response.ok;
    },

    async loadEvent(eventId) {
        const response = await fetch(`${FIREBASE_BASE_URL}/events/${eventId}`);
        if (!response.ok) return null;
        
        const data = await response.json();
        if (!data.fields) return null;
        
        return {
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
    }
};
