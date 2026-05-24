// menu2.js
import { db, ref, set, push, onValue, remove, update, get } from './db2.js';
import { fmt, toast, haversine } from './utils2.js';
import { state } from './state2.js';

/* منع التحديد والضغط المستمر */
document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('gesturestart', e => e.preventDefault());

let TBL = "", VER = "", zone = null, watchID = null, restName = "", restLogo = "";
let orders = {}, menuOk = false, chatOn = false, unreadN = 0;
let curLat = null, curLon = null, curDist = null, isInZone = false;
let prevMsgCount = 0;
const menuLookup = {};
const CIRC = 2 * Math.PI * 42;

// متغير لتخزين بيانات المنيو المحملة مسبقاً
let preloadedMenuData = null;
let isMenuPreloaded = false;
let splashTimeout = null;

/* تحديث حالة التطبيق */
function updateAppState() {
    state.activeTable = TBL;
    state.myVersion = VER;
    state.settings.restaurantName = restName;
    state.settings.restaurantLogo = restLogo;
    state.isMenuLoaded = menuOk;
    state.isGeoVerified = isInZone;
}

/* الصوت */
var aC = new (window.AudioContext || window.webkitAudioContext)();
var lClk = 0;

function cSnd() {
    var n = Date.now();
    if (n - lClk < 80) return;
    lClk = n;
    try {
        if (aC.state === "suspended") aC.resume();
        var o = aC.createOscillator(),
            g = aC.createGain();
        o.connect(g);
        g.connect(aC.destination);
        o.type = "sine";
        o.frequency.setValueAtTime(600 + Math.random() * 400, aC.currentTime);
        g.gain.setValueAtTime(0.015, aC.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, aC.currentTime + 0.05);
        o.start(aC.currentTime);
        o.stop(aC.currentTime + 0.05);
    } catch (e) {}
}

function addSnd(el) {
    if (el) el.addEventListener("click", cSnd, { passive: true });
}

function msgSnd() {
    try {
        if (aC.state === "suspended") aC.resume();
        var now = aC.currentTime;
        [0, 0.15, 0.3].forEach(function(d, i) {
            var o = aC.createOscillator(),
                g = aC.createGain();
            o.connect(g);
            g.connect(aC.destination);
            o.type = "sine";
            o.frequency.setValueAtTime([660, 880, 1100][i], now + d);
            g.gain.setValueAtTime(0.06, now + d);
            g.gain.exponentialRampToValueAtTime(0.001, now + d + 0.12);
            o.start(now + d);
            o.stop(now + d + 0.12);
        });
    } catch (e) {}
}

/* ========== تحميل المنيو مسبقاً (Preloading) ========== */
async function preloadMenu() {
    console.log("بدء تحميل المنيو في الخلفية...");
    return new Promise((resolve) => {
        onValue(ref(db, "orders"), function(snap) {
            preloadedMenuData = snap.val();
            isMenuPreloaded = true;
            console.log("تم تحميل المنيو مسبقاً بنجاح");
            resolve(preloadedMenuData);
        }, {
            onlyOnce: true
        });
    });
}

