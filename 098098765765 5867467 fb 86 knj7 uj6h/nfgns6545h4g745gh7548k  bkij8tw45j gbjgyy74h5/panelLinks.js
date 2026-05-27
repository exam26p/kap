// panelLinks.js - إدارة الروابط والوسائط
import { state } from './state.js';
import * as DB from './db.js';
import { toast, playClickSnd } from './utils.js';

let currentEditId = null;
let deleteTargetId = null;
let allLinksData = {};

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, onValue, push, update, remove, get } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyCEEqEALOCaQo5oSoR8A_Jh9eSpHS8Sz5o",
    authDomain: "game1-bb93e.firebaseapp.com",
    databaseURL: "https://game1-bb93e-default-rtdb.firebaseio.com",
    projectId: "game1-bb93e"
};

const linksApp = initializeApp(firebaseConfig, 'links');
const linksDb = getDatabase(linksApp);
const dataRef = ref(linksDb, 'data');

export function initLinksModule() {
    loadLinksData();
    bindLinksEvents();
}

function loadLinksData() {
    onValue(dataRef, (snapshot) => {
        allLinksData = snapshot.val() || {};
        renderLinksTable();
        updateLinksCount();
    });
}

function bindLinksEvents() {
    const form = document.getElementById('linksForm');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await saveLinksData();
        });
    }
    
    const videoInput = document.getElementById('videoInput');
    const dropZone = document.getElementById('dropZone');
    
    if (dropZone) {
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        });
        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('dragover');
        });
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            if (e.dataTransfer.files.length) {
                videoInput.files = e.dataTransfer.files;
                videoInput.dispatchEvent(new Event('change'));
            }
        });
    }
    
    if (videoInput) {
        videoInput.addEventListener('change', uploadVideoToGitHub);
    }
}

async function saveLinksData() {
    const fb = document.getElementById('fbInput')?.value.trim() || '';
    const ig = document.getElementById('igInput')?.value.trim() || '';
    const wa = document.getElementById('waInput')?.value.trim() || '';
    const mp = document.getElementById('mapInput')?.value.trim() || '';
    
    if (!fb && !ig && !wa && !mp) {
        toast('يرجى ملء حقل واحد على الأقل', 'te');
        return;
    }
    
    const btn = document.getElementById('submitBtn');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span> جاري الحفظ...';
    }
    
    try {
        await push(dataRef, {
            facebook: fb,
            instagram: ig,
            whatsapp: wa,
            map: mp,
            createdAt: new Date().toISOString()
        });
        toast('تم حفظ الروابط بنجاح', 'ts');
        document.getElementById('linksForm')?.reset();
    } catch (err) {
        console.error(err);
        toast('حدث خطأ أثناء الحفظ', 'te');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-save"></i> حفظ الروابط';
        }
    }
}

