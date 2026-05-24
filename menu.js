// menu/menu.js
import * as DB from './db.js';
import { fmt } from './utils.js';

/* منع التحديد والضغط المستمر */
document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('gesturestart', e => e.preventDefault());

let TBL="",VER="",zone=null,watchID=null,restName="",restLogo="";
let orders={},menuOk=false,chatOn=false,unreadN=0;
let curLat=null,curLon=null,curDist=null,isInZone=false;
let prevMsgCount=0;
const menuLookup={};
const CIRC=2*Math.PI*42;

function toast(m,t){
    t=t||"info";var c=document.getElementById("tw");
    var icons={success:"fa-circle-check",error:"fa-circle-xmark",info:"fa-circle-info"};
    var el=document.createElement("div");el.className="ts "+t;
    el.innerHTML='<i class="fas '+(icons[t]||icons.info)+'"></i> '+m;
    c.appendChild(el);setTimeout(function(){if(el.parentNode)el.remove()},3200);
}

function haversine(a,b,c,d){
    var R=6371000,dL=(c-a)*Math.PI/180,dN=(d-b)*Math.PI/180;
    var x=Math.sin(dL/2)*Math.sin(dL/2)+Math.cos(a*Math.PI/180)*Math.cos(c*Math.PI/180)*Math.sin(dN/2)*Math.sin(dN/2);
    return R*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));
}

/* الصوت */
var aC=new(window.AudioContext||window.webkitAudioContext)();
var lClk=0;
function cSnd(){
    var n=Date.now();if(n-lClk<80)return;lClk=n;
    try{if(aC.state==="suspended")aC.resume();
    var o=aC.createOscillator(),g=aC.createGain();o.connect(g);g.connect(aC.destination);
    o.type="sine";o.frequency.setValueAtTime(600+Math.random()*400,aC.currentTime);
    g.gain.setValueAtTime(0.015,aC.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001,aC.currentTime+0.05);
    o.start(aC.currentTime);o.stop(aC.currentTime+0.05)}catch(e){}
}
function addSnd(el){if(el)el.addEventListener("click",cSnd,{passive:true})}

function msgSnd(){
    try{if(aC.state==="suspended")aC.resume();
    var now=aC.currentTime;
    [0,0.15,0.3].forEach(function(d,i){
        var o=aC.createOscillator(),g=aC.createGain();o.connect(g);g.connect(aC.destination);
        o.type="sine";o.frequency.setValueAtTime([660,880,1100][i],now+d);
        g.gain.setValueAtTime(0.06,now+d);
        g.gain.exponentialRampToValueAtTime(0.001,now+d+0.12);
        o.start(now+d);o.stop(now+d+0.12)})}catch(e){}
}

/* تحميل إعدادات التطبيق الموحدة */
async function loadAppSettings(){
    try{
        var data = await DB.getData("app_settings");
        if(!data.exists()) return;
        var val = data.val();
        if(val.restaurantName&&val.restaurantName.trim()){
            restName=val.restaurantName.trim();
            document.title=restName;
            document.getElementById("splashTitle").textContent=restName;
        }
        if(val.restaurantLogo&&val.restaurantLogo.length>20){
            restLogo=val.restaurantLogo;
            var splashLogo=document.getElementById("splashLogo");
            if(splashLogo){
                splashLogo.innerHTML='<img src="'+restLogo+'" onerror="this.parentNode.innerHTML=\'🍽\'" alt="">';
            }
            var fav=document.querySelector('link[rel="icon"]');
            if(fav) fav.href=restLogo;
        }
    }catch(e){}
}

function updateHeader(){
    var h=document.getElementById("headerTitle");
    if(restLogo&&restLogo.length>20){
        h.innerHTML='<img src="'+restLogo+'" alt="" onerror="this.style.display=\'none\'"> '+restName;
    }else{
        h.textContent=restName||'المنيو الرقمي';
    }
}

var progBar=document.getElementById("progBar");var progPct=document.getElementById("progPct");var progVal=0;
var progInterval=setInterval(function(){
    progVal+=Math.random()*8+2;if(progVal>100)progVal=100;
    progBar.style.strokeDashoffset=CIRC-(progVal/100)*CIRC;
    progPct.textContent=Math.round(progVal)+"%";
    if(progVal>=100){clearInterval(progInterval);document.getElementById("splashBtn").classList.add("show")}
},200);

