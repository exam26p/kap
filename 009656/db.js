// db.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, onValue, set, remove, push, get, update, onChildAdded } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyCEEqEALOCaQo5oSoR8A_Jh9eSpHS8Sz5o",
    authDomain: "game1-bb93e.firebaseapp.com",
    // ⚠️ تنبيه: تأكد من أن هذا الرابط صحيح من لوحة تحكم Firebase (Realtime Database)
    databaseURL: "https://game1-bb93e-default-rtdb.firebaseio.com",
    projectId: "game1-bb93e",
    storageBucket: "game1-bb93e.firebasestorage.app",
    messagingSenderId: "268851425259",
    appId: "1:268851425259:web:0074f52657190d7347b3ae"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// ===== المستمعين الأساسيين (لجميع الأجهزة) =====
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

export function listenTableChat(tableKey, cb) { 
    onValue(ref(db, 'msgA/' + tableKey), sA => { 
        onValue(ref(db, 'msgB/' + tableKey), sB => cb(sA.val() || {}, sB.val() || {})); 
    }); 
}

// ===== مستمع أوامر الطباعة (للكمبيوتر فقط - للأوامر الجديدة فقط) =====
export function listenNewPrintCommands(cb) {
    const printRef = ref(db, 'print_commands');
    
    onChildAdded(printRef, (snapshot) => {
        const command = snapshot.val();
        if (command && !command.processed) {
            cb({ id: snapshot.key, ...command });
        }
    });
}

// ===== دوال إرسال أوامر الطباعة (لجميع الأجهزة - التاب يرسل، الكمبيوتر يستمع) =====
export function sendPrintCommand(type, data) {
    return push(ref(db, 'print_commands'), {
        type: type,
        data: data,
        timestamp: new Date().toISOString(),
        processed: false
    });
}

// ===== تحديث حالة أمر الطباعة =====
export function markPrintCommandProcessed(commandId) {
    return update(ref(db, 'print_commands/' + commandId), { 
        processed: true, 
        processedAt: new Date().toISOString() 
    });
}

// ===== دوال الكتابة العادية (لجميع الأجهزة - تزامن بيانات) =====
export function setData(path, data) { return set(ref(db, path), data); }
export function removeData(path) { return remove(ref(db, path)); }
export function pushData(path, data) { return push(ref(db, path), data); }
export function updateData(path, data) { return update(ref(db, path), data); }

// ===== الجلب لمرة واحدة =====
export function getData(path) { return get(ref(db, path)); }
export function getSessions() { return get(ref(db, 'active_sessions')); }
export function getVersions() { return get(ref(db, 'cobes')); }
export function getUsers() { return get(ref(db, 'users')); }
export function getSettings() { return get(ref(db, 'app_settings')); }
export function getRouting() { return get(ref(db, 'buttons_routing')); }