/* تحميل المنيو من البيانات المخزنة (سريع جداً) */
function renderMenuFromPreloadedData() {
    var data = preloadedMenuData;
    var c = document.getElementById("menuCats");
    if (!c) return;
    c.innerHTML = "";
    
    for (var key in menuLookup) delete menuLookup[key];
    
    if (!data) {
        c.innerHTML = '<p style="color:var(--text-muted);padding:30px;text-align:center;font-size:13px;">المنيو فارغ حالياً.</p>';
        return;
    }
    
    var catIndex = 0;
    for (var catId in data) {
        catIndex++;
        var cat = data[catId];
        var items = cat.items || {};
        var cnt = Object.keys(items).length;
        var itemHTML = "";
        
        for (var itemId in items) {
            var it = items[itemId];
            menuLookup[catId + "_" + itemId] = { name: it.name, price: it.price };
            var detId = "det_" + catId + "_" + itemId;
            var details = it.details || "";
            var hasDetails = details && details.trim().length > 0;
            var imgSrc = it.image || "";

            itemHTML += '<div class="item-card">' +
                '<div class="item-img-container" onclick="window.openImage(\'' + imgSrc + '\')">' +
                (imgSrc ? '<img src="' + imgSrc + '" alt="" loading="' + (catIndex <= 1 ? 'eager' : 'lazy') + '" onerror="this.style.opacity=0">' : '') +
                '<div class="item-overlay">' +
                '<div class="item-name">' + it.name + '</div>' +
                '<div class="item-meta">' +
                '<span class="item-price">' + fmt(it.price) + ' د.ع</span>' +
                '</div>' +
                '</div>' +
                '</div>' +
                (hasDetails ? '<div class="item-det-wrap" id="' + detId + '"><div class="item-det-inner"><div class="item-det-text">' + details + '</div></div></div>' : '') +
                '<div class="item-actions-bar">' +
                (hasDetails ? '<button class="det-btn" data-target="' + detId + '"><i class="fas fa-info-circle"></i> التفاصيل</button>' : '<div></div>') +
                '<button class="ba" data-c="' + catId + '" data-i="' + itemId + '"><i class="fas fa-plus"></i> طلب</button>' +
                '</div>' +
                '</div>';
        }
        
        var catImg = cat.image || "";
        var hasImg = catImg && catImg.length > 10;
        var acc = document.createElement("div");
        acc.className = "cat-acc";
        var imgPart = hasImg ? '<img src="' + catImg + '" alt="" loading="eager" style="opacity:0;transition:opacity .4s" onload="this.style.opacity=1">' : '<div class="cat-hd-fallback">🍽</div>';
        acc.innerHTML = '<div class="cat-hd">' + imgPart + '<div class="cat-hd-content"><div class="cat-hi"><h3>' + cat.name + '</h3><span class="cc">' + cnt + ' صنف</span></div><i class="fas fa-chevron-down cat-arr"></i></div></div><div class="cat-bd">' + itemHTML + '</div>';
        c.appendChild(acc);
    }

    // ربط الأحداث بعد الإنشاء
    c.querySelectorAll(".ba").forEach(function(btn) {
        addSnd(btn);
        btn.addEventListener("click", function() {
            var cId = this.getAttribute("data-c"),
                iId = this.getAttribute("data-i");
            var item = menuLookup[cId + "_" + iId];
            if (item) addIt(cId, iId, item.name, item.price);
        });
    });
    
    c.querySelectorAll(".det-btn").forEach(function(btn) {
        addSnd(btn);
        btn.addEventListener("click", function() {
            var target = document.getElementById(this.getAttribute("data-target"));
            if (target) {
                var isOpen = target.classList.toggle("open");
                this.classList.toggle("active", isOpen);
                this.innerHTML = isOpen ? '<i class="fas fa-chevron-up"></i> إغلاق' : '<i class="fas fa-info-circle"></i> التفاصيل';
            }
        });
    });
    
    c.querySelectorAll(".cat-hd").forEach(function(hd) {
        addSnd(hd);
        hd.addEventListener("click", function() {
            var wasOpen = hd.parentElement.classList.contains("open");
            document.querySelectorAll(".cat-acc.open").forEach(function(a) { a.classList.remove("open"); });
            if (!wasOpen) hd.parentElement.classList.add("open");
        });
    });
}

