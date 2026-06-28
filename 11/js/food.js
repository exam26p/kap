// ============================================
// نموذج تسجيل المطاعم والكافتريات
// ============================================

let locationWatchId = null;
let bestLocation = null;
let isLocationFixed = false;
let locationAttempts = 0;
let locationInterval = null;

// ===== بدء تحديد الموقع الحي =====
function startLiveLocation() {
    const statusEl = document.getElementById('food-location-status');
    const locationInput = document.getElementById('food-location');
    const locationBtn = document.querySelector('.btn-location');
    const locationIcon = locationBtn.querySelector('i');
    
    // إظهار حالة التحديث
    statusEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري البحث عن الموقع...';
    statusEl.className = 'searching';
    locationBtn.disabled = true;
    locationIcon.className = 'fas fa-spinner fa-spin';
    
    // تنظيف أي متابعة سابقة
    if (locationWatchId) {
        navigator.geolocation.clearWatch(locationWatchId);
        locationWatchId = null;
    }
    
    bestLocation = null;
    isLocationFixed = false;
    locationAttempts = 0;
    
    if (!navigator.geolocation) {
        statusEl.innerHTML = '❌ جهازك لا يدعم تحديد الموقع';
        statusEl.className = 'error';
        locationBtn.disabled = false;
        locationIcon.className = 'fas fa-crosshairs';
        return;
    }
    
    // بدء المتابعة المستمرة
    locationWatchId = navigator.geolocation.watchPosition(
        function(pos) {
            handleLocationUpdate(pos);
        },
        function(err) {
            handleLocationError(err);
        },
        {
            enableHighAccuracy: true,
            timeout: 30000,
            maximumAge: 0
        }
    );
    
    // تعيين مهلة 60 ثانية كحد أقصى
    setTimeout(function() {
        if (!isLocationFixed && locationWatchId) {
            navigator.geolocation.clearWatch(locationWatchId);
            locationWatchId = null;
            statusEl.innerHTML = '⏱️ انتهى الوقت. حاول مرة أخرى';
            statusEl.className = 'error';
            locationBtn.disabled = false;
            locationIcon.className = 'fas fa-crosshairs';
        }
    }, 60000);
}

// ===== معالجة تحديث الموقع =====
function handleLocationUpdate(pos) {
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    const accuracy = pos.coords.accuracy;
    
    const statusEl = document.getElementById('food-location-status');
    const locationInput = document.getElementById('food-location');
    const locationBtn = document.querySelector('.btn-location');
    const locationIcon = locationBtn.querySelector('i');
    
    locationAttempts++;
    
    // تحديث أفضل موقع
    if (!bestLocation || accuracy < bestLocation.accuracy) {
        bestLocation = {
            lat: lat,
            lng: lng,
            accuracy: accuracy,
            timestamp: pos.timestamp
        };
        
        // تحديث الحقل
        locationInput.value = lat.toFixed(6) + ', ' + lng.toFixed(6);
    }
    
    // عرض حالة الدقة
    let statusHtml = '';
    let statusClass = '';
    
    if (accuracy <= 5) {
        // ✅ دقة ممتازة - أقل من 5 متر
        isLocationFixed = true;
        statusHtml = '✅ <strong>تم تثبيت الموقع بدقة عالية</strong> (' + accuracy.toFixed(1) + ' متر)';
        statusClass = 'success';
        
        // إظهار علامة الصح
        locationIcon.className = 'fas fa-check-circle';
        locationBtn.style.background = '#00e5a0';
        locationBtn.style.color = '#0a0e1a';
        
        // إيقاف المتابعة بعد تثبيت الموقع
        if (locationWatchId) {
            navigator.geolocation.clearWatch(locationWatchId);
            locationWatchId = null;
        }
        
        // تمكين زر التسجيل
        document.querySelector('#food-form button[type="submit"]').disabled = false;
        
        // إظهار رسالة نجاح مع تأثير
        showLocationSuccess();
        
    } else if (accuracy <= 15) {
        // 🟡 دقة مقبولة
        statusHtml = '🟡 جاري تحسين الدقة... (' + accuracy.toFixed(1) + ' متر) - الهدف < 5 متر';
        statusClass = 'improving';
        document.querySelector('#food-form button[type="submit"]').disabled = true;
        
    } else {
        // 🔴 دقة منخفضة
        statusHtml = '🔴 الدقة منخفضة (' + accuracy.toFixed(1) + ' متر) - يرجى الانتظار...';
        statusClass = 'poor';
        document.querySelector('#food-form button[type="submit"]').disabled = true;
    }
    
    // تحديث واجهة الحالة
    statusEl.innerHTML = statusHtml;
    statusEl.className = statusClass;
    
    // تحديث شريط التقدم
    updateProgressBar(accuracy);
}

