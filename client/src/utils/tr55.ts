export const INCH_TO_MM = 25.4;

import designStormsCsv from './design-storms.csv?raw'; // Import CSV content as raw string

// Type definition for the processed distribution data
interface DistributionData {
    time_minutes: number[];
    cumulative_fraction: number[];
}

// Type for the structured TR55 data store
type Tr55Distributions = Record<string, DistributionData>;

// --- New Function to Parse CSV and Calculate Cumulative Fractions ---
function parseDesignStormsCsv(csvString: string): Tr55Distributions {
    const lines = csvString.trim().split('\n');
    if (lines.length < 2) {
        console.error("CSV data is empty or missing header.");
        return {};
    }

    const header = lines[0].trim().split(',').map(h => h.trim());
    const timeIndex = header.findIndex(h => h.toLowerCase() === 'minutes');
    const stormTypeIndices: { [key: string]: number } = {};
    const stormTypes: string[] = [];

    header.forEach((h, index) => {
        if (index > timeIndex && h) { // Assumes storm types are after the time column and not empty
            stormTypeIndices[h] = index;
            stormTypes.push(h);
        }
    });

    if (timeIndex === -1 || stormTypes.length === 0) {
        console.error("CSV header is missing 'Minutes' column or storm type columns.");
        return {};
    }

    const rawData: { [key: string]: { time_minutes: number[], intensity_in_hr: number[] } } = {};
    stormTypes.forEach(type => {
        rawData[type] = { time_minutes: [], intensity_in_hr: [] };
    });

    let previousTimeMinutes = -Infinity; // Track time order

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue; // Skip empty lines

        const values = line.split(',');

        // Parse time (H:MM:SS or H:MM format)
        const timeStr = values[timeIndex]?.trim();
        if (!timeStr) continue; // Skip rows with missing time

        const timeParts = timeStr.split(':');
        let currentTimeMinutes = 0;
        if (timeParts.length >= 2) {
            const hours = parseInt(timeParts[0], 10);
            const minutes = parseInt(timeParts[1], 10);
            const seconds = timeParts.length > 2 ? parseInt(timeParts[2], 10) : 0;
            if (!isNaN(hours) && !isNaN(minutes) && !isNaN(seconds)) {
                currentTimeMinutes = hours * 60 + minutes + seconds / 60;
            } else {
                console.warn(`Skipping row ${i + 1}: Invalid time format "${timeStr}"`);
                continue;
            }
        } else {
             console.warn(`Skipping row ${i + 1}: Invalid time format "${timeStr}"`);
             continue;
        }

        // Ensure time is increasing
        if (currentTimeMinutes < previousTimeMinutes) {
             console.warn(`Skipping row ${i + 1}: Time ${currentTimeMinutes} is not increasing from previous ${previousTimeMinutes}. CSV must be sorted by time.`);
             continue;
        }
        previousTimeMinutes = currentTimeMinutes;


        stormTypes.forEach(type => {
            const intensityStr = values[stormTypeIndices[type]]?.trim();
            const intensity = parseFloat(intensityStr);
            if (intensityStr === "" || isNaN(intensity)) {
                 console.warn(`Skipping intensity for ${type} at time ${timeStr} (row ${i+1}): Invalid or missing value "${intensityStr}"`);
                 // Add placeholder if needed, or decide how to handle gaps.
                 // For simplicity, we'll add the time but might need a way to handle missing intensity later.
                 // If we *must* have intensity for every time step, this row should be skipped entirely for this type.
                 // Let's assume we can proceed and interpolation will handle minor gaps if any.
                  rawData[type].time_minutes.push(currentTimeMinutes);
                  rawData[type].intensity_in_hr.push(NaN); // Mark as invalid for now
            } else {
                rawData[type].time_minutes.push(currentTimeMinutes);
                rawData[type].intensity_in_hr.push(intensity);
            }
        });
    }

    // --- Process Raw Data: Calculate Cumulative Fractions ---
    const processedDistributions: Tr55Distributions = {};
    stormTypes.forEach(type => {
        const times = rawData[type].time_minutes;
        const intensities = rawData[type].intensity_in_hr;
        const cumulative_depth_inches: number[] = [0]; // Start with 0 depth at time 0 (or first time)

        let totalDepthInches = 0;
        let lastValidTime = 0; // Assume first time is 0 if not present

         // Find the first valid time and intensity
         let firstValidIndex = -1;
         for(let k=0; k < times.length; k++){
             if(!isNaN(intensities[k])){
                 firstValidIndex = k;
                 lastValidTime = times[k]; // Initialize with the first valid time
                 break;
             }
         }

         if (firstValidIndex === -1) {
             console.error(`No valid intensity data found for storm type: ${type}`);
             processedDistributions[type] = { time_minutes: [], cumulative_fraction: [] }; // Empty data
             return; // Skip to next storm type
         }

         // --- Revised Cumulative Depth Calculation ---
         totalDepthInches = 0; // Reset total depth for recalculation
         let lastTimeMinutes = 0; // Track the previous time step, starting from 0
         const final_times: number[] = [0]; // Always start the final distribution at time 0
         const final_cumulative_depths: number[] = [0]; // Always start with cumulative depth 0

         for (let j = 0; j < times.length; j++) { // Iterate through ALL parsed rows
             const currentTime = times[j];
             const currentIntensity = intensities[j]; // Intensity listed for the time at the *end* of the interval
 
             // Skip if time hasn't advanced
             if (currentTime <= lastTimeMinutes && !(currentTime === 0 && j === 0)) {
                 console.warn(`Skipping calculation step for ${type} at index ${j}: Time ${currentTime} not increasing from previous ${lastTimeMinutes}.`);
                 continue;
             }
 
             // --- Determine intensity for the interval (lastTimeMinutes, currentTime] ---
             // Use the intensity value associated with the *start* of the interval (lastTimeMinutes).
             // Find the index in the raw data that corresponds to lastTimeMinutes.
             // This assumes times are unique and sorted.
             const indexForIntensity = times.findIndex(t => t === lastTimeMinutes);
             let intensityForThisInterval: number;

             if (indexForIntensity !== -1) {
                 intensityForThisInterval = intensities[indexForIntensity];
             } else if (lastTimeMinutes === 0) {
                  // For the very first interval (0 to times[0]), what intensity applies?
                  // Conventionally, assume intensity is 0 before the first measurement,
                  // or use the first measured intensity (intensities[0])?
                  // Let's use the first intensity found in the file (intensities[0]) for the interval 0 to times[0].
                  // If times[0] is also 0, this step calculation will be skipped anyway by the time check above.
                 if (!isNaN(intensities[0])) {
                     intensityForThisInterval = intensities[0];
                 } else {
                      console.warn(`Cannot determine intensity for first interval 0-${currentTime} for ${type}. Skipping.`);
                     lastTimeMinutes = currentTime; // Advance time
                     continue;
                 }
             } else {
                 console.warn(`Could not find intensity for interval starting at ${lastTimeMinutes} for ${type}. Skipping step.`);
                 lastTimeMinutes = currentTime; // Advance time
                 continue;
             }

              // Ensure the found intensity is valid
              if (isNaN(intensityForThisInterval)) {
                  console.warn(`Skipping calculation step for ${type} at index ${j}: Invalid intensity (${intensityForThisInterval}) found for interval starting at ${lastTimeMinutes}.`);
                  lastTimeMinutes = currentTime; // Still advance time to avoid getting stuck
                  continue;
              }
             // --- End Determine intensity ---

             const timeStepMinutes = currentTime - lastTimeMinutes;
             // Use the intensity determined for the start of the interval
             const depthStepInches = intensityForThisInterval * (timeStepMinutes / 60.0);

             // Check for non-physical depth steps
             if (isNaN(depthStepInches) || !isFinite(depthStepInches)) {
                 console.error(`Error calculating depth step for ${type} at index ${j} using intensity ${intensityForThisInterval}.`);
                 lastTimeMinutes = currentTime; // Advance time
                 continue; // Skip this step
             }

             totalDepthInches += depthStepInches;

             // Store the cumulative depth at the END of the interval (currentTime)
             final_times.push(currentTime);
             final_cumulative_depths.push(totalDepthInches);

             // *** Add Debug Log Here ***
             if (type === 'Type II' && currentTime >= 705 && currentTime <= 715) { // Widen slightly for context
                 console.log(`  PARSE_DEBUG (${type}): interval=${lastTimeMinutes}-${currentTime}, intensity_used=${intensityForThisInterval?.toFixed(4)}, depthStep=${depthStepInches.toFixed(6)}, cumulativeDepth=${totalDepthInches.toFixed(6)}`);
             }
             // *** END DEBUG ***

             lastTimeMinutes = currentTime; // Update lastTime for the next iteration
         }

         // --- Normalize to get Cumulative Fraction ---
         let cumulative_fraction: number[] = [];
         console.log(`Calculated total depth for ${type} from CSV: ${totalDepthInches.toFixed(4)} inches`);

         if (totalDepthInches > 0) {
             cumulative_fraction = final_cumulative_depths.map(depth => depth / totalDepthInches);
         } else if (final_cumulative_depths.length > 0) {
             // Handle zero total depth case (e.g., all intensities were zero)
             cumulative_fraction = final_cumulative_depths.map(_ => 0); // All fractions are 0
              console.warn(`Total calculated depth for ${type} is zero. Fractions set to 0.`);
         }

          // Add final point at 24 hours (1440 min) if it doesn't exist, assuming fraction is 1.0
          const lastCsvTime = final_times.length > 0 ? final_times[final_times.length - 1] : 0;
          if (lastCsvTime < 1440) {
              // Avoid adding duplicate 1440 if it exists from CSV
              if (Math.abs(lastCsvTime - 1440) > 0.01) {
                  final_times.push(1440);
                  cumulative_fraction.push(1.0); // Assume end fraction is 1.0
              } else {
                  // Ensure the existing last point (close to 1440) has fraction 1.0
                  cumulative_fraction[cumulative_fraction.length - 1] = 1.0;
              }
          } else if (final_times.length > 0) {
               // Ensure the last point (which might be >= 1440) has fraction 1.0
               cumulative_fraction[cumulative_fraction.length - 1] = 1.0;
          }


         processedDistributions[type] = {
             time_minutes: final_times,
             cumulative_fraction: cumulative_fraction
         };
    });

    return processedDistributions;
}


