import { state } from './state.js';
import * as DB from './db.js';
import { fmt, sameDay, playClickSnd, playOnce, alarmOrder, alarmMsg, toast, drawDash } from './utils.js';

export function renderGrid() {
    const g = document.getElementById('tablesGrid'); g.innerHTML = '';
    let occ = 0, cook = 0, unread = 0, po = false, pm = false, arr = [];
    Object.keys(state.dA).forEach(k => {
        const tn = state.dA[k].table_number;
        const cB = state.dB[k] && state.dB[k].sent_orders ? Object.keys(state.dB[k].sent_orders).length : 0;
        const cC = state.dC[k] && state.dC[k].processing_orders ? Object.keys(state.dC[k].processing_orders).length : 0;
        const tm = state.dMsgA[k] ? Object.keys(state.dMsgA[k]).length : 0;
        const lr = state.dRead[k] || 0; const um = tm > lr ? (tm - lr) : 0;
        if (cB > 0) po = true; if (um > 0) pm = true; if ((cB + cC) > 0) occ++; cook += cC; unread += um;
        arr.push({ k, tn, cB, cC, um, pri: (cB * 500) + (um * 200) + cC });
    });
    document.getElementById('qsOcc').innerText = occ; document.getElementById('qsCook').innerText = cook; document.getElementById('qsMsg').innerText = unread;
    const badge = document.getElementById('badgeOps'); const total = occ + unread;
    if (total > 0) { badge.textContent = total; badge.classList.add('show'); } else badge.classList.remove('show');
    alarmOrder(po); alarmMsg(pm);
    arr.sort((a, b) => b.pri - a.pri || parseInt(a.tn) - parseInt(b.tn));
    arr.forEach(t => {
        const c = document.createElement('div'); c.className = 't-card ' + ((t.cB + t.cC) > 0 ? 'occupied' : '');
        c.onclick = () => openDetail(t.tn);
        c.innerHTML = '<h3>طاولة ' + t.tn + '</h3><div class="t-badges">' +
            (t.cB > 0 ? '<div class="t-badge b-b"><span>📥 وارد:</span><span>' + t.cB + '</span></div>' : '') +
            (t.cC > 0 ? '<div class="t-badge b-c"><span>🍳 مطبخ:</span><span>' + t.cC + '</span></div>' : '') +
            (t.um > 0 ? '<div class="t-badge b-m"><span>💬 رسالة:</span><span>' + t.um + '</span></div>' : '') + '</div>';
        g.appendChild(c);
    });
}

export function openDetail(tn) { playClickSnd(); state.activeTable = tn; document.getElementById('detailPanel').classList.add('show'); renderDetail(); listenChat(tn); markRead(tn); }
export function closeDetail() { state.activeTable = null; document.getElementById('detailPanel').classList.remove('show'); }

export function markRead(tn) { const k = 'table_' + tn, ct = state.dMsgA[k] ? Object.keys(state.dMsgA[k]).length : 0; if (ct !== (state.dRead[k] || 0)) DB.setData('read_counters/' + k, ct); }

