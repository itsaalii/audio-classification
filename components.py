"""
Komponen UI, Heroicons SVG, dan Template Desain Sesuai https://psd-interpolasi.basisdata2-c.my.id/
Tanpa Emote/Emoji - Menggunakan 100% SVG Heroicons
Semua SVG dibatasi ukuran secara inline (width, height, min-width, min-height) agar tidak membesar liar.
Durasi Analisis: 4 Detik (Sinkron Penuh Model WKNN 4s - Akurasi 97.64%)
"""

import os
import base64

HEROICON_PATHS = {
    "microphone": """<path stroke-linecap="round" stroke-linejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15a3 3 0 01-3-3V4.5a3 3 0 116 0V12a3 3 0 01-3 3z"/>""",
    "play": """<path stroke-linecap="round" stroke-linejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z"/>""",
    "stop": """<path stroke-linecap="round" stroke-linejoin="round" d="M5.25 7.5A2.25 2.25 0 017.5 5.25h9a2.25 2.25 0 012.25 2.25v9a2.25 2.25 0 01-2.25 2.25h-9A2.25 2.25 0 015.25 16.5v-9z"/>""",
    "check_circle": """<path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>""",
    "exclamation_triangle": """<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/>""",
    "bell": """<path stroke-linecap="round" stroke-linejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"/>""",
    "waveform": """<path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"/>""",
    "table": """<path stroke-linecap="round" stroke-linejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H4.5A1.125 1.125 0 003.375 5.625m17.25 0v1.5c0 .621-.504 1.125-1.125 1.125H4.5A1.125 1.125 0 013.375 7.125v-1.5"/>""",
    "upload": """<path stroke-linecap="round" stroke-linejoin="round" d="M12 16V4m0 0L7 9m5-5 5 5M4 20h16"/>""",
    "info": """<path stroke-linecap="round" stroke-linejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"/>""",
    "clock": """<path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/>""",
    "cpu": """<path stroke-linecap="round" stroke-linejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V7.5a2.25 2.25 0 00-2.25-2.25H7.5A2.25 2.25 0 005.25 7.5v9a2.25 2.25 0 002.25 2.25z"/>""",
    "shield_check": """<path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"/>""",
    "adjustments_horizontal": """<path stroke-linecap="round" stroke-linejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75"/>""",
    "trophy": """<path stroke-linecap="round" stroke-linejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.504-1.125-1.125-1.125h-6.75c-.621 0-1.125.504-1.125 1.125v3.375m9 0h-9m12-9.75V6.75A2.25 2.25 0 0017.25 4.5h-10.5A2.25 2.25 0 004.5 6.75v2.25m15 0a3.75 3.75 0 01-3.75 3.75h-.75m-9 0h-.75A3.75 3.75 0 011.5 9v-.75A2.25 2.25 0 013.75 6h.75m15 3h.75A2.25 2.25 0 0022.5 6.75V6a2.25 2.25 0 00-2.25-2.25h-.75"/>""",
    "chart_bar": """<path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"/>"""
}

COLOR_MAP = {
    "text-teal-600": "#0D9488",
    "text-teal-700": "#0F766E",
    "text-teal-800": "#115E59",
    "text-rose-600": "#E11D48",
    "text-rose-500": "#F43F5E",
    "text-rose-700": "#BE123C",
    "text-slate-300": "#CBD5E1",
    "text-slate-400": "#94A3B8",
    "text-slate-500": "#64748B",
    "text-slate-600": "#475569",
    "text-slate-700": "#334155",
    "text-slate-800": "#1E293B",
    "text-white": "#FFFFFF"
}

def heroicon(name: str, classes: str = "h-5 w-5", *args, **kwargs) -> str:
    """
    Mengembalikan markup SVG Heroicon via data URI img tag.
    100% tahan sanitasi Streamlit st.html, ukuran pasti, dan warna tepat tanpa CSS override issue.
    """
    size_px = kwargs.get("size_px")
    if size_px is None and args:
        size_px = args[0]
        
    if size_px is None:
        if "h-4" in classes or "w-4" in classes:
            size_px = 16
        elif "h-5" in classes or "w-5" in classes:
            size_px = 20
        elif "h-6" in classes or "w-6" in classes:
            size_px = 24
        elif "h-8" in classes or "w-8" in classes:
            size_px = 32
        else:
            size_px = 20

    stroke_color = "#0D9488"
    for cls, hex_val in COLOR_MAP.items():
        if cls in classes:
            stroke_color = hex_val
            break

    path_data = HEROICON_PATHS.get(name, HEROICON_PATHS["info"])
    svg_content = (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{size_px}" height="{size_px}" '
        f'viewBox="0 0 24 24" fill="none" stroke="{stroke_color}" stroke-width="2" '
        f'stroke-linecap="round" stroke-linejoin="round">{path_data}</svg>'
    )
    b64 = base64.b64encode(svg_content.encode("utf-8")).decode("utf-8")
    
    return (
        f'<img src="data:image/svg+xml;base64,{b64}" width="{size_px}" height="{size_px}" '
        f'style="width: {size_px}px !important; height: {size_px}px !important; '
        f'min-width: {size_px}px !important; min-height: {size_px}px !important; '
        f'max-width: {size_px}px !important; max-height: {size_px}px !important; '
        f'display: inline-block !important; vertical-align: middle !important; flex-shrink: 0 !important;" '
        f'alt="{name}" />'
    )

