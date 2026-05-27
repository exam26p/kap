// utils2.js
// دالة تنسيق الأرقام (إضافة فواصل الآلاف)
export const fmt = n => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");

// دالة عرض الإشعارات (Toast)
export function toast(m, t) {
    t = t || "info";
    var c = document.getElementById("tw");
    var icons = { success: "fa-circle-check", error: "fa-circle-xmark", info: "fa-circle-info" };
    var el = document.createElement("div");
    el.className = "ts " + t;
    el.innerHTML = '<i class="fas ' + (icons[t] || icons.info) + '"></i> ' + m;
    c.appendChild(el);
    setTimeout(function() { if (el.parentNode) el.remove(); }, 3200);
}

// دالة حساب المسافة بين نقطتين (هافرسين)
export function haversine(a, b, c, d) {
    var R = 6371000,
        dL = (c - a) * Math.PI / 180,
        dN = (d - b) * Math.PI / 180;
    var x = Math.sin(dL / 2) * Math.sin(dL / 2) +
        Math.cos(a * Math.PI / 180) * Math.cos(c * Math.PI / 180) *
        Math.sin(dN / 2) * Math.sin(dN / 2);
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}