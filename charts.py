"""
Modul Visualisasi Grafik Plotly: Gelombang Audio Real-Time dan Distribusi Koefisien Spektral
Sesuai Tema Desain: IBM Plex Sans, Tailwind Colors (Teal, Ink, Slate, Rose)
Tanpa Emote / Emoji
Durasi Analisis: 4 Detik per Siklus (Model 4s) + Visualisasi Real-Time Live Stream
"""

import numpy as np
import plotly.graph_objects as go

# Palet Warna Sesuai Desain Tailwind
COLOR_TEAL = "#0F766E"       # Teal-700
COLOR_TEAL_FILL = "rgba(15, 118, 110, 0.12)"
COLOR_ROSE = "#E11D48"       # Rose-600
COLOR_ROSE_FILL = "rgba(225, 29, 72, 0.15)"
COLOR_SLATE_GRID = "#F1F5F9" # Slate-100
COLOR_TEXT = "#1E293B"       # Slate-800 (Soft deep neutral, no harsh black)
COLOR_SUBTEXT = "#64748B"    # Slate-500
FONT_FAMILY = "IBM Plex Sans, ui-sans-serif, system-ui, sans-serif"

def create_realtime_waveform_figure(
    audio_samples: np.ndarray,
    sr: int = 22050,
    status: str = "NON-BERISIK",
    live_rms: float = 0.0,
    live_peak: float = 0.0
) -> go.Figure:
    """
    Membuat grafik gelombang amplitudo audio real-time (Live Streaming ~0.5s).
    Menampilkan pergerakan sinyal langsung berkecepatan tinggi yang terus mengalir
    dengan indikator visual puncak suara (Peak) dan RMS saat ini.
    """
    total_samples = len(audio_samples)
    if total_samples == 0:
        audio_samples = np.zeros(int(sr * 1.0), dtype=np.float32)
        total_samples = len(audio_samples)

    # Batasi ke 1.0 - 1.5 detik terakhir untuk visualisasi real-time yang fokus dan dinamis
    max_rt_samples = int(sr * 1.5)
    if total_samples > max_rt_samples:
        audio_samples = audio_samples[-max_rt_samples:]
        total_samples = len(audio_samples)

    duration = total_samples / sr

    # Hitung live peak & live rms jika belum dihitung
    if live_peak <= 0.0 and total_samples > 0:
        live_peak = float(np.max(np.abs(audio_samples)))
    if live_rms <= 0.0 and total_samples > 0:
        live_rms = float(np.sqrt(np.mean(audio_samples ** 2)))

    # Downsampling untuk render secepat kilat (600 titik)
    target_points = 600
    if total_samples > target_points:
        step = max(1, total_samples // target_points)
        sub_samples = audio_samples[::step]
        time_axis = np.linspace(0, duration, len(sub_samples))
    else:
        sub_samples = audio_samples
        time_axis = np.linspace(0, duration, total_samples)

    # Deteksi apakah amplitudo saat ini tergolong berisik / aktif
    is_active_noise = (status == "BERISIK") or (live_rms >= 0.015) or (live_peak >= 0.08)
    line_color = "#E11D48" if is_active_noise else "#0D9488"
    fill_color = "rgba(225, 29, 72, 0.18)" if is_active_noise else "rgba(13, 148, 136, 0.14)"

    fig = go.Figure()

    # Gelombang Suara Real-Time
    fig.add_trace(go.Scatter(
        x=time_axis,
        y=sub_samples,
        mode='lines',
        name='Sinyal Real-Time',
        line=dict(color=line_color, width=1.8),
        fill='tozeroy',
        fillcolor=fill_color,
        hovertemplate="Waktu: %{x:.2f}s<br>Amplitudo: %{y:.3f}<extra></extra>"
    ))

    # Garis Ambang Batas Kebisingan (Threshold Silence Trimming RMS = 0.015)
    fig.add_trace(go.Scatter(
        x=[0, duration],
        y=[0.015, 0.015],
        mode='lines',
        name='Ambang Berisik (+0.015)',
        line=dict(color='#F59E0B', width=1.2, dash='dot'),
        hoverinfo='name'
    ))
    fig.add_trace(go.Scatter(
        x=[0, duration],
        y=[-0.015, -0.015],
        mode='lines',
        name='Ambang Berisik (-0.015)',
        line=dict(color='#F59E0B', width=1.2, dash='dot'),
        hoverinfo='name'
    ))

    y_max = max(0.15, float(np.max(np.abs(sub_samples))) * 1.25)
    y_max = min(1.05, y_max)

    tag_status = "BERISIK" if is_active_noise else "NORMAL"
    title_text = f"<b>Gelombang Real-Time (Live Mikrofon) &bull; {tag_status}</b> <span style='font-size:11px; font-weight:normal; color:#64748B;'>| Peak: {live_peak:.3f} | RMS: {live_rms:.4f}</span>"

    fig.update_layout(
        title=dict(
            text=title_text,
            font=dict(family=FONT_FAMILY, size=12, color=COLOR_TEXT),
            x=0.01,
            y=0.96
        ),
        margin=dict(l=45, r=20, t=35, b=35),
        height=240,
        paper_bgcolor="#FFFFFF",
        plot_bgcolor="#FFFFFF",
        font=dict(family=FONT_FAMILY, color=COLOR_SUBTEXT, size=11),
        xaxis=dict(
            title=dict(text="Jendela Live (Detik)", font=dict(size=11, color=COLOR_SUBTEXT)),
            showgrid=True,
            gridcolor=COLOR_SLATE_GRID,
            zeroline=True,
            zerolinecolor="#CBD5E1",
            zerolinewidth=1,
            range=[0, duration]
        ),
        yaxis=dict(
            title=dict(text="Amplitudo", font=dict(size=11, color=COLOR_SUBTEXT)),
            showgrid=True,
            gridcolor=COLOR_SLATE_GRID,
            zeroline=True,
            zerolinecolor="#CBD5E1",
            range=[-y_max, y_max]
        ),
        showlegend=False
    )

    return fig

def create_waveform_figure(audio_samples: np.ndarray, sr: int = 22050, status: str = "NON-BERISIK", rms: float = 0.0) -> go.Figure:
    """
    Membuat grafik gelombang amplitudo audio jendela analisis 4.0 detik (Snapshot Evaluasi Model).
    Warna garis dan area otomatis berganti sesuai status (Teal untuk Aman, Rose untuk Berisik).
    """
    total_samples = len(audio_samples)
    if total_samples == 0:
        audio_samples = np.zeros(sr * 4, dtype=np.float32)
        total_samples = len(audio_samples)

    duration = total_samples / sr
    
    # Downsampling untuk render secepat kilat (1200 titik)
    target_points = 1200
    if total_samples > target_points:
        step = max(1, total_samples // target_points)
        sub_samples = audio_samples[::step]
        time_axis = np.linspace(0, duration, len(sub_samples))
    else:
        sub_samples = audio_samples
        time_axis = np.linspace(0, duration, total_samples)

    is_noisy = (status == "BERISIK")
    line_color = COLOR_ROSE if is_noisy else COLOR_TEAL
    fill_color = COLOR_ROSE_FILL if is_noisy else COLOR_TEAL_FILL

    fig = go.Figure()

    # Gelombang Suara Utama
    fig.add_trace(go.Scatter(
        x=time_axis,
        y=sub_samples,
        mode='lines',
        name='Amplitudo Sinyal',
        line=dict(color=line_color, width=1.75),
        fill='tozeroy',
        fillcolor=fill_color,
        hovertemplate="Waktu: %{x:.2f}s<br>Amplitudo: %{y:.3f}<extra></extra>"
    ))

    # Garis Referensi RMS Positif & Negatif
    if rms > 0.001:
        fig.add_trace(go.Scatter(
            x=[0, duration],
            y=[rms, rms],
            mode='lines',
            name=f'+RMS ({rms:.3f})',
            line=dict(color='#F59E0B', width=1.2, dash='dot'),
            hoverinfo='name'
        ))
        fig.add_trace(go.Scatter(
            x=[0, duration],
            y=[-rms, -rms],
            mode='lines',
            name=f'-RMS (-{rms:.3f})',
            line=dict(color='#F59E0B', width=1.2, dash='dot'),
            hoverinfo='name'
        ))

    y_max = max(0.25, float(np.max(np.abs(sub_samples))) * 1.15)
    y_max = min(1.05, y_max)

    fig.update_layout(
        title=dict(
            text=f"<b>Gelombang Jendela Analisis ({duration:.1f} Detik - Evaluasi KNN)</b>",
            font=dict(family=FONT_FAMILY, size=12, color=COLOR_TEXT),
            x=0.01,
            y=0.96
        ),
        margin=dict(l=45, r=20, t=35, b=35),
        height=240,
        paper_bgcolor="#FFFFFF",
        plot_bgcolor="#FFFFFF",
        font=dict(family=FONT_FAMILY, color=COLOR_SUBTEXT, size=11),
        xaxis=dict(
            title=dict(text="Waktu Jendela (Detik)", font=dict(size=11, color=COLOR_SUBTEXT)),
            showgrid=True,
            gridcolor=COLOR_SLATE_GRID,
            zeroline=True,
            zerolinecolor="#CBD5E1",
            zerolinewidth=1,
            range=[0, duration]
        ),
        yaxis=dict(
            title=dict(text="Amplitudo", font=dict(size=11, color=COLOR_SUBTEXT)),
            showgrid=True,
            gridcolor=COLOR_SLATE_GRID,
            zeroline=True,
            zerolinecolor="#CBD5E1",
            range=[-y_max, y_max]
        ),
        showlegend=False
    )

    return fig

def create_mfcc_figure(mfccs: list, status: str = "NON-BERISIK") -> go.Figure:
    """
    Membuat grafik distribusi 13 koefisien MFCC (Mel-Frequency Cepstral Coefficients).
    Fitur ini merupakan input utama spektral pada model KNN.
    """
    labels = [f"MFCC {i+1}" for i in range(len(mfccs))]
    is_noisy = (status == "BERISIK")
    
    # Warna Bar bertingkat
    bar_colors = []
    for val in mfccs:
        if is_noisy:
            bar_colors.append("#E11D48" if val >= 0 else "#FB7185")
        else:
            bar_colors.append("#0F766E" if val >= 0 else "#2DD4BF")

    fig = go.Figure()
    fig.add_trace(go.Bar(
        x=labels,
        y=mfccs,
        marker=dict(
            color=bar_colors,
            line=dict(color="rgba(0,0,0,0.05)", width=1)
        ),
        hovertemplate="<b>%{x}</b><br>Nilai: %{y:.2f}<extra></extra>"
    ))

    fig.update_layout(
        title=dict(
            text="<b>Profil 13 Koefisien Spektral MFCC (Selubung Timbre Audio)</b>",
            font=dict(family=FONT_FAMILY, size=12, color=COLOR_TEXT),
            x=0.01,
            y=0.96
        ),
        margin=dict(l=45, r=20, t=35, b=35),
        height=240,
        paper_bgcolor="#FFFFFF",
        plot_bgcolor="#FFFFFF",
        font=dict(family=FONT_FAMILY, color=COLOR_SUBTEXT, size=11),
        xaxis=dict(
            showgrid=False,
            tickangle=-45
        ),
        yaxis=dict(
            title=dict(text="Koefisien", font=dict(size=11, color=COLOR_SUBTEXT)),
            showgrid=True,
            gridcolor=COLOR_SLATE_GRID,
            zeroline=True,
            zerolinecolor="#CBD5E1"
        ),
        showlegend=False
    )

    return fig

def create_file_waveform_timeline(full_audio: np.ndarray, segments: list, sr: int = 22050) -> go.Figure:
    """
    Membuat visualisasi waveform audio utuh dari file dengan highlight segmen:
    Hijau muda untuk segmen NON-BERISIK, Merah muda untuk segmen BERISIK.
    """
    total_samples = len(full_audio)
    total_duration = total_samples / sr

    # Downsample untuk performa tinggi
    target_points = 2500
    if total_samples > target_points:
        step = max(1, total_samples // target_points)
        sub_samples = full_audio[::step]
        time_axis = np.linspace(0, total_duration, len(sub_samples))
    else:
        sub_samples = full_audio
        time_axis = np.linspace(0, total_duration, total_samples)

    fig = go.Figure()

    # Berikan highlight latar belakang per segmen
    shapes = []
    seg_duration = total_duration / len(segments) if len(segments) > 0 else 4.0
    
    for seg in segments:
        idx = seg["segment_idx"] - 1
        t_start = idx * seg_duration
        t_end = min((idx + 1) * seg_duration, total_duration)
        is_noisy = (seg["status"] == "BERISIK")
        bg_color = "rgba(225, 29, 72, 0.12)" if is_noisy else "rgba(15, 118, 110, 0.08)"
        
        shapes.append(dict(
            type="rect",
            xref="x",
            yref="paper",
            x0=t_start,
            x1=t_end,
            y0=0,
            y1=1,
            fillcolor=bg_color,
            line=dict(width=0.75, color="rgba(203, 213, 225, 0.5)", dash="dot"),
            layer="below"
        ))

    # Gelombang suara utama
    fig.add_trace(go.Scatter(
        x=time_axis,
        y=sub_samples,
        mode='lines',
        name='Sinyal Audio',
        line=dict(color="#334155", width=1.2),
        hovertemplate="Waktu: %{x:.2f}s<br>Amplitudo: %{y:.3f}<extra></extra>"
    ))

    fig.update_layout(
        title=dict(
            text=f"<b>Peta Segmentasi Audio ({total_duration:.1f} Detik, {len(segments)} Segmen)</b>",
            font=dict(family=FONT_FAMILY, size=13, color=COLOR_TEXT),
            x=0.01,
            y=0.96
        ),
        shapes=shapes,
        margin=dict(l=45, r=20, t=35, b=35),
        height=260,
        paper_bgcolor="#FFFFFF",
        plot_bgcolor="#FFFFFF",
        font=dict(family=FONT_FAMILY, color=COLOR_SUBTEXT, size=11),
        xaxis=dict(
            title=dict(text="Durasi Total (Detik)", font=dict(size=11, color=COLOR_SUBTEXT)),
            showgrid=True,
            gridcolor=COLOR_SLATE_GRID,
            zeroline=True,
            zerolinecolor="#CBD5E1",
            range=[0, total_duration]
        ),
        yaxis=dict(
            title=dict(text="Amplitudo", font=dict(size=11, color=COLOR_SUBTEXT)),
            showgrid=True,
            gridcolor=COLOR_SLATE_GRID,
            zeroline=True,
            zerolinecolor="#CBD5E1"
        ),
        showlegend=False
    )

    return fig
