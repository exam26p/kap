import { state } from './state.js';
import * as DB from './db.js';
import { fmt, playClickSnd, playOnce, toast, drawDash, inRange } from './utils.js';
import * as Ops from './panelOps.js';

// متغير لتتبع آخر رسالة وصولاً لمنع تكرار التنبيه
let lastCaptainMsgKey = null;

// ===== الباركود =====
export function loadQRVersions() {
    const sel = document.getElementById('qrVer'); 
    if (!sel) return; 
    const cv = sel.value; 
    sel.innerHTML = '<option value="">-- اختر --</option>'; 
    if (state.myVersion) { 
        const o = document.createElement('option'); 
        o.value = state.myVersion; 
        o.textContent = 'v' + state.myVersion; 
        sel.appendChild(o); 
    } 
    if (state.myVersion) sel.value = state.myVersion; 
    updateQRPreview(); 
}

export function updateQRPreview() { 
    const base = document.getElementById('qrUrl').value.trim(), 
          ver = document.getElementById('qrVer').value, 
          from = parseInt(document.getElementById('qrFrom').value) || 1, 
          showV = document.getElementById('qrShowVer').checked, 
          el = document.getElementById('qrPreviewUrl'); 
    if (!base) { el.textContent = '-'; return; } 
    let url = base + '?table=' + from; 
    if (showV && ver) url += '&version=' + ver;  
    el.textContent = url;  
} 

export function updateCaptainQR() { 
    const captainUrl = document.getElementById('qrCaptainUrl').value.trim();
    const captainPreviewUrl = document.getElementById('qrCaptainPreviewUrl');
    
    if (!captainUrl) { 
        captainPreviewUrl.textContent = '-'; 
        return; 
    } 
    captainPreviewUrl.textContent = captainUrl; 
} 

export async function generateCaptainQR() { 
    playOnce('print'); 
    const captainUrl = document.getElementById('qrCaptainUrl').value.trim();
    
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

    const grid = document.getElementById('captainQrContainer');
    grid.innerHTML = ''; 
    
    const c = document.createElement('div'); 
    c.className = 'qr-card'; 
    let h = '<div class="qn" style="background:var(--purple);">كابتن</div><div class="ql">الكابتن</div>'; 
    h += '<div id="qr_captain"></div>'; 
    h += '<div class="qh">امسح الباركود لإدارة الطاولات</div>'; 
    h += `<div style="margin-top:8px;"><button class="btn-primary btn-sm" style="background:var(--purple);" onclick="App.printSingleQR('captain')"><i class="fas fa-print"></i> طباعة باركود الكابتن</button></div>`;
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
    const base = document.getElementById('qrUrl').value.trim(), ver = document.getElementById('qrVer').value; 
    const from = parseInt(document.getElementById('qrFrom').value) || 1, to = parseInt(document.getElementById('qrTo').value) || from, showV = document.getElementById('qrShowVer').checked, showH = document.getElementById('qrShowHint').checked; 
    if (!base) { toast('أدخل رابط المنيو', 'te'); return; }  
    
    try {
        await DB.updateData('app_settings', { menuQrUrl: base });
        state.settings.menuQrUrl = base;
    } catch(e) {
        console.error("خطأ في حفظ رابط المنيو:", e);
    }

    const total = Math.max(0, to - from + 1), btn = document.getElementById('qrGenBtn');  
    if (total <= 0 || total > 999) { toast('عدد الطاولات غير صحيح', 'te'); return; } 
    btn.disabled = true;  
    const pw = document.getElementById('qrProgress'); pw.classList.add('show'); 
    const grid = document.getElementById('qrsGrid'); grid.innerHTML = ''; state.qrData = []; 
    const lb = document.getElementById('loadBg'); lb.classList.add('open'); 
    for (let i = 0; i < total; i++) {  
        const tn = from + i, url = base + '?table=' + tn + (ver ? '&version=' + ver : '');  
        try { 
            await DB.setData('tablesA/table_' + tn, { table_number: tn, qr_link: url, version_number: ver || null, status: 'active', created_at: new Date().toISOString() }); 
            state.qrData.push({ tn, url, ver, showV, showH }); makeQR(tn, url, ver, showV, showH); 
        } catch (e) { } 
        const pct = Math.round(((i + 1) / total) * 100); 
        document.getElementById('qrProgFill').style.width = pct + '%'; 
        document.getElementById('qrProgPct').textContent = pct + '%'; 
        document.getElementById('qrProgText').textContent = 'تم ' + (i + 1) + ' من ' + total; 
        document.getElementById('loadCount').textContent = (i + 1) + ' / ' + total; 
        if ((i + 1) % 20 === 0) await new Promise(r => setTimeout(r, 50)); 
    } 
    lb.classList.remove('open'); document.getElementById('qrTools').style.display = 'flex'; btn.disabled = false; toast('تم إنشاء ' + total + ' باركود', 'ts'); 
} 

