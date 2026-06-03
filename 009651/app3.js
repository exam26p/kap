import { state } from './state.js';
import * as DB from './db.js';
import * as Ops from './panelOps3.js';
import * as Menu from './panelMenu.js';
import * as Others from './panelOthers.js';
import * as Links from './panelLinks.js';
import * as Theme from './panelTheme.js';
import { fmt, genSid, playClickSnd, toast, unlockAudio } from './utils.js';

// ===== متغيرات وضع الكابتن (أخذ الطلبات) =====
let captainOrders = {};
let captainTable = null;

export const App = {
    init() {
        this.bindEvents();
        this.initLogin();
    },
    
    bindEvents() {
        const self = this;
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                playClickSnd();
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
                btn.classList.add('active');
                const tabId = btn.dataset.tab;
                if(document.getElementById(tabId)) {
                    document.getElementById(tabId).classList.add('active');
                }
            });
        });
        
        document.getElementById('inVer').addEventListener('input', () => self.validateVersion());
        document.getElementById('inUser').addEventListener('input', () => self.validateUser());
        document.getElementById('inPass').addEventListener('input', () => self.validatePass());
        document.getElementById('inPass').addEventListener('keydown', e => { if (e.key === 'Enter') self.doLogin(); });
        
        document.getElementById('captainModal').addEventListener('click', e => { if (e.target.id === 'captainModal') e.target.classList.remove('open'); });
        document.getElementById('captainInvoiceModal').addEventListener('click', e => { if (e.target.id === 'captainInvoiceModal') e.target.classList.remove('open'); });
        document.getElementById('captainChatModal').addEventListener('click', e => { if (e.target.id === 'captainChatModal') e.target.classList.remove('open'); });
        document.getElementById('imgModal').addEventListener('click', e => { if (e.target.id === 'imgModal') e.target.classList.remove('open'); });
        
        document.addEventListener('click', () => unlockAudio(), { once: true });
    },
    
    validateVersion() { 
        const v = document.getElementById('inVer').value.trim(), el = document.getElementById('verCheck'); 
        if (!v) { el.className = 'check-icon'; el.innerHTML = ''; return; } 
        const ok = Object.values(state.dVersions).some(x => x.version_number === v); 
        el.className = 'check-icon ' + (ok ? 'valid' : 'invalid'); 
        el.innerHTML = ok ? '<i class="fas fa-circle-check"></i>' : '<i class="fas fa-circle-xmark"></i>'; 
    },
    
    validateUser() { 
        const v = document.getElementById('inUser').value.trim(), el = document.getElementById('userCheck'); 
        if (!v) { el.className = 'check-icon'; el.innerHTML = ''; return; } 
        const ok = Object.values(state.dUsers).some(x => x.username === v); 
        el.className = 'check-icon ' + (ok ? 'valid' : 'invalid'); 
        el.innerHTML = ok ? '<i class="fas fa-circle-check"></i>' : '<i class="fas fa-circle-xmark"></i>'; 
    },
    
    validatePass() { 
        const u = document.getElementById('inUser').value.trim(), p = document.getElementById('inPass').value.trim(), el = document.getElementById('passCheck'); 
        if (!u || !p) { el.className = 'check-icon'; el.innerHTML = ''; return; } 
        const ok = Object.values(state.dUsers).some(x => x.username === u && x.password === p); 
        el.className = 'check-icon ' + (ok ? 'valid' : 'invalid'); 
        el.innerHTML = ok ? '<i class="fas fa-circle-check"></i>' : '<i class="fas fa-circle-xmark"></i>'; 
    },
    
    async initLogin() {
        await Promise.all([
            DB.getVersions().then(s => { state.dVersions = s.val() || {}; }), 
            DB.getUsers().then(s => { state.dUsers = s.val() || {}; }), 
            DB.getSettings().then(s => { if (s.exists()) state.settings = { ...state.settings, ...s.val() }; }), 
            DB.getRouting().then(s => { if (s.exists()) state.routing = s.val(); })
        ]);
        
        document.getElementById('brandName').textContent = state.settings.restaurantName || 'المطعم';
        const sv = localStorage.getItem('ops_device_version'); 
        if (sv) document.getElementById('verField').style.display = 'none';
        
        const ss = localStorage.getItem('ops_session');
        if (ss) { 
            try { 
                const sess = JSON.parse(ss); 
                const snap = await DB.getSessions(sess.sessionId); 
                if (snap.exists()) { 
                    state.mySid = sess.sessionId; 
                    state.myUser = sess.username; 
                    state.myVersion = sess.version || sv; 
                    this.enterApp(); 
                    return; 
                } else localStorage.removeItem('ops_session'); 
            } catch (e) { localStorage.removeItem('ops_session'); } 
        }
        document.getElementById('loginOverlay').classList.remove('hidden');
    },
    
    async doLogin() {
        unlockAudio();
        const err = document.getElementById('loginErr'), btn = document.getElementById('btnLogin'); 
        err.textContent = ''; btn.disabled = true;
        let ver = localStorage.getItem('ops_device_version') || document.getElementById('inVer').value.trim();
        const user = document.getElementById('inUser').value.trim(), pass = document.getElementById('inPass').value.trim();
        
        if (!localStorage.getItem('ops_device_version')) { 
            if (!ver) { err.textContent = 'أدخل رقم الإصدار'; btn.disabled = false; return; } 
            if (!Object.values(state.dVersions).some(v => v.version_number === ver)) { err.textContent = 'رقم الإصدار غير مسجل'; btn.disabled = false; return; } 
            localStorage.setItem('ops_device_version', ver); 
        }
        if (!user) { err.textContent = 'أدخل اسم المستخدم'; btn.disabled = false; return; }
        if (!pass) { err.textContent = 'أدخل كلمة السر'; btn.disabled = false; return; }
        if (!Object.values(state.dUsers).some(u => u.username === user && u.password === pass)) { err.textContent = 'بيانات الدخول غير صحيحة'; btn.disabled = false; return; }
        
        state.mySid = genSid(); state.myUser = user; state.myVersion = ver;
        try { 
            await DB.setData('active_sessions/' + state.mySid, { username: user, logged_in_at: new Date().toISOString(), device_version: ver }); 
            localStorage.setItem('ops_session', JSON.stringify({ sessionId: state.mySid, username: user, version: ver })); 
            this.enterApp(); 
        } catch (e) { err.textContent = 'خطأ أثناء الاتصال'; btn.disabled = false; }
    },
    
    enterApp() { 
        document.getElementById('loginOverlay').classList.add('hidden'); 
        document.getElementById('appRoot').style.display = 'block'; 
        toast('مرحباً ' + state.myUser, 'ts'); 
        this.startListeners(); 
        if(Others.loadSettingsUI) Others.loadSettingsUI();
        if(Links.initLinksModule) Links.initLinksModule();
        if(Theme.initThemeModule) Theme.initThemeModule();
    },
    
    async doLogout() { 
        document.getElementById('confirmLogout').classList.remove('open'); 
        try { await DB.removeData('active_sessions/' + state.mySid); localStorage.removeItem('ops_session'); location.reload(); } catch (e) { toast('خطأ', 'te'); } 
    },
    
    togglePassword() { 
        const inp = document.getElementById('inPass'), ico = document.getElementById('togglePass').querySelector('i'); 
        if (inp.type === 'password') { inp.type = 'text'; ico.className = 'fas fa-eye-slash'; } else { inp.type = 'password'; ico.className = 'fas fa-eye'; } 
    },
    
    startListeners() {
        DB.listenTablesA(data => { state.dA = data; this.render(); this.loadTablesDropdown(); });
        DB.listenTablesB(data => { state.dB = data; this.render(); });
        DB.listenTablesC(data => { state.dC = data; this.render(); });
        DB.listenMsgA(data => { state.dMsgA = data; this.render(); });
        DB.listenReadCounters(data => { state.dRead = data; this.render(); });
        DB.listenArchiveOrders(data => { state.dD = data; Ops.updateSales(); });
        
        DB.listenSessions(data => { 
            state.dSessions = data || {}; this.renderChips(); 
            if (state.mySid && !state.dSessions[state.mySid]) { localStorage.removeItem('ops_session'); toast('تم تسجيل خروجك من جهاز آخر', 'te'); setTimeout(() => location.reload(), 2000); } 
        });

        DB.listenUsers(data => { 
            state.dUsers = data || {}; 
        });

        DB.listenSettings(data => { 
            if (data) { 
                state.settings = { ...state.settings, ...data }; 
                document.getElementById('brandName').textContent = state.settings.restaurantName || 'المطعم'; 
                if(Others.syncLogoDisplay) Others.syncLogoDisplay(state.settings.restaurantLogo || ''); 
            } 
        });
        
        DB.listenVersions(data => { state.dVersions = data; });
        
        DB.listenOrders(data => { 
            state.directMenuData = data || {}; 
            if(document.getElementById('menuStructure')) Menu.renderMenuStructure(); // يمنع خطأ المنيو
            this.renderCaptainMenu(data); 
        });
        
        if(Others.initCaptainChat) Others.initCaptainChat();
    },
    
    render() { 
        Ops.renderGrid(); 
        if (state.activeTable) { Ops.renderDetail(); Ops.markRead(state.activeTable); } 
    },
    
    renderChips() { 
        const c = document.getElementById('userChips'); c.innerHTML = ''; if (!state.dSessions) return;
        for (let id in state.dSessions) { const d = document.createElement('div'); d.className = 'u-chip'; d.innerHTML = '<span class="dot"></span>' + state.dSessions[id].username; if (id === state.mySid) d.style.borderColor = 'var(--accent)'; c.appendChild(d); } 
        document.getElementById('logoutUser').textContent = state.myUser || ''; 
    },
    
    playPreview(type) {
        if (type === 'click') { playClickSnd(); } else { let sound = type === 'order' ? state.settings.orderSound : state.settings.msgSound; if (sound && sound !== 'off') { const audio = new Audio(sound); audio.play().catch(() => {}); } }
    },

    // ===== دوال الكابتن لأخذ الطلبات (ملائمة للتاب) =====
    loadTablesDropdown() {
        const sel = document.getElementById('captainTableSelect');
        if(!sel) return;
        const cv = sel.value;
        sel.innerHTML = '<option value="">-- اختر طاولة --</option>';
        for (let id in state.dA) {
            const t = state.dA[id]; if (t && t.table_number) {
                const opt = document.createElement('option'); opt.value = t.table_number; opt.textContent = 'طاولة ' + t.table_number; sel.appendChild(opt);
            }
        }
        sel.value = cv;
    },

    captainChangeTable(tableNum) { captainTable = tableNum; captainOrders = {}; this.renderCaptainMenu(state.directMenuData); this.updateCaptainBar(); },

    renderCaptainMenu(data) {
        const c = document.getElementById('captainMenuCats'); if(!c) return; c.innerHTML = '';
        if (!data) { c.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:30px;">المنيو فارغ حالياً.</p>'; return; }
        for (var catId in data) {
            var cat = data[catId]; var items = cat.items || {}; var itemHTML = "";
            for (var itemId in items) {
                var it = items[itemId]; var key = catId + "_" + itemId; var qty = captainOrders[key] ? captainOrders[key].quantity : 0; var imgSrc = it.image || "";
                itemHTML += `<div class="direct-item ${qty > 0 ? 'selected' : ''}" onclick="App.captainToggleItem('${key}')">
                    ${imgSrc ? `<img src="${imgSrc}" alt="" style="width:100%;height:90px;object-fit:cover;border-radius:8px;margin-bottom:8px;">` : '<div style="width:100%;height:90px;background:var(--bg-input);border-radius:8px;display:flex;align-items:center;justify-content:center;margin-bottom:8px;"><i class="fas fa-image" style="color:var(--text-muted);font-size:24px;"></i></div>'}
                    <h4 style="font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${it.name}</h4>
                    <div style="font-size:15px;font-weight:900;color:var(--red);margin-top:4px;">${fmt(it.price)} د.ع</div>
                    <div class="direct-qty" style="opacity:${qty > 0 ? '1' : '0'}; pointer-events:${qty > 0 ? 'all' : 'none'};">
                        <button class="dq-minus" onclick="event.stopPropagation(); App.captainQtyChange('${key}', -1)">−</button><span>${qty}</span><button class="dq-plus" onclick="event.stopPropagation(); App.captainQtyChange('${key}', 1)">+</button>
                    </div></div>`;
            }
            c.innerHTML += `<div style="margin-bottom:24px;"><h3 style="font-size:18px;font-weight:800;color:var(--accent);margin-bottom:12px;border-bottom:1px solid var(--border);padding-bottom:8px;">${cat.name}</h3><div class="direct-grid">${itemHTML}</div></div>`;
        }
    },

    captainToggleItem(key) { if (!captainTable) { toast('اختر طاولة أولاً', 'te'); return; } if (captainOrders[key]) { delete captainOrders[key]; } else { captainOrders[key] = { quantity: 1 }; } this.updateCaptainBar(); this.renderCaptainMenu(state.directMenuData); },
    captainQtyChange(key, delta) { if (!captainOrders[key]) captainOrders[key] = { quantity: 0 }; captainOrders[key].quantity = Math.max(0, captainOrders[key].quantity + delta); if (captainOrders[key].quantity === 0) delete captainOrders[key]; this.updateCaptainBar(); this.renderCaptainMenu(state.directMenuData); },
    
    updateCaptainBar() {
        const bar = document.getElementById('captainBottomBar'); if(!bar) return; let count = 0, total = 0;
        for (let k in captainOrders) { const parts = k.split('_'); const catId = parts[0]; const itemId = parts.slice(1).join('_'); const item = state.directMenuData[catId]?.items?.[itemId]; if (item) { count += captainOrders[k].quantity; total += item.price * captainOrders[k].quantity; } }
        bar.style.display = count > 0 ? 'flex' : 'none'; document.getElementById('captainBarCount').textContent = count; document.getElementById('captainBarTotal').textContent = 'الإجمالي: ' + fmt(total) + ' دينار';
    },

    captainOpenInvoice() {
        const ic = document.getElementById('captainInvItems'); let total = 0; let html = '';
        for (let k in captainOrders) { const parts = k.split('_'); const catId = parts[0]; const itemId = parts.slice(1).join('_'); const item = state.directMenuData[catId]?.items?.[itemId]; if (item) { const qty = captainOrders[k].quantity; const sub = item.price * qty; total += sub; html += `<div class="inv-row" style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px dashed var(--border);"><span>${item.name} (${qty})</span><span>${fmt(sub)} د.ع</span></div>`; } }
        ic.innerHTML = html || '<p style="color:var(--text-muted);text-align:center;padding:20px;">لا توجد طلبات.</p>';
        document.getElementById('captainInvTotal').textContent = 'الإجمالي: ' + fmt(total) + ' دينار';
        document.getElementById('captainInvoiceModal').classList.add('open');
    },

    captainSendOrder() {
        if (!captainTable) { toast('اختر طاولة أولاً', 'te'); return; } if (!Object.keys(captainOrders).length) { toast('السلة فارغة', 'te'); return; }
        for (let k in captainOrders) { const parts = k.split('_'); const catId = parts[0]; const itemId = parts.slice(1).join('_'); const item = state.directMenuData[catId]?.items?.[itemId]; if (item) { DB.pushData('tablesB/table_' + captainTable + '/sent_orders', { name: item.name, price: item.price, quantity: captainOrders[k].quantity, settled_by: "captain", settled_at: new Date().toISOString() }); } }
        captainOrders = {}; this.updateCaptainBar(); this.renderCaptainMenu(state.directMenuData); document.getElementById('captainInvoiceModal').classList.remove('open'); toast('تم إرسال الطلب للمطبخ بنجاح', 'ts');
    },

    dismissCashierAlert() { document.getElementById('cashierAlertBanner').style.display = 'none'; },
    closeCaptainChat() { document.getElementById('captainChatModal').classList.remove('open'); },
    sendCaptainChat() { var inp = document.getElementById('captainChatIn'); var txt = inp.value.trim(); if (!txt || !state.myUser) return; DB.pushData('captain_chats/' + state.myUser, { text: txt, timestamp: new Date().toISOString(), sender: "captain", sender_name: "كابتن" }); inp.value = ""; },

    // ===== ربط الدوال =====
    openDetail: Ops.openDetail, closeDetail: Ops.closeDetail, sendAdminReply: Ops.sendAdminReply,
    printToKitchen: () => toast('لطباعة الطلبات، يرجى استخدام شاشة الكمبيوتر الرئيسية', 'ti'),
    settleInvoice: () => toast('لتسديد الحسابات، يرجى استخدام شاشة الكمبيوتر الرئيسية', 'ti'),
    rePrintKitchenOrder: () => toast('لإعادة الطباعة، يرجى استخدام شاشة الكمبيوتر الرئيسية', 'ti'),
    saveCat: Menu.saveCat, editCat: Menu.editCat, delCat: Menu.delCat, saveItem: Menu.saveItem, editItem: Menu.editItem, delItem: Menu.delItem,
    addPrinter: () => toast('إدارة الطابعات متاحة فقط على شاشة الكمبيوتر الرئيسية', 'ti'),
    saveSettings: Others.saveSettings,
    sendCaptain: Others.sendCaptain
};

window.App = App;