/* تحميل إعدادات التطبيق */
async function loadAppSettings() {
    try {
        var snap = await get(ref(db, "app_settings"));
        var data = snap.val();
        if (!data) return;
        if (data.restaurantName && data.restaurantName.trim()) {
            restName = data.restaurantName.trim();
            document.title = restName;
            document.getElementById("splashTitle").textContent = restName;
            state.settings.restaurantName = restName;
        }
        if (data.restaurantLogo && data.restaurantLogo.length > 20) {
            restLogo = data.restaurantLogo;
            var splashLogo = document.getElementById("splashLogo");
            if (splashLogo) {
                splashLogo.innerHTML = '<img src="' + restLogo + '" onerror="this.parentNode.innerHTML=\'🍽\'" alt="">';
            }
            var fav = document.querySelector('link[rel="icon"]');
            if (fav) fav.href = restLogo;
            state.settings.restaurantLogo = restLogo;
        }
    } catch (e) {}
}

function updateHeader() {
    var h = document.getElementById("headerTitle");
    if (restLogo && restLogo.length > 20) {
        h.innerHTML = '<img src="' + restLogo + '" alt="" onerror="this.style.display=\'none\'"> ' + restName;
    } else {
        h.textContent = restName || 'المنيو الرقمي';
    }
}

/* ========== شاشة البداية ========== */
var progBar = document.getElementById("progBar");
var progPct = document.getElementById("progPct");
var progVal = 0;
var progInterval;
var preloadComplete = false;

function updateProgress() {
    // زيادة نسبة التحميل تدريجياً حتى 95%
    if (progVal < 95) {
        progVal += Math.random() * 5 + 1;
        if (progVal > 95) progVal = 95;
        progBar.style.strokeDashoffset = CIRC - (progVal / 100) * CIRC;
        progPct.textContent = Math.round(progVal) + "%";
    }
}

function startFakeProgress() {
    progInterval = setInterval(updateProgress, 120);
}

function stopFakeProgress() {
    if (progInterval) clearInterval(progInterval);
    progVal = 100;
    progBar.style.strokeDashoffset = CIRC - (progVal / 100) * CIRC;
    progPct.textContent = "100%";
}

// إظهار زر المتابعة عند اكتمال التحميل المسبق أو بعد 3 ثوانٍ كحد أقصى
function showSplashButton() {
    if (document.getElementById("splashBtn").classList.contains("show")) return;
    stopFakeProgress();
    document.getElementById("splashBtn").classList.add("show");
}

function checkPreloadComplete() {
    if (preloadComplete) {
        if (splashTimeout) clearTimeout(splashTimeout);
        showSplashButton();
    }
}

function bindEvents() {
    var splashBtn = document.getElementById("splashBtn");
    addSnd(splashBtn);
    splashBtn.addEventListener("click", dismissSplash);
    
    var bibBtn = document.getElementById("bibBtn");
    addSnd(bibBtn);
    bibBtn.addEventListener("click", function() {
        document.getElementById("invoiceModal").style.display = "flex";
    });
    
    var invClose = document.getElementById("invClose");
    addSnd(invClose);
    invClose.addEventListener("click", closeInv);
    
    document.getElementById("invoiceModal").addEventListener("click", function(e) {
        if (e.target.id === "invoiceModal") closeInv();
    });
    
    var btnSend = document.getElementById("btnSend");
    addSnd(btnSend);
    btnSend.addEventListener("click", sendOrd);
    
    var msgFab = document.getElementById("msgFab");
    addSnd(msgFab);
    msgFab.addEventListener("click", openCh);
    
    var chatClose = document.getElementById("chatClose");
    addSnd(chatClose);
    chatClose.addEventListener("click", closeCh);
    
    document.getElementById("chatModal").addEventListener("click", function(e) {
        if (e.target.id === "chatModal") closeCh();
    });
    
    var chatSendBtn = document.getElementById("chatSendBtn");
    addSnd(chatSendBtn);
    chatSendBtn.addEventListener("click", sendCh);
    
    document.getElementById("chatInput").addEventListener("keydown", function(e) {
        if (e.key === "Enter") sendCh();
    });
    
    document.getElementById("imgModalClose").addEventListener("click", closeImgModal);
    document.getElementById("imgModal").addEventListener("click", function(e) {
        if (e.target.id === "imgModal") closeImgModal();
    });
}

