from flask import Flask, request, jsonify
from flask_cors import CORS
import base64
from PIL import Image, ImageWin
import io
import win32print
import win32ui

app = Flask(__name__)

# إعداد CORS للسماح بجميع الطلبات من أي مصدر (لحل مشكلة منع المتصفح للطلبات)
CORS(app, resources={r"/*": {"origins": "*"}})

@app.route('/api/ping-printer', methods=['POST'])
def ping_printer():
    data = request.json
    # استقبال اسم الطابعة بدلاً من الـ IP
    printer_name = data.get('printerName')
    
    if not printer_name:
        return jsonify({"status": "error", "message": "اسم الطابعة مفقود"}), 400
    
    try:
        # فحص حالة الطابعة مباشرة عبر مكتبة الويندوز (win32print)
        PRINTER_STATUS_OFFLINE = 128
        PRINTER_STATUS_NOT_AVAILABLE = 4096
        
        handle = win32print.OpenPrinter(printer_name)
        printer_info = win32print.GetPrinter(handle, 2)
        status = printer_info['Status']
        win32print.ClosePrinter(handle)
        
        # تحليل حالة الطابعة
        if status == 0:
            return jsonify({"status": "online", "message": f"🟢 الطابعة [{printer_name}] متصلة وجاهزة!"}), 200
        elif status & (PRINTER_STATUS_OFFLINE | PRINTER_STATUS_NOT_AVAILABLE):
            return jsonify({"status": "offline", "message": f"🔴 الطابعة [{printer_name}] غير متصلة حالياً (Offline)."}), 200
        else:
            # حالات أخرى مثل انقطاع الورق أو فتح الغطاء (متصلة ولكن بحاجة تدخل)
            return jsonify({"status": "online", "message": f"🟡 الطابعة [{printer_name}] متصلة لكن بحالة خاصة (كود: {status})"}), 200
            
    except Exception as e:
        # في حال كانت الطابعة غير معرفة أساساً في الويندوز
        return jsonify({"status": "error", "message": f"🔴 الطابعة غير موجودة أو خطأ: {str(e)}"}), 200


@app.route('/api/get-printers', methods=['GET'])
def get_printers():
    """جلب قائمة بجميع الطابعات المثبتة على جهاز الويندوز"""
    try:
        printers = []
        # جلب أسماء الطابعات المحلية والمتصلة عبر الشبكة
        for printer_info in win32print.EnumPrinters(win32print.PRINTER_ENUM_LOCAL | win32print.PRINTER_ENUM_CONNECTIONS):
            printers.append(printer_info[2]) # الاسم موجود في المؤشر 2
        
        # إضافة الطابعة الافتراضية إن لم تكن مضافة للقائمة
        try:
            default_printer = win32print.GetDefaultPrinter()
            if default_printer not in printers:
                printers.append(default_printer)
        except:
            pass

        return jsonify({"status": "success", "printers": printers}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route('/print-receipt', methods=['POST'])
def print_receipt():
    data = request.json
    printer_name = data.get('printerName') # استقبال اسم الطابعة
    image_base64 = data.get('image')

    if not printer_name or not image_base64:
        return jsonify({"status": "error", "message": "بيانات الطباعة ناقصة (اسم الطابعة أو الصورة)!"}), 400

    try:
        # 1. تحويل نص الـ Base64 إلى كائن صورة
        img_data = base64.b64decode(image_base64.split(',')[1] if ',' in image_base64 else image_base64)
        image = Image.open(io.BytesIO(img_data))
        
        # 2. تصغير الصورة لعرض ورق الطابعة الحرارية (576 بكسل لورق 72mm)
        max_width = 576 
        if image.width > max_width:
            w_percent = (max_width / float(image.width))
            h_size = int((float(image.height) * float(w_percent)))
            image = image.resize((max_width, h_size), Image.Resampling.LANCZOS)
        
        # تحويل الصورة لـ RGB إذا كانت تحتوي على قناة شفافية (RGBA)
        if image.mode == 'RGBA':
            image = image.convert('RGB')

        # 3. الطباعة باستخدام Windows API
        hDC = win32ui.CreateDC()
        hDC.CreatePrinterDC(printer_name)
        
        # الحصول على أبعاد الورق المتاحة في الطابعة
        printable_area = hDC.GetDeviceCaps(win32print.HORZRES), hDC.GetDeviceCaps(win32print.VERTRES)
        
        hDC.StartDoc("Restaurant Receipt")
        hDC.StartPage()

        # رسم الصورة على الـ DC الخاص بالطابعة
        dib = ImageWin.Dib(image)
        
        # حساب الحجم ليتناسب مع عرض الورقة مع الحفاظ على النسبة
        img_width, img_height = image.size
        ratio = printable_area[0] / img_width
        scaled_width = int(img_width * ratio)
        scaled_height = int(img_height * ratio)
        
        dib.draw(hDC.GetHandleOutput(), (0, 0, scaled_width, scaled_height))

        hDC.EndPage()
        hDC.EndDoc()
        hDC.DeleteDC()

        return jsonify({"status": "success", "message": f"تمت الطباعة بنجاح على {printer_name}!"}), 200
        
    except Exception as e:
        print(f"Printing Error: {str(e)}")
        return jsonify({"status": "error", "message": f"فشل الطباعة: {str(e)}"}), 500

if __name__ == '__main__':
    print("=============================================================")
    print(" 🖨️ Windows Print Server is running on port 5000")
    print("=============================================================")
    app.run(host='0.0.0.0', port=5000)