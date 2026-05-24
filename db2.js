// db2.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, set, push, onValue, remove, update, get } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyCEEqEALOCaQo5oSoR8A_Jh9eSpHS8Sz5o",
    authDomain: "game1-bb93e.firebaseapp.com",
    databaseURL: "https://game1-bb93e-default-rtdb.firebaseio.com",
    projectId: "game1-bb93e"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// تصدير الدوال الأساسية فقط - نسخة مبسطة للمشروع الحالي
export { db, ref, set, push, onValue, remove, update, get };