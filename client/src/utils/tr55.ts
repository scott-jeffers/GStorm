export const INCH_TO_MM = 25.4;

import designStormsCsv from './design-storms.csv?raw'; // Import CSV content as raw string

// Type definition for the processed distribution data
interface DistributionData {
    time_minutes: number[];
    cumulative_fraction: number[];
}

// Type for the structured TR55 data store - Keys will be like "Type II - 12HR"
type Tr55Distributions = Record<string, DistributionData>;

// --- New Function to Parse CSV and Calculate Cumulative Fractions ---
function parseDesignStormsCsv(csvString: string): Tr55Distributions {
    const lines = csvString.trim().split('\n');
    if (lines.length < 2) {
        console.error("CSV data is empty or missing header.");
        return {};
    }

    const header = lines[0].trim().split(',').map(h => h.trim());
    console.log("Parsing CSV Headers:", header);

    // Find indices for all relevant columns
    const columnIndices: { [key: string]: number } = {};
    header.forEach((h, index) => {
        if (h) {
            columnIndices[h] = index;
        }
    });

    // Define the combinations we need to extract
    const baseTypes = ["Type I", "Type Ia", "Type II", "Type III"];
    const durations = [6, 12, 24]; // In hours

    // Store raw data keyed by combined name, e.g., "Type II - 6HR"
    const rawData: { [key: string]: { time_minutes: number[], intensity_in_hr: number[] } } = {};

    durations.forEach(duration => {
        const timeColHeader = `Minutes - ${duration}HR`;
        const timeIndex = columnIndices[timeColHeader];

        if (timeIndex === undefined) {
            console.warn(`Time column '${timeColHeader}' not found in CSV header. Skipping ${duration}HR duration.`);
            return; // Skip this duration if time column is missing
        }

        baseTypes.forEach(baseType => {
            const intensityColHeader = `${baseType} - ${duration}HR`;
            const intensityIndex = columnIndices[intensityColHeader];
            const combinedKey = `${baseType} - ${duration}HR`;

            if (intensityIndex === undefined) {
                console.warn(`Intensity column '${intensityColHeader}' not found in CSV header. Skipping this combination.`);
                return; // Skip this specific storm type/duration
            }

            rawData[combinedKey] = { time_minutes: [], intensity_in_hr: [] };

            let previousTimeMinutes = -Infinity;
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue; // Skip empty lines
                const values = line.split(',');

                // Parse time from the specific duration's time column
                const timeStr = values[timeIndex]?.trim();
                if (!timeStr || timeStr === '') continue; // Skip if time is missing for this duration

                const timeParts = timeStr.split(':');
                let currentTimeMinutes = 0;
                if (timeParts.length >= 2) {
                    const hours = parseInt(timeParts[0], 10);
                    const minutes = parseInt(timeParts[1], 10);
                    const seconds = timeParts.length > 2 ? parseInt(timeParts[2], 10) : 0;
                    if (!isNaN(hours) && !isNaN(minutes) && !isNaN(seconds)) {
                        currentTimeMinutes = hours * 60 + minutes + seconds / 60;
                    } else {
                        // Log warning but maybe continue if other columns have data?
                         console.warn(`Skipping row ${i + 1} for ${combinedKey}: Invalid time format "${timeStr}" in column ${timeColHeader}`);
                        continue;
                    }
                } else {
                     console.warn(`Skipping row ${i + 1} for ${combinedKey}: Invalid time format "${timeStr}" in column ${timeColHeader}`);
                     continue;
                }

                // Ensure time is increasing within this specific duration column
                 if (currentTimeMinutes < previousTimeMinutes) {
                     console.warn(`Skipping row ${i + 1} for ${combinedKey}: Time ${currentTimeMinutes} in column ${timeColHeader} is not increasing from previous ${previousTimeMinutes}.`);
                     continue; // If time decreases, skip this row for this storm/duration
                 }
                 previousTimeMinutes = currentTimeMinutes;

                // Parse intensity from the specific intensity column
                const intensityStr = values[intensityIndex]?.trim();
                const intensity = parseFloat(intensityStr);

                 if (intensityStr === "" || isNaN(intensity)) {
                     // Treat missing intensity as NaN for now
                     rawData[combinedKey].time_minutes.push(currentTimeMinutes);
                     rawData[combinedKey].intensity_in_hr.push(NaN);
                 } else {
                     rawData[combinedKey].time_minutes.push(currentTimeMinutes);
                     rawData[combinedKey].intensity_in_hr.push(intensity);
                 }
            }
        });
    });

    // --- Process Raw Data: Calculate Cumulative Fractions for each type/duration ---
    const processedDistributions: Tr55Distributions = {};

    Object.keys(rawData).forEach(combinedKey => {
        const { time_minutes, intensity_in_hr } = rawData[combinedKey];
        const durationMatch = combinedKey.match(/(\d+)HR$/);
        const totalDurationMinutes = durationMatch ? parseInt(durationMatch[1], 10) * 60 : 1440; // Default to 24hr if somehow key is wrong

        if (time_minutes.length === 0) {
             console.warn(`No valid time/intensity data points found for ${combinedKey} after parsing.`);
             processedDistributions[combinedKey] = { time_minutes: [], cumulative_fraction: [] };
             return; // Skip this key
        }

        let totalDepthInches = 0;
        let lastTimeMinutes = 0;
        const final_times: number[] = [0];
        const final_cumulative_depths: number[] = [0];

        for (let j = 0; j < time_minutes.length; j++) {
            const currentTime = time_minutes[j];

            if (currentTime <= lastTimeMinutes && !(currentTime === 0 && j === 0)) {
                console.warn(`Skipping cumulative calculation step for ${combinedKey} at index ${j}: Time ${currentTime} not increasing from previous ${lastTimeMinutes}.`);
                continue;
            }

            const indexForIntensity = time_minutes.findIndex(t => t === lastTimeMinutes);
            let intensityForThisInterval: number;

            if (indexForIntensity !== -1) {
                intensityForThisInterval = intensity_in_hr[indexForIntensity];
            } else if (lastTimeMinutes === 0) {
                 if (!isNaN(intensity_in_hr[0])) {
                     intensityForThisInterval = intensity_in_hr[0];
                 } else {
                     console.warn(`Cannot determine intensity for first interval 0-${currentTime} for ${combinedKey}. Assuming 0.`);
                     intensityForThisInterval = 0; // Assume 0 if first intensity is NaN
                 }
            } else {
                console.warn(`Could not find intensity for interval starting at ${lastTimeMinutes} for ${combinedKey}. Assuming 0.`);
                 intensityForThisInterval = 0; // Assume 0 if index not found
            }

            if (isNaN(intensityForThisInterval)) {
                console.warn(`Skipping calculation step for ${combinedKey} at index ${j}: Invalid intensity (${intensityForThisInterval}) found for interval starting at ${lastTimeMinutes}. Assuming 0.`);
                intensityForThisInterval = 0; // Treat NaN intensity as 0 for depth calc
            }

            const timeStepMinutes = currentTime - lastTimeMinutes;
            const depthStepInches = intensityForThisInterval * (timeStepMinutes / 60.0);

            if (isNaN(depthStepInches) || !isFinite(depthStepInches)) {
                console.error(`Error calculating depth step for ${combinedKey} at index ${j}.`);
                // Decide how to proceed - skip? use 0?
                lastTimeMinutes = currentTime;
                continue;
            }

            totalDepthInches += depthStepInches;
            final_times.push(currentTime);
            final_cumulative_depths.push(totalDepthInches);
            lastTimeMinutes = currentTime;
        }

        // Normalize
        let cumulative_fraction: number[] = [];
        console.log(`Calculated total depth for ${combinedKey} from CSV: ${totalDepthInches.toFixed(4)} inches`);
        if (totalDepthInches > 0) {
            cumulative_fraction = final_cumulative_depths.map(depth => depth / totalDepthInches);
        } else {
            cumulative_fraction = final_cumulative_depths.map(_ => 0);
            console.warn(`Total calculated depth for ${combinedKey} is zero. Fractions set to 0.`);
        }

        // Store the processed distribution
        processedDistributions[combinedKey] = {
            time_minutes: final_times,
            cumulative_fraction: cumulative_fraction
        };
    });

    console.log("Final Parsed and Processed Distributions:", processedDistributions);
    return processedDistributions;
}


