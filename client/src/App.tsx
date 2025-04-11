import { useState, useEffect, useCallback } from 'react';
import InputForm from './components/InputForm'; // Import the form component
import { calculateHyetograph, CalculationInputs } from './utils/tr55';
import { CalculationResult, StormInputParameters, NoaaState } from './types';
import HyetographChart from './components/HyetographChart'; // Import the chart
import SummaryTable from './components/SummaryTable'; // Import SummaryTable
import DetailedTable from './components/DetailedTable'; // Import DetailedTable
import NoaaMap from './components/NoaaMap'; // Import the map
import NoaaResultsTable from './components/NoaaResultsTable'; // Import the table
import L from 'leaflet'; // Import Leaflet library for LatLng type
import { parseNoaaCsv } from './utils/noaaParser'; // Import the parser

// Default input values
const defaultInputs: StormInputParameters = {
  totalDepth: '1.0',
  duration: 24,
  stormType: 'Type II',
  timeStep: '6',
  depthUnits: 'us',
  durationUnits: 'hours',
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
  const handleInputChange = (field: keyof StormInputParameters, value: string | number) => {
      setInputs((prev: StormInputParameters): StormInputParameters => ({
          ...prev,
          [field]: value
      }));
      // Maybe clear results on input change? Or recalculate automatically?
      // For now, recalculation happens on submit.
  };

  // Handler for unit radio button changes - only handles depth now
  const handleUnitChange = (unitType: 'depth', value: 'us' | 'metric') => {
      if (unitType === 'depth') {
          setInputs((prev: StormInputParameters): StormInputParameters => ({ ...prev, depthUnits: value as 'us' | 'metric' }));
      } 
      triggerCalculation(inputs); 
  };

  // Function to validate inputs and trigger calculation
  const triggerCalculation = useCallback((currentInputs: StormInputParameters) => {
       // Validate and convert inputs to numbers
       const depthNum = parseFloat(String(currentInputs.totalDepth));
       const timeStepNum = parseInt(String(currentInputs.timeStep), 10);

       if (isNaN(depthNum) || depthNum <= 0 ||
           ![6, 12, 24].includes(currentInputs.duration) || 
           isNaN(timeStepNum) || timeStepNum <= 0) {
           console.error("Invalid input values for calculation.");
           alert("Please ensure all inputs (Depth, Time Step) are valid positive numbers and Duration is 6, 12, or 24.");
           setCalculationResult(null); // Clear previous results on invalid input
           return;
       }

       const calculationParams: CalculationInputs = {
           totalDepthInput: depthNum,
           durationInput: currentInputs.duration,
           stormType: currentInputs.stormType,
           timeStepMinutes: timeStepNum,
           depthUnit: currentInputs.depthUnits,
           durationUnit: currentInputs.durationUnits,
       };

       try {
           const result = calculateHyetograph(calculationParams);
           setCalculationResult(result);
       } catch (error) {
            console.error("Error during hyetograph calculation:", error);
            alert("An error occurred during calculation. Please check inputs and try again.");
            setCalculationResult(null); // Clear results on error
       }
  }, []); // Empty dependency array, relies on passed-in inputs

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

  // --- Apply NOAA Data to Inputs (Placeholder) ---
  const applyNoaaDataToInputs = useCallback((depth: number, durationValue: number) => {
        console.log(`Applying NOAA data: Depth=${depth}, Duration=${durationValue} hours`);

        // Validate durationValue is one of the allowed values
        if (![6, 12, 24].includes(durationValue)) {
            console.error(`Invalid duration (${durationValue}) passed from NOAA table. Expected 6, 12, or 24.`);
            alert(`Error applying NOAA data: Invalid duration (${durationValue} hours)`);
            return;
        }

        // Create the updated inputs object
        const updatedInputs: StormInputParameters = {
            ...inputs, // Keep other inputs like stormType and timeStep
            totalDepth: depth.toFixed(3), // Update depth
            duration: durationValue as 6 | 12 | 24, // Update duration value, assert type
            depthUnits: 'us',              // Set depth units to US
            durationUnits: 'hours',        // Fixed to hours
        };

        setInputs(updatedInputs);

        // Trigger calculation with the *new* inputs state
        triggerCalculation(updatedInputs); // Pass the newly set state

        alert(`Inputs updated: ${depth.toFixed(3)} inches, ${durationValue} hours. Storm recalculated.`);

        // Optional: Scroll to input form
        // document.getElementById('input-section')?.scrollIntoView({ behavior: 'smooth' });

    }, [inputs, triggerCalculation]); // Depend on inputs and triggerCalculation


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
          <section className="bg-white p-4 rounded-lg shadow border border-gray-200">
             <h2 className="text-xl font-semibold text-blue-600 border-b border-gray-300 pb-1 mb-4">
              NOAA Atlas 14 Lookup
            </h2>
             {/* --- NOAA Map --- */}
            <NoaaMap
                 selectedLatLon={noaaState.latitude && noaaState.longitude ? new L.LatLng(noaaState.latitude, noaaState.longitude) : null}
                 onMapClick={handleMapClick}
                 statusMessage={noaaState.statusMessage}
             />

             {/* Loading/Error messages handled here or could be inside table */}
             {noaaState.isLoading && <p className="text-blue-500 font-semibold mt-2">Loading...</p>}
             {noaaState.error && !noaaState.isLoading && <p className="text-red-500 font-semibold mt-2">Error: {noaaState.error}</p>}

            {/* --- NOAA Results Table --- */}
            {/* Render table only when not loading and data exists or no specific error shown */}
             {!noaaState.isLoading && (
                 <NoaaResultsTable
                    noaaState={noaaState}
                    onApplyData={applyNoaaDataToInputs}
                 />
             )}

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