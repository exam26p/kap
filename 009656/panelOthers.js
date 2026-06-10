// panelOthers.js
import { state } from './state.js';
import * as DB from './db.js';
import { fmt, playClickSnd, playOnce, toast, drawDash, inRange } from './utils.js';
import * as Ops from './panelOps.js';

var isMainDevice = (localStorage.getItem('device_role') === 'main');

// ===== دالة تنفيذ طباعة الإحصائيات (للكمبيوتر) =====
export async function executePrintStats(commandData) {
    var printers = window.App.getButtonPrinters('stats');
    if (printers.length === 0) { 
        toast('الرجاء تعيين طابعات لزر الإحصائيات', 'te'); 
        return; 
    }
    
    var cv = buildStatsCanvas(commandData.stats);
    var imgData = cv.toDataURL('image/jpeg', 0.85);
    
    for (var i = 0; i < printers.length; i++) {
        try {
            await fetch('http://localhost:5000/print-receipt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ printerName: printers[i].ip, image: imgData })
            });
        } catch (err) {
            console.error('Print error:', err);
        }
    }
    console.log('✅ تمت طباعة تقرير الإحصائيات');
}

// ===== دالة تنفيذ طباعة الباركود (للكمبيوتر) =====
export async function executePrintQR(commandData) {
    var printers = window.App.getButtonPrinters('qr');
    if (printers.length === 0) { 
        toast('الرجاء تعيين طابعات لزر الباركودات', 'te'); 
        return; 
    }
    
    await executeSingleQRPrint(commandData.qrData);
    console.log('✅ تمت طباعة الباركود');
}

// ===== الباركود =====
export function loadQRVersions() {
    var sel = document.getElementById('qrVer'); 
    if (!sel) return; 
    var cv = sel.value; 
    sel.innerHTML = '<option value="">-- اختر --</option>'; 
    if (state.myVersion) { 
        var o = document.createElement('option'); 
        o.value = state.myVersion; 
        o.textContent = 'v' + state.myVersion; 
        sel.appendChild(o); 
    } 
    if (state.myVersion) sel.value = state.myVersion; 
    updateQRPreview(); 
}

export function updateQRPreview() { 
    var base = document.getElementById('qrUrl').value.trim(); 
    var ver = document.getElementById('qrVer').value; 
    var from = parseInt(document.getElementById('qrFrom').value) || 1; 
    var showV = document.getElementById('qrShowVer').checked; 
    var el = document.getElementById('qrPreviewUrl'); 
    if (!base) { el.textContent = '-'; return; } 
    var url = base + '?table=' + from; 
    if (showV && ver) url += '&version=' + ver;  
    el.textContent = url;  
} 

export function updateCaptainQR() { 
    var captainUrl = document.getElementById('qrCaptainUrl').value.trim();
    var captainPreviewUrl = document.getElementById('qrCaptainPreviewUrl');
    
    if (!captainUrl) { 
        captainPreviewUrl.textContent = '-'; 
        return; 
    } 
    captainPreviewUrl.textContent = captainUrl; 
} 

export async function generateCaptainQR() { 
    playOnce('print'); 
    var captainUrl = document.getElementById('qrCaptainUrl').value.trim();
    
    if (!captainUrl) { 
        toast('أدخل رابط صفحة الكابتن', 'te'); 
        return; 
    } 
    
    try {
        await DB.updateData('app_settings', { captainQrUrl: captainUrl });
        state.settings.captainQrUrl = captainUrl;
    } catch(e) {
        toast('خطأ في حفظ رابط الكابتن', 'te');
        return;
    }

    var grid = document.getElementById('captainQrContainer');
    grid.innerHTML = ''; 
    
    var c = document.createElement('div'); 
    c.className = 'qr-card'; 
    var h = '<div class="qn" style="background:var(--purple);">كابتن</div><div class="ql">الكابتن</div>'; 
    h += '<div id="qr_captain"></div>'; 
    h += '<div class="qh">امسح الباركود لإدارة الطاولات</div>'; 
    h += '<div style="margin-top:8px;"><button class="btn-primary btn-sm" style="background:var(--purple);" onclick="App.printSingleQR(\'captain\')"><i class="fas fa-print"></i> طباعة باركود الكابتن</button></div>';
    c.innerHTML = h; 
    grid.appendChild(c); 
    
    new QRCode(document.getElementById('qr_captain'), { 
        text: captainUrl, 
        width: 160, 
        height: 160, 
        colorDark: '#000000', 
        colorLight: '#ffffff', 
        correctLevel: QRCode.CorrectLevel.H 
    }); 
    
    toast('تم إنشاء باركود الكابتن وحفظ الرابط', 'ts'); 
}