// ===== معالجة أخطاء الموقع =====
function handleLocationError(err) {
    const statusEl = document.getElementById('food-location-status');
    const locationBtn = document.querySelector('.btn-location');
    const locationIcon = locationBtn.querySelector('i');
    
    let errorMsg = '';
    switch(err.code) {
        case err.PERMISSION_DENIED:
            errorMsg = '❌ تم رفض صلاحية الموقع. يرجى السماح من إعدادات المتصفح';
            break;
        case err.POSITION_UNAVAILABLE:
            errorMsg = '❌ لا يمكن تحديد الموقع. تأكد من تشغيل GPS';
            break;
        case err.TIMEOUT:
            errorMsg = '⏱️ انتهت مهلة تحديد الموقع. حاول مرة أخرى';
            break;
        default:
            errorMsg = '❌ حدث خطأ: ' + err.message;
    }
    
    statusEl.innerHTML = errorMsg;
    statusEl.className = 'error';
    locationBtn.disabled = false;
    locationIcon.className = 'fas fa-crosshairs';
    
    document.querySelector('#food-form button[type="submit"]').disabled = true;
}

// ===== تحديث شريط تقدم الدقة =====
function updateProgressBar(accuracy) {
    let progressBar = document.getElementById('location-progress');
    if (!progressBar) {
        // إنشاء شريط التقدم إذا لم يكن موجوداً
        const container = document.querySelector('.location-group');
        progressBar = document.createElement('div');
        progressBar.id = 'location-progress';
        progressBar.className = 'location-progress';
        progressBar.innerHTML = `
            <div class="progress-track">
                <div class="progress-fill" style="width:0%"></div>
            </div>
            <div class="progress-label">جاري تحسين الدقة...</div>
        `;
        container.appendChild(progressBar);
    }
    
    const fill = progressBar.querySelector('.progress-fill');
    const label = progressBar.querySelector('.progress-label');
    
    // حساب النسبة: 5 متر = 100%، 50 متر = 0%
    let percent = Math.max(0, Math.min(100, ((50 - accuracy) / 45) * 100));
    fill.style.width = percent + '%';
    
    if (accuracy <= 5) {
        label.textContent = '✅ تم تثبيت الموقع بدقة ممتازة!';
        fill.style.background = 'linear-gradient(90deg, #00e5a0, #00b87a)';
    } else if (accuracy <= 15) {
        label.textContent = '🟡 جاري تحسين الدقة... (' + accuracy.toFixed(1) + 'م)';
        fill.style.background = 'linear-gradient(90deg, #ffd93d, #f6b93b)';
    } else {
        label.textContent = '🔴 يرجى الانتظار لتحسين الدقة... (' + accuracy.toFixed(1) + 'م)';
        fill.style.background = 'linear-gradient(90deg, #ff6b6b, #ee5a24)';
    }
}

// ===== إظهار رسالة نجاح الموقع =====
function showLocationSuccess() {
    const statusEl = document.getElementById('food-location-status');
    
    // تأثير فلاش أخضر
    statusEl.style.transition = 'all 0.3s';
    statusEl.style.transform = 'scale(1.1)';
    setTimeout(() => {
        statusEl.style.transform = 'scale(1)';
    }, 300);
    
    // إظهار علامة الصح بشكل مميز
    const locationInput = document.getElementById('food-location');
    locationInput.style.borderColor = '#00e5a0';
    locationInput.style.boxShadow = '0 0 20px rgba(0,229,160,0.3)';
}

// ===== إيقاف تحديد الموقع =====
function stopLocationTracking() {
    if (locationWatchId) {
        navigator.geolocation.clearWatch(locationWatchId);
        locationWatchId = null;
    }
    if (locationInterval) {
        clearInterval(locationInterval);
        locationInterval = null;
    }
}

