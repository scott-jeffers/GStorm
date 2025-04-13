import { CalculationResult, StormStep } from '../types'; // Define types in a separate file

// --- Constants ---
export const INCH_TO_MM = 25.4;
const DEFAULT_DURATION_HR = 24; // Used for NRCS/Huff implicit duration

// --- Import Raw CSV Data ---
// Vite/Webpack specific import to get raw text content
import scsCsvData from './design-storms.csv?raw';
import nrcsCsvData from './NRCS-design-storms.csv?raw';
import huffCsvData from './Huff-design-storms.csv?raw';

// --- Type Definitions ---

// Represents the processed, normalized distribution data
interface DistributionData {
    time_minutes: number[];
    cumulative_fraction: number[];
}

// Structure to hold all parsed storm distributions
// Key format: "Category-SubType-DurationHR", e.g., "SCS-Type II-12HR", "NRCS-Northeast Type A-24HR"
type UnifiedDistributions = Record<string, DistributionData>;

// Structure to hold the extracted sub-types for the UI
export type StormSubTypes = {
    SCS: string[];
    NRCS: string[];
    Huff: string[];
};

// Input parameters specifically for the calculation function
export interface CalculationInputs {
    totalDepthInput: number;
    durationInput: number; // Now just number, validation happens in App.tsx
    stormCategory: 'SCS' | 'NRCS' | 'Huff';
    stormSubType: string;
    timeStepMinutes: number;
    depthUnit: 'us' | 'metric';
    durationUnit: 'hours'; // Fixed to hours
}

// --- CSV Parsing and Processing ---

/**
 * Parses a design storm CSV string and calculates cumulative fractions.
 * Handles SCS (multi-duration), NRCS (24hr), and Huff (24hr) formats.
 * @param csvString Raw CSV content.
 * @param category The category ('SCS', 'NRCS', 'Huff') this CSV belongs to.
 * @param availableSubTypes An object to populate with discovered sub-types.
 * @returns A map of distributions keyed by "Category-SubType-DurationHR".
 */
