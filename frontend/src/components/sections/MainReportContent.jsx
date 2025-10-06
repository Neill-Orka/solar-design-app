import React, {useState, useEffect } from "react";
import axios from 'axios';
import { Line, Bar } from 'react-chartjs-2';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { API_URL } from '../../apiConfig'
import { useNotification } from '../../NotificationContext';
import '../../ReportBuilder.css';
import StandardPage from "./StandardPage";
import 'chartjs-adapter-date-fns'
import { Image } from 'react-bootstrap';
import saGHIMap from './../../assets/southafrica_ghi_map.png';
import meanAnnualRainfall from './../../assets/MeanAnnualRainfall.jpg';
import panel_icon from './../../assets/panel_icon.png';
import inverter_icon from './../../assets/inverter_icon.png';
import battery_icon from './../../assets/battery_icon.png';
import yield_icon from './../../assets/yield_icon.png';
import utilized_icon from './../../assets/utilized_icon.png';

function MainReportContent({ 
  data, 
  settings,
  showSiteLayout, 
  siteLayoutImage,
  startPageNumber = 3,
  totalPages = 24
}) {
  const { showNotification } = useNotification();
    const [consumptionData, setConsumptionData] = useState([]);
    const [startDate, setStartDate] = useState(null);
    const [endDate, setEndDate] = useState(null);
    const [demandStartDate, setDemandStartDate] = useState(null);
    const [demandEndDate, setDemandEndDate] = useState(null);
    const [demandData, setDemandData] = useState([]);
    const [yearlyConsumptionData, setYearlyConsumptionData] = useState([]);

    const [project_type] = useState(data?.project?.project_type || "Residential");

    // State for simulation graph date picker
    const [simulationStartDate, setSimulationStartDate] = useState(null);
    const [simulationEndDate, setSimulationEndDate] = useState(null);

    console.log("Report data received (from MainReportContent):", data);

    // Initialize dates - first clear any existing stored dates
    useEffect(() => {
        // Clear any existing stored dates that might be causing the issue
        sessionStorage.removeItem('reportEnergyStartDate');
        sessionStorage.removeItem('reportEnergyEndDate');
        
        const currentYear = new Date().getFullYear(); // 2025
        const startOfYear = new Date(currentYear, 0, 1, 0, 0, 0); // January 1st of current year
        const endOfYear = new Date(currentYear, 11, 31, 23, 59, 59); // December 31st of current year

        setStartDate(startOfYear);
        setEndDate(endOfYear);
        
        console.log("Setting date range:", startOfYear, "to", endOfYear);
    }, [])

    // save date selections to sessionStorage
    useEffect(() => {
        if (startDate && endDate) {
            sessionStorage.setItem('reportEnergyStartDate', startDate.toISOString());
            sessionStorage.setItem('reportEnergyEndDate', endDate.toISOString());
        }
    }, [startDate, endDate]);

    // get consumption data when dates or projectId changes
    useEffect(() => {
    if (!data?.project?.id || !startDate || !endDate) return;

    // Format dates for API request
    const formattedStartDate = startDate.toISOString().split('T')[0];
    const formattedEndDate = endDate.toISOString().split('T')[0];

    console.log(`Fetching data from ${formattedStartDate} to ${formattedEndDate}`);
    
    axios.get(`${API_URL}/api/consumption_data/${data.project.id}`, {
        params: {
        start_date: formattedStartDate,
        end_date: formattedEndDate
        }
    })
    .then(res => {
        // Handle the new response format with data property
        const consumptionDataArray = res.data && res.data.data ? res.data.data : res.data;
        
        if (Array.isArray(consumptionDataArray)) {
        setConsumptionData(consumptionDataArray);
        } else {
        console.error('Unexpected data format:', res.data);
        setConsumptionData([]);
        }
    })
    .catch(err => {
        console.error('Error loading consumption data:', err);
        showNotification('Error loading consumption data', 'error');
    });
    }, [data?.project?.id, startDate, endDate, showNotification]);

    // Process data into monthly consumption
    const monthlyConsumption = React.useMemo(() => {
        if (consumptionData.length === 0) return [];

        const monthlyData = {};
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

        consumptionData.forEach(item => {
            const date = new Date(item.timestamp);
            const monthYear = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;

            if (!monthlyData[monthYear]) {
                monthlyData[monthYear] = 0;
            }

            monthlyData[monthYear] += item.demand_kw * 0.5;
        });

        const sortedMonths = Object.keys(monthlyData).sort((a, b) => {
            const [aMonth, aYear] = a.split(' ');
            const [bMonth, bYear] = b.split(' ');

            if (aYear !== bYear) return parseInt(aYear) - parseInt(bYear);
            return monthNames.indexOf(aMonth) - monthNames.indexOf(bMonth);
        });

        return {
            months: sortedMonths,
            values: sortedMonths.map(month => Math.round(monthlyData[month]))
        };

    }, [consumptionData])

    // Monthly consumption chart data
    const monthlyChartData = {
        labels: monthlyConsumption.months || [],
        datasets: [{
            label: 'Monthly Energy Consumption (kWh)',
            data: monthlyConsumption.values || [],
            backgroundColor: 'rgba(22, 144, 144, 0.19)',
            borderColor: 'rgba(27, 95, 95, 1)',
            borderWidth: 2,
            tension: 0.2,
            fill: true,
        }]
    };

    // Monthly chart options
    const monthlyChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            tooltip: { mode: 'index', intersect: false },
            legend: { display: false },
            title: { display: true, text: 'Monthly Energy Consumption (kWh)' },
            datalabels: { display: false }
        },
        scales: {
            x: { 
                title: { display: true, text: 'Month' },
                grid: { display: false }
            },
            y: { 
                title: { display: true, text: 'Energy (kWh)' },
                beginAtZero: true,
                ticks: {
                    callback: function(value) {
                        return formatValue(value);
                    }
                }
            }
        }
    };    


    // Calculate metrics
    const totalKwh = consumptionData.length > 0 ?
        (consumptionData.reduce((sum, row) => sum+row.demand_kw, 0) * 0.5).toFixed(0) : 0;
    const dates = new Set(consumptionData.map(row => row.timestamp?.split("T")[0] || ""));
    const avgDailyKwh = dates.size > 0 ? (totalKwh / dates.size).toFixed(0) : 0;
    const peakDemand = consumptionData.length > 0 ?
        Math.max(...consumptionData.map(row => row.demand_kw)).toFixed(1) : 0;
    const avgDemand = consumptionData.length > 0 ?
        (consumptionData.reduce((sum, row) => sum + row.demand_kw, 0) / consumptionData.length).toFixed(1) : 0;
        
    const chartData = {
        labels: consumptionData.map(d => new Date(d.timestamp).toLocaleString()),
        datasets: [{
            label: 'Demand (kW)',
            data: consumptionData.map(d => d.demand_kw),
            borderColor: 'rgb(75, 192, 192)',
            backgroundColor: 'rgba(75, 192, 192, 0.2)',
            fill: true,
            tension: 0.1,
            pointRadius: 0
        }]        
    };

    // Chart options
    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            tooltip: { mode: 'index', intersect: false },
            legend: { position: 'top' },
            title: { display: true, text: 'Energy Consumption (kW)' },
            datalabels: { display: false }
        },
        scales: {
            x: { 
                title: { display: true, text: 'Timestamp' }, 
                ticks: { autoSkip: true, maxTicksLimit: 10 } 
            },
            y: { 
                title: { display: true, text: 'Demand (kW)' }, 
                beginAtZero: true 
            }
        }
    };

    // Monthly cost breakdown chart data - only current costs
    const costBreakdownChartData = React.useMemo(() => {
        if (!data?.financials?.cost_comparison || !data.financials.cost_comparison?.length) return {
            labels: [],
            datasets: []
        };
        
        const fin = data.financials;
        const labels = fin.cost_comparison.map(item => 
            new Date(item.month).toLocaleString('default', { month: 'short', year: '2-digit' })
        );

        // Only include the "old bill" (current costs) components
        const datasets = [
            {
                label: 'Old Bill - Energy',
                data: fin.cost_comparison.map(item => item.old_bill_breakdown.energy),
                backgroundColor: '#f87171',
                stack: 'Stack 0',
            },
            {
                label: 'Old Bill - Fixed',
                data: fin.cost_comparison.map(item => item.old_bill_breakdown.fixed),
                backgroundColor: '#9ca3af',
                stack: 'Stack 0',
            },
            {
                label: 'Old Bill - Demand',
                data: fin.cost_comparison.map(item => item.old_bill_breakdown.demand),
                backgroundColor: '#b91c1c',
                stack: 'Stack 0',
            }
        ];

        return {
            labels,
            datasets: datasets.filter(ds => ds.data.some(val => val !== 0 && val !== null))
        };
    }, [data?.financials?.cost_comparison, data?.financials]);

    // Function to get simulation data for selected date range
    const getFilteredSimulationData = React.useMemo(() => {
        if (!data?.simulation?.timestamps || !simulationStartDate || !simulationEndDate) {
            return {
                labels: [],
                demand: [],
                generation: [],
                import_from_grid: [],
                battery_soc: []
            };
        }

        const startDate = new Date(simulationStartDate);
        const endDate = new Date(simulationEndDate);
        
        // Find indices for the selected date range
        let startIndex = -1;
        let endIndex = -1;
        
        for (let i = 0; i < data.simulation.timestamps.length; i++) {
            const timestamp = new Date(data.simulation.timestamps[i]);
            
            if (startIndex === -1 && timestamp >= startDate) {
                startIndex = i;
            }
            
            if (timestamp <= endDate) {
                endIndex = i;
            }
        }
        
        // If we couldn't find the exact range, default to first week
        if (startIndex === -1 || endIndex === -1) {
            startIndex = 0;
            endIndex = Math.min(335, data.simulation.timestamps.length - 1); // 336 points (7 days * 48 points/day)
        }
        
        return {
            labels: data.simulation.timestamps.slice(startIndex, endIndex + 1).map(t => new Date(t)),
            demand: data.simulation.demand.slice(startIndex, endIndex + 1),
            generation: data.simulation.generation.slice(startIndex, endIndex + 1),
            import_from_grid: data.simulation.import_from_grid.slice(startIndex, endIndex + 1),
            battery_soc: data.simulation.battery_soc.slice(startIndex, endIndex + 1)
        };
    }, [data?.simulation, simulationStartDate, simulationEndDate]);

    // Chart options for cost breakdown
    const costBreakdownOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            tooltip: { mode: 'index', intersect: false },
            legend: { position: 'top' },
            title: { display: true, text: 'Current Monthly Electricity Costs' },
            datalabels: { display: false }
        },
        scales: {
            x: { 
                stacked: true,
                title: { display: true, text: 'Month' }
            },
            y: { 
                stacked: true,
                title: { display: true, text: 'Cost (R)' },
                ticks: {
                    callback: function(value) {
                        return 'R ' + formatValue(value);
                    }
                }
            }
        }
    };

    // Helper function to safely display JSON fields
    const displayValue = (value, fallback, field = "") => {
      if (value === undefined || value === null) return fallback;
    
      if (typeof value === 'object') {
        // If it's an object, try to extract capacity or return the first value
        if (field === "battery_kwh" && value.capacity && value.quantity) {
          const total = value.capacity * value.quantity;
          return total.toString();
        }
    
        if (value.capacity && value.quantity) {
          return `${value.capacity * value.quantity}`;
        }
    
        return value.capacity || value.quantity || Object.values(value)[0] || fallback;
      }
      return value;
    };

    // Helper function to safely display numeric values and format them
    const formatValue = (value, defaultValue = 0) => {
      // Check if value exists and is a number
      if (value !== undefined && value !== null) {
        // If it's already a number, format it with no decimals and space separator
        if (typeof value === 'number') {
          return Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
        }
        // If it's a string that looks like a number, parse and format it
        if (typeof value === 'string' && !isNaN(parseFloat(value))) {
          return Math.round(parseFloat(value)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
        }
        // Otherwise return as is
        return value;
      }
      // Return default value with formatting
      return typeof defaultValue === 'number' ? 
        Math.round(defaultValue).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : 
        defaultValue;
    };    

    const systemContent = {
        grid: {
            projectGoal: "The goal of this project is to reduce grid dependency and electricity costs through a grid-tied solar PV system.",
            benefits: [
                "Cost savings on grid supplied electricity",
                "Independece from high-cost increases",
                "Reduced carbon footprint and greenhouse gas emiissions, through reducing use of fossil fuels",
            ],
            systemDescription: "This grid-tied solar PV system is designed to work in conjunction with the utility grid. It produces electricity during daylight hours, reducing dependency on utility power when the sun is shining."
        },
        hybrid: {
            projectGoal: "The goal of this project is to provide both energy cost savings and backup power during outages.",
            benefits: [
                "Reduced electricity bills",
                "Backup power during outages",
                "Increased energy independence",
                "Lower carbon footprint",
                "Protection against load shedding"
            ],
            systemDescription: "This hybrid solar PV system combines the benefits of grid-tied operation with battery storage for backup power."
        },
        off_grid: {
            projectGoal: "The goal of this project is to achieve complete energy independence from the utility grid.",
            benefits: [
                "Cost savings by eliminating grid supplied electricity.",
                "Long term power supply cost certainty: The cost of electricity from the system is defined, hence future cost certainty is improved, reducing the risks of unknown grid electricity price increases.",
                "Reduced carbon footprint and greenhouse gas emissions, through reducing the use of fossil-based energy.",
            ],
            systemDescription: "This off-grid solar PV system with battery storage is designed to meet all of the site's energy needs without connection to the utility grid."
        },
        default: {
            projectGoal: "The goal of this project is to provide a custom solar energy solution tailored to the client's specific requirements, optimizing energy production while ensuring reliability and performance.",
            benefits: [
                "Reduced electricity bills",
                "Increased energy independence",
                "Lower carbon footprint",
                "Customized to specific needs"
            ],
            systemDescription: "This solar PV system is designed to meet the specific energy needs of the site, taking into account local conditions, consumption patterns, and future requirements."
        }
    };

    // Helper function to get system-specific content
    const getSystemContent = (contentType) => {
        const systemType = data?.project?.system_type?.toLowerCase() || 'default';
        const systemConfig = systemContent[systemType] || systemContent.default;
        return systemConfig[contentType];
    };    

    // Add this useEffect to initialize the demand date range (Feb 3-9)
    useEffect(() => {
        const currentYear = new Date().getFullYear(); // 2025
        const defaultStart = new Date(currentYear, 1, 3); // Feb 3
    
        // Get from session storage if available
        const savedStart = sessionStorage.getItem('reportDemandStartDate');
    
        const startDate = savedStart ? new Date(savedStart) : defaultStart;
        setDemandStartDate(startDate);
    
        // Automatically calculate end date (7 days total)
        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
        setDemandEndDate(endDate);
    }, []);

    // Add this useEffect to save demand date selections (only save start date)
    useEffect(() => {
        if (demandStartDate) {
            sessionStorage.setItem('reportDemandStartDate', demandStartDate.toISOString());
        }
    }, [demandStartDate]);

    // Initialize simulation date range
    useEffect(() => {
        const currentYear = new Date().getFullYear(); // 2025
        const defaultStart = new Date(currentYear, 2, 15); // March 15
    
        // Get from session storage if available
        const savedStart = sessionStorage.getItem('reportSimulationStartDate');
    
        const startDate = savedStart ? new Date(savedStart) : defaultStart;
        setSimulationStartDate(startDate);
    
        // Automatically calculate end date (7 days total)
        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
        setSimulationEndDate(endDate);
    }, []);

    // Save simulation date selections (only save start date)
    useEffect(() => {
        if (simulationStartDate) {
            sessionStorage.setItem('reportSimulationStartDate', simulationStartDate.toISOString());
        }
    }, [simulationStartDate]);

    useEffect(() => {
    if (!data?.project?.id || !demandStartDate || !demandEndDate) return;

    // Format dates for API request
    const formattedStartDate = demandStartDate.toISOString().split('T')[0];
    const formattedEndDate = demandEndDate.toISOString().split('T')[0];

    console.log(`Fetching demand data from ${formattedStartDate} to ${formattedEndDate}`);
    
    axios.get(`${API_URL}/api/consumption_data/${data.project.id}`, {
        params: {
        start_date: formattedStartDate,
        end_date: formattedEndDate
        }
    })
    .then(res => {
        // Handle the new response format with data property
        const demandDataArray = res.data && res.data.data ? res.data.data : res.data;
        
        if (Array.isArray(demandDataArray)) {
        setDemandData(demandDataArray);
        } else {
        console.error('Unexpected data format for demand data:', res.data);
        setDemandData([]);
        }
    })
    .catch(err => {
        console.error('Error loading demand data:', err);
    });
    }, [data?.project?.id, demandStartDate, demandEndDate, showNotification]);

    // Add this new useEffect to fetch the entire year's data once
    useEffect(() => {
    if (!data?.project?.id) return;

    const yearStart = new Date('2025-01-01');
    const yearEnd = new Date('2025-12-31');
    
    // Format dates for API request
    const formattedStartDate = yearStart.toISOString().split('T')[0];
    const formattedEndDate = yearEnd.toISOString().split('T')[0];

    console.log(`Fetching yearly data from ${formattedStartDate} to ${formattedEndDate}`);
    
    axios.get(`${API_URL}/api/consumption_data/${data.project.id}`, {
        params: {
        start_date: formattedStartDate,
        end_date: formattedEndDate
        }
    })
    .then(res => {
        // Handle the new response format with data property
        const yearlyDataArray = res.data && res.data.data ? res.data.data : res.data;
        
        if (Array.isArray(yearlyDataArray)) {
        setYearlyConsumptionData(yearlyDataArray);
        console.log(`Yearly data loaded: ${yearlyDataArray.length} records`);
        } else {
        console.error('Unexpected data format:', res.data);
        console.log(`Yearly data loaded: undefined records`);
        setYearlyConsumptionData([]);
        }
    })
    .catch(err => {
        console.error('Error loading yearly consumption data:', err);
        console.log('Yearly data loaded: undefined records');
    });
    }, [data?.project?.id]);

    // Create the demand chart data
    const demandChartData = React.useMemo(() => {
        // Group data by date to better display daily patterns
        const dataByDate = {};
        
        demandData.forEach(d => {
            const date = new Date(d.timestamp);
            const dateStr = date.toLocaleDateString();
            
            if (!dataByDate[dateStr]) {
                dataByDate[dateStr] = [];
            }
            
            dataByDate[dateStr].push({
                time: date,
                demand: d.demand_kw
            });
        });
        
        return {
            labels: demandData.map(d => new Date(d.timestamp)),
            datasets: [{
                label: 'Demand (kW)',
                data: demandData.map(d => d.demand_kw),
                borderColor: '#18736a',
                backgroundColor: '#98e7c8',
                fill: true,
                tension: 0.1,
                pointRadius: 0
            }]
        };
    }, [demandData]);

    // Create the demand chart options
    const demandChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            tooltip: { 
                mode: 'index', 
                intersect: false,
                callbacks: {
                    title: function(context) {
                        // Show both date and time in tooltip for precision
                        const date = new Date(context[0].label);
                        return date.toLocaleString();
                    }
                }
            },
            legend: { display: true, position: 'top' },
            title: { 
                display: true, 
                text: 'Detailed Demand Profile (kW)' 
            },
            datalabels: { display: false }
        },
        scales: {
            x: { 
                type: 'time',
                time: {
                    unit: 'day',
                    displayFormats: {
                        day: 'MMM d'
                    },
                    tooltipFormat: 'MMM d, HH:mm'
                },
                title: { display: true, text: 'Date' },
                ticks: { maxTicksLimit: 10 }
            },
            y: { 
                title: { display: true, text: 'Demand (kW)' },
                beginAtZero: true
            }
        }
    };

    // Monthly production chart data
    const monthlyProductionChartData = React.useMemo(() => {
        // First try to use simulation data if available
        if (data?.simulation?.timestamps && data?.simulation?.generation) {
            const timestamps = data.simulation.timestamps;
            const generation = data.simulation.potential_generation;
            const timeIntervalHours = 0.5; // 30-minute intervals
            
            // Group by month and sum up generation
            const monthlyData = {};
            
            timestamps.forEach((ts, i) => {
                const date = new Date(ts);
                const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
                const monthName = date.toLocaleString('default', { month: 'short' });
                
                if (!monthlyData[monthKey]) {
                    monthlyData[monthKey] = {
                        monthName,
                        totalKWh: 0,
                        monthIndex: date.getMonth(),
                        year: date.getFullYear()
                    };
                }
                
                // Convert kW to kWh by multiplying with the time interval (0.5 hours)
                monthlyData[monthKey].totalKWh += generation[i] * timeIntervalHours;
            });
            
            // Convert to array and sort by month/year
            const sortedMonths = Object.values(monthlyData).sort((a, b) => {
                if (a.year !== b.year) return a.year - b.year;
                return a.monthIndex - b.monthIndex;
            });
            
            return {
                labels: sortedMonths.map(m => m.monthName),
                datasets: [{
                    label: 'Energy Production (kWh)',
                    data: sortedMonths.map(m => Math.round(m.totalKWh)),
                    backgroundColor: 'rgba(255, 193, 7, 0.6)',
                    borderColor: 'rgba(255, 193, 7, 1)',
                    borderWidth: 1,
                    borderRadius: 5
                }]
            };
        }
        
        // Fall back to the approximation method if simulation data isn't available
        if (!data?.financials?.cost_comparison) return { labels: [], datasets: [] };
        
        // Extract month names and sort them in chronological order
        const months = data.financials.cost_comparison.map(item => {
            const date = new Date(item.month);
            return {
                monthName: date.toLocaleString('default', { month: 'short' }),
                monthNum: date.getMonth(),
                year: date.getFullYear(),
                originalKey: item.month
            };
        });
        
        // Map the data - calculate based on total generation divided proportionally by days in month
        // This is an approximation based on typical solar insolation patterns
        const monthlyFactors = [
            0.06, // Jan
            0.07, // Feb
            0.08, // Mar
            0.09, // Apr
            0.10, // May
            0.10, // Jun
            0.11, // Jul
            0.11, // Aug
            0.10, // Sep
            0.08, // Oct
            0.06, // Nov
            0.04  // Dec
        ];
        
        // Calculate total factors to normalize
        const totalFactors = monthlyFactors.reduce((a, b) => a + b, 0);
        
        // Get total generation
        const totalGeneration = data?.financials?.total_generation_kwh || 0;
        
        // Calculate monthly generation values
        const monthlyGenerationValues = months.map(month => {
            const factor = monthlyFactors[month.monthNum];
            return Math.round((factor / totalFactors) * totalGeneration);
        });
        
        return {
            labels: months.map(m => m.monthName),
            datasets: [{
                label: 'Energy Production (kWh)',
                data: monthlyGenerationValues,
                backgroundColor: 'rgba(255, 193, 7, 0.6)',
                borderColor: 'rgba(255, 193, 7, 1)',
                borderWidth: 1,
                borderRadius: 5
            }]
        };
    }, [data?.simulation, data?.financials?.cost_comparison, data?.financials?.total_generation_kwh]);

    // Monthly production chart options
    const monthlyProductionChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            tooltip: { 
                mode: 'index', 
                intersect: false,
                callbacks: {
                    label: function(context) {
                        let label = context.dataset.label || '';
                        if (label) {
                            label += ': ';
                        }
                        if (context.parsed.y !== null) {
                            label += formatValue(context.parsed.y) + ' kWh';
                        }
                        return label;
                    }
                }
            },
            legend: { display: false },
            title: { display: true, text: 'Monthly Energy Production (kWh)' },
            datalabels: {
                display: false
            }
        },
        scales: {
            x: { 
                title: { display: true, text: 'Month' },
                grid: { display: false }
            },
            y: { 
                title: { display: true, text: 'Energy (kWh)' },
                beginAtZero: true,
                ticks: {
                    callback: function(value) {
                        return formatValue(value);
                    }
                }
            }
        }
    };

    // Terms and project schedule
    // Use the passed value or fall back to a default
    const [priceValidUntil, setPriceValidUntil] = useState(() => {
        const now = new Date();
        now.setMonth(now.getMonth() + 1);
        const day = String(now.getDate()).padStart(2, '0');
        const month = now.toLocaleString('default', { month: 'long' });
        const year = now.getFullYear();
        return `${day} ${month} ${year}`;
    });
  
    // Initialize with default schedule
    const [projectSchedule, setProjectSchedule] = useState([
      { activity: "Deposit received & document compilation", timeline: "Week 1" },
      { activity: "Equipment procurement & delivery", timeline: "Week 2 (provided no major supplier delays)" },
      { activity: "Construction & installation", timeline: "Week 2-4" },
      { activity: "Commissioning", timeline: "Week 5" },
      { activity: "Training", timeline: "Week 5" },
      { activity: "Handover", timeline: "Week 6" }
    ]);

    // Function to update a specific schedule time
    const updateScheduleTime = (index, field, value) => {
        const updatedSchedule = [...projectSchedule];
        updatedSchedule[index] = {
            ...updatedSchedule[index],
            [field]: value
        };
        setProjectSchedule(updatedSchedule);
    };

    // Function to add a new schedule item
    const addScheduleItem = () => {
      setProjectSchedule([
        ...projectSchedule,
        { activity: "", timeline: "" }
      ]);
    };

    // Function to remove a schedule item
    const removeScheduleItem = (index) => {
      const updatedSchedule = [...projectSchedule];
      updatedSchedule.splice(index, 1);
      setProjectSchedule(updatedSchedule);
    };

    return (
    <>
        <StandardPage
            header="System Performance"
            // footer="Orka Solar - Design Report"
            data={data} // Pass the data prop to StandardPage
            pageNumber={startPageNumber} // Set an appropriate page number here
            totalPages={totalPages} // Set the total number of pages in your report
        >
            <h4 className="fw-bold">Site Information</h4>
            <div>
                This site is located at {data?.project?.location}, South Africa: {data?.project?.latitude}, {data?.project?.longitude}.
            </div>

            {showSiteLayout && (
                <div className="site-layout-section mt-4">
                    <h4 className="fw-bold">General Site Layout</h4>
                    <p>
                        The proposed module layout is shown below, this may change after detailed site visit but has in principle been proposed to the client:
                    </p>
                    {siteLayoutImage ? (
                        <div className="site-layout-image-container">
                            <img 
                                src={siteLayoutImage}
                                alt="Proposed Module Layout"
                                style={{
                                    maxWidth: '100%',
                                    maxHeight: '100%',
                                    display: 'block',
                                    margin: '1rem auto',
                                    border: '1px solid #ddd'
                                }}
                            />
                        </div> 
                    ): (
                        <div className="no-layout-image">
                            <p className="text-muted fst-italic"> No layout image available. Please upload one in the sidebar.</p>
                        </div>
                    )}
                </div>
            )}
        </StandardPage>

        <StandardPage
            header="System Performance"
            // footer="Orka Solar - Design Report"
            data={data} // Pass the data prop to StandardPage
            pageNumber={startPageNumber + 1} // Set an appropriate page number here
            totalPages={totalPages} // Set the total number of pages in your report        
        >
            <h4 className="fw-bold">Project Goal</h4>
            <p>{getSystemContent('projectGoal')}</p>
            <p>The following benefits will be achieved:</p>
            <ol>
                {getSystemContent('benefits').map((benefit, index) =>(
                    <li key={index}>{benefit}</li>
                ))}
            </ol>                
            
            <h5 className="fw-bold">Current load profile and electrical consumption</h5>
            {/* Monthly energy consumption chart */}
            
            <p className="mt-3">
                The chart below shows the monthly energy consumption for {data?.project?.client_name}'s facility. 
                This data was used as the foundation in the design of an optimal solar solution tailored to the actual usage patterns of the site.
            </p>

            <div className="chart-container" style={{height: "400px"}}>
                {monthlyConsumption.months?.length > 0 ? (
                    <Line data={monthlyChartData} options={monthlyChartOptions} />
                ) : (
                    <div className="text-center text-muted p-5">
                        No consumption data available
                    </div>
                )}
            </div>
        </StandardPage>

        <StandardPage
            header="System Performance"
            // footer="Orka Solar - Design Report"
            data={data} // Pass the data prop to StandardPage
            pageNumber={startPageNumber + 2} // Set an appropriate page number here
            totalPages={totalPages} // Set the total number of pages in your report
        >
            <h5 className="fw-bold">Current Electricity Costs</h5>
            <p>
                The chart below shows the monthly electricity costs without solar. The cost can be divided into an energy and fixed cost component. This analysis helps identify the areas where the solar solution will have the greatest financial impact.
            </p>
            
            <div className="chart-container" style={{height: "400px"}}>
                {data?.financials?.cost_comparison?.length > 0 ? (
                    <Bar data={costBreakdownChartData} options={costBreakdownOptions} />
                ) : (
                    <div className="text-center text-muted p-5">
                        No cost comparison data available
                    </div>
                )}
            </div>
            
            {data?.financials?.annual_savings && (
                <div className="mt-4">
                    <h5 className="fw-bold">Annual Electricity Cost</h5>
                    <p>
                        {(() => {
                            // Calculate average and maximum monthly costs
                            const costComparison = data.financials.cost_comparison || [];
                            const oldCosts = costComparison.map(item => item.old_cost);
                            
                            // Average monthly cost
                            const avgMonthlyCost = oldCosts.length > 0 
                                ? oldCosts.reduce((sum, cost) => sum + cost, 0) / oldCosts.length 
                                : 0;
                                
                            // Maximum monthly cost
                            const maxMonthlyCost = oldCosts.length > 0 
                                ? Math.max(...oldCosts) 
                                : 0;

                            return `Based on this simulation using the client's required energy consumption and tariff, the client's 2025 costs for electricity ${project_type === 'Commercial' ? "(grid plus generator)" : ""} will be on average R ${formatValue(avgMonthlyCost)} per month with a maximum of R ${formatValue(maxMonthlyCost)} (excl. VAT).`;
                        })()}
                        <br/>
                        This equates to an annual electricity cost of approximately <strong>R {formatValue(data.financials.original_annual_cost)}</strong> (excl. VAT).
                    </p>
                </div>
            )}
        </StandardPage>

        <StandardPage
            header="System Performance"
            // footer="Orka Solar - Design Report"
            data={data} // Pass the data prop to StandardPage
            pageNumber={startPageNumber + 3} // Set an appropriate page number here
            totalPages={totalPages} // Set the total number of pages in your report
        >
            <h4 className="fw-bold">Detailed Load Profile</h4>
            <p>
                The client's typical diurnal load profile is shown in the graph below. This visualization helps understand hourly usage patterns and identify opportunities for peak saving and load management.
            </p>
            
            {/* New compact date picker - hidden when printing */}
            <div className="chart-header d-flex justify-content-end align-items-center mb-2">
                <div className="no-print d-flex align-items-center" style={{minWidth: '280px'}}>
                    <DatePicker
                        selected={demandStartDate}
                        onChange={(date) => {
                            // Explicitly set to the start of the selected day (midnight)
                            const selectedDate = new Date(date);
                            selectedDate.setHours(0, 0, 0, 0);
                            setDemandStartDate(selectedDate);
                            
                            // End date is 6 days later (7 days total including start date)
                            const endDate = new Date(selectedDate);
                            endDate.setDate(selectedDate.getDate() + 6);
                            endDate.setHours(23, 59, 59, 999); // End of the last day
                            setDemandEndDate(endDate);
                        }}
                        dateFormat="MMM d, yyyy"
                        className="form-control form-control-sm"
                        style={{width: '160px'}}
                        popperPlacement="bottom-end"
                        minDate={new Date(new Date().getFullYear(), 0, 1)}
                        maxDate={new Date(new Date().getFullYear(), 11, 31)}
                        placeholderText="Select week start date"
                    />
                    <small className="text-muted ms-2 text-nowrap">(Shows 7-day period)</small>
                </div>
            </div>
            
            {/* Demand chart */}
            <div className="chart-container" style={{height: "300px"}}>
                {demandData.length > 0 ? (
                    <Line data={demandChartData} options={demandChartOptions} />
                ) : (
                    <div className="text-center text-muted p-5">
                        No demand data available for the selected period
                    </div>
                )}
            </div>

            {/* Before Project table */}
            <div className="mt-2">
                <p className="mb-1 "><strong>Before Project:</strong> The table below summarizes the current consumption and cost as before the project:</p>
                <p className="mb-1 small">Table 1: Existing operation information</p>
                <div className="table-responsive">
                    <table className="table table-bordered table-sm compact-table">
                        <thead>
                            <tr>
                                <th colSpan="2" className="compact-header" style={{backgroundColor: "#f8f9fa"}}>Current Operation</th>
                            </tr>
                        </thead>
                        <tbody className="small">
                            <tr>
                                <td colSpan="2" className="fst-italic py-1">All values below are for p.a. for year 1 of simulation, excl. VAT, unless specifically stated otherwise</td>
                            </tr>
                            <tr>
                                <td className="py-1">Electricity requirement p.a. (kWh)</td>
                                <td className="text-end py-1">{formatValue(data?.financials?.total_demand_kwh || 0)}</td>
                            </tr>
                            <tr>
                                <td className="py-1">Off-Grid electricity (kWh)</td>
                                <td className="text-end py-1">-</td>
                            </tr>
                            <tr>
                                <td className="py-1">Total Energy Consumption (kWh)</td>
                                <td className="text-end py-1">{formatValue(data?.financials?.total_demand_kwh || 0)}</td>
                            </tr>
                            <tr>
                                <td className="py-1"><strong>Total Cost of Electricity</strong></td>
                                <td className="text-end py-1"><strong>R {formatValue(data?.financials?.original_annual_cost || 0)}</strong></td>
                            </tr>
                            <tr>
                                <td className="py-1">Blended Rate</td>
                                <td className="text-end py-1">R {((data?.financials?.original_annual_cost || 0) / (data?.financials?.total_demand_kwh || 0)).toFixed(2)} /kWh</td>
                            </tr>
                            <tr>
                                <td className="py-1" style={{backgroundColor: "#f8f9fa"}}><strong>Grid Supply</strong></td>
                                <td style={{backgroundColor: "#f8f9fa"}}></td>
                            </tr>
                            <tr>
                                <td className="py-1">Grid Electricity Consumption (y1) (kWh)</td>
                                <td className="text-end py-1">{formatValue(data?.financials?.total_demand_kwh || 0)}</td>
                            </tr>
                            <tr>
                                <td className="py-1">Grid Electricity Cost (y1)</td>
                                <td className="text-end py-1">R {formatValue(data?.financials?.original_annual_cost || 0)}</td>
                            </tr>
                            <tr>
                                <td className="py-1">Cost per unit (y1 energy only)</td>
                                <td className="text-end py-1">R {((data?.financials?.original_annual_cost || 0) / ( data?.financials?.total_demand_kwh || 0)).toFixed(2)} /kWh</td>
                            </tr>
                            {/* <tr>
                                <td className="py-1" style={{backgroundColor: "#f8f9fa"}}><strong>Diesel Generator</strong></td>
                                <td className="text-end py-1" style={{backgroundColor: "#f8f9fa"}}>{data?.project?.diesel_generator || "125kVA Gen. selected"}</td>
                            </tr>
                            <tr>
                                <td className="py-1">Total Capital Costs</td>
                                <td className="text-end py-1">n/a</td>
                            </tr>
                            <tr>
                                <td className="py-1">Electricity from generator (y1) (kWh)</td>
                                <td className="text-end py-1"></td>
                            </tr>
                            <tr>
                                <td className="py-1">Running hours (y1)</td>
                                <td className="text-end py-1"></td>
                            </tr>
                            <tr>
                                <td className="py-1">Cost of diesel</td>
                                <td className="text-end py-1"></td>
                            </tr>
                            <tr>
                                <td className="py-1">Total cost per kWh (y1)</td>
                                <td className="text-end py-1"></td>
                            </tr> */}
                        </tbody>
                    </table>
                </div>
                
                <p className="mt-2">
                    Grid electricity cost shows what it would have been, if there was a grid connection available.
                </p>
            </div>
        </StandardPage>

        <StandardPage
            header="System Performance"
            // footer="Orka Solar - Design Report"
            data={data} // Pass the data prop to StandardPage
            pageNumber={startPageNumber + 4} // Set an appropriate page number here
            totalPages={totalPages} // Set the total number of pages in your report
        >
            <h4 className="fw-bold">System Design</h4>
            <p>
                This section covers the design process and technical data used.
            </p>

            <h5 className="fw-bold">Meteorological Data</h5>
            <p>The detailed designs were done using our verified proprietary software which takes into account the site's specific meteorological information to predict the typical generation that can be expected from the specified equipment simulated over 365 days of the year. This enables an accurate analysis of the system yields and in return accurate results on the financial returns.</p>
            <Image width={300} src={saGHIMap} alt="Meteorological Data" />
            <Image align="right" width={375} src={meanAnnualRainfall} alt="Rainfall Data" />

        </StandardPage>

        <StandardPage
            header="System Performance"
            // footer="Orka Solar - Design Report"
            data={data} // Pass the data prop to StandardPage
            pageNumber={startPageNumber + 5} // Set an appropriate page number here
            totalPages={totalPages} // Set the total number of pages in your report
        >
            <h5 className="fw-bold">System's Technical & Financial Information</h5>
            <p>
                Based on the design and simulation results, the system specifications and financial metrics are as follows:
            </p>
            
            {/* Technical Specifications Banner */}
            <div className="system-specs-banner" style={{
                background: '#cddae6ff',
                padding: '20px 0',
                marginTop: '20px',
                marginBottom: '20px',
                borderRadius: '4px'
            }}>
                <div className="spec-items-container" style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'space-around',
                    alignItems: 'flex-start'
                }}>
                    {/* Solar PV */}
                    <div className="spec-item" style={{ textAlign: 'center', width: '16%' }}>
                        <img src={panel_icon} alt="Solar PV" style={{ width: '60px', height: '60px', marginBottom: '5px' }} />
                        <div style={{ fontWeight: 'bold', fontSize: '16px' }}>Solar PV</div>
                        <div style={{ fontSize: '14px' }}>
                            {(data?.project?.panel_kw).toFixed(2) || 0} <span style={{ fontSize: '14px' }}>kWp</span>
                        </div>
                        <div style={{ fontSize: '14px' }}>
                            {data?.project?.num_panels || Math.ceil((data?.project?.panel_kw || 0) * 1000 / 565)} panels
                        </div>
                    </div>

                    {/* Inverters */}
                    <div className="spec-item" style={{ textAlign: 'center', width: '16%' }}>
                        <img src={inverter_icon} alt="Inverters" style={{ width: '60px', height: '60px', marginBottom: '5px' }} />
                        <div style={{ fontWeight: 'bold', fontSize: '16px' }}>Inverters</div>
                        <div style={{ fontSize: '15px' }}>
                            Total{' '}
                            <span style={{  }}>
                                {formatValue(displayValue(data?.project?.inverter_kva, 85, "inverter_kva"))} <span style={{ fontSize: '14px' }}>kVA</span>
                            </span>
                        </div>
                        {/* <div style={{ fontSize: '15px' }}>
                            Hybrid{' '}
                            <span style={{ fontWeight: '' }}>
                                {formatValue(data?.project?.inverter_hybrid || 0)} <span style={{ fontSize: '14px' }}>kVA</span>
                            </span>
                        </div>
                        <div style={{ fontSize: '15px' }}>
                            Grid{' '}
                            <span style={{ fontWeight: '' }}>
                                {formatValue(data?.project?.inverter_grid || 0)} <span style={{ fontSize: '14px' }}>kVA</span>
                            </span>
                        </div> */}
                    </div>

                    {/* Battery */}
                    <div className="spec-item" style={{ textAlign: 'center', width: '16%' }}>
                        <img src={battery_icon} alt="Battery" style={{ width: '60px', height: '60px', marginBottom: '5px' }} />
                        <div style={{ fontWeight: 'bold', fontSize: '16px' }}>Battery</div>
                        <div style={{ fontSize: '15px' }}>
                            Chemistry: {data?.project?.battery_chem || "LiFePO4"}
                        </div>
                        <div style={{ fontSize: '15px' }}>
                            <span style={{ fontWeight: '' }}>
                                {data.project.battery_nominal_rating ? formatValue(data.project.battery_nominal_rating) : formatValue(displayValue(data?.project?.battery_kwh, 0, "battery_kwh"))}
                            </span>{' '}
                            <span style={{ fontSize: '14px' }}>kWh @100%</span>
                        </div>
                        <div style={{ fontSize: '15px' }}>
                            <span style={{ fontWeight: '' }}>
                                {formatValue(data?.project?.battery_kwh_80 || (displayValue(data?.project?.battery_kwh, 0, "battery_kwh")))}
                            </span>{' '}
                            <span style={{ fontSize: '14px' }}>kWh @80%</span>
                        </div>
                    </div>

                    {/* Specific Yield */}
                    <div className="spec-item" style={{ textAlign: 'center', width: '16%' }}>
                        <img src={yield_icon} alt="Specific Yield" style={{ width: '60px', height: '60px', marginBottom: '5px' }} />
                        <div style={{ fontWeight: 'bold', fontSize: '16px' }}>Specific Yield</div>
                        <div style={{ fontSize: '18px', fontWeight: '' }}>
                            {formatValue(data?.financials?.yield_excl_losses * 365 || 1612)}
                        </div>
                        <div style={{ fontSize: '14px' }}>
                            kWh/kWp/year
                        </div>
                    </div>

                    {/* Utilized Energy */}
                    <div className="spec-item" style={{ textAlign: 'center', width: '16%' }}>
                        <img src={utilized_icon} alt="Utilized Energy" style={{ width: '60px', height: '60px', marginBottom: '5px' }} />
                        <div style={{ fontWeight: 'bold', fontSize: '16px' }}>Utilized Energy<br />from System</div>
                        <div style={{ fontSize: '18px', fontWeight: '' }}>
                            {formatValue(data?.financials?.total_generation_kwh || 68166)}
                        </div>
                        <div style={{ fontSize: '14px' }}>
                            kWh/year
                        </div>
                    </div>

                    {/* Load-shedding Backup */}
                    {/* <div className="spec-item" style={{ textAlign: 'center', width: '16%' }}>
                        <img src={require('../../assets/loadshedding_icon.png')} alt="Load-shedding Backup" style={{ width: '60px', height: '60px', marginBottom: '5px' }} />
                        <div style={{ fontWeight: 'bold', fontSize: '16px' }}>Load-shedding<br />Backup</div>
                        <div style={{ fontSize: '15px' }}>
                            Stg2 2.5hrs: {data?.project?.loadshedding_stg2 || "0%"}
                        </div>
                        <div style={{ fontSize: '15px' }}>
                            Stg4 2.5hrs: {data?.project?.loadshedding_stg4 || "0%"}
                        </div>
                        <div style={{ fontSize: '15px' }}>
                            Stg6 4.5hrs: {data?.project?.loadshedding_stg6 || "0%"}
                        </div>
                    </div> */}
                </div>
            </div>
            

            <div className="mt-3">
                <h5 className="fw-bold">Installed capacity and simulated yield</h5>
                <p className="mb-3">Combined installation capacity and yields are shown in the tables below:</p>
                
                {/* Table 2: Technical Specifications */}
                <div className="table-responsive mb-4">
                    <p className="small mb-1">Table 2: Technical Specifications</p>
                    <table className="table table-bordered table-sm">
                        <thead>
                            <tr>
                                <th style={{width: "60%"}}>Technical Specifications</th>
                                <th style={{width: "20%"}}>Value</th>
                                <th style={{width: "20%"}}>Units</th>
                            </tr>
                        </thead>
                        <tbody className="small">
                            <tr>
                                <td>PV Array</td>
                                <td className="text-end">{(data?.project?.panel_kw || 0).toFixed(2)}</td>
                                <td>kWp</td>
                            </tr>
                            <tr>
                                <td>Number of panels</td>
                                <td className="text-end">{data?.project?.num_panels || Math.ceil((data?.project?.panel_kw || 0) * 1000 / 565) || 0}</td>
                                <td>ea</td>
                            </tr>
                            <tr>
                                <td>Inverter Capacity (Total)</td>
                                <td className="text-end">{formatValue(displayValue(data?.project?.inverter_kva, 0, "inverter_kva"))}</td>
                                <td>kVA</td>
                            </tr>
                            {/* <tr>
                                <td>Inverter Capacity (hybrid with mppt)</td>
                                <td className="text-end">{formatValue(data?.project?.inverter_hybrid || 0)}</td>
                                <td>kVA</td>
                            </tr>
                            <tr>
                                <td>Inverter Capacity (dedicated grid invt.)</td>
                                <td className="text-end">{formatValue(data?.project?.inverter_grid || 0)}</td>
                                <td>kVA</td>
                            </tr> */}
                            <tr>
                                <td>Battery selected</td>
                                <td className="text-end">{formatValue(data?.project?.battery_nominal_rating)}/
                                   {formatValue(data?.project?.battery_kwh_80 || (displayValue(data?.project?.battery_kwh, 0, "battery_kwh")))}</td>
                                <td>kWh</td>
                            </tr>
                            <tr>
                                <td>Distribution</td>
                                <td className="text-end" colSpan="2">{settings.threePhase ? "Three Phase" : "Single Phase"}</td>
                            </tr>
                            <tr>
                                <td>Monitoring</td>
                                <td className="text-end" colSpan="2">Smart metered, remote</td>
                            </tr>
                            <tr>
                                <td>Feedback Prevention</td>
                                <td className="text-end" colSpan="2">Yes</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                

            </div>
        </StandardPage>

        <StandardPage
            header="System Performance"
            // footer="Orka Solar - Design Report"
            data={data} // Pass the data prop to StandardPage
            pageNumber={startPageNumber + 6} // Set an appropriate page number here
            totalPages={totalPages} // Set the total number of pages in your report
        >
                <p className="mb-3">The table below shows the simulated performance yields from the system:</p>
                
                {/* Table 3: Simulated yields */}
                <div className="table-responsive">
                    <p className="small mb-1">Table 3: Simulated yields (y1)</p>
                    <table className="table table-bordered table-sm">
                        <thead>
                            <tr>
                                <th style={{width: "60%"}}>Plant Output Specifications</th>
                                <th style={{width: "20%"}}>Value</th>
                                <th style={{width: "20%"}}>Units</th>
                            </tr>
                        </thead>
                        <tbody className="small">
                            <tr>
                                <td>Daytime Consumption</td>
                                <td className="text-end">{formatValue(data?.simulation?.annual_metrics?.daytime_consumption_pct || 0)}</td>
                                <td>%</td>
                            </tr>
                            <tr>
                                <td>PV Utilization</td>
                                <td className="text-end">{formatValue(data?.simulation?.annual_metrics?.pv_utilization_pct || 0)}</td>
                                <td>%</td>
                            </tr>
                            <tr>
                                <td>Overall Consumption from PV</td>
                                <td className="text-end">{formatValue(data?.simulation?.annual_metrics?.consumption_from_pv_pct || 0)}</td>
                                <td>%</td>
                            </tr>
                            <tr>
                                <td>Potential Generation (daily)</td>
                                <td className="text-end">{formatValue((data?.simulation?.annual_metrics?.potential_gen_daily_kwh || 0))}</td>
                                <td>kWh</td>
                            </tr>
                            <tr>
                                <td>Utilized Generation (daily)</td>
                                <td className="text-end">{formatValue((data?.simulation?.annual_metrics?.utilized_gen_daily_kwh || 0))}</td>
                                <td>kWh</td>
                            </tr>
                            <tr>
                                <td>Throttling Losses (daily)</td>
                                <td className="text-end">{formatValue((data?.simulation?.annual_metrics?.throttling_losses_daily_kwh|| 0))}</td>
                                <td>kWh</td>
                            </tr>
                            <tr>
                                <td>Specific Yield Including Throttling Losses</td>
                                <td className="text-end">{(data?.simulation?.annual_metrics?.specific_yield_incl_losses || 0)}</td>
                                <td>kWh/kWp/day</td>
                            </tr>
                            <tr>
                                <td>Potential Generation p.a.</td>
                                <td className="text-end">{formatValue(data?.simulation?.annual_metrics?.potential_gen_annual_kwh || 0)}</td>
                                <td>kWh</td>
                            </tr>
                            <tr>
                                <td>Utilized Generation p.a.</td>
                                <td className="text-end">{formatValue(data?.simulation?.annual_metrics?.utilized_gen_annual_kwh || 0)}</td>
                                <td>kWh</td>
                            </tr>
                            <tr>
                                <td>Throttling Losses p.a.</td>
                                <td className="text-end">{formatValue(data?.simulation?.annual_metrics?.throttling_losses_annual_kwh || 0)}</td>
                                <td>kWh</td>
                            </tr>
                            <tr>
                                <td>Specific Yield Excl. Throttling Losses</td>
                                <td className="text-end">{(data?.simulation?.annual_metrics?.specific_yield_excl_losses || 0)}</td>
                                <td>kWh/kWp/day</td>
                            </tr>
                            <tr>
                                <td>Battery cycles in 1 year</td>
                                <td className="text-end">{data?.simulation?.annual_metrics?.battery_cycles_annual || '-'}</td>
                                <td>cycles/y</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
        </StandardPage>

        <StandardPage
            header="System Performance"
            // footer="Orka Solar - Design Report"
            data={data} // Pass the data prop to StandardPage
            pageNumber={startPageNumber + 7} // Set an appropriate page number here
            totalPages={totalPages} // Set the total number of pages in your report
        >
            <h5 className="fw-bold">Energy Production</h5>
            <p>The below graph shows the potential solar production from the system per month.</p>

            {/* Monthly Energy Production Chart */}
            <div className="chart-container" style={{height: "300px"}}>
                {data?.financials?.cost_comparison?.length > 0 ? (
                    <Bar 
                        data={monthlyProductionChartData} 
                        options={monthlyProductionChartOptions}
                    />
                ) : (
                    <div className="text-center text-muted p-5">
                        No production data available
                    </div>
                )}
            </div>

            <p className="mt-3">
                The system is projected to generate approximately {formatValue(data?.financials?.potential_generation_kwh || 0)} kWh per year.
            </p>

            <h5 className="fw-bold">Simulated Profiles</h5>

            {/* Simulation Results Graph */}
            <div className="mb-4">
                <p>
                    The below graph shows the consumption and generation profiles for the different components of the system, 
                    post implementation for a number of days in the year.
                </p>
                
            {/* Date picker for simulation graph - hidden when printing */}
            <div className="chart-header d-flex justify-content-end align-items-center mb-2">
                <div className="no-print d-flex align-items-center" style={{minWidth: '280px'}}>
                    <DatePicker
                        selected={simulationStartDate}
                        onChange={(date) => {
                            // Explicitly set to the start of the selected day (midnight)
                            const selectedDate = new Date(date);
                            selectedDate.setHours(0, 0, 0, 0);
                            setSimulationStartDate(selectedDate);
                            
                            // End date is 6 days later (7 days total including start date)
                            const endDate = new Date(selectedDate);
                            endDate.setDate(selectedDate.getDate() + 6);
                            endDate.setHours(23, 59, 59, 999); // End of the last day
                            setSimulationEndDate(endDate);
                        }}
                        dateFormat="MMM d, yyyy"
                        className="form-control form-control-sm"
                        style={{width: '160px'}}
                        popperPlacement="bottom-end"
                        minDate={new Date(new Date().getFullYear(), 0, 1)}
                        maxDate={new Date(new Date().getFullYear(), 11, 31)}
                        placeholderText="Select week start date"
                    />
                    <small className="text-muted ms-2 text-nowrap">(Shows 7-day period)</small>
                </div>
            </div>
                
                <div className="chart-container" style={{height: "320px"}}>
                    {data?.simulation?.timestamps ? (
                        <Line 
                            data={{
                                labels: getFilteredSimulationData.labels,
                                datasets: [
                                    {
                                        label: 'Load Demand (kW)',
                                        data: getFilteredSimulationData.demand,
                                        borderColor: '#ff6384',
                                        backgroundColor: 'rgba(255, 99, 132, 0.1)',
                                        tension: 0.3,
                                        pointRadius: 0,
                                        borderWidth: 2,
                                        fill: false
                                    },
                                    {
                                        label: 'Solar Generation (kW)',
                                        data: getFilteredSimulationData.generation,
                                        borderColor: '#ffce56',
                                        backgroundColor: 'rgba(255, 206, 86, 0.1)',
                                        tension: 0.3,
                                        pointRadius: 0,
                                        borderWidth: 2,
                                    },
                                    {
                                        label: 'Grid Import (kW)',
                                        data: getFilteredSimulationData.import_from_grid,
                                        borderColor: '#cc65fe',
                                        backgroundColor: 'rgba(204, 101, 254, 0.1)',
                                        tension: 0.3,
                                        pointRadius: 0,
                                        borderWidth: 1.5,
                                        borderDash: [5, 5]
                                    },
                                    {
                                        label: 'Battery SOC (%)',
                                        data: getFilteredSimulationData.battery_soc,
                                        borderColor: '#36a2eb',
                                        backgroundColor: 'rgba(54, 162, 235, 0.1)',
                                        yAxisID: 'y1',
                                        tension: 0.3,
                                        pointRadius: 0,
                                        borderWidth: 2
                                    }
                                ]
                            }}
                            options={{
                                responsive: true,
                                maintainAspectRatio: false,
                                interaction: { mode: 'index', intersect: false },
                                scales: {
                                    x: {
                                        type: 'time',
                                        time: { unit: 'day', tooltipFormat: 'MMM dd, HH:mm' },
                                        title: { display: true, text: 'Date' }
                                    },
                                    y: {
                                        beginAtZero: true,
                                        title: { display: true, text: 'Power (kW)' }
                                    },
                                    y1: {
                                        type: 'linear',
                                        display: true,
                                        position: 'right',
                                        beginAtZero: true,
                                        max: 100,
                                        title: { display: true, text: 'Battery SOC (%)' },
                                        grid: { drawOnChartArea: false }
                                    }
                                },
                                plugins: {
                                    legend: { position: 'top' },
                                    title: { display: true, text: 'System Performance Simulation (Sample Week)' },
                                    tooltip: { 
                                        mode: 'index', 
                                        intersect: false,
                                        callbacks: {
                                            title: function(context) {
                                                const date = new Date(context[0].parsed.x);
                                                return date.toLocaleString('en-ZA', { 
                                                    weekday: 'short',
                                                    month: 'short', 
                                                    day: 'numeric', 
                                                    hour: '2-digit', 
                                                    minute: '2-digit'
                                                });
                                            }
                                        }
                                    },
                                    datalabels: { display: false }
                                }
                            }}
                        />
                    ) : (
                        <div className="text-center text-muted p-5">
                            No simulation data available. Please run a system simulation first.
                        </div>
                    )}
                </div>
            </div>
        </StandardPage>
        <StandardPage 
            header="System Performance"
            // footer="Orka Solar - Design Report"
            data={data} // Pass the data prop to StandardPage
            pageNumber={startPageNumber + 8} // Set an appropriate page number here
            totalPages={totalPages} // Set the total number of pages in your report
        >
            <h5 className='fw-bold'>Financial Information</h5>
            <p>The key metrics to evaluate the business case of the project are shown in the table below:</p>
            
            {/* Table 4: Project Business Case Metrics */}
            <div className="table-responsive">
                <p className="small mb-1">Table 4: Project Business Case Metrics and Benchmarking</p>
                <table className="table table-bordered table-sm">
                    <thead>
                        <tr>
                            <th colSpan="2" className="bg-light">
                                {data?.project?.system_type === 'off-grid' 
                                    ? 'Off-Grid Investment Metrics' 
                                    : data?.project?.system_type === 'hybrid' 
                                        ? 'Hybrid Investement Metrics' 
                                        : 'Grid-Tied Investment Metrics'}
                            </th>
                        </tr>
                        <tr>
                            <td colSpan="2" className="fst-italic small bg-light">All values below are year 1 of simulation, excl. VAT.</td>
                        </tr>
                    </thead>
                    <tbody className="small">
                        <tr>
                            <td>Total Capital Cost</td>
                            <td className="text-end">R {formatValue(data?.project?.project_value_excl_vat || 0)}</td>
                        </tr>
                        <tr>
                            <td>Effective cost after tax incentive</td>
                            <td className="text-end">R {formatValue(data?.project?.project_value_excl_vat * 0.73 || 0)}</td>
                        </tr>
                        {/* <tr>
                            <td>Total utility cost savings</td>
                            <td className="text-end">R {formatValue(data?.financials?.annual_savings || 0)}</td>
                        </tr> */}
                        {/* <tr>
                            <td>Utility Fixed Fee Savings</td>
                            <td className="text-end">R {formatValue(data?.financials?.cost_comparison?.[0]?.old_bill_breakdown?.fixed - 
                                                             data?.financials?.cost_comparison?.[0]?.new_bill_breakdown?.fixed || 0)}</td>
                        </tr> */}
                        {/* <tr>
                            <td>Utility Energy Cost Savings</td>
                            <td className="text-end">R {formatValue(data?.financials?.cost_comparison?.[0]?.old_bill_breakdown?.energy - 
                                                             data?.financials?.cost_comparison?.[0]?.new_bill_breakdown?.energy || 0)}</td>
                        </tr> */}
                        
                        {/* Generator Running Cost - Only for off-grid systems */}
                        {data?.project?.system_type === 'off-grid' && (
                            <tr>
                                <td>Generator Running Cost</td>
                                <td className="text-end">R {formatValue(data?.financials?.generator_running_cost || 0)}</td>
                            </tr>
                        )}
                        
                        <tr>
                            <td>Savings (year 1)</td>
                            <td className="text-end">R {formatValue(data?.financials?.annual_savings || 0)}</td>
                        </tr>
                        <tr>
                            <td>First year yield</td>
                            <td className="text-end">
                                {data?.financials?.yield_year1 || 
                                Math.round((data?.financials?.annual_savings / data?.project?.project_value_excl_vat) * 100) || 0}%
                            </td>
                        </tr>
                        <tr>
                            <td>Payback (years)</td>
                            <td className="text-end">
                                {(data?.financials?.payback_period || 0).toFixed(2)}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
            
            <p className="mt-3">
                The client's new monthly cost of electricity compared the current cost, as well as the cost and savings in year
                one after installation is shown in the graphs below.
            </p>
            
            {/* Monthly Cost Comparison Line Chart */}
            <div className="figures-side-by-side mt-4">
                <div className="figure-left">
                    <p className="small mb-1">Figure 12: Client new monthly utility cost</p>
                    <div className="chart-container" style={{height: "300px"}}>
                        {data?.financials?.cost_comparison?.length > 0 ? (
                            <Line 
                                data={{
                                    labels: data.financials.cost_comparison.map(item => {
                                        const date = new Date(item.month);
                                        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                                    }),
                                    datasets: [
                                        {
                                            label: 'Grid Electricity Cost (no load shedding)',
                                            data: data.financials.cost_comparison.map(item => item.old_cost),
                                            borderColor: '#6c757d',
                                            borderWidth: 2.5,
                                            tension: 0.3,
                                            pointRadius: 0,
                                            fill: false
                                        },
                                        {
                                            label: project_type === 'Commercial' ? 'New Grid + Generator Cost' : 'New Grid Cost',
                                            data: data.financials.cost_comparison.map(item => item.new_cost),
                                            borderColor: '#20c997',
                                            borderWidth: 2.5,
                                            tension: 0.3,
                                            pointRadius: 0,
                                            fill: false
                                        }
                                    ]
                                }}
                                options={{
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    plugins: {
                                        legend: { position: 'top' },
                                        title: { display: false },
                                        tooltip: { mode: 'index', intersect: false },
                                        datalabels: { display: false }
                                    },
                                    scales: {
                                        x: { 
                                            grid: { display: false },
                                            ticks: { maxRotation: 0 }
                                        },
                                        y: {
                                            beginAtZero: true,
                                            ticks: {
                                                callback: function(value) {
                                                    return 'R ' + value.toLocaleString('en-ZA');
                                                }
                                            },
                                            title: { display: false }
                                        }
                                    }
                                }}
                            />
                        ) : (
                            <div className="text-center text-muted p-5">
                                No cost comparison data available
                            </div>
                        )}
                    </div>
                </div>

                {/* Annual Cost Breakdown Bar Chart */}
                <div className="figure-right">
                    <p className="small mb-1">Figure 13: Cost saving in year 1</p>
                    <div className="chart-container" style={{height: "300px"}}>
                        {data?.financials?.original_annual_cost && data?.financials?.new_annual_cost ? (
                            <Bar
                                data={{
                                    labels: ['Cost of Electricity p.a.'],
                                    datasets: [
                                        {
                                            label: 'Current cost p.a. - total',
                                            data: [data.financials.original_annual_cost],
                                            backgroundColor: '#6c757d',
                                            barPercentage: 0.6
                                        },
                                        {
                                            label: 'New Cost p.a. - total',
                                            data: [data.financials.new_annual_cost],
                                            backgroundColor: '#18736a',
                                            stack: 'savings-stack',
                                            barPercentage: 0.6
                                        },                                        
                                        {
                                            label: 'Saving p.a. y1',
                                            data: [data.financials.annual_savings],
                                            backgroundColor: '#98e7c8',
                                            stack: 'savings-stack',
                                            barPercentage: 0.6
                                        }
                                    ]
                                }}
                                options={{
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    plugins: {
                                        legend: { position: 'bottom' },
                                        title: {
                                            display: true,
                                            text: 'Cost of Electricity p.a.',
                                            position: 'top',
                                            align: 'center',
                                            font: { size: 14 }
                                        },
                                        tooltip: { mode: 'index', intersect: false },
                                        datalabels: {
                                            display: true,
                                            color: '#fff',
                                            font: { weight: 'bold' },
                                            formatter: (value) => {
                                                return 'R' + formatValue(value);
                                            },
                                            anchor: 'center',
                                            align: 'center'
                                        }
                                    },
                                    scales: {
                                        x: { 
                                            display: false 
                                        },
                                        y: {
                                            beginAtZero: true,
                                            ticks: {
                                                callback: function(value) {
                                                    return 'R' + value.toLocaleString('en-ZA');
                                                }
                                            }
                                        }
                                    }
                                }}
                            />
                        ) : (
                            <div className="text-center text-muted p-5">
                                No annual cost data available
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </StandardPage>
        <StandardPage
            header="System Performance"
            // footer="Orka Solar - Design Report"
            data={data} // Pass the data prop to StandardPage
            pageNumber={startPageNumber + 9} // Set an appropriate page number here
            totalPages={totalPages} // Set the total number of pages in your report
        >
            <h6 className="fw-bold">Post installation cost summary:</h6>

            <div className="table-responsive">
                <p className="small mb-1">Table 5: Cost and Savings Details</p>
                <table className="table table-bordered table-sm">
                    <thead>
                        <tr>
                            <th colSpan="2" className="bg-light">
                                {data?.project?.system_type === 'off-grid' 
                                    ? 'Off-Grid ESS' 
                                    : data?.project?.system_type === 'hybrid' 
                                        ? 'Hybrid ESS' 
                                        : 'Grid-Tied Solar PV'}
                            </th>
                        </tr>
                        <tr>
                            <td colSpan="2" className="fst-italic small bg-light">
                                All values below are for p.a. for year 1 of simulation, excl. VAT, unless specifically stated otherwise
                            </td>
                        </tr>
                    </thead>
                    <tbody className="small">
                        <tr>
                            <td>Total Capital Costs (excl. VAT)</td>
                            <td className="text-end">R {formatValue(data?.project?.project_value_excl_vat || 0)}</td>
                        </tr>
                        <tr>
                            <td>Effective cost (after appl. tax benefit)</td>
                            <td className="text-end">R {formatValue(data?.project?.project_value_excl_vat * 0.73 || 0)}</td>
                        </tr>
                        <tr>
                            <td>Total Energy Consumption (kWh)</td>
                            <td className="text-end">{formatValue(data?.financials?.total_demand_kwh || 0)}</td>
                        </tr>
                        <tr>
                            <td>Total Cost of Electricity</td>
                            <td className="text-end">R {formatValue(data?.financials?.new_annual_cost || 0)}</td>
                        </tr>
                        <tr>
                            <td>Blended Rate (R/kWh)</td>
                            <td className="text-end">
                                R {((data?.financials?.new_annual_cost || 0) / (data?.financials?.total_demand_kwh || 1)).toFixed(2)}
                            </td>
                        </tr>
                        
                        {/* Savings Section */}
                        <tr className="bg-light">
                            <td colSpan="2" className="bg-light"><strong>Savings</strong></td>
                        </tr>
                        <tr>
                            <td><strong>Total Cost Savings (y1)</strong></td>
                            <td className="text-end">R {formatValue(data?.financials?.annual_savings || 0)}</td>
                        </tr>
                        <tr>
                            <td>Grid savings (y1)</td>
                            <td className="text-end">R {formatValue(data?.financials?.annual_savings || 0)}</td>
                        </tr>
                        {(data?.project?.system_type === 'hybrid' || data?.project?.system_type === 'off-grid') &&  project_type === 'Commercial' && (
                            <tr>
                                <td>Generator cost savings (y1)</td>
                                <td className="text-end">R {formatValue(data?.financials?.generator_cost_savings || 0)}</td>
                            </tr>
                        )}
                        
                        {/* Grid Section - Only show for grid-tied and hybrid */}
                        {data?.project?.system_type !== 'off-grid' && (
                            <>
                                <tr className="bg-light">
                                    <td colSpan="2" className="bg-light"><strong>New Grid Supply</strong></td>
                                </tr>
                                <tr>
                                    <td>Grid Electricity Consumption (y1) (kWh)</td>
                                    <td className="text-end">{formatValue(data?.financials?.total_import_kwh || 0)}</td>
                                </tr>
                                <tr>
                                    <td>Grid Electricity Cost (y1)</td>
                                    <td className="text-end">R {formatValue(data?.financials?.new_annual_cost || 0)}</td>
                                </tr>
                            </>
                        )}
                        
                        {/* Solar/Battery Section - Show for all types but with different labels */}
                        <tr className="bg-light">
                            <td colSpan="2" className="bg-light">
                                <strong>
                                    {data?.project?.system_type === 'hybrid' 
                                        ? 'Hybrid ESS' 
                                        : data?.project?.system_type === 'off-grid' 
                                        ? 'Off-Grid ESS' 
                                        : 'Grid-Tied Solar PV'}
                                </strong>
                            </td>
                        </tr>
                        <tr>
                            <td>Electricity from PV (y1) direct {data?.project?.system_type === 'off-grid' ? 'Off-Grid' : 'On-Grid'} (kWh)</td>
                            <td className="text-end">
                                {formatValue(data?.financials?.pv_direct_consumption || data?.financials?.total_generation_kwh * 0.6 || 0)}
                            </td>
                        </tr>
                        <tr>
                            <td>Electricity from PV (y1) direct consumption (kWh)</td>
                            <td className="text-end">
                                {formatValue(data?.financials?.pv_direct_consumption || data?.financials?.total_generation_kwh * 0.6 || 0)}
                            </td>
                        </tr>
                        {(data?.project?.system_type === 'hybrid' || data?.project?.system_type === 'off-grid') && (
                            <>
                                <tr>
                                    <td>Electricity from PV (y1) direct {data?.project?.system_type === 'off-grid' ? 'Off-Grid' : 'On-Grid'} (kWh)</td>
                                    <td className="text-end">
                                        {formatValue(data?.financials?.pv_direct_consumption || data?.financials?.total_generation_kwh * 0.6 || 0)}
                                    </td>
                                </tr>
                                {data?.project?.allow_export && (
                                    <tr>
                                        <td>Electricity from PV (y1) surplus recovery (kWh)</td>
                                        <td className="text-end">{formatValue(data?.financials?.exported_energy || 0)}</td>
                                    </tr>
                                )}
                                <tr>
                                    <td>Electricity from Battery (y1) (kWh)</td>
                                    <td className="text-end">
                                        {formatValue(data?.financials?.battery_discharge || data?.financials?.total_generation_kwh * 0.4 || 0)}
                                    </td>
                                </tr>
                            </>
                        )}
                        
                        {/* Generator Section - Only for hybrid and off-grid */}
                        {(data?.project?.system_type === 'hybrid' || data?.project?.system_type === 'off-grid') && project_type === 'Commercial' && (
                            <>
                                <tr className="bg-light">
                                    <td colSpan="2"><strong>New Diesel Generator</strong></td>
                                </tr>
                                <tr>
                                    <td>Electricity from generator (y1) (kWh)</td>
                                    <td className="text-end">{formatValue(data?.financials?.generator_energy || 0)}</td>
                                </tr>
                                <tr>
                                    <td>Generator Electricity Cost (y1)</td>
                                    <td className="text-end">R {formatValue(data?.financials?.generator_running_cost || 0)}</td>
                                </tr>
                            </>
                        )}
                    </tbody>
                </table>

                {(data?.project?.system_type === 'hybrid' || data?.project?.system_type === 'off-grid') && project_type === 'Commercial' && (
                    <p className="small mt-2 fst-italic">
                        *Generator costs based on simulated load shedding scenarios and quiet hours.
                    </p>
                )}
            </div>
        </StandardPage>

        <StandardPage
            header="System Performance"
            // footer="Orka Solar - Design Report"
            data={data} // Pass the data prop to StandardPage
            pageNumber={startPageNumber + 10} // Set an appropriate page number here
            totalPages={totalPages} // Set the total number of pages in your report
        >
            <div className="scope-of-work">
                <h5 className="fw-bold">Scope of Work</h5>

                <p>The following scope of work will be completed as part of the project and are included in the cost of the proposal:</p>
                
                <ul className="ps-4">
                    <li>Engineering design done by qualified Orka Solar engineers.</li>
                    <li>Full <span className="fw-bold">turn key</span> solution, done by experienced Orka Solar employees, including:
                        <ul className="circle-list">
                            <li>Procurement, delivery and installation</li>
                            <li>Site supervision</li>
                            <li>SHEQ management</li>
                            <li>Project management</li>
                            <li>Testing and commissioning</li>
                            <li>Electrical Certificate of Compliance</li>
                            <li>Client training and project hand over</li>
                        </ul>
                    </li>
                    <li>Manufacturer's warranty on all major equipment and workmanship warranty.</li>
                    <li>Orka Solar warranty on installation and project performance.</li>
                </ul>
                
                {/* <h6 className="fw-bold">Major Equipment List</h6>
                
                <p>The major equipment and materials that may be used as part of this project is listed below:</p>
                
                <div className="table-responsive">
                    <table className="table table-bordered table-sm compact-table">
                        <tbody>
                            <tr>
                                <td style={{width: '30%'}}>PV Modules</td>
                                <td style={{width: '30%'}}>
                                    Tier 1:<br/>
                                    JA Solar/ Jinko Solar
                                </td>
                                <td style={{width: '40%', textAlign: 'center'}}>
                                    <div className="d-flex justify-content-around align-items-center">
                                        <div className="logo-placeholder">JA SOLAR</div>
                                        <div className="logo-placeholder">Jinko Solar</div>
                                    </div>
                                </td>
                            </tr>
                            <tr>
                                <td>Grid Inverters</td>
                                <td>Fronius</td>
                                <td style={{textAlign: 'center'}}>
                                    <div className="d-flex justify-content-around align-items-center">
                                        <div className="logo-placeholder">Fronius</div>
                                        <div className="logo-placeholder">SMA</div>
                                        <div className="logo-placeholder">HUAWEI</div>
                                    </div>
                                </td>
                            </tr>
                            <tr>
                                <td>Hybrid Inverters</td>
                                <td>Victron Hybrid</td>
                                <td style={{textAlign: 'center'}}>
                                    <div className="logo-placeholder">victron energy</div>
                                </td>
                            </tr>
                            <tr>
                                <td>Mounting Structure</td>
                                <td>
                                    Lumax <sup>®</sup>
                                </td>
                                <td style={{textAlign: 'center'}}>
                                    <div className="logo-placeholder">LUMAX ENERGY</div>
                                </td>
                            </tr>
                            <tr>
                                <td>Switch Gear</td>
                                <td>ABB/ Schneider</td>
                                <td style={{textAlign: 'center'}}>
                                    <div className="logo-placeholder">Schneider Electric</div>
                                </td>
                            </tr>
                            <tr>
                                <td>Battery Storage<br/>LiFePO4 &<br/>Super Caps</td>
                                <td>
                                    Freedom Won<br/>
                                    WEST (S Caps)
                                </td>
                                <td style={{textAlign: 'center'}}>
                                    <div className="d-flex justify-content-around align-items-center">
                                        <div className="logo-placeholder">freedom won</div>
                                        <div className="logo-placeholder">WEST</div>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div> */}

                <h5 className="fw-bold">Quality and Warranty</h5>

                <p>
                    Orka Solar is product agnostic and can therefore supply equipment to the client's specification, provided that 
                    the equipment meets the minimum quality standards of our company. Orka Solar has long standing relationships 
                    with our product suppliers and the products proposed as part of this design are of the highest quality and comes 
                    with standard supplier or manufacturer's warranties. 
                    {/* Only internationally recognised tier 1 rated panels will be 
                    supplied. */}
                </p>
                
                <p>Major component warranty details are provided below:</p>
                
                <ul className="ps-4">
                    <li>PV modules: <span className="fw-bold">12-year</span> product warranty, <span className="fw-bold">25-year</span> linear power output warranty</li>
                    <li>Inverter: <span className="fw-bold">5-year</span> manufacturer's warranty (option to extend to 10 years)</li>
                    <li>Mounting system <span className="fw-bold">10-year</span> manufacturer's warranty</li>
                    <li>Workmanship warranty of <span className="fw-bold">2-years</span></li>
                    <li>Post installation maintenance, monitoring and control service available from Orka Solar to ensure optimal benefit from the system.</li>
                </ul>
            </div>
        </StandardPage>

        <StandardPage
            header="System Performance"
            // footer="Orka Solar - Design Report"
            data={data} // Pass the data prop to StandardPage
            pageNumber={startPageNumber + 11} // Set an appropriate page number here
            totalPages={totalPages} // Set the total number of pages in your report
        >
            <div className="terms-of-service">
                <h5 className="fw-bold">Terms of Service</h5>

                <p>The project's invoicing will be as follows: 50% deposit on order, 40% on delivery of panels and inverters to site and 10% on project handover certificate sign off.
                
                Prices are valid to {priceValidUntil}. Thereafter, prices may change due to exchange rate fluctuations, inflation (CPI) and/or supplier price changes.
                
                Invoices will be paid on 7 days terms.
                
                Late delivery penalty due to delays caused by the contractor will be 0.5% of project value per week.
                </p>
                <h5 className="fw-bold">Project Schedule</h5>

                <p>The project timeline is dependent on the date of deposit and availability of key components. An indicative timeline for this project without any delays due to long lead items are shown below:</p>
                
                <div className="table-responsive">
                    <table className="table table-bordered table-sm compact-table">
                        <thead>
                            <tr>
                                <th>Activity/ phase/ milestone</th>
                                <th>Project week</th>
                            </tr>
                        </thead>
                        <tbody>
                            {settings.projectSchedule.map((item, index) => (
                                <tr key={index}>
                                    <td>{item.activity}</td>
                                    <td>{item.timeline}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <h5 className="fw-bold">Standards and Regulations</h5>

                <p>Orka Solar installations are completed in compliance with the following standards and regulations where applicable:</p>
                
                <ul className="ps-4">
                    <li>Electricity Regulation Act, 2006</li>
                    <li>NRS097-2-1: Utility Interface</li>
                    <li>NRS097-2-3: Simplified utility connection criteria for low-voltage connected generators</li>
                    <li>South African Renewable Power Plant Grid Code (although the NRS 097-2 series cover most issues relevant to SSEG)</li>
                    <li>NRS 048: Electricity Supply – Quality of Supply</li>
                    <li>SANS 10142-1 and 10142-1-2: The wiring of premises (as amended and published)</li>
                    <li>SANS 62305-4:2011 Protection against lightning and Surge – Surge Arrestors and Earthing Regulations</li>
                    <li>SANS 474 / NRS 057: Code of Practice for Electricity Metering</li>
                    <li>Municipal Electricity Supply by-laws of the applicable municipality</li>
                </ul>
            </div>
        </StandardPage>

        <StandardPage
            header="System Performance"
            // footer="Orka Solar - Design Report"
            data={data} // Pass the data prop to StandardPage
            pageNumber={startPageNumber + 12} // Set an appropriate page number here
            totalPages={totalPages} // Set the total number of pages in your report
        >
            <h5 className="fw-bold">Notable Points</h5>
                <p>The following assumptions and exclusions were made and form part of this proposal:</p>
                <ol className="ps-4">
                    <li>{settings.usedActualConsumption ? "Actual consumption data was used for the design and simulations of the solution." : "Actual consumption data was not used for the design and simulations of the solution."} Should the loads change or differ from the data analysed Orka Solar should be notified by the client.</li>
                    <li>It was assumed that the consumption data is a fair representation of the future consumption.</li>
                    <li>When applicable, in most municipalities there is currently either no regulations around exporting electricity to the grid, or such export is prohibited. For this reason, Orka Solar advise against exporting excess solar energy to the grid without the required permits, although many of Orka Solar' clients have chosen to export where possible. All inverters supplied by Orka Solar conform to internationally recognized grid-export safety regulations.</li>
                    <li>The scope and activities listed as part of this proposal is sufficient so successfully delivery the project. Any additional work, not listed as part of this scope and which could not be taken into account, will be negotiated separately, regarding any additional time and/or materials that may be required.</li>
                    <li>Orka Solar reserve the right to requote should a detailed site visit and logging not have been completed or if any of the assumptions or information provided are found not to be accurate.</li>
                    <li>It was assumed that all existing infrastructure on site are installed according to the relevant standards and complies with regulation.</li>
                    <li>Unless specified otherwise:
                        <ol type="a" className="ps-4">
                            <li>Generator integration is excluded.</li>
                            <li>Construction of walkways are excluded.</li>
                            <li>No roof inspection for possible roof mounted panels were included, it is recommended that the client conduct such an inspection or contact Orka Solar to facilitate an inspection with a qualified third party.</li>
                            <li>Tree trimming/removal is excluded from the scope of work.</li>
                            <li>MV Transformers and/or MV switchgear are excluded.</li>
                            <li>No cost for building an inverter enclosure has been excluded.</li>
                            <li>No cost for internet supply has been allowed for, as the client will supply internet to the inverter enclosure by means of an ethernet socket.</li>
                            <li>No costs for Eskom's SSEG or NERSA administration has been allowed.</li>
                            <li>It was assumed that all existing infrastructure on site are installed according to the relevant standards and complies with regulation.</li>
                        </ol>
                    </li>
                    <li>Orka Solar guarantees the production output of the system if an active Orka Solar SLA is in place.</li>
                </ol>

        </StandardPage>

    </>
    );
}

export default MainReportContent;