def get_tailwind_head() -> str:
    """Membaca style.css dan menyuntikkannya secara langsung ke DOM Streamlit."""
    css_path = os.path.join(os.path.dirname(__file__), "style.css")
    css_content = ""
    if os.path.exists(css_path):
        with open(css_path, "r", encoding="utf-8") as f:
            css_content = f.read()

    return f"""<style>{css_content}</style>"""

def render_app_header(model_ready: bool = True, is_active: bool = False) -> str:
    """Merender Header Utama Halaman sesuai gaya https://psd-interpolasi.basisdata2-c.my.id/"""
    icon_mic = heroicon("microphone", "h-4 w-4 text-teal-700", size_px=16)
    
    if is_active:
        badge_status = (
            '<span class="status-badge-active">'
            '<span class="relative flex" style="width: 8px; height: 8px;">'
            '<span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>'
            '<span class="relative inline-flex rounded-full bg-rose-600" style="width: 8px; height: 8px;"></span>'
            '</span>Monitoring Aktif</span>'
        )
    else:
        badge_status = (
            '<span class="status-badge-ready">'
            '<span class="relative flex" style="width: 8px; height: 8px;">'
            '<span class="relative inline-flex rounded-full bg-teal-600" style="width: 8px; height: 8px;"></span>'
            '</span>Model WKNN 97.64% Siap (4s)</span>'
        )

    return (
        '<div class="header-container">'
        '<div>'
        '<div class="header-pill">'
        f'{icon_mic}'
        '<span>Sistem Klasifikasi Sinyal Audio Digital (Segmentasi 4s - Overlap 75%)</span>'
        '</div>'
        '<h1 class="header-title">Deteksi Real-Time Audio Berisik</h1>'
        '<p class="header-subtitle">'
        'Pemantauan akustik cerdas berbasis model <strong>Weighted K-Nearest Neighbors (WKNN - Akurasi 97.64% & CV 97.58%)</strong>. '
        'Mengekstraksi 16 parameter akustik domain waktu, frekuensi, dan spektral Mel (RMS, Centroid, ZCR, MFCC 1–13) '
        'setiap jendela 4.0 detik dengan pergeseran 1.0 detik (overlap 75%).'
        '</p>'
        '</div>'
        '<div class="header-badge-col">'
        f'{badge_status}'
        '</div>'
        '</div>'
    )

