import React from 'react';
import { HeroIcon } from './HeroIcon';
import { Latex } from './Latex';
import type { ModelInfoResult } from '../services/api';

interface ModelIntelligenceProps {
  modelInfo: ModelInfoResult | null;
}

export const ModelIntelligence: React.FC<ModelIntelligenceProps> = ({ modelInfo }) => {
  return (
    <div className="space-y-6">
      {/* Model Architecture Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-800 border border-teal-200 mb-2">
              <HeroIcon name="cpu" className="w-4 h-4 text-teal-600" />
              <span>Weighted K-Nearest Neighbors (WKNN 4s)</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-800">
              Spesifikasi Arsitektur Model & Metrik Evaluasi
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-1">
              Model dilatih dengan segmentasi sliding window 4.0 detik (hop 1.0s / overlap 75%) dan normalisasi RobustScaler.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 text-right">
              <div className="text-[10px] text-teal-700 uppercase font-semibold">Akurasi Data Uji</div>
              <div className="text-2xl font-bold font-mono text-teal-800">97.64%</div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-right">
              <div className="text-[10px] text-slate-500 uppercase font-semibold">5-Fold CV</div>
              <div className="text-2xl font-bold font-mono text-slate-800">97.58%</div>
            </div>
          </div>
        </div>

        {/* Hyperparameter Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
          <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3">
            <div className="text-[11px] text-slate-500">Jumlah Tetangga (K)</div>
            <div className="text-base font-bold text-slate-800 font-mono mt-0.5">
              <Latex math="K = 4" />
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Menghindari tie biner</div>
          </div>
          <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3">
            <div className="text-[11px] text-slate-500">Bobot Tetangga</div>
            <div className="text-base font-bold text-slate-800 font-mono mt-0.5">
              <Latex math="w = \frac{1}{d}" />
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Inverse Distance Weight</div>
          </div>
          <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3">
            <div className="text-[11px] text-slate-500">Metrik Jarak</div>
            <div className="text-base font-bold text-slate-800 font-mono mt-0.5">
              <Latex math="d(x,y) = \|x-y\|_2" />
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Jarak geometris vektor</div>
          </div>
          <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3">
            <div className="text-[11px] text-slate-500">Metode Normalisasi</div>
            <div className="text-base font-bold text-teal-700 font-mono mt-0.5">
              <Latex math="\frac{x - Q_2}{Q_3 - Q_1}" />
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">RobustScaler (Median & IQR)</div>
          </div>
        </div>
      </div>

      {/* Confusion Matrix & Classification Report */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Confusion Matrix Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <HeroIcon name="table-cells" className="w-5 h-5 text-teal-600" />
              <h3 className="text-sm font-bold text-slate-800">
                Matriks Kebingungan (Confusion Matrix N=1.058)
              </h3>
            </div>
            <span className="text-[11px] font-mono text-teal-700 font-semibold bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
              Test Set 20%
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="bg-teal-50 border-2 border-teal-200 rounded-xl p-4">
              <div className="text-[11px] font-medium text-teal-800 mb-1">True Non-Berisik (Kondusif)</div>
              <div className="text-3xl font-extrabold font-mono text-teal-700">540</div>
              <div className="text-[10px] text-teal-600 mt-1">98.72% dari aktual non-berisik</div>
            </div>
            <div className="bg-rose-50/60 border border-rose-200 rounded-xl p-4">
              <div className="text-[11px] font-medium text-rose-800 mb-1">False Alarm (Salah Tebak Bising)</div>
              <div className="text-3xl font-extrabold font-mono text-rose-600">7</div>
              <div className="text-[10px] text-rose-500 mt-1">Hanya 1.28% false positive</div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <div className="text-[11px] font-medium text-slate-600 mb-1">False Clean (Terlewat)</div>
              <div className="text-3xl font-extrabold font-mono text-slate-600">18</div>
              <div className="text-[10px] text-slate-500 mt-1">3.52% false negative</div>
            </div>
            <div className="bg-rose-100/70 border-2 border-rose-300 rounded-xl p-4">
              <div className="text-[11px] font-medium text-rose-900 mb-1">True Berisik (Bising)</div>
              <div className="text-3xl font-extrabold font-mono text-rose-700">493</div>
              <div className="text-[10px] text-rose-600 mt-1">96.48% dari aktual berisik</div>
            </div>
          </div>

          <div className="text-[11px] text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-200/80">
            Precision Berisik mencapai <span className="font-semibold text-slate-800">98.60%</span>. Artinya dari setiap 100 kali model memberikan peringatan berisik, hampir 99 di antaranya terbukti akurat bising di lapangan.
          </div>
        </div>

        {/* Dataset & Parameter Processing */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <HeroIcon name="shield-check" className="w-5 h-5 text-teal-600" />
              <h3 className="text-sm font-bold text-slate-800">
                Karakteristik Dataset & Segmentasi Audio
              </h3>
            </div>
            <span className="text-[11px] font-mono text-slate-600">
              audio_features_4s.csv
            </span>
          </div>

          <div className="space-y-3 text-xs text-slate-700">
            <div className="flex justify-between items-center py-2 border-b border-slate-100">
              <span className="text-slate-500">Total Baris Segmen Fitur:</span>
              <span className="font-mono font-bold text-slate-800">5.286 baris</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-100">
              <span className="text-slate-500">Distribusi Kelas Latih:</span>
              <span className="font-mono text-slate-800">
                2.732 Non-Berisik (51.7%) vs 2.554 Berisik (48.3%)
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-100">
              <span className="text-slate-500">Resolusi Jendela (Window):</span>
              <span className="font-mono text-teal-700 font-semibold">
                4.0 Detik (88.200 sampel @ 22.050 Hz)
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-100">
              <span className="text-slate-500">Pergeseran Jendela (Hop / Overlap):</span>
              <span className="font-mono text-teal-700 font-semibold">
                1.0 Detik (Overlap 75%)
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-100">
              <span className="text-slate-500">Pembersihan Hening (Silence Trimming):</span>
              <span className="font-mono text-slate-800">RMS &gt;= 0.015 pada kelas berisik</span>
            </div>
          </div>

          <div className="text-[11px] text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-200/80">
            Teknik sliding window dengan overlap 75% menghasilkan 5.286 sampel audio nyata tanpa data sintetis buatan dan menjaga kontinuitas gelombang mikrofon real-time.
          </div>
        </div>
      </div>

      {/* Kamus 16 Fitur Akustik PSD */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <HeroIcon name="waveform" className="w-5 h-5 text-teal-600" />
            <h3 className="text-base font-bold text-slate-800">
              Kamus 16 Parameter Akustik Pengolahan Sinyal Digital (PSD)
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Enam belas fitur diekstraksi dari domain waktu, frekuensi, dan psikoakustik Mel pada setiap bingkai waktu 4.0 detik.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {modelInfo?.features_documentation.map((feat, idx) => (
            <div
              key={idx}
              className="border border-slate-200 rounded-xl p-4 hover:border-teal-300 transition-colors bg-slate-50/50"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-slate-800">{feat.name}</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200">
                  {feat.category}
                </span>
              </div>
              <p className="text-xs text-slate-600 mb-2 leading-relaxed">
                {feat.description}
              </p>
              <div className="bg-white border border-slate-200/90 rounded-xl px-4 py-3 shadow-sm overflow-x-auto flex items-center justify-center min-h-[58px]">
                <Latex math={feat.formula} block={true} className="text-teal-900 text-sm font-medium" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