function makeQR(tn, url, ver, showV, showH) { 
    const c = document.createElement('div'); c.className = 'qr-card'; 
    let h = '<div class="qn">' + tn + '</div><div class="ql">طاولة</div>'; 
    if (showV && ver) h += '<div class="qv">v' + ver + '</div>'; 
    h += '<div id="qr_' + tn + '"></div>'; 
    if (showH) h += '<div class="qh">امسح الباركود للطلب</div>'; 
    h += `<div style="margin-top:8px;"><button class="btn-primary btn-sm" onclick="App.printSingleQR('${tn}')"><i class="fas fa-print"></i> طباعة</button></div>`;
    c.innerHTML = h; document.getElementById('qrsGrid').appendChild(c); 
    new QRCode(document.getElementById('qr_' + tn), { text: url, width: 140, height: 140, colorDark: '#000000', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.H }); 
} 

export function refreshQRCards() { 
    const showV = document.getElementById('qrShowVer').checked, showH = document.getElementById('qrShowHint').checked, cols = parseInt(document.getElementById('qrCols').value) || 4; 
    document.getElementById('qrsGrid').className = 'qrs-grid c' + Math.min(cols, 4); document.getElementById('qrsGrid').innerHTML = ''; state.qrData.forEach(d => makeQR(d.tn, d.url, d.ver, showV, showH)); toast('تم تحديث العرض', 'ts'); 
} 

export function printSingleQR(tn) {
    playOnce('print');
    
    const printers = window.App.getButtonPrinters('qr');
    if (printers.length === 0) {
        toast('الرجاء تعيين طابعة لزر الباركودات في الإعدادات', 'te');
        return;
    }

    let qrUrl = '';
    let qvText = '';
    let targetCard = null;

    if (tn === 'captain') {
        qrUrl = state.settings.captainQrUrl || '';
        if (!qrUrl) { toast('لم يتم حفظ رابط الكابتن بعد', 'te'); return; }
        targetCard = document.querySelector('#captainQrContainer .qr-card');
    } else {
        const allCards = document.querySelectorAll('#qrsGrid .qr-card');
        allCards.forEach(c => {
            if (c.querySelector('.qn')?.textContent === String(tn)) {
                targetCard = c;
            }
        });
        const qrUrlData = state.qrData.find(q => q.tn == tn);
        qrUrl = qrUrlData ? qrUrlData.url : '';
        qvText = targetCard?.querySelector('.qv')?.textContent || '';
    }

    if (!targetCard) { toast('لم يتم العثور على الباركود', 'te'); return; }

    const PW = 550;
    const cv = document.createElement('canvas');
    const cx = cv.getContext('2d');
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
        const tempDiv = document.createElement('div');
        try {
            new QRCode(tempDiv, {
                text: qrUrl,
                width: 350,
                height: 350,
                colorDark: "#000000",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.H
            });
            
            const waitForQR = new Promise(resolve => {
                setTimeout(() => {
                    const tempCanvas = tempDiv.querySelector('canvas');
                    if (tempCanvas) {
                        const xQr = (PW - 350) / 2;
                        cx.drawImage(tempCanvas, xQr, 100, 350, 350); 
                    }
                    resolve();
                }, 150);
            });

            waitForQR.then(() => {
                cx.fillStyle = '#000000';
                cx.font = 'bold 22px "Segoe UI",Tahoma,sans-serif';
                cx.textAlign = 'center';
                
                if (tn === 'captain') {
                    cx.fillText('لإدارة طلبات الزبائن', PW / 2, cv.height - 30);
                } else {
                    cx.fillText('امسح الباركود للطلب', PW / 2, cv.height - 30);
                }

                const imgData = cv.toDataURL('image/jpeg', 0.95);
                toast(`جاري طباعة باركود ${tn === 'captain' ? 'الكابتن' : 'طاولة '+tn}...`, 'ti');
                
                (async () => {
                    let successCount = 0;
                    for (const printer of printers) {
                        try {
                            const response = await fetch('http://localhost:5000/print-receipt', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ ip: printer.ip, image: imgData })
                            });
                            const data = await response.json();
                            if (data.status === 'success') successCount++;
                        } catch (err) {
                            console.error("Print error:", err);
                        }
                    }
                    if (successCount > 0) toast(`تم طباعة باركود ${tn === 'captain' ? 'الكابتن' : 'طاولة '+tn}`, 'ts');
                    else toast('فشلت الطباعة', 'te');
                })();
            });

        } catch(e) {
            console.error("QR Generation error:", e);
        }
    }
}

