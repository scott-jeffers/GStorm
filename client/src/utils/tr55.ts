export const INCH_TO_MM = 25.4;

// --- Reference Data (Standard TR-55 Cumulative Fractions) ---
// Copied from reference HTML, adjusted keys for consistency
const tr55DataBase = {
    "Type I": {
        time_hours: [0.0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 6.0, 6.5, 7.0, 7.5, 8.0, 8.25, 8.5, 8.75, 9.0, 9.25, 9.5, 9.75, 10.0, 10.5, 11.0, 11.5, 12.0, 12.5, 13.0, 13.5, 14.0, 14.5, 15.0, 16.0, 17.0, 18.0, 19.0, 20.0, 24.0],
        cumulative_fraction: [0.0, 0.017, 0.034, 0.051, 0.068, 0.085, 0.102, 0.119, 0.136, 0.153, 0.17, 0.187, 0.204, 0.221, 0.238, 0.255, 0.28, 0.298, 0.324, 0.354, 0.385, 0.415, 0.446, 0.477, 0.508, 0.563, 0.618, 0.673, 0.728, 0.777, 0.817, 0.848, 0.879, 0.909, 0.937, 0.961, 0.977, 0.987, 0.993, 0.997, 1.0]
    },
    "Type Ia": {
        time_hours: [0.0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 6.0, 6.5, 7.0, 7.5, 7.75, 8.0, 8.25, 8.5, 8.75, 9.0, 9.25, 9.5, 9.75, 10.0, 10.5, 11.0, 11.5, 12.0, 12.5, 13.0, 13.5, 14.0, 14.5, 15.0, 16.0, 17.0, 18.0, 19.0, 20.0, 24.0],
        cumulative_fraction: [0.0, 0.022, 0.044, 0.066, 0.088, 0.11, 0.132, 0.154, 0.176, 0.198, 0.22, 0.242, 0.264, 0.286, 0.315, 0.431, 0.496, 0.551, 0.596, 0.632, 0.661, 0.686, 0.708, 0.728, 0.746, 0.764, 0.793, 0.822, 0.851, 0.88, 0.902, 0.924, 0.946, 0.968, 0.978, 0.984, 0.988, 0.991, 0.994, 0.996, 0.998, 1.0]
    },
    "Type II": {
        time_hours: [0.0, 2.0, 4.0, 6.0, 8.0, 9.0, 10.0, 10.5, 11.0, 11.5, 11.75, 12.0, 12.25, 12.5, 13.0, 13.5, 14.0, 16.0, 20.0, 24.0],
        cumulative_fraction: [0.0, 0.022, 0.048, 0.08, 0.12, 0.147, 0.181, 0.204, 0.235, 0.283, 0.357, 0.663, 0.735, 0.772, 0.811, 0.844, 0.872, 0.922, 0.972, 1.0]
    },
    "Type III": {
         time_hours: [0.0, 2.0, 4.0, 6.0, 8.0, 9.0, 10.0, 10.5, 11.0, 11.5, 11.75, 12.0, 12.25, 12.5, 13.0, 13.5, 14.0, 16.0, 20.0, 24.0],
         cumulative_fraction: [0.0, 0.02, 0.043, 0.072, 0.107, 0.135, 0.17, 0.194, 0.225, 0.267, 0.337, 0.5, 0.663, 0.733, 0.775, 0.806, 0.83, 0.91, 0.968, 1.0]
    }
};

// Type definition for the processed distribution data
interface DistributionData {
    time_minutes: number[];
    cumulative_fraction: number[];
}

// Type for the structured TR55 data store
type Tr55Distributions = Record<string, DistributionData>;

