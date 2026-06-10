// panelOps.js
import { state } from './state.js';
import * as DB from './db.js';
import { fmt, sameDay, playClickSnd, playOnce, alarmOrder, alarmMsg, toast, drawDash } from './utils.js';

var isMainDevice = (localStorage.getItem('device_role') === 'main');

// ===== دوال الطباعة المنفذة فعلياً (للكمبيوتر فقط) =====
export async function executePrintKitchen(commandData) {
    var printers = window.App.getButtonPrinters('kitchen');
    if (printers.length === 0) { 
        toast('الرجاء تعيين طابعات لزر المطبخ', 'te'); 
        return; 
    }
    
    var items = [];
    for (var id in commandData.orders) {
        items.push({ 
            name: commandData.orders[id].name, 
            qty: commandData.orders[id].quantity, 
            price: commandData.orders[id].price 
        });
    }
    
    await printToSelectedPrinters(printers, {
        title: 'بون التجهيز', 
        tableNum: commandData.tableId.replace('table_', ''), 
        dt: new Date().toLocaleString('ar-IQ', { hour12: true }),
        items: items, 
        final: false, 
        cashier: commandData.requestedBy || 'نظام', 
        welcome: 'برجاء تجهيز الطلبات بأسرع وقت'
    });
    
    console.log('✅ تمت طباعة بون المطبخ');
}

export async function executePrintCashier(commandData) {
    var printers = window.App.getButtonPrinters('cashier');
    if (printers.length === 0) { 
        toast('الرجاء تعيين طابعات لزر تسديد الحساب', 'te'); 
        return; 
    }
    
    await printToSelectedPrinters(printers, {
        title: 'إيصال الدفع', 
        tableNum: commandData.tableId.replace('table_', ''), 
        dt: new Date().toLocaleString('ar-IQ', { hour12: true }),
        items: commandData.items, 
        final: true, 
        total: commandData.total, 
        cashier: commandData.cashier, 
        welcome: 'نتمنى لكم تجربة مميزة، شكراً لاختياركم'
    });
    
    console.log('✅ تمت طباعة إيصال الدفع');
}

export async function executePrintDirect(commandData) {
    var printers = window.App.getButtonPrinters('direct');
    if (printers.length === 0) { 
        toast('الرجاء تعيين طابعات لزر التسوق المباشر', 'te'); 
        return; 
    }
    
    await printToSelectedPrinters(printers, {
        title: 'إيصال الدفع - تسوق مباشر', 
        tableNum: 'سفري', 
        dt: new Date().toLocaleString('ar-IQ', { hour12: true }),
        items: commandData.items, 
        final: true, 
        total: commandData.total, 
        cashier: commandData.cashier, 
        welcome: 'شكراً لزيارتكم، نتمنى لكم تجربة مميزة'
    });
    
    console.log('✅ تمت طباعة إيصال التسوق المباشر');
}