def render_notification_card(status: str, confidence: float, rms: float, centroid: float, zcr: float, consecutive_noisy: int = 0) -> str:
    """
    Merender Kartu Notifikasi yang Informatif dan Kaya Konteks
    Bebas emote/emoji, menggunakan icon dari Heroicon.
    """
    if status == "BERISIK":
        icon_alert = heroicon("exclamation_triangle", "h-6 w-6 text-rose-600", size_px=24)
        icon_clock = heroicon("clock", "h-4 w-4 text-rose-500", size_px=16)
        icon_info = heroicon("info", "h-4 w-4 text-rose-500", size_px=16)
        advice = "Intensitas kebisingan terdeteksi tinggi. Disarankan meredam sumber kegaduhan atau menjaga ketenangan di sekitar area mikrofon."
        
        return (
            '<div class="rounded-2xl border-2 border-rose-300 bg-rose-50 p-5 shadow-sm my-4">'
            '<div style="display: flex; align-items: flex-start; gap: 1rem;">'
            f'<div style="width: 44px; height: 44px; min-width: 44px; border-radius: 0.75rem; background-color: #FFE4E6; border: 1px solid #FECDD3; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">{icon_alert}</div>'
            '<div style="flex: 1; min-width: 0;">'
            '<div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.75rem;">'
            '<div style="display: flex; align-items: center; gap: 0.65rem;">'
            '<h3 style="font-size: 1rem; font-weight: 600; color: #4C0519; margin: 0;">PERINGATAN: TERDETEKSI SUARA BERISIK</h3>'
            '<span class="rounded-full bg-rose-200 px-3 py-1 text-xs font-semibold text-rose-900 border border-rose-300">Tingkat Kebisingan Tinggi</span>'
            '</div>'
            f'<span class="inline-flex items-center gap-1.5 text-xs font-medium text-rose-700 bg-rose-100 px-3 py-1 rounded-lg border border-rose-200">{icon_clock}<span>Akumulasi: {consecutive_noisy} siklus ({consecutive_noisy * 4} detik)</span></span>'
            '</div>'
            f'<p style="margin-top: 0.5rem; font-size: 0.875rem; color: #881337; line-height: 1.5;">Sistem mendeteksi gelombang akustik dalam kategori <strong>BERISIK (Noisy)</strong> dengan probabilitas keyakinan model sebesar <strong>{confidence:.1f}%</strong>.</p>'
            '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 0.75rem; margin-top: 1rem;" class="text-xs">'
            '<div class="rounded-xl bg-white p-3.5 border border-rose-200 shadow-xs">'
            '<div class="text-slate-500 font-medium">RMS Energy</div>'
            f'<div class="text-base font-bold text-rose-950 mt-1">{rms:.4f}</div>'
            '<div class="text-slate-500 text-xs mt-0.5">Amplitudo daya fisik tinggi</div>'
            '</div>'
            '<div class="rounded-xl bg-white p-3.5 border border-rose-200 shadow-xs">'
            '<div class="text-slate-500 font-medium">Spectral Centroid</div>'
            f'<div class="text-base font-bold text-rose-950 mt-1">{centroid:.1f} Hz</div>'
            '<div class="text-slate-500 text-xs mt-0.5">Pusat massa spektral tinggi</div>'
            '</div>'
            '<div class="rounded-xl bg-white p-3.5 border border-rose-200 shadow-xs">'
            '<div class="text-slate-500 font-medium">Zero Crossing Rate</div>'
            f'<div class="text-base font-bold text-rose-950 mt-1">{zcr:.4f}</div>'
            '<div class="text-slate-500 text-xs mt-0.5">Kepadatan fluktuasi derau</div>'
            '</div>'
            '</div>'
            f'<div style="margin-top: 1rem; display: flex; align-items: flex-start; gap: 0.65rem; font-size: 0.75rem; color: #9F1239; background-color: #FFE4E6; padding: 0.75rem 1rem; border-radius: 0.75rem; border: 1px solid #FECDD3;"><div style="flex-shrink: 0; margin-top: 2px;">{icon_info}</div><div><strong>Rekomendasi Tindakan:</strong> {advice}</div></div>'
            '</div>'
            '</div>'
            '</div>'
        )
    elif status == "NON-BERISIK":
        icon_check = heroicon("check_circle", "h-6 w-6 text-teal-600", size_px=24)
        icon_info = heroicon("info", "h-4 w-4 text-teal-600", size_px=16)
        
        return (
            '<div class="rounded-2xl border border-teal-200 bg-teal-50 p-5 shadow-sm my-4">'
            '<div style="display: flex; align-items: flex-start; gap: 1rem;">'
            f'<div style="width: 44px; height: 44px; min-width: 44px; border-radius: 0.75rem; background-color: #CCFBF1; border: 1px solid #99F6E4; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">{icon_check}</div>'
            '<div style="flex: 1; min-width: 0;">'
            '<div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.75rem;">'
            '<div style="display: flex; align-items: center; gap: 0.65rem;">'
            '<h3 style="font-size: 1rem; font-weight: 600; color: #042F2E; margin: 0;">KONDISI AMAN / NON-BERISIK</h3>'
            '<span class="rounded-full bg-teal-100 px-3 py-1 text-xs font-semibold text-teal-800 border border-teal-300">Kondusif & Hening</span>'
            '</div>'
            f'<span class="inline-flex items-center text-xs font-medium text-teal-700 bg-teal-100 px-3 py-1 rounded-lg border border-teal-200">Confidence: {confidence:.1f}%</span>'
            '</div>'
            '<p style="margin-top: 0.5rem; font-size: 0.875rem; color: #134E4A; line-height: 1.5;">Sinyal audio berada dalam batas wajar ruangan kondusif. Pola akustik diklasifikasikan sebagai <strong>NON-BERISIK (Clean)</strong>.</p>'
            '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 0.75rem; margin-top: 1rem;" class="text-xs">'
            '<div class="rounded-xl bg-white p-3.5 border border-teal-200 shadow-xs">'
            '<div class="text-slate-500 font-medium">RMS Energy</div>'
            f'<div class="text-base font-bold text-teal-950 mt-1">{rms:.4f}</div>'
            '<div class="text-slate-500 text-xs mt-0.5">Tingkat energi rendah</div>'
            '</div>'
            '<div class="rounded-xl bg-white p-3.5 border border-teal-200 shadow-xs">'
            '<div class="text-slate-500 font-medium">Spectral Centroid</div>'
            f'<div class="text-base font-bold text-teal-950 mt-1">{centroid:.1f} Hz</div>'
            '<div class="text-slate-500 text-xs mt-0.5">Frekuensi normal hening</div>'
            '</div>'
            '<div class="rounded-xl bg-white p-3.5 border border-teal-200 shadow-xs">'
            '<div class="text-slate-500 font-medium">Zero Crossing Rate</div>'
            f'<div class="text-base font-bold text-teal-950 mt-1">{zcr:.4f}</div>'
            '<div class="text-slate-500 text-xs mt-0.5">Fluktuasi sinyal tenang</div>'
            '</div>'
            '</div>'
            f'<div style="margin-top: 1rem; display: flex; align-items: flex-start; gap: 0.65rem; font-size: 0.75rem; color: #115E59; background-color: #CCFBF1; padding: 0.75rem 1rem; border-radius: 0.75rem; border: 1px solid #99F6E4;"><div style="flex-shrink: 0; margin-top: 2px;">{icon_info}</div><div><strong>Status Sistem:</strong> Tidak ada anomali atau pola frekuensi derau yang mengganggu pada jendela audio 4 detik terakhir.</div></div>'
            '</div>'
            '</div>'
            '</div>'
        )
    else:
        # Status Standby
        icon_mic = heroicon("microphone", "h-6 w-6 text-teal-600", size_px=24)
        icon_info = heroicon("info", "h-4 w-4 text-teal-600", size_px=16)
        
        return (
            '<div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm my-4">'
            '<div style="display: flex; align-items: flex-start; gap: 1rem;">'
            f'<div style="width: 44px; height: 44px; min-width: 44px; border-radius: 0.75rem; background-color: #F0FDFA; border: 1px solid #CCFBF1; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">{icon_mic}</div>'
            '<div style="flex: 1; min-width: 0;">'
            '<div style="display: flex; align-items: center; gap: 0.65rem;">'
            '<h3 style="font-size: 1rem; font-weight: 600; color: #1E293B; margin: 0;">Sistem Monitoring Real-Time Siap</h3>'
            '<span class="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700 border border-teal-200">Standby</span>'
            '</div>'
            '<p style="margin-top: 0.5rem; font-size: 0.875rem; color: #475569; line-height: 1.5;">'
            'Tekan tombol <strong>Mulai Monitoring Real-Time</strong> untuk mengaktifkan pemantauan sinyal mikrofon secara kontinu setiap 4 detik, atau klik <strong>Uji 1 Siklus (4 Detik)</strong> untuk pengujian instan.'
            '</p>'
            f'<div style="margin-top: 1rem; display: flex; align-items: center; gap: 0.65rem; font-size: 0.75rem; color: #0F766E; background-color: #F0FDFA; padding: 0.75rem 1rem; border-radius: 0.75rem; border: 1px solid #CCFBF1;"><div style="flex-shrink: 0;">{icon_info}</div><div>Parameter deteksi: Sample Rate = 22.050 Hz, Jendela = 4.0 Detik (88.200 sampel), 16 Fitur Akustik, Model WKNN (Akurasi 97.64%).</div></div>'
            '</div>'
            '</div>'
            '</div>'
        )

