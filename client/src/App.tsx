import { useState, useEffect, useCallback } from 'react';
import InputForm from './components/InputForm'; // Import the form component
import { calculateHyetograph, CalculationInputs } from './utils/tr55';
import { CalculationResult, StormInputParameters, NoaaState } from './types';
import HyetographChart from './components/HyetographChart'; // Import the chart
import SummaryTable from './components/SummaryTable'; // Import SummaryTable
import DetailedTable from './components/DetailedTable'; // Import DetailedTable
import NoaaMap from './components/NoaaMap'; // Import the map
import NoaaDataTable from './components/NoaaDataTable'; // Import the new table
import L from 'leaflet'; // Import Leaflet library for LatLng type
import { parseNoaaCsv } from './utils/noaaParser'; // Import the parser

// Default input values
const defaultInputs: StormInputParameters = {
  totalDepth: '1.0',
  duration: 24,
  stormCategory: 'SCS', // Default category
  stormSubType: 'Type II', // Default sub-type for SCS
  timeStep: '6',
  depthUnits: 'us',
};

// Initial state for NOAA data
const initialNoaaState: NoaaState = {
    latitude: null,
    longitude: null,
    isLoading: false,
    error: null,
    data: null,
    statusMessage: 'Click map to select location.'
};

function App() {
  const [inputs, setInputs] = useState<StormInputParameters>(defaultInputs);
  const [calculationResult, setCalculationResult] = useState<CalculationResult | null>(null);
  const [noaaState, setNoaaState] = useState<NoaaState>(initialNoaaState); // Add NOAA state

  // Handler for input changes
  const handleInputChange = (field: keyof StormInputParameters, value: string | number | (6 | 12 | 24)) => {
    // Log the raw input change
    console.log(`Input changed: Field=${field}, Value=${value}, Type=${typeof value}`);

    setInputs((prev) => {
        // Store the previous category to detect changes
        const prevCategory = prev.stormCategory;
        let processedValue: string | number | (6 | 12 | 24) | 'SCS' | 'NRCS' | 'Huff' = value;
        let newState = { ...prev }; // Start with a copy of the previous state

        // Handle category change first, as it affects other fields
        if (field === 'stormCategory') {
            const newCategory = value as 'SCS' | 'NRCS' | 'Huff';
            processedValue = newCategory;
            newState.stormCategory = newCategory;

            // Reset sub-type and duration based on new category
            if (newCategory !== prevCategory) {
                if (newCategory === 'SCS') {
                    newState.stormSubType = 'Type II'; // Default SCS sub-type
                    // Duration remains user-selectable
                } else { // NRCS or Huff
                    newState.duration = 24; // Force duration to 24hr
                    newState.stormSubType = newCategory === 'NRCS' ? 'Northeast Type A' : 'Huff Type I';
                    // Reset timeStep if current value is invalid for NRCS/Huff
                    if (!['1', '6'].includes(String(newState.timeStep))) {
                         console.log(`Resetting timeStep to 6 for ${newCategory} category.`);
                         newState.timeStep = '6';
                    }
                }
            }
        }
        // Keep totalDepth as string
        else if (field === 'totalDepth') {
             processedValue = String(value);
             console.log(`Kept ${field} as string: ${processedValue}`);
        }
        // Handle timeStep changes, enforcing NRCS/Huff restrictions
        else if (field === 'timeStep') {
            const timeStepValue = String(value);
            // Allow any positive integer for SCS
            if (newState.stormCategory === 'SCS') {
                // Basic validation for positive integers (allow empty string during typing)
                if (timeStepValue === '' || /^[1-9][0-9]*$/.test(timeStepValue)) {
                    processedValue = timeStepValue;
                    console.log(`Kept ${field} as string: ${processedValue}`);
                } else {
                    // Don't update if invalid for SCS (e.g., non-digit, zero)
                    console.warn(`Invalid timeStep value for SCS: ${timeStepValue}. Reverting.`);
                    return prev;
                }
            } else { // NRCS or Huff
                // Only allow '1' or '6'
                if (timeStepValue === '1' || timeStepValue === '6' || timeStepValue === '') {
                    processedValue = timeStepValue;
                    console.log(`Kept ${field} as string: ${processedValue}`);
                } else {
                    // Don't update if invalid for NRCS/Huff
                    console.warn(`Invalid timeStep value for NRCS/Huff (must be 1 or 6): ${timeStepValue}. Reverting.`);
                    return prev;
                }
            }
        }
        // Special handling for duration (only applies if SCS)
        else if (field === 'duration' && newState.stormCategory === 'SCS') {
            const numValue = typeof value === 'string' ? parseInt(value, 10) : value;
            if (typeof numValue === 'number' && [6, 12, 24].includes(numValue)) {
                processedValue = numValue as 6 | 12 | 24;
                console.log(`Processed duration to number: ${processedValue}`);
            } else {
                console.error(`Error processing input for ${field}: Expected 6, 12, or 24 but got ${value}`);
                return prev; // Revert if duration is invalid for SCS
            }
        }
         // Handle subType changes
         else if (field === 'stormSubType') {
             processedValue = String(value);
         }
         // For depthUnits, ensure it's a string
         else if (field === 'depthUnits') {
             processedValue = String(value);
         }

        // Update the specific field that triggered the change
        // Use type assertion carefully here
        (newState as any)[field] = processedValue;

        // Return the potentially modified state
        return newState;
    });
  };

  // Handler for unit radio button changes - only handles depth now
  const handleUnitChange = (unitType: 'depth', value: 'us' | 'metric') => {
      if (unitType === 'depth') {
          // Type assertion needed because StormInputParameters no longer strictly matches the function signature
          setInputs((prev) => ({ ...prev, depthUnits: value as 'us' | 'metric' }));
      }
      // Removed triggerCalculation here - let it happen on submit or NOAA select
      // triggerCalculation(inputs);
  };

  // Function to validate inputs and trigger calculation
  const triggerCalculation = useCallback((currentInputs: StormInputParameters) => {
       // Validate and convert inputs to numbers
       // Explicitly convert to string before parsing, as the type could be number | string
       const depthNum = parseFloat(String(currentInputs.totalDepth));
       // currentInputs.duration is already 6 | 12 | 24
       // Explicitly convert to string before parsing
       const timeStepNum = parseInt(String(currentInputs.timeStep), 10);

       // Duration check needs to consider category
       const isValidDuration = currentInputs.stormCategory === 'SCS'
           ? [6, 12, 24].includes(currentInputs.duration)
           : currentInputs.duration === 24;

       // Time step validation
       const timeStepStr = String(currentInputs.timeStep);
       const isValidTimeStep =
           isNaN(timeStepNum) || timeStepNum <= 0 ? false :
           currentInputs.stormCategory === 'SCS' ? true : // Any positive integer is fine for SCS (already parsed)
           ['1', '6'].includes(timeStepStr); // Must be exactly '1' or '6' for NRCS/Huff

       if (isNaN(depthNum) || depthNum <= 0 ||
           !isValidDuration ||
           !isValidTimeStep) { // Use the new time step validation
           console.error("Invalid input values for calculation.", currentInputs);
           // Update alert message
           alert(`Please ensure all inputs are valid. Depth must be positive. Duration must be 6, 12, or 24 for SCS storms (fixed at 24 for NRCS/Huff). Time Step must be a positive integer (only 1 or 6 allowed for NRCS/Huff).`);
           setCalculationResult(null); // Clear previous results on invalid input
           return;
       }

       const calculationParams: CalculationInputs = {
           totalDepthInput: depthNum,
           durationInput: currentInputs.duration, // Pass the actual duration
           // Pass category and sub-type
           stormCategory: currentInputs.stormCategory,
           stormSubType: currentInputs.stormSubType,
           timeStepMinutes: timeStepNum,
           depthUnit: currentInputs.depthUnits,
           durationUnit: 'hours',
       };

       try {
           const result = calculateHyetograph(calculationParams);
           setCalculationResult(result);
       } catch (error) {
            console.error("Error during hyetograph calculation:", error);
            alert("An error occurred during calculation. Please check inputs and try again.");
            setCalculationResult(null); // Clear results on error
       }
  }, []);

  // Handler for form submission
  const handleSubmit = () => {
      console.log("Form submitted, triggering calculation with state:", inputs);
      triggerCalculation(inputs); // Use current state
  };

   // Initial calculation on component mount
   useEffect(() => {
       triggerCalculation(defaultInputs);
   }, [triggerCalculation]); // Depend on the memoized triggerCalculation

  // --- NOAA Data Fetching Logic ---
  const fetchNoaaData = useCallback(async (lat: number, lon: number) => {
      console.log(`Fetching NOAA data for Lat: ${lat}, Lon: ${lon}`);
      setNoaaState((prev: NoaaState): NoaaState => ({
          ...prev,
          latitude: lat,
          longitude: lon,
          isLoading: true,
          error: null,
          data: null,
          statusMessage: `Fetching data for ${lat.toFixed(4)}, ${lon.toFixed(4)}...`
      }));

      // Use the relative path directly, thanks to Netlify redirects in netlify.toml
      const apiUrl = `/api/noaa-pfds?lat=${lat}&lon=${lon}`;

      try {
          const response = await fetch(apiUrl);

          if (!response.ok) {
              let errorMsg = `Failed to fetch NOAA data. Status: ${response.status}`; // Default error
              try {
                  // Try to parse error JSON from backend proxy
                  const errorJson = await response.json();
                  errorMsg = errorJson.error || errorMsg; // Use backend error if available
              } catch (e) {
                  // If parsing JSON fails, use the default status text
                  errorMsg = `Failed to fetch NOAA data: ${response.statusText} (Status: ${response.status})`;
              }
              throw new Error(errorMsg);
          }

          const csvText = await response.text();

          if (!csvText || csvText.trim() === '' || csvText.toLowerCase().includes('error')){
               console.warn('NOAA CSV Fetch Warning: Received empty or error-like response text.', csvText);
               throw new Error('Received empty or invalid data from NOAA server.');
          }

          // Add logging here to see the raw response BEFORE parsing
          console.log('Raw NOAA CSV Response:', csvText);

          const parsedData = parseNoaaCsv(csvText);

          if (!parsedData) {
               console.error('Failed to parse NOAA CSV response.');
               throw new Error('Could not parse data received from NOAA server.');
          }

          console.log('Successfully fetched and parsed NOAA data:', parsedData);
          setNoaaState((prev: NoaaState): NoaaState => ({
              ...prev,
              isLoading: false,
              data: parsedData,
              statusMessage: `Data loaded for ${lat.toFixed(4)}, ${lon.toFixed(4)}. Select an event.`
          }));

      } catch (error: any) {
          console.error("Error during NOAA data fetch or processing:", error);
          setNoaaState((prev: NoaaState): NoaaState => ({
              ...prev,
              isLoading: false,
              error: error.message || 'An unknown error occurred during NOAA data fetch.',
              statusMessage: 'Error fetching or processing data. Please try again.'
          }));
      }

  }, []); // No dependencies needed here as it uses passed lat/lon

  // --- Map Click Handler ---
  const handleMapClick = useCallback((latlng: L.LatLng) => {
      // Trigger data fetch when map is clicked
      fetchNoaaData(latlng.lat, latlng.lng);
  }, [fetchNoaaData]); // Depend on the memoized fetch function

  // --- Apply NOAA Data to Inputs ---
  const applyNoaaDataToInputs = useCallback((depth: number, durationValue: number) => {
        console.log(`Applying NOAA data: Depth=${depth}, Duration=${durationValue} hours`);

        // Validate durationValue
        if (![6, 12, 24].includes(durationValue)) {
            console.error(`Invalid duration (${durationValue}) passed from NOAA table. Expected 6, 12, or 24.`);
            alert(`Error applying NOAA data: Invalid duration (${durationValue} hours)`);
            return;
        }

        // Create the updated inputs object
        const updatedInputs: StormInputParameters = {
            ...inputs,
            totalDepth: depth.toFixed(3),
            duration: durationValue as 6 | 12 | 24,
            depthUnits: 'us',
            // When applying NOAA data, default to SCS Type II? Or keep current category/subtype?
            // For now, let's keep the current category/subtype but force duration.
            // If the current category is NRCS/Huff, this duration might not be valid later,
            // but triggerCalculation should handle that. Alternatively, we could force category to SCS here.
            // Let's force to SCS for simplicity when applying NOAA data.
            stormCategory: 'SCS',
            stormSubType: 'Type II',
        };

        setInputs(updatedInputs);
        triggerCalculation(updatedInputs);

  }, [inputs, triggerCalculation]); // Add dependencies


  console.log('App render. Inputs:', inputs, 'Result:', calculationResult, 'NOAA:', noaaState);

  return (
    <div className="container mx-auto p-4 min-h-screen flex flex-col bg-gray-50">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-blue-700 border-b-2 border-blue-700 pb-2">
          GStorm: Rainfall Design Storm Generator (TR-55 & NOAA)
        </h1>
      </header>

      <main className="flex-grow grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Column 1: Inputs & NOAA */}
        <div className="flex flex-col gap-6">
          <section id="input-section" className="bg-white p-4 rounded-lg shadow border border-gray-200">
            <h2 className="text-xl font-semibold text-blue-600 border-b border-gray-300 pb-1 mb-4">
              Inputs
            </h2>
             {/* --- Input Form --- */}
            <InputForm
                inputs={inputs}
                onInputChange={handleInputChange}
                onUnitChange={handleUnitChange}
                onSubmit={handleSubmit}
            />
          </section>

          {/* --- NOAA Section --- */}
          <section id="noaa-section" className="bg-white p-4 rounded-lg shadow border border-gray-200 flex flex-col">
            <h2 className="text-xl font-semibold text-blue-600 border-b border-gray-300 pb-1 mb-4">
              NOAA Atlas 14 Data
            </h2>
            {/* Map takes up less space initially */}
            <div className="h-64 mb-4 border rounded-lg overflow-hidden shadow-inner">
                 <NoaaMap
                    onMapClick={handleMapClick}
                    initialCenter={noaaState.latitude && noaaState.longitude ? [noaaState.latitude, noaaState.longitude] : undefined}
                    selectedLatLon={noaaState.latitude && noaaState.longitude ? L.latLng(noaaState.latitude, noaaState.longitude) : null}
                    statusMessage={noaaState.statusMessage}
                 />
            </div>
             {/* --- Display NOAA Results Table --- */}
            <NoaaDataTable
                noaaData={noaaState.data}
                isLoading={noaaState.isLoading}
                error={noaaState.error}
                statusMessage={noaaState.statusMessage}
                onSelectEvent={applyNoaaDataToInputs} // Pass the existing function
            />
          </section>
        </div>

        {/* Column 2: Outputs */}
        <div className="flex flex-col gap-6">
          <section className="bg-white p-4 rounded-lg shadow border border-gray-200">
             <h2 className="text-xl font-semibold text-blue-600 border-b border-gray-300 pb-1 mb-4">
              Output
            </h2>
             {calculationResult ? (
                <div className="space-y-4">
                   {/* --- Hyetograph Chart --- */}
                  <HyetographChart calculationResult={calculationResult} />

                   {/* --- Summary Table --- */}
                  <SummaryTable calculationResult={calculationResult} />

                  {/* --- Detailed Table --- */}
                  <DetailedTable
                    calculationResult={calculationResult}
                    stormInputs={inputs} // Pass inputs for filename generation
                   />

                </div>
             ) : (
                <p className="text-gray-500 italic">Generate a storm or provide valid inputs to see results.</p>
             )}
          </section>
        </div>
      </main>

      <footer className="mt-8 pt-4 border-t border-gray-300 text-center text-sm text-gray-500">
        Disclaimer: This tool is for illustrative purposes. Verify results with official sources and engineering judgment. Calculations based on standard TR-55 cumulative distributions via linear interpolation. NOAA data fetched live via backend proxy.
      </footer>
    </div>
  );
}

export default App; 