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
  Plugin, // Import Plugin
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

// Plugin to force a non-transparent background color
const customCanvasBackgroundColor: Plugin<"line"> = {
  id: "customCanvasBackgroundColor",
  beforeDraw: (chart, args, options) => {
    const { ctx } = chart;
    ctx.save();
    ctx.globalCompositeOperation = "destination-over";
    ctx.fillStyle = options.color || "#ffffff";
    ctx.fillRect(0, 0, chart.width, chart.height);
    ctx.restore();
  },
};

const LineChart = () => {
  const data: ChartData<"line"> = {
    labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul"],
    datasets: [
      {
        label: "Revenue ($)",
        data: [1200, 1900, 3000, 2500, 3200, 4100, 4700],
        borderColor: "rgb(54, 162, 235)", // A nice blue
        backgroundColor: "rgba(54, 162, 235, 0.2)", // Lighter blue fill
        pointBackgroundColor: "rgb(54, 162, 235)",
        pointBorderColor: "#fff",
        pointHoverBackgroundColor: "#fff",
        pointHoverBorderColor: "rgb(54, 162, 235)",
        tension: 0.2,
        fill: true,
      },
    ],
  };

  const options: ChartOptions<"line"> = {
    responsive: true,
    plugins: {
      legend: {
        display: true,
        position: "top",
        labels: {
          color: "#444444", // Dark text for legend
        },
      },
      title: {
        display: true,
        text: "Monthly Revenue Growth",
        color: "#444444", // Dark text for title
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: "rgba(0, 0, 0, 0.1)", // Light grey grid lines
        },
        ticks: {
          color: "#444444", // Dark text for Y-axis labels
        },
      },
      x: {
        grid: {
          color: "rgba(0, 0, 0, 0.1)", // Light grey grid lines
        },
        ticks: {
          color: "#444444", // Dark text for X-axis labels
        },
      },
    },
  };

  return (
    // Added bg-white and rounded-xl back for the container
    <div className="p-1 bg-white rounded-xl shadow-md">
      <Line data={data} options={options} plugins={[customCanvasBackgroundColor]} />
    </div>
  );
};

export default LineChart;