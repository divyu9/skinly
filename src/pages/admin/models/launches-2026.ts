/**
 * Devices launched from January to September 2026 (plus older Apple models) not yet in
 * supportedModels (the table stopped growing on 16 Jan 2026 while the site was
 * down). Phones and tablets from GSMArena brand listings and launch news for
 * AI+, Boltt and Mivi, China-only models removed; names in the catalogue's own
 * style (no brand prefix, except Infinix and HMD which carry one).
 *
 * One line per model: "Brand, Model, category". Loaded into the bulk-add
 * dialog, where it is checked against the live table before anything is saved.
 */
export const LAUNCHES_2026 = `Apple, iPhone 18 Pro, phone
Apple, iPhone 18 Pro Max, phone
Apple, iPhone Duo, phone
Apple, iPad AIR 11 M4 (2026), tablet
Apple, iPad AIR 13 M4 (2026), tablet
Apple, iPhone 17e, phone
Apple, Macbook Neo 13 A18 Pro (2026), laptop
Apple, Macbook Air 13 M5 (2026), laptop
Apple, Macbook Air 15 M5 (2026), laptop
Apple, Macbook Pro 14 M5 Pro / M5 Max (2026), laptop
Apple, Macbook Pro 16 M5 Pro / M5 Max (2026), laptop
Apple, Macbook Pro 14 M5 (2025), laptop
Apple, Macbook Air 13 M4 (2025), laptop
Apple, Macbook Air 15 M4 (2025), laptop
Apple, Macbook Pro 14 M4 Pro / M4 Max (2024), laptop
Apple, Macbook Pro 16 M4 Pro / M4 Max (2024), laptop
Apple, Macbook Air 13 M3 (2024), laptop
Apple, Macbook Air 15 M3 (2024), laptop
Apple, Macbook Air 15 M2 (2023), laptop
Apple, Macbook Pro 14 M3 / M3 Pro (2023), laptop
Apple, Macbook Pro 16 M3 Pro / M3 Max (2023), laptop
Apple, iPad AIR 11 M3 (2025), tablet
Apple, iPad AIR 13 M3 (2025), tablet
Apple, iPad Pro 11 (M5), tablet
Apple, iPad Pro 13 (M5), tablet
Apple, iPad mini (7th Gen) A17 Pro, tablet
Apple, iPhone SE (2nd Gen) 2020, phone
Apple, iPhone SE (3rd Gen) 2022, phone
Apple, iPhone 5C, phone
Apple, iPhone 4S, phone
Apple, iPhone 4, phone
Apple, Macbook Pro 16 M2 Pro / M2 Max (2023), laptop
Apple, Macbook Pro 13inch - A1989/A2159 (2018-2019), laptop
Apple, USB-C Power Adapter (35W Dual), charger
Apple, 40W Dynamic Power Adapter (60W Max), charger
Apple, USB-C Power Adapter (70W), charger
Apple, USB-C Power Adapter (96W), charger
Apple, USB-C Power Adapter (87W), charger
Apple, USB-C Power Adapter (61W), charger
Apple, USB Power Adapter (12W), charger
Apple, USB Power Adapter (5W), charger
Samsung, Galaxy A07s, phone
Samsung, Galaxy A08 4G, phone
Samsung, Galaxy A18 4G, phone
Samsung, Galaxy F70 Pro, phone
Samsung, Galaxy S26 FE, phone
Samsung, Galaxy Z Flip8, phone
Samsung, Galaxy Z Fold8, phone
Samsung, Galaxy Z Fold8 Ultra, phone
Samsung, Galaxy A27, phone
Samsung, Galaxy M47, phone
Samsung, Galaxy A37, phone
Samsung, Galaxy A57, phone
Samsung, Galaxy M17e, phone
Samsung, Galaxy F70e, phone
Samsung, Galaxy S26, phone
Samsung, Galaxy S26 Ultra, phone
Samsung, Galaxy S26+, phone
Samsung, Galaxy A07, phone
Google, Pixel 11, phone
Google, Pixel 11 Pro, phone
Google, Pixel 11 Pro Fold, phone
Google, Pixel 11 Pro XL, phone
Google, Pixel 10a, phone
One Plus, 15R, phone
One Plus, 15T, phone
One Plus, Nord 6, phone
One Plus, Nord CE6, phone
One Plus, Nord CE6 Lite, phone
One Plus, Pad 4, tablet
One Plus, Pad 3 Pro, tablet
One Plus, Pad Go 2, tablet
Xiaomi, Xiaomi 18 Fold, phone
Xiaomi, Xiaomi Pad 9 Pro Max, tablet
Xiaomi, Redmi 17, phone
Xiaomi, Redmi 17 4G, phone
Xiaomi, Redmi 17C, phone
Xiaomi, Redmi Note 17, phone
Xiaomi, Redmi Note 17 4G, phone
Xiaomi, Redmi Note 17 Pro, phone
Xiaomi, Redmi Note 17 Pro Max, phone
Xiaomi, Redmi 17C 4G, phone
Xiaomi, Xiaomi 17 Max, phone
Xiaomi, Xiaomi 17T, phone
Xiaomi, Xiaomi 17T Pro, phone
Xiaomi, Redmi A7, phone
Xiaomi, Redmi A7 Pro, phone
Xiaomi, Redmi Note 15 Special, phone
Xiaomi, Redmi Pad 2 9.7, tablet
Xiaomi, Redmi 15a, phone
Xiaomi, Redmi A7 Pro 4G, phone
Xiaomi, Xiaomi 17 Ultra, phone
Poco, F9 Pro, phone
Poco, F9 Ultra, phone
Poco, X8, phone
Poco, X8 Power, phone
Poco, M8 Power, phone
Poco, M8x, phone
Poco, Pad C1, tablet
Poco, C81, phone
Poco, C81 Pro, phone
Poco, C81x, phone
Poco, M8s, phone
Poco, C85x, phone
Poco, X8 Pro, phone
Poco, X8 Pro Max, phone
Poco, M8, phone
Poco, M8 Pro, phone
Oppo, A7 Pro, phone
Oppo, K14 Lite, phone
Oppo, A7 Pro Max, phone
Oppo, Reno16c, phone
Oppo, Reno16, phone
Oppo, Reno16 F, phone
Oppo, Reno16 FS, phone
Oppo, Reno16 Pro, phone
Oppo, Pad 6, tablet
Oppo, A6c, phone
Oppo, A6k, phone
Oppo, F33, phone
Oppo, F33 Pro, phone
Oppo, Find X9 Ultra, phone
Oppo, Find X9s, phone
Oppo, Find X9s Pro, phone
Oppo, Pad 5 Pro, tablet
Oppo, Pad Mini, tablet
Oppo, A6s, phone
Oppo, Find N6, phone
Oppo, A6s Pro, phone
Oppo, Reno15c, phone
Oppo, A6, phone
Oppo, A6 4G, phone
Oppo, A6 Pro, phone
Oppo, A6s 4G, phone
Oppo, A6t, phone
Oppo, A6t 4G, phone
Oppo, A6t Pro 4G, phone
Oppo, Reno15, phone
Oppo, Reno15 F, phone
Oppo, Reno15 FS, phone
Oppo, Reno15 Pro, phone
Oppo, Reno15 Pro Max, phone
Oppo, Reno15 Pro Mini, phone
Vivo, T5, phone
Vivo, V80 Lite, phone
Vivo, S2, phone
Vivo, V70 Lite 4G, phone
Vivo, Y31t, phone
Vivo, T5 Lite, phone
Vivo, T5e, phone
Vivo, X300 E, phone
Vivo, Y500, phone
Vivo, V70 Lite, phone
Vivo, X Fold6, phone
Vivo, Y11d, phone
Vivo, S60, phone
Vivo, S60e, phone
Vivo, T5 4G, phone
Vivo, Y600 Turbo, phone
Vivo, T5 Pro, phone
Vivo, X300 FE, phone
Vivo, Y500s, phone
Vivo, Y6, phone
Vivo, Y60, phone
Vivo, Y600 Pro, phone
Vivo, Y6t, phone
Vivo, T5x, phone
Vivo, V70 FE, phone
Vivo, X300 Ultra, phone
Vivo, X300s, phone
Vivo, Y51 Pro, phone
Vivo, V70, phone
Vivo, V70 Elite, phone
Vivo, Y05, phone
Vivo, X200T, phone
Vivo, Y31d, phone
Vivo, Y500i, phone
iQOO, Neo11 Ultra, phone
iQOO, Z11, phone
iQOO, Z11S, phone
iQOO, Z11 Lite 44W, phone
iQOO, Pad5c, tablet
iQOO, 15T, phone
iQOO, Z11i, phone
iQOO, Z11x, phone
iQOO, 15 Ultra, phone
iQOO, 15R, phone
iQOO, Z11 Turbo, phone
Realme, 16x, phone
Realme, C100i, phone
Realme, P4s, phone
Realme, Narzo 100x, phone
Realme, P4R, phone
Realme, P4x 4G, phone
Realme, 16T, phone
Realme, C100x, phone
Realme, C100, phone
Realme, C100 4G, phone
Realme, Narzo 100 Lite, phone
Realme, C83, phone
Realme, Narzo Power, phone
Realme, Note 80, phone
Realme, P4 Lite, phone
Realme, P4 Lite 4G, phone
Realme, 16 Pro, phone
Realme, 16 Pro+, phone
Realme, C85 4G, phone
Realme, Neo8, phone
Realme, P4 Power, phone
Realme, Pad 3, tablet
Motorola, Edge 70 Plus, phone
Motorola, Moto G Max, phone
Motorola, Moto Pad 70, tablet
Motorola, Edge 70 Max, phone
Motorola, Moto G77 Power, phone
Motorola, Moto Pad 70 Groove, tablet
Motorola, Edge 2026, phone
Motorola, Edge 70 Pro+, phone
Motorola, Moto Pad 70 Pro, tablet
Motorola, Edge 70 Pro, phone
Motorola, Moto G Stylus 2026, phone
Motorola, Moto G37, phone
Motorola, Moto G37 Power, phone
Motorola, Moto G47, phone
Motorola, Moto G87, phone
Motorola, Moto Pad 2026, tablet
Motorola, Razr 2026, phone
Motorola, Razr 70, phone
Motorola, Razr 70 Ultra, phone
Motorola, Razr 70+, phone
Motorola, Razr Ultra 2026, phone
Motorola, Razr+ 2026, phone
Motorola, Edge 70 Fusion, phone
Motorola, Edge 70 Fusion+, phone
Motorola, Moto G17, phone
Motorola, Moto G17 Power, phone
Motorola, Moto G67, phone
Motorola, Moto G77, phone
Motorola, Razr Fold, phone
Motorola, Signature, phone
Nothing, Phone 4b, phone
Nothing, Phone 4a, phone
Nothing, Phone 4a Pro, phone
Infinix, Infinix Xpad 30 Pro, tablet
Infinix, Infinix Hot 70 Pro, phone
Infinix, Infinix Hot 70, phone
Infinix, Infinix GT 50 Pro, phone
Infinix, Infinix Note 60 Ultra, phone
Infinix, Infinix Smart 20, phone
Infinix, Infinix Note 60, phone
Infinix, Infinix Note 60 Pro, phone
Infinix, Infinix Note Edge, phone
Tecno, Camon Air, phone
Tecno, Camon Slim, phone
Tecno, Pova 8 Pro, phone
Tecno, Spark Go 3 Pro, phone
Tecno, Camon Slim 4G, phone
Tecno, Pova 8, phone
Tecno, Spark 50 Pro, phone
Tecno, Pop X, phone
Tecno, Spark 50 4G, phone
Tecno, Camon 50 Pro, phone
Tecno, Camon 50 Ultra, phone
Tecno, Pop X 4G, phone
Tecno, Spark 50, phone
Tecno, Camon 50 4G, phone
Tecno, Camon 50 Pro 4G, phone
Tecno, Pova Curve 2, phone
Tecno, Megapad SE, tablet
Tecno, Spark Go 3, phone
Lava, Smart 4, phone
Lava, Virat V1 Pro, phone
Lava, Virat V1, phone
Lava, Virat V1 4G, phone
Lava, Smart 4 Plus, phone
Lava, Shark 2, phone
Lava, Bold N2 Lite, phone
Lava, Bold N2 Pro, phone
Lava, Yuva Star 3, phone
Lava, Blaze Duo 3, phone
HMD, HMD Arc 2, phone
HMD, HMD Asha 305 Lite, phone
HMD, HMD Vibe2, phone
HMD, HMD Luma, phone
HMD, HMD Terra M, phone
AI+, Nova 2, phone
AI+, Nova 2 Ultra, phone
AI+, Nova Flip, phone
AI+, Pulse Tab, tablet
AI+, Pulse 2, phone
Boltt, Ace 5G, phone
Boltt, Evo 4G, phone
Mivi, One 5G, phone`;