def render_kpi_cards(status: str, confidence: float, rms: float, centroid: float, zcr: float, cycle: int = 0) -> str:
    """Merender 4 Kartu Metrik Akustik Utama dengan margin dan padding yang lega dan presisi"""
    if status == "BERISIK":
        status_badge = '<span class="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700 border border-rose-200">BERISIK</span>'
    elif status == "NON-BERISIK":
        status_badge = '<span class="inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700 border border-teal-200">AMAN / TENANG</span>'
    else:
        status_badge = '<span class="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 border border-slate-200">STANDBY</span>'

    return (
        '<div class="grid grid-cols-2 lg:grid-cols-4 gap-4 my-4">'
        '<div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">'
        '<div class="text-xs font-medium text-slate-500">Status Prediksi</div>'
        f'<div class="mt-2.5 flex items-center">{status_badge}</div>'
        f'<div class="text-xs text-slate-500 mt-2.5">Siklus Deteksi: #{cycle}</div>'
        '</div>'
        '<div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">'
        '<div class="text-xs font-medium text-slate-500">Confidence Score</div>'
        f'<div class="mt-1.5 text-2xl font-bold tracking-tight text-slate-800">{confidence:.1f}%</div>'
        '<div class="text-xs text-slate-500 mt-1.5">Tingkat keyakinan KNN</div>'
        '</div>'
        '<div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">'
        '<div class="text-xs font-medium text-slate-500">RMS Energy (Daya)</div>'
        f'<div class="mt-1.5 text-2xl font-bold tracking-tight text-slate-800">{rms:.4f}</div>'
        '<div class="text-xs text-slate-500 mt-1.5">Amplitudo daya fisik</div>'
        '</div>'
        '<div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">'
        '<div class="text-xs font-medium text-slate-500">Spectral Centroid</div>'
        f'<div class="mt-1.5 text-2xl font-bold tracking-tight text-slate-800">{centroid:.1f} <span class="text-xs font-normal text-slate-500">Hz</span></div>'
        f'<div class="text-xs text-slate-500 mt-1.5">ZCR: {zcr:.4f}</div>'
        '</div>'
        '</div>'
    )

def render_model_eval_metrics() -> str:
    """Merender 4 Kartu Metrik Performa Tinggi Model WKNN yang Baru"""
    return (
        '<div class="grid grid-cols-2 lg:grid-cols-4 gap-4 my-4">'
        '<div class="rounded-2xl border border-teal-200 bg-teal-50/60 p-5 shadow-sm">'
        '<div class="text-xs font-medium text-teal-800">Akurasi Data Uji (Test)</div>'
        '<div class="mt-1.5 text-2xl font-bold tracking-tight text-teal-900">97.64%</div>'
        '<div class="text-xs text-teal-700 mt-1.5">N = 1.058 sampel uji independen</div>'
        '</div>'
        '<div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">'
        '<div class="text-xs font-medium text-slate-500">5-Fold Cross Validation</div>'
        '<div class="mt-1.5 text-2xl font-bold tracking-tight text-slate-800">97.58%</div>'
        '<div class="text-xs text-slate-500 mt-1.5">Std +/- 0.58% (Fold Max: 98.20%)</div>'
        '</div>'
        '<div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">'
        '<div class="text-xs font-medium text-slate-500">Precision Kelas Berisik</div>'
        '<div class="mt-1.5 text-2xl font-bold tracking-tight text-slate-800">98.60%</div>'
        '<div class="text-xs text-slate-500 mt-1.5">Hanya 7 false alarm dari 547 data</div>'
        '</div>'
        '<div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">'
        '<div class="text-xs font-medium text-slate-500">Recall Non-Berisik</div>'
        '<div class="mt-1.5 text-2xl font-bold tracking-tight text-slate-800">98.72%</div>'
        '<div class="text-xs text-slate-500 mt-1.5">540 dari 547 audio tenang akurat</div>'
        '</div>'
        '</div>'
    )