// --- Pre-process Base Data (Apply integrity checks for EACH duration) ---
function preprocessTr55Data(sourceDistributions: Tr55Distributions): Tr55Distributions {
    const processedDistributions: Tr55Distributions = {};

    for (const combinedKey in sourceDistributions) {
        if (Object.prototype.hasOwnProperty.call(sourceDistributions, combinedKey)) {
            const sourceData = sourceDistributions[combinedKey];
            const durationMatch = combinedKey.match(/(\d+)HR$/);
            const totalDurationMinutes = durationMatch ? parseInt(durationMatch[1], 10) * 60 : 1440; // Get duration for this key

            if (!sourceData || !sourceData.time_minutes || !sourceData.cumulative_fraction || sourceData.time_minutes.length !== sourceData.cumulative_fraction.length) {
                console.error(`Preprocessing: Invalid or mismatched data for key: ${combinedKey}`);
                continue;
            }
            if (sourceData.time_minutes.length === 0) {
                console.warn(`Preprocessing: No valid data points found for key: ${combinedKey}.`);
                processedDistributions[combinedKey] = { time_minutes: [], cumulative_fraction: [] };
                continue;
            }

            let time_minutes = [...sourceData.time_minutes];
            let cumulative_fraction = [...sourceData.cumulative_fraction];

            // Check start point (0, 0)
            if (time_minutes[0] !== 0 || cumulative_fraction[0] !== 0) {
                 console.warn(`Preprocessing: Adjusting ${combinedKey} to start at (0 min, 0.0 fraction).`);
                 // simplified fix: ensure [0,0] is first
                 if(time_minutes[0] !== 0) time_minutes.unshift(0);
                 if(cumulative_fraction[0] !== 0) cumulative_fraction.unshift(0);
                 // remove duplicates if unshift created them
                 if (time_minutes.length > 1 && time_minutes[1] === 0) { time_minutes.splice(1, 1); cumulative_fraction.splice(1, 1); }
                 cumulative_fraction[0] = 0; // Ensure fraction is 0
            }

            // Check end point (totalDurationMinutes, 1.0)
            const lastIdx = time_minutes.length - 1;
            const expectedEndTime = totalDurationMinutes;
            if (lastIdx < 0 || Math.abs(time_minutes[lastIdx] - expectedEndTime) > 0.1 || Math.abs(cumulative_fraction[lastIdx] - 1.0) > 0.001) {
                 console.warn(`Preprocessing: Adjusting ${combinedKey} to end at (${expectedEndTime} min, 1.0 fraction).`);

                 // Remove points after expected end time
                 while(time_minutes.length > 0 && time_minutes[time_minutes.length - 1] > expectedEndTime + 0.1) {
                     time_minutes.pop();
                     cumulative_fraction.pop();
                 }

                 const currentLastIdx = time_minutes.length - 1;
                 if(currentLastIdx < 0 || Math.abs(time_minutes[currentLastIdx] - expectedEndTime) > 0.1) {
                     time_minutes.push(expectedEndTime);
                     cumulative_fraction.push(1.0);
                 } else {
                     time_minutes[currentLastIdx] = expectedEndTime;
                     cumulative_fraction[currentLastIdx] = 1.0;
                 }
            }

            processedDistributions[combinedKey] = { time_minutes, cumulative_fraction };
        }
    }
    console.log("Final Preprocessed Distributions:", processedDistributions);
    return processedDistributions;
}


