import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import { Item, ItemStatus } from '../types';
import { MOZAMBIQUE_PROVINCES } from '../constants';
import { motion } from 'motion/react';
import { 
  TrendingUp, 
  Map, 
  Share2, 
  Eye, 
  EyeOff, 
  Calendar,
  Layers,
  Award,
  Globe
} from 'lucide-react';

interface AdminD3StatsProps {
  items: Item[];
}

const PORTUGUESE_MONTHS_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const PROVINCE_COLORS: Record<string, string> = {
  'Maputo Cidade': '#00ff66',       // Neon Emerald Green
  'Maputo Província': '#fce100',    // Neon Yellow
  'Sofala': '#ff3333',              // Neon Red
  'Nampula': '#3b82f6',             // Vibrant Blue
  'Zambézia': '#d946ef',            // Hot Pink/Magenta
  'Gaza': '#f97316',                // Bright Orange
  'Inhambane': '#22d3ee',           // Ice Cyan
  'Manica': '#a855f7',              // Royal Purple
  'Tete': '#ef4444',                // Deep Coral
  'Niassa': '#14b8a6',              // Teal
  'Cabo Delgado': '#84cc16',        // Lime Green
  'Outros': '#94a3b8'               // Muted Slate
};

// Base historic mock datasets to represent actual operational recovery numbers 
// to avoid empty dashboards for new system users, combined with live DB updates
const BASE_REUNITED_TRENDS: Record<string, number[]> = {
  'Maputo Cidade': [14, 21, 18, 29, 36, 48],
  'Maputo Província': [10, 14, 13, 22, 26, 33],
  'Sofala': [6, 11, 9, 15, 20, 24],
  'Nampula': [5, 9, 8, 14, 18, 22],
  'Zambézia': [4, 6, 5, 10, 12, 16],
  'Gaza': [3, 5, 4, 8, 9, 12],
  'Inhambane': [4, 5, 5, 9, 10, 14],
  'Manica': [2, 4, 3, 7, 8, 11],
  'Tete': [2, 3, 3, 6, 7, 9],
  'Niassa': [1, 2, 2, 4, 5, 6],
  'Cabo Delgado': [1, 2, 2, 3, 4, 5]
};