def render_model_info_card(model=None, scaler=None) -> str:
    """Merender Spesifikasi Arsitektur Model KNN dan Fitur Akustik secara dinamis sesuai model yang dimuat"""
    icon_cpu = heroicon("cpu", "h-5 w-5 text-teal-600", size_px=20)
    icon_table = heroicon("table", "h-5 w-5 text-teal-600", size_px=20)
    icon_shield = heroicon("shield_check", "h-5 w-5 text-teal-600", size_px=20)
    
    # Deteksi parameter model secara dinamis
    k_val = getattr(model, 'n_neighbors', 4) if model is not None else 4
    metric_raw = getattr(model, 'metric', 'euclidean') if model is not None else 'euclidean'
    metric_str = "Euclidean (Minkowski p=2)" if metric_raw == "euclidean" else str(metric_raw).capitalize()
    weights_raw = getattr(model, 'weights', 'distance') if model is not None else 'distance'
    weights_str = "Inverse Distance (w = 1/d)" if weights_raw == "distance" else "Uniform (Seragam)"
    
    # Deteksi jenis scaler
    if scaler is not None:
        scaler_cls = type(scaler).__name__
        if "Robust" in scaler_cls:
            scaler_str = "RobustScaler (Median & IQR)"
        elif "Standard" in scaler_cls:
            scaler_str = "StandardScaler (Z-Score)"
        elif "MinMax" in scaler_cls:
            scaler_str = "MinMaxScaler [0, 1]"
        else:
            scaler_str = scaler_cls
    else:
        scaler_str = "RobustScaler (Median & IQR)"

    return (
        '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.25rem; margin-top: 1.25rem; margin-bottom: 1.25rem;">'
        '<div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">'
        '<div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem;">'
        f'<div style="width: 36px; height: 36px; min-width: 36px; border-radius: 0.5rem; background-color: #F0FDFA; border: 1px solid #CCFBF1; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;">{icon_cpu}</div>'
        '<h3 class="text-sm font-semibold text-slate-800" style="margin: 0;">Spesifikasi Model WKNN</h3>'
        '</div>'
        '<div class="text-xs text-slate-600 space-y-2.5">'
        '<div class="flex justify-between pb-2 border-b border-slate-100"><span>Algoritma</span><span class="font-medium text-slate-800">Weighted K-Nearest Neighbors (WKNN)</span></div>'
        f'<div class="flex justify-between pb-2 border-b border-slate-100"><span>Tetangga (K)</span><span class="font-medium text-slate-800">{k_val} Neighbors (Bebas Tie)</span></div>'
        f'<div class="flex justify-between pb-2 border-b border-slate-100"><span>Metrik Jarak</span><span class="font-medium text-slate-800">{metric_str}</span></div>'
        f'<div class="flex justify-between pb-2 border-b border-slate-100"><span>Bobot Tetangga</span><span class="font-medium text-slate-800">{weights_str}</span></div>'
        f'<div class="flex justify-between"><span>Normalisasi</span><span class="font-medium text-slate-800">{scaler_str}</span></div>'
        '</div>'
        '</div>'
        '<div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">'
        '<div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem;">'
        f'<div style="width: 36px; height: 36px; min-width: 36px; border-radius: 0.5rem; background-color: #F0FDFA; border: 1px solid #CCFBF1; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;">{icon_table}</div>'
        '<h3 class="text-sm font-semibold text-slate-800" style="margin: 0;">16 Fitur Akustik (PSD)</h3>'
        '</div>'
        '<div class="text-xs text-slate-600 space-y-2">'
        '<div><strong>RMS Energy:</strong> Energi fisik & intensitas amplitudo gelombang</div>'
        '<div><strong>Spectral Centroid:</strong> Titik tengah massa frekuensi suara (Hz)</div>'
        '<div><strong>Zero Crossing Rate:</strong> Laju pelintasan sumbu nol (derau acak)</div>'
        '<div><strong>MFCC 1–13:</strong> 13 konstanta persepsi selubung spektral Mel</div>'
        '</div>'
        '</div>'
        '<div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">'
        '<div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem;">'
        f'<div style="width: 36px; height: 36px; min-width: 36px; border-radius: 0.5rem; background-color: #F0FDFA; border: 1px solid #CCFBF1; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;">{icon_shield}</div>'
        '<h3 class="text-sm font-semibold text-slate-800" style="margin: 0;">Konfigurasi Rekaman Audio</h3>'
        '</div>'
        '<div class="text-xs text-slate-600 space-y-2.5">'
        '<div class="flex justify-between pb-2 border-b border-slate-100"><span>Sample Rate (SR)</span><span class="font-medium text-slate-800">22.050 Hz (Standar PSD)</span></div>'
        '<div class="flex justify-between pb-2 border-b border-slate-100"><span>Panjang Jendela</span><span class="font-medium text-slate-800">4.0 Detik (88.200 sampel)</span></div>'
        '<div class="flex justify-between pb-2 border-b border-slate-100"><span>Hop & Overlap</span><span class="font-medium text-slate-800">1.0s (Overlap 75%)</span></div>'
        '<div class="flex justify-between"><span>Trimming Hening</span><span class="font-medium text-slate-800">RMS &ge; 0.015 (Kelas Berisik)</span></div>'
        '</div>'
        '</div>'
        '</div>'
    )

