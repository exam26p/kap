// ============================================
// إدارة المصادقة والجلسات
// ============================================

// ===== التحقق من رقم الهاتف =====
function validatePhone(phone) {
    // يجب أن يكون 11 رقم ويبدأ بـ 07
    return /^07\d{9}$/.test(phone);
}

// ===== التحقق من عدم وجود رقم مكرر =====
function checkPhoneExists(phone) {
    return db.collection('users')
        .where('phone', '==', phone)
        .get()
        .then(query => !query.empty);
}

// ===== تسجيل مطعم / كافتريا =====
function registerFood(event) {
    event.preventDefault();
    
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
        
        // عرض نافذة التأكيد
        showModal('تأكيد التسجيل', 'هل أنت متأكد من رغبتك في تسجيل ' + name + '؟', function() {
            // تنفيذ التسجيل
            performFoodRegistration(name, phone1, phone2, location, password);
        });
    });
}

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
        lat: locationData.lat || 0,
        lng: locationData.lng || 0,
        acc: locationData.acc || 0
    };
    
    db.collection('users').add(data)
        .then(docRef => {
            showToast('تم التسجيل بنجاح!');
            showRegistrationSuccess('restaurant', name, phone1, phone2);
            
            // إرسال رسالة واتساب تلقائية
            sendWhatsAppMessage('restaurant', name, phone1, phone2);
            
            // إعادة تعيين النموذج
            document.getElementById('food-form').reset();
            document.getElementById('food-location').value = '';
            document.getElementById('food-location-status').textContent = 'لم يتم تحديد الموقع';
            document.getElementById('food-location-status').className = '';
        })
        .catch(err => {
            console.error(err);
            showToast('حدث خطأ أثناء التسجيل');
        });
}

