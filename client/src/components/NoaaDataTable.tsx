import React from 'react';
import { NoaaReturnPeriodData } from '../types';

interface NoaaDataTableProps {
    noaaData: NoaaReturnPeriodData[] | null;
    isLoading: boolean;
    error: string | null;
    statusMessage: string;
    onSelectEvent: (depth: number, durationValue: number) => void; // Callback for selecting 6, 12, 24hr
}

const NoaaDataTable: React.FC<NoaaDataTableProps> = ({
    noaaData,
    isLoading,
    error,
    statusMessage,
    onSelectEvent
}) => {

    if (isLoading) {
        return <div className="mt-4 p-4 border rounded-lg shadow bg-gray-100 text-center text-gray-600">Loading NOAA data...</div>;
    }

    if (error) {
        return <div className="mt-4 p-4 border rounded-lg shadow bg-red-100 text-red-700 text-center">Error: {error}</div>;
    }

    if (!noaaData || noaaData.length === 0) {
        return <div className="mt-4 p-4 border rounded-lg shadow bg-gray-100 text-center text-gray-500 italic">{statusMessage || 'No NOAA data available.'}</div>;
    }

    // --- Prepare data for table ---

    // 1. Get all unique duration labels across all return periods for the header
    const allDurationLabels = Array.from(
        new Set(noaaData.flatMap(rp => rp.dataPoints.map(dp => dp.durationLabel)))
    );

    // 2. Sort duration labels logically (requires parsing them)
    const parseDurationLabel = (label: string): { value: number; unit: 'minutes' | 'hours' | 'days' } | null => {
        const parts = label.split('-');
        if (parts.length !== 2) return null;
        const value = parseInt(parts[0], 10);
        const unitStr = parts[1].toLowerCase();
        if (isNaN(value)) return null;
        if (unitStr === 'min') return { value, unit: 'minutes' };
        if (unitStr === 'hr') return { value, unit: 'hours' };
        if (unitStr === 'day') return { value, unit: 'days' };
        return null;
    };

    const getDurationInMinutes = (label: string): number => {
        const parsed = parseDurationLabel(label);
        if (!parsed) return Infinity; // Put unparseable labels last
        if (parsed.unit === 'minutes') return parsed.value;
        if (parsed.unit === 'hours') return parsed.value * 60;
        if (parsed.unit === 'days') return parsed.value * 60 * 24;
        return Infinity;
    };

    allDurationLabels.sort((a, b) => getDurationInMinutes(a) - getDurationInMinutes(b));


    // 3. Create a map for quick lookup: returnPeriod -> { durationLabel -> dataPoint }
    const dataMap = new Map<number, Map<string, { depth: number; durationValue: number; durationUnits: 'minutes' | 'hours' }>>();
    noaaData.forEach(rp => {
        const durationMap = new Map<string, { depth: number; durationValue: number; durationUnits: 'minutes' | 'hours' }>();
        rp.dataPoints.forEach(dp => {
            durationMap.set(dp.durationLabel, {
                depth: dp.depth,
                durationValue: dp.durationValue,
                durationUnits: dp.durationUnits
            });
        });
        dataMap.set(rp.returnPeriod, durationMap);
    });

    // --- Render Table ---
    return (
        <div className="mt-4 p-4 border rounded-lg shadow bg-white overflow-x-auto">
             <h3 className="text-lg font-semibold text-gray-700 mb-3">NOAA Atlas 14 Precipitation Frequency (inches)</h3>
            <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                    <tr>
                        <th scope="col" className="px-3 py-2 text-left font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-10">
                            ARI (yr)
                        </th>
                        {allDurationLabels.map(label => (
                            <th key={label} scope="col" className="px-3 py-2 text-right font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                                {label}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {noaaData.map(rpData => ( // Iterate through original data to maintain RP order
                        <tr key={rpData.returnPeriod} className="hover:bg-gray-50">
                            <td className="px-3 py-1.5 whitespace-nowrap font-medium text-gray-800 sticky left-0 bg-white hover:bg-gray-50 z-10">
                                {rpData.returnPeriod}-yr
                            </td>
                            {allDurationLabels.map(label => {
                                const pointData = dataMap.get(rpData.returnPeriod)?.get(label);
                                const isSelectable = pointData && pointData.durationUnits === 'hours' && [6, 12, 24].includes(pointData.durationValue);
                                const cellContent = pointData ? pointData.depth.toFixed(2) : '-';

                                return (
                                    <td key={label} className={`px-3 py-1.5 whitespace-nowrap text-right ${isSelectable ? 'font-semibold text-blue-600 cursor-pointer hover:bg-blue-100 hover:underline' : 'text-gray-600'}`}>
                                        {isSelectable ? (
                                            <span
                                                onClick={() => onSelectEvent(pointData.depth, pointData.durationValue)}
                                                title={`Select ${rpData.returnPeriod}-yr, ${label} event`}
                                                role="button"
                                                tabIndex={0} // Make it focusable
                                                onKeyDown={(e) => { // Allow selection with Enter/Space
                                                     if (e.key === 'Enter' || e.key === ' ') {
                                                        e.preventDefault(); // Prevent scrolling on Space
                                                        onSelectEvent(pointData.depth, pointData.durationValue);
                                                     }
                                                }}
                                            >
                                                {cellContent}
                                            </span>
                                        ) : (
                                            cellContent
                                        )}
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default NoaaDataTable; 