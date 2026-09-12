import qrcode
from PIL import Image, ImageDraw, ImageFont
import os

def generate_digital_opd_card(card_no="7761", name="VEENA MOTWANI", phone="9827108110", output_path="opd_card_sample.png"):
    # QR code contains only the OPD ID (no website/URL link)
    qr_data = f"OPD-{card_no}"
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=10,
        border=2,
    )
    qr.add_data(qr_data)
    qr.make(fit=True)
    qr_img = qr.make_image(fill_color="#047857", back_color="white").convert("RGB")
    qr_img = qr_img.resize((340, 340))

    width, height = 800, 920
    card = Image.new("RGB", (width, height), "#F8FAFC")
    draw = ImageDraw.Draw(card)

    draw.rectangle([0, 0, width, 170], fill="#059669")
    
    try:
        font_title = ImageFont.truetype("arialbd.ttf", 36)
        font_sub = ImageFont.truetype("arial.ttf", 22)
        font_name = ImageFont.truetype("arialbd.ttf", 36)
        font_card = ImageFont.truetype("arialbd.ttf", 32)
        font_info = ImageFont.truetype("arial.ttf", 20)
        font_footer = ImageFont.truetype("arialbd.ttf", 22)
    except:
        font_title = ImageFont.load_default()
        font_sub = font_title
        font_name = font_title
        font_card = font_title
        font_info = font_title
        font_footer = font_title

    draw.text((width // 2, 55), "NEK KADAM CLINICAL SYSTEM", fill="white", font=font_title, anchor="mm")
    draw.text((width // 2, 115), "DIGITAL OPD REGISTRATION PASS", fill="#A7F3D0", font=font_sub, anchor="mm")

    draw.rounded_rectangle([40, 205, width - 40, height - 45], radius=24, fill="white", outline="#E2E8F0", width=2)

    draw.text((width // 2, 260), name.upper(), fill="#0F172A", font=font_name, anchor="mm")
    draw.rounded_rectangle([width // 2 - 140, 295, width // 2 + 140, 345], radius=16, fill="#ECFDF5", outline="#10B981", width=2)
    draw.text((width // 2, 320), f"OPD CARD: #{card_no}", fill="#065F46", font=font_card, anchor="mm")

    if phone:
        draw.text((width // 2, 375), f"Registered Mobile: +91 {phone}", fill="#64748B", font=font_info, anchor="mm")

    qr_x = (width - 340) // 2
    qr_y = 405
    draw.rounded_rectangle([qr_x - 12, qr_y - 12, qr_x + 352, qr_y + 352], radius=16, fill="white", outline="#059669", width=3)
    card.paste(qr_img, (qr_x, qr_y))

    draw.text((width // 2, 790), "Scan this QR at Reception / Doctor Desk", fill="#059669", font=font_footer, anchor="mm")
    draw.text((width // 2, 825), "Yeh QR code clinic me aane par counter par dikhayein", fill="#475569", font=font_info, anchor="mm")
    draw.text((width // 2, 855), "Nek Kadam Health Foundation", fill="#94A3B8", font=font_info, anchor="mm")

    card.save(output_path, quality=95)
    print(f"OPD Card saved successfully: {output_path}")

if __name__ == "__main__":
    generate_digital_opd_card("7761", "VEENA MOTWANI", "9827108110", "opd_card_sample.png")