function renderLinksTable() {
    const keys = Object.keys(allLinksData);
    const tbody = document.getElementById('linksTableBody');
    const table = document.getElementById('linksDataTable');
    const empty = document.getElementById('linksEmptyState');
    
    if (!tbody) return;
    
    if (keys.length === 0) {
        if (table) table.style.display = 'none';
        if (empty) empty.style.display = 'block';
        return;
    }
    
    if (table) table.style.display = 'table';
    if (empty) empty.style.display = 'none';
    tbody.innerHTML = '';
    
    keys.forEach((key, index) => {
        const item = allLinksData[key];
        const isEditing = currentEditId === key;
        const tr = document.createElement('tr');
        
        if (isEditing) {
            tr.innerHTML = `
                <td>${index + 1}</td>
                <td><input class="fi edit-input" id="edit-fb-${key}" value="${escapeHtml(item.facebook || '')}" placeholder="رابط فيسبوك" dir="ltr"></td>
                <td><input class="fi edit-input" id="edit-ig-${key}" value="${escapeHtml(item.instagram || '')}" placeholder="رابط انستقرام" dir="ltr"></td>
                <td><input class="fi edit-input" id="edit-wa-${key}" value="${escapeHtml(item.whatsapp || '')}" placeholder="رابط واتساب" dir="ltr"></td>
                <td><input class="fi edit-input" id="edit-mp-${key}" value="${escapeHtml(item.map || '')}" placeholder="رابط الخريطة" dir="ltr"></td>
                <td>
                    <div class="actions-cell" style="display:flex;gap:6px;">
                        <button class="btn-secondary btn-sm" onclick="window.saveLinkEdit('${key}')"><i class="fas fa-check"></i></button>
                        <button class="btn-secondary btn-sm" onclick="window.cancelLinkEdit()"><i class="fas fa-times"></i></button>
                    </div>
                 </td>
            `;
        } else {
            tr.innerHTML = `
                <td>${index + 1}</td>
                <td class="link-cell">${item.facebook ? `<a href="${escapeHtml(item.facebook)}" target="_blank"><span class="platform-tag" style="background:rgba(24,119,242,0.1);color:#3b82f6"><i class="fab fa-facebook"></i> فيسبوك</span></a>` : '<span style="color:var(--text-muted)">—</span>'}</td>
                <td class="link-cell">${item.instagram ? `<a href="${escapeHtml(item.instagram)}" target="_blank"><span class="platform-tag" style="background:rgba(228,64,95,0.1);color:#ec489a"><i class="fab fa-instagram"></i> انستقرام</span></a>` : '<span style="color:var(--text-muted)">—</span>'}</td>
                <td class="link-cell">${item.whatsapp ? `<a href="${escapeHtml(item.whatsapp)}" target="_blank"><span class="platform-tag" style="background:rgba(37,211,102,0.1);color:#10b981"><i class="fab fa-whatsapp"></i> واتساب</span></a>` : '<span style="color:var(--text-muted)">—</span>'}</td>
                <td class="link-cell">${item.map ? `<a href="${escapeHtml(item.map)}" target="_blank"><span class="platform-tag" style="background:var(--accent-dim);color:var(--accent)"><i class="fas fa-map-marker-alt"></i> خريطة</span></a>` : '<span style="color:var(--text-muted)">—</span>'}</td>
                <td>
                    <div class="actions-cell" style="display:flex;gap:6px;">
                        <button class="btn-secondary btn-sm" onclick="window.startLinkEdit('${key}')"><i class="fas fa-pen"></i></button>
                        <button class="btn-secondary btn-sm btn-red" onclick="window.openLinkDeleteModal('${key}')"><i class="fas fa-trash"></i></button>
                    </div>
                 </td>
            `;
        }
        tbody.appendChild(tr);
    });
}

window.startLinkEdit = function(key) {
    currentEditId = key;
    renderLinksTable();
};

window.cancelLinkEdit = function() {
    currentEditId = null;
    renderLinksTable();
};

window.saveLinkEdit = async function(key) {
    const fb = document.getElementById(`edit-fb-${key}`)?.value.trim() || '';
    const ig = document.getElementById(`edit-ig-${key}`)?.value.trim() || '';
    const wa = document.getElementById(`edit-wa-${key}`)?.value.trim() || '';
    const mp = document.getElementById(`edit-mp-${key}`)?.value.trim() || '';
    
    try {
        await update(ref(linksDb, `data/${key}`), {
            facebook: fb,
            instagram: ig,
            whatsapp: wa,
            map: mp
        });
        currentEditId = null;
        toast('تم تحديث البيانات', 'ts');
    } catch (err) {
        toast('خطأ في التحديث', 'te');
    }
};

window.openLinkDeleteModal = function(key) {
    deleteTargetId = key;
    const modal = document.getElementById('linkDeleteModal');
    if (modal) modal.classList.add('active');
};

window.closeLinkDeleteModal = function() {
    deleteTargetId = null;
    const modal = document.getElementById('linkDeleteModal');
    if (modal) modal.classList.remove('active');
};

window.confirmLinkDelete = async function() {
    if (!deleteTargetId) return;
    try {
        await remove(ref(linksDb, `data/${deleteTargetId}`));
        toast('تم حذف السجل', 'ts');
        window.closeLinkDeleteModal();
        if (currentEditId === deleteTargetId) currentEditId = null;
    } catch (err) {
        toast('خطأ في الحذف', 'te');
    }
};