def render_confusion_matrix() -> str:
    """Merender Visualisasi Matriks Kebingungan (Confusion Matrix) 2x2 Elegan"""
    return (
        '<div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm my-5">'
        '<div class="flex items-center justify-between pb-3.5 border-b border-slate-100 mb-4">'
        '<div class="flex items-center gap-2">'
        f'{heroicon("shield_check", "h-5 w-5 text-teal-600", size_px=20)}'
        '<h3 class="text-sm font-semibold text-slate-800 m-0">Matriks Kebingungan (Confusion Matrix - 1.058 Sampel Uji)</h3>'
        '</div>'
        '<span class="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700 border border-teal-200">'
        'Presisi Berisik 98.60%'
        '</span>'
        '</div>'
        '<div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">'
        '<div class="rounded-xl border border-teal-200 bg-teal-50/50 p-4">'
        '<div class="flex justify-between items-center">'
        '<span class="font-semibold text-teal-900">True Non-Berisik (TN)</span>'
        '<span class="rounded-full bg-teal-100 px-2.5 py-1 font-bold text-teal-800">540 Segmen (98.72%)</span>'
        '</div>'
        '<p class="text-teal-700 mt-2 leading-relaxed">'
        'Audio kondisi tenang/kondusif berhasil diidentifikasi dengan sangat tepat. Sangat minim alarm palsu.'
        '</p>'
        '</div>'
        '<div class="rounded-xl border border-slate-200 bg-slate-50 p-4">'
        '<div class="flex justify-between items-center">'
        '<span class="font-semibold text-slate-700">False Positive / Alarm Palsu (FP)</span>'
        '<span class="rounded-full bg-slate-200 px-2.5 py-1 font-bold text-slate-700">Hanya 7 Segmen (1.28%)</span>'
        '</div>'
        '<p class="text-slate-500 mt-2 leading-relaxed">'
        'Suara tenang yang keliru dianggap bising sangat rendah, memastikan sistem tidak mengganggu pengguna.'
        '</p>'
        '</div>'
        '<div class="rounded-xl border border-slate-200 bg-slate-50 p-4">'
        '<div class="flex justify-between items-center">'
        '<span class="font-semibold text-slate-700">False Negative / Lolos (FN)</span>'
        '<span class="rounded-full bg-slate-200 px-2.5 py-1 font-bold text-slate-700">18 Segmen (3.52%)</span>'
        '</div>'
        '<p class="text-slate-500 mt-2 leading-relaxed">'
        'Suara bising dengan intensitas sangat tipis mendekati ambang hening yang terlewat.'
        '</p>'
        '</div>'
        '<div class="rounded-xl border border-rose-200 bg-rose-50/60 p-4">'
        '<div class="flex justify-between items-center">'
        '<span class="font-semibold text-rose-900">True Berisik (TP)</span>'
        '<span class="rounded-full bg-rose-100 px-2.5 py-1 font-bold text-rose-800">493 Segmen (96.48%)</span>'
        '</div>'
        '<p class="text-rose-700 mt-2 leading-relaxed">'
        'Suara gaduh/bising tertangkap dengan presisi sangat tinggi 98.60% dan recall 96.48%.'
        '</p>'
        '</div>'
        '</div>'
        '</div>'
    )

def render_algorithms_benchmark() -> str:
    """Merender Tabel Benchmark 12 Algoritma Hasil Eksperimen Komparatif pada train.ipynb"""
    benchmarks = [
        {"model": "WKNN (k=4, distance)", "acc": "97.64%", "f1": "97.53%", "prec": "98.60%", "rec": "96.48%", "cv": "97.52%", "rank": "1", "badge": "Model Terpilih"},
        {"model": "Baseline KNN (k=5, uniform)", "acc": "97.45%", "f1": "97.32%", "prec": "98.59%", "rec": "96.09%", "cv": "97.40%", "rank": "2", "badge": "Baseline"},
        {"model": "MLP (Neural Network)", "acc": "96.98%", "f1": "96.86%", "prec": "97.05%", "rec": "96.67%", "cv": "96.78%", "rank": "3", "badge": "Deep"},
        {"model": "Extra Trees Classifier", "acc": "96.69%", "f1": "96.55%", "prec": "97.22%", "rec": "95.89%", "cv": "97.02%", "rank": "4", "badge": "Ensemble"},
        {"model": "Random Forest Classifier", "acc": "95.27%", "f1": "95.12%", "prec": "94.93%", "rec": "95.30%", "cv": "96.17%", "rank": "5", "badge": "Ensemble"},
        {"model": "Decision Tree", "acc": "93.57%", "f1": "93.33%", "prec": "93.52%", "rec": "93.15%", "cv": "92.72%", "rank": "6", "badge": "Tree"},
        {"model": "Support Vector Machine (RBF)", "acc": "93.38%", "f1": "93.01%", "prec": "94.91%", "rec": "91.19%", "cv": "94.13%", "rank": "7", "badge": "Kernel"},
        {"model": "Gradient Boosting", "acc": "91.49%", "f1": "91.30%", "prec": "90.25%", "rec": "92.37%", "cv": "93.14%", "rank": "8", "badge": "Boosting"},
        {"model": "AdaBoost Classifier", "acc": "85.35%", "f1": "85.14%", "prec": "83.46%", "rec": "86.89%", "cv": "84.74%", "rank": "9", "badge": "Boosting"},
        {"model": "SVM (Linear)", "acc": "83.27%", "f1": "83.41%", "prec": "80.04%", "rec": "87.08%", "cv": "84.58%", "rank": "10", "badge": "Linear"},
        {"model": "Logistic Regression", "acc": "82.80%", "f1": "82.67%", "prec": "80.52%", "rec": "84.93%", "cv": "84.22%", "rank": "11", "badge": "Linear"},
        {"model": "Gaussian Naive Bayes", "acc": "81.19%", "f1": "80.66%", "prec": "80.12%", "rec": "81.21%", "cv": "82.10%", "rank": "12", "badge": "Probabilistik"}
    ]

    rows_html = ""
    for b in benchmarks:
        is_best = (b["rank"] == "1")
        row_class = "bg-teal-50/70 font-semibold" if is_best else "hover:bg-slate-50"
        rank_badge = (
            '<span class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-teal-600 text-white text-xs font-bold">1</span>'
            if is_best else f'<span class="text-slate-400 font-mono text-xs">#{b["rank"]}</span>'
        )
        badge_html = (
            '<span class="rounded-full bg-teal-100 text-teal-800 text-xs px-2.5 py-1 border border-teal-200 font-semibold">Terpilih (97.64%)</span>'
            if is_best else f'<span class="rounded-full bg-slate-100 text-slate-600 text-xs px-2.5 py-1 font-medium">{b["badge"]}</span>'
        )
        
        rows_html += f"""
<tr class="{row_class}">
<td class="text-center">{rank_badge}</td>
<td class="text-slate-800">{b["model"]} {badge_html}</td>
<td class="text-right font-mono { 'text-teal-800 font-bold' if is_best else 'text-slate-700' }">{b["acc"]}</td>
<td class="text-right font-mono text-slate-700">{b["prec"]}</td>
<td class="text-right font-mono text-slate-700">{b["rec"]}</td>
<td class="text-right font-mono text-slate-700">{b["f1"]}</td>
<td class="text-right font-mono text-slate-700">{b["cv"]}</td>
</tr>
"""

    return f"""
<section class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm my-5">
<div class="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
<div class="flex items-center gap-2">
{heroicon('trophy', 'h-5 w-5 text-teal-600', size_px=20)}
<h3 class="text-sm font-semibold text-slate-800 m-0">Hasil Eksperimen Komparatif 12 Algoritma Klasifikasi Audio (train.ipynb)</h3>
</div>
<span class="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700 border border-teal-200">
5-Fold Cross Validation
</span>
</div>
<div class="overflow-x-auto">
<table class="custom-table min-w-full text-xs">
<thead>
<tr>
<th style="width: 48px;" class="text-center">Rank</th>
<th>Algoritma Machine Learning</th>
<th class="text-right">Akurasi (Test)</th>
<th class="text-right">Precision</th>
<th class="text-right">Recall</th>
<th class="text-right">F1-Score</th>
<th class="text-right">5-Fold CV</th>
</tr>
</thead>
<tbody>
{rows_html}
</tbody>
</table>
</div>
</section>
"""