export async function generateQRCodes() { 
    playOnce('print'); 
    var base = document.getElementById('qrUrl').value.trim(); 
    var ver = document.getElementById('qrVer').value; 
    var from = parseInt(document.getElementById('qrFrom').value) || 1; 
    var to = parseInt(document.getElementById('qrTo').value) || from; 
    var showV = document.getElementById('qrShowVer').checked; 
    var showH = document.getElementById('qrShowHint').checked; 
    
    if (!base) { toast('أدخل رابط المنيو', 'te'); return; }  
    
    try {
        await DB.updateData('app_settings', { menuQrUrl: base });
        state.settings.menuQrUrl = base;
    } catch(e) {
        console.error("خطأ في حفظ رابط المنيو:", e);
    }

    var total = Math.max(0, to - from + 1); 
    var btn = document.getElementById('qrGenBtn');  
    if (total <= 0 || total > 999) { toast('عدد الطاولات غير صحيح', 'te'); return; } 
    btn.disabled = true;  
    var pw = document.getElementById('qrProgress'); pw.classList.add('show'); 
    var grid = document.getElementById('qrsGrid'); grid.innerHTML = ''; 
    state.qrData = []; 
    var lb = document.getElementById('loadBg'); lb.classList.add('open'); 
    
    for (var i = 0; i < total; i++) {  
        var tn = from + i; 
        var url = base + '?table=' + tn + (ver ? '&version=' + ver : '');  
        try { 
            await DB.setData('tablesA/table_' + tn, { table_number: tn, qr_link: url, version_number: ver || null, status: 'active', created_at: new Date().toISOString() }); 
            state.qrData.push({ tn: tn, url: url, ver: ver, showV: showV, showH: showH }); 
            makeQR(tn, url, ver, showV, showH); 
        } catch (e) { } 
        var pct = Math.round(((i + 1) / total) * 100); 
        var qrProgFill = document.getElementById('qrProgFill');
        var qrProgPct = document.getElementById('qrProgPct');
        var qrProgText = document.getElementById('qrProgText');
        var loadCount = document.getElementById('loadCount');
        if (qrProgFill) qrProgFill.style.width = pct + '%'; 
        if (qrProgPct) qrProgPct.textContent = pct + '%'; 
        if (qrProgText) qrProgText.textContent = 'تم ' + (i + 1) + ' من ' + total; 
        if (loadCount) loadCount.textContent = (i + 1) + ' / ' + total; 
        if ((i + 1) % 20 === 0) await new Promise(function(r) { setTimeout(r, 50); }); 
    } 
    lb.classList.remove('open'); 
    var qrTools = document.getElementById('qrTools');
    if (qrTools) qrTools.style.display = 'flex'; 
    btn.disabled = false; 
    toast('تم إنشاء ' + total + ' باركود', 'ts'); 
} 

function makeQR(tn, url, ver, showV, showH) { 
    var c = document.createElement('div'); 
    c.className = 'qr-card'; 
    var h = '<div class="qn">' + tn + '</div><div class="ql">طاولة</div>'; 
    if (showV && ver) h += '<div class="qv">v' + ver + '</div>'; 
    h += '<div id="qr_' + tn + '"></div>'; 
    if (showH) h += '<div class="qh">امسح الباركود للطلب</div>'; 
    h += '<div style="margin-top:8px;"><button class="btn-primary btn-sm" onclick="App.printSingleQR(\'' + tn + '\')"><i class="fas fa-print"></i> طباعة</button></div>';
    c.innerHTML = h; 
    document.getElementById('qrsGrid').appendChild(c); 
    new QRCode(document.getElementById('qr_' + tn), { text: url, width: 140, height: 140, colorDark: '#000000', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.H }); 
} 

export function refreshQRCards() { 
    var showV = document.getElementById('qrShowVer').checked; 
    var showH = document.getElementById('qrShowHint').checked; 
    var cols = parseInt(document.getElementById('qrCols').value) || 4; 
    var qrsGrid = document.getElementById('qrsGrid');
    if (qrsGrid) qrsGrid.className = 'qrs-grid c' + Math.min(cols, 4); 
    if (qrsGrid) qrsGrid.innerHTML = ''; 
    state.qrData.forEach(function(d) { makeQR(d.tn, d.url, d.ver, showV, showH); }); 
    toast('تم تحديث العرض', 'ts'); 
} 