// Store the pre-processed data from the CSV
const parsedCsvData = parseDesignStormsCsv(designStormsCsv);
export const tr55Distributions: Tr55Distributions = preprocessTr55Data(parsedCsvData);

// --- Linear Interpolation --- (No changes needed here)
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
    durationInput: 6 | 12 | 24; // Use the restricted type
    stormType: string;
    timeStepMinutes: number;
    depthUnit: 'us' | 'metric'; // 'us' (inches) or 'metric' (mm)
    durationUnit: 'hours'; // Fixed to hours
}

// --- Calculate Hyetograph Logic --- (Needs changes)
export function calculateHyetograph(inputs: CalculationInputs): CalculationResult {
    const { totalDepthInput, durationInput, stormType, timeStepMinutes: timeStepInput, depthUnit } = inputs;

    // Construct the key to look up the correct distribution
    const combinedKey = `${stormType} - ${durationInput}HR`;

    // Ensure inputs are numbers where expected (totalDepthInput might still be string from state)
    const totalDepth = typeof totalDepthInput === 'string' ? parseFloat(totalDepthInput) : totalDepthInput;
    const timeStepMinutes = typeof timeStepInput === 'string' ? parseFloat(timeStepInput) : timeStepInput;

    const stormDataStore: StormStep[] = []; // Store detailed step data locally for this calculation

    // Fetch the specific distribution for the selected type AND duration
    if (!tr55Distributions[combinedKey]) {
        console.error(`Distribution not found for key: ${combinedKey}`);
        // Fallback or specific error handling?
        // Try falling back to 24hr if specific duration missing?
        const fallbackKey = `${stormType} - 24HR`;
        if(!tr55Distributions[fallbackKey]){
             console.error(`Fallback 24HR distribution not found either for type: ${stormType}`);
             return createEmptyResult();
        } else {
            console.warn(`Using 24HR distribution as fallback for ${combinedKey}`);
            // If we fallback, we WOULD need to scale time, but calculation expects direct match...
            // For now, return empty if exact match missing.
             return createEmptyResult(); // Or throw error?
        }
    }

    const baseData = tr55Distributions[combinedKey];
    const baseTimes = baseData.time_minutes; // These times are now specific to 6, 12 or 24hr
    const baseCumulativeFractions = baseData.cumulative_fraction;

    let totalDepthInches = totalDepth / (depthUnit === 'metric' ? INCH_TO_MM : 1);
    const totalDurationMinutes = durationInput * 60; // Duration is now fixed from input (6, 12, 24 hrs)

    // Input Validation (duration is now guaranteed 6, 12, or 24)
    if (isNaN(totalDepth) || isNaN(timeStepMinutes) || totalDepth <= 0 || timeStepMinutes <= 0) {
        console.warn("Invalid input values provided to calculateHyetograph.");
        return createEmptyResult();
    }

    const isMetric = depthUnit === 'metric';

    let peakIntensity = 0;
    let calculatedTotalDepthInches = 0;
    // Ensure integer number of steps covering the full duration
    const numSteps = Math.ceil(totalDurationMinutes / timeStepMinutes);
    // Generate target times from 0 up to and including the final duration step end
    const targetTimes = Array.from({ length: numSteps + 1 }, (_, i) => Math.min(i * timeStepMinutes, totalDurationMinutes));
    // Ensure the last time point is exactly the duration
    if (targetTimes[targetTimes.length - 1] < totalDurationMinutes) {
        targetTimes.push(totalDurationMinutes);
    }
    // Filter out potential duplicate end time if duration is exact multiple of timestep
    if(targetTimes.length > 1 && targetTimes[targetTimes.length - 1] === targetTimes[targetTimes.length - 2]) {
        targetTimes.pop();
    }


    const targetCumulativeDepthsInches: number[] = [0];
    for (let i = 1; i < targetTimes.length; i++) {
        const currentTimeMinutes = targetTimes[i];
        // REMOVED: Time scaling - no longer needed as we use the duration-specific base data
        // const equivalentBaseTime = Math.max(0, Math.min((currentTimeMinutes / totalDurationMinutes) * 1440, 1440));
        
        // Interpolate directly using the time points from the selected distribution
        const cumulativeFraction = linearInterpolate(currentTimeMinutes, baseTimes, baseCumulativeFractions);
        targetCumulativeDepthsInches.push(cumulativeFraction * totalDepthInches);
    }

    const finalIntensities: number[] = [];
    const plotLabels: string[] = [];

    for (let i = 1; i < targetCumulativeDepthsInches.length; i++) {
        const startTimeMinutes = targetTimes[i - 1];
        const endTimeMinutes = targetTimes[i];
        const stepDurationMinutes = endTimeMinutes - startTimeMinutes;
        if (stepDurationMinutes <= 0) continue; 

        const depthStepInches = targetCumulativeDepthsInches[i] - targetCumulativeDepthsInches[i - 1];
        calculatedTotalDepthInches += depthStepInches;

        const stepDurationHours = stepDurationMinutes / 60.0;
        const intensityInchesPerHour = stepDurationHours > 0 ? depthStepInches / stepDurationHours : 0;

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
        plotLabels.push(formatTimeLabel(startTimeMinutes, totalDurationMinutes));
    }
    // Add final label for chart axis end
    plotLabels.push(formatTimeLabel(totalDurationMinutes, totalDurationMinutes));

    const finalCalculatedTotalDepth = calculatedTotalDepthInches * (isMetric ? INCH_TO_MM : 1);

    return {
        labels: plotLabels,
        intensityData: finalIntensities,
        peakIntensity: peakIntensity,
        totalDepthActual: finalCalculatedTotalDepth,
        intensityUnit: isMetric ? 'mm/hr' : 'in/hr',
        depthUnit: isMetric ? 'mm' : 'in',
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