// ===== دالة رفع الفيديو (تم استدعاء التوكن من قاعدة البيانات بدلاً من كتابته) =====
// ===== دالة رفع الفيديو (تم تعديلها لحل مشكلة 401) =====
async function uploadVideoToGitHub(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > 25) {
        toast(`حجم الفيديو (${fileSizeMB.toFixed(1)}MB) يتجاوز 25MB`, 'te');
        document.getElementById('videoInput').value = '';
        return;
    }
    
    const progressContainer = document.getElementById('videoProgressContainer');
    const progressBar = document.getElementById('videoProgressBar');
    if (progressContainer) progressContainer.style.display = 'block';
    if (progressBar) progressBar.style.width = '10%';
    
    toast('جاري التحقق والرفع...', 'ti');
    
    try {
        // 1. جلب الـ Token من قاعدة البيانات بشكل آمن
        if (progressBar) progressBar.style.width = '20%';
        const tokenSnap = await get(ref(linksDb, 'token/-Otf58SaDf-QOFSrYCfn/token'));
        
        if (!tokenSnap.exists()) {
            toast('خطأ: لم يتم العثور على مفتاح الرفع (Token) في قاعدة البيانات', 'te');
            if (progressContainer) progressContainer.style.display = 'none';
            return;
        }
        
                // تنظيف الـ Token من المسافات أو علامات التنصيص الزائدة
        let GITHUB_TOKEN = String(tokenSnap.val()).trim().replace(/^["']|["']$/g, '');
        
        // 2. تحويل الملف
        const base64Data = await toBase64(file);
        const pureBase64 = base64Data.split(',')[1];
        
        const apiUrl = `https://api.github.com/repos/exam26p/kap/contents/assets/background_video.mp4`;
        
        let sha = "";
        
        // 3. جلب SHA للملف الحالي لاستبداله
        const getFileRes = await fetch(apiUrl, {
            method: "GET",
            headers: { 
                "Authorization": `Bearer ${GITHUB_TOKEN}`,
                "Accept": "application/vnd.github+json"
            }
        });
        
        if (getFileRes.ok) {
            const fileInfo = await getFileRes.json();
            sha = fileInfo.sha;
        } else if (getFileRes.status === 401) {
            // إذا كان الـ Token نفسه مرفوض في خطوة الجلب
            const errData = await getFileRes.json();
            throw new Error('Token غير صالح أو منتهي: ' + errData.message);
        }
        
        if (progressBar) progressBar.style.width = '50%';
        
        // 4. رفع الملف الجديد
        const uploadRes = await fetch(apiUrl, {
            method: "PUT",
            headers: {
                "Authorization": `Bearer ${GITHUB_TOKEN}`,
                "Content-Type": "application/json",
                "Accept": "application/vnd.github+json"
            },
            body: JSON.stringify({
                message: "تحديث فيديو الخلفية",
                content: pureBase64,
                sha: sha || undefined
            })
        });
        
        if (progressBar) progressBar.style.width = '100%';
        
        if (uploadRes.ok) {
            toast('تم رفع الفيديو واستبداله بنجاح!', 'ts');
            setTimeout(() => {
                if (progressContainer) progressContainer.style.display = 'none';
                if (progressBar) progressBar.style.width = '0%';
            }, 2000);
        } else {
            const errData = await uploadRes.json();
            throw new Error(errData.message || 'فشل في رفع الملف');
        }
    } catch (error) {
        console.error(error);
        toast('فشل رفع الفيديو: ' + error.message, 'te');
        if (progressContainer) progressContainer.style.display = 'none';
    }
    
    document.getElementById('videoInput').value = '';
}

function toBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

function updateLinksCount() {
    const badge = document.getElementById('linksCountBadge');
    if (badge) {
        badge.textContent = Object.keys(allLinksData).length + ' سجل';
    }
}

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

window.initLinksModule = initLinksModule;