function bindEvents(){
    var splashBtn=document.getElementById("splashBtn");addSnd(splashBtn);
    splashBtn.addEventListener("click",dismissSplash);
    var bibBtn=document.getElementById("bibBtn");addSnd(bibBtn);
    bibBtn.addEventListener("click",function(){document.getElementById("invoiceModal").style.display="flex"});
    var invClose=document.getElementById("invClose");addSnd(invClose);
    invClose.addEventListener("click",closeInv);
    document.getElementById("invoiceModal").addEventListener("click",function(e){if(e.target.id==="invoiceModal")closeInv()});
    var btnSend=document.getElementById("btnSend");addSnd(btnSend);
    btnSend.addEventListener("click",sendOrd);
    var msgFab=document.getElementById("msgFab");addSnd(msgFab);
    msgFab.addEventListener("click",openCh);
    var chatClose=document.getElementById("chatClose");addSnd(chatClose);
    chatClose.addEventListener("click",closeCh);
    document.getElementById("chatModal").addEventListener("click",function(e){if(e.target.id==="chatModal")closeCh()});
    var chatSendBtn=document.getElementById("chatSendBtn");addSnd(chatSendBtn);
    chatSendBtn.addEventListener("click",sendCh);
    document.getElementById("chatInput").addEventListener("keydown",function(e){if(e.key==="Enter")sendCh()});
    
    document.getElementById("imgModalClose").addEventListener("click", closeImgModal);
    document.getElementById("imgModal").addEventListener("click", function(e){if(e.target.id==="imgModal")closeImgModal()});
}

function dismissSplash(){
    document.getElementById("splashScreen").classList.add("hide");
    setTimeout(function(){
        document.getElementById("splashScreen").style.display="none";
        document.getElementById("blockScreen").style.display="flex";
        updateHeader();
        setTimeout(function(){initGeo()},100);
    },600);
}

async function initGeo(){
    var u=new URLSearchParams(location.search);TBL=u.get("table")||"1";VER=u.get("version")||"";
    document.getElementById("tblB").textContent="طاولة "+TBL;
    if(!VER){sGeo("err","\u26a0\ufe0f","إصدار غير صالح","لم يتم العثور على ربط للصفحة.");return}
    sGeo("ld","\ud83d\udd04","جاري التحقق...","نبحث عن النطاق الجغرافي.");
    try{
        var snap=await DB.getData("cobes");var all=snap.val();
        if(!all){sGeo("err","\ud83d\udccb","لا توجد نطاقات","لم يتم تسجيل أي نطاق جغرافي.");return}
        var found=null;for(var id in all){if(all[id].version_number===VER){found=all[id];break}}
        if(!found){sGeo("err","\ud83d\udeab","إصدار غير صالح",'الإصدار "v'+VER+'" غير موجود.');return}
        zone=found.geo_zone;
        if(!zone||!zone.center_latitude){sGeo("err","\ud83d\udccd","بيانات ناقصة","الإصدار موجود لكن بدون إحداثيات.");return}
        sGeo("wait","\u2705","تم التحقق","جاري تتبع موقعك لحظياً.");
        startW();
    }catch(e){sGeo("err","\ud83d\udce1","خطأ في الاتصال","تعذر الاتصال حالياً.")}
}

function sGeo(ic,i,t,m){var el=document.getElementById("geoIcon");el.className="geo-icon "+ic;el.innerHTML=i;document.getElementById("geoTitle").textContent=t;document.getElementById("geoMsg").textContent=m;document.getElementById("geoDist").style.display="none";document.getElementById("geoBlocked").style.display="none"}

function startW(){if(!navigator.geolocation){document.getElementById("geoCard").style.display="none";document.getElementById("geoBlocked").style.display="block";return}watchID=navigator.geolocation.watchPosition(onP,onE,{enableHighAccuracy:true,timeout:15000,maximumAge:0})}

