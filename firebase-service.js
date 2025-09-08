import { db } from './firebase-config.js';
import { doc, setDoc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';

// Save event to Firebase
export async function saveEvent(eventId, eventData) {
    try {
        await setDoc(doc(db, 'events', eventId), eventData);
        return true;
    } catch (error) {
        console.error('Error saving event:', error);
        return false;
    }
}

// Get event from Firebase
export async function getEvent(eventId) {
    try {
        const docRef = doc(db, 'events', eventId);
        const docSnap = await getDoc(docRef);
        return docSnap.exists() ? docSnap.data() : null;
    } catch (error) {
        console.error('Error getting event:', error);
        return null;
    }
}

// Add participant to event
export async function addParticipant(eventId, participant) {
    try {
        const eventRef = doc(db, 'events', eventId);
        await updateDoc(eventRef, {
            participants: arrayUnion(participant)
        });
        return true;
    } catch (error) {
        console.error('Error adding participant:', error);
        return false;
    }
}

// Update participant in event
export async function updateParticipant(eventId, participant) {
    try {
        const eventDoc = await getEvent(eventId);
        if (!eventDoc) return false;
        
        const participants = eventDoc.participants || [];
        const existingIndex = participants.findIndex(p => p.name === participant.name);
        
        if (existingIndex >= 0) {
            participants[existingIndex] = participant;
        } else {
            participants.push(participant);
        }
        
        const eventRef = doc(db, 'events', eventId);
        await updateDoc(eventRef, { participants });
        return true;
    } catch (error) {
        console.error('Error updating participant:', error);
        return false;
    }
}