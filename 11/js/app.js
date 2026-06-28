// ============================================
// التطبيق الرئيسي - إدارة التنقل والصفحات
// ============================================

// ===== تهيئة Firebase =====
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// ===== متغيرات عامة =====
let currentPage = 'home';
let currentUser = null;
let currentUserData = null;
let pendingAction = null;
let selectedRestaurant = null;
let locationData = { lat: null, lng: null, acc: null };

// ===== شاشة التحميل =====
window.addEventListener('DOMContentLoaded', function() {
    // إخفاء شاشة التحميل بعد 2.5 ثانية
    setTimeout(function() {
        document.getElementById('splash-screen').classList.add('hide');
        document.getElementById('app').style.display = 'flex';
        // تحميل الصفحة الرئيسية
        loadHomePage();
        // التحقق من الجلسة
        checkSession();
    }, 2500);
});

// ===== التنقل بين الصفحات =====
function navigateTo(page, data = null) {
    // إخفاء جميع الصفحات
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    
    // عرض الصفحة المطلوبة
    const target = document.getElementById('page-' + page);
    if (target) {
        target.classList.add('active');
        currentPage = page;
        
        // تحديث التنقل السفلي
        document.querySelectorAll('.bottom-nav-btn').forEach(btn => btn.classList.remove('active'));
        const navMap = {
            'home': 0,
            'location': 1,
            'map': 2,
            'help': 3
        };
        if (navMap[page] !== undefined) {
            const btns = document.querySelectorAll('.bottom-nav-btn');
            if (btns[navMap[page]]) btns[navMap[page]].classList.add('active');
        }
    }
    
    // تحديث أزرار التنقل العلوية
    updateNavButtons();
    
    // تحميل بيانات الصفحة إذا لزم الأمر
    if (page === 'home') loadHomePage();
    if (page === 'profile') loadProfile();
    if (page === 'menu' && data) loadMenu(data);
}

// ===== تحديث أزرار التنقل =====
function updateNavButtons() {
    const isLoggedIn = !!currentUser;
    document.getElementById('nav-register').style.display = isLoggedIn ? 'none' : 'flex';
    document.getElementById('nav-login').style.display = isLoggedIn ? 'none' : 'flex';
    document.getElementById('nav-profile').style.display = isLoggedIn ? 'flex' : 'none';
    document.getElementById('nav-logout').style.display = isLoggedIn ? 'flex' : 'none';
}

// ===== التحقق من الجلسة =====
function checkSession() {
    const session = localStorage.getItem('smart_menu_session');
    if (session) {
        try {
            const data = JSON.parse(session);
            const now = Date.now();
            if (data.expires && data.expires > now) {
                currentUser = data.user;
                currentUserData = data.userData;
                updateNavButtons();
                // التحقق من صحة التوكن مع قاعدة البيانات
                validateSession(data.userId);
                return;
            }
        } catch(e) {
            console.warn('جلسة غير صالحة');
        }
    }
    // لا توجد جلسة صالحة
    localStorage.removeItem('smart_menu_session');
}

// ===== التحقق من صحة الجلسة =====
function validateSession(userId) {
    db.collection('users').doc(userId).get().then(doc => {
        if (doc.exists) {
            const data = doc.data();
            // التحقق من أن الجلسة نشطة
            if (data.activeSession === userId) {
                currentUserData = data;
                updateNavButtons();
            } else {
                // جلسة نشطة على جهاز آخر
                logout('تم تسجيل الخروج من جهاز آخر');
            }
        } else {
            logout();
        }
    }).catch(() => {
        // في حالة خطأ في التحقق، نسمح بالدخول مع تحديث الجلسة لاحقاً
    });
}

// ===== تسجيل الدخول =====
function handleLogin(event) {
    event.preventDefault();
    const phone = document.getElementById('login-phone').value.trim();
    const password = document.getElementById('login-password').value;
    
    if (!phone || !password) {
        showToast('يرجى ملء جميع الحقول');
        return;
    }
    
    // البحث عن المستخدم
    db.collection('users')
        .where('phone', '==', phone)
        .where('password', '==', password)
        .get()
        .then(query => {
            if (query.empty) {
                showToast('رقم الهاتف أو كلمة المرور غير صحيحة');
                return;
            }
            
            const doc = query.docs[0];
            const userData = doc.data();
            const userId = doc.id;
            
            // التحقق من عدم وجود جلسة نشطة
            if (userData.activeSession && userData.activeSession !== userId) {
                showModal('تنبيه', 'هذا الحساب مسجل الدخول على جهاز آخر. هل تريد تسجيل الخروج من الجهاز الآخر؟', function() {
                    // إلغاء الجلسة السابقة
                    db.collection('users').doc(userId).update({
                        activeSession: null
                    }).then(() => {
                        completeLogin(userId, userData);
                    });
                });
                return;
            }
            
            completeLogin(userId, userData);
        })
        .catch(err => {
            console.error(err);
            showToast('حدث خطأ، يرجى المحاولة مرة أخرى');
        });
}

// ===== إكمال عملية تسجيل الدخول =====
function completeLogin(userId, userData) {
    // تحديث الجلسة النشطة
    db.collection('users').doc(userId).update({
        activeSession: userId,
        lastLogin: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
        currentUser = { id: userId, ...userData };
        currentUserData = userData;
        
        // حفظ الجلسة محلياً
        const session = {
            userId: userId,
            user: { id: userId, ...userData },
            userData: userData,
            expires: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 أيام
        };
        localStorage.setItem('smart_menu_session', JSON.stringify(session));
        
        updateNavButtons();
        navigateTo('home');
        showToast('مرحباً بك ' + (userData.name || ''));
    });
}

// ===== تسجيل الخروج =====
function logout(message) {
    if (currentUser && currentUser.id) {
        db.collection('users').doc(currentUser.id).update({
            activeSession: null
        }).catch(() => {});
    }
    
    currentUser = null;
    currentUserData = null;
    localStorage.removeItem('smart_menu_session');
    updateNavButtons();
    navigateTo('home');
    if (message) showToast(message);
}

// ===== عرض نافذة تأكيد =====
function showModal(title, message, onConfirm) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-message').textContent = message;
    document.getElementById('custom-modal').style.display = 'flex';
    pendingAction = onConfirm || null;
}

function closeModal() {
    document.getElementById('custom-modal').style.display = 'none';
    pendingAction = null;
}

function confirmAction() {
    if (pendingAction) {
        const action = pendingAction;
        closeModal();
        action();
    } else {
        closeModal();
    }
}

// ===== Toast notifications =====
function showToast(message, type = 'info') {
    const existing = document.querySelector('.toast-notification');
    if (existing) existing.remove();
    
    const toast = document.createElement('div');
    toast.className = 'toast-notification ' + type;
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 80px;
        left: 50%;
        transform: translateX(-50%);
        background: ${type === 'error' ? '#ff4757' : '#00e5a0'};
        color: #0a0e1a;
        padding: 12px 24px;
        border-radius: 12px;
        font-weight: 600;
        font-family: 'Cairo', sans-serif;
        z-index: 99999;
        box-shadow: 0 4px 30px rgba(0,0,0,0.3);
        max-width: 90%;
        text-align: center;
        animation: toastIn 0.3s ease;
    `;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-50%) translateY(20px)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// إضافة أنماط التوست
const toastStyle = document.createElement('style');
toastStyle.textContent = `
    @keyframes toastIn {
        from { opacity: 0; transform: translateX(-50%) translateY(20px); }
        to { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
`;
document.head.appendChild(toastStyle);