function onP(pos){
    curLat=pos.coords.latitude;curLon=pos.coords.longitude;
    curDist=haversine(curLat,curLon,zone.center_latitude,zone.center_longitude);
    var rad=zone.radius_meters||100;
    updateDistBar(curDist,rad);
    if(curDist<=rad){
        if(!isInZone){isInZone=true;document.getElementById("blockScreen").style.display="none";document.getElementById("kickScreen").style.display="none";document.getElementById("menuContent").style.display="block";document.getElementById("bottomBar").style.display="flex";document.getElementById("distBar").style.display="block";if(!menuOk)initMenu()}
    }else if(curDist<=rad*2){
        if(isInZone){isInZone=false;document.getElementById("menuContent").style.display="none";document.getElementById("bottomBar").style.display="none";document.getElementById("distBar").style.display="none";document.getElementById("blockScreen").style.display="flex";sGeo("err","\ud83d\udeab","خارج النطاق","اقترب أكثر من المطعم.")}
        var dEl=document.getElementById("geoDist");dEl.style.display="block";dEl.className="geo-dist out";dEl.innerHTML='<i class="fas fa-triangle-exclamation" style="margin-left:5px;"></i><b>خارج النطاق المسموح</b>';
    }else{
        if(!document.getElementById("kickScreen").style.display||document.getElementById("kickScreen").style.display==="none"){isInZone=false;document.getElementById("menuContent").style.display="none";document.getElementById("bottomBar").style.display="none";document.getElementById("distBar").style.display="none";document.getElementById("blockScreen").style.display="none";document.getElementById("kickScreen").style.display="flex"}
    }
}

function onE(){document.getElementById("geoCard").style.display="none";document.getElementById("geoBlocked").style.display="block"}

function updateDistBar(dist,radius){
    var proximity=Math.max(0,Math.min(100,(1-dist/radius)*100));
    var fill=document.getElementById("distFill");var val=document.getElementById("distValue");
    fill.style.width=proximity+"%";
    var r,g,b;
    if(proximity>=50){var t=(proximity-50)/50;r=Math.round(180-(180-74)*t);g=Math.round(60+(124-60)*t);b=Math.round(60+(89-60)*t)}
    else{var t2=proximity/50;r=Math.round(184+(180-184)*t2);g=Math.round(80-20*t2);b=Math.round(80-20*t2)}
    var color="rgb("+r+","+g+","+b+")";fill.style.background=color;
    val.textContent=Math.round(proximity)+"%";val.style.color=color;
}

/* === تحميل المنيو بالتصميم الجديد === */
function initMenu(){
    menuOk=true;
    DB.listenOrders(function(data){
        var c=document.getElementById("menuCats");c.innerHTML="";
        for(var key in menuLookup){delete menuLookup[key]}
        if(!data){c.innerHTML='<p style="color:var(--text-muted);padding:30px;text-align:center;font-size:13px;">المنيو فارغ حالياً.</p>';return}
        var catIndex=0;
        for(var catId in data){
            catIndex++;
            var cat=data[catId];var items=cat.items||{};var cnt=Object.keys(items).length;var itemHTML="";
            for(var itemId in items){
                var it=items[itemId];
                menuLookup[catId+"_"+itemId]={name:it.name,price:it.price};
                var detId="det_"+catId+"_"+itemId;
                var details=it.details||"";
                var hasDetails=details&&details.trim().length>0;
                var imgSrc=it.image||"";

                /* بناء HTML الصنف الجديد الكبير */
                itemHTML+='<div class="item-card">'+
                    '<div class="item-img-container" onclick="window.openImage(\''+imgSrc+'\')">'+
                        (imgSrc?'<img src="'+imgSrc+'" alt="" loading="'+(catIndex<=1?'eager':'lazy')+'" onerror="this.style.opacity=0">':'')+
                        '<div class="item-overlay">'+
                            '<div class="item-name">'+it.name+'</div>'+
                            '<div class="item-meta">'+
                                '<span class="item-price">'+fmt(it.price)+' د.ع</span>'+
                            '</div>'+
                        '</div>'+
                    '</div>'+
                    (hasDetails?'<div class="item-det-wrap" id="'+detId+'"><div class="item-det-inner"><div class="item-det-text">'+details+'</div></div></div>':'')+
                    '<div class="item-actions-bar">'+
                        (hasDetails?'<button class="det-btn" data-target="'+detId+'"><i class="fas fa-info-circle"></i> التفاصيل</button>':'<div></div>')+
                        '<button class="ba" data-c="'+catId+'" data-i="'+itemId+'"><i class="fas fa-plus"></i> طلب</button>'+
                    '</div>'+
                '</div>';
            }
            var catImg=cat.image||"";
            var hasImg=catImg&&catImg.length>10;
            var acc=document.createElement("div");acc.className="cat-acc";
            var imgPart=hasImg?'<img src="'+catImg+'" alt="" loading="eager" style="opacity:0;transition:opacity .4s" onload="this.style.opacity=1">':'<div class="cat-hd-fallback">\ud83c\udf7d</div>';
            acc.innerHTML='<div class="cat-hd">'+imgPart+'<div class="cat-hd-content"><div class="cat-hi"><h3>'+cat.name+'</h3><span class="cc">'+cnt+' صنف</span></div><i class="fas fa-chevron-down cat-arr"></i></div></div><div class="cat-bd">'+itemHTML+'</div>';
            c.appendChild(acc);
        }

        /* ربط الأحداث بعد الإنشاء */
        c.querySelectorAll(".ba").forEach(function(btn){
            addSnd(btn);
            btn.addEventListener("click",function(){
                var cId=this.getAttribute("data-c"),iId=this.getAttribute("data-i");
                var item=menuLookup[cId+"_"+iId];
                if(item)addIt(cId,iId,item.name,item.price);
            });
        });
        c.querySelectorAll(".det-btn").forEach(function(btn){
            addSnd(btn);
            btn.addEventListener("click",function(){
                var target=document.getElementById(this.getAttribute("data-target"));
                if(target){
                    var isOpen=target.classList.toggle("open");
                    this.classList.toggle("active",isOpen);
                    this.innerHTML=isOpen?'<i class="fas fa-chevron-up"></i> إغلاق':'<i class="fas fa-info-circle"></i> التفاصيل';
                }
            });
        });
        c.querySelectorAll(".cat-hd").forEach(function(hd){
            addSnd(hd);
            hd.addEventListener("click",function(){
                var wasOpen=hd.parentElement.classList.contains("open");
                document.querySelectorAll(".cat-acc.open").forEach(function(a){a.classList.remove("open")});
                if(!wasOpen)hd.parentElement.classList.add("open");
            });
        });
    });
    listenOrd();listenCh();
}