export function renderDetail() {
    const tn = state.activeTable; if (!tn) return;
    document.getElementById('dpTitle').innerHTML = '<i class="fas fa-file-invoice"></i> فاتورة طاولة [ ' + tn + ' ]';
    const k = 'table_' + tn; let total = 0;

    const bB = document.getElementById('dpBoxB'), oB = state.dB[k] && state.dB[k].sent_orders ? state.dB[k].sent_orders : null;
    bB.innerHTML = ''; 
    
    if (oB) { 
        for (let id in oB) { 
            const s = oB[id].price * oB[id].quantity; 
            total += s; 
            bB.innerHTML += `
                <div class="inv-row" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:8px; padding:8px; background:var(--bg-input); border-radius:8px; border:1px solid var(--border);">
                    <div style="display:flex; align-items:center; gap:10px; flex:1;">
                        <span style="font-weight:700;">${oB[id].name}</span>
                        <div style="display:flex; align-items:center; gap:4px;">
                            <button class="btn-secondary btn-sm" style="padding:2px 8px; font-size:14px;" onclick="App.changeSentOrderQty('${k}','${id}',-1)">−</button>
                            <span style="font-weight:900; min-width:20px; text-align:center;">${oB[id].quantity}</span>
                            <button class="btn-secondary btn-sm" style="padding:2px 8px; font-size:14px;" onclick="App.changeSentOrderQty('${k}','${id}',1)">+</button>
                        </div>
                    </div>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span style="color:var(--red); font-weight:700;">${fmt(s)} د.ع</span>
                        <button class="btn-secondary btn-sm btn-red" onclick="App.deleteSentOrder('${k}','${id}')"><i class="fas fa-trash"></i></button>
                    </div>
                </div>`; 
        } 
    } else { 
        bB.innerHTML = '<p>لا توجد طلبات جديدة.</p>'; 
    }

    const bC = document.getElementById('dpBoxC'), oC = state.dC[k] && state.dC[k].processing_orders ? state.dC[k].processing_orders : null;
    bC.innerHTML = ''; 
    
    if (oC) { 
        for (let id in oC) { 
            const s = oC[id].price * oC[id].quantity; 
            total += s; 
            bC.innerHTML += '<div class="inv-row"><span>' + oC[id].name + ' (x' + oC[id].quantity + ')</span><span style="color:var(--blue);">' + fmt(s) + ' د.ع</span></div>'; 
        } 
        bC.innerHTML += '<div style="margin-top:14px; text-align:center;"><button class="btn-secondary btn-sm" onclick="App.rePrintKitchenOrder()"><i class="fas fa-print"></i> إعادة طباعة بون المطبخ</button></div>';
    } else { 
        bC.innerHTML = '<p>لا توجد وجبات في المطبخ.</p>'; 
    }

    document.getElementById('dpTotal').textContent = 'الإجمالي: ' + fmt(total) + ' دينار';
}

function listenChat(tn) {
    const box = document.getElementById('dpChatMsgs'), k = 'table_' + tn;
    DB.listenTableChat(k, (dataA, dataB) => {
        box.innerHTML = ''; let m = [];
        if (dataA) Object.values(dataA).forEach(x => { x.src = 'client'; m.push(x); });
        if (dataB) Object.values(dataB).forEach(x => { x.src = 'admin'; m.push(x); });
        m.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        if (!m.length) { box.innerHTML = '<p style="color:var(--text-muted);font-size:11px;text-align:center;padding:8px;">لا توجد رسائل.</p>'; return; }
        m.forEach(x => { box.innerHTML += '<div class="cm ' + (x.src === 'client' ? 'from-client' : 'from-admin') + '">' + x.text + '</div>'; });
        box.scrollTop = box.scrollHeight;
    });
}

export function sendAdminReply() { const i = document.getElementById('dpChatIn'), t = i.value.trim(); if (!t || !state.activeTable) return; playClickSnd(); DB.pushData('msgB/table_' + state.activeTable, { text: t, timestamp: new Date().toISOString() }); i.value = ''; }