def render_smooth_live_visualizer_html() -> str:
    """
    Menghasilkan komponen Visualizer Akustik Real-Time 60 FPS (Web Audio API)
    yang berjalan otomatis saat dibuka, berlatar terang (#F8FAFC), menampilkan Peak & RMS,
    dan bebas dari refresh Streamlit.
    """
    return """
<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: transparent;
    color: #334155;
    overflow: hidden;
  }
  .vis-card {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 1rem;
    padding: 1.1rem 1.25rem;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
  }
  .vis-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #f1f5f9;
    padding-bottom: 0.75rem;
    margin-bottom: 0.85rem;
  }
  .live-dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #0d9488;
    box-shadow: 0 0 6px rgba(13, 148, 136, 0.6);
  }
  .canvas-wrapper {
    position: relative;
    width: 100%;
    height: 140px;
    border-radius: 0.75rem;
    overflow: hidden;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
  }
  canvas {
    width: 100%;
    height: 100%;
    display: block;
  }
  .vu-container {
    position: absolute;
    bottom: 6px;
    left: 12px;
    right: 12px;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.65rem;
    color: #64748b;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  }
  .btn-start {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: #0f766e;
    color: #ffffff;
    border: none;
    border-radius: 0.5rem;
    padding: 0.5rem 1.15rem;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    display: none;
    z-index: 10;
  }
  .btn-start:hover { background: #0d9488; }
</style>
</head>
<body>
<div class="vis-card">
  <div class="vis-header">
    <div style="display: flex; align-items: center; gap: 0.65rem;">
      <span class="live-dot"></span>
      <span style="font-size: 0.875rem; font-weight: 600; color: #1e293b;">Visualizer Gelombang Akustik Mikrofon</span>
      <span style="font-size: 0.75rem; font-weight: 600; color: #0f766e; background: #f0fdfa; border: 1px solid #ccfbf1; padding: 0.2rem 0.65rem; border-radius: 9999px;">
        Akustik Real-Time
      </span>
    </div>

    <div style="display: flex; align-items: center; gap: 0.65rem; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.75rem; color: #475569; background: #f8fafc; border: 1px solid #e2e8f0; padding: 0.35rem 0.8rem; border-radius: 0.5rem;">
      <span>Peak: <strong id="hud-peak" style="color: #0f766e;">0.000</strong></span>
      <span style="color: #cbd5e1;">|</span>
      <span>RMS: <strong id="hud-rms" style="color: #0f766e;">0.000</strong></span>
    </div>
  </div>

  <div class="canvas-wrapper">
    <canvas id="acoustic-canvas" width="900" height="140"></canvas>
    <button id="manual-start-btn" class="btn-start">&#9658; Izinkan Mikrofon</button>

    <div class="vu-container">
      <span style="font-weight: 600; color: #64748b;">LEVEL</span>
      <div style="flex: 1; height: 4px; background: #e2e8f0; border-radius: 2px; overflow: hidden;">
        <div id="vu-bar" style="height: 100%; width: 0%; background: #0d9488; transition: width 0.05s ease-out;"></div>
      </div>
      <span id="db-label" style="min-width: 44px; text-align: right; color: #64748b;">-&infin; dB</span>
    </div>
  </div>
</div>

<script>
let audioCtx = null;
let analyser = null;
let mediaStream = null;
let animId = null;

const canvas = document.getElementById('acoustic-canvas');
const ctx = canvas.getContext('2d');
const hudPeak = document.getElementById('hud-peak');
const hudRms = document.getElementById('hud-rms');
const vuBar = document.getElementById('vu-bar');
const dbLabel = document.getElementById('db-label');
const manualBtn = document.getElementById('manual-start-btn');

function syncCanvasSize() {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);
}
syncCanvasSize();
window.addEventListener('resize', syncCanvasSize);

function drawIdle() {
  const rect = canvas.getBoundingClientRect();
  const w = rect.width;
  const h = rect.height;

  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, w, h);

  // Sumbu tengah halus
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, h / 2);
  ctx.lineTo(w, h / 2);
  ctx.stroke();

  // Garis referensi batas atas & bawah
  ctx.setLineDash([3, 4]);
  ctx.strokeStyle = '#e2e8f0';
  ctx.beginPath();
  ctx.moveTo(0, h / 2 - 25);
  ctx.lineTo(w, h / 2 - 25);
  ctx.moveTo(0, h / 2 + 25);
  ctx.lineTo(w, h / 2 + 25);
  ctx.stroke();
  ctx.setLineDash([]);
}
drawIdle();

async function initAudio() {
  if (audioCtx && audioCtx.state === 'running') return;
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') {
      await audioCtx.resume();
    }
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.5;

    const source = audioCtx.createMediaStreamSource(mediaStream);
    source.connect(analyser);

    manualBtn.style.display = 'none';
    if (!animId) {
      renderAcousticLoop();
    }
  } catch (err) {
    console.warn('Mikrofon memerlukan interaksi awal pengguna:', err);
    manualBtn.style.display = 'block';
  }
}

manualBtn.addEventListener('click', () => {
  initAudio();
});

// Otomatis jalankan saat aplikasi dibuka
window.addEventListener('DOMContentLoaded', initAudio);
window.addEventListener('load', initAudio);
document.addEventListener('click', () => {
  if (!audioCtx || audioCtx.state !== 'running') {
    initAudio();
  }
}, { once: true });
setTimeout(initAudio, 50);
setTimeout(initAudio, 250);

let smoothData = null;

function renderAcousticLoop() {
  animId = requestAnimationFrame(renderAcousticLoop);

  const rect = canvas.getBoundingClientRect();
  const w = rect.width;
  const h = rect.height;

  const bufferLength = analyser.fftSize;
  const timeData = new Uint8Array(bufferLength);
  analyser.getByteTimeDomainData(timeData);

  if (!smoothData || smoothData.length !== bufferLength) {
    smoothData = new Float32Array(bufferLength);
    for (let i = 0; i < bufferLength; i++) smoothData[i] = 128;
  }

  let sumSq = 0;
  let peak = 0;
  const alpha = 0.35;

  for (let i = 0; i < bufferLength; i++) {
    smoothData[i] = smoothData[i] + alpha * (timeData[i] - smoothData[i]);
    const norm = (timeData[i] - 128) / 128.0;
    const absNorm = Math.abs(norm);
    if (absNorm > peak) peak = absNorm;
    sumSq += norm * norm;
  }

  const rms = Math.sqrt(sumSq / bufferLength);

  hudPeak.innerText = peak.toFixed(3);
  hudRms.innerText = rms.toFixed(4);

  const vuPercent = Math.min(100, Math.round(peak * 100));
  vuBar.style.width = vuPercent + '%';
  const dbVal = Math.max(-60, Math.round(20 * Math.log10(rms + 1e-4)));
  dbLabel.innerText = dbVal + ' dB';

  // Latar belakang bersih terang
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, w, h);

  // Sumbu tengah halus
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, h / 2);
  ctx.lineTo(w, h / 2);
  ctx.stroke();

  // Garis ambang batas referensi
  ctx.setLineDash([3, 4]);
  ctx.strokeStyle = '#e2e8f0';
  ctx.beginPath();
  ctx.moveTo(0, h / 2 - 25);
  ctx.lineTo(w, h / 2 - 25);
  ctx.moveTo(0, h / 2 + 25);
  ctx.lineTo(w, h / 2 + 25);
  ctx.stroke();
  ctx.setLineDash([]);

  // Gambar Gelombang Akustik (Teal #0D9488)
  const strokeColor = '#0d9488';
  const gradFill = ctx.createLinearGradient(0, 0, 0, h);
  gradFill.addColorStop(0, 'rgba(13, 148, 136, 0.16)');
  gradFill.addColorStop(0.5, 'rgba(13, 148, 136, 0.05)');
  gradFill.addColorStop(1, 'rgba(13, 148, 136, 0.00)');

  const step = 4;
  const points = [];
  const sliceW = w / (bufferLength / step);

  for (let i = 0; i < bufferLength; i += step) {
    const v = (smoothData[i] - 128) / 128.0;
    const y = h / 2 + (v * (h * 0.44));
    points.push({ x: (i / step) * sliceW, y: y });
  }

  if (points.length > 2) {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);

    for (let i = 1; i < points.length - 2; i++) {
      const xc = (points[i].x + points[i + 1].x) / 2;
      const yc = (points[i].y + points[i + 1].y) / 2;
      ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
    }
    ctx.quadraticCurveTo(
      points[points.length - 2].x, points[points.length - 2].y,
      points[points.length - 1].x, points[points.length - 1].y
    );

    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1.8;
    ctx.stroke();

    ctx.lineTo(w, h / 2);
    ctx.lineTo(0, h / 2);
    ctx.closePath();
    ctx.fillStyle = gradFill;
    ctx.fill();
  }
}
</script>
</body>
</html>
"""

