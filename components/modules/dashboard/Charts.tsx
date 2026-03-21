'use client';

// ============================================================
// /components/modules/dashboard/Charts.tsx
// Gráficas para el Dashboard
// ============================================================

interface SalesData {
  month: string;
  value: number;
}

interface OrderData {
  label: string;
  value: number;
  color: string;
}

export function SalesLineChart({ data }: { data: SalesData[] }) {
  const maxValue = Math.max(...data.map((d) => d.value));
  const width = 320;
  const height = 200;
  const padding = 40;
  const graphWidth = width - padding * 2;
  const graphHeight = height - padding * 2;

  return (
    <svg width={width} height={height} className='text-slate-100'>
      {/* Grid */}
      {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => (
        <line
          key={`grid-${i}`}
          x1={padding}
          y1={padding + graphHeight * (1 - ratio)}
          x2={width - padding}
          y2={padding + graphHeight * (1 - ratio)}
          stroke='#334155'
          strokeDasharray='4'
          strokeWidth='1'
        />
      ))}

      {/* Línea y puntos */}
      <polyline
        points={data
          .map((d, i) => {
            const x = padding + (i / (data.length - 1)) * graphWidth;
            const y = padding + graphHeight * (1 - d.value / maxValue);
            return `${x},${y}`;
          })
          .join(' ')}
        fill='none'
        stroke='#60a5fa'
        strokeWidth='2'
      />

      {/* Puntos de datos */}
      {data.map((d, i) => {
        const x = padding + (i / (data.length - 1)) * graphWidth;
        const y = padding + graphHeight * (1 - d.value / maxValue);
        return (
          <circle
            key={`point-${i}`}
            cx={x}
            cy={y}
            r='4'
            fill='#3b82f6'
            stroke='#1e293b'
            strokeWidth='2'
          />
        );
      })}

      {/* Labels X */}
      {data.map((d, i) => {
        const x = padding + (i / (data.length - 1)) * graphWidth;
        return (
          <text
            key={`label-${i}`}
            x={x}
            y={height - 10}
            textAnchor='middle'
            fontSize='11'
            fill='#94a3b8'
          >
            {d.month}
          </text>
        );
      })}

      {/* Labels Y */}
      {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => (
        <text
          key={`y-label-${i}`}
          x={padding - 10}
          y={padding + graphHeight * (1 - ratio) + 4}
          textAnchor='end'
          fontSize='10'
          fill='#94a3b8'
        >
          ${Math.round((maxValue * ratio) / 1000)}k
        </text>
      ))}
    </svg>
  );
}

export function OrdersPieChart({ data }: { data: OrderData[] }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const size = 180;
  const radius = 70;
  const cx = size / 2;
  const cy = size / 2;

  let currentAngle = -Math.PI / 2;
  const slices = data.map((item) => {
    const sliceAngle = (item.value / total) * Math.PI * 2;
    const startAngle = currentAngle;
    const endAngle = currentAngle + sliceAngle;

    const x1 = cx + radius * Math.cos(startAngle);
    const y1 = cy + radius * Math.sin(startAngle);
    const x2 = cx + radius * Math.cos(endAngle);
    const y2 = cy + radius * Math.sin(endAngle);

    const largeArc = sliceAngle > Math.PI ? 1 : 0;
    const path = `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;

    const labelAngle = startAngle + sliceAngle / 2;
    const labelRadius = radius * 0.65;
    const labelX = cx + labelRadius * Math.cos(labelAngle);
    const labelY = cy + labelRadius * Math.sin(labelAngle);

    currentAngle = endAngle;

    return {
      path,
      labelX,
      labelY,
      percentage: Math.round((item.value / total) * 100),
      item,
    };
  });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {slices.map((slice, i) => (
        <g key={`slice-${i}`}>
          <path
            d={slice.path}
            fill={slice.item.color}
            stroke='#0f172a'
            strokeWidth='2'
          />
          {slice.percentage > 8 && (
            <text
              x={slice.labelX}
              y={slice.labelY}
              textAnchor='middle'
              dominantBaseline='middle'
              fontSize='12'
              fontWeight='bold'
              fill='white'
            >
              {slice.percentage}%
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

export function TopClientsBarChart({
  data,
}: {
  data: Array<{ name: string; value: number }>;
}) {
  const maxValue = Math.max(...data.map((d) => d.value));
  const width = 280;
  const height = 200;
  const barHeight = 25;
  const padding = 40;

  return (
    <svg width={width} height={height} className='text-slate-100'>
      {data.map((item, i) => {
        const y = padding + i * (barHeight + 8);
        const barWidth = (item.value / maxValue) * (width - padding - 20);

        return (
          <g key={`bar-${i}`}>
            {/* Barra */}
            <rect
              x={padding}
              y={y}
              width={barWidth}
              height={barHeight}
              fill='#3b82f6'
              rx='4'
            />
            {/* Label nombre */}
            <text
              x={padding - 10}
              y={y + barHeight / 2}
              textAnchor='end'
              dominantBaseline='middle'
              fontSize='11'
              fill='#cbd5e1'
            >
              {item.name}
            </text>
            {/* Label valor */}
            <text
              x={padding + barWidth + 10}
              y={y + barHeight / 2}
              dominantBaseline='middle'
              fontSize='11'
              fill='#94a3b8'
            >
              ${item.value / 1000}k
            </text>
          </g>
        );
      })}
    </svg>
  );
}
