import { state } from './state.js';
import * as DB from './db.js';
import { fmt, playClickSnd, toast } from './utils.js';

let captainOrders = {};
let captainTable = null;
let menuLookup = {};

export function initCaptainPanel() {
    loadTablesDropdown();
    DB.listenOrders(data => {
        state.directMenuData = data || {};
        renderCaptainMenu(data);
    });
    listenCaptainOrders();
    listenCaptainChat();
}

function loadTablesDropdown() {
    const sel = document.getElementById('captainTableSelect');
    if(!sel) return;
    sel.innerHTML = '<option value="">-- اختر طاولة --</option>';
    
    for (let id in state.dA) {
        const t = state.dA[id];
        if (t && t.table_number) {
            const opt = document.createElement('option');
            opt.value = t.table_number;
            opt.textContent = 'طاولة ' + t.table_number;
            sel.appendChild(opt);
        }
    }
}

export function captainChangeTable(tableNum) {
    captainTable = tableNum;
    captainOrders = {};
    listenCaptainOrders();
    updateCaptainBar();
}

function renderCaptainMenu(data) {
    const c = document.getElementById('captainMenuCats');
    if(!c) return;
    c.innerHTML = '';
    menuLookup = {};

    if (!data) { c.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:30px;">المنيو فارغ حالياً.</p>'; return; }

    for (var catId in data) {
        var cat = data[catId]; var items = cat.items || {}; var itemHTML = "";
        for (var itemId in items) {
            var it = items[itemId]; 
            menuLookup[catId + "_" + itemId] = { name: it.name, price: it.price };
            var imgSrc = it.image || "";
            var key = catId + "_" + itemId;
            var qty = captainOrders[key] ? captainOrders[key].quantity : 0;

            itemHTML += `
            <div class="direct-item ${qty > 0 ? 'selected' : ''}" onclick="App.captainToggleItem('${key}')">
                ${imgSrc ? `<img src="${imgSrc}" alt="" style="width:100%;height:90px;object-fit:cover;border-radius:8px;margin-bottom:8px;">` : '<div style="width:100%;height:90px;background:var(--bg-input);border-radius:8px;display:flex;align-items:center;justify-content:center;margin-bottom:8px;"><i class="fas fa-image" style="color:var(--text-muted);font-size:24px;"></i></div>'}
                <h4 style="font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${it.name}</h4>
                <div style="font-size:15px;font-weight:900;color:var(--red);margin-top:4px;">${fmt(it.price)} د.ع</div>
                <div class="direct-qty" style="opacity:${qty > 0 ? '1' : '0'}; pointer-events:${qty > 0 ? 'all' : 'none'};">
                    <button class="dq-minus" onclick="event.stopPropagation(); App.captainQtyChange('${key}', -1)">−</button>
                    <span>${qty}</span>
                    <button class="dq-plus" onclick="event.stopPropagation(); App.captainQtyChange('${key}', 1)">+</button>
                </div>
            </div>`;
        }
        
        c.innerHTML += `<div style="margin-bottom:24px;">
            <h3 style="font-size:18px;font-weight:800;color:var(--accent);margin-bottom:12px;border-bottom:1px solid var(--border);padding-bottom:8px;">${cat.name}</h3>
            <div class="direct-grid">${itemHTML}</div>
        </div>`;
    }
}

export function captainToggleItem(key) {
    if (!captainTable) { toast('اختر طاولة أولاً', 'te'); return; }
    if (captainOrders[key]) { delete captainOrders[key]; } 
    else { captainOrders[key] = { quantity: 1 }; }
    updateCaptainBar();
    renderCaptainMenu(state.directMenuData);
}

export function captainQtyChange(key, delta) {
    if (!captainOrders[key]) captainOrders[key] = { quantity: 0 };
    captainOrders[key].quantity = Math.max(0, captainOrders[key].quantity + delta);
    if (captainOrders[key].quantity === 0) delete captainOrders[key];
    updateCaptainBar();
    renderCaptainMenu(state.directMenuData);
}

function updateCaptainBar() {
    const bar = document.getElementById('captainBottomBar');
    let count = 0, total = 0;
    for (let k in captainOrders) {
        const parts = k.split('_'); const catId = parts[0]; const itemId = parts.slice(1).join('_');
        const item = state.directMenuData[catId]?.items?.[itemId];
        if (item) { count += captainOrders[k].quantity; total += item.price * captainOrders[k].quantity; }
    }
    bar.style.display = count > 0 ? 'flex' : 'none';
    document.getElementById('captainBarCount').textContent = count;
    document.getElementById('captainBarTotal').textContent = 'الإجمالي: ' + fmt(total) + ' دينار';
}

export function captainOpenInvoice() {
    const ic = document.getElementById('captainInvItems');
    let total = 0; let html = '';
    for (let k in captainOrders) {
        const parts = k.split('_'); const catId = parts[0]; const itemId = parts.slice(1).join('_');
        const item = state.directMenuData[catId]?.items?.[itemId];
        if (item) {
            const qty = captainOrders[k].quantity; const sub = item.price * qty; total += sub;
            html += `<div class="inv-row" style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px dashed var(--border);">
                <span>${item.name} (${qty})</span><span>${fmt(sub)} د.ع</span>
            </div>`;
        }
    }
    ic.innerHTML = html || '<p style="color:var(--text-muted);text-align:center;padding:20px;">لا توجد طلبات.</p>';
    document.getElementById('captainInvTotal').textContent = 'الإجمالي: ' + fmt(total) + ' دينار';
    document.getElementById('captainInvoiceModal').classList.add('open');
}

export function captainSendOrder() {
    if (!captainTable) { toast('اختر طاولة أولاً', 'te'); return; }
    if (!Object.keys(captainOrders).length) { toast('السلة فارغة', 'te'); return; }

    const sr = DB.pushData('tablesB/table_' + captainTable + '/sent_orders', {});
    // نستخدم update لإضافة العناصر تحت المفتاح المولد
    const updates = {};
    for (let k in captainOrders) {
        const parts = k.split('_'); const catId = parts[0]; const itemId = parts.slice(1).join('_');
        const item = state.directMenuData[catId]?.items?.[itemId];
        if (item) {
            const newKey = DB.pushData('tablesB/table_' + captainTable + '/sent_orders', {
                name: item.name, price: item.price, quantity: captainOrders[k].quantity,
                settled_by: "captain", settled_at: new Date().toISOString()
            });
        }
    }

    DB.removeData('tablesA/table_' + captainTable + '/current_orders').then(() => {
        toast('تم إرسال الطلب للمطبخ بنجاح', 'ts');
        captainOrders = {};
        updateCaptainBar();
        renderCaptainMenu(state.directMenuData);
        document.getElementById('captainInvoiceModal').classList.remove('open');
    }).catch(() => toast('خطأ في الإرسال', 'te'));
}

function listenCaptainOrders() {
    if(!captainTable) return;
    DB.listenTablesA(data => { state.dA = data; loadTablesDropdown(); });
}

// ===== دردشة الكابتن مع الكاشير =====
let captainChatOn = false;
let captainChatsCache = {};
let currentCashierMsgCount = 0;
let unreadN = 0;
let alertTimeout = null;

function getReadCount() { return parseInt(localStorage.getItem('kabtnReadMsgCount') || '0'); }
function setReadCount(count) { localStorage.setItem('kabtnReadMsgCount', String(count)); }

function listenCaptainChat() {
    if(!state.myUser) return;
    DB.listenCaptainChat(state.myUser, data => {
        var prevCount = currentCashierMsgCount;
        captainChatsCache = data || {};
        
        var cashierMsgs = 0;
        for (var k in captainChatsCache) { if (captainChatsCache[k].sender === 'cashier') cashierMsgs++; }
        currentCashierMsgCount = cashierMsgs;

        if (currentCashierMsgCount > prevCount && !captainChatOn && prevCount >= 0) {
            showCashierAlert();
        }
        updateChatBadge(); renderCaptainChatMessages();  
    });
}

function renderCaptainChatMessages() {
    if (!captainChatOn) return; 
    var box = document.getElementById('captainChatMsgs'); box.innerHTML = ""; var msgs = [];
    for (var k in captainChatsCache) { var m = captainChatsCache[k]; m.src = (m.sender === 'captain') ? "client" : "cashier"; msgs.push(m); }
    msgs.sort(function(a, b) { return new Date(a.timestamp) - new Date(b.timestamp); });
    if (!msgs.length) { box.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:20px;font-size:13px;">ابدأ المحادثة مع الكاشير.</p>'; return; }
    for (var j = 0; j < msgs.length; j++) {
        var msg = msgs[j]; var t2 = new Date(msg.timestamp).toLocaleTimeString("ar-IQ", { hour: "2-digit", minute: "2-digit" });
        box.innerHTML += `<div class="cm ${msg.src === "client" ? "from-client" : "from-admin"}">
            <small style="opacity:.6;">${msg.src === "client" ? "أنت" : "الكاشير"} - ${t2}</small><br>${msg.text}
        </div>`;
    }
    box.scrollTop = box.scrollHeight;
}

function updateChatBadge() { 
    var cachedReadCount = getReadCount(); 
    unreadN = captainChatOn ? 0 : Math.max(0, currentCashierMsgCount - cachedReadCount); 
}

function showCashierAlert() {
    if (unreadN > 0 && !captainChatOn) {
        document.getElementById('cashierAlertBanner').style.display = 'flex';
    }
}

export function dismissCashierAlert() {
    document.getElementById('cashierAlertBanner').style.display = 'none';
    clearTimeout(alertTimeout);
    alertTimeout = setTimeout(function() { showCashierAlert(); }, 60000);
}

export function closeCaptainChat() { 
    captainChatOn = false; 
    document.getElementById('captainChatModal').classList.remove('open'); 
}

export function sendCaptainChat() {
    var inp = document.getElementById('captainChatIn'); var txt = inp.value.trim(); if (!txt || !state.myUser) return;
    DB.pushData('captain_chats/' + state.myUser, { text: txt, timestamp: new Date().toISOString(), sender: "captain", sender_name: "كابتن" }); 
    inp.value = "";
}
