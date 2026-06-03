import { state } from './state.js';
import * as DB from './db.js';
import { fmt, playClickSnd, playOnce, toast } from './utils.js';

export function renderGrid() {
    const grid = document.getElementById('tablesGrid');
    if (!grid) return;
    
    let occCount = 0, cookCount = 0, msgCount = 0, salesTotal = 0;
    let html = '';
    
    for (let id in state.dA) {
        const t = state.dA[id];
        if (!t || !t.table_number) continue;
        
        const tKey = 'table_' + t.table_number;
        const ordersB = (state.dB[tKey] && state.dB[tKey].sent_orders) ? state.dB[tKey].sent_orders : {};
        const ordersC = (state.dC[tKey] && state.dC[tKey].cooking_orders) ? state.dC[tKey].cooking_orders : {};
        const msgs = state.dMsgA[tKey] || {};
        
        const bCount = Object.keys(ordersB).length;
        const cCount = Object.keys(ordersC).length;
        const mCount = Object.keys(msgs).length;
        
        if (bCount > 0 || cCount > 0 || mCount > 0) {
            occCount++;
            cookCount += cCount;
            msgCount += mCount;
            
            // حساب المبيعات
            for(let k in ordersB) { if(ordersB[k].price) salesTotal += parseFloat(ordersB[k].price) * parseInt(ordersB[k].quantity || 1); }
            for(let k in ordersC) { if(ordersC[k].price) salesTotal += parseFloat(ordersC[k].price) * parseInt(ordersC[k].quantity || 1); }
        }
        
        html += `<div class="t-card ${bCount > 0 || cCount > 0 ? 'occupied' : ''}" onclick="App.openDetail('${tKey}')">
            <h3>طاولة ${t.table_number}</h3>
            <div class="t-badges">
                ${bCount > 0 ? `<div class="t-badge b-b"><span>طلبات</span><span>${bCount}</span></div>` : ''}
                ${cCount > 0 ? `<div class="t-badge b-c"><span>مطبخ</span><span>${cCount}</span></div>` : ''}
                ${mCount > 0 ? `<div class="t-badge b-m"><span>رسائل</span><span>${mCount}</span></div>` : ''}
            </div>
        </div>`;
    }
    
    grid.innerHTML = html || '<p style="color:var(--text-muted);text-align:center;padding:30px;grid-column:1/-1;">لا توجد طاولات مسجلة.</p>';
    
    document.getElementById('qsOcc').textContent = occCount;
    document.getElementById('qsCook').textContent = cookCount;
    document.getElementById('qsMsg').textContent = msgCount;
    document.getElementById('qsSales').textContent = fmt(salesTotal);
}

export function openDetail(tKey) {
    playClickSnd();
    state.activeTable = tKey;
    renderDetail();
    document.getElementById('detailPanel').classList.add('show');
}

export function closeDetail() {
    state.activeTable = null;
    document.getElementById('detailPanel').classList.remove('show');
}

export function renderDetail() {
    if (!state.activeTable) return;
    const tKey = state.activeTable;
    const tNum = tKey.replace('table_', '');
    
    document.getElementById('dpTitle').innerHTML = `<i class="fas fa-file-invoice"></i> طاولة ${tNum}`;
    
    // طلبات واردة (B)
    const ordersB = (state.dB[tKey] && state.dB[tKey].sent_orders) ? state.dB[tKey].sent_orders : {};
    const boxB = document.getElementById('dpBoxB');
    let bHtml = '';
    for (let k in ordersB) {
        const o = ordersB[k];
        bHtml += `<div class="inv-row">
            <span>${o.name || ''} (${o.quantity || 0})</span>
            <span>${fmt(o.price || 0)} د.ع</span>
        </div>`;
    }
    boxB.innerHTML = bHtml || '<p>لا توجد طلبات جديدة.</p>';
    
    // قيد المعالجة (C)
    const ordersC = (state.dC[tKey] && state.dC[tKey].cooking_orders) ? state.dC[tKey].cooking_orders : {};
    const boxC = document.getElementById('dpBoxC');
    let cHtml = '';
    for (let k in ordersC) {
        const o = ordersC[k];
        cHtml += `<div class="inv-row">
            <span>${o.name || ''} (${o.quantity || 0})</span>
            <span>${fmt(o.price || 0)} د.ع</span>
        </div>`;
    }
    boxC.innerHTML = cHtml || '<p>لا توجد وجبات في المطبخ.</p>';
    
    // الإجمالي
    let total = 0;
    for (let k in ordersB) { total += (parseFloat(ordersB[k].price) || 0) * (parseInt(ordersB[k].quantity) || 1); }
    for (let k in ordersC) { total += (parseFloat(ordersC[k].price) || 0) * (parseInt(ordersC[k].quantity) || 1); }
    document.getElementById('dpTotal').textContent = 'الإجمالي: ' + fmt(total) + ' دينار';
    
    // المحادثة
    renderChat(tKey);
}

function renderChat(tKey) {
    const box = document.getElementById('dpChatMsgs');
    const msgsA = state.dMsgA[tKey] || {};
    
    let allMsgs = [];
    for (let id in msgsA) allMsgs.push({ ...msgsA[id], src: 'client' });
    
    allMsgs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    let html = '';
    allMsgs.forEach(m => {
        const t = new Date(m.timestamp).toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' });
        html += `<div class="cm ${m.src === 'client' ? 'from-client' : 'from-admin'}">
            <small style="opacity:.6;">${m.src === 'client' ? 'زبون' : 'إدارة'} - ${t}</small><br>
            ${m.text}
        </div>`;
    });
    
    box.innerHTML = html || '<p style="color:var(--text-muted);font-size:11px;text-align:center;padding:8px;">لا توجد رسائل.</p>';
    box.scrollTop = box.scrollHeight;
}

export function sendAdminReply() {
    if (!state.activeTable) return;
    const inp = document.getElementById('dpChatIn');
    const txt = inp.value.trim();
    if (!txt) return;
    
    playClickSnd();
    DB.pushData('msgB/' + state.activeTable, { text: txt, sender: 'admin', timestamp: new Date().toISOString() });
    inp.value = '';
}

export function markRead(tKey) {
    const msgs = state.dMsgA[tKey] || {};
    const readC = state.dRead[tKey] || 0;
    const total = Object.keys(msgs).length;
    if (total > readC) {
        DB.setData('read_counters/' + tKey, total);
    }
}

export function updateSales() {
    // يتم حساب المبيعات تلقائياً في renderGrid
}

// دوال الطباعة والتسديد يتم تحويلها لمجرد تنبيهات لضمان عدم حدوث أخطاء إذا تم استدعاؤها
export function printToKitchen() { toast('لطباعة الطلبات، يرجى استخدام شاشة الكمبيوتر الرئيسية', 'ti'); return; }
export function settleInvoice() { toast('لتسديد الحسابات، يرجى استخدام شاشة الكمبيوتر الرئيسية', 'ti'); return; }
export function rePrintKitchenOrder() { toast('لإعادة الطباعة، يرجى استخدام شاشة الكمبيوتر الرئيسية', 'ti'); return; }