function dismissSplash() {
    document.getElementById("splashScreen").classList.add("hide");
    setTimeout(function() {
        document.getElementById("splashScreen").style.display = "none";
        document.getElementById("blockScreen").style.display = "flex";
        updateHeader();
        
        // عرض المنيو المحمل مسبقاً فوراً
        if (isMenuPreloaded && !menuOk) {
            menuOk = true;
            state.isMenuLoaded = true;
            updateAppState();
            renderMenuFromPreloadedData();
            listenOrd();
            listenCh();
        }
        
        setTimeout(function() { initGeo(); }, 100);
    }, 600);
}

async function initGeo() {
    var u = new URLSearchParams(location.search);
    TBL = u.get("table") || "1";
    VER = u.get("version") || "";
    document.getElementById("tblB").textContent = "طاولة " + TBL;
    updateAppState();
    
    if (!VER) {
        toast("إصدار غير صالح", "error");
        sGeo("err", "⚠️", "إصدار غير صالح", "لم يتم العثور على ربط للصفحة.");
        return;
    }
    sGeo("ld", "🔄", "جاري التحقق...", "نبحث عن النطاق الجغرافي.");
    try {
        var snap = await get(ref(db, "cobes"));
        var all = snap.val();
        if (!all) {
            sGeo("err", "📋", "لا توجد نطاقات", "لم يتم تسجيل أي نطاق جغرافي.");
            return;
        }
        var found = null;
        for (var id in all) {
            if (all[id].version_number === VER) {
                found = all[id];
                break;
            }
        }
        if (!found) {
            sGeo("err", "🚫", "إصدار غير صالح", 'الإصدار "v' + VER + '" غير موجود.');
            return;
        }
        zone = found.geo_zone;
        if (!zone || !zone.center_latitude) {
            sGeo("err", "📍", "بيانات ناقصة", "الإصدار موجود لكن بدون إحداثيات.");
            return;
        }
        sGeo("wait", "✅", "تم التحقق", "جاري تتبع موقعك لحظياً.");
        startWatchingPosition();
    } catch (e) {
        sGeo("err", "📡", "خطأ في الاتصال", "تعذر الاتصال حالياً.");
    }
}

function sGeo(ic, i, t, m) {
    var el = document.getElementById("geoIcon");
    if (el) {
        el.className = "geo-icon " + ic;
        el.innerHTML = i;
    }
    var titleEl = document.getElementById("geoTitle");
    var msgEl = document.getElementById("geoMsg");
    var distEl = document.getElementById("geoDist");
    var blockedEl = document.getElementById("geoBlocked");
    if (titleEl) titleEl.textContent = t;
    if (msgEl) msgEl.textContent = m;
    if (distEl) distEl.style.display = "none";
    if (blockedEl) blockedEl.style.display = "none";
}

function startWatchingPosition() {
    if (!navigator.geolocation) {
        document.getElementById("geoCard").style.display = "none";
        document.getElementById("geoBlocked").style.display = "block";
        return;
    }
    watchID = navigator.geolocation.watchPosition(onPositionSuccess, onPositionError, {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
    });
}