// ===== تسجيل سائق =====
function registerDriver(event) {
    event.preventDefault();
    
    const first = document.getElementById('driver-first').value.trim();
    const second = document.getElementById('driver-second').value.trim();
    const third = document.getElementById('driver-third').value.trim();
    const address = document.getElementById('driver-address').value.trim();
    const phone1 = document.getElementById('driver-phone1').value.trim();
    const phone2 = document.getElementById('driver-phone2').value.trim();
    const location = document.getElementById('driver-location').value.trim();
    const password = document.getElementById('driver-password').value;
    const confirm = document.getElementById('driver-password-confirm').value;
    
    // التحقق من الحقول المطلوبة
    if (!first || !second || !third || !address || !phone1 || !phone2 || !location || !password || !confirm) {
        showToast('يرجى ملء جميع الحقول المطلوبة');
        return;
    }
    
    // التحقق من رقم الهاتف
    if (!validatePhone(phone1)) {
        showToast('رقم الهاتف الأول يجب أن يكون 11 رقماً ويبدأ بـ 07');
        return;
    }
    if (!validatePhone(phone2)) {
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
    
    const fullName = first + ' ' + second + ' ' + third;
    
    // التحقق من عدم وجود رقم مكرر
    checkPhoneExists(phone1).then(exists => {
        if (exists) {
            showToast('رقم الهاتف مسجل مسبقاً');
            return;
        }
        
        showModal('تأكيد التسجيل', 'هل أنت متأكد من رغبتك في تسجيل ' + fullName + '؟', function() {
            performDriverRegistration(first, second, third, address, phone1, phone2, location, password);
        });
    });
}

function performDriverRegistration(first, second, third, address, phone1, phone2, location, password) {
    const data = {
        firstName: first,
        secondName: second,
        thirdName: third,
        fullName: first + ' ' + second + ' ' + third,
        address: address,
        phone: phone1,
        phone2: phone2,
        location: location,
        password: password,
        type: 'driver',
        status: 'pending',
        approved: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        activeSession: null,
        lat: locationData.lat || 0,
        lng: locationData.lng || 0,
        acc: locationData.acc || 0,
        isActive: false,
        online: false
    };
    
    db.collection('users').add(data)
        .then(docRef => {
            showToast('تم التسجيل بنجاح!');
            showRegistrationSuccess('driver', data.fullName, phone1, phone2);
            sendWhatsAppMessage('driver', data.fullName, phone1, phone2);
            
            document.getElementById('driver-form').reset();
            document.getElementById('driver-location').value = '';
            document.getElementById('driver-location-status').textContent = 'لم يتم تحديد الموقع';
            document.getElementById('driver-location-status').className = '';
        })
        .catch(err => {
            console.error(err);
            showToast('حدث خطأ أثناء التسجيل');
        });
}

// ===== عرض رسالة نجاح التسجيل =====
function showRegistrationSuccess(type, name, phone1, phone2) {
    const msg = type === 'restaurant' 
        ? 'تم التسجيل عليك مراجعة مكتب الخاص بالشركة لأكمال عملية التدقيق واستلام نموذج التسجيل مع تطبيق الكاشير الخاصة بكم'
        : 'تم التسجيل عليك مراجعة مكتب الخاص بالشركة لأكمال عملية التدقيق واستلام بطاقة التسجيل، يرجى جلب المستمسكات الرسمية الثبوتية الخاصة بالسائق لأكمال عملية التسجيل';
    
    const address = 'كركوك - قضاء الحويجة - السوق الكبير قرب دائرة الكهرباء';
    
    showModal('تم التسجيل بنجاح', 
        msg + '\n\nعنوان الشركة: ' + address + '\n\nهل تريد المتابعة؟', 
        function() {
            // إرسال رسالة واتساب
            sendWhatsAppMessage(type, name, phone1, phone2);
            navigateTo('home');
        }
    );
}

// ===== إرسال رسالة واتساب =====
function sendWhatsAppMessage(type, name, phone1, phone2) {
    const typeText = type === 'restaurant' ? 'علامة تجارية' : 'سائق توصيل';
    let message = 'مرحباً، أنا ' + name + ' ورقم هاتفي ' + phone1;
    if (phone2) message += ' ورقم هاتفي الثاني ' + phone2;
    message += ' قمت بالتسجيل كـ ' + typeText + ' يرجى مراجعة طلب الانظمام وسوف أقوم بزيارتكم لاحقاً لأكمال عملية التسجيل';
    
    // الرابط المحجوز مؤقتاً مع إضافة النص
    // سيتم فتح الواتساب مع الرسالة عند الضغط على الرابط
}

// ===== فتح الواتساب =====
function openWhatsApp() {
    const number = '9647700000000'; // رقم الدعم
    window.open('https://wa.me/' + number, '_blank');
}

// ===== المساعدة والدعم =====
function showHelp() {
    navigateTo('help');
}

// ===== تحديث الموقع =====
function getLocation(type) {
    if (!navigator.geolocation) {
        showToast('جهازك لا يدعم تحديد الموقع');
        return;
    }
    
    const statusEl = document.getElementById(type + '-location-status');
    statusEl.textContent = 'جاري تحديد الموقع...';
    statusEl.className = '';
    
    navigator.geolocation.getCurrentPosition(
        function(pos) {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            const acc = pos.coords.accuracy;
            
            locationData = { lat, lng, acc };
            
            const locationStr = lat.toFixed(6) + ', ' + lng.toFixed(6);
            document.getElementById(type + '-location').value = locationStr;
            
            if (acc <= 5) {
                statusEl.textContent = '✅ تم تحديد الموقع بدقة عالية (' + acc + ' متر)';
                statusEl.className = 'success';
            } else {
                statusEl.textContent = '⚠️ تم تحديد الموقع بدقة ' + acc + ' متر (يُفضل دقة أقل من 5 متر)';
            }
        },
        function(err) {
            statusEl.textContent = '❌ فشل تحديد الموقع: ' + err.message;
        },
        { enableHighAccuracy: true, timeout: 10000 }
    );
}