// Firebase Imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, onValue, set, remove, push, update, get } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

// Firebase Config
const firebaseConfig = {
    apiKey: "AIzaSyCEEqEALOCaQo5oSoR8A_Jh9eSpHS8Sz5o",
    authDomain: "game1-bb93e.firebaseapp.com",
    databaseURL: "https://game1-bb93e-default-rtdb.firebaseio.com",
    projectId: "game1-bb93e"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// ========== State ==========
let state = {
    activeTable: null,
    mySid: null,
    myUser: null,
    myVersion: null,
    dA: {}, dB: {}, dC: {}, dMsgA: {}, dRead: {},
    dSessions: {}, dUsers: {}, dVersions: {},
    settings: {
        restaurantName: "المطعم", orderSound: "off", msgSound: "off",
        clickSound: "click1", restaurantLogo: "", invoiceQrUrl: ""
    },
    directMenuData: {},
    isGeoVerified: false,
    zone: null,
    pendingLogoData: null
};

// Captain orders
let captainOrders = {};
let captainTable = null;
let captainChatCache = {};
let chatOpen = false;

// ========== Audio Cache ==========
let audioCache = {};
let orderAlarmInterval = null;
let msgAlarmInterval = null;
let lastOrderCount = {};
let lastMsgCount = {};

function getAudio(soundFile) {
    if (!soundFile || soundFile === 'off') return null;
    if (!audioCache[soundFile]) {
        audioCache[soundFile] = new Audio(soundFile);
        audioCache[soundFile].volume = 0.7;
        audioCache[soundFile].loop = false;
    }
    return audioCache[soundFile];
}

function playSoundOnce(soundFile) {
    if (!soundFile || soundFile === 'off') return;
    var audio = getAudio(soundFile);
    if (audio) {
        audio.currentTime = 0;
        audio.play().catch(function(e) { console.log("Audio play error:", e); });
    }
}

// ========== Utils ==========
function fmt(n) {
    return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function genSid() {
    return 's_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
}

let audioUnlocked = false;

function playClickSnd() {
    if (!audioUnlocked) return;
    var cs = state.settings.clickSound;
    if (cs === 'off') return;
    
    if (cs === 'click1' || cs === 'click2') {
        try {
            var ac = new (window.AudioContext || window.webkitAudioContext)();
            var o = ac.createOscillator();
            var g = ac.createGain();
            o.type = 'sine';
            o.frequency.value = cs === 'click1' ? 1200 : 800;
            g.gain.setValueAtTime(0.12, ac.currentTime);
            g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.05);
            o.connect(g);
            g.connect(ac.destination);
            o.start();
            o.stop(ac.currentTime + 0.06);
        } catch(e) {}
    }
}

// Start repeating order alarm
function startOrderAlarm() {
    if (orderAlarmInterval) clearInterval(orderAlarmInterval);
    orderAlarmInterval = setInterval(function() {
        var sound = state.settings.orderSound;
        if (sound !== 'off') {
            playSoundOnce(sound);
        }
    }, 3000);
}

function stopOrderAlarm() {
    if (orderAlarmInterval) {
        clearInterval(orderAlarmInterval);
        orderAlarmInterval = null;
    }
}

// Start repeating message alarm
function startMsgAlarm() {
    if (msgAlarmInterval) clearInterval(msgAlarmInterval);
    msgAlarmInterval = setInterval(function() {
        var sound = state.settings.msgSound;
        if (sound !== 'off') {
            playSoundOnce(sound);
        }
    }, 4000);
}

function stopMsgAlarm() {
    if (msgAlarmInterval) {
        clearInterval(msgAlarmInterval);
        msgAlarmInterval = null;
    }
}

function toast(msg, type) {
    type = type || 'ti';
    playClickSnd();
    var icons = { ts: 'fa-circle-check', te: 'fa-circle-xmark', ti: 'fa-circle-info' };
    var t = document.createElement('div');
    t.className = 'toast ' + type;
    t.innerHTML = '<i class="fas ' + (icons[type] || icons.ti) + '"></i> ' + msg;
    document.getElementById('toastBox').appendChild(t);
    setTimeout(function() { if (t.parentNode) t.remove(); }, 3200);
}

function processMenuImg(file) {
    return new Promise(function(resolve) {
        if (!file) return resolve('');
        var reader = new FileReader();
        reader.onload = function(ev) {
            var img = new Image();
            img.onload = function() {
                var cv = document.createElement('canvas');
                var maxW = 1400, maxH = 500;
                var w = img.width, h = img.height;
                if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
                if (h > maxH) { w = Math.round(w * maxH / h); h = maxH; }
                cv.width = w; cv.height = h;
                var ctx = cv.getContext('2d');
                ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, w, h);
                ctx.drawImage(img, 0, 0, w, h);
                resolve(cv.toDataURL('image/jpeg', 0.85));
            };
            img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
    });
}

function processItemImg(file) {
    return new Promise(function(resolve) {
        if (!file) return resolve('');
        var reader = new FileReader();
        reader.onload = function(ev) {
            var img = new Image();
            img.onload = function() {
                var cv = document.createElement('canvas');
                var maxSize = 900;
                var w = img.width, h = img.height;
                if (w > h) {
                    if (w > maxSize) { h = Math.round(h * maxSize / w); w = maxSize; }
                } else {
                    if (h > maxSize) { w = Math.round(w * maxSize / h); h = maxSize; }
                }
                cv.width = w; cv.height = h;
                var ctx = cv.getContext('2d');
                ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, w, h);
                ctx.drawImage(img, 0, 0, w, h);
                resolve(cv.toDataURL('image/jpeg', 0.85));
            };
            img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
    });
}

// ========== Geo Protection ==========
let watchId = null, isInZone = false;

function haversine(lat1, lon1, lat2, lon2) {
    var R = 6371e3;
    var φ1 = lat1 * Math.PI/180;
    var φ2 = lat2 * Math.PI/180;
    var Δφ = (lat2-lat1) * Math.PI/180;
    var Δλ = (lon2-lon1) * Math.PI/180;
    var a = Math.sin(Δφ/2) * Math.sin(Δφ/2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) * Math.sin(Δλ/2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

async function initGeo() {
    var snap = await get(ref(db, "cobes"));
    var all = snap.val();
    if (!all) { toast("لا توجد نطاقات جغرافية مسجلة", "te"); return; }
    var found = null;
    for (var id in all) {
        if (all[id].version_number === state.myVersion) {
            found = all[id];
            break;
        }
    }
    if (!found || !found.geo_zone) { toast("لم يتم العثور على نطاق لهذا الإصدار", "te"); return; }
    state.zone = found.geo_zone;
    startWatching();
}

function startWatching() {
    if (!navigator.geolocation) {
        document.getElementById('blockScreen').style.display = 'flex';
        return;
    }
    watchId = navigator.geolocation.watchPosition(onGeoSuccess, onGeoError, { enableHighAccuracy: true, timeout: 10000 });
}

function onGeoSuccess(pos) {
    var lat = pos.coords.latitude, lon = pos.coords.longitude;
    if (!state.zone) return;
    var dist = haversine(lat, lon, state.zone.center_latitude, state.zone.center_longitude);
    var radius = state.zone.radius_meters || 100;
    var proximity = Math.max(0, Math.min(100, (1 - dist / radius) * 100));
    var fill = document.getElementById('distFill');
    var val = document.getElementById('distValue');
    if (fill) fill.style.width = proximity + "%";
    if (val) val.textContent = Math.round(proximity) + "%";
    
    if (dist <= radius) {
        if (!isInZone) {
            isInZone = true;
            state.isGeoVerified = true;
            document.getElementById('blockScreen').style.display = 'none';
            document.getElementById('kickScreen').style.display = 'none';
            document.getElementById('distBar').style.display = 'block';
            document.getElementById('appRoot').style.display = 'block';
            loadMenu();
        }
    } else if (dist <= radius * 2) {
        if (isInZone) {
            isInZone = false;
            document.getElementById('blockScreen').style.display = 'flex';
            document.getElementById('kickScreen').style.display = 'none';
            document.getElementById('appRoot').style.display = 'none';
        }
    } else {
        document.getElementById('blockScreen').style.display = 'none';
        document.getElementById('kickScreen').style.display = 'flex';
        document.getElementById('appRoot').style.display = 'none';
        document.getElementById('distBar').style.display = 'none';
    }
}

function onGeoError() {
    document.getElementById('blockScreen').style.display = 'flex';
    document.getElementById('geoMsg').textContent = 'يرجى تفعيل خدمة تحديد الموقع';
}

// ========== Menu Management ==========
function loadMenu() {
    onValue(ref(db, "orders"), function(snap) {
        state.directMenuData = snap.val() || {};
        renderMenuStructure();
        renderCaptainMenu();
    });
}

function renderMenuStructure() {
    var c = document.getElementById('menuStructure');
    var data = state.directMenuData;
    c.innerHTML = '';
    if (!data || Object.keys(data).length === 0) {
        c.innerHTML = '<p style="color:var(--text-muted);">لا توجد أقسام.</p>';
        return;
    }
    for (var catId in data) {
        var cat = data[catId];
        var itemsHtml = '';
        if (cat.items) {
            for (var iid in cat.items) {
                var it = cat.items[iid];
                var imgHtml = '';
                if (it.image && it.image.length > 20) {
                    imgHtml = '<div class="item-img-wrap"><img src="' + it.image + '" onclick="event.stopPropagation(); document.getElementById(\'imgModalImg\').src=\'' + it.image + '\'; document.getElementById(\'imgModal\').classList.add(\'open\')" style="cursor:pointer;"></div>';
                } else {
                    imgHtml = '<div class="item-img-wrap" style="background:var(--bg-input);display:flex;align-items:center;justify-content:center;"><i class="fas fa-image"></i></div>';
                }
                itemsHtml += `
                    <div class="item-row">
                        <div class="item-info">
                            ${imgHtml}
                            <div class="item-text">
                                <div class="item-name">${it.name}</div>
                                <div class="item-details" style="font-size:11px;color:var(--text-muted);">${it.details || ''}</div>
                                <div class="item-price">${fmt(it.price)} دينار</div>
                            </div>
                        </div>
                        <div class="item-actions">
                            <button class="btn-secondary btn-sm" onclick="window.editItem('${catId}','${iid}','${it.name.replace(/'/g, "\\'")}','${it.price}','${(it.details || '').replace(/'/g, "\\'")}')"><i class="fas fa-pen"></i></button>
                            <button class="btn-secondary btn-sm btn-red" onclick="window.delItem('${catId}','${iid}')"><i class="fas fa-trash"></i></button>
                        </div>
                    </div>`;
            }
        }
        var catImgHtml = '';
        if (cat.image && cat.image.length > 20) {
            catImgHtml = '<img src="' + cat.image + '" class="thumb-wide">';
        } else {
            catImgHtml = '<div class="thumb-wide" style="background:var(--bg-input);display:flex;align-items:center;justify-content:center;"><i class="fas fa-image"></i></div>';
        }
        c.innerHTML += `
            <div class="cat-box">
                <div class="cat-head">
                    <div class="cat-info">${catImgHtml}<h3>${cat.name}</h3></div>
                    <div><button class="btn-secondary btn-sm" onclick="window.editCat('${catId}','${cat.name.replace(/'/g, "\\'")}')"><i class="fas fa-pen"></i> تعديل</button>
                    <button class="btn-secondary btn-sm btn-red" onclick="window.delCat('${catId}')"><i class="fas fa-trash"></i> حذف</button></div>
                </div>
                <div class="add-item-form" style="margin:16px 0;padding:16px;background:var(--bg-input);border-radius:12px;">
                    <h4 style="margin-bottom:12px;"><i class="fas fa-plus-circle"></i> إضافة صنف</h4>
                    <form onsubmit="window.saveItem(event,'${catId}')">
                        <input type="hidden" id="eiid_${catId}">
                        <div class="form-row">
                            <div class="fg"><input type="text" class="fi" id="ein_${catId}" required placeholder="اسم الصنف"></div>
                            <div class="fg"><input type="number" class="fi" id="eip_${catId}" required placeholder="السعر"></div>
                        </div>
                        <textarea class="fi" id="eid_${catId}" placeholder="التفاصيل" style="margin-bottom:10px;"></textarea>
                        <input type="file" class="fi" id="eii_${catId}" accept="image/*" style="margin-bottom:10px;">
                        <button type="submit" class="btn-primary btn-sm" id="eib_${catId}"><i class="fas fa-plus"></i> حفظ</button>
                    </form>
                </div>
                <div class="items-list">${itemsHtml || '<p style="color:var(--text-muted);">لا توجد أصناف.</p>'}</div>
            </div>`;
    }
}

window.editCat = function(id, name) {
    document.getElementById('editCatId').value = id;
    document.getElementById('catName').value = name;
    document.getElementById('catBtn').innerHTML = '<i class="fas fa-pen"></i> تحديث القسم';
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.delCat = function(id) { 
    if (confirm('حذف القسم وكل محتوياته؟')) remove(ref(db, 'orders/' + id)); 
};

window.editItem = function(catId, itemId, name, price, details) {
    document.getElementById('eiid_' + catId).value = itemId;
    document.getElementById('ein_' + catId).value = name;
    document.getElementById('eip_' + catId).value = price;
    document.getElementById('eid_' + catId).value = details;
    document.getElementById('eib_' + catId).innerHTML = '<i class="fas fa-pen"></i> تحديث';
};

window.delItem = function(catId, itemId) { 
    if (confirm('حذف هذا الصنف؟')) remove(ref(db, 'orders/' + catId + '/items/' + itemId)); 
};

window.saveItem = async function(e, catId) {
    e.preventDefault();
    var iid = document.getElementById('eiid_' + catId).value;
    var name = document.getElementById('ein_' + catId).value;
    var price = document.getElementById('eip_' + catId).value;
    var details = document.getElementById('eid_' + catId).value;
    var file = document.getElementById('eii_' + catId).files[0];
    var img = '';
    if (file) img = await processItemImg(file);
    if (iid) {
        var ud = { name: name, price: price, details: details };
        if (img) ud.image = img;
        await update(ref(db, 'orders/' + catId + '/items/' + iid), ud);
        toast('تم التحديث', 'ts');
    } else {
        await push(ref(db, 'orders/' + catId + '/items'), { name: name, price: price, details: details, image: img || '' });
        toast('تم الإضافة', 'ts');
    }
    var form = document.getElementById('if_' + catId);
    if (form) form.reset();
    document.getElementById('eiid_' + catId).value = '';
    document.getElementById('eib_' + catId).innerHTML = '<i class="fas fa-plus"></i> حفظ';
};

async function saveCat(e) {
    e.preventDefault();
    var cid = document.getElementById('editCatId').value;
    var name = document.getElementById('catName').value;
    var file = document.getElementById('catImg').files[0];
    var img = '';
    if (file) img = await processMenuImg(file);
    if (cid) {
        var ud = { name: name };
        if (img) ud.image = img;
        await update(ref(db, 'orders/' + cid), ud);
        toast('تم تعديل القسم', 'ts');
    } else {
        await push(ref(db, 'orders'), { name: name, image: img || '', created_at: new Date().toISOString() });
        toast('تم إضافة القسم', 'ts');
    }
    document.getElementById('catForm').reset();
    document.getElementById('editCatId').value = '';
    document.getElementById('catBtn').innerHTML = '<i class="fas fa-plus"></i> حفظ القسم';
}

document.getElementById('catForm')?.addEventListener('submit', saveCat);

// ========== Captain Orders ==========
function renderCaptainMenu() {
    var c = document.getElementById('captainMenuCats');
    if (!c) return;
    c.innerHTML = '';
    var data = state.directMenuData;
    if (!data || Object.keys(data).length === 0) {
        c.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:30px;">المنيو فارغ حالياً.</p>';
        return;
    }
    for (var catId in data) {
        var cat = data[catId];
        var itemsHtml = '';
        if (cat.items) {
            for (var itemId in cat.items) {
                var it = cat.items[itemId];
                var key = catId + "_" + itemId;
                var qty = captainOrders[key] ? captainOrders[key].quantity : 0;
                var imgSrc = it.image || '';
                var imgHtml = '';
                if (imgSrc) {
                    imgHtml = '<img src="' + imgSrc + '" onclick="event.stopPropagation(); document.getElementById(\'imgModalImg\').src=\'' + imgSrc + '\'; document.getElementById(\'imgModal\').classList.add(\'open\')">';
                } else {
                    imgHtml = '<div style="width:100%;height:90px;background:var(--bg-input);border-radius:8px;display:flex;align-items:center;justify-content:center;margin-bottom:8px;"><i class="fas fa-image"></i></div>';
                }
                itemsHtml += `
                    <div class="direct-item ${qty > 0 ? 'selected' : ''}" onclick="window.captainToggleItem('${key}')">
                        ${imgHtml}
                        <h4>${it.name}</h4>
                        <div class="di-price">${fmt(it.price)} د.ع</div>
                        <div class="direct-qty">
                            <button class="dq-minus" onclick="event.stopPropagation(); window.captainQtyChange('${key}', -1)">−</button>
                            <span>${qty}</span>
                            <button class="dq-plus" onclick="event.stopPropagation(); window.captainQtyChange('${key}', 1)">+</button>
                        </div>
                    </div>`;
            }
        }
        c.innerHTML += `<div><h3 style="font-size:18px;font-weight:800;color:var(--accent);margin-bottom:12px;">${cat.name}</h3><div class="direct-grid">${itemsHtml}</div></div>`;
    }
}

function loadTablesDropdown() {
    var sel = document.getElementById('captainTableSelect');
    if (!sel) return;
    sel.innerHTML = '<option value="">-- اختر طاولة --</option>';
    var tables = [];
    for (var id in state.dA) {
        if (state.dA[id] && state.dA[id].table_number) {
            tables.push(state.dA[id].table_number);
        }
    }
    tables.sort(function(a, b) { return a - b; });
    for (var i = 0; i < tables.length; i++) {
        var t = tables[i];
        var opt = document.createElement('option');
        opt.value = t;
        opt.textContent = 'طاولة ' + t;
        sel.appendChild(opt);
    }
}

window.captainChangeTable = function(tableNum) {
    captainTable = tableNum;
    captainOrders = {};
    renderCaptainMenu();
    updateCaptainBar();
};

window.captainToggleItem = function(key) {
    if (!captainTable) { toast('اختر طاولة أولاً', 'te'); return; }
    if (captainOrders[key]) {
        delete captainOrders[key];
    } else {
        captainOrders[key] = { quantity: 1 };
    }
    updateCaptainBar();
    renderCaptainMenu();
};

window.captainQtyChange = function(key, delta) {
    if (!captainOrders[key]) captainOrders[key] = { quantity: 0 };
    captainOrders[key].quantity = Math.max(0, captainOrders[key].quantity + delta);
    if (captainOrders[key].quantity === 0) delete captainOrders[key];
    updateCaptainBar();
    renderCaptainMenu();
};

function updateCaptainBar() {
    var bar = document.getElementById('captainBottomBar');
    if (!bar) return;
    var count = 0, total = 0;
    for (var k in captainOrders) {
        var parts = k.split('_');
        var catId = parts[0];
        var itemId = parts.slice(1).join('_');
        var item = null;
        if (state.directMenuData[catId] && state.directMenuData[catId].items) {
            item = state.directMenuData[catId].items[itemId];
        }
        if (item) {
            count += captainOrders[k].quantity;
            total += item.price * captainOrders[k].quantity;
        }
    }
    bar.style.display = count > 0 ? 'flex' : 'none';
    document.getElementById('captainBarCount').textContent = count;
    document.getElementById('captainBarTotal').textContent = 'الإجمالي: ' + fmt(total) + ' دينار';
}

function captainOpenInvoice() {
    var ic = document.getElementById('captainInvItems');
    var total = 0, html = '';
    for (var k in captainOrders) {
        var parts = k.split('_');
        var catId = parts[0];
        var itemId = parts.slice(1).join('_');
        var item = null;
        if (state.directMenuData[catId] && state.directMenuData[catId].items) {
            item = state.directMenuData[catId].items[itemId];
        }
        if (item) {
            var qty = captainOrders[k].quantity;
            var sub = item.price * qty;
            total += sub;
            html += '<div class="inv-row"><span>' + item.name + ' (' + qty + ')</span><span>' + fmt(sub) + ' د.ع</span></div>';
        }
    }
    ic.innerHTML = html || '<p style="text-align:center;padding:20px;">لا توجد طلبات.</p>';
    document.getElementById('captainInvTotal').textContent = 'الإجمالي: ' + fmt(total) + ' دينار';
    document.getElementById('captainInvoiceModal').classList.add('open');
}

async function captainSendOrder() {
    if (!captainTable) { toast('اختر طاولة أولاً', 'te'); return; }
    if (Object.keys(captainOrders).length === 0) { toast('السلة فارغة', 'te'); return; }
    for (var k in captainOrders) {
        var parts = k.split('_');
        var catId = parts[0];
        var itemId = parts.slice(1).join('_');
        var item = null;
        if (state.directMenuData[catId] && state.directMenuData[catId].items) {
            item = state.directMenuData[catId].items[itemId];
        }
        if (item) {
            await push(ref(db, 'tablesB/table_' + captainTable + '/sent_orders'), {
                name: item.name, price: item.price, quantity: captainOrders[k].quantity,
                settled_by: "captain", settled_at: new Date().toISOString()
            });
        }
    }
    captainOrders = {};
    updateCaptainBar();
    renderCaptainMenu();
    document.getElementById('captainInvoiceModal').classList.remove('open');
    toast('تم إرسال الطلب للمطبخ بنجاح', 'ts');
    
    // Stop order alarm for this table after sending
    checkAndStopOrderAlarm();
}

document.getElementById('captainTableSelect')?.addEventListener('change', function(e) { window.captainChangeTable(e.target.value); });
document.getElementById('captainInvoiceBtn')?.addEventListener('click', captainOpenInvoice);
document.getElementById('sendOrderBtn')?.addEventListener('click', captainSendOrder);
document.getElementById('closeInvoiceModal')?.addEventListener('click', function() { document.getElementById('captainInvoiceModal').classList.remove('open'); });
document.getElementById('closeChatModal')?.addEventListener('click', function() { document.getElementById('captainChatModal').classList.remove('open'); });

// ========== Captain Chat ==========
function initCaptainChat() {
    if (!state.myUser) return;
    onValue(ref(db, 'captain_chats/' + state.myUser), function(snap) {
        var newData = snap.val() || {};
        var oldCount = Object.keys(captainChatCache).length;
        var newCount = Object.keys(newData).length;
        
        captainChatCache = newData;
        
        if (chatOpen) {
            renderCaptainChat();
            stopMsgAlarm();
        } else {
            if (newCount > oldCount) {
                // New message arrived
                startMsgAlarm();
                toast('لديك رسالة جديدة من الكاشير', 'ti');
            }
            renderCaptainChat();
        }
    });
}

function renderCaptainChat() {
    var box = document.getElementById('captainChatMsgs');
    if (!box) return;
    box.innerHTML = '';
    var msgs = [];
    for (var id in captainChatCache) {
        var msg = captainChatCache[id];
        msg._id = id;
        msgs.push(msg);
    }
    msgs.sort(function(a, b) { return new Date(a.timestamp) - new Date(b.timestamp); });
    if (!msgs.length) {
        box.innerHTML = '<p style="text-align:center;padding:20px;">لا توجد رسائل.</p>';
        return;
    }
    for (var i = 0; i < msgs.length; i++) {
        var m = msgs[i];
        var isMe = m.sender === 'captain';
        var t = new Date(m.timestamp).toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' });
        var senderName = isMe ? 'أنت' : 'الكاشير';
        box.innerHTML += '<div class="cm ' + (isMe ? 'from-admin' : 'from-client') + '" style="max-width:90%;">' +
            '<small style="opacity:.6;">' + senderName + ' - ' + t + '</small><br>' + m.text + '</div>';
    }
    box.scrollTop = box.scrollHeight;
}

function sendCaptainChat() {
    var inp = document.getElementById('captainChatIn');
    var txt = inp.value.trim();
    if (!txt || !state.myUser) return;
    push(ref(db, 'captain_chats/' + state.myUser), {
        text: txt, timestamp: new Date().toISOString(), sender: "captain", sender_name: state.myUser
    });
    inp.value = '';
}

document.getElementById('captainChatBtn')?.addEventListener('click', function() {
    chatOpen = true;
    renderCaptainChat();
    document.getElementById('captainChatModal').classList.add('open');
    stopMsgAlarm(); // Stop alarm when chat is opened
});
document.getElementById('sendChatBtn')?.addEventListener('click', sendCaptainChat);
document.getElementById('captainChatIn')?.addEventListener('keydown', function(e) { if (e.key === 'Enter') sendCaptainChat(); });

// ========== Tables Panel with Edit Capability ==========
function renderTables() {
    var grid = document.getElementById('tablesGrid');
    if (!grid) return;
    var occCount = 0, cookCount = 0, msgCount = 0;
    var html = '';
    var tables = [];
    for (var id in state.dA) {
        var t = state.dA[id];
        if (t && t.table_number) {
            tables.push({ num: t.table_number, id: id });
        }
    }
    tables.sort(function(a, b) { return a.num - b.num; });
    for (var i = 0; i < tables.length; i++) {
        var item = tables[i];
        var tNum = item.num;
        var tKey = 'table_' + tNum;
        var ordersB = (state.dB[tKey] && state.dB[tKey].sent_orders) ? state.dB[tKey].sent_orders : {};
        var ordersC = (state.dC[tKey] && state.dC[tKey].cooking_orders) ? state.dC[tKey].cooking_orders : {};
        var msgs = state.dMsgA[tKey] || {};
        var bCount = Object.keys(ordersB).length;
        var cCount = Object.keys(ordersC).length;
        var mCount = Object.keys(msgs).length;
        if (bCount > 0 || cCount > 0 || mCount > 0) {
            occCount++;
            cookCount += cCount;
            msgCount += mCount;
        }
        var badgesHtml = '';
        if (bCount > 0) badgesHtml += '<div class="t-badge b-b"><span>طلبات</span><span>' + bCount + '</span></div>';
        if (cCount > 0) badgesHtml += '<div class="t-badge b-c"><span>مطبخ</span><span>' + cCount + '</span></div>';
        if (mCount > 0) badgesHtml += '<div class="t-badge b-m"><span>رسائل</span><span>' + mCount + '</span></div>';
        html += '<div class="t-card ' + (bCount > 0 || cCount > 0 ? 'occupied' : '') + '" onclick="window.openTableDetail(\'' + tKey + '\')">' +
            '<h3>طاولة ' + tNum + '</h3>' +
            '<div class="t-badges">' + badgesHtml + '</div></div>';
    }
    grid.innerHTML = html || '<p style="color:var(--text-muted);text-align:center;padding:30px;">لا توجد طاولات مسجلة.</p>';
    document.getElementById('qsOcc').textContent = occCount;
    document.getElementById('qsCook').textContent = cookCount;
    document.getElementById('qsMsg').textContent = msgCount;
}

window.openTableDetail = function(tKey) {
    state.activeTable = tKey;
    renderDetail();
    document.getElementById('detailPanel').classList.add('show');
};

function closeDetail() {
    state.activeTable = null;
    document.getElementById('detailPanel').classList.remove('show');
}

// Check if there are any pending orders (B) for any table
function checkAndStopOrderAlarm() {
    var hasPendingOrders = false;
    for (var tKey in state.dB) {
        var orders = state.dB[tKey]?.sent_orders;
        if (orders && Object.keys(orders).length > 0) {
            hasPendingOrders = true;
            break;
        }
    }
    if (!hasPendingOrders) {
        stopOrderAlarm();
    }
}

// Check if there are any unread messages
function checkAndStopMsgAlarm() {
    if (chatOpen) {
        stopMsgAlarm();
    }
}

// Render detail with edit buttons for orders
function renderDetail() {
    if (!state.activeTable) return;
    var tKey = state.activeTable;
    var tNum = tKey.replace('table_', '');
    document.getElementById('dpTitle').innerHTML = '<i class="fas fa-file-invoice"></i> طاولة ' + tNum;
    
    // طلبات واردة (B) - مع أزرار تحرير
    var ordersB = (state.dB[tKey] && state.dB[tKey].sent_orders) ? state.dB[tKey].sent_orders : {};
    var boxB = document.getElementById('dpBoxB');
    var bHtml = '';
    for (var k in ordersB) {
        var o = ordersB[k];
        bHtml += `
            <div class="inv-row" data-id="${k}" data-type="B">
                <span>${o.name || ''} (${o.quantity || 0})</span>
                <span>${fmt(o.price || 0)} د.ع</span>
                <div class="inv-actions">
                    <button class="btn-secondary btn-sm" onclick="window.editOrder('${tKey}', 'B', '${k}', ${o.price}, ${o.quantity})"><i class="fas fa-pen"></i></button>
                    <button class="btn-secondary btn-sm btn-red" onclick="window.deleteOrder('${tKey}', 'B', '${k}')"><i class="fas fa-trash"></i></button>
                    <button class="btn-secondary btn-sm" onclick="window.incrementOrder('${tKey}', 'B', '${k}', ${o.price})"><i class="fas fa-plus"></i></button>
                    <button class="btn-secondary btn-sm" onclick="window.decrementOrder('${tKey}', 'B', '${k}', ${o.price})"><i class="fas fa-minus"></i></button>
                </div>
            </div>`;
    }
    boxB.innerHTML = bHtml || '<p>لا توجد طلبات جديدة.</p>';
    
    // قيد المعالجة (C) - مع أزرار تحرير
    var ordersC = (state.dC[tKey] && state.dC[tKey].cooking_orders) ? state.dC[tKey].cooking_orders : {};
    var boxC = document.getElementById('dpBoxC');
    var cHtml = '';
    for (var k2 in ordersC) {
        var o2 = ordersC[k2];
        cHtml += `
            <div class="inv-row" data-id="${k2}" data-type="C">
                <span>${o2.name || ''} (${o2.quantity || 0})</span>
                <span>${fmt(o2.price || 0)} د.ع</span>
                <div class="inv-actions">
                    <button class="btn-secondary btn-sm" onclick="window.editOrder('${tKey}', 'C', '${k2}', ${o2.price}, ${o2.quantity})"><i class="fas fa-pen"></i></button>
                    <button class="btn-secondary btn-sm btn-red" onclick="window.deleteOrder('${tKey}', 'C', '${k2}')"><i class="fas fa-trash"></i></button>
                    <button class="btn-secondary btn-sm" onclick="window.incrementOrder('${tKey}', 'C', '${k2}', ${o2.price})"><i class="fas fa-plus"></i></button>
                    <button class="btn-secondary btn-sm" onclick="window.decrementOrder('${tKey}', 'C', '${k2}', ${o2.price})"><i class="fas fa-minus"></i></button>
                </div>
            </div>`;
    }
    boxC.innerHTML = cHtml || '<p>لا توجد وجبات في المطبخ.</p>';
    
    // حساب الإجمالي
    var total = 0;
    for (var k3 in ordersB) total += (parseFloat(ordersB[k3].price) || 0) * (parseInt(ordersB[k3].quantity) || 1);
    for (var k4 in ordersC) total += (parseFloat(ordersC[k4].price) || 0) * (parseInt(ordersC[k4].quantity) || 1);
    document.getElementById('dpTotal').textContent = 'الإجمالي: ' + fmt(total) + ' دينار';
    
    renderTableChat(tKey);
}

// Edit order quantity
window.editOrder = function(tableKey, type, orderId, price, currentQty) {
    var newQty = prompt('تعديل الكمية:', currentQty);
    if (newQty !== null && !isNaN(parseInt(newQty)) && parseInt(newQty) > 0) {
        var path = (type === 'B') ? 'tablesB/' + tableKey + '/sent_orders/' + orderId : 'tablesC/' + tableKey + '/cooking_orders/' + orderId;
        update(ref(db, path), { quantity: parseInt(newQty) });
        toast('تم تعديل الكمية', 'ts');
    } else if (newQty !== null && parseInt(newQty) <= 0) {
        window.deleteOrder(tableKey, type, orderId);
    }
};

// Delete order
window.deleteOrder = function(tableKey, type, orderId) {
    if (confirm('هل تريد حذف هذا الطلب؟')) {
        var path = (type === 'B') ? 'tablesB/' + tableKey + '/sent_orders/' + orderId : 'tablesC/' + tableKey + '/cooking_orders/' + orderId;
        remove(ref(db, path));
        toast('تم حذف الطلب', 'ts');
        setTimeout(function() { checkAndStopOrderAlarm(); }, 500);
    }
};

// Increment order quantity
window.incrementOrder = function(tableKey, type, orderId, price) {
    var path = (type === 'B') ? 'tablesB/' + tableKey + '/sent_orders/' + orderId : 'tablesC/' + tableKey + '/cooking_orders/' + orderId;
    get(ref(db, path)).then(function(snap) {
        if (snap.exists()) {
            var order = snap.val();
            var newQty = (order.quantity || 1) + 1;
            update(ref(db, path), { quantity: newQty });
            toast('تمت الزيادة', 'ts');
        }
    });
};

// Decrement order quantity
window.decrementOrder = function(tableKey, type, orderId, price) {
    var path = (type === 'B') ? 'tablesB/' + tableKey + '/sent_orders/' + orderId : 'tablesC/' + tableKey + '/cooking_orders/' + orderId;
    get(ref(db, path)).then(function(snap) {
        if (snap.exists()) {
            var order = snap.val();
            var newQty = (order.quantity || 1) - 1;
            if (newQty > 0) {
                update(ref(db, path), { quantity: newQty });
                toast('تم الإنقاص', 'ts');
            } else {
                window.deleteOrder(tableKey, type, orderId);
            }
        }
    });
};

function renderTableChat(tKey) {
    var box = document.getElementById('dpChatMsgs');
    var msgsA = state.dMsgA[tKey] || {};
    var allMsgs = [];
    for (var id in msgsA) {
        var msg = msgsA[id];
        msg.src = 'client';
        allMsgs.push(msg);
    }
    allMsgs.sort(function(a, b) { return new Date(a.timestamp) - new Date(b.timestamp); });
    var html = '';
    for (var i = 0; i < allMsgs.length; i++) {
        var m = allMsgs[i];
        var t = new Date(m.timestamp).toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' });
        html += '<div class="cm from-client"><small style="opacity:.6;">زبون - ' + t + '</small><br>' + m.text + '</div>';
    }
    box.innerHTML = html || '<p style="text-align:center;padding:8px;">لا توجد رسائل.</p>';
    box.scrollTop = box.scrollHeight;
}

async function sendAdminReply() {
    if (!state.activeTable) return;
    var inp = document.getElementById('dpChatIn');
    var txt = inp.value.trim();
    if (!txt) return;
    await push(ref(db, 'msgB/' + state.activeTable), { text: txt, sender: 'admin', timestamp: new Date().toISOString() });
    inp.value = '';
}

document.getElementById('closeDetailBtn')?.addEventListener('click', closeDetail);
document.getElementById('sendReplyBtn')?.addEventListener('click', sendAdminReply);
document.getElementById('dpChatIn')?.addEventListener('keydown', function(e) { if (e.key === 'Enter') sendAdminReply(); });

// ========== Settings ==========
function loadSettingsUI() {
    var nameInput = document.getElementById('sName');
    var invoiceInput = document.getElementById('sInvoiceUrl');
    var clickSelect = document.getElementById('sClickSnd');
    var orderSelect = document.getElementById('sOrderSnd');
    var msgSelect = document.getElementById('sMsgSnd');
    
    if (nameInput) nameInput.value = state.settings.restaurantName || '';
    if (invoiceInput) invoiceInput.value = state.settings.invoiceQrUrl || '';
    if (clickSelect) clickSelect.value = state.settings.clickSound || 'off';
    if (orderSelect) {
        orderSelect.innerHTML = '<option value="off">بدون</option>';
        for (var i = 1; i <= 10; i++) {
            var option = document.createElement('option');
            option.value = 'sond' + i + '.mp3';
            option.textContent = 'صوت ' + i;
            if (state.settings.orderSound === 'sond' + i + '.mp3') option.selected = true;
            orderSelect.appendChild(option);
        }
        if (state.settings.orderSound && state.settings.orderSound !== 'off' && !state.settings.orderSound.startsWith('sond')) {
            var customOption = document.createElement('option');
            customOption.value = state.settings.orderSound;
            customOption.textContent = state.settings.orderSound;
            customOption.selected = true;
            orderSelect.appendChild(customOption);
        }
    }
    if (msgSelect) {
        msgSelect.innerHTML = '<option value="off">بدون</option>';
        for (var j = 1; j <= 10; j++) {
            var opt = document.createElement('option');
            opt.value = 'sond' + j + '.mp3';
            opt.textContent = 'صوت ' + j;
            if (state.settings.msgSound === 'sond' + j + '.mp3') opt.selected = true;
            msgSelect.appendChild(opt);
        }
        if (state.settings.msgSound && state.settings.msgSound !== 'off' && !state.settings.msgSound.startsWith('sond')) {
            var customOpt = document.createElement('option');
            customOpt.value = state.settings.msgSound;
            customOpt.textContent = state.settings.msgSound;
            customOpt.selected = true;
            msgSelect.appendChild(customOpt);
        }
    }
    syncLogoDisplay(state.settings.restaurantLogo || '');
    var brand = document.getElementById('brandName');
    if (brand) brand.textContent = state.settings.restaurantName || 'المطعم';
}

function syncLogoDisplay(dataUrl) {
    var img = document.getElementById('logoPreview');
    var ph = document.getElementById('logoPlaceholder');
    var hImg = document.getElementById('headerLogo');
    var hPh = document.getElementById('headerLogoPlaceholder');
    
    if (dataUrl && dataUrl.length > 10) {
        if (img) { img.src = dataUrl; img.style.display = 'block'; }
        if (ph) ph.style.display = 'none';
        if (hImg) { hImg.src = dataUrl; hImg.style.display = 'block'; }
        if (hPh) hPh.style.display = 'none';
    } else {
        if (img) { img.style.display = 'none'; img.src = ''; }
        if (ph) ph.style.display = 'flex';
        if (hImg) hImg.style.display = 'none';
        if (hPh) hPh.style.display = 'flex';
    }
}

function previewLogo(input) {
    if (!input.files || !input.files[0]) return;
    var file = input.files[0];
    var reader = new FileReader();
    reader.onload = function(e) {
        var img = new Image();
        img.onload = function() {
            var cv = document.createElement('canvas');
            var maxSize = 200;
            var w = img.width, h = img.height;
            if (w > maxSize || h > maxSize) {
                if (w > h) {
                    h = Math.round(h * maxSize / w);
                    w = maxSize;
                } else {
                    w = Math.round(w * maxSize / h);
                    h = maxSize;
                }
            }
            cv.width = w;
            cv.height = h;
            cv.getContext('2d').drawImage(img, 0, 0, w, h);
            state.pendingLogoData = cv.toDataURL('image/jpeg', 0.8);
            syncLogoDisplay(state.pendingLogoData);
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

async function saveSettings() {
    var n = document.getElementById('sName').value.trim();
    var invUrl = document.getElementById('sInvoiceUrl').value.trim();
    var os = document.getElementById('sOrderSnd').value;
    var ms = document.getElementById('sMsgSnd').value;
    var cs = document.getElementById('sClickSnd').value;
    var ns = { 
        restaurantName: n || 'المطعم', 
        orderSound: os, 
        msgSound: ms, 
        clickSound: cs, 
        invoiceQrUrl: invUrl 
    };
    if (state.pendingLogoData) ns.restaurantLogo = state.pendingLogoData;
    await update(ref(db, 'app_settings'), ns);
    state.settings = { ...state.settings, ...ns };
    var brand = document.getElementById('brandName');
    if (brand) brand.textContent = state.settings.restaurantName;
    toast('تم حفظ الإعدادات', 'ts');
}

var logoInput = document.getElementById('logoInput');
if (logoInput) {
    logoInput.addEventListener('change', function(e) { previewLogo(e.target); });
}
var saveBtn = document.getElementById('saveSettingsBtn');
if (saveBtn) saveBtn.addEventListener('click', saveSettings);

// Theme
function applyThemeByHue(hue) {
    var root = document.documentElement;
    root.style.setProperty('--accent', 'hsl(' + hue + ', 85%, 55%)');
    root.style.setProperty('--accent-light', 'hsl(' + hue + ', 85%, 65%)');
    root.style.setProperty('--accent-dim', 'hsla(' + hue + ', 85%, 55%, 0.08)');
    var preview = document.getElementById('themeColorPreview');
    if (preview) preview.style.background = 'hsl(' + hue + ', 85%, 55%)';
    localStorage.setItem('app_theme_hue', hue);
}

var themeSlider = document.getElementById('themeSlider');
if (themeSlider) {
    themeSlider.addEventListener('input', function(e) { applyThemeByHue(parseInt(e.target.value)); });
}
var savedHue = localStorage.getItem('app_theme_hue') || 35;
if (themeSlider) themeSlider.value = savedHue;
applyThemeByHue(parseInt(savedHue));

// Add CSS for action buttons
var style = document.createElement('style');
style.textContent = `
    .inv-actions {
        display: flex;
        gap: 5px;
        margin-right: 10px;
    }
    .inv-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 0;
        border-bottom: 1px dashed var(--border);
        font-size: 13px;
        color: var(--text-secondary);
        flex-wrap: wrap;
    }
    .dp-box {
        max-height: 300px;
        overflow-y: auto;
    }
`;
document.head.appendChild(style);

// ========== Authentication ==========
async function initLogin() {
    var versionsSnap = await get(ref(db, 'cobes'));
    state.dVersions = versionsSnap.val() || {};
    var usersSnap = await get(ref(db, 'users'));
    state.dUsers = usersSnap.val() || {};
    var settingsSnap = await get(ref(db, 'app_settings'));
    if (settingsSnap.exists()) {
        state.settings = { ...state.settings, ...settingsSnap.val() };
        loadSettingsUI();
    }
    
    var sv = localStorage.getItem('ops_device_version');
    var verField = document.getElementById('verField');
    if (sv && verField) verField.style.display = 'none';
    
    var ss = localStorage.getItem('ops_session');
    if (ss) {
        try {
            var sess = JSON.parse(ss);
            var snap = await get(ref(db, 'active_sessions/' + sess.sessionId));
            if (snap.exists()) {
                state.mySid = sess.sessionId;
                state.myUser = sess.username;
                state.myVersion = sess.version || sv;
                await initGeo();
                startRealtimeListeners();
                var loginOverlay = document.getElementById('loginOverlay');
                if (loginOverlay) loginOverlay.classList.add('hidden');
                return;
            } else {
                localStorage.removeItem('ops_session');
            }
        } catch(e) {
            localStorage.removeItem('ops_session');
        }
    }
    var loginOverlay = document.getElementById('loginOverlay');
    if (loginOverlay) loginOverlay.classList.remove('hidden');
}

async function doLogin() {
    var err = document.getElementById('loginErr');
    var btn = document.getElementById('btnLogin');
    if (err) err.textContent = '';
    if (btn) btn.disabled = true;
    
    var ver = localStorage.getItem('ops_device_version') || document.getElementById('inVer').value.trim();
    var user = document.getElementById('inUser').value.trim();
    var pass = document.getElementById('inPass').value.trim();
    
    if (!localStorage.getItem('ops_device_version')) {
        if (!ver) {
            if (err) err.textContent = 'أدخل رقم الإصدار';
            if (btn) btn.disabled = false;
            return;
        }
        var verExists = false;
        for (var vid in state.dVersions) {
            if (state.dVersions[vid].version_number === ver) {
                verExists = true;
                break;
            }
        }
        if (!verExists) {
            if (err) err.textContent = 'رقم الإصدار غير مسجل';
            if (btn) btn.disabled = false;
            return;
        }
        localStorage.setItem('ops_device_version', ver);
    }
    if (!user) {
        if (err) err.textContent = 'أدخل اسم المستخدم';
        if (btn) btn.disabled = false;
        return;
    }
    if (!pass) {
        if (err) err.textContent = 'أدخل كلمة السر';
        if (btn) btn.disabled = false;
        return;
    }
    
    var userValid = false;
    for (var uid in state.dUsers) {
        if (state.dUsers[uid].username === user && state.dUsers[uid].password === pass) {
            userValid = true;
            break;
        }
    }
    if (!userValid) {
        if (err) err.textContent = 'بيانات الدخول غير صحيحة';
        if (btn) btn.disabled = false;
        return;
    }
    
    // Close any active session for same user
    var allSnap = await get(ref(db, 'active_sessions'));
    if (allSnap.exists()) {
        var all = allSnap.val();
        for (var sid in all) {
            if (all[sid].username === user) {
                await remove(ref(db, 'active_sessions/' + sid));
            }
        }
    }
    
    state.mySid = genSid();
    state.myUser = user;
    state.myVersion = ver;
    await set(ref(db, 'active_sessions/' + state.mySid), { 
        username: user, 
        logged_in_at: new Date().toISOString(), 
        device_version: ver 
    });
    localStorage.setItem('ops_session', JSON.stringify({ 
        sessionId: state.mySid, 
        username: user, 
        version: ver 
    }));
    await initGeo();
    startRealtimeListeners();
    var loginOverlay = document.getElementById('loginOverlay');
    if (loginOverlay) loginOverlay.classList.add('hidden');
    audioUnlocked = true;
    toast('مرحباً ' + user, 'ts');
}

async function doLogout() {
    if (state.mySid) await remove(ref(db, 'active_sessions/' + state.mySid));
    localStorage.removeItem('ops_session');
    location.reload();
}

var loginBtn = document.getElementById('btnLogin');
if (loginBtn) loginBtn.addEventListener('click', doLogin);
var logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) logoutBtn.addEventListener('click', doLogout);
var passInput = document.getElementById('inPass');
if (passInput) {
    passInput.addEventListener('keydown', function(e) { 
        if (e.key === 'Enter') doLogin(); 
    });
}

function startRealtimeListeners() {
    onValue(ref(db, 'tablesA'), function(s) { 
        state.dA = s.val() || {}; 
        renderTables(); 
        loadTablesDropdown(); 
    });
    
    onValue(ref(db, 'tablesB'), function(s) { 
        var newData = s.val() || {};
        var oldCount = 0;
        for (var tk in state.dB) {
            if (state.dB[tk] && state.dB[tk].sent_orders) {
                oldCount += Object.keys(state.dB[tk].sent_orders).length;
            }
        }
        
        state.dB = newData;
        
        var newCount = 0;
        for (var tk2 in newData) {
            if (newData[tk2] && newData[tk2].sent_orders) {
                newCount += Object.keys(newData[tk2].sent_orders).length;
            }
        }
        
        if (state.activeTable) renderDetail();
        renderTables();
        
        // Start or stop order alarm based on pending orders
        if (newCount > 0) {
            startOrderAlarm();
        } else {
            stopOrderAlarm();
        }
        
        // Play sound when new order arrives
        if (newCount > oldCount) {
            var sound = state.settings.orderSound;
            if (sound !== 'off') {
                playSoundOnce(sound);
            }
        }
    });
    
    onValue(ref(db, 'tablesC'), function(s) { 
        state.dC = s.val() || {}; 
        if (state.activeTable) renderDetail(); 
        renderTables(); 
    });
    
    onValue(ref(db, 'msgA'), function(s) { 
        state.dMsgA = s.val() || {}; 
        if (state.activeTable) renderTableChat(state.activeTable); 
        renderTables(); 
    });
    
    onValue(ref(db, 'active_sessions'), function(s) {
        state.dSessions = s.val() || {};
        var chips = document.getElementById('userChips');
        if (chips) {
            chips.innerHTML = '';
            for (var id in state.dSessions) {
                chips.innerHTML += '<div class="u-chip"><span class="dot"></span>' + state.dSessions[id].username + '</div>';
            }
        }
        if (state.mySid && !state.dSessions[state.mySid]) {
            toast('تم تسجيل خروجك من جهاز آخر', 'te');
            setTimeout(function() { location.reload(); }, 2000);
        }
    });
    initCaptainChat();
}

// Tab switching
var tabBtns = document.querySelectorAll('.tab-btn');
for (var i = 0; i < tabBtns.length; i++) {
    tabBtns[i].addEventListener('click', function() {
        playClickSnd();
        var btns = document.querySelectorAll('.tab-btn');
        for (var j = 0; j < btns.length; j++) btns[j].classList.remove('active');
        var panels = document.querySelectorAll('.tab-panel');
        for (var k = 0; k < panels.length; k++) panels[k].classList.remove('active');
        this.classList.add('active');
        var panelId = this.getAttribute('data-tab');
        var panel = document.getElementById(panelId);
        if (panel) panel.classList.add('active');
    });
}

document.addEventListener('click', function() { 
    if (!audioUnlocked) audioUnlocked = true; 
}, { once: true });

var imgModal = document.getElementById('imgModal');
if (imgModal) {
    imgModal.addEventListener('click', function(e) { 
        if (e.target.id === 'imgModal') imgModal.classList.remove('open'); 
    });
}

initLogin();
