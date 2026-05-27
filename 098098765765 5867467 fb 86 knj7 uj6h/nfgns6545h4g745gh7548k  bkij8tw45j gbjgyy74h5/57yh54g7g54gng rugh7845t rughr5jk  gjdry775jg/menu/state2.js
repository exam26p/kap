// state2.js
// كائن الحالة العامة للتطبيق - نسخة مبسطة للمشروع الحالي
export const state = {
    // معلومات الجلسة الحالية
    activeTable: null,
    myVersion: null,
    
    // بيانات Firebase (سيتم تعبئتها لاحقاً)
    ordersData: {},
    menuData: {},
    
    // إعدادات التطبيق
    settings: {
        restaurantName: "المطعم",
        restaurantLogo: "",
        orderSound: "sond1.mp3",
        msgSound: "sond2.mp3",
        printSound: "sond1.mp3",
        clickSound: "__click1",
        invoiceQrUrl: ""
    },
    
    // حالة التطبيق
    isMenuLoaded: false,
    isGeoVerified: false,
    
    // إعدادات الصوت
    orderAlarm: null,
    msgAlarm: null,
    
    // بيانات إضافية للتوسعات المستقبلية
    directCart: {},
    directMenuData: {},
    directAllItems: []
};