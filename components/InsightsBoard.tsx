import React, { useState, useMemo } from 'react';
import { Item, ItemStatus, Category } from '../types';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from 'recharts';

interface InsightsBoardProps {
  items: Item[];
}

interface ChartDataPoint {
  date: Date;
  count: number;
  totalActive: number;
}

const CATEGORY_COLORS: Record<string, string> = {
  [Category.DOCUMENTS]: '#009739', // Green
  [Category.ELECTRONICS]: '#fce100', // Yellow
  [Category.CLOTHING]: '#ff9f43', // Orange
  [Category.PETS]: '#ef5350', // Red/Coral
  [Category.BAGS]: '#26a69a', // Teal
  [Category.WALLETS]: '#ec407a', // Pink
  [Category.KEYS]: '#ab47bc', // Purple
  [Category.JEWELRY]: '#26c6da', // Cyan
  [Category.OTHERS]: '#78909c' // Slate/Grey
};

export const InsightsBoard: React.FC<InsightsBoardProps> = ({ items }) => {
  const [isOpen, setIsOpen] = useState(true);
  const [activeMetric, setActiveMetric] = useState<'reunited' | 'active'>('reunited');

  // Compute stats and daily counts for the last 30 days
  const { chartData, totalReunited, totalReported, efficiencyRate, avgDurationDays } = useMemo(() => {
    const dataPoints: ChartDataPoint[] = [];
    const now = new Date();
    
    // 1. Generate 30 days array
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      d.setHours(0, 0, 0, 0);
      dataPoints.push({
        date: d,
        count: 0, // Reunited items
        totalActive: 0 // Active items reported
      });
    }

    let reunitedCount = 0;
    let reportedCount = 0;
    let totalDurations = 0;
    let durationCount = 0;

    items.forEach((item) => {
      const cDate = new Date(item.createdAt || item.date);
      if (isNaN(cDate.getTime())) return;
      const clone = new Date(cDate);
      clone.setHours(0, 0, 0, 0);

      // Stat over last 30 days check
      const diffTime = Math.abs(now.getTime() - cDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays <= 30) {
        reportedCount++;
      }

      // Check for reunited items
      if (item.status === ItemStatus.REUNITED) {
        reunitedCount++;
        // If has a date and a reunitedAt (or createdAt as fallback), calculate duration to recover
        if (item.date && (item.reunitedAt || item.createdAt)) {
          const start = new Date(item.date);
          const end = new Date(item.reunitedAt || item.createdAt);
          const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
          if (days > 0) {
            totalDurations += days;
            durationCount++;
          }
        }
      }

      // Sync counts to 30 day slots
      const matchingPoint = dataPoints.find(p => p.date.getTime() === clone.getTime());
      if (matchingPoint) {
        if (item.status === ItemStatus.REUNITED) {
          matchingPoint.count += 1;
        } else if (
          item.status === ItemStatus.LOST || 
          item.status === ItemStatus.FOUND || 
          item.status === ItemStatus.STOLEN
        ) {
          matchingPoint.totalActive += 1;
        }
      }
    });

    const efficiency = items.length > 0 ? (reunitedCount / items.length) * 100 : 0;
    const avgDuration = durationCount > 0 ? Math.round(totalDurations / durationCount) : 4; // defaults to 4 days

    return {
      chartData: dataPoints,
      totalReunited: reunitedCount,
      totalReported: reportedCount,
      efficiencyRate: efficiency,
      avgDurationDays: avgDuration
    };
  }, [items]);

  // Transform daily trend data for Recharts
  const rechartsDailyData = useMemo(() => {
    return chartData.map((d) => ({
      dateStr: d.date.toLocaleDateString('pt-MZ', { day: '2-digit', month: 'short' }),
      'Itens Reunidos': d.count,
      'Novas Ocorrências': d.totalActive,
    }));
  }, [chartData]);

  // Calculate Monthly Data (Lost vs Recovered over the last 6 months)
  const monthlyData = useMemo(() => {
    const months: {
      year: number;
      month: number;
      name: string;
      fullName: string;
      lost: number;
      recovered: number;
    }[] = [];
    
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        year: d.getFullYear(),
        month: d.getMonth(),
        name: d.toLocaleDateString('pt-MZ', { month: 'short' }),
        fullName: d.toLocaleDateString('pt-MZ', { month: 'long', year: 'numeric' }),
        lost: 0,
        recovered: 0
      });
    }

    items.forEach((item) => {
      const itemDate = new Date(item.createdAt || item.date);
      if (isNaN(itemDate.getTime())) return;
      const yr = itemDate.getFullYear();
      const mo = itemDate.getMonth();

      const match = months.find((m) => m.year === yr && m.month === mo);
      if (match) {
        if (item.status === ItemStatus.LOST || item.status === ItemStatus.STOLEN) {
          match.lost += 1;
        } else if (item.status === ItemStatus.REUNITED) {
          match.recovered += 1;
        }
      }
    });

    return months;
  }, [items]);

  // Transform monthly data for Recharts
  const rechartsMonthlyData = useMemo(() => {
    return monthlyData.map((m) => ({
      name: m.name,
      fullName: m.fullName,
      'Perdidos': m.lost,
      'Recuperados': m.recovered,
    }));
  }, [monthlyData]);

  // Calculate category distribution
  const rechartsPieData = useMemo(() => {
    const counts: Record<string, number> = {};
    items.forEach((item) => {
      const cat = item.category || Category.OTHERS;
      counts[cat] = (counts[cat] || 0) + 1;
    });

    return Object.keys(counts)
      .map((key) => ({
        name: key,
        value: counts[key],
      }))
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [items]);

  // Custom tooltips matching the elegant Mozambique brand
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-900/95 border border-white/10 rounded-2xl p-3 shadow-2xl backdrop-blur-md text-left">
          <p className="text-[9px] font-black uppercase text-gray-400 tracking-wider mb-1">
            {label}
          </p>
          {payload.map((pld: any, index: number) => (
            <div key={index} className="flex items-center gap-2 mt-1">
              <div 
                className="w-2 h-2 rounded-full" 
                style={{ backgroundColor: pld.color || pld.fill }} 
              />
              <span className="text-[10px] font-black text-white">
                {pld.name}: {pld.value}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  const CustomPieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-gray-900/95 border border-white/10 rounded-2xl p-3 shadow-2xl backdrop-blur-md text-left">
          <span 
            className="text-[8px] font-black uppercase tracking-wider block"
            style={{ color: CATEGORY_COLORS[data.name] || '#78909c' }}
          >
            Categoria
          </span>
          <span className="text-[11px] font-black text-white mt-0.5 block uppercase">
            {data.name}: {data.value} {data.value === 1 ? 'item' : 'itens'}
          </span>
        </div>
      );
    }
    return null;
  };

  return (
    <div 
      className="p-4 bg-gray-950 text-white rounded-[2rem] shadow-xl border border-gray-800 font-sans tracking-tight mb-4 shrink-0 transition-all overflow-hidden" 
      id="insights-dashboard-main"
    >
      {/* Header Bar */}
      <div 
        className="flex items-center justify-between mb-3 cursor-pointer select-none" 
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2 text-left">
          <div className="w-8 h-8 rounded-xl bg-[#009739]/20 flex items-center justify-center text-[#009739]">
            <i className="fa-solid fa-chart-line text-xs"></i>
          </div>
          <div>
            <div className="text-[7px] font-black uppercase tracking-widest text-[#fce100]">
              Painel Administrativo
            </div>
            <h3 className="text-sm font-black uppercase leading-none">
              Insights de Recuperação
            </h3>
          </div>
        </div>
        <button 
          className="text-gray-400 hover:text-white p-1 rounded-xl transition-colors hover:bg-white/10"
          id="insights-toggle-btn"
        >
          <i className={`fa-solid ${isOpen ? 'fa-chevron-up' : 'fa-chevron-down'} text-xs`}></i>
        </button>
      </div>

      {isOpen && (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
          
          {/* Top Quick Stats Row */}
          <div className="grid grid-cols-4 gap-2">
            <div className="bg-white/5 border border-white/5 p-2 rounded-2xl text-center">
              <div className="text-[14px] font-black leading-tight text-[#009739]">
                {totalReunited}
              </div>
              <div className="text-[6.5px] font-bold text-gray-400 uppercase tracking-wider mt-0.5 leading-none">
                Reunidos
              </div>
            </div>
            <div className="bg-white/5 border border-white/5 p-2 rounded-2xl text-center">
              <div className="text-[14px] font-black leading-tight text-[#fce100]">
                {efficiencyRate.toFixed(0)}%
              </div>
              <div className="text-[6.5px] font-bold text-gray-400 uppercase tracking-wider mt-0.5 leading-none">
                Taxa Sucesso
              </div>
            </div>
            <div className="bg-white/5 border border-white/5 p-2 rounded-2xl text-center">
              <div className="text-[14px] font-black leading-tight text-white">
                {totalReported}
              </div>
              <div className="text-[6.5px] font-bold text-gray-400 uppercase tracking-wider mt-0.5 leading-none">
                Novos (30D)
              </div>
            </div>
            <div className="bg-white/5 border border-white/5 p-2 rounded-2xl text-center">
              <div className="text-[14px] font-black leading-tight text-sky-400">
                {avgDurationDays}d
              </div>
              <div className="text-[6.5px] font-bold text-gray-400 uppercase tracking-wider mt-0.5 leading-none">
                Tempo Médio
              </div>
            </div>
          </div>

          {/* Metric selector bar */}
          <div className="flex gap-1.5 bg-white/5 p-1 rounded-xl border border-white/5">
            <button
              onClick={() => setActiveMetric('reunited')}
              className={`flex-1 py-1 px-2.5 rounded-lg text-[8px] font-black uppercase tracking-wider transition-all ${
                activeMetric === 'reunited' 
                  ? 'bg-[#009739] text-white shadow-xs' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Itens Reunidos
            </button>
            <button
              onClick={() => setActiveMetric('active')}
              className={`flex-1 py-1 px-2.5 rounded-lg text-[8px] font-black uppercase tracking-wider transition-all ${
                activeMetric === 'active' 
                  ? 'bg-[#d21034] text-white shadow-xs' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Novas Ocorrências (30 dias)
            </button>
          </div>

          {/* Recharts Graphical Trend Area (30 Days) */}
          <div className="relative bg-black/40 rounded-2xl p-3 border border-white/5 h-[190px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart 
                data={rechartsDailyData} 
                margin={{ top: 5, right: 5, left: -25, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="trend-gradient" x1="0" y1="0" x2="0" y2="1">
                    <stop 
                      offset="5%" 
                      stopColor={activeMetric === 'reunited' ? '#009739' : '#d21034'} 
                      stopOpacity={0.4}
                    />
                    <stop 
                      offset="95%" 
                      stopColor={activeMetric === 'reunited' ? '#009739' : '#d21034'} 
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid 
                  strokeDasharray="3 3" 
                  stroke="#334155" 
                  opacity={0.15} 
                  vertical={false} 
                />
                <XAxis 
                  dataKey="dateStr" 
                  tickLine={false} 
                  axisLine={false} 
                  tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 7.5, fontWeight: '700' }} 
                />
                <YAxis 
                  tickLine={false} 
                  axisLine={false} 
                  tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 8, fontWeight: '700' }} 
                  allowDecimals={false} 
                />
                <Tooltip 
                  content={<CustomTooltip />} 
                  cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }} 
                />
                <Area 
                  type="monotone" 
                  dataKey={activeMetric === 'reunited' ? 'Itens Reunidos' : 'Novas Ocorrências'} 
                  stroke={activeMetric === 'reunited' ? '#009739' : '#d21034'} 
                  strokeWidth={2.5} 
                  fillOpacity={1} 
                  fill="url(#trend-gradient)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="text-center text-[7px] font-bold text-gray-500 uppercase flex items-center justify-center gap-1">
            <i className="fa-solid fa-circle-info text-gray-600"></i>
            Passe o rato ou toque no gráfico para consultar as contagens diárias detalhadas.
          </div>

          {/* Grouped Bar Chart Section: Evolução Semestral Perdidos vs Recuperados */}
          <hr className="border-white/5 my-3" />
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[7.5px] font-black uppercase tracking-widest text-[#fce100]">
                  Histórico de 6 Meses
                </span>
                <h4 className="text-xs font-black uppercase leading-none">
                  Itens Perdidos vs. Recuperados
                </h4>
              </div>

              {/* Legends */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-[#d21034] rounded-[2px]" />
                  <span className="text-[7px] font-black uppercase text-gray-400">Perdidos</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-[#009739] rounded-[2px]" />
                  <span className="text-[7px] font-black uppercase text-gray-400">Recuperados</span>
                </div>
              </div>
            </div>

            {/* Recharts Grouped Bar Chart Container */}
            <div className="relative bg-black/40 rounded-2xl p-3 border border-white/5 h-[175px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart 
                  data={rechartsMonthlyData} 
                  margin={{ top: 5, right: 5, left: -25, bottom: 0 }}
                  barGap={3}
                >
                  <CartesianGrid 
                    strokeDasharray="3 3" 
                    stroke="#334155" 
                    opacity={0.15} 
                    vertical={false} 
                  />
                  <XAxis 
                    dataKey="name" 
                    tickLine={false} 
                    axisLine={false} 
                    tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 8, fontWeight: '800' }} 
                    className="uppercase"
                  />
                  <YAxis 
                    tickLine={false} 
                    axisLine={false} 
                    tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 8, fontWeight: '700' }} 
                    allowDecimals={false} 
                  />
                  <Tooltip 
                    content={<CustomTooltip />} 
                    cursor={{ fill: 'rgba(255,255,255,0.04)' }} 
                  />
                  <Bar 
                    dataKey="Perdidos" 
                    fill="#d21034" 
                    radius={[4, 4, 0, 0]} 
                  />
                  <Bar 
                    dataKey="Recuperados" 
                    fill="#009739" 
                    radius={[4, 4, 0, 0]} 
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Donut Chart Section: Ocorrências por Categoria */}
          {rechartsPieData.length > 0 && (
            <>
              <hr className="border-white/5 my-3" />
              <div className="space-y-2">
                <div>
                  <span className="text-[7.5px] font-black uppercase tracking-widest text-[#fce100]">
                    Distribuição por Tipo
                  </span>
                  <h4 className="text-xs font-black uppercase leading-none">
                    Ocorrências por Categoria
                  </h4>
                </div>

                <div className="relative bg-black/40 rounded-2xl p-4 border border-white/5 grid grid-cols-5 items-center gap-3">
                  {/* Left Column (Pie Donut Chart) */}
                  <div className="col-span-2 h-[120px] relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={rechartsPieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={30}
                          outerRadius={45}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {rechartsPieData.map((entry, index) => (
                            <Cell 
                              key={`cell-${index}`} 
                              fill={CATEGORY_COLORS[entry.name] || '#78909c'} 
                            />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomPieTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Right Column (Category Legend) */}
                  <div className="col-span-3 space-y-1.5 max-h-[110px] overflow-y-auto pr-1 text-left scrollbar-thin scrollbar-thumb-white/10">
                    {rechartsPieData.map((entry, index) => (
                      <div key={index} className="flex items-center justify-between text-[9px] font-bold">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <div 
                            className="w-1.5 h-1.5 rounded-full shrink-0" 
                            style={{ backgroundColor: CATEGORY_COLORS[entry.name] || '#78909c' }} 
                          />
                          <span className="text-gray-300 truncate uppercase">
                            {entry.name}
                          </span>
                        </div>
                        <span className="text-white font-black pl-2 shrink-0">
                          {entry.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

        </div>
      )}
    </div>
  );
};
