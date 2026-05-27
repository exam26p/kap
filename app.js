// app.js
import { state } from './state.js';
import * as DB from './db.js';
import { fmt, genSid, playClickSnd, toast, unlockAudio } from './utils.js';
import * as Ops from './panelOps.js';
import * as Menu from './panelMenu.js';
import * as Others from './panelOthers.js';
import * as Links from './panelLinks.js';
import * as Theme from './panelTheme.js';

export const App = {
    init() {
        state.db = DB;
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
                document.getElementById(btn.dataset.tab).classList.add('active');
            });
        });
        document.getElementById('inVer').addEventListener('input', () => self.validateVersion());
        document.getElementById('inUser').addEventListener('input', () => self.validateUser());
        document.getElementById('inPass').addEventListener('input', () => self.validatePass());
        document.getElementById('inPass').addEventListener('keydown', e => { if (e.key === 'Enter') self.doLogin(); });
        document.getElementById('qrCols').addEventListener('input', e => { document.getElementById('qrsGrid').className = 'qrs-grid c' + Math.min(parseInt(e.target.value) || 4, 4); });
        document.getElementById('captainModal').addEventListener('click', e => { if (e.target.id === 'captainModal') e.target.classList.remove('open'); });
        
        document.addEventListener('click', () => unlockAudio(), { once: true });
        
        setInterval(() => { const n = new Date(); if (n.getHours() === 0 && n.getMinutes() === 0) { localStorage.removeItem('ops_session'); toast('تم تسجيل الخروج تلقائياً', 'ti'); setTimeout(() => location.reload(), 2000); } }, 30000);
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
        await Promise.all([DB.getVersions().then(s => { state.dVersions = s.val() || {}; }), DB.getUsers().then(s => { state.dUsers = s.val() || {}; }), DB.getSettings().then(s => { if (s.exists()) state.settings = { ...state.settings, ...s.val() }; }), DB.getRouting().then(s => { if (s.exists()) state.routing = s.val(); })]);
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
        err.textContent = ''; 
        btn.disabled = true;
        const sv = localStorage.getItem('ops_device_version'); 
        let ver = sv || document.getElementById('inVer').value.trim();
        const user = document.getElementById('inUser').value.trim(), pass = document.getElementById('inPass').value.trim();
        if (!sv) { 
            if (!ver) { err.textContent = 'أدخل رقم الإصدار'; btn.disabled = false; return; } 
            if (!Object.values(state.dVersions).some(v => v.version_number === ver)) { err.textContent = 'رقم الإصدار غير مسجل'; btn.disabled = false; return; } 
            localStorage.setItem('ops_device_version', ver); 
        }
        if (!user) { err.textContent = 'أدخل اسم المستخدم'; btn.disabled = false; return; } 
        if (!pass) { err.textContent = 'أدخل كلمة السر'; btn.disabled = false; return; } 
        if (!Object.values(state.dUsers).some(u => u.username === user && u.password === pass)) { err.textContent = 'بيانات الدخول غير صحيحة'; btn.disabled = false; return; }
        try { 
            const allSnap = await DB.getSessions(); 
            if (allSnap.exists()) { 
                const all = allSnap.val(); 
                const ops = []; 
                for (let sid in all) { 
                    if (all[sid].username === user) ops.push(DB.removeData('active_sessions/' + sid)); 
                } 
                if (ops.length > 0) await Promise.all(ops); 
            } 
        } catch (e) { }
        state.mySid = genSid(); 
        state.myUser = user; 
        state.myVersion = ver;
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
        Others.loadSettingsUI(); 
        Links.initLinksModule();
        Theme.initThemeModule();
        this.loadPrinterSettings();
        Others.syncPrinterSelects();
    },
    
    async doLogout() { 
        document.getElementById('confirmLogout').classList.remove('open'); 
        try { 
            await DB.removeData('active_sessions/' + state.mySid); 
            localStorage.removeItem('ops_session'); 
            location.reload(); 
        } catch (e) { toast('خطأ', 'te'); } 
    },
    
    togglePassword() { 
        const inp = document.getElementById('inPass'), ico = document.getElementById('togglePass').querySelector('i'); 
        if (inp.type === 'password') { 
            inp.type = 'text'; 
            ico.className = 'fas fa-eye-slash'; 
        } else { 
            inp.type = 'password'; 
            ico.className = 'fas fa-eye'; 
        } 
    },

    startListeners() {
        DB.listenTablesA(data => { state.dA = data; this.render(); });
        DB.listenTablesB(data => { state.dB = data; this.render(); });
        DB.listenTablesC(data => { state.dC = data; this.render(); });
        DB.listenMsgA(data => { state.dMsgA = data; this.render(); });
        DB.listenReadCounters(data => { state.dRead = data; this.render(); });
        DB.listenArchiveOrders(data => { state.dD = data; Ops.updateSales(); });
        DB.listenDirectOrders(() => Ops.updateSales());
        DB.listenSessions(data => { state.dSessions = data; this.renderChips(); if (state.mySid && !state.dSessions[state.mySid]) { localStorage.removeItem('ops_session'); toast('تم تسجيل خروجك من جهاز آخر', 'te'); setTimeout(() => location.reload(), 2000); } });
        DB.listenRouting(data => { if (data) state.routing = data; Others.syncPrinterSelects(); });
        DB.listenPrinters(data => { 
            state.dPrinters = data; 
            Others.renderPrinters(); 
            Others.syncPrinterSelects(); 
            this.updatePrinterTags();
        });
        DB.listenSettings(data => { if (data) state.settings = { ...state.settings, ...data }; document.getElementById('brandName').textContent = state.settings.restaurantName || 'المطعم'; Others.syncLogoDisplay(state.settings.restaurantLogo || ''); });
        DB.listenUsers(data => { state.dUsers = data; Others.syncStatsUsers(); });
        DB.listenVersions(data => { state.dVersions = data; Others.loadQRVersions(); });
        DB.listenOrders(data => { state.directMenuData = data || {}; Others.renderDirectGrid(); Menu.renderMenuStructure(); });
        Others.initCaptainChat();
    },
    
    render() { 
        Ops.renderGrid(); 
        if (state.activeTable) { 
            Ops.renderDetail(); 
            Ops.markRead(state.activeTable); 
        } 
    },
    
    renderChips() { 
        const c = document.getElementById('userChips'); 
        c.innerHTML = ''; 
        for (let id in state.dSessions) { 
            const d = document.createElement('div'); 
            d.className = 'u-chip'; 
            d.innerHTML = '<span class="dot"></span>' + state.dSessions[id].username; 
            if (id === state.mySid) d.style.borderColor = 'var(--accent)'; 
            c.appendChild(d); 
        } 
        document.getElementById('logoutUser').textContent = state.myUser || ''; 
    },

    // ===== إدارة الطابعات للأزرار =====
    printerSettings: {
        kitchen: [],
        cashier: [],
        direct: [],
        stats: []
    },
    
    currentPrinterButton: null,
    
    loadPrinterSettings() {
        const saved = localStorage.getItem('printer_buttons_settings');
        if (saved) {
            try {
                this.printerSettings = JSON.parse(saved);
            } catch(e) {}
        }
        this.updatePrinterTags();
    },
    
    savePrinterSettings() {
        localStorage.setItem('printer_buttons_settings', JSON.stringify(this.printerSettings));
        this.updatePrinterTags();
    },
    
    updatePrinterTags() {
        const buttons = ['kitchen', 'cashier', 'direct', 'stats'];
        buttons.forEach(btn => {
            const container = document.getElementById(`${btn}Printers`);
            if (!container) return;
            
            const printers = this.printerSettings[btn] || [];
            container.innerHTML = '';
            
            if (printers.length === 0) {
                container.innerHTML = '<span style="color:var(--text-muted);font-size:11px;">لم يتم تعيين طابعات</span>';
            } else {
                printers.forEach(printer => {
                    const tag = document.createElement('span');
                    tag.className = 'printer-tag';
                    tag.innerHTML = `
                        <i class="fas fa-check-circle"></i>
                        <span>${printer.name}</span>
                        <span class="remove-printer" onclick="App.removePrinterFromButton('${btn}', '${printer.id}')">&times;</span>
                    `;
                    container.appendChild(tag);
                });
            }
        });
    },
    
    openPrinterSelector(buttonName) {
        this.currentPrinterButton = buttonName;
        const titleMap = {
            kitchen: 'طابعات زر طباعة المطبخ',
            cashier: 'طابعات زر تسديد الحساب',
            direct: 'طابعات زر التسوق المباشر',
            stats: 'طابعات زر الإحصائيات'
        };
        
        document.getElementById('printerSelectorTitle').textContent = titleMap[buttonName];
        
        const container = document.getElementById('printerSelectorList');
        container.innerHTML = '';
        
        const currentPrinters = this.printerSettings[buttonName] || [];
        const currentIds = currentPrinters.map(p => p.id);
        
        for (let id in state.dPrinters) {
            const printer = state.dPrinters[id];
            const isChecked = currentIds.includes(id);
            
            const item = document.createElement('label');
            item.className = 'printer-selector-item';
            item.innerHTML = `
                <input type="checkbox" value="${id}" ${isChecked ? 'checked' : ''}>
                <div class="printer-info">
                    <span class="printer-name"><i class="fas fa-print"></i> ${printer.name}</span>
                    <span class="printer-ip">${printer.ip}</span>
                </div>
                <div class="printer-status">
                    <i class="fas fa-check-circle"></i> متاحة
                </div>
            `;
            container.appendChild(item);
        }
        
        if (Object.keys(state.dPrinters).length === 0) {
            container.innerHTML = '<p style="text-align:center;padding:20px;color:var(--text-muted);">لا توجد طابعات مضافة. قم بإضافة طابعات أولاً.</p>';
        }
        
        document.getElementById('printerSelectorModal').classList.add('active');
    },
    
    savePrinterSelection() {
        if (!this.currentPrinterButton) return;
        
        const checkboxes = document.querySelectorAll('#printerSelectorList input[type="checkbox"]');
        const selectedIds = Array.from(checkboxes)
            .filter(cb => cb.checked)
            .map(cb => cb.value);
        
        const selectedPrinters = [];
        for (let id of selectedIds) {
            if (state.dPrinters[id]) {
                selectedPrinters.push({
                    id: id,
                    name: state.dPrinters[id].name,
                    ip: state.dPrinters[id].ip
                });
            }
        }
        
        this.printerSettings[this.currentPrinterButton] = selectedPrinters;
        this.savePrinterSettings();
        this.closePrinterSelector();
        toast('تم حفظ إعدادات الطابعات', 'ts');
    },
    
    closePrinterSelector() {
        this.currentPrinterButton = null;
        document.getElementById('printerSelectorModal').classList.remove('active');
    },
    
    removePrinterFromButton(buttonName, printerId) {
        const printers = this.printerSettings[buttonName] || [];
        const index = printers.findIndex(p => p.id === printerId);
        if (index !== -1) {
            printers.splice(index, 1);
            this.printerSettings[buttonName] = printers;
            this.savePrinterSettings();
            toast('تم إزالة الطابعة', 'ts');
        }
    },
    
    getButtonPrinters(buttonName) {
        return this.printerSettings[buttonName] || [];
    },

    // ===== دوال الصوت =====
    playPreview(type) {
        if (type === 'click') {
            playClickSnd();
        } else {
            let sound = null;
            if (type === 'order') sound = state.settings.orderSound;
            else if (type === 'msg') sound = state.settings.msgSound;
            else if (type === 'print') sound = state.settings.printSound;
            
            if (sound && sound !== 'off') {
                const audio = new Audio(sound);
                audio.play().catch(() => {});
            }
        }
    },

    // ===== ربط الدوال =====
    openDetail: Ops.openDetail,
    closeDetail: Ops.closeDetail,
    sendAdminReply: Ops.sendAdminReply,
    printToKitchen: Ops.printToKitchen,
    settleInvoice: Ops.settleInvoice,
    
    saveCat: Menu.saveCat,
    editCat: Menu.editCat,
    delCat: Menu.delCat,
    saveItem: Menu.saveItem,
    editItem: Menu.editItem,
    delItem: Menu.delItem,
    
    generateQRCodes: Others.generateQRCodes,
    updateQRPreview: Others.updateQRPreview,
    refreshQRCards: Others.refreshQRCards,
    printQR: Others.printQR,
    
    filterDirect: Others.filterDirect,
    directToggle: Others.directToggle,
    directQtyChange: Others.directQtyChange,
    clearDirectCart: Others.clearDirectCart,
    payDirectOrder: Others.payDirectOrder,
    
    addPrinter: Others.addPrinter,
    pingP: Others.pingP,
    delP: Others.delP,
    previewLogo: Others.previewLogo,
    removeLogo: Others.removeLogo,
    saveSettings: Others.saveSettings,
    
    searchStats: Others.searchStats,
    clearStats: Others.clearStats,
    printStatsReport: Others.printStatsReport,
    
    sendCaptain: Others.sendCaptain
};

window.App = App;
