// app.js
import { state } from './state.js';
import * as DB from './db.js';
import * as Ops from './panelOps.js';
import * as Menu from './panelMenu.js';
import * as Others from './panelOthers.js';
import * as Links from './panelLinks.js';
import * as Theme from './panelTheme.js';
import { fmt, genSid, playClickSnd, toast, unlockAudio, playOnce } from './utils.js';

export const App = {
    init: function() {
        this.bindEvents();
        this.initLogin();
    },
    
    bindEvents: function() {
        var self = this;
        
        var tabBtns = document.querySelectorAll('.tab-btn');
        if (tabBtns.length) {
            tabBtns.forEach(function(btn) {
                btn.addEventListener('click', function() {
                    playClickSnd();
                    document.querySelectorAll('.tab-btn').forEach(function(b) { b.classList.remove('active'); });
                    document.querySelectorAll('.tab-panel').forEach(function(p) { p.classList.remove('active'); });
                    btn.classList.add('active');
                    var targetPanel = document.getElementById(btn.dataset.tab);
                    if (targetPanel) targetPanel.classList.add('active');
                });
            });
        }
        
        var inVer = document.getElementById('inVer');
        if (inVer) inVer.addEventListener('input', function() { self.validateVersion(); });
        
        var inUser = document.getElementById('inUser');
        if (inUser) inUser.addEventListener('input', function() { self.validateUser(); });
        
        var inPass = document.getElementById('inPass');
        if (inPass) {
            inPass.addEventListener('input', function() { self.validatePass(); });
            inPass.addEventListener('keydown', function(e) { if (e.key === 'Enter') self.doLogin(); });
        }
        
        var qrCols = document.getElementById('qrCols');
        if (qrCols) {
            qrCols.addEventListener('input', function(e) { 
                var grid = document.getElementById('qrsGrid');
                if (grid) grid.className = 'qrs-grid c' + Math.min(parseInt(e.target.value) || 4, 4); 
            });
        }
        
        var captainModal = document.getElementById('captainModal');
        if (captainModal) {
            captainModal.addEventListener('click', function(e) { if (e.target.id === 'captainModal') e.target.classList.remove('open'); });
        }
        
        document.addEventListener('click', function() { unlockAudio(); }, { once: true });
        
        setInterval(function() { 
            var n = new Date(); 
            if (n.getHours() === 0 && n.getMinutes() === 0) { 
                localStorage.removeItem('ops_session'); 
                toast('تم تسجيل الخروج تلقائياً', 'ti'); 
                setTimeout(function() { location.reload(); }, 2000); 
            } 
        }, 30000);
    },
    
    validateVersion: function() { 
        var v = (document.getElementById('inVer')?.value.trim()) || ''; 
        var el = document.getElementById('verCheck'); 
        if (!el) return;
        if (!v) { el.className = 'check-icon'; el.innerHTML = ''; return; } 
        var ok = Object.values(state.dVersions).some(function(x) { return x.version_number === v; }); 
        el.className = 'check-icon ' + (ok ? 'valid' : 'invalid'); 
        el.innerHTML = ok ? '<i class="fas fa-circle-check"></i>' : '<i class="fas fa-circle-xmark"></i>'; 
    },
    
    validateUser: function() { 
        var v = (document.getElementById('inUser')?.value.trim()) || ''; 
        var el = document.getElementById('userCheck'); 
        if (!el) return;
        if (!v) { el.className = 'check-icon'; el.innerHTML = ''; return; } 
        var ok = Object.values(state.dUsers).some(function(x) { return x.username === v; }); 
        el.className = 'check-icon ' + (ok ? 'valid' : 'invalid'); 
        el.innerHTML = ok ? '<i class="fas fa-circle-check"></i>' : '<i class="fas fa-circle-xmark"></i>'; 
    },
    
    validatePass: function() { 
        var u = (document.getElementById('inUser')?.value.trim()) || ''; 
        var p = (document.getElementById('inPass')?.value.trim()) || ''; 
        var el = document.getElementById('passCheck'); 
        if (!el) return;
        if (!u || !p) { el.className = 'check-icon'; el.innerHTML = ''; return; } 
        var ok = Object.values(state.dUsers).some(function(x) { return x.username === u && x.password === p; }); 
        el.className = 'check-icon ' + (ok ? 'valid' : 'invalid'); 
        el.innerHTML = ok ? '<i class="fas fa-circle-check"></i>' : '<i class="fas fa-circle-xmark"></i>'; 
    },
    
    initLogin: async function() {
        await Promise.all([
            DB.getVersions().then(function(s) { state.dVersions = s.val() || {}; }), 
            DB.getUsers().then(function(s) { state.dUsers = s.val() || {}; }), 
            DB.getSettings().then(function(s) { if (s.exists()) state.settings = Object.assign({}, state.settings, s.val()); }), 
            DB.getRouting().then(function(s) { if (s.exists()) state.routing = s.val(); })
        ]);
        
        var brandName = document.getElementById('brandName');
        if (brandName) brandName.textContent = state.settings.restaurantName || 'المطعم';
        
        var sv = localStorage.getItem('ops_device_version'); 
        var verField = document.getElementById('verField');
        if (sv && verField) verField.style.display = 'none';
        
        var ss = localStorage.getItem('ops_session');
        if (ss) { 
            try { 
                var sess = JSON.parse(ss); 
                var snap = await DB.getSessions(sess.sessionId); 
                if (snap.exists()) { 
                    state.mySid = sess.sessionId; 
                    state.myUser = sess.username; 
                    state.myVersion = sess.version || sv; 
                    this.enterApp(); 
                    return; 
                } else localStorage.removeItem('ops_session'); 
            } catch (e) { localStorage.removeItem('ops_session'); } 
        }
        
        var loginOverlay = document.getElementById('loginOverlay');
        if (loginOverlay) loginOverlay.classList.remove('hidden');
    },
    
    doLogin: async function() {
        unlockAudio();
        var err = document.getElementById('loginErr'), btn = document.getElementById('btnLogin'); 
        if (err) err.textContent = ''; 
        if (btn) btn.disabled = true;
        
        var ver = localStorage.getItem('ops_device_version') || (document.getElementById('inVer')?.value.trim()) || '';
        var user = (document.getElementById('inUser')?.value.trim()) || ''; 
        var pass = (document.getElementById('inPass')?.value.trim()) || '';
        
        if (!localStorage.getItem('ops_device_version')) { 
            if (!ver) { if (err) err.textContent = 'أدخل رقم الإصدار'; if (btn) btn.disabled = false; return; } 
            if (!Object.values(state.dVersions).some(function(v) { return v.version_number === ver; })) { 
                if (err) err.textContent = 'رقم الإصدار غير مسجل'; 
                if (btn) btn.disabled = false; 
                return; 
            } 
            localStorage.setItem('ops_device_version', ver); 
        }
        if (!user) { if (err) err.textContent = 'أدخل اسم المستخدم'; if (btn) btn.disabled = false; return; }
        if (!pass) { if (err) err.textContent = 'أدخل كلمة السر'; if (btn) btn.disabled = false; return; }
        if (!Object.values(state.dUsers).some(function(u) { return u.username === user && u.password === pass; })) { 
            if (err) err.textContent = 'بيانات الدخول غير صحيحة'; 
            if (btn) btn.disabled = false; 
            return; 
        }
        
        try { 
            var allSnap = await DB.getSessions(); 
            if (allSnap.exists()) { 
                var all = allSnap.val(); 
                var ops = []; 
                for (var sid in all) { 
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
        } catch (e) { if (err) err.textContent = 'خطأ أثناء الاتصال'; if (btn) btn.disabled = false; }
    },
    
    deviceRole: 'secondary',
    
    enterApp: function() { 
        var loginOverlay = document.getElementById('loginOverlay');
        if (loginOverlay) loginOverlay.classList.add('hidden'); 
        
        var appRoot = document.getElementById('appRoot');
        if (appRoot) appRoot.style.display = 'block'; 
        
        toast('مرحباً ' + state.myUser, 'ts'); 
        
        var savedRole = localStorage.getItem('device_role');
        if (savedRole === 'main') {
            this.deviceRole = 'main';
            console.log('🖥️ هذا الجهاز هو الكمبيوتر الرئيسي - الطباعة مفعلة');
        } else {
            this.deviceRole = 'secondary';
            console.log('📱 هذا الجهاز هو جهاز ثانوي - الطباعة عبر الأوامر فقط');
        }
        
        this.startListeners(); 
        Others.loadSettingsUI(); 
        Links.initLinksModule();
        Theme.initThemeModule();
        this.loadPrinterSettings();
        Others.syncPrinterSelects();
        this.initAddOrderTab();
        
        if (this.deviceRole === 'main') {
            this.initPrintCommandListener();
        }
    },
    
    initPrintCommandListener: function() {
        var self = this;
        console.log('🖨️ تفعيل مستمع أوامر الطباعة...');
        
        DB.listenNewPrintCommands(async function(command) {
            console.log('📨 استلام أمر طباعة جديد:', command);
            
            try {
                switch(command.type) {
                    case 'kitchen':
                        await Ops.executePrintKitchen(command.data);
                        break;
                    case 'cashier':
                        await Ops.executePrintCashier(command.data);
                        break;
                    case 'direct':
                        await Ops.executePrintDirect(command.data);
                        break;
                    case 'stats':
                        await Others.executePrintStats(command.data);
                        break;
                    case 'qr':
                        await Others.executePrintQR(command.data);
                        break;
                }
                
                await DB.markPrintCommandProcessed(command.id);
                console.log('✅ تم تنفيذ أمر الطباعة:', command.id);
                
            } catch (error) {
                console.error('❌ خطأ في تنفيذ الطباعة:', error);
            }
        });
    },
    
    doLogout: async function() { 
        var confirmLogout = document.getElementById('confirmLogout');
        if (confirmLogout) confirmLogout.classList.remove('open'); 
        try { 
            await DB.removeData('active_sessions/' + state.mySid); 
            localStorage.removeItem('ops_session'); 
            location.reload(); 
        } catch (e) { toast('خطأ', 'te'); } 
    },
    
    togglePassword: function() { 
        var inp = document.getElementById('inPass'); 
        var ico = document.getElementById('togglePass')?.querySelector('i'); 
        if (!inp || !ico) return;
        if (inp.type === 'password') { inp.type = 'text'; ico.className = 'fas fa-eye-slash'; } 
        else { inp.type = 'password'; ico.className = 'fas fa-eye'; } 
    },
    
    startListeners: function() {
        var self = this;
        
        DB.listenTablesA(function(data) { state.dA = data; self.render(); });
        DB.listenTablesB(function(data) { state.dB = data; self.render(); Ops.updateSales(); });
        DB.listenTablesC(function(data) { state.dC = data; self.render(); });
        DB.listenMsgA(function(data) { state.dMsgA = data; self.render(); });
        DB.listenReadCounters(function(data) { state.dRead = data; self.render(); });
        DB.listenArchiveOrders(function(data) { state.dD = data; Ops.updateSales(); });
        DB.listenDirectOrders(function() { Ops.updateSales(); });
        
        DB.listenSessions(function(data) { 
            state.dSessions = data || {}; 
            self.renderChips(); 
            
            if (state.mySid && !state.dSessions[state.mySid]) { 
                localStorage.removeItem('ops_session'); 
                toast('تم تسجيل خروجك من جهاز آخر', 'te'); 
                setTimeout(function() { location.reload(); }, 2000); 
            } 
            
            if (state.myUser) {
                var userStillValid = Object.values(state.dUsers).some(function(u) { return u.username === state.myUser; });
                if (!userStillValid && state.mySid) {
                    DB.removeData('active_sessions/' + state.mySid);
                    localStorage.removeItem('ops_session');
                    toast('تم إلغاء صلاحياتك وتسجيل خروجك', 'te');
                    setTimeout(function() { location.reload(); }, 2000);
                }
            }
        });

        DB.listenUsers(function(data) { 
            state.dUsers = data || {}; 
            Others.syncStatsUsers(); 
            
            for (var sid in state.dSessions) {
                var sessionUser = state.dSessions[sid].username;
                var userExists = Object.values(state.dUsers).some(function(u) { return u.username === sessionUser; });
                if (!userExists) {
                    DB.removeData('active_sessions/' + sid);
                }
            }
        });

        DB.listenRouting(function(data) { if (data) state.routing = data; Others.syncPrinterSelects(); });
        DB.listenPrinters(function(data) { 
            state.dPrinters = data; 
            Others.renderPrinters(); 
            Others.syncPrinterSelects(); 
            self.updatePrinterTags();
        });
        DB.listenSettings(function(data) { 
            if (data) { 
                state.settings = Object.assign({}, state.settings, data); 
                var brandName = document.getElementById('brandName');
                if (brandName) brandName.textContent = state.settings.restaurantName || 'المطعم'; 
                Others.syncLogoDisplay(state.settings.restaurantLogo || ''); 
                if (state.settings.printerButtons) {
                    self.printerSettings = state.settings.printerButtons;
                    self.updatePrinterTags();
                }
            } 
        });
        DB.listenVersions(function(data) { state.dVersions = data; Others.loadQRVersions(); });
        DB.listenOrders(function(data) { 
            state.directMenuData = data || {}; 
            Others.renderDirectGrid(); 
            Menu.renderMenuStructure(); 
            self.renderAddOrderMainMenu(); 
            self.populateAddOrderCatFilter(); 
        });
    },
    
    render: function() { 
        Ops.renderGrid(); 
        if (state.activeTable) { 
            Ops.renderDetail(); 
            Ops.markRead(state.activeTable); 
        } 
    },
    
    renderChips: function() { 
        var c = document.getElementById('userChips'); 
        if (!c) return;
        c.innerHTML = ''; 
        if (!state.dSessions) return;
        for (var id in state.dSessions) { 
            var d = document.createElement('div'); 
            d.className = 'u-chip'; 
            d.innerHTML = '<span class="dot"></span>' + state.dSessions[id].username; 
            if (id === state.mySid) d.style.borderColor = 'var(--accent)'; 
            c.appendChild(d); 
        } 
        var logoutUser = document.getElementById('logoutUser');
        if (logoutUser) logoutUser.textContent = state.myUser || ''; 
    },
    
    printerSettings: {
        kitchen: [],
        cashier: [],
        direct: [],
        stats: [],
        qr: []
    },
    
    loadPrinterSettings: function() {
        if (state.settings.printerButtons) {
            this.printerSettings = state.settings.printerButtons;
            if (!this.printerSettings.qr) this.printerSettings.qr = [];
        } else {
            var saved = localStorage.getItem('printer_buttons_settings');
            if (saved) {
                try { this.printerSettings = JSON.parse(saved); } catch(e) {}
            }
        }
        this.updatePrinterTags();
    },
    
    savePrinterSettings: function() {
        var self = this;
        DB.updateData('app_settings', { printerButtons: this.printerSettings }).then(function() {
            self.updatePrinterTags();
            toast('تم حفظ إعدادات الطابعات في قاعدة البيانات', 'ts');
        }).catch(function() {
            localStorage.setItem('printer_buttons_settings', JSON.stringify(self.printerSettings));
            self.updatePrinterTags();
            toast('تم الحفظ محلياً', 'ti');
        });
    },
    
    updatePrinterTags: function() {
        var buttons = ['kitchen', 'cashier', 'direct', 'stats', 'qr'];
        var self = this;
        buttons.forEach(function(btn) {
            var container = document.getElementById(btn + 'Printers');
            if (!container) return;
            
            var printers = self.printerSettings[btn] || [];
            container.innerHTML = '';
            
            if (printers.length === 0) {
                container.innerHTML = '<span style="color:var(--text-muted);font-size:11px;">لم يتم تعيين طابعات</span>';
            } else {
                printers.forEach(function(printer) {
                    var tag = document.createElement('span');
                    tag.className = 'printer-tag';
                    tag.innerHTML = '<i class="fas fa-check-circle"></i><span>' + printer.name + '</span><span class="remove-printer" onclick="App.removePrinterFromButton(\'' + btn + '\', \'' + printer.id + '\')">&times;</span>';
                    container.appendChild(tag);
                });
            }
        });
    },
    
    openPrinterSelector: function(buttonName) {
        this.currentPrinterButton = buttonName;
        var titleMap = {
            kitchen: 'طابعات زر طباعة المطبخ',
            cashier: 'طابعات زر تسديد الحساب',
            direct: 'طابعات زر التسوق المباشر',
            stats: 'طابعات زر الإحصائيات',
            qr: 'طابعات زر الباركودات'
        };
        
        var titleEl = document.getElementById('printerSelectorTitle');
        if (titleEl) titleEl.textContent = titleMap[buttonName];
        
        var container = document.getElementById('printerSelectorList');
        if (!container) return;
        container.innerHTML = '';
        
        var currentPrinters = this.printerSettings[buttonName] || [];
        var currentIds = currentPrinters.map(function(p) { return p.id; });
        
        for (var id in state.dPrinters) {
            var printer = state.dPrinters[id];
            var isChecked = currentIds.includes(id);
            
            var item = document.createElement('label');
            item.className = 'printer-selector-item';
            item.innerHTML = '<input type="checkbox" value="' + id + '" ' + (isChecked ? 'checked' : '') + '><div class="printer-info"><span class="printer-name"><i class="fas fa-print"></i> ' + printer.name + '</span><span class="printer-ip">' + printer.ip + '</span></div><div class="printer-status"><i class="fas fa-check-circle"></i> متاحة</div>';
            container.appendChild(item);
        }
        
        if (Object.keys(state.dPrinters).length === 0) {
            container.innerHTML = '<p style="text-align:center;padding:20px;color:var(--text-muted);">لا توجد طابعات مضافة.</p>';
        }
        
        var modal = document.getElementById('printerSelectorModal');
        if (modal) modal.classList.add('active');
    },
    
    savePrinterSelection: function() {
        if (!this.currentPrinterButton) return;
        
        var checkboxes = document.querySelectorAll('#printerSelectorList input[type="checkbox"]');
        var selectedIds = Array.from(checkboxes).filter(function(cb) { return cb.checked; }).map(function(cb) { return cb.value; });
        
        var selectedPrinters = [];
        for (var i = 0; i < selectedIds.length; i++) {
            var id = selectedIds[i];
            if (state.dPrinters[id]) {
                selectedPrinters.push({ id: id, name: state.dPrinters[id].name, ip: state.dPrinters[id].ip });
            }
        }
        
        this.printerSettings[this.currentPrinterButton] = selectedPrinters;
        this.savePrinterSettings();
        this.closePrinterSelector();
    },
    
    closePrinterSelector: function() {
        this.currentPrinterButton = null;
        var modal = document.getElementById('printerSelectorModal');
        if (modal) modal.classList.remove('active');
    },
    
    removePrinterFromButton: function(buttonName, printerId) {
        var printers = this.printerSettings[buttonName] || [];
        var index = printers.findIndex(function(p) { return p.id === printerId; });
        if (index !== -1) {
            printers.splice(index, 1);
            this.printerSettings[buttonName] = printers;
            this.savePrinterSettings();
        }
    },
    
    getButtonPrinters: function(buttonName) {
        return this.printerSettings[buttonName] || [];
    },
    
    playPreview: function(type) {
        if (type === 'click') { playClickSnd(); } 
        else {
            var sound = null;
            if (type === 'order') sound = state.settings.orderSound;
            else if (type === 'msg') sound = state.settings.msgSound;
            else if (type === 'print') sound = state.settings.printSound;
            if (sound && sound !== 'off') { var audio = new Audio(sound); audio.play().catch(function() {}); }
        }
    },
    
    // ===== Add Order Tab Functions =====
    addOrderCart: {},
    selectedAddOrderTable: null,

    initAddOrderTab: function() {
        this.renderAddOrderTableButtons();
        this.renderAddOrderMainMenu();
        this.updateAddOrderMainBar();
        this.populateAddOrderCatFilter();
    },

    populateAddOrderCatFilter: function() {
        var filter = document.getElementById('addOrderMainCatFilter');
        if (!filter) return;
        filter.innerHTML = '<option value="">جميع الأقسام</option>';
        for (var catId in state.directMenuData) {
            filter.innerHTML += '<option value="' + catId + '">' + state.directMenuData[catId].name + '</option>';
        }
    },

    renderAddOrderTableButtons: function() {
        var container = document.getElementById('addOrderTableButtons');
        if (!container) return;
        container.innerHTML = '';
        for (var i = 1; i <= 50; i++) {
            var btn = document.createElement('button');
            btn.className = 'table-selector-btn';
            btn.textContent = 'طاولة ' + i;
            btn.onclick = function(tableNum) {
                return function() {
                    document.querySelectorAll('#addOrderTableButtons .table-selector-btn').forEach(function(b) { b.classList.remove('selected'); });
                    this.classList.add('selected');
                    App.selectedAddOrderTable = tableNum;
                    App.updateAddOrderMainBar();
                };
            }(i);
            container.appendChild(btn);
        }
    },

    renderAddOrderMainMenu: function() {
        var container = document.getElementById('addOrderMainGrid');
        if (!container) return;
        
        var searchInput = document.getElementById('addOrderMainSearch');
        var search = searchInput ? searchInput.value.trim().toLowerCase() : '';
        var catFilterSelect = document.getElementById('addOrderMainCatFilter');
        var catFilter = catFilterSelect ? catFilterSelect.value : '';
        
        container.innerHTML = '';
        
        var items = [];
        for (var catId in state.directMenuData) {
            var cat = state.directMenuData[catId];
            if (catFilter && catId !== catFilter) continue;
            if (cat.items) {
                for (var itemId in cat.items) {
                    var item = cat.items[itemId];
                    if (search && !item.name.toLowerCase().includes(search)) continue;
                    items.push({
                        id: itemId,
                        catId: catId,
                        name: item.name,
                        price: item.price,
                        details: item.details || '',
                        image: item.image || ''
                    });
                }
            }
        }
        
        if (items.length === 0) {
            container.innerHTML = '<div class="empty-state"><i class="fas fa-box-open"></i><p>لا توجد أصناف</p></div>';
            return;
        }
        
        var self = this;
        items.forEach(function(item) {
            var cartKey = item.catId + '|' + item.id;
            var qty = self.addOrderCart[cartKey] || 0;
            var imgSrc = (item.image && item.image.length > 20) ? item.image : '';
            
            var div = document.createElement('div');
            div.className = 'add-order-item' + (qty > 0 ? ' selected' : '');
            
            var imageHtml = '';
            if (imgSrc) {
                imageHtml = '<div class="aoi-img"><img src="' + imgSrc + '" alt="' + item.name + '"></div>';
            } else {
                imageHtml = '<div class="aoi-img aoi-placeholder"><i class="fas fa-utensils"></i></div>';
            }
            
            var infoHtml = '<div class="aoi-body">' +
                '<div class="aoi-name">' + item.name + '</div>' +
                '<div class="aoi-desc">' + (item.details || '') + '</div>' +
                '<div class="aoi-foot">' +
                '<div class="aoi-price">' + fmt(item.price) + ' <small>د.ع</small></div>' +
                '<div class="aoi-actions">' +
                '<button class="aoi-btn aoi-minus" onclick="App.changeAddOrderMainQty(\'' + cartKey + '\', -1, event)">−</button>' +
                '<span class="aoi-qty">' + qty + '</span>' +
                '<button class="aoi-btn aoi-plus" onclick="App.changeAddOrderMainQty(\'' + cartKey + '\', 1, event)">+</button>' +
                '</div></div></div>';
            
            div.innerHTML = imageHtml + infoHtml;
            
            div.addEventListener('click', function(e) {
                if (e.target.closest('.aoi-actions')) return;
                App.toggleAddOrderItem(cartKey);
            });
            
            container.appendChild(div);
        });
    },

    toggleAddOrderItem: function(key) {
        if (this.addOrderCart[key]) {
            delete this.addOrderCart[key];
        } else {
            this.addOrderCart[key] = 1;
        }
        this.renderAddOrderMainMenu();
        this.updateAddOrderMainBar();
    },

    changeAddOrderMainQty: function(key, delta, e) {
        if (e) e.stopPropagation();
        var currentQty = this.addOrderCart[key] || 0;
        var newQty = currentQty + delta;
        if (newQty <= 0) {
            delete this.addOrderCart[key];
        } else {
            this.addOrderCart[key] = newQty;
        }
        this.renderAddOrderMainMenu();
        this.updateAddOrderMainBar();
    },

    updateAddOrderMainBar: function() {
        var count = 0, total = 0;
        if (this.addOrderCart) {
            for (var key in this.addOrderCart) {
                var qty = this.addOrderCart[key];
                count += qty;
                var parts = key.split('|');
                var catId = parts[0];
                var itemId = parts.slice(1).join('|');
                var cat = state.directMenuData[catId];
                if (cat && cat.items && cat.items[itemId]) {
                    total += cat.items[itemId].price * qty;
                }
            }
        }
        
        var bar = document.getElementById('addOrderMainBar');
        var countEl = document.getElementById('addOrderMainCount');
        var totalEl = document.getElementById('addOrderMainTotal');
        var submitBtn = document.getElementById('submitMainOrderBtn');
        
        if (count > 0) {
            if (bar) bar.style.display = 'flex';
        } else {
            if (bar) bar.style.display = 'none';
        }
        
        if (countEl) countEl.textContent = count + ' صنف';
        if (totalEl) totalEl.textContent = fmt(total) + ' دينار';
        
        if (submitBtn) {
            submitBtn.disabled = (count === 0 || !this.selectedAddOrderTable);
        }
    },

    clearAddOrderMain: function() {
        this.addOrderCart = {};
        this.renderAddOrderMainMenu();
        this.updateAddOrderMainBar();
        toast('تم إفراغ السلة', 'ti');
    },

    filterAddOrderMain: function() {
        this.renderAddOrderMainMenu();
    },

    submitMainOrder: async function() {
        if (!this.selectedAddOrderTable) {
            toast('الرجاء اختيار رقم الطاولة', 'te');
            return;
        }
        var cartKeys = Object.keys(this.addOrderCart);
        if (cartKeys.length === 0) {
            toast('لا توجد طلبات', 'te');
            return;
        }
        
        var tableKey = 'table_' + this.selectedAddOrderTable;
        var promises = [];
        
        for (var i = 0; i < cartKeys.length; i++) {
            var key = cartKeys[i];
            var qty = this.addOrderCart[key];
            var parts = key.split('|');
            var catId = parts[0];
            var itemId = parts.slice(1).join('|');
            var cat = state.directMenuData[catId];
            if (cat && cat.items && cat.items[itemId]) {
                var item = cat.items[itemId];
                var orderId = Date.now() + '_' + Math.random().toString(36).substr(2, 4);
                promises.push(DB.setData('tablesB/' + tableKey + '/sent_orders/' + orderId, {
                    name: item.name,
                    price: item.price,
                    quantity: qty,
                    timestamp: new Date().toISOString()
                }));
            }
        }
        
        await Promise.all(promises);
        
        toast('تم إرسال الطلبات إلى طاولة ' + this.selectedAddOrderTable, 'ts');
        playOnce('order');
        
        this.addOrderCart = {};
        this.selectedAddOrderTable = null;
        
        document.querySelectorAll('#addOrderTableButtons .table-selector-btn').forEach(function(b) { b.classList.remove('selected'); });
        
        this.renderAddOrderMainMenu();
        this.updateAddOrderMainBar();
        
        Ops.renderGrid();
    },
    
    // ===== Module Functions Binding =====
    openDetail: Ops.openDetail,
    closeDetail: Ops.closeDetail,
    sendAdminReply: Ops.sendAdminReply,
    printToKitchen: Ops.printToKitchen,
    settleInvoice: Ops.settleInvoice,
    rePrintKitchenOrder: Ops.rePrintKitchenOrder,
    changeSentOrderQty: Ops.changeSentOrderQty,
    deleteSentOrder: Ops.deleteSentOrder,
    changeProcessingOrderQty: Ops.changeProcessingOrderQty,
    deleteProcessingOrder: Ops.deleteProcessingOrder,
    
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
    printSingleQR: Others.printSingleQR,
    updateCaptainQR: Others.updateCaptainQR,
    generateCaptainQR: Others.generateCaptainQR,
    
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
    
    loadWindowsPrinters: Others.loadWindowsPrinters
};

window.App = App;