function parseAndProcessStormCsv(
    csvString: string,
    category: 'SCS' | 'NRCS' | 'Huff',
    availableSubTypes: StormSubTypes
): UnifiedDistributions {
    const lines = csvString.trim().split('\n');
    if (lines.length < 2) {
        console.error(`CSV data for ${category} is empty or missing header.`);
        return {};
    }

    const header = lines[0].trim().split(',').map(h => h.trim().replace(/^\"|\"$/g, '')); // Clean headers
    // console.log(`Parsing ${category} CSV Headers:`, header);

    const columnIndices: { [key: string]: number } = {};
    header.forEach((h, index) => { if (h) columnIndices[h] = index; });

    const durationsToParse = category === 'SCS' ? [6, 12, 24] : [DEFAULT_DURATION_HR];
    const processedDistributions: UnifiedDistributions = {};

    // Store raw intensity data temporarily before calculating cumulative fractions
    // Key: "Category-SubType-DurationHR", Value: { time_minutes: number[], intensity_in_hr: number[] }
    const rawData: { [key: string]: { time_minutes: number[], intensity_in_hr: number[] } } = {};

    durationsToParse.forEach(duration => {
        const timeColHeader = `Minutes - ${duration}HR`;
        const timeIndex = columnIndices[timeColHeader];

        if (timeIndex === undefined) {
            // Only warn if expected (e.g., for SCS multi-duration)
            if (category === 'SCS') {
                 console.warn(`Time column '${timeColHeader}' not found in ${category} CSV. Skipping ${duration}HR.`);
            } else if (durationsToParse.length === 1) {
                 console.error(`Required time column '${timeColHeader}' not found in ${category} CSV.`);
            }
            return; // Skip this duration if its time column is missing
        }

        // Iterate through header columns to find intensity data
        header.forEach((colHeader, intensityIndex) => {
            if (intensityIndex === timeIndex) return; // Skip the time column itself

            // Match patterns like "SubType - DurationHR"
            const intensityMatch = colHeader.match(/^(.*) - (\d+)HR$/);
            if (!intensityMatch) return; // Not a valid intensity column

            const subType = intensityMatch[1].trim();
            const colDuration = parseInt(intensityMatch[2], 10);

            // Ensure this column's duration matches the one we're currently processing
            if (colDuration !== duration) return;

            // Validate category/sub-type consistency
            if (category === 'SCS') {
                if (!["Type I", "Type Ia", "Type II", "Type III"].includes(subType)) return; // Invalid SCS sub-type
            } else if (category === 'NRCS') {
                // Add discovered NRCS sub-type
                if (!availableSubTypes.NRCS.includes(subType)) availableSubTypes.NRCS.push(subType);
            } else if (category === 'Huff') {
                 if (!["Huff Type I", "Huff Type II", "Huff Type III", "Huff Type IV"].includes(subType)) return; // Invalid Huff sub-type
                 if (!availableSubTypes.Huff.includes(subType)) availableSubTypes.Huff.push(subType);
            }

            // Add SCS types explicitly
            if (category === 'SCS' && !availableSubTypes.SCS.includes(subType)) {
                 availableSubTypes.SCS.push(subType);
            }


            const combinedKey = `${category}-${subType}-${duration}HR`;
            rawData[combinedKey] = { time_minutes: [], intensity_in_hr: [] };
            let previousTimeMinutes = -Infinity;

            // === DEBUGGING: Log raw lines for a specific key ===
            const debugKey = "SCS-Type II-24HR"; // <<< CHANGE THIS KEY TO DEBUG DIFFERENT STORMS >>>
            if (combinedKey === debugKey) {
                console.log(`\n--- Debugging Raw Data Parsing for ${debugKey} ---`);
            }

            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;
                const values = line.split(',');

                // Parse time from the specific duration's time column
                const timeStr = values[timeIndex]?.trim();
                if (!timeStr || timeStr === '') continue; // Skip row if time is missing for this duration

                let currentTimeMinutes = 0;
                const timeParts = timeStr.split(':');
                if (timeParts.length >= 2) {
                    const hours = parseInt(timeParts[0], 10);
                    const minutes = parseInt(timeParts[1], 10);
                    const seconds = timeParts.length > 2 ? parseInt(timeParts[2], 10) : 0;
                    if (!isNaN(hours) && !isNaN(minutes) && !isNaN(seconds)) {
                        currentTimeMinutes = hours * 60 + minutes + seconds / 60;
                    } else {
                         if (combinedKey === debugKey) console.log(`[${debugKey}] Row ${i + 1}: Skipping due to invalid time format: "${timeStr}"`);
                        continue;
                    }
                } else {
                     if (combinedKey === debugKey) console.log(`[${debugKey}] Row ${i + 1}: Skipping due to invalid time format: "${timeStr}"`);
                    continue;
                }

                 if (currentTimeMinutes < previousTimeMinutes) {
                     if(category === 'SCS') {
                          if (combinedKey === debugKey) console.log(`[${debugKey}] Row ${i + 1}: Skipping due to non-increasing time (${currentTimeMinutes} < ${previousTimeMinutes})`);
                         console.warn(`Skipping row ${i + 1} for ${combinedKey}: Time ${currentTimeMinutes} not increasing from previous ${previousTimeMinutes}.`);
                         continue;
                      }
                 }
                 previousTimeMinutes = currentTimeMinutes;

                // Parse intensity from the specific sub-type's column
                const intensityStr = values[intensityIndex]?.trim();
                const intensity = parseFloat(intensityStr);

                // === DEBUGGING: Log parsed values for the target key ===
                if (combinedKey === debugKey && (i < 5 || i > lines.length - 5)) { // Log first few and last few rows
                     console.log(`[${debugKey}] Row ${i + 1}: RawLine(start)="${line.substring(0, 50)}..." | Parsed Time=${currentTimeMinutes.toFixed(2)}, Parsed Intensity=${isNaN(intensity) ? 'NaN' : intensity.toFixed(4)}`);
                }

                if (intensityStr === "" || isNaN(intensity)) {
                     rawData[combinedKey].time_minutes.push(currentTimeMinutes);
                     rawData[combinedKey].intensity_in_hr.push(NaN);
                 } else {
                     rawData[combinedKey].time_minutes.push(currentTimeMinutes);
                     rawData[combinedKey].intensity_in_hr.push(intensity);
                 }
            }
             // === DEBUGGING: Log final rawData for the target key ===
             if (combinedKey === debugKey) {
                  console.log(`[${debugKey}] Finished Parsing Raw Data. Points: ${rawData[combinedKey].time_minutes.length}`);
                  // Log first and last few points
                  if (rawData[combinedKey].time_minutes.length > 0) {
                      console.log(`  First Point: Time=${rawData[combinedKey].time_minutes[0]?.toFixed(2)}, Intensity=${rawData[combinedKey].intensity_in_hr[0]?.toFixed(4)}`);
                      const lastIdx = rawData[combinedKey].time_minutes.length - 1;
                      console.log(`  Last Point:  Time=${rawData[combinedKey].time_minutes[lastIdx]?.toFixed(2)}, Intensity=${rawData[combinedKey].intensity_in_hr[lastIdx]?.toFixed(4)}`);
                  }
             }
        });
    });

    // --- Process Raw Data: Calculate Cumulative Fractions ---
    Object.keys(rawData).forEach(combinedKey => {
         // === DEBUGGING: Log cumulative calculation start ===
         const debugKey = "SCS-Type II-24HR"; // <<< CHANGE THIS KEY TO DEBUG DIFFERENT STORMS >>>
         if (combinedKey === debugKey) {
             console.log(`\n--- Debugging Cumulative Calculation for ${debugKey} ---`);
         }

        const { time_minutes, intensity_in_hr } = rawData[combinedKey];
        const durationMatch = combinedKey.match(/(\d+)HR$/);
        const stormDurationMinutes = durationMatch ? parseInt(durationMatch[1], 10) * 60 : DEFAULT_DURATION_HR * 60;


        if (time_minutes.length === 0) {
            console.warn(`No valid data points found for ${combinedKey}.`);
            processedDistributions[combinedKey] = { time_minutes: [], cumulative_fraction: [] };
            return;
        }

        let totalDepthInches = 0;
        const final_times: number[] = [0];
        const final_cumulative_depths: number[] = [0];

        // Loop through the *parsed* data points to calculate intervals
        for (let j = 0; j < time_minutes.length; j++) {
            const currentTime = time_minutes[j];
            // Intensity from this row applies to the interval *starting* at this time
            let intensityForStep = intensity_in_hr[j];

            // Find the *next* time step to determine the interval duration
            // If it's the last point, the interval goes up to the storm duration
            const nextTime = (j + 1 < time_minutes.length) ? time_minutes[j + 1] : stormDurationMinutes;

            // Calculate the duration of the interval starting at currentTime
            const timeStepMinutes = nextTime - currentTime;

            // Skip if interval duration is non-positive (e.g., duplicate times)
            if (timeStepMinutes <= 1e-6) {
                if (combinedKey === debugKey) console.log(`[${debugKey}] Cumul. Step ${j}: Skipping due to zero/negative duration. CurTime=${currentTime.toFixed(2)}, NextTime=${nextTime.toFixed(2)}`);
                continue; // Skip this point if it doesn't define a valid interval forward
            }

            // Handle NaN intensity - use 0 if intensity for this step is invalid
            if (isNaN(intensityForStep)) {
                if (combinedKey === debugKey) console.warn(`[${debugKey}] Cumul. Step ${j}: Intensity is NaN at time ${currentTime.toFixed(2)}. Assuming 0 for interval [${currentTime.toFixed(2)} - ${nextTime.toFixed(2)}].`);
                intensityForStep = 0;
            }

            const depthStepInches = intensityForStep * (timeStepMinutes / 60.0);

            if (isNaN(depthStepInches) || !isFinite(depthStepInches)) {
                if (combinedKey === debugKey) console.error(`[${debugKey}] Cumul. Step ${j}: Error calculating depth step (intensity: ${intensityForStep}). Skipping.`);
                continue;
            }

            // === DEBUGGING: Log cumulative step ===
            if (combinedKey === debugKey && (j < 5 || j > time_minutes.length - 5)) { // Log first few & last few steps
                 console.log(`[${debugKey}] Cumul. Step ${j}: Interval=[${currentTime.toFixed(2)} - ${nextTime.toFixed(2)}], Dt=${timeStepMinutes.toFixed(2)}, Intens=${intensityForStep.toFixed(4)}, dD=${depthStepInches.toFixed(4)}, NewCumD=${(totalDepthInches + depthStepInches).toFixed(4)}`);
            }

            totalDepthInches += depthStepInches;

            // Add the *end* point of the calculated interval
            // Check if this time point already exists due to previous steps/updates
            const lastAddedTime = final_times[final_times.length - 1];
            if (Math.abs(nextTime - lastAddedTime) < 1e-6) {
                // If time is same, update cumulative depth
                final_cumulative_depths[final_cumulative_depths.length - 1] = totalDepthInches;
                 if (combinedKey === debugKey) console.log(`[${debugKey}]   -> Updated depth for time ${nextTime.toFixed(2)} to ${totalDepthInches.toFixed(4)}`);
            } else if (nextTime > lastAddedTime) {
                // Otherwise add new point
                final_times.push(nextTime);
                final_cumulative_depths.push(totalDepthInches);
            }
        }

         // === DEBUGGING: Log before normalization ===
          if (combinedKey === debugKey) {
              console.log(`[${debugKey}] Before Normalization: TotalDepth=${totalDepthInches.toFixed(4)}`);
              console.log(`  Final Times (${final_times.length}): [${final_times.slice(0,3).map(t=>t.toFixed(2)).join(', ')} ... ${final_times.slice(-3).map(t=>t.toFixed(2)).join(', ')}]`);
              console.log(`  Cum. Depths (${final_cumulative_depths.length}): [${final_cumulative_depths.slice(0,3).map(d=>d.toFixed(4)).join(', ')} ... ${final_cumulative_depths.slice(-3).map(d=>d.toFixed(4)).join(', ')}]`);
          }

        // --- Normalize to get cumulative fraction ---
        let cumulative_fraction: number[] = [];
        // console.log(`Calculated total depth for ${combinedKey} from CSV intensities: ${totalDepthInches.toFixed(4)} inches`);
        if (totalDepthInches > 1e-6) { // Use a small threshold to avoid division by near-zero
            cumulative_fraction = final_cumulative_depths.map(depth => Math.min(1.0, Math.max(0.0, depth / totalDepthInches))); // Clamp fraction between 0 and 1
        } else {
            cumulative_fraction = final_cumulative_depths.map(_ => 0); // All zero if total depth is negligible
            if (final_times.length > 1) { // Avoid warning if there's only the initial (0,0) point
                 console.warn(`Total calculated depth for ${combinedKey} is near zero. Fractions set to 0.`);
            }
        }

        // Store the final processed distribution
        processedDistributions[combinedKey] = {
            time_minutes: final_times,
            cumulative_fraction: cumulative_fraction
        };

         // === DEBUGGING: Log after normalization ===
          if (combinedKey === debugKey) {
              console.log(`[${debugKey}] After Normalization:`);
              console.log(`  Final Times (${processedDistributions[combinedKey].time_minutes.length}): [${processedDistributions[combinedKey].time_minutes.slice(0,3).map(t=>t.toFixed(2)).join(', ')} ... ${processedDistributions[combinedKey].time_minutes.slice(-3).map(t=>t.toFixed(2)).join(', ')}]`);
              console.log(`  Cum. Fractions (${processedDistributions[combinedKey].cumulative_fraction.length}): [${processedDistributions[combinedKey].cumulative_fraction.slice(0,3).map(f=>f.toFixed(4)).join(', ')} ... ${processedDistributions[combinedKey].cumulative_fraction.slice(-3).map(f=>f.toFixed(4)).join(', ')}]`);
          }
    });

    return processedDistributions;
}

/**
 * Pre-processes distributions to ensure they start at (0,0) and end at (Duration, 1.0).
 * @param sourceDistributions The unified distributions map.
 * @returns The processed distributions map.
 */
function preprocessDistributions(sourceDistributions: UnifiedDistributions): UnifiedDistributions {
    const processed: UnifiedDistributions = {};
    // console.log("Starting Preprocessing...");

    for (const combinedKey in sourceDistributions) {
        if (!Object.prototype.hasOwnProperty.call(sourceDistributions, combinedKey)) continue;

        const sourceData = sourceDistributions[combinedKey];
        const durationMatch = combinedKey.match(/(\d+)HR$/);
        // Default to 24hr if regex fails, though keys should always have duration
        const totalDurationMinutes = durationMatch ? parseInt(durationMatch[1], 10) * 60 : DEFAULT_DURATION_HR * 60;

        if (!sourceData || !sourceData.time_minutes || !sourceData.cumulative_fraction || sourceData.time_minutes.length !== sourceData.cumulative_fraction.length) {
            console.error(`Preprocessing Error: Invalid/mismatched data for ${combinedKey}. Skipping.`);
            continue;
        }

        if (sourceData.time_minutes.length === 0) {
            // console.warn(`Preprocessing Warning: No data points for ${combinedKey}. Creating empty.`);
            processed[combinedKey] = { time_minutes: [], cumulative_fraction: [] };
            continue;
        }

        let time_minutes = [...sourceData.time_minutes];
        let cumulative_fraction = [...sourceData.cumulative_fraction];

        // 1. Ensure Start Point (0, 0)
        if (time_minutes[0] !== 0 || cumulative_fraction[0] !== 0) {
            // console.warn(`Preprocessing Warning: Adjusting ${combinedKey} start point.`);
            if (time_minutes[0] !== 0) {
                time_minutes.unshift(0);
                cumulative_fraction.unshift(0); // Add corresponding 0 fraction
            } else {
                // Time is 0, but fraction isn't. Force fraction to 0.
                cumulative_fraction[0] = 0;
            }
            // Clean up potential duplicate (0,0) if unshift created it
            if (time_minutes.length > 1 && time_minutes[1] === 0) {
                time_minutes.splice(1, 1);
                cumulative_fraction.splice(1, 1);
            }
        }

        // 2. Ensure End Point (totalDurationMinutes, 1.0)
        const expectedEndTime = totalDurationMinutes;

        // Remove points strictly *after* the expected end time
        while (time_minutes.length > 0 && time_minutes[time_minutes.length - 1] > expectedEndTime + 1e-3) { // Allow small tolerance
            time_minutes.pop();
            cumulative_fraction.pop();
        }

        const currentLastIdx = time_minutes.length - 1;
        if (currentLastIdx < 0) { // All points were removed? Should not happen if start point exists.
            console.error(`Preprocessing Error: All points removed for ${combinedKey}. Re-adding start/end.`);
            time_minutes = [0, expectedEndTime];
            cumulative_fraction = [0, 1.0];
        } else {
            const currentEndTime = time_minutes[currentLastIdx];
            // Check if the last point is the expected end time
            if (Math.abs(currentEndTime - expectedEndTime) > 1e-3) {
                // Last point is before expected end time, add the end point
                // console.warn(`Preprocessing Warning: Adding end point for ${combinedKey}.`);
                time_minutes.push(expectedEndTime);
                cumulative_fraction.push(1.0); // Force fraction to 1.0
            } else {
                 // Last point is at the correct time, ensure fraction is 1.0
                 if(Math.abs(cumulative_fraction[currentLastIdx] - 1.0) > 1e-3) {
                    // console.warn(`Preprocessing Warning: Correcting end fraction for ${combinedKey}.`);
                    cumulative_fraction[currentLastIdx] = 1.0;
                 }
            }
        }

         // 3. Ensure Monotonicity (Time and Fraction) - Simple check/fix
         let prevTime = -Infinity;
         let prevFrac = -Infinity;
         const finalTimes: number[] = [];
         const finalFracs: number[] = [];
         for(let k=0; k < time_minutes.length; k++) {
             const currentTime = time_minutes[k];
             const currentFrac = cumulative_fraction[k];
             // Time must increase (or stay same); Fraction must not decrease
             if(currentTime >= prevTime && currentFrac >= prevFrac - 1e-6) { // Allow tiny fraction decrease
                 // If time is same as previous, only keep the one with higher fraction
                 if(currentTime === prevTime && finalTimes.length > 0) {
                     finalFracs[finalFracs.length - 1] = Math.max(finalFracs[finalFracs.length - 1], currentFrac);
                 } else {
                    finalTimes.push(currentTime);
                    finalFracs.push(currentFrac);
                    prevTime = currentTime;
                    prevFrac = currentFrac;
                 }
             } else {
                  console.warn(`Preprocessing Warning: Non-monotonic point removed for ${combinedKey} at index ${k} (Time: ${currentTime}, Fraction: ${currentFrac})`);
             }
         }


        processed[combinedKey] = { time_minutes: finalTimes, cumulative_fraction: finalFracs };
    }
    // console.log("Finished Preprocessing.");
    return processed;
}

// --- Parse and Store All Distributions ---

// Initialize structure to hold discovered sub-types
const discoveredSubTypes: StormSubTypes = { SCS: [], NRCS: [], Huff: [] };

// Parse each CSV
const scsDistributions = parseAndProcessStormCsv(scsCsvData, 'SCS', discoveredSubTypes);
const nrcsDistributions = parseAndProcessStormCsv(nrcsCsvData, 'NRCS', discoveredSubTypes);
const huffDistributions = parseAndProcessStormCsv(huffCsvData, 'Huff', discoveredSubTypes);

// Combine into a single map
const allDistributionsRaw: UnifiedDistributions = {
    ...scsDistributions,
    ...nrcsDistributions,
    ...huffDistributions
};

// Preprocess the combined data
const stormDistributions: UnifiedDistributions = preprocessDistributions(allDistributionsRaw);
console.log("Final Unified Distributions Ready:", stormDistributions);

// Export the discovered sub-types for the UI
export const stormSubTypesByCategory: Readonly<StormSubTypes> = Object.freeze(discoveredSubTypes);
console.log("Available SubTypes:", stormSubTypesByCategory);


// --- Linear Interpolation --- (Unchanged)
export function linearInterpolate(x: number, xPoints: number[], yPoints: number[]): number {
    // Handle edge cases: x outside the range of xPoints
    if (x <= xPoints[0]) return yPoints[0];
    const lastIndex = xPoints.length - 1;
    if (x >= xPoints[lastIndex]) return yPoints[lastIndex];

    // Find the interval [xPoints[i-1], xPoints[i]] that contains x
    let i = 1;
    while (i < xPoints.length && xPoints[i] < x) {
        i++;
    }

     // Handle cases where x matches an exact point (or is very close)
     if (Math.abs(x - xPoints[i]) < 1e-6) {
         return yPoints[i];
     }
      if (Math.abs(x - xPoints[i-1]) < 1e-6) {
         return yPoints[i-1];
     }

    // Perform linear interpolation
    const x0 = xPoints[i - 1];
    const x1 = xPoints[i];
    const y0 = yPoints[i - 1];
    const y1 = yPoints[i];

    // Avoid division by zero if xPoints are identical (shouldn't happen with preprocessed data)
    if (Math.abs(x1 - x0) < 1e-9) return y0;

    const fraction = (x - x0) / (x1 - x0);
    return y0 + (y1 - y0) * fraction;
}


// --- Calculate Hyetograph Logic --- (Updated)
export function calculateHyetograph(inputs: CalculationInputs): CalculationResult {
    const {
        totalDepthInput,
        durationInput,
        stormCategory,
        stormSubType,
        timeStepMinutes: timeStepInput,
        depthUnit
    } = inputs;

    // Use validated duration (App.tsx ensures it's 24 for NRCS/Huff)
    const calculationDuration = durationInput;

    // Construct the key to look up the correct distribution
    const combinedKey = `${stormCategory}-${stormSubType}-${calculationDuration}HR`;

    // Ensure inputs are numbers
    const totalDepth = typeof totalDepthInput === 'string' ? parseFloat(totalDepthInput) : totalDepthInput;
    const timeStepMinutes = typeof timeStepInput === 'string' ? parseFloat(timeStepInput) : timeStepInput;

    // Input Validation
    if (isNaN(totalDepth) || isNaN(timeStepMinutes) || totalDepth <= 0 || timeStepMinutes <= 0) {
        console.error("Invalid numeric inputs provided to calculateHyetograph.", { totalDepth, timeStepMinutes });
        return createEmptyResult();
    }
     if (!stormDistributions[combinedKey]) {
        console.error(`Calculation Error: Distribution not found for key: ${combinedKey}`);
        // Potentially provide a more specific error message to the user via the result?
        return createEmptyResult(); // Or throw an error?
    }

    const baseData = stormDistributions[combinedKey];
    const baseTimes = baseData.time_minutes;
    const baseCumulativeFractions = baseData.cumulative_fraction;

    if (baseTimes.length < 2) {
         console.error(`Calculation Error: Insufficient data points in distribution for key: ${combinedKey}`);
         return createEmptyResult();
    }

    const isMetric = depthUnit === 'metric';
    let totalDepthInches = totalDepth / (isMetric ? INCH_TO_MM : 1);
    let peakIntensity = 0;
    let calculatedTotalDepthInches = 0;
    const stormDataStore: StormStep[] = [];
    // Define conversionFactor here, before the loop
    const conversionFactor = isMetric ? INCH_TO_MM : 1;

    // Generate target times based on input time step
    const totalDurationMinutesCalc = calculationDuration * 60;
    const numSteps = Math.ceil(totalDurationMinutesCalc / timeStepMinutes);
    // Ensure target times don't exceed the storm's duration
    const targetTimes = Array.from({ length: numSteps + 1 }, (_, i) => Math.min(i * timeStepMinutes, totalDurationMinutesCalc));
    // Remove potential duplicate end time if duration is exact multiple of timestep
    if(targetTimes.length > 1 && Math.abs(targetTimes[targetTimes.length - 1] - targetTimes[targetTimes.length - 2]) < 1e-6) {
        targetTimes.pop();
    }
     // Ensure the very last time point is exactly the duration
     if(targetTimes.length > 0 && Math.abs(targetTimes[targetTimes.length - 1] - totalDurationMinutesCalc) > 1e-6) {
         targetTimes[targetTimes.length - 1] = totalDurationMinutesCalc;
     }


    const targetCumulativeDepthsInches: number[] = [0]; // Start with depth 0 at time 0
    for (let i = 1; i < targetTimes.length; i++) {
        const currentTimeMinutes = targetTimes[i];
        // Interpolate cumulative fraction at the current target time using the base distribution
        const cumulativeFraction = linearInterpolate(currentTimeMinutes, baseTimes, baseCumulativeFractions);
        targetCumulativeDepthsInches.push(cumulativeFraction * totalDepthInches);
    }

    const finalIntensities: number[] = [];
    const plotLabels: string[] = [];

    for (let i = 1; i < targetCumulativeDepthsInches.length; i++) {
        const startTimeMinutes = targetTimes[i - 1];
        const endTimeMinutes = targetTimes[i];
        const stepDurationMinutes = endTimeMinutes - startTimeMinutes;

        // Skip if step duration is zero or negative (shouldn't happen with generated targetTimes)
        if (stepDurationMinutes <= 1e-6) continue;

        const depthStepInches = targetCumulativeDepthsInches[i] - targetCumulativeDepthsInches[i - 1];
        calculatedTotalDepthInches += depthStepInches;

        const stepDurationHours = stepDurationMinutes / 60.0;
        const intensityInchesPerHour = depthStepInches / stepDurationHours;

        // Use the conversionFactor defined outside the loop
        const finalIntensity = intensityInchesPerHour * conversionFactor;
        const finalDepthStep = depthStepInches * conversionFactor;
        const finalCumulativeDepth = targetCumulativeDepthsInches[i] * conversionFactor;

        finalIntensities.push(finalIntensity);
        if (finalIntensity > peakIntensity) {
            peakIntensity = finalIntensity;
        }

        // Store detailed data
        stormDataStore.push({
            timeStart: startTimeMinutes,
            timeEnd: endTimeMinutes,
            intensity: finalIntensity,
            depthStep: finalDepthStep,
            cumulativeDepth: finalCumulativeDepth
        });

        // Format chart label (using start time of interval)
        plotLabels.push(formatTimeLabel(startTimeMinutes, totalDurationMinutesCalc));
    }
    // Add final label for chart axis end
     if (targetTimes.length > 0) {
         plotLabels.push(formatTimeLabel(totalDurationMinutesCalc, totalDurationMinutesCalc));
     }


    const finalCalculatedTotalDepth = calculatedTotalDepthInches * conversionFactor;

    // Sanity check the calculated total depth against the input
     if (Math.abs(finalCalculatedTotalDepth - totalDepth) / totalDepth > 0.01) { // Allow 1% tolerance
         console.warn(`Calculated total depth (${finalCalculatedTotalDepth.toFixed(3)}) differs significantly from input depth (${totalDepth.toFixed(3)}) for ${combinedKey}. Check interpolation or data.`);
     }


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

// --- Helper Functions --- (Unchanged)

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

function formatTimeLabel(timeMinutes: number, totalDurationMinutes: number): string {
     const tolerance = 1e-6; // Small tolerance for floating point comparisons
     if (totalDurationMinutes > 120 + tolerance) { // Use H:MM for durations > 2 hours
         let hours = Math.floor(timeMinutes / 60);
         // Round the remainder minutes *after* the modulo
         let mins = Math.round((timeMinutes % 60) + tolerance);

         // Handle case where rounding mins results in 60
         if (mins >= 60) {
             hours += 1;
             mins = 0;
         }

         // Correct for potential negative zero after rounding
         if (Object.is(mins, -0)) mins = 0;

         return `${hours}:${mins.toString().padStart(2, '0')}`;
     } else { // Use minutes for shorter durations
         // Add tolerance before rounding
         return `${Math.round(timeMinutes + tolerance)}m`;
     }
} 