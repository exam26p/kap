// ============================================
// صفحة المينيو - عرض الأطباق والفلترة
// ============================================

let menuRestaurantId = null;
let menuItems = [];
let menuFilter = 'all';

function loadMenu(data) {
    menuRestaurantId = data.id;
    document.getElementById('menu-restaurant-name').textContent = data.name;
    
    // عرض حالة المسافة
    const container = document.getElementById('menu-items');
    container.innerHTML = '<div class="text-center" style="padding:40px;color:var(--text-secondary)">جاري تحميل المينيو...</div>';
    
    // عرض حالة التواجد
    if (data.isInside !== undefined) {
        const statusHtml = `
            <div style="margin-bottom:16px;padding:12px 16px;border-radius:10px;background:${data.isInside ? 'var(--primary-light)' : 'var(--danger-light)'};color:${data.isInside ? 'var(--primary)' : 'var(--danger)'};display:flex;align-items:center;gap:10px;font-size:0.85rem;">
                <i class="fas ${data.isInside ? 'fa-check-circle' : 'fa-times-circle'}"></i>
                <span>${data.isInside ? 'أنت داخل نطاق المطعم (' + Math.round(data.distance) + ' متر)' : 'أنت خارج نطاق المطعم (' + Math.round(data.distance) + ' متر / ' + data.radius + ' متر)'}</span>
            </div>
        `;
        document.querySelector('.menu-header').insertAdjacentHTML('afterend', statusHtml);
    }
    
    // جلب المينيو من قاعدة البيانات
    db.collection('menu')
        .where('restaurantId', '==', data.id)
        .get()
        .then(query => {
            menuItems = [];
            query.forEach(doc => {
                menuItems.push({ id: doc.id, ...doc.data() });
            });
            
            if (menuItems.length === 0) {
                container.innerHTML = `
                    <div class="text-center" style="padding:40px;color:var(--text-secondary)">
                        <i class="fas fa-utensils" style="font-size:2rem;display:block;margin-bottom:10px;color:var(--text-muted)"></i>
                        لا توجد عناصر في المينيو
                    </div>
                `;
                return;
            }
            
            renderMenuItems('all');
        })
        .catch(err => {
            console.error(err);
            container.innerHTML = '<div class="text-center" style="padding:40px;color:var(--danger)">حدث خطأ في تحميل المينيو</div>';
        });
}

// ===== عرض عناصر المينيو مع فلترة =====
function renderMenuItems(filter) {
    const container = document.getElementById('menu-items');
    let filtered = menuItems;
    
    if (filter !== 'all') {
        filtered = menuItems.filter(item => item.category === filter);
    }
    
    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="text-center" style="padding:40px;color:var(--text-secondary)">
                <i class="fas fa-search" style="font-size:2rem;display:block;margin-bottom:10px;color:var(--text-muted)"></i>
                لا توجد عناصر في هذا التصنيف
            </div>
        `;
        return;
    }
    
    let html = '';
    filtered.forEach(item => {
        html += `
            <div class="menu-item">
                <div class="item-image">
                    <i class="fas ${getCategoryIcon(item.category)}"></i>
                </div>
                <h4>${item.name}</h4>
                <div class="item-price">${item.price || '0'} د.ع</div>
                <div class="item-desc">${item.description || ''}</div>
            </div>
        `;
    });
    container.innerHTML = html;
}

// ===== فلترة المينيو =====
function filterMenu() {
    const filter = document.getElementById('menu-filter').value;
    renderMenuItems(filter);
}

// ===== أيقونات التصنيفات =====
function getCategoryIcon(category) {
    const icons = {
        'foods': 'fa-utensils',
        'drinks': 'fa-mug-hot',
        'desserts': 'fa-cake',
        'appetizers': 'fa-bowl-food',
        'main': 'fa-utensil-spoon',
        'sandwiches': 'fa-bread-slice',
        'pizza': 'fa-pizza-slice',
        'burger': 'fa-hamburger'
    };
    return icons[category] || 'fa-utensils';
}