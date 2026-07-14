# PSC FutureU — Setup Guide

Your site is ready in this folder. It's plain HTML/CSS/JS + Firebase — no build tools, no server to maintain. Follow these steps once, in order.

## 1. Turn on Google Sign-In
1. Go to the [Firebase Console](https://console.firebase.google.com/) → your project **pscfutureu**.
2. Left menu → **Build → Authentication** → **Get started** (if you haven't already).
3. Go to the **Sign-in method** tab → click **Google** → toggle **Enable** → set a support email (use `futureuapp@gmail.com`) → **Save**.

## 2. Create the database
1. Left menu → **Build → Firestore Database** → **Create database**.
2. Choose **Production mode** → pick a location close to India (e.g. `asia-south1`) → **Enable**.
3. Go to the **Rules** tab and replace everything with this, then click **Publish**:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAdmin() {
      return request.auth != null && request.auth.token.email == 'futureuapp@gmail.com';
    }
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    match /playlists/{id} {
      allow read: if true;
      allow write: if isAdmin();
    }
    match /pdfs/{id} {
      allow read: if true;
      allow write: if isAdmin();
    }
    match /quizzes/{id} {
      allow read: if request.auth != null;
      allow write: if isAdmin();
    }
    match /mocks/{id} {
      allow read: if request.auth != null;
      allow write: if isAdmin();
    }
    match /results/{id} {
      allow create: if request.auth != null && request.resource.data.uid == request.auth.uid;
      allow read: if request.auth != null && resource.data.uid == request.auth.uid;
      allow update, delete: if false;
    }
  }
}
```

This means: **home / videos / PDFs are public**, **quizzes / mocks need login**, and only `futureuapp@gmail.com` can add or delete content. Students can only ever see their own results.

## 3. Put the site online
Easiest option — **Firebase Hosting** (free, and it's already your project):

1. Install Node.js if you don't have it, then in a terminal:
   ```
   npm install -g firebase-tools
   firebase login
   ```
2. Open a terminal **inside this `psc-app` folder** and run:
   ```
   firebase init hosting
   ```
   - Select **Use an existing project** → choose `pscfutureu`.
   - Public directory: type `.` (a single dot, meaning this folder).
   - Configure as a single-page app: **No**.
   - Don't overwrite `index.html` if asked.
3. Deploy:
   ```
   firebase deploy
   ```
4. You'll get a live URL like `https://pscfutureu.web.app` — that's your site.

Once you have that URL, go back to **Authentication → Settings → Authorized domains** in the Firebase Console and make sure it's listed (Firebase Hosting domains are added automatically).

*(Alternative: you can also drag-and-drop this whole folder onto [Netlify Drop](https://app.netlify.com/drop) for a free instant link — just remember to add that domain under Authorized domains too, or Google Sign-In will fail.)*

## 4. Add your content
1. Visit `yoursite.com/admin.html`.
2. Sign in with **futureuapp@gmail.com** (only this account can get in).
3. Use the sidebar to add **Video Playlists** (paste YouTube links), **Study Notes** (paste a PDF link — a Google Drive "Anyone with the link" share link works great), **Quizzes**, and **Mock Tests**.
4. For quizzes/mocks: tick **Enable negative marking** if you want PSC-style scoring, and set a timer per mock test if you want it timed.
5. Changes appear on the live site immediately — no re-deploying needed.

## 5. Uploading PDFs
The PDF field takes a **link**, not a file upload — this keeps setup simple. Easiest way:
1. Upload your PDF to Google Drive.
2. Right-click → Share → **Anyone with the link** → Copy link.
3. Paste that link into the admin form.

## A note on the Dashboard
The first time a student opens their **Dashboard**, Firestore may show a one-time message in the browser console asking to create an index for the results query — this is normal for any growing app. If a student ever reports the dashboard not loading history, open the browser console on that page yourself, and if there's a link starting with `https://console.firebase.google.com/...create_composite`, click it once and click **Create Index** — it takes about a minute and only needs doing once, ever.

## What's already built (v1)
- Google Sign-in, with a one-time profile form (name, phone, district) — asked only once per student.
- Public: Home, Video Classes (grouped playlists, filter by subject/exam), Study Notes (PDF downloads).
- Login-only: Quizzes, Mock Tests (with optional timer + negative marking, set per test), Dashboard (profile + score history).
- Admin panel: add/delete playlists, PDFs, quizzes, and mock tests. Restricted to `futureuapp@gmail.com`.
- Fully responsive, with a mobile bottom tab bar.

## Roadmap ideas for later
- Edit existing content (currently: add + delete; to change something, delete and re-add).
- Leaderboards per district/exam.
- Bulk-import questions from a spreadsheet.