// ===== دوال العرض الأساسية =====
export function renderGrid() {
    var g = document.getElementById('tablesGrid'); 
    if (!g) return;
    g.innerHTML = '';
    var occ = 0, cook = 0, unread = 0, po = false, pm = false, arr = [];
    
    for (var k in state.dA) {
        var tn = state.dA[k].table_number;
        var cB = state.dB[k] && state.dB[k].sent_orders ? Object.keys(state.dB[k].sent_orders).length : 0;
        var cC = state.dC[k] && state.dC[k].processing_orders ? Object.keys(state.dC[k].processing_orders).length : 0;
        var tm = state.dMsgA[k] ? Object.keys(state.dMsgA[k]).length : 0;
        var lr = state.dRead[k] || 0; 
        var um = tm > lr ? (tm - lr) : 0;
        if (cB > 0) po = true; 
        if (um > 0) pm = true; 
        if ((cB + cC) > 0) occ++; 
        cook += cC; 
        unread += um;
        arr.push({ k: k, tn: tn, cB: cB, cC: cC, um: um, pri: (cB * 500) + (um * 200) + cC });
    }
    
    var qsOcc = document.getElementById('qsOcc');
    var qsCook = document.getElementById('qsCook');
    var qsMsg = document.getElementById('qsMsg');
    if (qsOcc) qsOcc.innerText = occ;
    if (qsCook) qsCook.innerText = cook;
    if (qsMsg) qsMsg.innerText = unread;
    
    var badge = document.getElementById('badgeOps'); 
    var total = occ + unread;
    if (total > 0 && badge) { 
        badge.textContent = total; 
        badge.classList.add('show'); 
    } else if (badge) { 
        badge.classList.remove('show');
    }
    
    alarmOrder(po); 
    alarmMsg(pm);
    
    arr.sort(function(a, b) { return b.pri - a.pri || parseInt(a.tn) - parseInt(b.tn); });
    
    for (var i = 0; i < arr.length; i++) {
        var t = arr[i];
        var c = document.createElement('div'); 
        c.className = 't-card ' + ((t.cB + t.cC) > 0 ? 'occupied' : '');
        c.onclick = (function(tn) { return function() { openDetail(tn); }; })(t.tn);
        c.innerHTML = '<h3>طاولة ' + t.tn + '</h3><div class="t-badges">' +
            (t.cB > 0 ? '<div class="t-badge b-b"><span>📥 وارد:</span><span>' + t.cB + '</span></div>' : '') +
            (t.cC > 0 ? '<div class="t-badge b-c"><span>🍳 مطبخ:</span><span>' + t.cC + '</span></div>' : '') +
            (t.um > 0 ? '<div class="t-badge b-m"><span>💬 رسالة:</span><span>' + t.um + '</span></div>' : '') + '</div>';
        g.appendChild(c);
    }
}

export function openDetail(tn) { 
    playClickSnd(); 
    state.activeTable = tn; 
    var detailPanel = document.getElementById('detailPanel');
    if (detailPanel) detailPanel.classList.add('show'); 
    renderDetail(); 
    listenChat(tn); 
    markRead(tn); 
}

export function closeDetail() { 
    state.activeTable = null; 
    var detailPanel = document.getElementById('detailPanel');
    if (detailPanel) detailPanel.classList.remove('show'); 
}

export function markRead(tn) { 
    var k = 'table_' + tn; 
    var ct = state.dMsgA[k] ? Object.keys(state.dMsgA[k]).length : 0; 
    if (ct !== (state.dRead[k] || 0)) DB.setData('read_counters/' + k, ct); 
}