function buildReceiptCanvas(cfg) {
    // العرض الكلي المتناسق للهوامش الآمنة
    const PW = 580, ML = 12; 
    const hasLogo = !!(state.settings.restaurantLogo && state.settings.restaurantLogo.length > 20); 
    const hasQR = !!(state.settings.invoiceQrUrl && state.settings.invoiceQrUrl.trim()) && cfg.final; 
    const ti = cfg.items ? cfg.items.length : 0; 
    const qrPx = 180, logoPx = 160; 
    
    let y = ML * 3; 
    if (hasLogo) y += logoPx + ML * 2; 
    y += ML * 6 + ML * 5 + ML * 3 + ML * 5 + ML * 5 + ML * 3 + ML * 5 + ML * 3 + ti * (ML * 8); 
    if (cfg.final) y += ML * 4 + ML * 7; 
    y += ML * 5; 
    if (hasQR) y += ML * 2 + qrPx + ML * 2; 
    y += ML * 4; 
    
    const cv = document.createElement('canvas'); 
    cv.width = PW; 
    cv.height = Math.max(y, ML * 25); 
    const cx = cv.getContext('2d'); 
    
    // إيقاف تنعيم الحواف لضمان أقصى حدة للبكسلات
    cx.imageSmoothingEnabled = false;
    cx.mozImageSmoothingEnabled = false;
    cx.webkitImageSmoothingEnabled = false;
    cx.msImageSmoothingEnabled = false;
    
    cx.fillStyle = '#ffffff'; 
    cx.fillRect(0, 0, PW, cv.height); 
    
    y = ML * 3; 
    if (hasLogo) { 
        try { 
            const img = new Image(); 
            img.src = state.settings.restaurantLogo; 
            cx.drawImage(img, (PW - logoPx) / 2, y, logoPx, logoPx); 
            y += logoPx + ML * 2; 
        } catch (e) { } 
    } 
    
    cx.textBaseline = 'middle'; 
    cx.textAlign = 'center'; 
    cx.fillStyle = '#000000'; 
    
    // دالة داخلية سحرية لرسم نصوص سميكة جداً ومصمتة لمنع تقطع الحبر الحراري
    const printSolidText = (text, x, yValue) => {
        cx.fillText(text, x, yValue);
        cx.fillText(text, x + 0.5, yValue);
        cx.fillText(text, x, yValue + 0.5);
    };
    
    // 1. العنوان الرئيسي
    cx.font = '900 38px Arial, Helvetica, sans-serif'; 
    printSolidText(state.settings.restaurantName || 'المطعم', PW / 2, y); 
    
    // 2. عبارة الترحيب
    y += ML * 6; 
    cx.font = 'bold 24px Arial, Helvetica, sans-serif'; 
    printSolidText(cfg.welcome || 'شكراً لزيارتكم', PW / 2, y); 
    
    y += ML * 5; 
    drawDash(cx, 40, PW - 40, y); 
    
    // 3. نوع الفاتورة
    y += ML * 3; 
    cx.font = '900 32px Arial, Helvetica, sans-serif'; 
    printSolidText(cfg.title, PW / 2, y); 
    
    // 4. تفاصيل الفاتورة (الطاولة والوقت والكاشير)
    y += ML * 5; 
    cx.font = 'bold 22px Arial, Helvetica, sans-serif'; 
    printSolidText('طاولة: [' + cfg.tableNum + ']   ' + cfg.dt + '   ' + cfg.cashier, PW / 2, y); 
    
    y += ML * 5; 
    drawDash(cx, 40, PW - 40, y); 
    
    // 5. الهيدر الخاص بجدول المواد
    y += ML * 3; 
    cx.font = 'bold 24px Arial, Helvetica, sans-serif'; 
    
    cx.textAlign = 'right'; 
    printSolidText('المادة', PW - 60, y); 
    
    cx.textAlign = 'center'; 
    printSolidText('العدد', PW / 2 + 40, y); 
    
    if (cfg.final) { 
        cx.textAlign = 'left'; 
        printSolidText('السعر', 60, y); 
    } 
    
    y += ML * 4; 
    drawDash(cx, 40, PW - 40, y, 1); 
    
    // 6. تفاصيل المنتجات والوجبات
    y += ML * 4; 
    cx.font = 'bold 23px Arial, Helvetica, sans-serif'; // تضخيم بسيط لحجم الخط للحفاظ على الحبر
    
    cfg.items.forEach(i => { 
        cx.fillStyle = '#000000'; 
        
        let nm = i.name; 
        let maxW = (cfg.final ? PW * 0.50 : PW * 0.70); 
        
        cx.textAlign = 'right';
        if (cx.measureText(nm).width > maxW) { 
            while (cx.measureText(nm + '…').width > maxW && nm.length > 1) { 
                nm = nm.slice(0, -1); 
            } 
            nm += '…'; 
        } 
        
        // رسم اسم المنتج بالتقنية المصمتة
        printSolidText(nm, PW - 60, y); 
        
        cx.textAlign = 'center'; 
        printSolidText('x' + i.qty, PW / 2 + 40, y); 
        
        if (cfg.final) { 
            cx.textAlign = 'left'; 
            printSolidText(fmt(i.price * i.qty), 60, y); 
        } 
        
        y += ML * 5; 
        cx.strokeStyle = '#000000'; 
        cx.lineWidth = 2; // زيادة سمك خطوط التقسيم المتقطعة لتظهر بوضوح ثابته
        cx.setLineDash([4, 4]); 
        cx.beginPath(); 
        cx.moveTo(40, y); 
        cx.lineTo(PW - 40, y); 
        cx.stroke(); 
        cx.setLineDash([]); 
        y += ML * 4; 
    }); 
    
    // 7. المجموع الإجمالي للفاتورة
    if (cfg.final) { 
        cx.strokeStyle = '#000000'; 
        cx.lineWidth = 3; 
        cx.setLineDash([]); 
        cx.beginPath(); 
        cx.moveTo(40, y); 
        cx.lineTo(PW - 40, y); 
        cx.stroke(); 
        y += ML * 5; 
        cx.font = '900 34px Arial, Helvetica, sans-serif'; 
        
        cx.textAlign = 'right'; 
        printSolidText('المجموع:', PW - 60, y); 
        
        cx.textAlign = 'left'; 
        printSolidText(fmt(cfg.total) + ' د.ع', 60, y); 
        y += ML * 6; 
    } 
    
    cx.strokeStyle = '#000000'; 
    cx.lineWidth = 2.5; 
    cx.setLineDash([]); 
    cx.beginPath(); 
    cx.moveTo(40, y); 
    cx.lineTo(PW - 40, y); 
    cx.stroke(); 
    y += ML * 4; 
    
    // 8. الباركود (QR Code)
    if (hasQR) { 
        try { 
            const qrDiv = document.createElement('div'); 
            new QRCode(qrDiv, { text: state.settings.invoiceQrUrl, width: qrPx, height: qrPx, colorDark: '#000000', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.M }); 
            const qrC = qrDiv.querySelector('canvas'); 
            if (qrC) { 
                cx.drawImage(qrC, (PW - qrPx) / 2, y, qrPx, qrPx); 
                y += qrPx + ML * 2; 
            } 
        } catch (e) { y += qrPx; } 
    } 
    return cv;
}
async function printToSelectedPrinters(printers, cfg) {
    const cv = buildReceiptCanvas(cfg);
    const imgData = cv.toDataURL('image/jpeg', 0.85);
    let successCount = 0;
    let failCount = 0;
    toast(`جاري الطباعة على ${printers.length} طابعة...`, 'ti');
    for (const printer of printers) {
        try {
            const response = await fetch('http://127.0.0.1:5000/print-receipt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ printerName: printer.ip, image: imgData }) 
            });
            const data = await response.json();
            if (data.status === 'success') {
                successCount++;
            } else {
                failCount++;
            }
        } catch (err) {
            failCount++;
            console.error(`خطأ في الطباعة على ${printer.ip}:`, err);
        }
    }
    if (successCount > 0) {
        toast(`تمت الطباعة على ${successCount} طابعة${failCount > 0 ? `، فشل ${failCount}` : ''}`, successCount === printers.length ? 'ts' : 'ti');
    } else {
        toast('فشلت الطباعة على جميع الطابعات', 'te');
    }
}