async function executeSingleQRPrint(tn) {
    var printers = window.App.getButtonPrinters('qr');
    if (printers.length === 0) { return; }

    var qrUrl = '';
    var qvText = '';
    var targetCard = null;

    if (tn === 'captain') {
        qrUrl = state.settings.captainQrUrl || '';
        if (!qrUrl) { return; }
        targetCard = document.querySelector('#captainQrContainer .qr-card');
    } else {
        var allCards = document.querySelectorAll('#qrsGrid .qr-card');
        allCards.forEach(function(c) {
            var qn = c.querySelector('.qn');
            if (qn && qn.textContent === String(tn)) {
                targetCard = c;
            }
        });
        var qrUrlData = state.qrData.find(function(q) { return q.tn == tn; });
        qrUrl = qrUrlData ? qrUrlData.url : '';
        qvText = targetCard ? (targetCard.querySelector('.qv') ? targetCard.querySelector('.qv').textContent : '') : '';
    }

    if (!targetCard) { return; }

    var PW = 550;
    var cv = document.createElement('canvas');
    var cx = cv.getContext('2d');
    cv.width = PW;
    cv.height = 600;

    cx.fillStyle = '#ffffff';
    cx.fillRect(0, 0, PW, cv.height);

    cx.fillStyle = '#000000';
    cx.font = 'bold 40px "Segoe UI",Tahoma,sans-serif';
    cx.textAlign = 'center';
    cx.textBaseline = 'middle';
    
    if (tn === 'captain') {
        cx.fillText('الكابتن', PW / 2, 45);
    } else {
        cx.fillText('طاولة ' + tn, PW / 2, 45);
    }

    if (qvText) {
        cx.font = '22px "Segoe UI",Tahoma,sans-serif';
        cx.fillStyle = '#444444';
        cx.fillText(qvText, PW / 2, 85);
    }

    if (qrUrl) {
        var tempDiv = document.createElement('div');
        try {
            new QRCode(tempDiv, {
                text: qrUrl,
                width: 350,
                height: 350,
                colorDark: "#000000",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.H
            });
            
            await new Promise(function(resolve) {
                setTimeout(function() {
                    var tempCanvas = tempDiv.querySelector('canvas');
                    if (tempCanvas) {
                        var xQr = (PW - 350) / 2;
                        cx.drawImage(tempCanvas, xQr, 100, 350, 350); 
                    }
                    
                    cx.fillStyle = '#000000';
                    cx.font = 'bold 22px "Segoe UI",Tahoma,sans-serif';
                    cx.textAlign = 'center';
                    
                    if (tn === 'captain') {
                        cx.fillText('لإدارة طلبات الزبائن', PW / 2, cv.height - 30);
                    } else {
                        cx.fillText('امسح الباركود للطلب', PW / 2, cv.height - 30);
                    }
                    resolve();
                }, 150);
            });

            var imgData = cv.toDataURL('image/jpeg', 0.95);
            
            for (var i = 0; i < printers.length; i++) {
                try {
                    await fetch('http://localhost:5000/print-receipt', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ printerName: printers[i].ip, image: imgData })
                    });
                } catch (err) {
                    console.error("Print error:", err);
                }
            }
        } catch(e) {
            console.error("QR Generation error:", e);
        }
    }
}

export function printSingleQR(tn) {
    playOnce('print');
    
    if (isMainDevice) {
        executeSingleQRPrint(tn);
        toast('تمت الطباعة', 'ts');
    } else {
        DB.sendPrintCommand('qr', {
            qrData: tn,
            requestedBy: state.myUser
        });
        toast('تم إرسال الباركود للطباعة', 'ti');
    }
}

// ===== التسوق المباشر =====
export function renderDirectGrid() { 
    var search = document.getElementById('directSearch')?.value.trim().toLowerCase() || ''; 
    var catFilter = document.getElementById('directCatFilter')?.value || ''; 
    var grid = document.getElementById('directGrid'); 
    var filterSel = document.getElementById('directCatFilter'); 
    if (!grid || !filterSel) return;
    
    var cv = filterSel.value; 
    state.directAllItems = []; 
    filterSel.innerHTML = '<option value="">جميع الأقسام</option>'; 
    
    for (var catId in state.directMenuData) { 
        filterSel.innerHTML += '<option value="' + catId + '">' + state.directMenuData[catId].name + '</option>'; 
        if (state.directMenuData[catId].items) { 
            for (var iid in state.directMenuData[catId].items) { 
                var it = state.directMenuData[catId].items[iid]; 
                state.directAllItems.push(Object.assign({}, it, { catId: catId, catName: state.directMenuData[catId].name, _id: iid })); 
            } 
        } 
    } 
    filterSel.value = cv; 
    
    var filtered = state.directAllItems; 
    if (search) filtered = filtered.filter(function(i) { return i.name.toLowerCase().includes(search); }); 
    if (catFilter) filtered = filtered.filter(function(i) { return i.catId === catFilter; }); 
    
    grid.innerHTML = ''; 
    if (!filtered.length) { 
        grid.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:30px;grid-column:1/-1;">لا توجد أصناف.</p>'; 
        return; 
    } 
    
    filtered.forEach(function(it) { 
        var imgSrc = (it.image && it.image.length > 20) ? it.image : ''; 
        var key = it.catId + '|' + it._id; 
        var qty = state.directCart[key] ? state.directCart[key].quantity : 0; 
        var div = document.createElement('div'); 
        div.className = 'direct-item' + (qty > 0 ? ' selected' : ''); 
        div.innerHTML = (imgSrc ? '<img src="' + imgSrc + '" alt="">' : '<div style="width:100%;height:90px;background:var(--bg-card);border-radius:8px;display:flex;align-items:center;justify-content:center;"><i class="fas fa-image" style="color:var(--text-muted);font-size:24px;"></i></div>') + 
            '<h4>' + it.name + '</h4>' + 
            '<div class="di-price">' + fmt(it.price) + ' د.ع</div>' + 
            '<div class="di-details">' + (it.details || '') + '</div>' + 
            '<div class="direct-qty">' + 
            '<button class="dq-minus" onclick="App.directQtyChange(\'' + key + '\',-1,event)">−</button>' + 
            '<span>' + (qty || 0) + '</span>' + 
            '<button class="dq-plus" onclick="App.directQtyChange(\'' + key + '\',1,event)">+</button>' + 
            '</div>'; 
        div.addEventListener('click', function(e) { 
            if (e.target.closest('.direct-qty')) return; 
            App.directToggle(key); 
        }); 
        grid.appendChild(div); 
    }); 
    updateDirectBar(); 
} 

