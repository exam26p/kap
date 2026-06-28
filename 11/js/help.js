// ============================================
// صفحة الدعم الفني
// ============================================

function toggleFaq(btn) {
    btn.classList.toggle('active');
    const answer = btn.nextElementSibling;
    answer.classList.toggle('open');
}

function callSupport() {
    // رقم الدعم الفني
    const number = '9647700000000';
    window.location.href = 'tel:' + number;
}