function onPositionSuccess(pos) {
    curLat = pos.coords.latitude;
    curLon = pos.coords.longitude;
    curDist = haversine(curLat, curLon, zone.center_latitude, zone.center_longitude);
    var rad = zone.radius_meters || 100;
    updateDistBar(curDist, rad);
    
    if (curDist <= rad) {
        if (!isInZone) {
            isInZone = true;
            state.isGeoVerified = true;
            updateAppState();
            
            document.getElementById("blockScreen").style.display = "none";
            document.getElementById("kickScreen").style.display = "none";
            document.getElementById("menuContent").style.display = "block";
            document.getElementById("bottomBar").style.display = "flex";
            document.getElementById("distBar").style.display = "block";
        }
    } else if (curDist <= rad * 2) {
        if (isInZone) {
            isInZone = false;
            state.isGeoVerified = false;
            updateAppState();
            document.getElementById("menuContent").style.display = "none";
            document.getElementById("bottomBar").style.display = "none";
            document.getElementById("distBar").style.display = "none";
            document.getElementById("blockScreen").style.display = "flex";
            sGeo("err", "🚫", "خارج النطاق", "اقترب أكثر من المطعم.");
        }
        var dEl = document.getElementById("geoDist");
        if (dEl) {
            dEl.style.display = "block";
            dEl.className = "geo-dist out";
            dEl.innerHTML = '<i class="fas fa-triangle-exclamation" style="margin-left:5px;"></i><b>خارج النطاق المسموح</b>';
        }
    } else {
        if (!document.getElementById("kickScreen").style.display || document.getElementById("kickScreen").style.display === "none") {
            isInZone = false;
            state.isGeoVerified = false;
            updateAppState();
            document.getElementById("menuContent").style.display = "none";
            document.getElementById("bottomBar").style.display = "none";
            document.getElementById("distBar").style.display = "none";
            document.getElementById("blockScreen").style.display = "none";
            document.getElementById("kickScreen").style.display = "flex";
        }
    }
}

function onPositionError() {
    document.getElementById("geoCard").style.display = "none";
    document.getElementById("geoBlocked").style.display = "block";
}

function updateDistBar(dist, radius) {
    var proximity = Math.max(0, Math.min(100, (1 - dist / radius) * 100));
    var fill = document.getElementById("distFill");
    var val = document.getElementById("distValue");
    if (!fill || !val) return;
    fill.style.width = proximity + "%";
    var r, g, b;
    if (proximity >= 50) {
        var t = (proximity - 50) / 50;
        r = Math.round(180 - (180 - 74) * t);
        g = Math.round(60 + (124 - 60) * t);
        b = Math.round(60 + (89 - 60) * t);
    } else {
        var t2 = proximity / 50;
        r = Math.round(184 + (180 - 184) * t2);
        g = Math.round(80 - 20 * t2);
        b = Math.round(80 - 20 * t2);
    }
    var color = "rgb(" + r + "," + g + "," + b + ")";
    fill.style.background = color;
    val.textContent = Math.round(proximity) + "%";
    val.style.color = color;
}

function addIt(cId, iId, name, price) {
    var k = cId + "_" + iId;
    var r = ref(db, "table_" + TBL + "/current_orders/" + k);
    if (orders[k]) {
        update(r, { quantity: orders[k].quantity + 1 });
    } else {
        set(r, { name: name, price: price, quantity: 1 });
    }
}

