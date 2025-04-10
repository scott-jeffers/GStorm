import React from 'react';
import { StormInputParameters } from '../types'; // Import the type

interface InputFormProps {
  inputs: StormInputParameters;
  onInputChange: (field: keyof StormInputParameters, value: string | number) => void;
  onUnitChange: (unitType: 'depth' | 'duration', value: 'us' | 'metric' | 'hours' | 'minutes') => void;
  onSubmit: () => void; // Function to trigger calculation
}

const InputForm: React.FC<InputFormProps> = ({ inputs, onInputChange, onUnitChange, onSubmit }) => {

    const handleNumericChange = (field: 'totalDepth' | 'duration' | 'timeStep', value: string) => {
        // Allow empty string or positive numbers (including decimals)
        if (value === '' || /^[+]?([0-9]*[.])?[0-9]+$/.test(value) || /^[+]?[0-9]+\.?$/.test(value) ) {
             onInputChange(field, value);
        } else if (/^\d*$/.test(value)) { // Allow just digits during typing
             onInputChange(field, value);
        }
    };

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

        {/* Duration */}
        <div>
          <label htmlFor="duration" className="block text-sm font-medium text-gray-700 mb-1">
            Duration ({inputs.durationUnits})
          </label>
          <input
            type="text"
            inputMode="decimal"
            id="duration"
            name="duration"
            value={inputs.duration}
            onChange={(e) => handleNumericChange('duration', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            required
            min="0" // Technically > 0, handled in calculation
          />
           <div className="mt-2 flex items-center space-x-4">
            <label className="flex items-center text-sm text-gray-600">
              <input
                type="radio"
                name="durationUnits"
                value="hours"
                checked={inputs.durationUnits === 'hours'}
                onChange={() => onUnitChange('duration', 'hours')}
                className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300"
              />
              <span className="ml-2">Hours</span>
            </label>
            <label className="flex items-center text-sm text-gray-600">
              <input
                type="radio"
                name="durationUnits"
                value="minutes"
                checked={inputs.durationUnits === 'minutes'}
                onChange={() => onUnitChange('duration', 'minutes')}
                className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300"
              />
              <span className="ml-2">Minutes</span>
            </label>
          </div>
        </div>

        {/* Design Storm Type */}
        <div>
          <label htmlFor="storm-type" className="block text-sm font-medium text-gray-700 mb-1">
            Design Storm Type
          </label>
          <select
            id="storm-type"
            name="stormType"
            value={inputs.stormType}
            onChange={(e) => onInputChange('stormType', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          >
            <option value="Type I">Type I</option>
            <option value="Type Ia">Type Ia</option>
            <option value="Type II">Type II</option>
            <option value="Type III">Type III</option>
          </select>
        </div>

        {/* Time Step */}
        <div>
           <label htmlFor="time-step" className="block text-sm font-medium text-gray-700 mb-1">
            Time Step (minutes)
          </label>
          <input
            type="text"
            inputMode="numeric" // Use numeric for integer steps
            id="time-step"
            name="timeStep"
            value={inputs.timeStep}
            onChange={(e) => handleNumericChange('timeStep', e.target.value.replace(/[^0-9]/g, ''))} // Allow only digits
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            required
             min="1"
          />
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