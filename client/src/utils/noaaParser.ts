import { NoaaReturnPeriodData } from '../types';

/**
 * Parses the CSV text response from the NOAA PFDS endpoint.
 * Extracts mean precipitation depths (inches) for various return periods and durations.
 * Handles the actual format with metadata header lines.
 * @param csvText The raw CSV string from the API.
 * @returns An array of NoaaReturnPeriodData, or null if parsing fails.
 */
export function parseNoaaCsv(csvText: string): NoaaReturnPeriodData[] | null {
    try {
        const lines = csvText.trim().split('\n');
        if (lines.length < 13) { // Need at least metadata, ARI header, and one data line
            console.error('NOAA CSV Parse Error: Not enough lines in CSV data for expected format.', lines.length);
            return null;
        }

        // --- Find Header and Data Rows ---
        let headerIndex = -1;
        let dataStartIndex = -1;

        // Find the line with ARI headers (e.g., starts with "by duration for ARI")
        // Allowing for slight variations in the prefix text.
        const headerLinePrefix = "by duration for ARI";
        for (let i = 0; i < lines.length; i++) {
             // Trim and normalize whitespace in the prefix check
            if (lines[i].trim().replace(/\s+/g, ' ').toLowerCase().startsWith(headerLinePrefix.toLowerCase())) {
                headerIndex = i;
                dataStartIndex = i + 1;
                break;
            }
        }

        if (headerIndex === -1) {
            console.error('NOAA CSV Parse Error: Could not find the ARI header line starting with ~"' + headerLinePrefix + '".');
            return null;
        }

        // --- Extract ARI Headers ---
        const headerLine = lines[headerIndex];
        const ariHeadersRaw = headerLine.split(',').slice(1).map(h => h.trim().replace(/^"|"$/g, '')); // Skip first column label
        const ariHeaderMap: { [ari: string]: number } = {}; // Map "10" -> index 1 etc.
        ariHeadersRaw.forEach((ari, index) => {
            if (ari) { // Ensure it's not an empty string
                 ariHeaderMap[ari] = index;
            }
        });

        if (Object.keys(ariHeaderMap).length === 0) {
            console.error('NOAA CSV Parse Error: Could not extract valid ARI headers from line:', headerLine);
            return null;
        }
        // console.log("Extracted ARI Headers Map:", ariHeaderMap);

        // --- Define desired data points ---
        const desiredReturnPeriods = ["1", "2", "5", "10", "25", "50", "100", "200", "500", "1000"];
        const desiredDurationLabels = [
            "5-min", "15-min", "60-min", "2-hr", "3-hr", "6-hr", "12-hr", "24-hr", "2-day", "4-day", "7-day", "10-day"
            // Note: The parser will now extract *all* durations present in the first column and filter later if needed by the calling code.
            // We still use desiredDurationLabels for parsing units correctly.
        ];

        // --- Process Data Lines ---
        const dataLines = lines.slice(dataStartIndex);
        const resultMap: Map<number, NoaaReturnPeriodData> = new Map(); // Use Map for easier building: RP -> Data

        // Initialize map with desired return periods
        desiredReturnPeriods.forEach(rpStr => {
            const rpNum = parseInt(rpStr, 10);
            if (!isNaN(rpNum) && ariHeaderMap[rpStr] !== undefined) { // Only add RPs present in the header
                resultMap.set(rpNum, { returnPeriod: rpNum, dataPoints: [] });
            }
        });

        dataLines.forEach(line => {
            if (!line || line.trim() === '' || !line.includes(',')) return; // Skip empty or invalid lines

            const values = line.split(',').map(val => val.trim().replace(/^"|"$/g, ''));
            if (values.length < 2) return; // Need at least duration label and one value

            const durationLabelRaw = values[0];
            // Clean the label: remove trailing colon, normalize space to hyphen
            const durationLabel = durationLabelRaw.replace(/:$/, '').replace(/\s+/g, '-');

            // Find corresponding desired label info for unit parsing
            const desiredDurationInfo = desiredDurationLabels.find(d => d.toLowerCase() === durationLabel.toLowerCase());

             // Extract numeric duration and units if we recognize the label format
             let durationValue: number | undefined;
             let durationUnits: 'minutes' | 'hours' | undefined;
             if (desiredDurationInfo) {
                 const parts = desiredDurationInfo.split('-'); // Use the cleaned, desired label
                 const numPart = parseInt(parts[0], 10);
                 const unitPart = parts[1]?.toLowerCase();

                 if (!isNaN(numPart) && unitPart) {
                     if (unitPart === 'min') {
                         durationValue = numPart;
                         durationUnits = 'minutes';
                     } else if (unitPart === 'hr') {
                         durationValue = numPart;
                         durationUnits = 'hours';
                     } else if (unitPart === 'day') {
                         durationValue = numPart * 24; // Convert days to hours
                         durationUnits = 'hours';
                     }
                 }
             }
             // Fallback or warning if units couldn't be parsed but are needed downstream
             if (durationValue === undefined || durationUnits === undefined) {
                  // console.warn(`Could not parse duration value/units from label: ${durationLabelRaw}`);
                  // Depending on requirements, you might skip this duration or assign defaults
             }

            // Iterate through the desired *return periods* found in the header
            desiredReturnPeriods.forEach(rpStr => {
                 const rpNum = parseInt(rpStr, 10);
                 const headerIndex = ariHeaderMap[rpStr]; // Get the column index for this RP

                 // Check if this RP exists in our results map and the header
                 if (resultMap.has(rpNum) && headerIndex !== undefined && values.length > headerIndex + 1) {
                     const depthStr = values[headerIndex + 1]; // +1 because values includes the duration label column
                     const depth = parseFloat(depthStr);

                     if (!isNaN(depth) && durationValue !== undefined && durationUnits !== undefined) {
                         // Add the data point to the correct return period entry
                         resultMap.get(rpNum)?.dataPoints.push({
                             durationLabel: durationLabel, // Use the cleaned label
                             depth: depth,
                             durationValue: durationValue,
                             durationUnits: durationUnits
                         });
                     }
                 }
            });
        });

        // Convert map values to array, filtering out any RPs that ended up with no data points
        const parsedData = Array.from(resultMap.values()).filter(rpData => rpData.dataPoints.length > 0);

        if (parsedData.length === 0) {
             console.error("NOAA CSV Parse Warning: No data points could be extracted matching desired RPs and durations.");
             return null; // Or return empty array? Depends on desired behavior.
        }

        // Sort by return period for consistent order
        parsedData.sort((a, b) => a.returnPeriod - b.returnPeriod);
        // Optional: Sort dataPoints within each return period if needed
        parsedData.forEach(rp => {
             rp.dataPoints.sort((a, b) => {
                 // Simple sort based on label might work if consistent (e.g., 5-min < 10-min < 1-hr)
                 // A more robust sort would convert all to minutes/hours first.
                 // Using durationValue and units for sorting:
                 const aMinutes = a.durationUnits === 'minutes' ? a.durationValue : a.durationValue * 60;
                 const bMinutes = b.durationUnits === 'minutes' ? b.durationValue : b.durationValue * 60;
                 return aMinutes - bMinutes;
             });
        });


        // console.log("Parsed NOAA Data:", parsedData);
        return parsedData;

    } catch (error) {
        console.error("Error parsing NOAA CSV data:", error);
        return null;
    }
} 