function addIt(cId,iId,name,price){
    var k=cId+"_"+iId;var r="table_"+TBL+"/current_orders/"+k;
    if(orders[k]){DB.updateData(r,{quantity:orders[k].quantity+1})}
    else{DB.setData(r,{name:name,price:price,quantity:1})}
}

/* === الاستماع للطلبات === */
function listenOrd(){
    var tk="table_"+TBL;
    DB.listenTablesB(function(d){
        orders=d||{};var total=0,count=0;var ic=document.getElementById("invItems");
        if(!d){
            ic.innerHTML='<p style="color:var(--text-muted);text-align:center;padding:20px;font-size:13px;">لا توجد طلبات معلقة.</p>';
            document.getElementById("btnSend").disabled=true;
            document.getElementById("barCount").textContent="\u0660";
            document.getElementById("barTotal").innerHTML='الإجمالي: <span>\u0660 دينار</span>';
            document.getElementById("invTotal").textContent="الإجمالي: \u0660 دينار";
            return;
        }
        document.getElementById("btnSend").disabled=false;ic.innerHTML="";
        for(var k in d){
            var it=d[k];var sub=it.price*it.quantity;total+=sub;count+=it.quantity;
            var row=document.createElement("div");row.className="inv-i";
            row.innerHTML='<div style="min-width:0;flex:1"><div class="inv-n">'+it.name+'</div><div class="inv-s">'+fmt(it.price)+' د.ع \u00d7 '+it.quantity+'</div></div><div style="display:flex;align-items:center;gap:6px;flex-shrink:0"><span class="inv-t">'+fmt(sub)+'</span><div class="qc"><button class="qb qmin" data-key="'+k+'" data-d="-1">\u2212</button><span class="qv">'+it.quantity+'</span><button class="qb qplu" data-key="'+k+'" data-d="1">+</button></div></div>';
            ic.appendChild(row);
        }
        ic.querySelectorAll(".qb").forEach(function(qb){
            addSnd(qb);
            qb.addEventListener("click",function(){
                var k=this.getAttribute("data-key");var dd=parseInt(this.getAttribute("data-d"));
                var r="table_"+TBL+"/current_orders/"+k;
                var n=orders[k].quantity+dd;
                if(n<=0){DB.removeData(r)}else{DB.updateData(r,{quantity:n})}
            });
        });
        document.getElementById("barCount").textContent=count;
        document.getElementById("barTotal").innerHTML='الإجمالي: <span>'+fmt(total)+' دينار</span>';
        document.getElementById("invTotal").textContent="الإجمالي: "+fmt(total)+" دينار";
    });
    DB.listenMsgA(function(d){
        var c=document.getElementById("sentItems");
        if(!d){c.innerHTML='<p style="color:var(--text-muted);font-size:12px;">لا توجد.</p>';return}
        c.innerHTML="";
        for(var k in d){var it=d[k];c.innerHTML+='<div class="si"><span>\u2022 '+it.name+' (\u00d7'+it.quantity+')</span><span style="color:var(--text-muted);font-size:11px;">'+fmt(it.price*it.quantity)+' د.ع</span></div>'}
    });
}