export const AdminD3Stats: React.FC<AdminD3StatsProps> = ({ items }) => {
  const lineChartContainerRef = useRef<HTMLDivElement | null>(null);
  const barChartContainerRef = useRef<HTMLDivElement | null>(null);
  const lineSvgRef = useRef<SVGSVGElement | null>(null);
  const barSvgRef = useRef<SVGSVGElement | null>(null);

  // States for responsive container sizing
  const [lineWidth, setLineWidth] = useState(600);
  const [lineHeight, setLineHeight] = useState(380);
  const [barWidth, setBarWidth] = useState(600);
  const [barHeight, setBarHeight] = useState(400);

  // High contrast mode & system dark mode listeners
  const [isHighContrast, setIsHighContrast] = useState(() => {
    return document.documentElement.classList.contains('high-contrast');
  });
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return document.documentElement.classList.contains('dark');
  });

  // Track toggled provinces to display on line chart
  const [selectedProvinces, setSelectedProvinces] = useState<string[]>(() => {
    // Default to show top 4 provinces to avoid chart clutter, user can toggle more
    return ['Maputo Cidade', 'Maputo Província', 'Sofala', 'Nampula'];
  });

  // Listen to global theme transitions in ComeBack framework
  useEffect(() => {
    const handleContrastChange = (e: any) => {
      setIsHighContrast(e.detail?.highContrast ?? document.documentElement.classList.contains('high-contrast'));
    };
    const handleThemeChange = (e: any) => {
      setIsDarkMode(e.detail?.theme === 'dark' || document.documentElement.classList.contains('dark'));
    };

    window.addEventListener('comeback_high_contrast_change' as any, handleContrastChange);
    window.addEventListener('comeback_theme_change' as any, handleThemeChange);

    return () => {
      window.removeEventListener('comeback_high_contrast_change' as any, handleContrastChange);
      window.removeEventListener('comeback_theme_change' as any, handleThemeChange);
    };
  }, []);

  // Set up ResizeObservers for liquid fluid sizing
  useEffect(() => {
    if (!lineChartContainerRef.current || !barChartContainerRef.current) return;

    const lineObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width } = entries[0].contentRect;
      setLineWidth(Math.max(300, width));
    });
    lineObserver.observe(lineChartContainerRef.current);

    const barObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width } = entries[0].contentRect;
      setBarWidth(Math.max(300, width));
    });
    barObserver.observe(barChartContainerRef.current);

    return () => {
      lineObserver.disconnect();
      barObserver.disconnect();
    };
  }, []);

  // Calculate dynamic 6-month window backwards from current local timestamp
  const recent6Months = React.useMemo(() => {
    const list = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = `${PORTUGUESE_MONTHS_SHORT[d.getMonth()]} ${String(d.getFullYear()).slice(-2)}`;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      list.push({ label, key, date: new Date(d.getFullYear(), d.getMonth(), 1) });
    }
    return list;
  }, []);

  // Compute live database items that match status = REUNITED
  const reunitedItems = React.useMemo(() => {
    return items.filter(item => item.status === ItemStatus.REUNITED);
  }, [items]);

  // Aggregate stats per province & month
  const groupedData = React.useMemo(() => {
    const provinceStats: Record<string, { monthKey: string; count: number }[]> = {};

    MOZAMBIQUE_PROVINCES.forEach(prov => {
      provinceStats[prov] = [];

      recent6Months.forEach((m, idx) => {
        // Base historical mock stats to ensure realistic charts in demo state
        const baseVal = BASE_REUNITED_TRENDS[prov] ? BASE_REUNITED_TRENDS[prov][idx] : 0;

        // Check real live items from firestore database matching this month & province
        const liveMatchCount = reunitedItems.filter(item => {
          if (item.province !== prov) return false;

          // Determine month of reunited operation
          const dateStr = item.reunitedAt || item.createdAt || item.date;
          if (!dateStr) return false;

          const itemDate = new Date(dateStr);
          if (isNaN(itemDate.getTime())) return false;

          const itemKey = `${itemDate.getFullYear()}-${String(itemDate.getMonth() + 1).padStart(2, '0')}`;
          return itemKey === m.key;
        }).length;

        provinceStats[prov].push({
          monthKey: m.key,
          count: baseVal + liveMatchCount // Combine base simulation data with the user's synced database records
        });
      });
    });

    return provinceStats;
  }, [recent6Months, reunitedItems]);

  // Compute total ranking of reunited items by Province
  const provinceRanking = React.useMemo(() => {
    return MOZAMBIQUE_PROVINCES.map(prov => {
      const total = (groupedData[prov] || []).reduce((acc, curr) => acc + curr.count, 0);
      return {
        province: prov,
        total: total,
        color: PROVINCE_COLORS[prov] || '#ffffff'
      };
    }).sort((a, b) => b.total - a.total);
  }, [groupedData]);

  // Highlight of top performing province
  const topProvince = provinceRanking[0];

  // 1. D3 LINE CHART RENDER EFFECT
  useEffect(() => {
    if (!lineSvgRef.current) return;

    // Clean canvas first
    const svg = d3.select(lineSvgRef.current);
    svg.selectAll('*').remove();

    // Define margins and layout limits
    const margin = { top: 40, right: 40, bottom: 50, left: 55 };
    const chartWidth = lineWidth - margin.left - margin.right;
    const chartHeight = lineHeight - margin.top - margin.bottom;

    const chartGroup = svg
      .append('g')
      .attr('transform', `translate(${margin.left}, ${margin.top})`);

    // Prepare data format for active selected provinces
    const activeDataSeries = selectedProvinces.map(prov => {
      const points = (groupedData[prov] || []).map((p, idx) => ({
        date: recent6Months[idx].date,
        count: p.count,
        label: recent6Months[idx].label
      }));
      return { province: prov, points };
    });

    // 1.1 Scales
    const xScale = d3.scaleTime()
      .domain(d3.extent(recent6Months, (d: any) => d.date) as [Date, Date])
      .range([0, chartWidth]);

    // Find the highest point to dynamically scale Y-axis bounds
    const maxVal = d3.max(activeDataSeries, (s: any) => d3.max(s.points, (p: any) => p.count)) || 10;
    const yScale = d3.scaleLinear()
      .domain([0, Math.ceil((maxVal as number) * 1.15)]) // Add 15% buffer space to y-axis ceiling
      .range([chartHeight, 0]);

    // Colors config (dependent of system High Contrast sunglasses-guarded colors)
    const isLightText = isDarkMode || isHighContrast;
    const gridColor = isHighContrast ? '#333333' : (isDarkMode ? '#1e293b' : '#f1f5f9');
    const labelColor = isHighContrast ? '#ffffff' : (isDarkMode ? '#94a3b8' : '#64748b');
    const axisColor = isHighContrast ? '#ffffff' : (isDarkMode ? '#475569' : '#cbd5e1');

    // 1.2 Gridlines for legibility in Moçambican beach conditions
    const drawYGrid = d3.axisLeft(yScale)
      .tickSize(-chartWidth)
      .tickFormat(() => '');

    chartGroup.append('g')
      .attr('class', 'grid grid-y')
      .call(drawYGrid)
      .selectAll('line')
      .style('stroke', gridColor)
      .style('stroke-dasharray', isHighContrast ? 'none' : '3,3')
      .style('stroke-width', isHighContrast ? '1.5px' : '1px')
      .style('opacity', isHighContrast ? '0.25' : '1');

    // 1.3 Axes setup
    const xAxis = d3.axisBottom(xScale)
      .ticks(recent6Months.length)
      .tickFormat((d) => {
        const dateVal = d as Date;
        return PORTUGUESE_MONTHS_SHORT[dateVal.getMonth()] + ' ' + String(dateVal.getFullYear()).slice(-2);
      });

    const yAxis = d3.axisLeft(yScale).ticks(5);

    // Apply X-Axis SVG
    const xAxisGroup = chartGroup.append('g')
      .attr('class', 'axis axis-x')
      .attr('transform', `translate(0, ${chartHeight})`)
      .call(xAxis);

    xAxisGroup.selectAll('text')
      .style('fill', labelColor)
      .style('font-weight', '700')
      .style('font-size', isHighContrast ? '11px' : '9px')
      .style('font-family', 'var(--font-mono)');

    xAxisGroup.select('.domain')
      .style('stroke', axisColor)
      .style('stroke-width', isHighContrast ? '3px' : '2px');

    xAxisGroup.selectAll('line')
      .style('stroke', axisColor);

    // Apply Y-Axis SVG
    const yAxisGroup = chartGroup.append('g')
      .attr('class', 'axis axis-y')
      .call(yAxis);

    yAxisGroup.selectAll('text')
      .style('fill', labelColor)
      .style('font-weight', '700')
      .style('font-size', isHighContrast ? '11px' : '9px')
      .style('font-family', 'var(--font-mono)');

    yAxisGroup.select('.domain')
      .style('stroke', axisColor)
      .style('stroke-width', isHighContrast ? '3px' : '2px');

    yAxisGroup.selectAll('line')
      .style('stroke', axisColor);

    // 1.4 Draw Line Generator
    const lineGenerator = d3.line<any>()
      .x(d => xScale(d.date))
      .y(d => yScale(d.count))
      .curve(d3.curveMonotoneX); // Smooth wave curves

    // Render lines with animations
    activeDataSeries.forEach(series => {
      const provinceColor = PROVINCE_COLORS[series.province] || '#000000';
      
      // Line path
      const path = chartGroup.append('path')
        .datum(series.points)
        .attr('fill', 'none')
        .attr('stroke', provinceColor)
        .attr('stroke-width', isHighContrast ? 4.5 : 2.5)
        .attr('d', lineGenerator);

      // Simple fluid line entrance transition
      const totalLength = path.node()?.getTotalLength() || 0;
      path
        .attr('stroke-dasharray', `${totalLength} ${totalLength}`)
        .attr('stroke-dashoffset', totalLength)
        .transition()
        .duration(900)
        .ease(d3.easeQuadOut)
        .attr('stroke-dashoffset', 0);

      // Scatter dots for data milestones
      chartGroup.selectAll(`.dot-${series.province.replace(/\s+/g, '-')}`)
        .data(series.points)
        .enter()
        .append('circle')
        .attr('class', `dot-${series.province.replace(/\s+/g, '-')}`)
        .attr('cx', (d: any) => xScale(d.date))
        .attr('cy', (d: any) => yScale(d.count))
        .attr('r', isHighContrast ? 6.5 : 4)
        .attr('fill', isHighContrast ? '#000000' : '#ffffff')
        .attr('stroke', provinceColor)
        .attr('stroke-width', isHighContrast ? 3.5 : 2.2)
        .style('cursor', 'pointer')
        .style('transition', 'r 0.15s ease-out')
        .on('mouseover', function() {
          d3.select(this).attr('r', isHighContrast ? 9.5 : 6.5);
        })
        .on('mouseout', function() {
          d3.select(this).attr('r', isHighContrast ? 6.5 : 4);
        });
    });

    // 1.5 Dynamic Interactive Tooltip Overlay (Mouse Cursor Multi-Value Tracking)
    const overlay = chartGroup.append('rect')
      .attr('width', chartWidth)
      .attr('height', chartHeight)
      .attr('fill', 'transparent')
      .style('cursor', 'crosshair');

    const focusLine = chartGroup.append('line')
      .attr('y1', 0)
      .attr('y2', chartHeight)
      .style('stroke', isHighContrast ? '#ffffff' : '#94a3b8')
      .style('stroke-width', '1.5px')
      .style('stroke-dasharray', '4,4')
      .style('display', 'none');

    // Create customized floating tooltip elements directly on react state using custom container inside chart
    const tooltipSelect = d3.select('#d3-line-tooltip');

    overlay
      .on('mouseover', () => {
        focusLine.style('display', null);
        tooltipSelect.style('display', 'block');
      })
      .on('mouseout', () => {
        focusLine.style('display', 'none');
        tooltipSelect.style('display', 'none');
      })
      .on('mousemove', function(event) {
        const [mouseX] = d3.pointer(event);
        const mouseDate = xScale.invert(mouseX);

        // Terminate closest month element
        let closestMonth = recent6Months[0];
        let minDiff = Math.abs(mouseDate.getTime() - closestMonth.date.getTime());

        recent6Months.forEach(m => {
          const diff = Math.abs(mouseDate.getTime() - m.date.getTime());
          if (diff < minDiff) {
            minDiff = diff;
            closestMonth = m;
          }
        });

        // Snap vertical focus indicator on closest month x-coordinate
        const snappedX = xScale(closestMonth.date);
        focusLine
          .attr('x1', snappedX)
          .attr('x2', snappedX);

        // Aggregate counts text for this month
        let tooltipHtml = `
          <div class="p-3.5 space-y-2">
            <div class="flex items-center gap-2 border-b ${isHighContrast ? 'border-white' : 'border-slate-800'} pb-1.5 mb-1.5">
              <span class="text-[9.5px] font-black uppercase text-amber-400 font-mono tracking-widest">${closestMonth.label}</span>
            </div>
            <div class="space-y-1.5 max-h-[140px] overflow-y-auto no-scrollbar font-bold text-[10px]">
        `;

        selectedProvinces.forEach(prov => {
          const matchedStat = (groupedData[prov] || []).find(p => p.monthKey === closestMonth.key);
          const color = PROVINCE_COLORS[prov] || '#ffffff';
          tooltipHtml += `
            <div class="flex items-center justify-between gap-6">
              <span class="flex items-center gap-1.5 text-gray-200">
                <span class="w-2.0 h-2.0 rounded-full shrink-0" style="background-color: ${color}"></span>
                ${prov}
              </span>
              <span class="font-black text-white px-1.5 py-0.5 rounded ${isHighContrast ? 'bg-slate-900 border border-white' : 'bg-black/30'}" style="color: ${color}">${matchedStat ? matchedStat.count : 0} bENS</span>
            </div>
          `;
        });

        tooltipHtml += `
            </div>
          </div>
        `;

        // Tooltip coordinate calculator
        const tooltipWidth = 240;
        const pageX = event.pageX;
        const pageY = event.pageY;

        tooltipSelect
          .html(tooltipHtml)
          .style('left', `${pageX - tooltipWidth / 2}px`)
          .style('top', `${pageY - 165}px`);
      });

  }, [lineWidth, lineHeight, selectedProvinces, groupedData, recent6Months, isDarkMode, isHighContrast]);


  // 2. D3 HORIZONTAL STAT ranking BAR CHART EFFECT
  useEffect(() => {
    if (!barSvgRef.current) return;

    const svg = d3.select(barSvgRef.current);
    svg.selectAll('*').remove();

    const margin = { top: 20, right: 30, bottom: 40, left: 110 };
    const chartWidth = barWidth - margin.left - margin.right;
    const chartHeight = barHeight - margin.top - margin.bottom;

    const chartGroup = svg
      .append('g')
      .attr('transform', `translate(${margin.left}, ${margin.top})`);

    // Only render provinces with at least 1 reunited item to look premium
    const activeStats = provinceRanking.filter(p => p.total > 0).slice(0, 10); // Display Top 10 provinces

    // 2.1 Scales
    const yScale = d3.scaleBand()
      .domain(activeStats.map((d: any) => d.province))
      .range([0, chartHeight])
      .padding(0.24);

    const maxVal = d3.max(activeStats, (d: any) => d.total) || 10;
    const xScale = d3.scaleLinear()
      .domain([0, maxVal as number])
      .range([0, chartWidth]);

    const isLightText = isDarkMode || isHighContrast;
    const axisColor = isHighContrast ? '#ffffff' : (isDarkMode ? '#475569' : '#cbd5e1');
    const labelColor = isHighContrast ? '#ffffff' : (isDarkMode ? '#94a3b8' : '#64748b');

    // 2.2 Draw Axes
    const xAxis = d3.axisBottom(xScale).ticks(5).tickSize(-chartHeight);
    const yAxis = d3.axisLeft(yScale);

    // Apply X gridline and axis ticks
    const xAxisGroup = chartGroup.append('g')
      .attr('transform', `translate(0, ${chartHeight})`)
      .call(xAxis);

    xAxisGroup.selectAll('line')
      .style('stroke', isHighContrast ? '#333333' : (isDarkMode ? '#1e293b' : '#f1f5f9'))
      .style('opacity', 0.8);

    xAxisGroup.selectAll('text')
      .style('fill', labelColor)
      .style('font-weight', '700')
      .style('font-size', '9px')
      .style('font-family', 'var(--font-mono)');

    xAxisGroup.select('.domain')
      .style('stroke', axisColor)
      .style('stroke-width', isHighContrast ? '3px' : '2px');

    // Apply Y ticks
    const yAxisGroup = chartGroup.append('g')
      .call(yAxis);

    yAxisGroup.selectAll('text')
      .style('fill', labelColor)
      .style('font-weight', '700')
      .style('font-size', isHighContrast ? '10px' : '9px')
      .style('font-family', 'var(--font-sans)')
      .style('text-anchor', 'end');

    yAxisGroup.select('.domain')
      .style('stroke', axisColor)
      .style('stroke-width', isHighContrast ? '3px' : '2px');

    // 2.3 Draw bars with rounded borders and linear entrance animation
    chartGroup.selectAll('.bar')
      .data(activeStats)
      .enter()
      .append('rect')
      .attr('class', 'bar')
      .attr('y', (d: any) => yScale(d.province) || 0)
      .attr('height', yScale.bandwidth())
      .attr('x', 0)
      .attr('fill', (d: any) => d.color)
      .attr('rx', 4)  // rounded pill-bars
      .style('cursor', 'pointer')
      .style('transition', 'opacity 0.2s ease')
      .on('mouseover', function() {
        d3.select(this).style('opacity', '0.85');
      })
      .on('mouseout', function() {
        d3.select(this).style('opacity', '1');
      })
      // Width animated entry loading
      .attr('width', 0)
      .transition()
      .duration(750)
      .delay((d: any, i: number) => i * 40)
      .ease(d3.easeCubicOut)
      .attr('width', (d: any) => xScale(d.total));

    // 2.4 Floating Numeric Badges inside or right of the bars
    chartGroup.selectAll('.bar-label')
      .data(activeStats)
      .enter()
      .append('text')
      .attr('class', 'bar-label')
      .attr('y', (d: any) => (yScale(d.province) || 0) + yScale.bandwidth() / 2 + 3.5)
      .attr('x', (d: any) => Math.max(8, xScale(d.total) - 25))
      .style('fill', '#000000')
      .style('font-weight', '950')
      .style('font-size', '9px')
      .style('font-family', 'var(--font-mono)')
      .style('pointer-events', 'none')
      .text((d: any) => d.total)
      // Transition delay corresponding to bar layout
      .style('opacity', 0)
      .transition()
      .duration(300)
      .delay((d: any, i: number) => 400 + i * 45)
      .style('opacity', 1);

  }, [barWidth, barHeight, provinceRanking, isDarkMode, isHighContrast]);


  // Helper trigger to select/deselect all provinces in trend-line filter list
  const handleToggleProvinceSelection = (prov: string) => {
    setSelectedProvinces(prev => {
      if (prev.includes(prov)) {
        if (prev.length <= 1) return prev; // Keep at least one selected to avoid empty line chart error
        return prev.filter(p => p !== prov);
      } else {
        return [...prev, prov];
      }
    });
  };

  const handleSelectAllProvinces = () => {
    setSelectedProvinces(MOZAMBIQUE_PROVINCES);
  };

  const handleResetProvinces = () => {
    setSelectedProvinces(['Maputo Cidade', 'Maputo Província', 'Sofala', 'Nampula']);
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-500">
      
      {/* Top Level Summary Highlight Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Championship Card */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-500/10 via-yellow-500/5 to-transparent border border-amber-500/20 text-left relative overflow-hidden">
          <div className="absolute right-4 top-4 bg-[#fce100]/20 text-[#fce100] h-10 w-10 rounded-xl flex items-center justify-center font-black">
            <Award size={20} />
          </div>
          <span className="text-[8px] font-black tracking-widest text-[#fce100] uppercase block mb-1">Líder do Sistema</span>
          <h4 className="text-sm font-black text-gray-900 uppercase truncate pr-10">{topProvince?.province || 'Nenhuma'}</h4>
          <p className="text-[10px] text-gray-400 font-bold uppercase mt-1 leading-none">
            Total de <span className="text-[#009739] font-black">{topProvince?.total || 0} bens</span> entregues de volta ao proprietário.
          </p>
        </div>

        {/* Global Success Ratio */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-[#009739]/5 to-transparent border border-[#009739]/10 text-left relative overflow-hidden">
          <div className="absolute right-4 top-4 bg-[#009739]/10 text-[#009739] h-10 w-10 rounded-xl flex items-center justify-center font-black">
            <Globe size={20} />
          </div>
          <span className="text-[8px] font-black tracking-widest text-[#009739] uppercase block mb-1">Impacto Nacional</span>
          <h4 className="text-sm font-black text-gray-900 uppercase">Sincronização Ativa</h4>
          <p className="text-[10px] text-gray-400 font-bold uppercase mt-1 leading-none">
            <span className="text-indigo-600 dark:text-indigo-400 font-black">{reunitedItems.length} itens reais</span> no Firestore de Moçambique.
          </p>
        </div>

        {/* Dynamic Tips based on solar exposure state */}
        <div className="p-5 rounded-2xl bg-gray-50 border border-gray-150 text-left relative overflow-hidden flex flex-col justify-center">
          <span className="text-[8px] font-black tracking-widest text-indigo-500 uppercase block mb-1 flex items-center gap-1.5">
            <Eye size={12} className={isHighContrast ? "text-yellow-400 animate-pulse" : ""} />
            Acessibilidade Solar
          </span>
          <p className="text-[10px] text-gray-500 font-extrabold uppercase leading-snug">
            {isHighContrast ? (
              <span className="text-yellow-400">Modo Solar Ativo ☀️ Legibilidade reforçada com contraste extremo e traçados vetoriais densos de alta luminância.</span>
            ) : (
              <span>Os gráficos são otimizados. Use o botão no cabeçalho se estiver sob forte luz solar ou calor exterior.</span>
            )}
          </p>
        </div>
      </div>

      {/* Main Charts layouts split */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        
        {/* Evolution Chart over time */}
        <div className="bg-white rounded-3xl border border-gray-100 p-4 sm:p-6 text-left flex flex-col">
          <div className="mb-4 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
            <div>
              <div className="text-[8px] font-black tracking-wider text-blue-500 uppercase mb-1 flex items-center gap-1">
                <TrendingUp size={12} />
                Fatias de Tempo
              </div>
              <h3 className="text-md font-black text-gray-900 uppercase tracking-tight">Evolução do Radar ao longo do Tempo</h3>
              <p className="text-[10px] font-bold text-gray-400 uppercase leading-none mt-1">Registos de Bens Recuperados por Província</p>
            </div>
            
            <div className="flex gap-1.5 text-[8.5px] font-black uppercase">
              <button onClick={handleSelectAllProvinces} className="px-2 py-1.5 bg-gray-50 border hover:bg-gray-100 rounded-lg">Selecionar Todas</button>
              <button onClick={handleResetProvinces} className="px-2 py-1.5 bg-gray-50 border hover:bg-gray-100 rounded-lg">Padrão</button>
            </div>
          </div>

          {/* Province Filter badging lists */}
          <div className="flex flex-wrap gap-1.5 mb-5 select-none max-h-[85px] overflow-y-auto no-scrollbar py-0.5 border-b border-gray-105 pb-3">
            {MOZAMBIQUE_PROVINCES.map(prov => {
              const active = selectedProvinces.includes(prov);
              const color = PROVINCE_COLORS[prov] || '#ffffff';
              return (
                <button
                  key={prov}
                  onClick={() => handleToggleProvinceSelection(prov)}
                  className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase border transition-all flex items-center gap-1 cursor-pointer hover:scale-102 ${
                    active 
                      ? 'bg-black text-white' 
                      : 'bg-white/10 dark:bg-slate-900 border-gray-150 text-gray-400'
                  }`}
                  style={active ? { borderColor: color, borderLeftWidth: '4px' } : undefined}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }}></span>
                  {prov}
                </button>
              );
            })}
          </div>

          {/* D3 Canvas Line Chart */}
          <div 
            ref={lineChartContainerRef} 
            className="w-full relative bg-gray-50 border border-gray-150 rounded-2xl p-1 overflow-hidden"
          >
            <svg 
              ref={lineSvgRef} 
              width={lineWidth} 
              height={lineHeight} 
              className="max-w-full block mx-auto overflow-visible select-none"
            />
          </div>
        </div>

        {/* Bar Ranking Accumulated Charts */}
        <div className="bg-white rounded-3xl border border-gray-100 p-4 sm:p-6 text-left flex flex-col">
          <div className="mb-4">
            <div className="text-[8px] font-black tracking-wider text-emerald-500 uppercase mb-1 flex items-center gap-1">
              <Layers size={11} />
              Distribuição Geográfica
            </div>
            <h3 className="text-md font-black text-gray-900 uppercase tracking-tight">Acumulado em Moçambique por Província</h3>
            <p className="text-[10px] font-bold text-gray-400 uppercase leading-none mt-1">Ranking de Sucesso do Radar ComeBack</p>
          </div>

          {/* D3 Canvas Bar Chart */}
          <div 
            ref={barChartContainerRef} 
            className="w-full relative bg-gray-50 border border-gray-150 rounded-2xl p-1 overflow-hidden"
          >
            <svg 
              ref={barSvgRef} 
              width={barWidth} 
              height={barHeight} 
              className="max-w-full block mx-auto overflow-visible select-none"
            />
          </div>
        </div>
      </div>

      {/* Floating Tooltip Target element rendered outside SVG flow for pristine look */}
      <div 
        id="d3-line-tooltip" 
        className="fixed z-[1000] pointer-events-none rounded-xl border border-slate-700 bg-black/92 shadow-[0_10px_30px_rgba(0,0,0,0.6)] text-left"
        style={{ display: 'none', transition: 'left 0.08s ease-out, top 0.08s ease-out' }} 
      />

    </div>
  );
};
