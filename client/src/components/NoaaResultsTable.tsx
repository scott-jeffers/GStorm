import React from 'react';
import { NoaaState } from '../types';

interface NoaaResultsTableProps {
    noaaState: NoaaState;
    onApplyData: (depth: number, durationValue: number, durationUnits: 'hours' | 'minutes') => void;
}

const NoaaResultsTable: React.FC<NoaaResultsTableProps> = ({ noaaState, onApplyData }) => {
    const { data, isLoading, error } = noaaState;

    if (isLoading) {
        // Already shown in parent, but could add a specific table loading state
        return null;
    }

    if (error && !data) {
        // Error already shown in parent
        return null;
    }

    if (!data || data.length === 0) {
        // Only show if not loading and no error message displayed
        return !isLoading && !error ? <p className="text-sm text-gray-500 mt-2">No NOAA data loaded for the selected location.</p> : null;
    }

    // Get all unique duration labels present in the fetched data in the desired order
    const allDurationLabels = data.reduce((acc, rpData) => {
        rpData.dataPoints.forEach(dp => {
            if (!acc.includes(dp.durationLabel)) {
                acc.push(dp.durationLabel);
            }
        });
        return acc;
    }, [] as string[]);

    // Filter and Sort duration labels based on a predefined order for consistent columns
    const allowedDurations = ["6-hr", "12-hr", "24-hr"];
    const displayDurationLabels = allDurationLabels
        .filter(label => allowedDurations.includes(label))
        .sort((a, b) => {
            const indexA = allowedDurations.indexOf(a);
            const indexB = allowedDurations.indexOf(b);
            return indexA - indexB;
     });

    return (
        <div className="mt-4 overflow-x-auto border border-gray-300 rounded-md max-h-[400px]">
            <table className="min-w-full divide-y divide-gray-200 text-xs">
                <thead className="bg-gray-100 sticky top-0 z-10">
                    <tr>
                        <th scope="col" className="px-2 py-1.5 text-left font-medium text-gray-600 uppercase tracking-wider">
                            Return Period (yr)
                        </th>
                        {displayDurationLabels.map(label => (
                            <th key={label} scope="col" className="px-2 py-1.5 text-center font-medium text-gray-600 uppercase tracking-wider">
                                {label} Depth (in)
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {data.map(rpData => (
                        <tr key={rpData.returnPeriod} className="hover:bg-gray-50">
                            <td className="px-2 py-1 whitespace-nowrap font-medium text-gray-800">
                                {rpData.returnPeriod}-yr
                            </td>
                            {displayDurationLabels.map(label => {
                                const dataPoint = rpData.dataPoints.find(dp => dp.durationLabel === label);
                                // Extract numeric duration for onApplyData
                                const durationValue = parseInt(label.replace('-hr',''), 10);
                                return (
                                    <td key={`${rpData.returnPeriod}-${label}`} className="px-2 py-1 whitespace-nowrap text-center text-gray-700">
                                        {dataPoint ? (
                                            <button
                                                onClick={() => onApplyData(dataPoint.depth, durationValue, dataPoint.durationUnits)}
                                                className="px-1.5 py-0.5 text-xs bg-green-600 hover:bg-green-700 text-white rounded transition duration-150 ease-in-out shadow-sm"
                                                title={`Apply ${dataPoint.depth.toFixed(3)}" for ${label} duration`}
                                            >
                                                {dataPoint.depth.toFixed(3)}
                                            </button>
                                        ) : (
                                            <span className="text-gray-400">-</span>
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

export default NoaaResultsTable; 