export function renderDetail() {
    var tn = state.activeTable; 
    if (!tn) return;
    
    var dpTitle = document.getElementById('dpTitle');
    if (dpTitle) dpTitle.innerHTML = '<i class="fas fa-file-invoice"></i> فاتورة طاولة [ ' + tn + ' ]';
    
    var k = 'table_' + tn; 
    var total = 0;

    var bB = document.getElementById('dpBoxB');
    var oB = state.dB[k] && state.dB[k].sent_orders ? state.dB[k].sent_orders : null;
    if (bB) bB.innerHTML = ''; 
    
    if (oB) { 
        for (var id in oB) { 
            var s = oB[id].price * oB[id].quantity; 
            total += s; 
            if (bB) {
                bB.innerHTML += '<div class="inv-row" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:8px; padding:8px; background:var(--bg-input); border-radius:8px; border:1px solid var(--border);">' +
                    '<div style="display:flex; align-items:center; gap:10px; flex:1;">' +
                    '<span style="font-weight:700;">' + oB[id].name + '</span>' +
                    '<div style="display:flex; align-items:center; gap:4px;">' +
                    '<button class="btn-secondary btn-sm" style="padding:2px 8px; font-size:14px;" onclick="App.changeSentOrderQty(\'' + k + '\',\'' + id + '\',-1)">−</button>' +
                    '<span style="font-weight:900; min-width:20px; text-align:center;">' + oB[id].quantity + '</span>' +
                    '<button class="btn-secondary btn-sm" style="padding:2px 8px; font-size:14px;" onclick="App.changeSentOrderQty(\'' + k + '\',\'' + id + '\',1)">+</button>' +
                    '</div></div>' +
                    '<div style="display:flex; align-items:center; gap:10px;">' +
                    '<span style="color:var(--red); font-weight:700;">' + fmt(s) + ' د.ع</span>' +
                    '<button class="btn-secondary btn-sm btn-red" onclick="App.deleteSentOrder(\'' + k + '\',\'' + id + '\')"><i class="fas fa-trash"></i></button>' +
                    '</div></div>';
            }
        } 
    } else if (bB) { 
        bB.innerHTML = '<p>لا توجد طلبات جديدة.</p>'; 
    }

    var bC = document.getElementById('dpBoxC');
    var oC = state.dC[k] && state.dC[k].processing_orders ? state.dC[k].processing_orders : null;
    if (bC) bC.innerHTML = ''; 
    
    if (oC) { 
        for (var id in oC) { 
            var s = oC[id].price * oC[id].quantity; 
            total += s; 
            if (bC) {
                bC.innerHTML += '<div class="inv-row" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:8px; padding:8px; background:var(--bg-input); border-radius:8px; border:1px solid var(--border);">' +
                    '<div style="display:flex; align-items:center; gap:10px; flex:1;">' +
                    '<span style="font-weight:700;">' + oC[id].name + '</span>' +
                    '<div style="display:flex; align-items:center; gap:4px;">' +
                    '<button class="btn-secondary btn-sm" style="padding:2px 8px; font-size:14px;" onclick="App.changeProcessingOrderQty(\'' + k + '\',\'' + id + '\',-1)">−</button>' +
                    '<span style="font-weight:900; min-width:20px; text-align:center;">' + oC[id].quantity + '</span>' +
                    '<button class="btn-secondary btn-sm" style="padding:2px 8px; font-size:14px;" onclick="App.changeProcessingOrderQty(\'' + k + '\',\'' + id + '\',1)">+</button>' +
                    '</div></div>' +
                    '<div style="display:flex; align-items:center; gap:10px;">' +
                    '<span style="color:var(--blue); font-weight:700;">' + fmt(s) + ' د.ع</span>' +
                    '<button class="btn-secondary btn-sm btn-red" onclick="App.deleteProcessingOrder(\'' + k + '\',\'' + id + '\')"><i class="fas fa-trash"></i></button>' +
                    '</div></div>';
            }
        } 
        if (bC) {
            bC.innerHTML += '<div style="margin-top:14px; text-align:center;"><button class="btn-secondary btn-sm" onclick="App.rePrintKitchenOrder()"><i class="fas fa-print"></i> إعادة طباعة بون المطبخ</button></div>';
        }
    } else if (bC) { 
        bC.innerHTML = '<p>لا توجد وجبات في المطبخ.</p>'; 
    }

    var dpTotal = document.getElementById('dpTotal');
    if (dpTotal) dpTotal.textContent = 'الإجمالي: ' + fmt(total) + ' دينار';
}

function listenChat(tn) {
    var box = document.getElementById('dpChatMsgs');
    if (!box) return;
    var k = 'table_' + tn;
    DB.listenTableChat(k, function(dataA, dataB) {
        box.innerHTML = ''; 
        var m = [];
        if (dataA) {
            for (var id in dataA) {
                var x = dataA[id];
                x.src = 'client';
                m.push(x);
            }
        }
        if (dataB) {
            for (var id in dataB) {
                var x = dataB[id];
                x.src = 'admin';
                m.push(x);
            }
        }
        m.sort(function(a, b) { return new Date(a.timestamp) - new Date(b.timestamp); });
        if (!m.length) { 
            box.innerHTML = '<p style="color:var(--text-muted);font-size:11px;text-align:center;padding:8px;">لا توجد رسائل.</p>'; 
            return; 
        }
        for (var i = 0; i < m.length; i++) {
            var x = m[i];
            box.innerHTML += '<div class="cm ' + (x.src === 'client' ? 'from-client' : 'from-admin') + '">' + x.text + '</div>';
        }
        box.scrollTop = box.scrollHeight;
    });
}

export function sendAdminReply() { 
    var i = document.getElementById('dpChatIn'); 
    var t = i ? i.value.trim() : ''; 
    if (!t || !state.activeTable) return; 
    playClickSnd(); 
    DB.pushData('msgB/table_' + state.activeTable, { text: t, timestamp: new Date().toISOString() }); 
    if (i) i.value = ''; 
}

