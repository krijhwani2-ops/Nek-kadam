import os
import time
import pywhatkit as kit

def send_card_to_whatsapp(phone="9827108110", image_path="opd_card_sample.png"):
    if not phone.startswith("+"):
        phone = f"+91{phone}"

    img_full_path = os.path.abspath(image_path)
    if not os.path.exists(img_full_path):
        print(f"Error: Image {img_full_path} not found!")
        return False

    message = """🙏 *नमस्ते जी,*
*नेक कदम क्लिनिक (Nek Kadam Clinical System)* की तरफ से आपका डिजिटल OPD कार्ड तैयार है।

📋 *कार्ड नंबर:* #7761
👤 *नाम:* VEENA MOTWANI
🔗 *डिजिटल पास लिंक:* https://nek-kadam.onrender.com/patients/7761

🏥 *कैंप में आने पर काउंटर पर यह QR कोड दिखाएं।*
(कृपया इस फोटो को अपने फोन में सुरक्षित रखें)"""

    print("=" * 60)
    print(f"Sending OPD Card to: {phone}")
    print(f"Image Attachment: {img_full_path}")
    print("=" * 60)
    print("Opening WhatsApp Web... (Make sure WhatsApp Web is linked on your browser)")

    try:
        # sendwhats_image(phone_no, img_path, caption, wait_time=15, tab_close=False, close_time=3)
        kit.sendwhats_image(phone, img_full_path, message, wait_time=15, tab_close=False)
        print("✅ Message and QR image dispatched successfully!")
        return True
    except Exception as e:
        print(f"❌ Error while sending: {e}")
        return False

if __name__ == "__main__":
    send_card_to_whatsapp("9827108110", "opd_card_sample.png")
