// db.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, onValue, set, remove, push, get, update } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyCEEqEALOCaQo5oSoR8A_Jh9eSpHS8Sz5o",
    authDomain: "game1-bb93e.firebaseapp.com",
    databaseURL: "https://game1-bb93e-default-rtdb.firebaseio.com",
    projectId: "game1-bb93e"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// ===== الاستماع للأحداث (Realtime Listeners) =====
export function listenTablesA(cb) { onValue(ref(db, 'tablesA'), s => cb(s.val() || {})); }
export function listenTablesB(cb) { onValue(ref(db, 'tablesB'), s => cb(s.val() || {})); }
export function listenTablesC(cb) { onValue(ref(db, 'tablesC'), s => cb(s.val() || {})); }
export function listenMsgA(cb) { onValue(ref(db, 'msgA'), s => cb(s.val() || {})); }
export function listenReadCounters(cb) { onValue(ref(db, 'read_counters'), s => cb(s.val() || {})); }
export function listenArchiveOrders(cb) { onValue(ref(db, 'tablesD/archive_orders'), s => cb(s.val() || {})); }
export function listenDirectOrders(cb) { onValue(ref(db, 'tablesD/direct_orders'), s => cb(s.val() || {})); }
export function listenSessions(cb) { onValue(ref(db, 'active_sessions'), s => cb(s.val() || {})); }
export function listenRouting(cb) { onValue(ref(db, 'buttons_routing'), s => cb(s.exists() ? s.val() : null)); }
export function listenPrinters(cb) { onValue(ref(db, 'printers_config'), s => cb(s.val() || {})); }
export function listenSettings(cb) { onValue(ref(db, 'app_settings'), s => cb(s.exists() ? s.val() : null)); }
export function listenUsers(cb) { onValue(ref(db, 'users'), s => cb(s.val() || {})); }
export function listenVersions(cb) { onValue(ref(db, 'cobes'), s => cb(s.val() || {})); }
export function listenOrders(cb) { onValue(ref(db, 'orders'), s => cb(s.val() || {})); }
export function listenCaptainChat(user, cb) { onValue(ref(db, 'captain_chats/' + user), s => cb(s.val() || {})); }
export function listenTableChat(tableKey, cb) { 
    onValue(ref(db, 'msgA/' + tableKey), sA => { 
        onValue(ref(db, 'msgB/' + tableKey), sB => cb(sA.val() || {}, sB.val() || {})); 
    }); 
}

// ===== الكتابة والحذف والتحديث =====
export function setData(path, data) { return set(ref(db, path), data); }
export function removeData(path) { return remove(ref(db, path)); }
export function pushData(path, data) { return push(ref(db, path), data); }
export function updateData(path, data) { return update(ref(db, path), data); }

// ===== الجلب لمرة واحدة (Get) =====
export function getData(path) { return get(ref(db, path)); }
export function getSessions() { return get(ref(db, 'active_sessions')); }
export function getVersions() { return get(ref(db, 'cobes')); }
export function getUsers() { return get(ref(db, 'users')); }
export function getSettings() { return get(ref(db, 'app_settings')); }
export function getRouting() { return get(ref(db, 'buttons_routing')); }
export function getCaptainMessages(user) { return get(ref(db, 'captain_chats/' + user)); }