// --- Pre-process Base Data (convert hours to minutes, ensure integrity) ---
function preprocessTr55Data(): Tr55Distributions {
    const processedDistributions: Tr55Distributions = {};
    for (const type in tr55DataBase) {
        if (Object.prototype.hasOwnProperty.call(tr55DataBase, type)) {
            const sourceData = tr55DataBase[type as keyof typeof tr55DataBase];
            if (!sourceData.time_hours || !sourceData.cumulative_fraction || sourceData.time_hours.length !== sourceData.cumulative_fraction.length) {
                console.error(`TR-55 Preprocessing: Invalid or mismatched data for storm type: ${type}`);
                continue;
            }

            // Defensive copy and convert time to minutes
            let time_minutes = sourceData.time_hours.map(h => h * 60.0);
            let cumulative_fraction = [...sourceData.cumulative_fraction];

            // Data Integrity Checks (ensure start at 0,0 and end at 1440, 1.0)
            if (time_minutes.length === 0 || time_minutes[0] !== 0 || cumulative_fraction[0] !== 0) {
                console.warn(`TR-55 Preprocessing: Adjusting ${type} to start at (0 min, 0.0 fraction).`);
                // Remove incorrect starting points if necessary
                while(time_minutes.length > 0 && (time_minutes[0] !== 0 || cumulative_fraction[0] !== 0)){
                    if(time_minutes[0] === 0 && cumulative_fraction[0] !== 0) {
                         cumulative_fraction.shift(); // Keep time=0 if fraction is wrong
                         time_minutes.shift();
                    } else {
                         time_minutes.shift();
                         cumulative_fraction.shift();
                    }
                }
                time_minutes.unshift(0);
                cumulative_fraction.unshift(0);
            }

            const lastIdx = time_minutes.length - 1;
            if (lastIdx < 0 || Math.abs(time_minutes[lastIdx] - 1440.0) > 0.1 || Math.abs(cumulative_fraction[lastIdx] - 1.0) > 0.001) {
                 console.warn(`TR-55 Preprocessing: Adjusting ${type} to end at (1440 min, 1.0 fraction).`);
                // Remove points after 1440 min
                 while(time_minutes.length > 0 && time_minutes[time_minutes.length - 1] > 1440.0) {
                     time_minutes.pop();
                     cumulative_fraction.pop();
                 }
                 // Add or adjust the last point
                 const currentLastIdx = time_minutes.length - 1;
                 if(currentLastIdx < 0 || time_minutes[currentLastIdx] < 1439.9) {
                     time_minutes.push(1440.0);
                     cumulative_fraction.push(1.0);
                 } else {
                     // Ensure the last point (which should be <= 1440) has fraction 1.0
                     cumulative_fraction[currentLastIdx] = 1.0;
                 }
            }

            processedDistributions[type] = { time_minutes, cumulative_fraction };
        }
    }
    console.log("Processed TR-55 Base Distributions:", processedDistributions);
    return processedDistributions;
}

// Store the pre-processed data
export const tr55Distributions: Tr55Distributions = preprocessTr55Data();

// --- Linear Interpolation --- Must match original logic
export function linearInterpolate(x: number, xPoints: number[], yPoints: number[]): number {
    if (x <= xPoints[0]) return yPoints[0];
    const lastIndex = xPoints.length - 1;
    if (x >= xPoints[lastIndex]) return yPoints[lastIndex];

    let i = 1;
    // Find the interval [xPoints[i-1], xPoints[i]] where x lies
    while (i < xPoints.length && xPoints[i] < x) {
        i++;
    }

    // Handle cases where x matches an exact point
     if (i < xPoints.length && x === xPoints[i]) {
         return yPoints[i];
     }
     // Handle edge case where loop finishes but x equals the first point (shouldn't happen due to first check, but safety)
     if (i === 0) return yPoints[0]; 

    // Perform linear interpolation
    const x0 = xPoints[i - 1];
    const x1 = xPoints[i];
    const y0 = yPoints[i - 1];
    const y1 = yPoints[i];

    // Avoid division by zero if points are identical (shouldn't happen with good data)
    if (x1 === x0) return y0;

    return y0 + (y1 - y0) * ((x - x0) / (x1 - x0));
}

import { CalculationResult, StormStep } from '../types'; // Define types in a separate file

// Type for input parameters to calculation
export interface CalculationInputs {
    totalDepthInput: number;
    durationInput: number;
    stormType: string;
    timeStepMinutes: number;
    depthUnit: 'us' | 'metric'; // 'us' (inches) or 'metric' (mm)
    durationUnit: 'hours' | 'minutes';
}

