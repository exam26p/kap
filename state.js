// state.js
export const state = {
    db: null, // سيتم تعبئته لاحقاً بكائن Firebase
    activeTable: null,
    mySid: null,
    myUser: null,
    myVersion: null,
    dA: {}, dB: {}, dC: {}, dMsgA: {}, dRead: {}, dD: {}, dSessions: {}, dPrinters: {}, dUsers: {}, dVersions: {},
    routing: { kitchenPrinterIp: "", cashierPrinterIp: "" },
    settings: {
        restaurantName: "المطعم", orderSound: "sond1.mp3", msgSound: "sond2.mp3",
        printSound: "sond1.mp3", clickSound: "__click1", restaurantLogo: "", invoiceQrUrl: ""
    },
    pendingLogoData: null,
    lastStats: null,
    qrData: [],
    orderAlarm: null,
    msgAlarm: null,
    directCart: {},
    directMenuData: {},
    directAllItems: []
};