// ===== النقر على زر الموقع =====
function getLocation(type) {
    if (type === 'food') {
        // إذا كان الموقع مثبت بالفعل، اسأل إذا يريد تحديثه
        if (isLocationFixed && bestLocation) {
            showModal('تحديث الموقع', 'الموقع مثبت بالفعل بدقة ' + bestLocation.accuracy.toFixed(1) + ' متر. هل تريد تحديثه؟', function() {
                startLiveLocation();
            });
            return;
        }
        startLiveLocation();
    } else {
        // للسائق - استخدام الوظيفة الحالية
        startDriverLocation();
    }
}

// ===== وظيفة الموقع للسائق =====
function startDriverLocation() {
    // نفس الآلية ولكن للسائق
    const statusEl = document.getElementById('driver-location-status');
    const locationInput = document.getElementById('driver-location');
    const locationBtn = document.querySelector('.driver-location .btn-location');
    
    statusEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري تحديد الموقع...';
    statusEl.className = 'searching';
    
    if (!navigator.geolocation) {
        statusEl.innerHTML = '❌ جهازك لا يدعم تحديد الموقع';
        return;
    }
    
    navigator.geolocation.getCurrentPosition(
        function(pos) {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            const acc = pos.coords.accuracy;
            
            locationInput.value = lat.toFixed(6) + ', ' + lng.toFixed(6);
            
            if (acc <= 5) {
                statusEl.innerHTML = '✅ تم تحديد الموقع بدقة عالية (' + acc.toFixed(1) + ' متر)';
                statusEl.className = 'success';
            } else {
                statusEl.innerHTML = '⚠️ تم تحديد الموقع بدقة ' + acc.toFixed(1) + ' متر (يُفضل أقل من 5 متر)';
                statusEl.className = 'improving';
            }
        },
        function(err) {
            statusEl.innerHTML = '❌ فشل تحديد الموقع';
            statusEl.className = 'error';
        },
        { enableHighAccuracy: true, timeout: 10000 }
    );
}