// --- Pre-process Base Data (Apply integrity checks) ---
function preprocessTr55Data(sourceDistributions: Tr55Distributions): Tr55Distributions {
    const processedDistributions: Tr55Distributions = {};
    // console.log("Source Distributions before preprocessing:", JSON.stringify(sourceDistributions)); // Debugging

    for (const type in sourceDistributions) {
        if (Object.prototype.hasOwnProperty.call(sourceDistributions, type)) {
            const sourceData = sourceDistributions[type];

            if (!sourceData || !sourceData.time_minutes || !sourceData.cumulative_fraction || sourceData.time_minutes.length !== sourceData.cumulative_fraction.length) {
                console.error(`CSV Processing: Invalid or mismatched data for storm type: ${type}`);
                continue;
            }
             if (sourceData.time_minutes.length === 0) {
                console.warn(`CSV Processing: No valid data points found for storm type: ${type} after parsing.`);
                processedDistributions[type] = { time_minutes: [], cumulative_fraction: [] }; // Store empty but valid structure
                continue;
            }


            // Defensive copy
            let time_minutes = [...sourceData.time_minutes];
            let cumulative_fraction = [...sourceData.cumulative_fraction];

            // Data Integrity Checks (ensure start at 0,0 and end at 1440, 1.0)
             // Check and fix start point (0, 0)
            if (time_minutes[0] !== 0 || cumulative_fraction[0] !== 0) {
                 console.warn(`CSV Preprocessing: Adjusting ${type} to start at (0 min, 0.0 fraction). Original start: (${time_minutes[0]}, ${cumulative_fraction[0]})`);
                 // Remove incorrect starting points if necessary
                 while (time_minutes.length > 0 && (time_minutes[0] !== 0 || cumulative_fraction[0] !== 0)) {
                    // If time is 0 but fraction isn't, just remove the fraction if we shift time=0 later
                    if (time_minutes[0] === 0 && cumulative_fraction[0] !== 0) {
                         cumulative_fraction.shift(); // Keep time=0 if fraction is wrong
                         time_minutes.shift();
                    } else {
                         // If time is not 0, remove both
                         time_minutes.shift();
                         cumulative_fraction.shift();
                    }
                 }
                 // Add the correct starting point
                 time_minutes.unshift(0);
                 cumulative_fraction.unshift(0);
            }


            // Check and fix end point (1440, 1.0)
            const lastIdx = time_minutes.length - 1;
             // Check if the last time point is exactly 1440 minutes (24 hours)
            if (lastIdx < 0 || Math.abs(time_minutes[lastIdx] - 1440.0) > 0.1 || Math.abs(cumulative_fraction[lastIdx] - 1.0) > 0.001) {
                 console.warn(`CSV Preprocessing: Adjusting ${type} to end at (1440 min, 1.0 fraction). Original end: (${time_minutes[lastIdx]}, ${cumulative_fraction[lastIdx]})`);

                 // Remove points after 1440 min
                 while(time_minutes.length > 0 && time_minutes[time_minutes.length - 1] > 1440.0 + 0.1) { // Allow small tolerance
                     time_minutes.pop();
                     cumulative_fraction.pop();
                 }

                 // Add or adjust the last point to be exactly (1440, 1.0)
                 const currentLastIdx = time_minutes.length - 1;
                 if(currentLastIdx < 0 || Math.abs(time_minutes[currentLastIdx] - 1440.0) > 0.1) {
                      // If the last point is before 1440, or doesn't exist, add (1440, 1.0)
                     time_minutes.push(1440.0);
                     cumulative_fraction.push(1.0);
                 } else {
                     // If the last point is already at (or very close to) 1440, ensure its fraction is 1.0
                     time_minutes[currentLastIdx] = 1440.0; // Force exact time
                     cumulative_fraction[currentLastIdx] = 1.0; // Force exact fraction
                 }
            }


            processedDistributions[type] = { time_minutes, cumulative_fraction };
        }
    }
    console.log("Processed CSV Distributions:", processedDistributions);
    return processedDistributions;
}