function sendOrd(){
    if(!Object.keys(orders).length)return;
    if(!navigator.onLine){toast("لا يوجد اتصال بالإنترنت.","error");return}
    if(curLat===null||curLon===null){toast("جاري تحديد موقعك...","error");return}
    if(!zone||!zone.center_latitude){toast("بيانات النطاق غير متوفرة.","error");return}
    var dist=haversine(curLat,curLon,zone.center_latitude,zone.center_longitude);var rad=zone.radius_meters||100;
    if(dist>rad){toast("أنت خارج المنطقة.","error");return}
    var sr="tablesB/table_"+TBL+"/sent_orders";
    for(var k in orders){var it=orders[k];DB.pushData(sr,{name:it.name,price:it.price,quantity:it.quantity,settled_by:"customer",settled_at:new Date().toISOString(),sent_distance:Math.round(dist)})}
    DB.removeData("table_"+TBL+"/current_orders").then(function(){toast("تم إرسال طلباتك بنجاح","success");closeInv()}).catch(function(){toast("حدث خطأ أثناء الإرسال.","error")});
}

function closeInv(){document.getElementById("invoiceModal").style.display="none"}

/* === محادثة الكاشير === */
function listenCh(){
    var tk="table_"+TBL;
    DB.listenTableChat(tk, function(sA, sB){
        if(!chatOn)return;var box=document.getElementById("chatMsgs");box.innerHTML="";var msgs=[];
        if(sA) for(var k in sA){var m=sA[k];m.src="client";msgs.push(m)}
        if(sB) for(var k2 in sB){var m2=sB[k2];m2.src="cashier";msgs.push(m2)}
        msgs.sort(function(a,b){return new Date(a.timestamp)-new Date(b.timestamp)});
        if(!msgs.length){box.innerHTML='<p style="color:var(--text-muted);text-align:center;padding:20px;font-size:13px;">ابدأ المحادثة مع الكاشير.</p>';return}
        for(var j=0;j<msgs.length;j++){var msg=msgs[j];var t=new Date(msg.timestamp).toLocaleTimeString("ar-IQ",{hour:"2-digit",minute:"2-digit"});box.innerHTML+='<div class="cm '+(msg.src==="client"?"cm-cl":"cm-ca")+'">'+msg.text+'<div class="cm-t">'+t+'</div></div>'}
        box.scrollTop=box.scrollHeight;
        
        var newCount = sB ? Object.keys(sB).length : 0;
        if(newCount>prevMsgCount&&prevMsgCount>0) msgSnd();
        if(!chatOn) prevMsgCount=newCount;
        showUnread(newCount);
    });
    updUnread(0);
}

function updUnread(count){
    if(count===undefined){DB.getData("msgB/table_"+TBL).then(s=>{var d=s.val();var c=0;if(d)c=Object.keys(d).length;showUnread(c);prevMsgCount=c});return}
    showUnread(count);prevMsgCount=count;
}

function showUnread(c){
    var dot=document.getElementById("msgDot");
    if(c>0){dot.style.display="flex";dot.textContent=c>9?"9+":String(c)}else{dot.style.display="none"}
    unreadN=c;
}

function openCh(){chatOn=true;unreadN=0;document.getElementById("msgDot").style.display="none";document.getElementById("chatModal").style.display="flex";prevMsgCount=0}
function closeCh(){chatOn=false;document.getElementById("chatModal").style.display="none"}
function sendCh(){var inp=document.getElementById("chatInput");var t=inp.value.trim();if(!t)return;DB.pushData("msgA/table_"+TBL,{text:t,timestamp:new Date().toISOString()});inp.value=""}

// دوال تكبير الصورة
window.openImage = function(src){
    if(!src) return;
    var modal = document.getElementById("imgModal");
    var img = document.getElementById("imgModalImg");
    img.src = src;
    modal.style.display = "flex";
}

window.closeImgModal = function(){
    document.getElementById("imgModal").style.display = "none";
}

document.addEventListener("click",function(){if(aC.state==="suspended")aC.resume()},{once:true});
bindEvents();
loadAppSettings();