// ===== دوال تعديل طلبات المطبخ =====
export function changeProcessingOrderQty(tableKey, itemId, delta) {
    playClickSnd();
    var orders = state.dC[tableKey]?.processing_orders;
    if (!orders || !orders[itemId]) return;
    var newQty = (parseInt(orders[itemId].quantity) || 0) + delta;
    if (newQty <= 0) { 
        deleteProcessingOrder(tableKey, itemId); 
    } else { 
        DB.updateData('tablesC/' + tableKey + '/processing_orders/' + itemId, { quantity: newQty });
    }
}

export function deleteProcessingOrder(tableKey, itemId) {
    if (confirm('هل تريد حذف هذا الصنف من طلبات المطبخ؟')) {
        DB.removeData('tablesC/' + tableKey + '/processing_orders/' + itemId);
    }
}

// ===== زر طباعة المطبخ المعدل =====
export async function printToKitchen() {
    var k = 'table_' + state.activeTable;
    var oB = state.dB[k] && state.dB[k].sent_orders ? state.dB[k].sent_orders : null;
    
    if (!oB || !Object.keys(oB).length) { 
        toast('لا توجد طلبات واردة', 'te'); 
        return; 
    }
    
    if (isMainDevice) {
        // ===== جهاز رئيسي: ينقل البيانات + يطبع =====
        var printers = window.App.getButtonPrinters('kitchen');
        if (printers.length === 0) { 
            toast('الرجاء تعيين طابعات لزر المطبخ', 'te'); 
            return; 
        }
        
        var items = [];
        for (var id in oB) {
            items.push({ name: oB[id].name, qty: oB[id].quantity, price: oB[id].price });
        }
        
        // طباعة
        await printToSelectedPrinters(printers, {
            title: 'بون التجهيز', 
            tableNum: state.activeTable, 
            dt: new Date().toLocaleString('ar-IQ', { hour12: true }),
            items: items, 
            final: false, 
            cashier: state.myUser, 
            welcome: 'برجاء تجهيز الطلبات بأسرع وقت'
        });
        
        // نقل البيانات من tablesB إلى tablesC
        for (var id in oB) {
            await DB.pushData('tablesC/' + k + '/processing_orders', { 
                name: oB[id].name, 
                price: oB[id].price, 
                quantity: oB[id].quantity 
            });
        }
        await DB.removeData('tablesB/' + k);
        toast('تم إرسال الطلبات للمطبخ', 'ts');
        
    } else {
        // ===== جهاز ثانوي (تاب): ينقل البيانات أولاً، ثم يرسل أمر طباعة =====
        
        // 1. نقل البيانات من tablesB إلى tablesC
        for (var id in oB) {
            await DB.pushData('tablesC/' + k + '/processing_orders', { 
                name: oB[id].name, 
                price: oB[id].price, 
                quantity: oB[id].quantity 
            });
        }
        await DB.removeData('tablesB/' + k);
        
        // 2. إرسال أمر طباعة فقط
        await DB.sendPrintCommand('kitchen', {
            tableId: k,
            orders: oB,
            requestedBy: state.myUser
        });
        
        toast('تم إرسال الطلبات للمطبخ وطلب الطباعة', 'ts');
    }
}

// ===== إعادة طباعة بون المطبخ =====
export async function rePrintKitchenOrder() {
    var k = 'table_' + state.activeTable;
    var oC = state.dC[k] && state.dC[k].processing_orders ? state.dC[k].processing_orders : null;
    if (!oC || !Object.keys(oC).length) { toast('لا توجد طلبات في المطبخ', 'te'); return; }
    
    if (isMainDevice) {
        var printers = window.App.getButtonPrinters('kitchen');
        if (printers.length === 0) { toast('الرجاء تعيين طابعات للمطبخ', 'te'); return; }
        
        var items = [];
        for (var id in oC) items.push({ name: oC[id].name, qty: oC[id].quantity, price: oC[id].price });
        
        await printToSelectedPrinters(printers, {
            title: 'بون التجهيز (نسخة)', 
            tableNum: state.activeTable, 
            dt: new Date().toLocaleString('ar-IQ', { hour12: true }),
            items: items, 
            final: false, 
            cashier: state.myUser, 
            welcome: 'برجاء تجهيز الطلبات بأسرع وقت'
        });
        toast('تمت إعادة الطباعة', 'ts');
    } else {
        await DB.sendPrintCommand('kitchen', {
            tableId: k,
            orders: oC,
            requestedBy: state.myUser,
            isReprint: true
        });
        toast('تم إرسال طلب إعادة الطباعة', 'ti');
    }
}

