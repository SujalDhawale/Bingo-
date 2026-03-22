# 🚀 Multiplayer Bingo (Firebase Edition)

This version of Bingo uses **Firebase Realtime Database** for multiplayer synchronization and chat. Unlike the previous version, this **works on Netlify, Vercel, or any hosting platform** because it doesn't need a Node.js server!

## 🛠️ Step 1: Set up Firebase (Free)

1. Go to the [Firebase Console](https://console.firebase.google.com/).
2. Click **Add Project** and give it a name (e.g., "Multiplayer Bingo").
3. Once the project is created, click the **Web icon (</>)** to add a web app.
4. Give the app a nickname and click **Register App**.
5. Copy the `firebaseConfig` object they show you. It looks like this:
   ```javascript
   const firebaseConfig = {
     apiKey: "...",
     authDomain: "...",
     databaseURL: "https://your-project-id.firebaseio.com/",
     projectId: "...",
     storageBucket: "...",
     messagingSenderId: "...",
     appId: "..."
   };
   ```
6. **Enable the Database**:
   - In the left sidebar, click **Build** -> **Realtime Database**.
   - Click **Create Database**.
   - Pick a location and click Next.
   - Start in **Test Mode** (so you don't need authentication for now) and click **Enable**.

## 📝 Step 2: Update the Code

1. Open `public/script.js`.
2. Find the `const firebaseConfig` section (near line 5).
3. Paste your config there.

## 🚢 Step 3: Deploy Anywhere!

Since this is now a "Static" site, you can simply:
- Drag the `public` folder into **Netlify Drop**.
- Or link your **GitHub repo** to Netlify/Vercel.

**It will just work!** Player 1 creates a game, shares the link, and Player 2 joins instantly with live chat enabled!