// Store the pre-processed data from the CSV
const parsedCsvData = parseDesignStormsCsv(designStormsCsv);
export const tr55Distributions: Tr55Distributions = preprocessTr55Data(parsedCsvData);

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
    const { totalDepthInput, durationInput, stormType, timeStepMinutes: timeStepInput, depthUnit, durationUnit } = inputs;

    // Ensure inputs are numbers where expected
    const totalDepth = typeof totalDepthInput === 'string' ? parseFloat(totalDepthInput) : totalDepthInput;
    const durationValue = typeof durationInput === 'string' ? parseFloat(durationInput) : durationInput;
    const timeStepMinutes = typeof timeStepInput === 'string' ? parseFloat(timeStepInput) : timeStepInput;

    const stormDataStore: StormStep[] = []; // Store detailed step data locally for this calculation

    if (!tr55Distributions[stormType]) {
        console.error("Selected storm type not found in base data:", stormType);
        return createEmptyResult();
    }

    const baseData = tr55Distributions[stormType];
    const baseTimes = baseData.time_minutes;
    const baseCumulativeFractions = baseData.cumulative_fraction;

    let totalDepthInches = totalDepth / (depthUnit === 'metric' ? INCH_TO_MM : 1);
    let durationValueInMinutes = (durationUnit === 'hours') ? durationValue * 60 : durationValue;

    // Input Validation
    if (isNaN(totalDepth) || isNaN(durationValue) || isNaN(timeStepMinutes) || totalDepth <= 0 || durationValue <= 0 || timeStepMinutes <= 0) {
        console.warn("Invalid input values provided to calculateHyetograph.");
        return createEmptyResult();
    }

    const isMetric = depthUnit === 'metric';
    const totalDurationMinutes = durationValueInMinutes;

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
        // Scale current time relative to total duration, then map to 24-hr (1440 min) base distribution
        const equivalentBaseTime = Math.max(0, Math.min((currentTimeMinutes / totalDurationMinutes) * 1440, 1440));
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
        const finalIntensityUnit = isMetric ? 'mm/hr' : 'in/hr';
        const finalDepthUnit = isMetric ? 'mm' : 'in';
        const conversionFactor = isMetric ? INCH_TO_MM : 1;

        const finalIntensity = intensityInchesPerHour * conversionFactor;
        const finalDepthStep = depthStepInches * conversionFactor;
        const finalCumulativeDepth = targetCumulativeDepthsInches[i] * conversionFactor;

        finalIntensities.push(finalIntensity);
        if (finalIntensity > peakIntensity) {
            peakIntensity = finalIntensity;
        }

        // --- DEBUG LOGGING around peak for Type II ---
        if (stormType === 'Type II' && startTimeMinutes >= 700 && startTimeMinutes < 720) {
            console.log(`DEBUG: Interval ${startTimeMinutes}-${endTimeMinutes}`);
            console.log(`  targetCumulativeDepth[${i-1}] (${targetTimes[i-1]} min): ${targetCumulativeDepthsInches[i-1].toFixed(6)}`);
            console.log(`  targetCumulativeDepth[${i}] (${targetTimes[i]} min): ${targetCumulativeDepthsInches[i].toFixed(6)}`);
            console.log(`  depthStepInches: ${depthStepInches.toFixed(6)}`);
            console.log(`  stepDurationHours: ${stepDurationHours.toFixed(6)}`);
            console.log(`  intensityInchesPerHour (calculated): ${intensityInchesPerHour.toFixed(6)}`);
            console.log(`  finalIntensity (output): ${finalIntensity.toFixed(6)}`);
        }
        // --- END DEBUG --- 

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