/* === الاستماع للطلبات === */
function listenOrd() {
    var tk = "table_" + TBL;
    
    onValue(ref(db, tk + "/current_orders"), function(snap) {
        var d = snap.val();
        orders = d || {};
        state.ordersData = orders;
        var total = 0, count = 0;
        var ic = document.getElementById("invItems");
        if (!ic) return;
        if (!d) {
            ic.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:20px;font-size:13px;">لا توجد طلبات معلقة.</p>';
            document.getElementById("btnSend").disabled = true;
            document.getElementById("barCount").textContent = "٠";
            document.getElementById("barTotal").innerHTML = 'الإجمالي: <span>٠ دينار</span>';
            document.getElementById("invTotal").textContent = "الإجمالي: ٠ دينار";
            return;
        }
        document.getElementById("btnSend").disabled = false;
        ic.innerHTML = "";
        for (var k in d) {
            var it = d[k];
            var sub = it.price * it.quantity;
            total += sub;
            count += it.quantity;
            var row = document.createElement("div");
            row.className = "inv-i";
            row.innerHTML = '<div style="min-width:0;flex:1"><div class="inv-n">' + it.name + '</div><div class="inv-s">' + fmt(it.price) + ' د.ع \u00d7 ' + it.quantity + '</div></div><div style="display:flex;align-items:center;gap:6px;flex-shrink:0"><span class="inv-t">' + fmt(sub) + '</span><div class="qc"><button class="qb qmin" data-key="' + k + '" data-d="-1">\u2212</button><span class="qv">' + it.quantity + '</span><button class="qb qplu" data-key="' + k + '" data-d="1">+</button></div></div>';
            ic.appendChild(row);
        }
        ic.querySelectorAll(".qb").forEach(function(qb) {
            addSnd(qb);
            qb.addEventListener("click", function() {
                var k = this.getAttribute("data-key");
                var dd = parseInt(this.getAttribute("data-d"));
                var r = ref(db, "table_" + TBL + "/current_orders/" + k);
                var n = orders[k].quantity + dd;
                if (n <= 0) {
                    remove(r);
                } else {
                    update(r, { quantity: n });
                }
            });
        });
        document.getElementById("barCount").textContent = count;
        document.getElementById("barTotal").innerHTML = 'الإجمالي: <span>' + fmt(total) + ' دينار</span>';
        document.getElementById("invTotal").textContent = "الإجمالي: " + fmt(total) + " دينار";
    });
    
    onValue(ref(db, "tablesB/" + tk + "/sent_orders"), function(snap) {
        var d = snap.val();
        var c = document.getElementById("sentItems");
        if (!c) return;
        if (!d) {
            c.innerHTML = '<p style="color:var(--text-muted);font-size:12px;">لا توجد طلبات مرسلة.</p>';
            return;
        }
        c.innerHTML = "";
        for (var k in d) {
            var it = d[k];
            c.innerHTML += '<div class="si"><span>\u2022 ' + it.name + ' (\u00d7' + it.quantity + ')</span><span style="color:var(--text-muted);font-size:11px;">' + fmt(it.price * it.quantity) + ' د.ع</span></div>';
        }
    });
}

function sendOrd() {
    if (!Object.keys(orders).length) {
        toast("لا توجد طلبات لإرسالها", "error");
        return;
    }
    if (!navigator.onLine) {
        toast("لا يوجد اتصال بالإنترنت.", "error");
        return;
    }
    if (curLat === null || curLon === null) {
        toast("جاري تحديد موقعك...", "error");
        return;
    }
    if (!zone || !zone.center_latitude) {
        toast("بيانات النطاق غير متوفرة.", "error");
        return;
    }
    var dist = haversine(curLat, curLon, zone.center_latitude, zone.center_longitude);
    var rad = zone.radius_meters || 100;
    if (dist > rad) {
        toast("أنت خارج المنطقة.", "error");
        return;
    }
    var sr = ref(db, "tablesB/table_" + TBL + "/sent_orders");
    for (var k in orders) {
        var it = orders[k];
        set(push(sr), {
            name: it.name,
            price: it.price,
            quantity: it.quantity,
            settled_by: "customer",
            settled_at: new Date().toISOString(),
            sent_distance: Math.round(dist)
        });
    }
    remove(ref(db, "table_" + TBL + "/current_orders")).then(function() {
        toast("تم إرسال طلباتك بنجاح", "success");
        closeInv();
    }).catch(function() {
        toast("حدث خطأ أثناء الإرسال.", "error");
    });
}

function closeInv() {
    document.getElementById("invoiceModal").style.display = "none";
}