export function filterDirect() { playClickSnd(); renderDirectGrid(); } 

export function directToggle(key) { 
    if (state.directCart[key]) { 
        delete state.directCart[key]; 
    } else { 
        state.directCart[key] = { quantity: 1 }; 
    } 
    updateDirectBar(); 
    renderDirectGrid(); 
} 

export function directQtyChange(key, delta, e) { 
    e.stopPropagation(); 
    if (!state.directCart[key]) state.directCart[key] = { quantity: 0 }; 
    state.directCart[key].quantity = Math.max(0, state.directCart[key].quantity + delta); 
    if (state.directCart[key].quantity === 0) delete state.directCart[key]; 
    updateDirectBar(); 
    renderDirectGrid(); 
} 

function updateDirectBar() { 
    var bar = document.getElementById('directBar'); 
    var count = 0, total = 0; 
    for (var k in state.directCart) { 
        var parts = k.split('|'); 
        var catId = parts[0]; 
        var itemId = parts.slice(1).join('|'); 
        var cat = state.directMenuData[catId]; 
        if (cat && cat.items && cat.items[itemId]) { 
            count += state.directCart[k].quantity; 
            total += cat.items[itemId].price * state.directCart[k].quantity; 
        } 
    } 
    if (count > 0 && bar) { 
        bar.style.display = 'flex'; 
    } else if (bar) { 
        bar.style.display = 'none'; 
    } 
    var directCount = document.getElementById('directCount');
    var directTotal = document.getElementById('directTotal');
    if (directCount) directCount.textContent = count + ' صنف'; 
    if (directTotal) directTotal.textContent = fmt(total) + ' دينار'; 
} 

export function clearDirectCart() { 
    state.directCart = {}; 
    updateDirectBar(); 
    renderDirectGrid(); 
} 

export async function payDirectOrder() { 
    var keys = Object.keys(state.directCart); 
    if (!keys.length) { toast('السلة فارغة', 'te'); return; } 
    
    var items = [], total = 0; 
    keys.forEach(function(k) { 
        var parts = k.split('|'); 
        var catId = parts[0]; 
        var itemId = parts.slice(1).join('|'); 
        var cat = state.directMenuData[catId]; 
        if (cat && cat.items && cat.items[itemId]) { 
            var it = cat.items[itemId]; 
            var qty = state.directCart[k].quantity; 
            var sub = it.price * qty; 
            total += sub; 
            items.push({ name: it.name, qty: qty, price: it.price }); 
        } 
    }); 
    
    if (typeof Ops.printDirectReceipt === 'function') { 
        Ops.printDirectReceipt(items, total); 
    } else { 
        toast('خطأ: دالة الطباعة غير متوفرة', 'te'); 
        return; 
    } 
    
    var sa = new Date().toISOString(); 
    var ops = []; 
    items.forEach(function(it) { 
        ops.push(DB.pushData('tablesD/archive_orders', { table_number: 0, name: it.name, price: it.price, quantity: it.qty, settled_at: sa, settled_by: state.myUser })); 
    }); 
    
    var directOrdersArchive = JSON.parse(localStorage.getItem('direct_orders_archive') || '[]'); 
    directOrdersArchive.push({ settled_by: state.myUser, settled_at: sa, total: total, items: items.length }); 
    localStorage.setItem('direct_orders_archive', JSON.stringify(directOrdersArchive.slice(-500))); 
    
    await Promise.all(ops);
    
    state.directCart = {}; 
    updateDirectBar(); 
    renderDirectGrid(); 
    toast('تم الدفع والطباعة بنجاح', 'ts'); 
    if (typeof Ops.updateSales === 'function') Ops.updateSales(); 
} 

// ===== الإعدادات =====
export function syncPrinterSelects() { 
    var selectIds = ['rKitchen', 'rCashier', 'stPrinter', 'directPrinter']; 
    selectIds.forEach(function(sid) { 
        var el = document.getElementById(sid); 
        if (!el) return; 
        var cv = el.value; 
        el.innerHTML = '<option value="">-- اختر طابعة --</option>'; 
        for (var id in state.dPrinters) { 
            el.innerHTML += '<option value="' + state.dPrinters[id].ip + '">' + state.dPrinters[id].name + ' (' + state.dPrinters[id].ip + ')</option>'; 
        } 
        el.value = cv; 
    }); 
    var rKitchen = document.getElementById('rKitchen');
    var rCashier = document.getElementById('rCashier');
    if (rKitchen) rKitchen.value = state.routing.kitchenPrinterIp; 
    if (rCashier) rCashier.value = state.routing.cashierPrinterIp; 
} 

