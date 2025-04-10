import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { CalculationResult, StormStep } from '../types'; // Use shared types

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface HyetographChartProps {
  calculationResult: CalculationResult | null;
}

// Helper to format time for tooltips
function formatTooltipTime(timeMinutes: number, totalDurationMinutes: number): string {
    if (totalDurationMinutes > 120) { // Use H:MM for durations > 2 hours
        const hours = Math.floor(timeMinutes / 60);
        const mins = Math.round(timeMinutes % 60);
        return `${hours}:${mins.toString().padStart(2, '0')}`;
    } else { // Use minutes for shorter durations
        return `${Math.round(timeMinutes)} min`;
    }
}

const HyetographChart: React.FC<HyetographChartProps> = ({ calculationResult }) => {
  if (!calculationResult || !calculationResult.detailedData || calculationResult.detailedData.length === 0) {
    // Render a placeholder or nothing if no data
    return <div className="text-center text-gray-500 italic p-4 border border-dashed border-gray-300 rounded-md">No storm data to display chart.</div>;
  }

  const { labels, intensityData, intensityUnit, detailedData } = calculationResult;

  // Determine total duration for tooltip formatting
  const totalDurationMinutes = detailedData.length > 0 ? detailedData[detailedData.length - 1].timeEnd : 0;

  const chartData = {
    labels: labels.slice(0, -1), // Remove the last label which marks the end time, not a bar start
    datasets: [
      {
        label: `Rainfall Intensity (${intensityUnit})`,
        data: intensityData,
        backgroundColor: 'rgba(54, 162, 235, 0.6)', // Blueish color
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1,
        barPercentage: 1.0, // Bars touch
        categoryPercentage: 1.0, // Bars touch
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: 'Rainfall Hyetograph',
      },
      tooltip: {
          callbacks: {
              title: function(tooltipItems: any) {
                  // tooltipItems is an array, take the first item
                  const index = tooltipItems[0]?.dataIndex;
                  if (index === undefined || index < 0 || index >= detailedData.length) return '';
                  const item = detailedData[index];
                  const startLabel = formatTooltipTime(item.timeStart, totalDurationMinutes);
                  const endLabel = formatTooltipTime(item.timeEnd, totalDurationMinutes);
                  return `Time: ${startLabel} - ${endLabel}`;
              },
              label: function(context: any) {
                  let label = context.dataset.label || '';
                  if (label) {
                      label += ': ';
                  }
                  if (context.parsed.y !== null) {
                      label += context.parsed.y.toFixed(3) + ' ' + intensityUnit;
                  }
                  return label;
              }
          }
      }
    },
    scales: {
      x: {
        title: {
          display: true,
          text: totalDurationMinutes > 120 ? 'Time (H:MM)' : 'Time (Minutes)',
        },
         ticks: {
             maxRotation: 70,
             minRotation: 0,
             autoSkip: true,
             maxTicksLimit: 20 // Adjust as needed for readability
         }
      },
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: `Intensity (${intensityUnit})`,
        },
      },
    },
  };

  return (
    <div className="relative h-[40vh] min-h-[300px] w-full bg-white p-2 rounded shadow-sm border border-gray-200">
      <Bar options={options} data={chartData} />
    </div>
  );
};

export default HyetographChart; 