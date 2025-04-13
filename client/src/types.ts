// Shared type definitions for the GStorm application

// Represents a single time step in the calculated hyetograph
export interface StormStep {
  timeStart: number;       // minutes from start of storm
  timeEnd: number;         // minutes from start of storm
  intensity: number;       // Calculated intensity (in/hr or mm/hr)
  depthStep: number;       // Depth during this step (in or mm)
  cumulativeDepth: number; // Cumulative depth up to the end of this step (in or mm)
}

// Represents the complete result of a hyetograph calculation
export interface CalculationResult {
  labels: string[];           // Formatted time labels for the chart x-axis
  intensityData: number[];    // Intensity values for the chart y-axis
  peakIntensity: number;      // Maximum calculated intensity
  totalDepthActual: number;   // Sum of all depth steps (should closely match input total depth)
  intensityUnit: string;      // e.g., 'in/hr' or 'mm/hr'
  depthUnit: string;          // e.g., 'in' or 'mm'
  detailedData: StormStep[];  // Array containing data for each time step
}

// Represents the input parameters gathered from the form
export interface StormInputParameters {
    totalDepth: number | string; // Allow string for input field binding
    duration: 6 | 12 | 24; // Restrict duration to specific hour values
    stormCategory: 'SCS' | 'NRCS' | 'Huff'; // Main category
    stormSubType: string; // Specific type within the category (e.g., 'Type II', 'Northeast Type A', 'Huff Type I')
    timeStep: number | string;
    depthUnits: 'us' | 'metric';
}

// Represents the structure of parsed NOAA PFDS data for the table
export interface NoaaDataPoint {
    durationLabel: string; // e.g., "60-min", "24-hr"
    depth: number; // Precipitation depth in inches
    durationValue: number; // Numeric duration (e.g., 60, 24)
    durationUnits: 'minutes' | 'hours'; // Unit for durationValue
}

export interface NoaaReturnPeriodData {
    returnPeriod: number; // e.g., 2, 5, 10, 100
    dataPoints: NoaaDataPoint[];
}

// Represents the state for NOAA fetching and results
export interface NoaaState {
    latitude: number | null;
    longitude: number | null;
    isLoading: boolean;
    error: string | null;
    data: NoaaReturnPeriodData[] | null; // Array of return periods, each with data points
    statusMessage: string; // User-facing status like "Click map", "Fetching...", "Error..."
} 