export function renderPrinters() { 
    var c = document.getElementById('printersList'); 
    if (!c) return; 
    if (!Object.keys(state.dPrinters).length) { 
        c.innerHTML = '<p style="color:var(--text-muted);font-size:12px;text-align:center;padding:12px;">لا توجد طابعات.</p>'; 
        return; 
    } 
    c.innerHTML = ''; 
    for (var id in state.dPrinters) { 
        var pName = state.dPrinters[id].name;
        var pIdentifier = state.dPrinters[id].ip;
        
        c.innerHTML += '<div class="printer-row">' + 
            '<div style="color:var(--text-secondary);font-size:13px;">' + 
            '<i class="fas fa-print" style="color:var(--accent);margin-left:8px;"></i>' + 
            '<b>' + pName + '</b> ' + 
            '<span style="color:var(--text-muted);">(' + pIdentifier + ')</span>' + 
            '</div>' + 
            '<div style="display:flex;gap:8px;">' + 
            '<button class="btn-secondary btn-sm" onclick="App.pingP(\'' + pIdentifier + '\')"><i class="fas fa-wifi"></i> فحص</button>' + 
            '<button class="btn-secondary btn-sm btn-red" onclick="App.delP(\'' + id + '\')"><i class="fas fa-trash"></i></button>' + 
            '</div>' + 
            '</div>'; 
    } 
}

export function pingP(printerName) { 
    fetch('http://localhost:5000/api/ping-printer', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ printerName: printerName }) 
    }) 
    .then(function(r) { return r.json(); }) 
    .then(function(d) { toast('[' + printerName + ']: ' + d.message, d.message.includes('متصل') || d.message.includes('جاهزة') ? 'ts' : 'te'); }) 
    .catch(function() { toast('تعذر الاتصال بسيرفر الطباعة', 'te'); }); 
}

export async function addPrinter() { 
    var n = document.getElementById('pName')?.value.trim() || '';
    var printerSelect = document.getElementById('pIP');
    var selectedPrinter = printerSelect ? printerSelect.value : '';
    
    if (!n || !selectedPrinter) { 
        toast('أدخل اسم الطابعة واختر الطابعة من القائمة', 'te'); 
        return; 
    } 
    
    await DB.pushData('printers_config', { name: n, ip: selectedPrinter, isWindowsPrinter: true });
    var pNameInput = document.getElementById('pName');
    if (pNameInput) pNameInput.value = ''; 
    toast('تمت إضافة الطابعة', 'ts'); 
} 

export async function loadWindowsPrinters() {
    var select = document.getElementById('pIP');
    if (!select) return;
    
    select.innerHTML = '<option value="">جاري تحميل الطابعات...</option>';
    
    try {
        var response = await fetch('http://localhost:5000/api/get-printers');
        var data = await response.json();
        
        if (data.status === 'success' && data.printers.length > 0) {
            select.innerHTML = '<option value="">-- اختر طابعة --</option>';
            data.printers.forEach(function(printer) {
                var option = document.createElement('option');
                option.value = printer;
                option.textContent = printer;
                select.appendChild(option);
            });
        } else {
            select.innerHTML = '<option value="">لا توجد طابعات متاحة</option>';
        }
    } catch (err) {
        console.error('خطأ في جلب الطابعات:', err);
        select.innerHTML = '<option value="">خطأ في الاتصال بالسيرفر</option>';
    }
}

export function delP(id) { if (confirm('حذف هذه الطابعة؟')) DB.removeData('printers_config/' + id); } 

