import json
import os
import time
import pywhatkit as kit
from create_patient_card import generate_digital_opd_card

def bulk_send(limit=10, delay_seconds=10):
    cards_dir = "generated_cards"
    os.makedirs(cards_dir, exist_ok=True)
    log_file = "data/sent_whatsapp_log.json"

    # Load sent log
    sent_log = set()
    if os.path.exists(log_file):
        try:
            with open(log_file, "r", encoding="utf-8") as f:
                sent_log = set(json.load(f))
        except Exception:
            sent_log = set()

    with open("data/sheet2_structured.json", "r", encoding="utf-8") as f:
        patients = json.load(f)

    sent_count = 0
    total_valid = [p for p in patients if len(str(p.get("phone") or "").strip().replace(" ", "").replace("-", "")) == 10 and str(p.get("phone") or "").strip().replace(" ", "").replace("-", "").isdigit()]
    remaining = [p for p in total_valid if str(p.get("card_number") or p.get("id")) not in sent_log]

    print(f"Total valid patients: {len(total_valid)} | Already sent: {len(sent_log)} | Remaining: {len(remaining)}")
    print(f"Starting batch (Batch size: {limit})...")

    for p in remaining:
        phone = str(p.get("phone") or "").strip().replace(" ", "").replace("-", "")
        card_no = str(p.get("card_number") or p.get("id") or "").strip()
        name = str(p.get("name") or "Patient").strip()

        target_phone = f"+91{phone}"
        img_file = os.path.join(cards_dir, f"opd_{card_no}.png")

        # 1. Generate OPD Card (Pure QR, No Web Link)
        generate_digital_opd_card(card_no=card_no, name=name, phone=phone, output_path=img_file)

        # 2. Caption (Pure QR / Pass info, NO links)
        caption = f"OPD Pass - {name.upper()} (#{card_no})"

        print(f"[{sent_count+1}/{limit}] Sending to {name} (#{card_no}, {target_phone})...")
        try:
            kit.sendwhats_image(target_phone, os.path.abspath(img_file), caption, wait_time=14, tab_close=True, close_time=3)
            sent_count += 1
            sent_log.add(card_no)
            with open(log_file, "w", encoding="utf-8") as f:
                json.dump(list(sent_log), f, indent=2)
            print(f"✅ Dispatched to {target_phone}. Waiting {delay_seconds}s...")
            time.sleep(delay_seconds)
        except Exception as e:
            print(f"❌ Error sending to {target_phone}: {e}")

        if sent_count >= limit:
            print(f"\n🎉 Batch limit of {limit} reached. Total sent so far: {len(sent_log)}.")
            break

if __name__ == "__main__":
    import sys
    count = int(sys.argv[1]) if len(sys.argv) > 1 else 10
    bulk_send(limit=count)
