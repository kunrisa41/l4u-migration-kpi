// Food Amigo training guides (assets live in the private Supabase bucket "guides")
export const AMIGO_GUIDES = [
{
"id": "create-store",
"title": "How to Create Account",
"sub": "สร้างร้านใหม่ใน Restaurant Portal (ตัวอย่าง: Charng Thai Restaurant, Hackensack)",
"video": "amigo/create-store/video.mp4",
"mins": 8,
"sections": [
{
"t": "เตรียมข้อมูล",
"from": 1,
"to": 6
},
{
"t": "สร้างร้าน & Launch 8 ขั้น",
"from": 7,
"to": 23
},
{
"t": "ตั้งค่าร้านเพิ่มเติม",
"from": 24,
"to": 33
},
{
"t": "สร้างเว็บไซต์",
"from": 34,
"to": 41
}
],
"steps": [
{
"n": 1,
"t": "เปิดเครื่องมือที่ต้องใช้",
"d": "เปิด Chrome › All Bookmarks › โฟลเดอร์ Restaurant Migration เปิด 2 อย่าง: ชีต 4 shop a week และ Restaurant Portal",
"en": "Open the tools",
"ed": "First, open Chrome. In All Bookmarks, go to Restaurant Migration. You need the 4 shop a week sheet and the restaurant portal.",
"img": "amigo/create-store/s01.jpg",
"at": 11
},
{
"n": 2,
"t": "Restaurant Portal",
"d": "ใน Restaurant Portal กด + New Restaurant ที่เมนูซ้าย",
"en": "Restaurant portal",
"ed": "On the restaurant portal, click New Restaurant in the left menu.",
"img": "amigo/create-store/s02.jpg",
"at": 21
},
{
"n": 3,
"t": "เลือกร้านจากชีต",
"d": "ในชีตเปิดแท็บ USA แล้วหาร้านที่จะตั้งค่า (ตัวอย่าง: Charng Thai Restaurant, Hackensack)",
"en": "Pick the restaurant from the sheet",
"ed": "In the sheet, open the USA tab and find the restaurant you will set up. Here, it's Charng Thai Restaurant in Hackensack.",
"img": "amigo/create-store/s03.jpg",
"at": 27
},
{
"n": 4,
"t": "New restaurant: ข้อมูลพื้นฐาน",
"d": "พิมพ์ชื่อร้านแล้วเลือกจากรายการของ Google ที่อยู่จะขึ้นเอง ตรวจถนน เมือง รัฐ และรหัสไปรษณีย์ให้ถูก",
"en": "New restaurant: basic information",
"ed": "Type the restaurant name and pick it from the Google list. The address fills in by itself. Check the street, city, state and postal code.",
"img": "amigo/create-store/s04.jpg",
"at": 37
},
{
"n": 5,
"t": "หาร้านเดิมใน Admin",
"d": "เปิด Admin Panel › Admin USA ค้นชื่อร้านแล้วเปิด นี่คือร้านเดิมที่เราจะลอกข้อมูลมา",
"en": "Find the old store in Admin",
"ed": "Now open Admin Panel, then Admin USA. Search for the restaurant name and open it. This is the old store, where we copy the information from.",
"img": "amigo/create-store/s05.jpg",
"at": 48
},
{
"n": 6,
"t": "คัดลอกลิงก์ Smart Menu Order",
"d": "ไปที่ Publishing › Smart links แล้วกดคัดลอกลิงก์ Smart Menu Order เก็บไว้ใช้นำเข้าเมนูตอน Step 5",
"en": "Copy the Smart Menu Order link",
"ed": "Go to Publishing, Smart links, and copy the Smart Menu Order link. We will use it later to import the menu.",
"img": "amigo/create-store/s06.jpg",
"at": 66
},
{
"n": 7,
"t": "สร้างร้าน",
"d": "กลับมาที่ Portal ตรง Brand เลือก Create a new brand แล้วกด Create restaurant จากนั้นเปิดเมนู Launch",
"en": "Create the restaurant",
"ed": "Back in the portal, under Brand, choose Create a new brand. Then click Create restaurant, and open Launch.",
"img": "amigo/create-store/s07.jpg",
"at": 75
},
{
"n": 8,
"t": "Step 1: Location",
"d": "ตรวจข้อมูลที่ตั้งร้าน แล้วกด Next task",
"en": "Step 1: Location",
"ed": "Step 1, Location. Check the details, then click Next task.",
"img": "amigo/create-store/s08.jpg",
"at": 84
},
{
"n": 9,
"t": "Step 2: Identity",
"d": "เลือกประเภทร้าน และเลือกประเภทอาหาร (ตัวอย่าง: Thai) แล้วกด Next task",
"en": "Step 2: Identity",
"ed": "Step 2, Identity. Choose the restaurant type, and pick the cuisine. Here, it's Thai. Then click Next task.",
"img": "amigo/create-store/s09.jpg",
"at": 90
},
{
"n": 10,
"t": "Step 3: Brand – หาโลโก้",
"d": "ชื่อร้านขึ้นให้แล้ว หาโลโก้และรูปจาก Google และหน้า Facebook ของร้าน บันทึกรูปโลโก้ลงเครื่อง",
"en": "Step 3: Brand - find the logo",
"ed": "Step 3, Brand. The name is already filled in. To get the logo and photos, search for the restaurant on Google, and check its Facebook page. Save the logo image to your computer.",
"img": "amigo/create-store/s10.jpg",
"at": 99
},
{
"n": 11,
"t": "Step 3: อัปโหลดโลโก้และรูป",
"d": "อัปโหลดโลโก้ ตรวจสีหลัก (Primary colour) และใส่รูปใน Gallery แล้วกด Next task",
"en": "Step 3: Upload logo and photos",
"ed": "Upload the logo, check the primary colour, and add some gallery photos. Then click Next task.",
"img": "amigo/create-store/s11.jpg",
"at": 129
},
{
"n": 12,
"t": "Step 4: Location details",
"d": "ใส่เบอร์โทรและอีเมลร้าน ตั้งเวลาเตรียมอาหารสำหรับ Pickup ตรวจ Order timing, VAT rate และเวลาเปิด–ปิด แล้วกด Next task",
"en": "Step 4: Location details",
"ed": "Step 4, Location details. Enter the phone number and email, and set the preparation time for pickup. Check the order timing, the VAT rate, and the opening hours. Then click Next task.",
"img": "amigo/create-store/s12.jpg",
"at": 137
},
{
"n": 13,
"t": "Step 5: นำเข้าเมนู",
"d": "เลือก Import from a platform › GloriaFood วางลิงก์ Smart Menu ที่คัดลอกไว้ แล้วกด Start import ใช้เวลาประมาณ 2 นาที",
"en": "Step 5: Import the menu",
"ed": "Step 5, Menu. Choose Import from a platform, and select GloriaFood. Paste the Smart Menu link you copied, and click Start import. It takes about two minutes.",
"img": "amigo/create-store/s13.jpg",
"at": 152
},
{
"n": 14,
"t": "Step 6: Domain",
"d": "เมื่อเมนูพร้อมกด Continue ที่ Domain เลือก generic domain และตรวจชื่อร้านในลิงก์เว็บ",
"en": "Step 6: Domain",
"ed": "When the menu is ready, click Continue. Step 6, Domain. Use the generic domain, and check the restaurant name in the web address.",
"img": "amigo/create-store/s14.jpg",
"at": 166
},
{
"n": 15,
"t": "Step 7: Online payment",
"d": "เลือก Yes ดูบัญชี Stripe ของร้านได้ที่ Admin › Payments › Other providers (ต้องเป็น Stripe Connect active)",
"en": "Step 7: Online payment",
"ed": "Step 7, Online payment. Choose Yes. To find the restaurant's Stripe account, check Admin, Payments, Other providers. Stripe Connect is active.",
"img": "amigo/create-store/s15.jpg",
"at": 177
},
{
"n": 16,
"t": "หาบัญชี Stripe",
"d": "เปิด Stripe dashboard แล้วค้นชื่อร้าน",
"en": "Find the Stripe account",
"ed": "Open the Stripe dashboard, and search for the restaurant name.",
"img": "amigo/create-store/s16.jpg",
"at": 189
},
{
"n": 17,
"t": "Stripe: ดูรายการจ่ายเงินล่าสุด",
"d": "ที่ Connected accounts เปิดร้านนั้น › แท็บ Payments จะเห็นยอดและเวลาของรายการล่าสุด",
"en": "Stripe: check the latest payments",
"ed": "In Connected accounts, open the restaurant, and go to the Payments tab. Here you can see the latest payments, with the amount and the time.",
"img": "amigo/create-store/s17.jpg",
"at": 202
},
{
"n": 18,
"t": "เทียบกับประวัติออเดอร์",
"d": "ก่อนเชื่อมต่อ ให้เทียบยอดกับประวัติออเดอร์ใน Admin เดิม: Reports › List View › Online orders",
"en": "Compare with the order history",
"ed": "Before you connect, compare these payments with the order history in the old Admin. Go to Reports, List View, then Online orders.",
"img": "amigo/create-store/s18.jpg",
"at": 212
},
{
"n": 19,
"t": "Stripe: ยอดล่าสุด",
"d": "ตัวอย่าง: ใน Stripe ยอดล่าสุดคือ 40.47, 40.47, 31.46, 47.23, 31.50 ดอลลาร์",
"en": "Stripe: latest payments",
"ed": "In Stripe, the latest payments are 40.47, 40.47, 31.46, 47.23, and 31.50 dollars.",
"img": "amigo/create-store/s19.jpg",
"at": 223
},
{
"n": 20,
"t": "Admin: ประวัติออเดอร์",
"d": "ใน Admin ยอดตรงกันและเรียงเหมือนกัน ชั่วโมงอาจต่างเพราะ Stripe ใช้ time zone อื่น แต่นาทีต้องตรง ออเดอร์ที่ Missed จะขึ้นใน Stripe ว่า canceled",
"en": "Admin: order history",
"ed": "In the Admin order history, the totals are the same, in the same order. The hour looks different, because Stripe shows a different time zone, but the minutes match. The latest order was missed, so Stripe shows it as canceled.",
"img": "amigo/create-store/s20.jpg",
"at": 237
},
{
"n": 21,
"t": "ตรงกัน? คัดลอก Account ID",
"d": "ถ้าตรงกันแปลว่าเป็นบัญชี Stripe ที่ถูกต้อง กด Copy ID เพื่อคัดลอก Account ID",
"en": "Matches? Copy the account ID",
"ed": "Everything matches, so this is the right Stripe account. Now, click Copy ID, to copy the account ID.",
"img": "amigo/create-store/s21.jpg",
"at": 252
},
{
"n": 22,
"t": "เชื่อมบัญชี Stripe",
"d": "กลับไป Step 7 เลือก Connect an existing Stripe account วาง Account ID กด Find account ตรวจรายละเอียด แล้วกด Connect this account",
"en": "Connect the Stripe account",
"ed": "Back in Step 7, choose Connect an existing Stripe account. Paste the account ID, click Find account, check the details, and click Connect this account.",
"img": "amigo/create-store/s22.jpg",
"at": 262
},
{
"n": 23,
"t": "Step 8: Go Live",
"d": "ตรวจว่าทุกข้อมีเครื่องหมายถูกสีเขียว แล้วกด Go Live",
"en": "Step 8: Go Live",
"ed": "Step 8, Go Live. Make sure every item has a green tick, then click Go Live.",
"img": "amigo/create-store/s23.jpg",
"at": 274
},
{
"n": 24,
"t": "ตรวจ Tax & Currency",
"d": "ไปที่ My info › Tax & Currency เทียบภาษีกับร้านเดิมใน Admin (Taxation) ตัวอย่าง: Sales tax 7.375%",
"en": "Check Tax & Currency",
"ed": "Now, check the settings. Go to My info, then Tax and Currency. Compare the tax with the old store in Admin, under Taxation. Here, the sales tax is 7.375 percent.",
"img": "amigo/create-store/s24.jpg",
"at": 281
},
{
"n": 25,
"t": "ตั้งอัตราภาษี",
"d": "ตั้ง Default rate ให้ตรงกับร้านเดิม และตั้ง Delivery fee tax เป็น 0% แล้ว Save และยืนยัน",
"en": "Set the tax rate",
"ed": "Set the default rate to match, and set the delivery fee tax to zero percent. Save, and confirm the change.",
"img": "amigo/create-store/s25.jpg",
"at": 299
},
{
"n": 26,
"t": "เวลาเปิด–ปิด & Order methods",
"d": "ตรวจเวลาเปิด–ปิด ถ้าร้านเดิมมี Pickup แต่ไม่มี Delivery ให้ไป Order settings › Order Methods ปิด Delivery แล้ว Save",
"en": "Opening hours & order methods",
"ed": "Check the opening hours. In the old Admin, this store has pickup but no delivery. So in Order settings, Order Methods, turn off Delivery, and save.",
"img": "amigo/create-store/s26.jpg",
"at": 308
},
{
"n": 27,
"t": "อีเมลแจ้ง Missed order",
"d": "ที่ Missed orders ใส่อีเมลร้าน เพื่อให้ร้านได้อีเมลเตือนเมื่อมีออเดอร์ที่ไม่ได้รับ",
"en": "Missed order emails",
"ed": "In Missed orders, add the restaurant's email, so they get an alert if an order is missed.",
"img": "amigo/create-store/s27.jpg",
"at": 324
},
{
"n": 28,
"t": "Payment methods & Tips",
"d": "ตรวจ Payment methods และตั้ง Tips (ตัวอย่าง: default tip 5%)",
"en": "Payment methods & tips",
"ed": "Check Payment methods, and set the tips. Here, the default tip is 5 percent.",
"img": "amigo/create-store/s28.jpg",
"at": 333
},
{
"n": 29,
"t": "Service fee",
"d": "ดู Service fee ใน Admin เดิม (ตัวอย่าง 5%) แล้วตั้งให้เท่ากันที่ Fees แล้ว Save",
"en": "Service fee",
"ed": "Check the service fee in Admin. It's 5 percent, so set the same in Fees, and save.",
"img": "amigo/create-store/s29.jpg",
"at": 341
},
{
"n": 30,
"t": "Printed receipt",
"d": "เลือกสิ่งที่จะแสดงบนใบเสร็จที่พิมพ์ แล้ว Save",
"en": "Printed receipt",
"ed": "In Printed receipt, choose what to show on the receipt, and save.",
"img": "amigo/create-store/s30.jpg",
"at": 355
},
{
"n": 31,
"t": "Staff credentials",
"d": "ตั้ง Username และ Password ที่ร้านจะใช้เข้าแอปรับออเดอร์ แล้ว Save",
"en": "Staff credentials",
"ed": "In Staff credentials, set the username and password the restaurant will use for the order-taking app. Then save.",
"img": "amigo/create-store/s31.jpg",
"at": 363
},
{
"n": 32,
"t": "ตรวจ Marketing & Offers",
"d": "ดู Marketing, Promo codes และ Offers ว่าไม่มีอะไรตกหล่น",
"en": "Check marketing & offers",
"ed": "Have a quick look at Marketing, Promo codes, and Offers, to make sure nothing is missing.",
"img": "amigo/create-store/s32.jpg",
"at": 373
},
{
"n": 33,
"t": "ทดสอบ Orders Portal & หน้าร้านออนไลน์",
"d": "ลองล็อกอิน Orders Portal แล้วเปิดลิงก์หน้าร้านออนไลน์ ตรวจเมนู",
"en": "Test the Orders Portal & online store",
"ed": "Test that you can log in to the Orders Portal. Then open the online store link, and check the menu.",
"img": "amigo/create-store/s33.jpg",
"at": 391
},
{
"n": 34,
"t": "Website: Storefront",
"d": "สร้างเว็บไซต์: Website › Storefront เลือกประเภทร้าน ตรวจ District และพื้นที่ ใส่ 3 เมนูขายดี แล้วกด Generate ให้ระบบเขียนข้อความ",
"en": "Website: Storefront",
"ed": "Next, build the website. Go to Website, then Storefront. Pick the restaurant type, check the district and areas, and add the top three dishes. Use Generate to fill in the text.",
"img": "amigo/create-store/s34.jpg",
"at": 403
},
{
"n": 35,
"t": "ดูข้อมูลเพิ่มใน Admin",
"d": "ถ้าต้องการข้อมูลเพิ่ม กลับไปดูร้านเดิมใน Admin",
"en": "Check details in Admin",
"ed": "If you need more details, check the old store in Admin again.",
"img": "amigo/create-store/s35.jpg",
"at": 417
},
{
"n": 36,
"t": "ระบบสร้างเว็บไซต์ให้",
"d": "ระบบสร้างเว็บไซต์อัตโนมัติ ใช้เวลาประมาณ 1 นาที",
"en": "Website is generated",
"ed": "The website is created automatically. This takes about a minute.",
"img": "amigo/create-store/s36.jpg",
"at": 423
},
{
"n": 37,
"t": "แก้ Layout & Publish",
"d": "ใน Layout editor ลบส่วนที่ไม่ใช้ เช่น Pop-up promo code ที่ว่างอยู่ แล้วกด Publish website changes",
"en": "Edit layout & publish",
"ed": "In the layout editor, remove the sections you don't need, like the empty promo code pop-ups. Then click Publish website changes.",
"img": "amigo/create-store/s37.jpg",
"at": 433
},
{
"n": 38,
"t": "ดูตัวอย่างเว็บไซต์",
"d": "เปิดเว็บไซต์ดูหน้าตา",
"en": "Preview the website",
"ed": "Open the website to check how it looks.",
"img": "amigo/create-store/s38.jpg",
"at": 445
},
{
"n": 39,
"t": "สีธีม",
"d": "ไปที่ Theme › Colors ปรับสีให้เข้ากับแบรนด์ แล้ว Save",
"en": "Theme colours",
"ed": "In Theme, then Colors, change the colours to match the brand, and save.",
"img": "amigo/create-store/s39.jpg",
"at": 451
},
{
"n": 40,
"t": "อัปโหลดโลโก้เว็บ",
"d": "ที่ Logo กดอัปโหลดรูปโลโก้ เลือกรูป แล้ว Save",
"en": "Upload the logo",
"ed": "In Logo, click to upload the logo image. Select it, and save.",
"img": "amigo/create-store/s40.jpg",
"at": 465
},
{
"n": 41,
"t": "ตรวจครั้งสุดท้าย",
"d": "เปิดเว็บไซต์อีกครั้ง โลโก้ สี และรูปต้องขึ้นครบ เสร็จแล้ว ร้านใหม่พร้อมใช้งาน 🎉",
"en": "Final check",
"ed": "Open the website again. The logo, colours and photos now show up. That's it. The new store is ready!",
"img": "amigo/create-store/s41.jpg",
"at": 477
}
]
}
];
export const AMIGO_SOON = ['Setup Table Reservation', "Setup shop's own delivery", 'Setup 3rd party delivery', 'How to LIVE shop with the application', 'How to connect printer on app', 'LIVE process on phone', 'How to connect domain and LIVE website'];