// --- Calculate Hyetograph Logic ---
export function calculateHyetograph(inputs: CalculationInputs): CalculationResult {
    const { totalDepthInput, durationInput, stormType, timeStepMinutes, depthUnit, durationUnit } = inputs;

    const stormDataStore: StormStep[] = []; // Store detailed step data locally for this calculation

    if (!tr55Distributions[stormType]) {
        console.error("Selected storm type not found in base data:", stormType);
        return createEmptyResult();
    }

    const baseData = tr55Distributions[stormType];
    const baseTimes = baseData.time_minutes;
    const baseCumulativeFractions = baseData.cumulative_fraction;

    let totalDepth = totalDepthInput; // Already a number
    let durationValue = durationInput;

    // Input Validation
    if (isNaN(totalDepth) || isNaN(durationValue) || isNaN(timeStepMinutes) || totalDepth <= 0 || durationValue <= 0 || timeStepMinutes <= 0) {
        console.warn("Invalid input values provided to calculateHyetograph.");
        return createEmptyResult();
    }

    const isMetric = depthUnit === 'metric';
    const durationMinutes = (durationUnit === 'hours') ? durationValue * 60 : durationValue;
    const totalDepthInches = isMetric ? totalDepth / INCH_TO_MM : totalDepth; // Always work in inches internally

    let peakIntensity = 0;
    let calculatedTotalDepthInches = 0;
    // Ensure integer number of steps covering the full duration
    const numSteps = Math.ceil(durationMinutes / timeStepMinutes);
    // Generate target times from 0 up to and including the final duration step end
    const targetTimes = Array.from({ length: numSteps + 1 }, (_, i) => Math.min(i * timeStepMinutes, durationMinutes));
    // Ensure the last time point is exactly the duration
    if (targetTimes[targetTimes.length - 1] < durationMinutes) {
        targetTimes.push(durationMinutes);
    }
    // Filter out potential duplicate end time if duration is exact multiple of timestep
    if(targetTimes.length > 1 && targetTimes[targetTimes.length - 1] === targetTimes[targetTimes.length - 2]) {
        targetTimes.pop();
    }


    const targetCumulativeDepthsInches: number[] = [0];
    for (let i = 1; i < targetTimes.length; i++) {
        const currentTimeMinutes = targetTimes[i];
        // Scale current time relative to total duration, then map to 24-hr (1440 min) base distribution
        const equivalentBaseTime = Math.max(0, Math.min((currentTimeMinutes / durationMinutes) * 1440, 1440));
        const cumulativeFraction = linearInterpolate(equivalentBaseTime, baseTimes, baseCumulativeFractions);
        targetCumulativeDepthsInches.push(cumulativeFraction * totalDepthInches);
    }

    const finalIntensities: number[] = [];
    const plotLabels: string[] = [];

    for (let i = 1; i < targetCumulativeDepthsInches.length; i++) {
        const startTimeMinutes = targetTimes[i - 1];
        const endTimeMinutes = targetTimes[i];
        // Ensure step duration isn't zero if targetTimes has duplicates (shouldn't happen with filtering)
        const stepDurationMinutes = endTimeMinutes - startTimeMinutes;
        if (stepDurationMinutes <= 0) continue; // Skip zero-duration steps

        const depthStepInches = targetCumulativeDepthsInches[i] - targetCumulativeDepthsInches[i - 1];
        calculatedTotalDepthInches += depthStepInches;

        const stepDurationHours = stepDurationMinutes / 60.0;
        const intensityInchesPerHour = stepDurationHours > 0 ? depthStepInches / stepDurationHours : 0;

        // Determine units for output
        const conversionFactor = isMetric ? INCH_TO_MM : 1;

        const finalIntensity = intensityInchesPerHour * conversionFactor;
        const finalDepthStep = depthStepInches * conversionFactor;
        const finalCumulativeDepth = targetCumulativeDepthsInches[i] * conversionFactor;

        finalIntensities.push(finalIntensity);
        if (finalIntensity > peakIntensity) {
            peakIntensity = finalIntensity;
        }

        // Store detailed data for table/CSV
        stormDataStore.push({
            timeStart: startTimeMinutes,
            timeEnd: endTimeMinutes,
            intensity: finalIntensity,
            depthStep: finalDepthStep,
            cumulativeDepth: finalCumulativeDepth
        });

        // Format chart label (using start time of interval)
        plotLabels.push(formatTimeLabel(startTimeMinutes, durationMinutes));

    }
    // Add final label for chart axis end
    plotLabels.push(formatTimeLabel(durationMinutes, durationMinutes));


    const finalCalculatedTotalDepth = calculatedTotalDepthInches * (isMetric ? INCH_TO_MM : 1);
    const finalIntensityUnitLabel = isMetric ? 'mm/hr' : 'in/hr';
    const finalDepthUnitLabel = isMetric ? 'mm' : 'in';

    return {
        labels: plotLabels,
        intensityData: finalIntensities,
        peakIntensity: peakIntensity,
        totalDepthActual: finalCalculatedTotalDepth,
        intensityUnit: finalIntensityUnitLabel,
        depthUnit: finalDepthUnitLabel,
        detailedData: stormDataStore
    };
}

// Helper function to create an empty result object
function createEmptyResult(): CalculationResult {
     return {
         labels: [],
         intensityData: [],
         peakIntensity: 0,
         totalDepthActual: 0,
         intensityUnit: 'N/A',
         depthUnit: 'N/A',
         detailedData: []
     };
}

// Helper function to format time labels for the chart
function formatTimeLabel(timeMinutes: number, totalDurationMinutes: number): string {
     if (totalDurationMinutes > 120) { // Use H:MM for durations > 2 hours
         const hours = Math.floor(timeMinutes / 60);
         const mins = Math.round(timeMinutes % 60);
         return `${hours}:${mins.toString().padStart(2, '0')}`;
     } else { // Use minutes for shorter durations
         return `${Math.round(timeMinutes)}m`;
     }
} 