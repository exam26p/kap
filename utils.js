// utils.js
import { state } from './state.js';

const sndBase = "https://exam26p.github.io/kap/";
const sndCache = {};
const clickFreqs = [
    { f: 1200, d: 0.04, t: 'sine' }, { f: 880, d: 0.05, t: 'sine' },
    { f: 1400, d: 0.03, t: 'triangle' }, { f: 1000, d: 0.045, t: 'sine' },
    { f: 1600, d: 0.035, t: 'square' }
];

let isAudioUnlocked = false; // منع تشغيل الصوت قبل تفاعل المستخدم

export const fmt = n => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
export const genSid = () => 's_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
export const sameDay = d => { if (!d) return false; const x = new Date(d), n = new Date(); return x.getFullYear() === n.getFullYear() && x.getMonth() === n.getMonth() && x.getDate() === n.getDate(); };
export const inRange = (d, f, t) => { if (!d) return false; const x = new Date(d); if (f && x < new Date(f)) return false; if (t) { const e = new Date(t); e.setHours(23, 59, 59, 999); if (x > e) return false; } return true; };

export function toast(msg, type = 'ti') {
    if (isAudioUnlocked) playClickSnd();
    const ic = { ts: 'fa-circle-check', te: 'fa-circle-xmark', ti: 'fa-circle-info' };
    const t = document.createElement('div');
    t.className = 'toast ' + type;
    t.innerHTML = '<i class="fas ' + (ic[type] || ic.ti) + '"></i> ' + msg;
    document.getElementById('toastBox').appendChild(t);
    setTimeout(() => { if (t.parentNode) t.remove(); }, 3200);
}

function getMp3(f) {
    if (!f || !f.trim() || f === 'off') return null;
    if (!sndCache[f]) { sndCache[f] = new Audio(f); sndCache[f].volume = 0.6; sndCache[f].onerror = function () { this.src = sndBase + f; }; }
    return sndCache[f];
}
function playSnd(f) { try { const a = getMp3(f); if (!a) return; a.currentTime = 0; a.play().catch(() => { }); } catch (e) { } }
function playClickProg(idx) { try { const c = clickFreqs[idx % clickFreqs.length]; const ac = new (window.AudioContext || window.webkitAudioContext)(); const o = ac.createOscillator(); const g = ac.createGain(); o.type = c.t; o.frequency.value = c.f; g.gain.setValueAtTime(0.12, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + c.d); o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime + c.d + 0.01); } catch (e) { } }

export function playClickSnd() { 
    if (!isAudioUnlocked) return; 
    const cs = state.settings.clickSound || 'off'; 
    if (cs === 'off') return; 
    if (cs.startsWith('__click')) { const n = parseInt(cs.replace('__click', '')) - 1; playClickProg(isNaN(n) ? 0 : n); } else playSnd(cs); 
}

export function playOnce(type) { 
    if (!isAudioUnlocked) return; 
    const k = type === 'order' ? state.settings.orderSound : type === 'msg' ? state.settings.msgSound : type === 'print' ? state.settings.printSound : null; 
    if (!k || k === 'off') return; playSnd(k); 
}

export function unlockAudio() { isAudioUnlocked = true; } // تفعيل الصوت بعد الدخول

export function alarmOrder(on) { if (on) { if (!state.orderAlarm) state.orderAlarm = setInterval(() => playOnce('order'), 3000); } else { clearInterval(state.orderAlarm); state.orderAlarm = null; } }
export function alarmMsg(on) { if (on) { if (!state.msgAlarm) state.msgAlarm = setInterval(() => playOnce('msg'), 4000); } else { clearInterval(state.msgAlarm); state.msgAlarm = null; } }

export function doBrowserPrint(cv) {
    const imgData = cv.toDataURL('image/png');
    const pWin = window.open('', '_blank', 'width=600,height=800');
    pWin.document.write(`<!DOCTYPE html><html dir="rtl"><head><title>طباعة</title><style>@page{size:auto;margin:0mm;}body{margin:0;padding:0;background:#fff;display:flex;justify-content:center;}img{width:100%;max-width:100%;height:auto;display:block;}</style></head><body><img src="${imgData}" onload="setTimeout(() => { window.print(); window.close(); }, 200);" /></body></html>`);
    pWin.document.close();
}

export function drawDash(cx, x1, x2, y, w) { cx.strokeStyle = '#333'; cx.lineWidth = w || 1; cx.setLineDash([4, 3]); cx.beginPath(); cx.moveTo(x1, y); cx.lineTo(x2, y); cx.stroke(); cx.setLineDash([]); }


// ===== معالجة الصور (الثورة في الوضوح!) =====

// دالة معالجة صورة القسم (العرضية الكبيرة)
export function processMenuImg(file) { 
    return new Promise(resolve => { 
        if (!file) return resolve(''); 
        const reader = new FileReader(); 
        reader.onload = ev => { 
            const img = new Image(); 
            img.onload = () => { 
                const cv = document.createElement('canvas'); 
                const maxW = 1400, maxH = 500; // جودة عالية جداً لعروض الجوال والتابلت
                let w = img.width, h = img.height;
                
                // تصغير متناسق يحافظ على الوضوح
                if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
                if (h > maxH) { w = Math.round(w * maxH / h); h = maxH; }
                
                cv.width = w; cv.height = h; 
                const ctx = cv.getContext('2d');
                ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, w, h);
                ctx.drawImage(img, 0, 0, w, h); 
                resolve(cv.toDataURL('image/jpeg', 0.85)); // جودة ممتازة
            }; 
            img.src = ev.target.result; 
        }; 
        reader.readAsDataURL(file); 
    }); 
}

// دالة معالجة صورة الصنف (تقبل جميع الأحجام وتظهرها بوضوح تام بدون قص)
export function processItemImg(file) { 
    return new Promise(resolve => { 
        if (!file) return resolve(''); 
        const reader = new FileReader(); 
        reader.onload = ev => { 
            const img = new Image(); 
            img.onload = () => { 
                const cv = document.createElement('canvas'); 
                const maxSize = 900; // جودة عالية جداً لتظهر حادة على شاشات الجوال (كانت 120 سابقاً!)
                let w = img.width, h = img.height; 
                
                // تصغير متناسق يحافظ على الوضوح ويمنع التشويه تماماً
                if (w > h) {
                    if (w > maxSize) { h = Math.round(h * maxSize / w); w = maxSize; }
                } else {
                    if (h > maxSize) { w = Math.round(w * maxSize / h); h = maxSize; }
                }
                
                cv.width = w; cv.height = h; 
                const ctx = cv.getContext('2d');
                
                // إضافة خلفية بيضاء للصور التي تحتوي شفافية أو أطراف فارغة
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, w, h);
                
                // رسم الصورة بالأبعاد الجديدة دون قص
                ctx.drawImage(img, 0, 0, w, h); 
                
                // استخدام جودة 85% للحفاظ على الوضوح مع حجم ملف معقول في Firebase
                resolve(cv.toDataURL('image/jpeg', 0.85)); 
            }; 
            img.src = ev.target.result; 
        }; 
        reader.readAsDataURL(file); 
    }); 
}