export function previewLogo(input) { 
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

export function removeLogo() { 
    state.pendingLogoData = '__REMOVE__'; 
    syncLogoDisplay(''); 
    var logoInput = document.getElementById('logoInput');
    if (logoInput) logoInput.value = ''; 
}

export function syncLogoDisplay(dataUrl) { 
    var img = document.getElementById('logoPreview'); 
    var ph = document.getElementById('logoPlaceholder'); 
    var hImg = document.getElementById('headerLogo'); 
    var hPh = document.getElementById('headerLogoPlaceholder'); 
    var rmBtn = document.getElementById('removeLogoBtn'); 
    
    if (dataUrl && dataUrl.length > 10) { 
        if (img) { img.src = dataUrl; img.style.display = 'block'; }
        if (ph) ph.style.display = 'none'; 
        if (hImg) { hImg.src = dataUrl; hImg.style.display = 'block'; }
        if (hPh) hPh.style.display = 'none'; 
        if (rmBtn) rmBtn.style.display = 'inline-flex'; 
    } else { 
        if (img) { img.style.display = 'none'; img.src = ''; }
        if (ph) ph.style.display = 'flex'; 
        if (hImg) { hImg.style.display = 'none'; hImg.src = ''; }
        if (hPh) hPh.style.display = 'flex'; 
        if (rmBtn) rmBtn.style.display = 'none'; 
    } 
} 

export async function saveSettings() { 
    var n = document.getElementById('sName')?.value.trim() || ''; 
    var invUrl = document.getElementById('sInvoiceUrl')?.value.trim() || ''; 
    var os = document.getElementById('sOrderSnd')?.value || 'off'; 
    var ms = document.getElementById('sMsgSnd')?.value || 'off'; 
    var ps = document.getElementById('sPrintSnd')?.value || 'off'; 
    var cs = document.getElementById('sClickSnd')?.value || 'off'; 
    var ki = document.getElementById('rKitchen') ? document.getElementById('rKitchen').value : ''; 
    var ci = document.getElementById('rCashier') ? document.getElementById('rCashier').value : ''; 
    
    var ns = { 
        restaurantName: n || 'المطعم', 
        orderSound: os, 
        msgSound: ms, 
        printSound: ps, 
        clickSound: cs, 
        invoiceQrUrl: invUrl 
    }; 
    
    if (state.pendingLogoData === '__REMOVE__') ns.restaurantLogo = ''; 
    else if (state.pendingLogoData && state.pendingLogoData.length > 20) ns.restaurantLogo = state.pendingLogoData; 
    
    await Promise.all([DB.updateData('app_settings', ns), DB.setData('buttons_routing', { kitchenPrinterIp: ki, cashierPrinterIp: ci })]);
    
    state.settings = Object.assign({}, state.settings, ns); 
    state.routing = { kitchenPrinterIp: ki, cashierPrinterIp: ci }; 
    var brandName = document.getElementById('brandName');
    if (brandName) brandName.textContent = state.settings.restaurantName; 
    state.pendingLogoData = null; 
    toast('تم حفظ الإعدادات', 'ts'); 
} 

export function loadSettingsUI() { 
    var sName = document.getElementById('sName');
    var sInvoiceUrl = document.getElementById('sInvoiceUrl');
    var sOrderSnd = document.getElementById('sOrderSnd');
    var sMsgSnd = document.getElementById('sMsgSnd');
    var sPrintSnd = document.getElementById('sPrintSnd');
    var sClickSnd = document.getElementById('sClickSnd');
    var qrUrl = document.getElementById('qrUrl');
    var qrCaptainUrl = document.getElementById('qrCaptainUrl');
    
    if (sName) sName.value = state.settings.restaurantName || ''; 
    if (sInvoiceUrl) sInvoiceUrl.value = state.settings.invoiceQrUrl || ''; 
    if (sOrderSnd) sOrderSnd.value = state.settings.orderSound || 'off'; 
    if (sMsgSnd) sMsgSnd.value = state.settings.msgSound || 'off'; 
    if (sPrintSnd) sPrintSnd.value = state.settings.printSound || 'off'; 
    if (sClickSnd) sClickSnd.value = state.settings.clickSound || 'off'; 
    
    syncLogoDisplay(state.settings.restaurantLogo || ''); 
    state.pendingLogoData = null; 
    
    if (qrUrl) qrUrl.value = state.settings.menuQrUrl || 'https://exam26p.github.io/kap/index2.html';
    if (qrCaptainUrl) {
        qrCaptainUrl.value = state.settings.captainQrUrl || '';
        updateCaptainQR();
        if (state.settings.captainQrUrl) {
            generateCaptainQRAuto(state.settings.captainQrUrl);
        }
    }
    updateQRPreview();
    
    loadWindowsPrinters();
    
    // تحميل إعداد دور الجهاز في واجهة الإعدادات
    if (typeof window.App !== 'undefined' && window.App.loadDeviceRoleSetting) {
        window.App.loadDeviceRoleSetting();
    }
} 

function generateCaptainQRAuto(url) { 
    var grid = document.getElementById('captainQrContainer');
    if (!grid) return;
    grid.innerHTML = ''; 
    
    var c = document.createElement('div'); 
    c.className = 'qr-card'; 
    var h = '<div class="qn" style="background:var(--purple);">كابتن</div><div class="ql">الكابتن</div>'; 
    h += '<div id="qr_captain"></div>'; 
    h += '<div class="qh">امسح الباركود لإدارة الطاولات</div>'; 
    h += '<div style="margin-top:8px;"><button class="btn-primary btn-sm" style="background:var(--purple);" onclick="App.printSingleQR(\'captain\')"><i class="fas fa-print"></i> طباعة باركود الكابتن</button></div>';
    c.innerHTML = h; 
    grid.appendChild(c); 
    
    new QRCode(document.getElementById('qr_captain'), { 
        text: url, 
        width: 160, 
        height: 160, 
        colorDark: '#000000', 
        colorLight: '#ffffff', 
        correctLevel: QRCode.CorrectLevel.H 
    }); 
}

// ===== الإحصائيات =====
export function syncStatsUsers() { 
    var s = document.getElementById('stUser'); 
    if (!s) return; 
    var cv = s.value; 
    s.innerHTML = '<option value="">الكل</option>'; 
    for (var id in state.dUsers) {
        s.innerHTML += '<option value="' + state.dUsers[id].username + '">' + state.dUsers[id].username + '</option>';
    }
    s.value = cv; 
} 

export function searchStats() { 
    var user = document.getElementById('stUser')?.value || ''; 
    var from = document.getElementById('stFrom')?.value || ''; 
    var to = document.getElementById('stTo')?.value || ''; 
    
    if (!from && !to && !user) { toast('حدد فلتر واحد على الأقل', 'te'); return; } 
    
    var invMap = {}, itemsSum = {}, grand = 0; 
    
    for (var id in state.dD) { 
        var o = state.dD[id]; 
        if (!o) continue;
        
        if ((!user || o.settled_by === user) && inRange(o.settled_at, from, to)) {
            var price = parseFloat(o.price) || 0, qty = parseInt(o.quantity) || 1, sub = price * qty; 
            var ik = o.table_number + '_' + o.settled_at; 
            if (!invMap[ik]) invMap[ik] = { tableNumber: o.table_number, settledAt: o.settled_at, totalPrice: 0 }; 
            invMap[ik].totalPrice += sub; 
            if (!itemsSum[o.name]) itemsSum[o.name] = { quantity: 0, total: 0 }; 
            itemsSum[o.name].quantity += qty; 
            itemsSum[o.name].total += sub; 
            grand += sub; 
        }
    } 
    
    var directOrders = JSON.parse(localStorage.getItem('direct_orders_archive') || '[]'); 
    directOrders.forEach(function(order) { 
        if (user && order.settled_by !== user) return; 
        if (!inRange(order.settled_at, from, to)) return; 
        grand += order.total || 0; 
        var ik = 'direct_' + order.settled_at; 
        if (!invMap[ik]) invMap[ik] = { tableNumber: 'سفري', settledAt: order.settled_at, totalPrice: 0 }; 
        invMap[ik].totalPrice += order.total || 0; 
        
        if (!itemsSum['تسوق مباشر']) itemsSum['تسوق مباشر'] = { quantity: 0, total: 0 }; 
        itemsSum['تسوق مباشر'].quantity += order.items || 1; 
        itemsSum['تسوق مباشر'].total += order.total || 0; 
    }); 
    
    var invList = Object.values(invMap).sort(function(a, b) { return new Date(a.settledAt) - new Date(b.settledAt); }); 
    state.lastStats = { targetUser: user || 'الكل', dateFrom: from || 'البداية', dateTo: to || 'اليوم', invoices: invList, summary: itemsSum, totalSum: grand, ordersCount: invList.length }; 
    
    var c = document.getElementById('statsList'); 
    if (!c) return;
    
    if (!invList.length) { 
        c.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:36px;">لا توجد مبيعات.</p>'; 
        state.lastStats = null; 
        return; 
    } 
    
    var h = '<div class="stats-report">';
    h += '<div class="stats-header">';
    h += '<h2>' + (state.settings.restaurantName || 'المطعم') + '</h2>';
    h += '<p>تقرير المبيعات</p>';
    h += '<div class="stats-meta">المستخدم: ' + state.lastStats.targetUser + ' | الفترة: ' + state.lastStats.dateFrom + ' - ' + state.lastStats.dateTo + '</div>';
    h += '</div>';
    h += '<div class="stats-section"><h4><i class="fas fa-receipt"></i> الفواتير (' + invList.length + '):</h4>';
    h += '<div class="stats-invoices-list">';
    invList.forEach(function(inv) { 
        var t = new Date(inv.settledAt).toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' }); 
        var d = new Date(inv.settledAt).toLocaleDateString('ar-IQ'); 
        h += '<div class="stats-inv-row">' + 
            '<div>' + (inv.tableNumber === 'سفري' ? 'تسوق مباشر' : 'طاولة ' + inv.tableNumber) + ' - ' + d + ' ' + t + '</div>' + 
            '<div class="stats-inv-total">' + fmt(inv.totalPrice) + ' د.ع</div>' + 
            '</div>'; 
    });
    h += '</div></div>';
    h += '<div class="stats-section"><h4><i class="fas fa-box-open"></i> ملخص المواد:</h4>';
    h += '<div class="stats-items-summary">';
    for (var name in itemsSum) {
        var data = itemsSum[name];
        h += '<div class="stats-item-summary">' + 
            '<div><i class="fas fa-utensils"></i> ' + name + ' <span class="stats-item-count">(العدد: ' + data.quantity + ')</span></div>' + 
            '<div class="stats-item-total">' + fmt(data.total) + ' د.ع</div>' + 
            '</div>';
    }
    h += '</div></div>';
    h += '<div class="stats-grand"><div>' + fmt(grand) + ' دينار عراقي</div><div class="stats-grand-label">المجموع النهائي</div></div>';
    h += '</div>';
    c.innerHTML = h; 
} 

export async function printStatsReport() { 
    playOnce('print'); 
    if (!state.lastStats) { toast('ابحث أولاً', 'te'); return; } 
    
    if (isMainDevice) {
        var printers = window.App.getButtonPrinters('stats'); 
        if (printers.length === 0) { 
            toast('الرجاء تعيين طابعات لزر الإحصائيات في الإعدادات', 'te'); 
            return; 
        }
        
        var cv = buildStatsCanvas(state.lastStats);
        var imgData = cv.toDataURL('image/jpeg', 0.85);
        var successCount = 0;
        
        for (var i = 0; i < printers.length; i++) {
            try {
                await fetch('http://localhost:5000/print-receipt', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ printerName: printers[i].ip, image: imgData })
                });
                successCount++;
            } catch (err) {
                console.error('Print error:', err);
            }
        }
        if (successCount > 0) toast('تم طباعة التقرير', 'ts');
        else toast('فشلت طباعة التقرير', 'te');
    } else {
        await DB.sendPrintCommand('stats', {
            stats: state.lastStats,
            requestedBy: state.myUser
        });
        toast('تم إرسال تقرير الإحصائيات للطباعة', 'ti');
    }
}