/* === محادثة الكاشير === */
function listenCh() {
    var tk = "table_" + TBL;

    function renderMsgs(sA, sB) {
        if (!chatOn) return;
        var box = document.getElementById("chatMsgs");
        if (!box) return;
        box.innerHTML = "";
        var msgs = [];
        if (sA.exists()) {
            var vA = sA.val();
            for (var k in vA) {
                var m = vA[k];
                m.src = "client";
                msgs.push(m);
            }
        }
        if (sB.exists()) {
            var vB = sB.val();
            for (var k2 in vB) {
                var m2 = vB[k2];
                m2.src = "cashier";
                msgs.push(m2);
            }
        }
        msgs.sort(function(a, b) {
            return new Date(a.timestamp) - new Date(b.timestamp);
        });
        if (!msgs.length) {
            box.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:20px;font-size:13px;">ابدأ المحادثة مع الكاشير.</p>';
            return;
        }
        for (var j = 0; j < msgs.length; j++) {
            var msg = msgs[j];
            var t = new Date(msg.timestamp).toLocaleTimeString("ar-IQ", {
                hour: "2-digit",
                minute: "2-digit"
            });
            box.innerHTML += '<div class="cm ' + (msg.src === "client" ? "cm-cl" : "cm-ca") + '">' + msg.text + '<div class="cm-t">' + t + '</div></div>';
        }
        box.scrollTop = box.scrollHeight;
    }

    onValue(ref(db, "msgA/" + tk), function(sA) {
        onValue(ref(db, "msgB/" + tk), function(sB) {
            renderMsgs(sA, sB);
            var newCount = sB.exists() ? Object.keys(sB.val()).length : 0;
            if (newCount > prevMsgCount && prevMsgCount > 0) msgSnd();
            if (!chatOn) prevMsgCount = newCount;
            updUnread(newCount);
        });
    });
    updUnread(0);
}

function updUnread(count) {
    if (count === undefined) {
        onValue(ref(db, "msgB/table_" + TBL), function(s) {
            var d = s.val();
            var c = 0;
            if (d) c = Object.keys(d).length;
            showUnread(c);
            prevMsgCount = c;
        });
        return;
    }
    showUnread(count);
    prevMsgCount = count;
}

function showUnread(c) {
    var dot = document.getElementById("msgDot");
    if (!dot) return;
    if (c > 0) {
        dot.style.display = "flex";
        dot.textContent = c > 9 ? "9+" : String(c);
    } else {
        dot.style.display = "none";
    }
    unreadN = c;
}

function openCh() {
    chatOn = true;
    unreadN = 0;
    var dot = document.getElementById("msgDot");
    if (dot) dot.style.display = "none";
    var modal = document.getElementById("chatModal");
    if (modal) modal.style.display = "flex";
    prevMsgCount = 0;
}

function closeCh() {
    chatOn = false;
    document.getElementById("chatModal").style.display = "none";
}

function sendCh() {
    var inp = document.getElementById("chatInput");
    if (!inp) return;
    var t = inp.value.trim();
    if (!t) return;
    set(push(ref(db, "msgA/table_" + TBL)), {
        text: t,
        timestamp: new Date().toISOString()
    });
    inp.value = "";
}

// دوال تكبير الصورة
window.openImage = function(src) {
    if (!src) return;
    var modal = document.getElementById("imgModal");
    var img = document.getElementById("imgModalImg");
    if (modal && img) {
        img.src = src;
        modal.style.display = "flex";
    }
};

window.closeImgModal = function() {
    var modal = document.getElementById("imgModal");
    if (modal) modal.style.display = "none";
};

// بدء التحميل المسبق للمنيو
const preloadPromise = preloadMenu();
preloadPromise.then(() => {
    preloadComplete = true;
    checkPreloadComplete();
});

// مهلة قصوى 3 ثوانٍ لظهور الزر
splashTimeout = setTimeout(function() {
    if (!preloadComplete) {
        console.log("انتهت المهلة الزمنية - إظهار الزر");
        preloadComplete = true;
        showSplashButton();
    }
}, 3000);

document.addEventListener("click", function() {
    if (aC.state === "suspended") aC.resume();
}, { once: true });

// بدء تشغيل التطبيق
startFakeProgress();
bindEvents();
loadAppSettings();
