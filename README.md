# Today's Privilege Spectrum

A web application for conducting privilege spectrum exercises with real-time results.

## Setup Instructions

### 1. Firebase Setup
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project
3. Enable Firestore Database
4. Set Firestore rules to allow read/write:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /events/{eventId} {
      allow read, write: if true;
    }
  }
}
```
5. Replace `YOUR_PROJECT_ID` in `app.js` and `event.js` with your Firebase project ID

### 2. GitHub Pages Deployment
1. Push code to GitHub repository
2. Go to repository Settings > Pages
3. Select "Deploy from a branch" 
4. Choose "gh-pages" branch
5. Your app will be available at `https://yourusername.github.io/repository-name`

### 3. Custom Domain (Optional)
1. Add CNAME file with your domain
2. Configure DNS to point to GitHub Pages
3. Enable HTTPS in repository settings

## Features
- Create events with unique PINs
- Participant management with persistent sessions
- Real-time results visualization
- Question management (enable/disable)
- Archive of recent events
- Mobile-responsive design

## Usage
1. Create an event on the index page
2. Share the questions URL and PIN with participants
3. Participants answer questions anonymously
4. View results in real-time on the results page