export async function printToKitchen() {
    const k = 'table_' + state.activeTable, 
          oB = state.dB[k] && state.dB[k].sent_orders ? state.dB[k].sent_orders : null;
    if (!oB || !Object.keys(oB).length) { toast('لا توجد طلبات واردة', 'te'); return; }

    const printers = window.App.getButtonPrinters('kitchen');
    if (printers.length === 0) { toast('الرجاء تعيين طابعات لزر المطبخ', 'te'); return; }

    let items = [];
    for (let id in oB) items.push({ name: oB[id].name, qty: oB[id].quantity, price: oB[id].price });

    await printToSelectedPrinters(printers, {
        title: 'بون التجهيز', tableNum: state.activeTable, dt: new Date().toLocaleString('ar-IQ', { hour12: true }),
        items, final: false, cashier: state.myUser, welcome: 'برجاء تجهيز الطلبات بأسرع وقت'
    });

    for (let id in oB) DB.pushData('tablesC/' + k + '/processing_orders', { name: oB[id].name, price: oB[id].price, quantity: oB[id].quantity });
    DB.removeData('tablesB/' + k);
    toast('تم إرسال الطلبات للمطبخ', 'ts');
}

export async function rePrintKitchenOrder() {
    const k = 'table_' + state.activeTable, 
          oC = state.dC[k] && state.dC[k].processing_orders ? state.dC[k].processing_orders : null;
    if (!oC || !Object.keys(oC).length) { toast('لا توجد طلبات في المطبخ', 'te'); return; }
    
    const printers = window.App.getButtonPrinters('kitchen');
    if (printers.length === 0) { toast('الرجاء تعيين طابعات للمطبخ', 'te'); return; }

    let items = [];
    for (let id in oC) items.push({ name: oC[id].name, qty: oC[id].quantity, price: oC[id].price });

    await printToSelectedPrinters(printers, {
        title: 'بون التجهيز (نسخة)', tableNum: state.activeTable, dt: new Date().toLocaleString('ar-IQ', { hour12: true }),
        items, final: false, cashier: state.myUser, welcome: 'برجاء تجهيز الطلبات بأسرع وقت'
    });
}

