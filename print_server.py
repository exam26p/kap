from flask import Flask, request, jsonify
from flask_cors import CORS
import base64
from PIL import Image, ImageWin
import io
import win32print
import win32ui
import win32con
import os
import tempfile

app = Flask(__name__)

# إعداد CORS الشامل للسماح بطلبات الفرونت إند من أي مكان
CORS(app, resources={r"/*": {"origins": "*"}})

@app.route('/api/ping-printer', methods=['POST'])
def ping_printer():
    data = request.json
    printer_name = data.get('printerName')
    
    if not printer_name:
        return jsonify({"status": "error", "message": "اسم الطابعة مفقود"}), 400
    
    try:
        PRINTER_STATUS_OFFLINE = 0x0080
        PRINTER_STATUS_NOT_AVAILABLE = 0x1000
        
        handle = win32print.OpenPrinter(printer_name)
        printer_info = win32print.GetPrinter(handle, 2)
        status = printer_info['Status']
        win32print.ClosePrinter(handle)
        
        if status == 0:
            return jsonify({"status": "online", "message": f"🟢 الطابعة [{printer_name}] متصلة وجاهزة!"}), 200
        elif status & (PRINTER_STATUS_OFFLINE | PRINTER_STATUS_NOT_AVAILABLE):
            return jsonify({"status": "offline", "message": f"🔴 الطابعة [{printer_name}] غير متصلة حالياً (Offline)."}), 200
        else:
            return jsonify({"status": "online", "message": f"🟡 الطابعة [{printer_name}] متصلة لكن بحالة خاصة (كود: {status})"}), 200
            
    except Exception as e:
        return jsonify({"status": "error", "message": f"🔴 الطابعة غير موجودة أو خطأ: {str(e)}"}), 200


@app.route('/api/get-printers', methods=['GET'])
def get_printers():
    try:
        printers = []
        for p in win32print.EnumPrinters(win32print.PRINTER_ENUM_LOCAL | win32print.PRINTER_ENUM_CONNECTIONS):
            printers.append(p[2])
        
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
    # جلب اسم الطابعة من الفرونت إند
    printer_name = data.get('printerName') or data.get('ip')
    image_base64 = data.get('image')

    if not printer_name or not image_base64:
        return jsonify({"status": "error", "message": "بيانات الطباعة ناقصة!"}), 400

    try:
        # 1. فك تشفير الصورة القادمة من جافا سكريبت الـ Canvas
        img_data = base64.b64decode(image_base64.split(',')[1] if ',' in image_base64 else image_base64)
        image = Image.open(io.BytesIO(img_data))
        
        # تحويل الخلفية الشفافة (RGBA) إلى بيضاء (RGB) لمنع ظهور مساحات أو بقع سوداء في الطباعة الحرارية
        if image.mode == 'RGBA':
            background = Image.new("RGB", image.size, (255, 255, 255))
            background.paste(image, mask=image.split()[3]) 
            image = background
        elif image.mode != 'RGB':
            image = image.convert('RGB')

        # 2. طريقة الطباعة الاحترافية والذكية عبر تتبع أبعاد الطابعة الفعليه لمنع التقطيع والقص الجانبي
        try:
            hDC = win32ui.CreateDC()
            hDC.CreatePrinterDC(printer_name)
            
            # جلب العرض الحقيقي القابل للطباعة من الطابعة نفسها بالبكسل لتفادي القص والتشويه الجانبي
            printable_width = hDC.GetDeviceCaps(win32con.HORZRES)
            
            # حساب الأبعاد بدقة هندسية متناسقة للحفاظ على نسبة الطول إلى العرض (Aspect Ratio) لكي لا تبدو الفاتورة مطاطية
            img_width, img_height = image.size
            ratio = printable_width / float(img_width)
            scaled_width = int(printable_width)
            scaled_height = int(img_height * ratio)
            
            # تهيئة مستند الطباعة الخاص بالويندوز
            hDC.StartDoc("Restaurant POS Receipt")
            hDC.StartPage()

            dib = ImageWin.Dib(image)
            
            # الرسم المباشر من النقطة (0,0) إلى الحواف والحدودالفعليه للبكرة دون أي زيادة تسبب فراغات بيضاء
            dib.draw(hDC.GetHandleOutput(), (0, 0, scaled_width, scaled_height))

            hDC.EndPage()
            hDC.EndDoc()
            hDC.DeleteDC()

            return jsonify({"status": "success", "message": f"تمت الطباعة بنجاح على {printer_name}!"}), 200
            
        except Exception as e:
            # في حال فشل الطريقة المباشرة (تحدث مع بعض الطابعات الصينية أو عدم توافق التعريفات) ننتقل لطريقة الطوارئ
            print(f"Primary Print failed, trying Raw Native Print: {str(e)}")
            
            # حفظ الفاتورة مؤقتاً كملف بيتماب مخصص
            with tempfile.NamedTemporaryFile(delete=False, suffix=".bmp") as tmp_file:
                tmp_path = tmp_file.name
                image.save(tmp_path, "BMP")
            
            try:
                # حفظ الطابعة الافتراضية للويندوز وتعيين طابعة الفاتورة مؤقتاً
                current_default = win32print.GetDefaultPrinter()
                win32print.SetDefaultPrinter(printer_name)
                
                # إصدار أمر طباعة صامت ومباشر عبر الـ API للنظام
                import win32api
                win32api.ShellExecute(0, "print", tmp_path, f'"{printer_name}"', ".", 0)
                
                # مهلة صغيرة ليتلقى الـ Spooler الملف كاملاً ثم استرجاع الطابعة الافتراضية
                import time
                time.sleep(1.5)
                win32print.SetDefaultPrinter(current_default)
                
            except Exception as api_err:
                print(f"API Print Error: {str(api_err)}")
                return jsonify({"status": "error", "message": f"فشلت جميع طرق الطباعة: {str(api_err)}"}), 500
            finally:
                # حذف ملف الطوارئ المؤقت فوراً لتوفير مساحة القرص
                try:
                    os.remove(tmp_path)
                except:
                    pass

            return jsonify({"status": "success", "message": f"تمت الطباعة (Backup Mode) على {printer_name}!"}), 200

    except Exception as e:
        print(f"Global Printing Error: {str(e)}")
        return jsonify({"status": "error", "message": f"فشل الطباعة العام: {str(e)}"}), 500

if __name__ == '__main__':
    print("=============================================================")
    print(" 🖨️ Windows Thermal Print Server is running on port 5000")
    print("=============================================================")
    app.run(host='0.0.0.0', port=5000, debug=False)