// ===== تسجيل المطعم =====
function registerFood(event) {
    event.preventDefault();
    
    // التحقق من تثبيت الموقع
    if (!isLocationFixed || !bestLocation || bestLocation.accuracy > 5) {
        showToast('⚠️ يرجى الانتظار حتى يتم تحديد الموقع بدقة أقل من 5 متر');
        return;
    }
    
    const name = document.getElementById('food-name').value.trim();
    const phone1 = document.getElementById('food-phone1').value.trim();
    const phone2 = document.getElementById('food-phone2').value.trim();
    const location = document.getElementById('food-location').value.trim();
    const password = document.getElementById('food-password').value;
    const confirm = document.getElementById('food-password-confirm').value;
    
    // التحقق من الحقول المطلوبة
    if (!name || !phone1 || !location || !password || !confirm) {
        showToast('يرجى ملء جميع الحقول المطلوبة');
        return;
    }
    
    // التحقق من رقم الهاتف
    if (!validatePhone(phone1)) {
        showToast('رقم الهاتف الأول يجب أن يكون 11 رقماً ويبدأ بـ 07');
        return;
    }
    if (phone2 && !validatePhone(phone2)) {
        showToast('رقم الهاتف الثاني غير صحيح');
        return;
    }
    
    // التحقق من تطابق كلمة المرور
    if (password !== confirm) {
        showToast('كلمة المرور غير متطابقة');
        return;
    }
    
    if (password.length < 6) {
        showToast('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
        return;
    }
    
    // التحقق من عدم وجود رقم مكرر
    checkPhoneExists(phone1).then(exists => {
        if (exists) {
            showToast('رقم الهاتف مسجل مسبقاً');
            return;
        }
        
        // عرض نافذة التأكيد مع تفاصيل الموقع
        showModal(
            'تأكيد التسجيل',
            `المطعم: ${name}\nالهاتف: ${phone1}\nالموقع: ${location}\nدقة الموقع: ${bestLocation.accuracy.toFixed(1)} متر\n\nهل أنت متأكد من رغبتك في التسجيل؟`,
            function() {
                performFoodRegistration(name, phone1, phone2, location, password);
            }
        );
    });
}

// ===== تنفيذ تسجيل المطعم =====
function performFoodRegistration(name, phone1, phone2, location, password) {
    const data = {
        name: name,
        phone: phone1,
        phone2: phone2 || '',
        location: location,
        password: password,
        type: 'restaurant',
        status: 'pending',
        approved: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        activeSession: null,
        lat: bestLocation.lat,
        lng: bestLocation.lng,
        accuracy: bestLocation.accuracy,
        radius: 50, // مسافة افتراضية 50 متر
        lastLocationUpdate: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    db.collection('users').add(data)
        .then(docRef => {
            // إيقاف تتبع الموقع
            stopLocationTracking();
            
            showToast('✅ تم التسجيل بنجاح!');
            showRegistrationSuccess('restaurant', name, phone1, phone2);
            
            // إعادة تعيين النموذج
            resetFoodForm();
        })
        .catch(err => {
            console.error(err);
            showToast('❌ حدث خطأ أثناء التسجيل');
        });
}

// ===== إعادة تعيين نموذج المطعم =====
function resetFoodForm() {
    document.getElementById('food-form').reset();
    document.getElementById('food-location').value = '';
    document.getElementById('food-location-status').innerHTML = 'لم يتم تحديد الموقع';
    document.getElementById('food-location-status').className = '';
    
    // إعادة تعيين شريط التقدم
    const progress = document.getElementById('location-progress');
    if (progress) {
        const fill = progress.querySelector('.progress-fill');
        const label = progress.querySelector('.progress-label');
        if (fill) fill.style.width = '0%';
        if (label) label.textContent = 'انتظر لتحديد الموقع...';
    }
    
    // إعادة تعيين زر الموقع
    const locationBtn = document.querySelector('.btn-location');
    if (locationBtn) {
        locationBtn.disabled = false;
        locationBtn.style.background = '';
        locationBtn.style.color = '';
        const icon = locationBtn.querySelector('i');
        if (icon) icon.className = 'fas fa-crosshairs';
    }
    
    // إعادة تعيين حقل الموقع
    const locationInput = document.getElementById('food-location');
    locationInput.style.borderColor = '';
    locationInput.style.boxShadow = '';
    
    // تعطيل زر التسجيل
    document.querySelector('#food-form button[type="submit"]').disabled = true;
    
    // إعادة تعيين المتغيرات
    bestLocation = null;
    isLocationFixed = false;
    locationAttempts = 0;
}

// ===== عرض رسالة نجاح التسجيل =====
function showRegistrationSuccess(type, name, phone1, phone2) {
    const address = 'كركوك - قضاء الحويجة - السوق الكبير قرب دائرة الكهرباء';
    let msg = '';
    let whatsappMsg = '';
    
    if (type === 'restaurant') {
        msg = `✅ تم التسجيل بنجاح!\n\nعليك مراجعة مكتب الشركة لأكمال عملية التدقيق واستلام نموذج التسجيل مع تطبيق الكاشير الخاصة بكم.\n\n📍 عنوان الشركة: ${address}\n\nهل تريد إرسال رسالة التأكيد عبر واتساب؟`;
        
        whatsappMsg = `مرحباً، نحن ${name} ورقم هاتفنا ${phone1}`;
        if (phone2) whatsappMsg += ` ورقم هاتفنا الثاني ${phone2}`;
        whatsappMsg += ` قمنا بالتسجيل كعلامة تجارية. يرجى مراجعة طلب الانظمام وسوف نقوم بزيارتكم لاحقاً لأكمال عملية التسجيل.`;
    } else {
        msg = `✅ تم التسجيل بنجاح!\n\nعليك مراجعة مكتب الشركة لأكمال عملية التدقيق واستلام بطاقة التسجيل، يرجى جلب المستمسكات الرسمية الثبوتية الخاصة بالسائق.\n\n📍 عنوان الشركة: ${address}\n\nهل تريد إرسال رسالة التأكيد عبر واتساب؟`;
        
        whatsappMsg = `مرحباً، أنا ${name} ورقم هاتفي ${phone1}`;
        if (phone2) whatsappMsg += ` ورقم هاتفي الثاني ${phone2}`;
        whatsappMsg += ` قمت بالتسجيل كسائق توصيل. يرجى مراجعة طلب الانظمام وسوف أقوم بزيارتكم لاحقاً لأكمال عملية التسجيل.`;
    }
    
    // حفظ رسالة الواتساب للاستخدام لاحقاً
    window.pendingWhatsAppMessage = whatsappMsg;
    window.pendingPhone1 = phone1;
    window.pendingPhone2 = phone2;
    
    showModal('🎉 تم التسجيل بنجاح!', msg, function() {
        // فتح واتساب مع الرسالة
        sendWhatsAppMessage(type, name, phone1, phone2, whatsappMsg);
    });
}

// ===== إرسال رسالة واتساب =====
function sendWhatsAppMessage(type, name, phone1, phone2, message) {
    // رقم الشركة من الرابط المطلوب
    const companyNumber = '9647700000000'; // سيتم تحديثه لاحقاً
    
    // تشفير الرسالة
    const encodedMsg = encodeURIComponent(message);
    const url = `https://wa.me/${companyNumber}?text=${encodedMsg}`;
    
    // فتح واتساب
    window.open(url, '_blank');
    
    // بعد العودة من واتساب، نعتبر أن المستخدم مسجل
    showToast('✅ تم إرسال رسالة التأكيد');
    
    // تسجيل الدخول التلقائي
    autoLoginAfterRegistration(phone1, password);
}

// ===== تسجيل الدخول التلقائي بعد التسجيل =====
function autoLoginAfterRegistration(phone, password) {
    // البحث عن المستخدم
    db.collection('users')
        .where('phone', '==', phone)
        .where('password', '==', password)
        .get()
        .then(query => {
            if (query.empty) {
                // إذا فشل تسجيل الدخول التلقائي، انتقل إلى صفحة تسجيل الدخول
                navigateTo('login');
                return;
            }
            
            const doc = query.docs[0];
            const userData = doc.data();
            const userId = doc.id;
            
            // تحديث الجلسة النشطة
            db.collection('users').doc(userId).update({
                activeSession: userId,
                lastLogin: firebase.firestore.FieldValue.serverTimestamp()
            }).then(() => {
                currentUser = { id: userId, ...userData };
                currentUserData = userData;
                
                // حفظ الجلسة
                const session = {
                    userId: userId,
                    user: { id: userId, ...userData },
                    userData: userData,
                    expires: Date.now() + (7 * 24 * 60 * 60 * 1000)
                };
                localStorage.setItem('smart_menu_session', JSON.stringify(session));
                
                updateNavButtons();
                navigateTo('home');
                showToast('مرحباً بك ' + userData.name);
            });
        })
        .catch(err => {
            console.error(err);
            navigateTo('login');
        });
}

// ===== إضافة أنماط التحديث الحي =====
function addLocationStyles() {
    const style = document.createElement('style');
    style.textContent = `
        .location-group .location-progress {
            margin-top: 10px;
        }
        
        .location-group .progress-track {
            width: 100%;
            height: 6px;
            background: var(--bg-primary);
            border-radius: 4px;
            overflow: hidden;
        }
        
        .location-group .progress-fill {
            height: 100%;
            width: 0%;
            background: linear-gradient(90deg, #ff6b6b, #ffd93d, #00e5a0);
            border-radius: 4px;
            transition: width 0.5s ease;
        }
        
        .location-group .progress-label {
            font-size: 0.75rem;
            color: var(--text-secondary);
            margin-top: 4px;
            text-align: center;
        }
        
        .location-group .location-status.success {
            color: #00e5a0;
            font-weight: 600;
        }
        
        .location-group .location-status.improving {
            color: #ffd93d;
        }
        
        .location-group .location-status.poor {
            color: #ff6b6b;
        }
        
        .location-group .location-status.error {
            color: #ff4757;
        }
        
        .location-group .location-status.searching {
            color: #4a9eff;
        }
        
        .btn-location:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        
        .btn-location .fa-check-circle {
            color: #00e5a0;
        }
        
        @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.05); }
            100% { transform: scale(1); }
        }
        
        .location-status.success {
            animation: pulse 1.5s ease infinite;
        }
        
        .location-input input.success {
            border-color: #00e5a0 !important;
            box-shadow: 0 0 20px rgba(0,229,160,0.2) !important;
        }
    `;
    document.head.appendChild(style);
}

// ===== تهيئة الصفحة =====
document.addEventListener('DOMContentLoaded', function() {
    addLocationStyles();
    
    // تعطيل زر التسجيل في البداية
    const submitBtn = document.querySelector('#food-form button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
    
    // إضافة مستمع لزر الموقع
    const locationBtn = document.querySelector('.btn-location');
    if (locationBtn) {
        locationBtn.addEventListener('click', function(e) {
            e.preventDefault();
            getLocation('food');
        });
    }
    
    // إضافة مستمع للنموذج
    const form = document.getElementById('food-form');
    if (form) {
        form.addEventListener('submit', registerFood);
    }
});

// ===== تحديث وظيفة getLocation للسائق =====
// دمج مع وظيفة السائق
function getDriverLocation() {
    startDriverLocation();
}
