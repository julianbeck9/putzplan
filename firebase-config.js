// ┌──────────────────────────────────────────────────────────────┐
// │  FIREBASE-SETUP (einmalig, ~5 Min)                           │
// │  Anleitung siehe README oder unten in dieser Datei.          │
// └──────────────────────────────────────────────────────────────┘

const firebaseConfig = {
  apiKey: "PASTE_YOUR_API_KEY_HERE",
  authDomain: "your-project.firebaseapp.com",
  databaseURL: "https://your-project-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:abcdef1234567890"
};

/*
 ─── ANLEITUNG ─────────────────────────────────────────────────────

 1) https://console.firebase.google.com öffnen (mit Google-Login)

 2) "Projekt hinzufügen" → Name "putzplan" → Analytics AUS → erstellen

 3) Web-App registrieren: Auf das </> Icon klicken → App-Nickname
    "putzplan" → "App registrieren" → das gezeigte firebaseConfig-
    Objekt KOMPLETT kopieren und HIER OBEN ersetzen.

 4) Realtime Database aktivieren: Linke Sidebar → Build →
    "Realtime Database" → "Datenbank erstellen" → Region
    "europe-west1" → "Im Testmodus starten" → Aktivieren.

 5) Sicherheitsregeln setzen: Tab "Regeln" → folgendes einfügen
    und veröffentlichen:

    {
      "rules": {
        "rooms": {
          "$roomId": {
            ".read":  "$roomId.length >= 16",
            ".write": "$roomId.length >= 16"
          }
        }
      }
    }

 6) Diese Datei committen + pushen. GitHub Pages deployed automatisch.

 ─── FERTIG ─ live-Sync läuft. ─────────────────────────────────────
*/
