import React from 'react';
import { StormInputParameters } from '../types'; // Import the type
// Import the available sub-types exported from tr55.ts
import { stormSubTypesByCategory } from '../utils/tr55';

interface InputFormProps {
  // Use the full StormInputParameters type
  inputs: StormInputParameters;
  // Update the callback signature
  onInputChange: (field: keyof StormInputParameters, value: string | number | 6 | 12 | 24) => void;
  onUnitChange: (unitType: 'depth', value: 'us' | 'metric') => void;
  onSubmit: () => void;
}

const InputForm: React.FC<InputFormProps> = ({ inputs, onInputChange, onUnitChange, onSubmit }) => {

    const handleNumericChange = (field: 'totalDepth' | 'timeStep', value: string) => {
        // Allow empty string, positive numbers, and partial decimals like "1."
        if (value === '' || /^[+]?([0-9]*[.])?[0-9]*$/.test(value)) {
            onInputChange(field, value);
        }
    };

    // Duration change handler (Only applicable for SCS)
    const handleDurationChange = (value: string) => {
        const durationValue = parseInt(value, 10) as 6 | 12 | 24;
        if (inputs.stormCategory === 'SCS') {
            onInputChange('duration', durationValue);
        }
    };

    // Get the list of sub-types for the currently selected category
    const currentSubTypes = stormSubTypesByCategory[inputs.stormCategory] || [];
    const isSCS = inputs.stormCategory === 'SCS';

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Total Rainfall Depth */}
        <div>
          <label htmlFor="total-depth" className="block text-sm font-medium text-gray-700 mb-1">
            Total Rainfall Depth ({inputs.depthUnits === 'us' ? 'in' : 'mm'})
          </label>
          <input
            type="text" // Use text to allow intermediate states like "1."
            inputMode="decimal" // Hint for mobile keyboards
            id="total-depth"
            name="totalDepth"
            value={inputs.totalDepth}
            onChange={(e) => handleNumericChange('totalDepth', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            required
            min="0"
          />
          <div className="mt-2 flex items-center space-x-4">
            <label className="flex items-center text-sm text-gray-600">
              <input
                type="radio"
                name="depthUnits"
                value="us"
                checked={inputs.depthUnits === 'us'}
                onChange={() => onUnitChange('depth', 'us')}
                className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300"
              />
              <span className="ml-2">US (inches)</span>
            </label>
            <label className="flex items-center text-sm text-gray-600">
              <input
                type="radio"
                name="depthUnits"
                value="metric"
                checked={inputs.depthUnits === 'metric'}
                onChange={() => onUnitChange('depth', 'metric')}
                className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300"
              />
              <span className="ml-2">Metric (mm)</span>
            </label>
          </div>
        </div>

        {/* Storm Category Dropdown */}
        <div>
          <label htmlFor="storm-category" className="block text-sm font-medium text-gray-700 mb-1">
            Storm Distribution Category
          </label>
          <select
            id="storm-category"
            name="stormCategory"
            value={inputs.stormCategory}
            onChange={(e) => onInputChange('stormCategory', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          >
            <option value="SCS">SCS (TR-55)</option>
            <option value="NRCS">NRCS (Regional)</option>
            <option value="Huff">Huff (Regional)</option>
          </select>
        </div>

        {/* Storm Sub-Type Dropdown (Dynamic) */}
        <div>
          <label htmlFor="storm-subtype" className="block text-sm font-medium text-gray-700 mb-1">
            Storm Sub-Type
          </label>
          <select
            id="storm-subtype"
            name="stormSubType"
            value={inputs.stormSubType} // Ensure this value exists in currentSubTypes
            onChange={(e) => onInputChange('stormSubType', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            disabled={currentSubTypes.length === 0} // Disable if no sub-types available
          >
            {currentSubTypes.map(subType => (
              <option key={subType} value={subType}>{subType}</option>
            ))}
          </select>
        </div>

        {/* Duration Dropdown (Conditional) */}
        <div>
          <label htmlFor="duration" className={`block text-sm font-medium mb-1 ${isSCS ? 'text-gray-700' : 'text-gray-400'}`}>
            Duration (hours)
          </label>
          <select
            id="duration"
            name="duration"
            value={inputs.duration} // Value is now 6, 12, or 24
            onChange={(e) => handleDurationChange(e.target.value)}
            className={`w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${!isSCS ? 'bg-gray-100 cursor-not-allowed' : ''}`}
            required
            disabled={!isSCS} // Disable if not SCS
          >
            <option value={6}>6 hours</option>
            <option value={12}>12 hours</option>
            <option value={24}>24 hours</option>
          </select>
          {!isSCS && (
              <p className="mt-1 text-xs text-gray-500 italic">Duration fixed at 24 hours for NRCS/Huff storms.</p>
          )}
        </div>

        {/* Time Step */}
        <div>
           <label htmlFor="time-step" className="block text-sm font-medium text-gray-700 mb-1">
            Time Step (minutes)
          </label>
          <input
            type="text"
            inputMode="numeric"
            id="time-step"
            name="timeStep"
            value={inputs.timeStep}
            onChange={(e) => onInputChange('timeStep', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            required
            min="1"
          />
          {inputs.stormCategory !== 'SCS' && (
               <p className="mt-1 text-xs text-gray-500 italic">Time step must be 1 or 6 minutes for NRCS/Huff storms.</p>
          )}
        </div>
      </div>

      <button
        type="submit"
        className="mt-4 w-full inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-150 ease-in-out"
      >
        Generate / Update Storm
      </button>
    </form>
  );
};

export default InputForm; 