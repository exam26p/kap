// panelMenu.js
import { state } from './state.js';
import * as DB from './db.js';
import { toast, processMenuImg, processItemImg } from './utils.js';

export function renderMenuStructure() {
    const c = document.getElementById('menuStructure'); 
    const data = state.directMenuData; 
    c.innerHTML = ''; 
    
    if (!data) { 
        c.innerHTML = '<p style="color:var(--text-muted);">لا توجد أقسام.</p>'; 
        return; 
    }
    
    for (let catId in data) {
        const cat = data[catId]; 
        let itemsHtml = '';
        
        if (cat.items) { 
            for (let iid in cat.items) { 
                const it = cat.items[iid]; 
                // نستخدم الصورة إذا كانت موجودة، وإلا نعرض أيقونة العنصر النائب
                const imgHtml = (it.image && it.image.length > 20) 
                    ? `<div class="item-img-wrap"><img src="${it.image}" alt="${it.name}"></div>` 
                    : `<div class="item-img-placeholder"><i class="fas fa-image"></i></div>`;
                
                itemsHtml += `
                <div class="item-row">
                    <div class="item-info">
                        ${imgHtml}
                        <div class="item-text">
                            <div class="item-name">${it.name}</div>
                            <div class="item-details">${it.details || ''}</div>
                            <div class="item-price">${it.price} دينار</div>
                        </div>
                    </div>
                    <div class="item-actions">
                        <button class="btn-secondary btn-sm" onclick="App.editItem('${catId}','${iid}','${it.name.replace(/'/g, "\\'")}','${it.price}','${(it.details||'').replace(/'/g, "\\'")}')"><i class="fas fa-pen"></i></button>
                        <button class="btn-secondary btn-sm btn-red" onclick="App.delItem('${catId}','${iid}')"><i class="fas fa-trash"></i></button>
                    </div>
                </div>`; 
            } 
        }
        
        const catImgSrc = cat.image && cat.image.length > 20 ? cat.image : '';
        const catImgHtml = catImgSrc 
            ? `<img src="${catImgSrc}" class="thumb-wide" alt="">` 
            : `<div class="thumb-wide" style="background:var(--bg-input);display:flex;align-items:center;justify-content:center;border-radius:8px;"><i class="fas fa-image" style="color:var(--text-muted);font-size:18px;"></i></div>`;
            
        c.innerHTML += `
        <div class="cat-box">
            <div class="cat-head">
                <div class="cat-info">
                    ${catImgHtml}
                    <h3 style="font-size:17px;font-weight:800;">${cat.name}</h3>
                </div>
                <div style="display:flex;gap:8px;">
                    <button class="btn-secondary btn-sm" onclick="App.editCat('${catId}','${cat.name.replace(/'/g, "\\'")}')"><i class="fas fa-pen"></i> تعديل</button>
                    <button class="btn-secondary btn-sm btn-red" onclick="App.delCat('${catId}')"><i class="fas fa-trash"></i> حذف</button>
                </div>
            </div>
            <div class="add-item-form">
                <h4><i class="fas fa-plus-circle" style="color:var(--accent);margin-left:5px;"></i> إضافة صنف</h4>
                <form id="if_${catId}" onsubmit="App.saveItem(event,'${catId}')">
                    <input type="hidden" id="eiid_${catId}">
                    <div class="form-row">
                        <div class="fg"><input type="text" class="fi" id="ein_${catId}" required placeholder="اسم الصنف"></div>
                        <div class="fg"><input type="number" class="fi" id="eip_${catId}" required placeholder="السعر"></div>
                    </div>
                    <textarea class="fi" id="eid_${catId}" required placeholder="التفاصيل" style="margin-bottom:10px;min-height:50px;resize:vertical;"></textarea>
                    <input type="file" class="fi" id="eii_${catId}" accept="image/*" style="margin-bottom:10px;padding:7px;">
                    <button type="submit" class="btn-primary btn-sm" id="eib_${catId}" style="margin-top:8px;"><i class="fas fa-plus"></i> حفظ</button>
                </form>
            </div>
            <div class="items-list">${itemsHtml || '<p style="color:var(--text-muted);font-size:13px;">لا توجد أصناف.</p>'}</div>
        </div>`;
    }
}

export async function saveCat(e) {
    e.preventDefault(); 
    const cid = document.getElementById('editCatId').value, name = document.getElementById('catName').value, file = document.getElementById('catImg').files[0]; 
    let img = ''; 
    if (file) img = await processMenuImg(file);
    
    if (cid) { 
        const ud = { name }; 
        if (img) ud.image = img; 
        DB.updateData('orders/' + cid, ud).then(() => { toast('تم تعديل القسم', 'ts'); resetCatForm(); }); 
    } else { 
        DB.pushData('orders', { name, image: img || '', created_at: new Date().toISOString() }).then(() => document.getElementById('catForm').reset()); 
    }
}

function resetCatForm() { 
    document.getElementById('editCatId').value = ''; 
    document.getElementById('catName').value = ''; 
    document.getElementById('catImg').value = ''; 
    document.getElementById('catBtn').innerHTML = '<i class="fas fa-plus"></i> حفظ القسم'; 
}

export function editCat(id, name) { 
    document.getElementById('editCatId').value = id; 
    document.getElementById('catName').value = name; 
    document.getElementById('catBtn').innerHTML = '<i class="fas fa-pen"></i> تحديث القسم'; 
    window.scrollTo({ top: 0, behavior: 'smooth' }); 
}

export function delCat(id) { if (confirm('حذف القسم وكل طلباته؟')) DB.removeData('orders/' + id); }

export async function saveItem(e, catId) {
    e.preventDefault(); 
    const iid = document.getElementById('eiid_' + catId).value, 
          name = document.getElementById('ein_' + catId).value, 
          price = document.getElementById('eip_' + catId).value, 
          details = document.getElementById('eid_' + catId).value, 
          file = document.getElementById('eii_' + catId).files[0]; 
    let img = ''; 
    if (file) img = await processItemImg(file);
    
    if (iid) { 
        const ud = { name, price, details }; 
        if (img) ud.image = img; 
        DB.updateData('orders/' + catId + '/items/' + iid, ud).then(() => { 
            toast('تم التحديث', 'ts'); 
            document.getElementById('if_' + catId).reset(); 
            document.getElementById('eiid_' + catId).value = ''; 
            document.getElementById('eib_' + catId).innerHTML = '<i class="fas fa-plus"></i> حفظ'; 
        }); 
    } else { 
        DB.pushData('orders/' + catId + '/items', { name, price, details, image: img || '' }).then(() => document.getElementById('if_' + catId).reset()); 
    }
}

export function editItem(catId, itemId, name, price, details) { 
    document.getElementById('eiid_' + catId).value = itemId; 
    document.getElementById('ein_' + catId).value = name; 
    document.getElementById('eip_' + catId).value = price; 
    document.getElementById('eid_' + catId).value = details; 
    document.getElementById('eib_' + catId).innerHTML = '<i class="fas fa-pen"></i> تحديث'; 
}

export function delItem(catId, itemId) { if (confirm('حذف؟')) DB.removeData('orders/' + catId + '/items/' + itemId); }