export function changeSentOrderQty(tableKey, itemId, delta) {
    playClickSnd();
    const orders = state.dB[tableKey]?.sent_orders;
    if (!orders || !orders[itemId]) return;
    let newQty = (parseInt(orders[itemId].quantity) || 0) + delta;
    if (newQty <= 0) { deleteSentOrder(tableKey, itemId); } 
    else { DB.updateData(`tablesB/${tableKey}/sent_orders/${itemId}`, { quantity: newQty }); }
}

export function deleteSentOrder(tableKey, itemId) {
    if (confirm('هل تريد حذف هذا الصنف من الطلب؟')) {
        DB.removeData(`tablesB/${tableKey}/sent_orders/${itemId}`);
    }
}

export async function settleInvoice() {
    const k = 'table_' + state.activeTable, 
          oB = state.dB[k] && state.dB[k].sent_orders ? state.dB[k].sent_orders : {},
          oC = state.dC[k] && state.dC[k].processing_orders ? state.dC[k].processing_orders : {};
    
    if (!Object.keys(oB).length && !Object.keys(oC).length) { toast('لا توجد طلبات', 'te'); return; }

    const printers = window.App.getButtonPrinters('cashier');
    if (printers.length === 0) { toast('الرجاء تعيين طابعات لزر تسديد الحساب', 'te'); return; }

    let items = [], total = 0;
    const combined = { ...oB, ...oC };
    for (let id in combined) {
        let s = combined[id].price * combined[id].quantity; total += s;
        items.push({ name: combined[id].name, qty: combined[id].quantity, price: combined[id].price });
    }

    await printToSelectedPrinters(printers, {
        title: 'إيصال الدفع', tableNum: state.activeTable, dt: new Date().toLocaleString('ar-IQ', { hour12: true }),
        items, final: true, total, cashier: state.myUser, welcome: 'نتمنى لكم تجربة مميزة، شكراً لاختياركم'
    });

    const sa = new Date().toISOString();
    for (let id in oB) DB.pushData('tablesD/archive_orders', { table_number: state.activeTable, name: oB[id].name, price: oB[id].price, quantity: oB[id].quantity, settled_at: sa, settled_by: state.myUser });
    for (let id in oC) DB.pushData('tablesD/archive_orders', { table_number: state.activeTable, name: oC[id].name, price: oC[id].price, quantity: oC[id].quantity, settled_at: sa, settled_by: state.myUser });

    Promise.all([
        DB.removeData('tablesB/' + k), DB.removeData('tablesC/' + k), DB.removeData('msgA/' + k), DB.removeData('msgB/' + k), DB.removeData('read_counters/' + k)
    ]).then(() => { toast('تم تسديد فاتورة ' + state.activeTable, 'ts'); closeDetail(); });
}

export async function printDirectReceipt(items, total) {
    const printers = window.App.getButtonPrinters('direct');
    if (printers.length === 0) { toast('الرجاء تعيين طابعات لزر التسوق المباشر', 'te'); return; }

    await printToSelectedPrinters(printers, {
        title: 'إيصال الدفع - تسوق مباشر', tableNum: 'سفري', dt: new Date().toLocaleString('ar-IQ', { hour12: true }),
        items, final: true, total, cashier: state.myUser, welcome: 'شكراً لزيارتكم، نتمنى لكم تجربة مميزة'
    });
}

export function updateSales() {
    if (!state.myUser) return;
    let t = 0;
    for (let id in state.dD) {
        const o = state.dD[id];
        if (o && o.settled_by === state.myUser && sameDay(o.settled_at)) t += (parseFloat(o.price) || 0) * (parseInt(o.quantity) || 1);
    }
    const directOrders = JSON.parse(localStorage.getItem('direct_orders_archive') || '[]');
    directOrders.forEach(order => { if (order.settled_by === state.myUser && sameDay(order.settled_at)) t += order.total || 0; });
    document.getElementById('qsSales').textContent = fmt(t);
}
