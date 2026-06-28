// ============================================
// الصفحة الرئيسية - عرض المطاعم
// ============================================

function loadHomePage() {
    const container = document.getElementById('restaurants-list');
    container.innerHTML = '<div class="text-center" style="padding:40px;color:var(--text-secondary)">جاري تحميل المطاعم...</div>';
    
    // جلب المطاعم المعتمدة فقط
    db.collection('users')
        .where('type', '==', 'restaurant')
        .where('approved', '==', true)
        .get()
        .then(query => {
            if (query.empty) {
                container.innerHTML = `
                    <div class="text-center" style="padding:40px;color:var(--text-secondary)">
                        <i class="fas fa-store" style="font-size:2rem;display:block;margin-bottom:10px;color:var(--text-muted)"></i>
                        لا توجد مطاعم مسجلة حالياً
                    </div>
                `;
                return;
            }
            
            let html = '';
            query.forEach(doc => {
                const data = doc.data();
                const id = doc.id;
                html += `
                    <div class="restaurant-card" onclick="openRestaurant('${id}', '${data.name}')">
                        <div class="icon"><i class="fas fa-utensils"></i></div>
                        <h3>${data.name}</h3>
                        <div class="phone"><i class="fas fa-phone"></i> ${data.phone}</div>
                        <div class="distance">${data.status === 'pending' ? 'قيد المراجعة' : 'مفتوح'}</div>
                    </div>
                `;
            });
            container.innerHTML = html;
        })
        .catch(err => {
            console.error(err);
            container.innerHTML = '<div class="text-center" style="padding:40px;color:var(--danger)">حدث خطأ في تحميل المطاعم</div>';
        });
}

// ===== فتح صفحة المينيو =====
function openRestaurant(restaurantId, name) {
    selectedRestaurant = restaurantId;
    // التحقق من الموقع
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            function(pos) {
                const lat = pos.coords.latitude;
                const lng = pos.coords.longitude;
                checkRestaurantDistance(restaurantId, lat, lng, name);
            },
            function() {
                // في حالة فشل تحديد الموقع، نفتح المينيو بشكل عادي
                navigateTo('menu', { id: restaurantId, name: name });
            },
            { enableHighAccuracy: true, timeout: 5000 }
        );
    } else {
        navigateTo('menu', { id: restaurantId, name: name });
    }
}

// ===== التحقق من المسافة للمطعم =====
function checkRestaurantDistance(restaurantId, lat, lng, name) {
    db.collection('users').doc(restaurantId).get()
        .then(doc => {
            if (!doc.exists) {
                navigateTo('menu', { id: restaurantId, name: name });
                return;
            }
            
            const data = doc.data();
            const rLat = data.lat || 0;
            const rLng = data.lng || 0;
            const radius = data.radius || 50; // مسافة 50 متر افتراضياً
            
            const distance = calculateDistance(lat, lng, rLat, rLng);
            
            // تخزين حالة المسافة للاستخدام في صفحة المينيو
            const menuData = {
                id: restaurantId,
                name: name,
                isInside: distance <= radius,
                distance: distance,
                radius: radius
            };
            
            navigateTo('menu', menuData);
        })
        .catch(() => {
            navigateTo('menu', { id: restaurantId, name: name });
        });
}

// ===== حساب المسافة =====
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