// ===== التسوق المباشر =====
export function renderDirectGrid() { 
    const search = document.getElementById('directSearch').value.trim().toLowerCase(), catFilter = document.getElementById('directCatFilter').value, grid = document.getElementById('directGrid'); 
    const filterSel = document.getElementById('directCatFilter'); const cv = filterSel.value; state.directAllItems = []; filterSel.innerHTML = '<option value="">جميع الأقسام</option>'; 
    for (let catId in state.directMenuData) { filterSel.innerHTML += '<option value="' + catId + '">' + state.directMenuData[catId].name + '</option>'; if (state.directMenuData[catId].items) { for (let iid in state.directMenuData[catId].items) { const it = state.directMenuData[catId].items[iid]; state.directAllItems.push({ ...it, catId, catName: state.directMenuData[catId].name, _id: iid }); } } } filterSel.value = cv; 
    let filtered = state.directAllItems; if (search) filtered = filtered.filter(i => i.name.toLowerCase().includes(search)); if (catFilter) filtered = filtered.filter(i => i.catId === catFilter); 
    grid.innerHTML = ''; if (!filtered.length) { grid.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:30px;grid-column:1/-1;">لا توجد أصناف.</p>'; return; } 
    filtered.forEach(it => { const imgSrc = it.image && it.image.length > 20 ? it.image : ''; const key = it.catId + '|' + it._id; const qty = state.directCart[key] ? state.directCart[key].quantity : 0; const div = document.createElement('div'); div.className = 'direct-item' + (qty > 0 ? ' selected' : ''); div.innerHTML = (imgSrc ? '<img src="' + imgSrc + '" alt="">' : '<div style="width:100%;height:90px;background:var(--bg-card);border-radius:8px;display:flex;align-items:center;justify-content:center;"><i class="fas fa-image" style="color:var(--text-muted);font-size:24px;"></i></div>') + '<h4>' + it.name + '</h4>' + '<div class="di-price">' + fmt(it.price) + ' د.ع</div>' + '<div class="di-details">' + (it.details || '') + '</div>' + '<div class="direct-qty">' + '<button class="dq-minus" onclick="App.directQtyChange(\'' + key + '\',-1,event)">−</button>' + '<span>' + (qty || 0) + '</span>' + '<button class="dq-plus" onclick="App.directQtyChange(\'' + key + '\',1,event)">+</button>' + '</div>'; div.addEventListener('click', function (e) { if (e.target.closest('.direct-qty')) return; App.directToggle(key); }); grid.appendChild(div); }); updateDirectBar(); 
} 

export function filterDirect() { playClickSnd(); renderDirectGrid(); } 
export function directToggle(key) { if (state.directCart[key]) { delete state.directCart[key]; } else { state.directCart[key] = { quantity: 1 }; } updateDirectBar(); renderDirectGrid(); } 
export function directQtyChange(key, delta, e) { e.stopPropagation(); if (!state.directCart[key]) state.directCart[key] = { quantity: 0 }; state.directCart[key].quantity = Math.max(0, state.directCart[key].quantity + delta); if (state.directCart[key].quantity === 0) delete state.directCart[key]; updateDirectBar(); renderDirectGrid(); } 

function updateDirectBar() { const bar = document.getElementById('directBar'); let count = 0, total = 0; for (let k in state.directCart) { const parts = k.split('|'); const catId = parts[0]; const itemId = parts.slice(1).join('|'); let item = null; if (state.directMenuData[catId] && state.directMenuData[catId].items) { if (state.directMenuData[catId].items[itemId]) item = state.directMenuData[catId].items[itemId]; } if (item) { count += state.directCart[k].quantity; total += item.price * state.directCart[k].quantity; } } if (count > 0) { bar.style.display = 'flex'; } else { bar.style.display = 'none'; } document.getElementById('directCount').textContent = count + ' صنف'; document.getElementById('directTotal').textContent = fmt(total) + ' دينار'; } 

export function clearDirectCart() { state.directCart = {}; updateDirectBar(); renderDirectGrid(); } 

export async function payDirectOrder() { 
    const keys = Object.keys(state.directCart); if (!keys.length) { toast('السلة فارغة', 'te'); return; } 
    let items = [], total = 0; keys.forEach(k => { const parts = k.split('|'); const catId = parts[0]; const itemId = parts.slice(1).join('|'); const cat = state.directMenuData[catId]; if (cat && cat.items && cat.items[itemId]) { const it = cat.items[itemId]; const qty = state.directCart[k].quantity; const sub = it.price * qty; total += sub; items.push({ name: it.name, qty, price: it.price }); } }); 
    if (typeof Ops.printDirectReceipt === 'function') { Ops.printDirectReceipt(items, total); } else { toast('خطأ: دالة الطباعة غير متوفرة', 'te'); return; } 
    const sa = new Date().toISOString(); const ops = []; items.forEach(it => { ops.push(DB.pushData('tablesD/archive_orders', { table_number: 0, name: it.name, price: it.price, quantity: it.qty, settled_at: sa, settled_by: state.myUser })); }); 
    const directOrdersArchive = JSON.parse(localStorage.getItem('direct_orders_archive') || '[]'); directOrdersArchive.push({ settled_by: state.myUser, settled_at: sa, total, items: items.length }); localStorage.setItem('direct_orders_archive', JSON.stringify(directOrdersArchive.slice(-500))); 
    Promise.all(ops).then(() => { state.directCart = {}; updateDirectBar(); renderDirectGrid(); toast('تم الدفع والطباعة بنجاح', 'ts'); if (typeof Ops.updateSales === 'function') Ops.updateSales(); }).catch(() => toast('خطأ في الحفظ', 'te')); 
} 

// ===== الإعدادات =====
export function syncPrinterSelects() { const selectIds = ['rKitchen', 'rCashier', 'stPrinter', 'directPrinter']; selectIds.forEach(sid => { const el = document.getElementById(sid); if (!el) return; const cv = el.value; el.innerHTML = '<option value="">-- اختر طابعة --</option>'; for (let id in state.dPrinters) { el.innerHTML += '<option value="' + state.dPrinters[id].ip + '">' + state.dPrinters[id].name + ' (' + state.dPrinters[id].ip + ')</option>'; } el.value = cv; }); if (document.getElementById('rKitchen')) document.getElementById('rKitchen').value = state.routing.kitchenPrinterIp; if (document.getElementById('rCashier')) document.getElementById('rCashier').value = state.routing.cashierPrinterIp; } 

export function renderPrinters() { const c = document.getElementById('printersList'); if (!c) return; if (!Object.keys(state.dPrinters).length) { c.innerHTML = '<p style="color:var(--text-muted);font-size:12px;text-align:center;padding:12px;">لا توجد طابعات.</p>'; return; } c.innerHTML = ''; for (let id in state.dPrinters) { c.innerHTML += '<div class="printer-row">' + '<div style="color:var(--text-secondary);font-size:13px;">' + '<i class="fas fa-print" style="color:var(--accent);margin-left:8px;"></i>' + '<b>' + state.dPrinters[id].name + '</b> ' + '<span style="color:var(--text-muted);">(' + state.dPrinters[id].ip + ')</span>' + '</div>' + '<div style="display:flex;gap:8px;">' + '<button class="btn-secondary btn-sm" onclick="App.pingP(\'' + state.dPrinters[id].ip + '\')"><i class="fas fa-wifi"></i> فحص</button>' + '<button class="btn-secondary btn-sm btn-red" onclick="App.delP(\'' + id + '\')"><i class="fas fa-trash"></i></button>' + '</div>' + '</div>'; } } 

export function pingP(ip) { fetch('http://localhost:5000/api/ping-printer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ip }) }).then(r => r.json()).then(d => toast('[' + ip + ']: ' + d.message, d.message.includes('متصل') ? 'ts' : 'te')).catch(() => toast('تعذر الاتصال بسيرفر الطباعة', 'te')); } 
export function addPrinter() { const n = document.getElementById('pName').value.trim(), ip = document.getElementById('pIP').value.trim(); if (!n || !ip) { toast('أدخل اسم الطابعة والـ IP', 'te'); return; } DB.pushData('printers_config', { name: n, ip }).then(() => { document.getElementById('pName').value = ''; document.getElementById('pIP').value = ''; toast('تمت إضافة الطابعة', 'ts'); }); } 
export function delP(id) { if (confirm('حذف هذه الطابعة؟')) DB.removeData('printers_config/' + id); } 

export function previewLogo(input) { if (!input.files || !input.files[0]) return; const file = input.files[0]; const reader = new FileReader(); reader.onload = e => { const img = new Image(); img.onload = () => { const cv = document.createElement('canvas'); const maxSize = 200; let w = img.width, h = img.height; if (w > maxSize || h > maxSize) { if (w > h) { h = Math.round(h * maxSize / w); w = maxSize; } else { w = Math.round(w * maxSize / h); h = maxSize; } } cv.width = w; cv.height = h; cv.getContext('2d').drawImage(img, 0, 0, w, h); state.pendingLogoData = cv.toDataURL('image/jpeg', 0.8); syncLogoDisplay(state.pendingLogoData); }; img.src = e.target.result; }; reader.readAsDataURL(file); } 
export function removeLogo() { state.pendingLogoData = '__REMOVE__'; syncLogoDisplay(''); document.getElementById('logoInput').value = ''; } 
export function syncLogoDisplay(dataUrl) { const img = document.getElementById('logoPreview'), ph = document.getElementById('logoPlaceholder'), hImg = document.getElementById('headerLogo'), hPh = document.getElementById('headerLogoPlaceholder'), rmBtn = document.getElementById('removeLogoBtn'); if (dataUrl && dataUrl.length > 10) { img.src = dataUrl; img.style.display = 'block'; ph.style.display = 'none'; hImg.src = dataUrl; hImg.style.display = 'block'; hPh.style.display = 'none'; if (rmBtn) rmBtn.style.display = 'inline-flex'; } else { img.style.display = 'none'; img.src = ''; ph.style.display = 'flex'; hImg.style.display = 'none'; hImg.src = ''; hPh.style.display = 'flex'; if (rmBtn) rmBtn.style.display = 'none'; } } 

export function saveSettings() { const n = document.getElementById('sName').value.trim(), invUrl = document.getElementById('sInvoiceUrl').value.trim(), os = document.getElementById('sOrderSnd').value, ms = document.getElementById('sMsgSnd').value, ps = document.getElementById('sPrintSnd').value, cs = document.getElementById('sClickSnd').value, ki = document.getElementById('rKitchen') ? document.getElementById('rKitchen').value : '', ci = document.getElementById('rCashier') ? document.getElementById('rCashier').value : ''; const ns = { restaurantName: n || 'المطعم', orderSound: os, msgSound: ms, printSound: ps, clickSound: cs, invoiceQrUrl: invUrl }; if (state.pendingLogoData === '__REMOVE__') ns.restaurantLogo = ''; else if (state.pendingLogoData && state.pendingLogoData.length > 20) ns.restaurantLogo = state.pendingLogoData; Promise.all([DB.updateData('app_settings', ns), DB.setData('buttons_routing', { kitchenPrinterIp: ki, cashierPrinterIp: ci })]).then(() => { state.settings = { ...state.settings, ...ns }; state.routing = { kitchenPrinterIp: ki, cashierPrinterIp: ci }; document.getElementById('brandName').textContent = state.settings.restaurantName; state.pendingLogoData = null; toast('تم حفظ الإعدادات', 'ts'); }); } 

export function loadSettingsUI() { 
    if (document.getElementById('sName')) document.getElementById('sName').value = state.settings.restaurantName || ''; 
    if (document.getElementById('sInvoiceUrl')) document.getElementById('sInvoiceUrl').value = state.settings.invoiceQrUrl || ''; 
    if (document.getElementById('sOrderSnd')) document.getElementById('sOrderSnd').value = state.settings.orderSound || 'off'; 
    if (document.getElementById('sMsgSnd')) document.getElementById('sMsgSnd').value = state.settings.msgSound || 'off'; 
    if (document.getElementById('sPrintSnd')) document.getElementById('sPrintSnd').value = state.settings.printSound || 'off'; 
    if (document.getElementById('sClickSnd')) document.getElementById('sClickSnd').value = state.settings.clickSound || 'off'; 
    syncLogoDisplay(state.settings.restaurantLogo || ''); 
    state.pendingLogoData = null; 
    
    if (document.getElementById('qrUrl')) document.getElementById('qrUrl').value = state.settings.menuQrUrl || 'https://exam26p.github.io/kap/index2.html';
    if (document.getElementById('qrCaptainUrl')) {
        document.getElementById('qrCaptainUrl').value = state.settings.captainQrUrl || '';
        updateCaptainQR();
        if (state.settings.captainQrUrl) {
            generateCaptainQRAuto(state.settings.captainQrUrl);
        }
    }
    updateQRPreview();
} 

function generateCaptainQRAuto(url) { 
    const grid = document.getElementById('captainQrContainer');
    if (!grid) return;
    grid.innerHTML = ''; 
    
    const c = document.createElement('div'); 
    c.className = 'qr-card'; 
    let h = '<div class="qn" style="background:var(--purple);">كابتن</div><div class="ql">الكابتن</div>'; 
    h += '<div id="qr_captain"></div>'; 
    h += '<div class="qh">امسح الباركود لإدارة الطاولات</div>'; 
    h += `<div style="margin-top:8px;"><button class="btn-primary btn-sm" style="background:var(--purple);" onclick="App.printSingleQR('captain')"><i class="fas fa-print"></i> طباعة باركود الكابتن</button></div>`;
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

// ===== الإحصائيات (تم إصلاح خطأ continue هنا) =====
export function syncStatsUsers() { const s = document.getElementById('stUser'); if (!s) return; const cv = s.value; s.innerHTML = '<option value="">الكل</option>'; for (let id in state.dUsers) s.innerHTML += '<option value="' + state.dUsers[id].username + '">' + state.dUsers[id].username + '</option>'; s.value = cv; } 

export function searchStats() { 
    const user = document.getElementById('stUser').value, from = document.getElementById('stFrom').value, to = document.getElementById('stTo').value; 
    if (!from && !to && !user) { toast('حدد فلتر واحد على الأقل', 'te'); return; } 
    
    let invMap = {}, itemsSum = {}, grand = 0; 
    
    for (let id in state.dD) { 
        const o = state.dD[id]; 
        if (!o) continue; // هنا الـ continue صحيحة لأنها داخل حلقة for
        
        // تم استبدال الـ continue الخاطئة بجملة شرطية if
        if ((!user || o.settled_by === user) && inRange(o.settled_at, from, to)) {
            const price = parseFloat(o.price) || 0, qty = parseInt(o.quantity) || 1, sub = price * qty; 
            const ik = o.table_number + '_' + o.settled_at; 
            if (!invMap[ik]) invMap[ik] = { tableNumber: o.table_number, settledAt: o.settled_at, totalPrice: 0 }; 
            invMap[ik].totalPrice += sub; 
            if (!itemsSum[o.name]) itemsSum[o.name] = { quantity: 0, total: 0 }; 
            itemsSum[o.name].quantity += qty; 
            itemsSum[o.name].total += sub; 
            grand += sub; 
        }
    } 
    
    const directOrders = JSON.parse(localStorage.getItem('direct_orders_archive') || '[]'); 
    directOrders.forEach(order => { 
        if (user && order.settled_by !== user) return; 
        if (!inRange(order.settled_at, from, to)) return; 
        grand += order.total || 0; 
        const ik = 'direct_' + order.settled_at; 
        if (!invMap[ik]) invMap[ik] = { tableNumber: 'سفري', settledAt: order.settled_at, totalPrice: 0 }; 
        invMap[ik].totalPrice += order.total || 0; 
        
        if (!itemsSum['تسوق مباشر']) itemsSum['تسوق مباشر'] = { quantity: 0, total: 0 }; 
        itemsSum['تسوق مباشر'].quantity += order.items || 1; 
        itemsSum['تسوق مباشر'].total += order.total || 0; 
    }); 
    
    const invList = Object.values(invMap).sort((a, b) => new Date(a.settledAt) - new Date(b.settledAt)); 
    state.lastStats = { targetUser: user || 'الكل', dateFrom: from || 'البداية', dateTo: to || 'اليوم', invoices: invList, summary: itemsSum, totalSum: grand, ordersCount: invList.length }; 
    
    const c = document.getElementById('statsList'); 
    if (!invList.length) { c.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:36px;">لا توجد مبيعات.</p>'; state.lastStats = null; return; } 
    
    let h = '<h4 style="color:var(--accent);margin-bottom:12px;font-size:13px;"><i class="fas fa-receipt"></i> الفواتير (' + invList.length + '):</h4>' + '<div style="max-height:160px;overflow-y:auto;background:var(--bg-input);border-radius:10px;padding:10px;margin-bottom:18px;border:1px solid var(--border);">'; 
    invList.forEach(inv => { const t = new Date(inv.settledAt).toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' }), d = new Date(inv.settledAt).toLocaleDateString('ar-IQ'); h += '<div class="s-inv-row">' + '<span><b>' + (inv.tableNumber === 'سفري' ? 'تسوق مباشر' : 'طاولة ' + inv.tableNumber) + '</b> <small style="color:var(--text-muted);margin-right:6px;">(' + d + ' ' + t + ')</small></span>' + '<span style="color:var(--green);font-weight:700;">' + fmt(inv.totalPrice) + ' د.ع</span>' + '</div>'; }); 
    h += '</div><h4 style="color:var(--teal);margin-bottom:12px;font-size:13px;"><i class="fas fa-box-open"></i> ملخص المواد:</h4>'; 
    Object.entries(itemsSum).forEach(([name, data]) => { h += '<div class="s-item-card">' + '<div>' + '<div class="s-item-name"><i class="fas fa-utensils" style="color:var(--teal);margin-left:5px;font-size:12px;"></i>' + name + '</div>' + '<div class="s-item-count">العدد: ' + data.quantity + '</div>' + '</div>' + '<span class="s-item-total">' + fmt(data.total) + ' د.ع</span>' + '</div>'; }); 
    h += '<div class="s-grand">' + '<div class="s-label">المجموع النهائي</div>' + '<div class="s-value">' + fmt(grand) + ' دينار عراقي</div>' + '</div>'; 
    c.innerHTML = h; 
} 

export async function printStatsReport() { playOnce('print'); if (!state.lastStats) { toast('ابحث أولاً', 'te'); return; } const printers = window.App.getButtonPrinters('stats'); if (printers.length === 0) { toast('الرجاء تعيين طابعات لزر الإحصائيات في الإعدادات', 'te'); return; } const cv = document.createElement('canvas'), cx = cv.getContext('2d'), w = 576; const ni = Object.keys(state.lastStats.summary).length, nv = state.lastStats.invoices.length; const ch = 280 + (nv * 28) + 50 + (ni * 32) + 160; cv.width = w; cv.height = Math.max(ch, 280); cx.fillStyle = '#fff'; cx.fillRect(0, 0, w, cv.height); cx.fillStyle = '#000'; cx.textBaseline = 'middle'; cx.font = 'bold 26px "Segoe UI",Tahoma,sans-serif'; cx.textAlign = 'center'; cx.fillText(state.settings.restaurantName || 'المطعم', w / 2, 40); cx.font = 'bold 20px "Segoe UI",Tahoma,sans-serif'; cx.fillText('تقرير المبيعات', w / 2, 76); cx.font = '14px "Segoe UI",Tahoma,sans-serif'; cx.fillStyle = '#222'; cx.fillText('المستخدم: ' + state.lastStats.targetUser + '  |  الفترة: ' + state.lastStats.dateFrom + ' - ' + state.lastStats.dateTo, w / 2, 110); drawDash(cx, 20, w - 20, 130); let y = 150; cx.font = 'bold 16px "Segoe UI",Tahoma,sans-serif'; cx.fillStyle = '#000'; cx.textAlign = 'right'; cx.fillText('الفواتير:', w - 30, y); y += 24; cx.font = '13px "Segoe UI",Tahoma,sans-serif'; state.lastStats.invoices.forEach(inv => { const t = new Date(inv.settledAt).toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' }); cx.textAlign = 'right'; cx.fillText((inv.tableNumber === 'سفري' ? 'تسوق مباشر' : 'طاولة ' + inv.tableNumber) + ' (' + t + ')', w - 40, y); cx.textAlign = 'left'; cx.fillText(fmt(inv.totalPrice) + ' د.ع', 40, y); y += 28; }); drawDash(cx, 25, w - 25, y); y += 24; cx.font = 'bold 16px "Segoe UI",Tahoma,sans-serif'; cx.fillStyle = '#000'; cx.textAlign = 'right'; cx.fillText('ملخص المواد:', w - 30, y); y += 24; cx.font = 'bold 14px "Segoe UI",Tahoma,sans-serif'; Object.entries(state.lastStats.summary).forEach(([name, data]) => { cx.textAlign = 'right'; cx.fillText(name + ' (' + data.quantity + ')', w - 40, y); cx.textAlign = 'left'; cx.fillText(fmt(data.total) + ' د.ع', 40, y); y += 32; }); drawDash(cx, 20, w - 20, y); y += 34; cx.font = 'bold 20px "Segoe UI",Tahoma,sans-serif'; cx.textAlign = 'right'; cx.fillText('المجموع النهائي:', w - 30, y); cx.textAlign = 'left'; cx.fillText(fmt(state.lastStats.totalSum) + ' دينار', 30, y); y += 40; cx.font = 'italic 14px "Segoe UI",Tahoma,sans-serif'; cx.textAlign = 'center'; cx.fillText('نهاية التقرير', w / 2, y); const imgData = cv.toDataURL('image/jpeg', 0.85); let successCount = 0; let failCount = 0; toast(`جاري طباعة التقرير على ${printers.length} طابعة...`, 'ti'); for (const printer of printers) { try { const response = await fetch('http://localhost:5000/print-receipt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ip: printer.ip, image: imgData }) }); const data = await response.json(); if (data.status === 'success') { successCount++; } else { failCount++; } } catch (err) { failCount++; console.error(`خطأ في الطباعة على ${printer.ip}:`, err); } } if (successCount > 0) { toast(`تمت طباعة التقرير على ${successCount} طابعة${failCount > 0 ? `، فشل ${failCount}` : ''}`, 'ts'); } else { toast('فشلت طباعة التقرير', 'te'); } } 

export function clearStats() { if (document.getElementById('stUser')) document.getElementById('stUser').value = ''; if (document.getElementById('stFrom')) document.getElementById('stFrom').value = ''; if (document.getElementById('stTo')) document.getElementById('stTo').value = ''; const statsList = document.getElementById('statsList'); if (statsList) statsList.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:36px;">اختر الفترة واضغط بحث.</p>'; state.lastStats = null; } 

// ===== الكابتن =====
function updateCaptainBadge(show) {
    const btn = document.querySelector('.h-btn[onclick*="captainModal"]');
    if (!btn) return;
    let badge = document.getElementById('badgeCaptain');
    if (!badge && show) {
        badge = document.createElement('span');
        badge.id = 'badgeCaptain';
        badge.className = 'tab-badge show';
        badge.style.cssText = 'position:absolute;top:-5px;left:-5px;background:var(--red);color:#fff;font-size:10px;font-weight:800;padding:1px 7px;border-radius:10px;min-width:20px;text-align:center;';
        badge.textContent = '!';
        btn.style.position = 'relative';
        btn.appendChild(badge);
    }
    if (badge) {
        badge.style.display = show ? 'inline' : 'none';
    }
}

export function initCaptainChat() {  
    if (!state.myUser) return;  

    const captainBtn = document.querySelector('.h-btn[onclick*="captainModal"]');
    if (captainBtn) {
        captainBtn.onclick = () => {
            document.getElementById('captainModal').classList.add('open');
            updateCaptainBadge(false);
        };
    }

    DB.listenCaptainChat(state.myUser, data => {  
        const box = document.getElementById('captainMsgs');  
        if (!box) return; 
        box.innerHTML = '';  
        if (!data) {  
            box.innerHTML = '<p style="color:var(--text-muted);font-size:12px;text-align:center;padding:24px;">لا توجد رسائل بعد.</p>';  
            return;  
        }  
        let m = [];  
        for (let id in data) m.push({ ...data[id], _id: id });  
        m.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));  
        if (!m.length) {  
            box.innerHTML = '<p style="color:var(--text-muted);font-size:12px;text-align:center;padding:24px;">لا توجد رسائل بعد.</p>';  
            return;  
        }  

        const latestMsg = m[m.length - 1];
        if (latestMsg.sender === 'captain' && latestMsg._id !== lastCaptainMsgKey) {
            if (lastCaptainMsgKey !== null) { 
                playOnce('msg'); 
                toast('رسالة جديدة من الكابتن: ' + latestMsg.text.substring(0, 30), 'ti'); 
                updateCaptainBadge(true); 
            }
            lastCaptainMsgKey = latestMsg._id; 
        }

        m.forEach(x => {  
            const isMe = x.sender === 'cashier'; 
            const t = new Date(x.timestamp).toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' });  
            box.innerHTML += '<div class="cpm ' + (isMe ? 'from-me' : 'from-captain') + '">' + 
                '<small style="opacity:.6;">' + (isMe ? (x.sender_name || 'أنت') : 'الكابتن') + ' - ' + t + '</small><br>' + 
                x.text +  
            '</div>';  
        });  
        box.scrollTop = box.scrollHeight;  
    });  
} 

export function sendCaptain() {  
    const i = document.getElementById('captainInput'), t = i ? i.value.trim() : '';  
    if (!t || !state.myUser) return;  
    playClickSnd();  
    DB.pushData('captain_chats/' + state.myUser, { text: t, sender: 'cashier', sender_name: state.myUser, timestamp: new Date().toISOString() });  
    if (i) i.value = '';  
}
