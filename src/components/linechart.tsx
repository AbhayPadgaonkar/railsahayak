"use client";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
  ChartData,
  Plugin,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface Dataset {
  label: string;
  data: number[];
  borderColor: string;
  backgroundColor: string;
}

interface LineChartProps {
  title: string;
  labels: string[];
  datasets: Dataset[];
}

// Plugin to force a non-transparent background color
const customCanvasBackgroundColor: Plugin<"line"> = {
  id: "customCanvasBackgroundColor",
  beforeDraw: (chart, _args, options) => {
    const { ctx } = chart;
    ctx.save();
    ctx.globalCompositeOperation = "destination-over";
    ctx.fillStyle = (options as { color?: string }).color || "#ffffff";
    ctx.fillRect(0, 0, chart.width, chart.height);
    ctx.restore();
  },
};

const LineChart = ({ title, labels, datasets }: LineChartProps) => {
  const data: ChartData<"line"> = {
    labels,
    datasets: datasets.map((ds) => ({
      label: ds.label,
      data: ds.data,
      borderColor: ds.borderColor,
      backgroundColor: ds.backgroundColor,
      pointBackgroundColor: ds.borderColor,
      pointBorderColor: "#fff",
      pointHoverBackgroundColor: "#fff",
      pointHoverBorderColor: ds.borderColor,
      tension: 0.2,
      fill: true,
    })),
  };

  const options: ChartOptions<"line"> = {
    responsive: true,
    plugins: {
      legend: {
        display: datasets.length > 1,
        position: "top",
        labels: {
          color: "#444444",
        },
      },
      title: {
        display: true,
        text: title,
        color: "#444444",
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: "rgba(0, 0, 0, 0.1)",
        },
        ticks: {
          color: "#444444",
        },
      },
      x: {
        grid: {
          color: "rgba(0, 0, 0, 0.1)",
        },
        ticks: {
          color: "#444444",
        },
      },
    },
  };

  return (
    <div className="p-1 bg-white rounded-xl shadow-md">
      <Line data={data} options={options} plugins={[customCanvasBackgroundColor]} />
    </div>
  );
};

export default LineChart;