// ===== زر تسديد الحساب المعدل =====
export async function settleInvoice() {
    var k = 'table_' + state.activeTable;
    var oB = state.dB[k] && state.dB[k].sent_orders ? state.dB[k].sent_orders : {};
    var oC = state.dC[k] && state.dC[k].processing_orders ? state.dC[k].processing_orders : {};
    
    var oBkeys = Object.keys(oB);
    var oCkeys = Object.keys(oC);
    
    if (oBkeys.length === 0 && oCkeys.length === 0) { 
        toast('لا توجد طلبات', 'te'); 
        return; 
    }
    
    var items = [], total = 0;
    var combined = Object.assign({}, oB, oC);
    for (var id in combined) {
        var s = combined[id].price * combined[id].quantity; 
        total += s;
        items.push({ name: combined[id].name, qty: combined[id].quantity, price: combined[id].price });
    }
    
    var sa = new Date().toISOString();
    var promises = [];
    
    // أرشفة الطلبات
    for (var id in oB) {
        promises.push(DB.pushData('tablesD/archive_orders', { 
            table_number: state.activeTable, 
            name: oB[id].name, 
            price: oB[id].price, 
            quantity: oB[id].quantity, 
            settled_at: sa, 
            settled_by: state.myUser 
        }));
    }
    for (var id in oC) {
        promises.push(DB.pushData('tablesD/archive_orders', { 
            table_number: state.activeTable, 
            name: oC[id].name, 
            price: oC[id].price, 
            quantity: oC[id].quantity, 
            settled_at: sa, 
            settled_by: state.myUser 
        }));
    }
    
    // حذف الطلبات من الجداول النشطة
    promises.push(DB.removeData('tablesB/' + k));
    promises.push(DB.removeData('tablesC/' + k));
    promises.push(DB.removeData('msgA/' + k));
    promises.push(DB.removeData('msgB/' + k));
    promises.push(DB.removeData('read_counters/' + k));
    
    await Promise.all(promises);
    
    // طباعة أو إرسال أمر طباعة
    if (isMainDevice) {
        var printers = window.App.getButtonPrinters('cashier');
        if (printers.length === 0) { 
            toast('الرجاء تعيين طابعات لزر تسديد الحساب', 'te'); 
        } else {
            await printToSelectedPrinters(printers, {
                title: 'إيصال الدفع', 
                tableNum: state.activeTable, 
                dt: new Date().toLocaleString('ar-IQ', { hour12: true }),
                items: items, 
                final: true, 
                total: total, 
                cashier: state.myUser, 
                welcome: 'نتمنى لكم تجربة مميزة، شكراً لاختياركم'
            });
        }
    } else {
        // جهاز ثانوي: يرسل أمر طباعة فقط (البيانات تم نقلها بالفعل)
        await DB.sendPrintCommand('cashier', {
            tableId: k,
            items: items,
            total: total,
            cashier: state.myUser
        });
        toast('تم تسديد الفاتورة وإرسال أمر الطباعة', 'ts');
    }
    
    closeDetail();
}

// ===== دوال تعديل الطلبات الواردة =====
export function changeSentOrderQty(tableKey, itemId, delta) {
    playClickSnd();
    var orders = state.dB[tableKey]?.sent_orders;
    if (!orders || !orders[itemId]) return;
    var newQty = (parseInt(orders[itemId].quantity) || 0) + delta;
    if (newQty <= 0) { 
        deleteSentOrder(tableKey, itemId); 
    } else { 
        DB.updateData('tablesB/' + tableKey + '/sent_orders/' + itemId, { quantity: newQty });
    }
}