function buildStatsCanvas(stats) {
    var PW = 580, ML = 15;
    var invHeight = stats.invoices.length * 32;
    var itemsHeight = Object.keys(stats.summary).length * 38;
    var totalHeight = 180 + invHeight + itemsHeight + 80;
    
    var cv = document.createElement('canvas');
    cv.width = PW;
    cv.height = Math.max(totalHeight, 400);
    var cx = cv.getContext('2d');
    
    cx.fillStyle = '#ffffff';
    cx.fillRect(0, 0, PW, cv.height);
    cx.fillStyle = '#000000';
    cx.textBaseline = 'middle';
    
    var y = 30;
    
    cx.font = 'bold 28px Arial, Helvetica, sans-serif';
    cx.textAlign = 'center';
    cx.fillText(state.settings.restaurantName || 'المطعم', PW / 2, y);
    y += 40;
    
    cx.font = 'bold 22px Arial, Helvetica, sans-serif';
    cx.fillText('تقرير المبيعات', PW / 2, y);
    y += 35;
    
    cx.font = '14px Arial, Helvetica, sans-serif';
    cx.fillStyle = '#333';
    cx.fillText('المستخدم: ' + stats.targetUser + '  |  الفترة: ' + stats.dateFrom + ' - ' + stats.dateTo, PW / 2, y);
    y += 25;
    
    drawDash(cx, 30, PW - 30, y);
    y += 25;
    
    cx.font = 'bold 18px Arial, Helvetica, sans-serif';
    cx.fillStyle = '#000';
    cx.textAlign = 'right';
    cx.fillText('الفواتير (' + stats.invoices.length + '):', PW - 35, y);
    y += 28;
    
    cx.font = '13px Arial, Helvetica, sans-serif';
    stats.invoices.forEach(function(inv) {
        var t = new Date(inv.settledAt).toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' });
        var d = new Date(inv.settledAt).toLocaleDateString('ar-IQ');
        cx.textAlign = 'right';
        cx.fillText((inv.tableNumber === 'سفري' ? 'تسوق مباشر' : 'طاولة ' + inv.tableNumber) + ' - ' + d + ' ' + t, PW - 40, y);
        cx.textAlign = 'left';
        cx.fillText(fmt(inv.totalPrice) + ' د.ع', 40, y);
        y += 30;
    });
    
    drawDash(cx, 35, PW - 35, y, 1);
    y += 20;
    
    cx.font = 'bold 18px Arial, Helvetica, sans-serif';
    cx.fillStyle = '#000';
    cx.textAlign = 'right';
    cx.fillText('ملخص المواد:', PW - 35, y);
    y += 28;
    
    cx.font = '13px Arial, Helvetica, sans-serif';
    for (var name in stats.summary) {
        var data = stats.summary[name];
        cx.textAlign = 'right';
        cx.fillText(name + ' (' + data.quantity + ')', PW - 40, y);
        cx.textAlign = 'left';
        cx.fillText(fmt(data.total) + ' د.ع', 40, y);
        y += 32;
    }
    
    drawDash(cx, 30, PW - 30, y);
    y += 30;
    
    cx.font = 'bold 22px Arial, Helvetica, sans-serif';
    cx.fillStyle = '#000';
    cx.textAlign = 'right';
    cx.fillText('المجموع النهائي:', PW - 40, y);
    cx.textAlign = 'left';
    cx.fillText(fmt(stats.totalSum) + ' دينار', 40, y);
    y += 50;
    
    cx.font = 'italic 13px Arial, Helvetica, sans-serif';
    cx.textAlign = 'center';
    cx.fillText('نهاية التقرير', PW / 2, y);
    
    return cv;
}

export function clearStats() { 
    var stUser = document.getElementById('stUser');
    var stFrom = document.getElementById('stFrom');
    var stTo = document.getElementById('stTo');
    var statsList = document.getElementById('statsList');
    
    if (stUser) stUser.value = ''; 
    if (stFrom) stFrom.value = ''; 
    if (stTo) stTo.value = ''; 
    if (statsList) statsList.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:36px;">اختر الفترة واضغط بحث.</p>'; 
    state.lastStats = null; 
}