export function deleteSentOrder(tableKey, itemId) {
    if (confirm('هل تريد حذف هذا الصنف من الطلب؟')) {
        DB.removeData('tablesB/' + tableKey + '/sent_orders/' + itemId);
    }
}

// ===== دوال الطباعة المساعدة =====
function buildReceiptCanvas(cfg) {
    var PW = 580, ML = 12; 
    var hasLogo = !!(state.settings.restaurantLogo && state.settings.restaurantLogo.length > 20); 
    var hasQR = !!(state.settings.invoiceQrUrl && state.settings.invoiceQrUrl.trim()) && cfg.final; 
    var ti = cfg.items ? cfg.items.length : 0; 
    var qrPx = 180, logoPx = 160; 
    
    var y = ML * 3; 
    if (hasLogo) y += logoPx + ML * 2; 
    y += ML * 6 + ML * 5 + ML * 3 + ML * 5 + ML * 5 + ML * 3 + ML * 5 + ML * 3 + ti * (ML * 8); 
    if (cfg.final) y += ML * 4 + ML * 7; 
    y += ML * 5; 
    if (hasQR) y += ML * 2 + qrPx + ML * 2; 
    y += ML * 4; 
    
    var cv = document.createElement('canvas'); 
    cv.width = PW; 
    cv.height = Math.max(y, ML * 25); 
    var cx = cv.getContext('2d'); 
    
    cx.imageSmoothingEnabled = false;
    cx.mozImageSmoothingEnabled = false;
    cx.webkitImageSmoothingEnabled = false;
    cx.msImageSmoothingEnabled = false;
    
    cx.fillStyle = '#ffffff'; 
    cx.fillRect(0, 0, PW, cv.height); 
    
    y = ML * 3; 
    if (hasLogo) { 
        try { 
            var img = new Image(); 
            img.src = state.settings.restaurantLogo; 
            cx.drawImage(img, (PW - logoPx) / 2, y, logoPx, logoPx); 
            y += logoPx + ML * 2; 
        } catch (e) { } 
    } 
    
    cx.textBaseline = 'middle'; 
    cx.textAlign = 'center'; 
    cx.fillStyle = '#000000'; 
    
    var printSolidText = function(text, x, yValue) {
        cx.fillText(text, x, yValue);
        cx.fillText(text, x + 0.5, yValue);
        cx.fillText(text, x, yValue + 0.5);
    };
    
    cx.font = '900 38px Arial, Helvetica, sans-serif'; 
    printSolidText(state.settings.restaurantName || 'المطعم', PW / 2, y); 
    
    y += ML * 6; 
    cx.font = 'bold 24px Arial, Helvetica, sans-serif'; 
    printSolidText(cfg.welcome || 'شكراً لزيارتكم', PW / 2, y); 
    
    y += ML * 5; 
    drawDash(cx, 40, PW - 40, y); 
    
    y += ML * 3; 
    cx.font = '900 32px Arial, Helvetica, sans-serif'; 
    printSolidText(cfg.title, PW / 2, y); 
    
    y += ML * 5; 
    cx.font = 'bold 22px Arial, Helvetica, sans-serif'; 
    printSolidText('طاولة: [' + cfg.tableNum + ']   ' + cfg.dt + '   ' + cfg.cashier, PW / 2, y); 
    
    y += ML * 5; 
    drawDash(cx, 40, PW - 40, y); 
    
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
    
    y += ML * 4; 
    cx.font = 'bold 23px Arial, Helvetica, sans-serif'; 
    
    for (var i = 0; i < cfg.items.length; i++) {
        var it = cfg.items[i];
        cx.fillStyle = '#000000'; 
        
        var nm = it.name; 
        var maxW = (cfg.final ? PW * 0.50 : PW * 0.70); 
        
        cx.textAlign = 'right';
        if (cx.measureText(nm).width > maxW) { 
            while (cx.measureText(nm + '…').width > maxW && nm.length > 1) { 
                nm = nm.slice(0, -1); 
            } 
            nm += '…'; 
        } 
        
        printSolidText(nm, PW - 60, y); 
        
        cx.textAlign = 'center'; 
        printSolidText('x' + it.qty, PW / 2 + 40, y); 
        
        if (cfg.final) { 
            cx.textAlign = 'left'; 
            printSolidText(fmt(it.price * it.qty), 60, y); 
        } 
        
        y += ML * 5; 
        cx.strokeStyle = '#000000'; 
        cx.lineWidth = 2; 
        cx.setLineDash([4, 4]); 
        cx.beginPath(); 
        cx.moveTo(40, y); 
        cx.lineTo(PW - 40, y); 
        cx.stroke(); 
        cx.setLineDash([]); 
        y += ML * 4; 
    }
    
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
    
    if (hasQR) { 
        try { 
            var qrDiv = document.createElement('div'); 
            new QRCode(qrDiv, { text: state.settings.invoiceQrUrl, width: qrPx, height: qrPx, colorDark: '#000000', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.M }); 
            var qrC = qrDiv.querySelector('canvas'); 
            if (qrC) { 
                cx.drawImage(qrC, (PW - qrPx) / 2, y, qrPx, qrPx); 
                y += qrPx + ML * 2; 
            } 
        } catch (e) { y += qrPx; } 
    } 
    return cv;
}

async function printToSelectedPrinters(printers, cfg) {
    var cv = buildReceiptCanvas(cfg);
    var imgData = cv.toDataURL('image/jpeg', 0.85);
    var successCount = 0;
    var failCount = 0;
    toast('جاري الطباعة على ' + printers.length + ' طابعة...', 'ti');
    for (var i = 0; i < printers.length; i++) {
        var printer = printers[i];
        try {
            var response = await fetch('http://127.0.0.1:5000/print-receipt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ printerName: printer.ip, image: imgData }) 
            });
            var data = await response.json();
            if (data.status === 'success') {
                successCount++;
            } else {
                failCount++;
            }
        } catch (err) {
            failCount++;
            console.error('خطأ في الطباعة على ' + printer.ip + ':', err);
        }
    }
    if (successCount > 0) {
        toast('تمت الطباعة على ' + successCount + ' طابعة' + (failCount > 0 ? '، فشل ' + failCount : ''), successCount === printers.length ? 'ts' : 'ti');
    } else {
        toast('فشلت الطباعة على جميع الطابعات', 'te');
    }
}

// ===== طباعة التسوق المباشر =====
export async function printDirectReceipt(items, total) {
    if (isMainDevice) {
        var printers = window.App.getButtonPrinters('direct');
        if (printers.length === 0) { 
            toast('الرجاء تعيين طابعات لزر التسوق المباشر', 'te'); 
            return; 
        }
        await printToSelectedPrinters(printers, {
            title: 'إيصال الدفع - تسوق مباشر', 
            tableNum: 'سفري', 
            dt: new Date().toLocaleString('ar-IQ', { hour12: true }),
            items: items, 
            final: true, 
            total: total, 
            cashier: state.myUser, 
            welcome: 'شكراً لزيارتكم، نتمنى لكم تجربة مميزة'
        });
    } else {
        await DB.sendPrintCommand('direct', {
            items: items,
            total: total,
            cashier: state.myUser
        });
        toast('تم إرسال طلب الطباعة إلى الخادم', 'ti');
    }
}

export function updateSales() {
    if (!state.myUser) return;
    var t = 0;
    for (var id in state.dD) {
        var o = state.dD[id];
        if (o && o.settled_by === state.myUser && sameDay(o.settled_at)) t += (parseFloat(o.price) || 0) * (parseInt(o.quantity) || 1);
    }
    var directOrders = JSON.parse(localStorage.getItem('direct_orders_archive') || '[]');
    for (var i = 0; i < directOrders.length; i++) {
        var order = directOrders[i];
        if (order.settled_by === state.myUser && sameDay(order.settled_at)) t += order.total || 0;
    }
    var qsSales = document.getElementById('qsSales');
    if (qsSales) qsSales.textContent = fmt(t);
}
