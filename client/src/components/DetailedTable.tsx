import React, { useState } from 'react';
import { CalculationResult, StormStep, StormInputParameters } from '../types';

interface DetailedTableProps {
    calculationResult: CalculationResult | null;
    stormInputs: StormInputParameters; // Use the full type from types.ts
}

// Helper to format time for table display
function formatTableTime(timeMinutes: number, totalDurationMinutes: number): string {
    if (totalDurationMinutes > 120) { // Use H:MM for durations > 2 hours
        const hours = Math.floor(timeMinutes / 60);
        const mins = Math.round(timeMinutes % 60);
        return `${hours}:${mins.toString().padStart(2, '0')}`;
    } else { // Use minutes (rounded)
        return String(Math.round(timeMinutes));
    }
}

// Helper function to generate SWMM .dat content (Simple H:MM format)
const generateSwmmDatContent = (result: CalculationResult, inputs: StormInputParameters): string => {
    const timeStepMinutes = inputs.timeStep ? parseFloat(String(inputs.timeStep)) : 6; // Default to 6 mins
    const totalDurationMinutes = result.intensityData.length * timeStepMinutes;

    // Header comment similar to example
    const depthUnit = inputs.depthUnits === 'us' ? 'in' : 'mm';
    let datContent = `;${inputs.stormType} ${inputs.duration}${inputs.durationUnits} ${inputs.totalDepth}-${depthUnit} GStorm Hyetograph\n`;

    let currentTotalMinutes = 0;

    for (let i = 0; i < result.intensityData.length; i++) {
        const hours = Math.floor(currentTotalMinutes / 60);
        const minutes = Math.round(currentTotalMinutes % 60);
        const timeString = `${hours}:${minutes.toString().padStart(2, '0')}`;
        const intensity = result.intensityData[i];

        // Format the line: H:MM Value
        datContent += `${timeString}  ${intensity.toFixed(4)}\n`; // Use 4 decimal places like example

        // Increment time
        currentTotalMinutes += timeStepMinutes;
    }

    // Add final line with total duration and 0 value
    const finalHours = Math.floor(totalDurationMinutes / 60);
    const finalMinutes = Math.round(totalDurationMinutes % 60);
    const finalTimeString = `${finalHours}:${finalMinutes.toString().padStart(2, '0')}`;
    datContent += `${finalTimeString}  0\n`;


    return datContent;
};

const DetailedTable: React.FC<DetailedTableProps> = ({ calculationResult, stormInputs }) => {
    const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');

    if (!calculationResult || !calculationResult.detailedData || calculationResult.detailedData.length === 0) {
        return <div className="mt-4 text-center text-gray-500 italic">No detailed data available.</div>;
    }

    const { detailedData, intensityUnit, depthUnit } = calculationResult;
    // Recalculate total duration based on the last step's end time
    const totalDurationMinutes = detailedData.length > 0 ? detailedData[detailedData.length - 1].timeEnd : 0;

    const handleCopyToClipboard = () => {
        if (!calculationResult) return;

        const headers = [
            `Time Start (${totalDurationMinutes > 120 ? 'H:MM' : 'min'})`,
            `Time End (${totalDurationMinutes > 120 ? 'H:MM' : 'min'})`,
            `Intensity (${intensityUnit})`,
            `Depth per Step (${depthUnit})`,
            `Cumulative Depth (${depthUnit})`
        ];
        const rows = detailedData.map(item => [
            formatTableTime(item.timeStart, totalDurationMinutes),
            formatTableTime(item.timeEnd, totalDurationMinutes),
            item.intensity.toFixed(5),
            item.depthStep.toFixed(5),
            item.cumulativeDepth.toFixed(5)
        ]);

        // Use correct escape sequences: \t for tab, \n for newline
        const tableString = [
            headers.join('\t'),
            ...rows.map(row => row.join('\t'))
        ].join('\n');

        navigator.clipboard.writeText(tableString).then(() => {
            setCopyStatus('copied');
            setTimeout(() => setCopyStatus('idle'), 2000); // Reset after 2 seconds
        }).catch(err => {
            console.error('Failed to copy table to clipboard:', err);
            setCopyStatus('failed');
            alert('Failed to copy table. Your browser might not support this feature or permissions were denied.');
            setTimeout(() => setCopyStatus('idle'), 3000);
        });
    };

    const handleDownloadCsv = () => {
         if (!calculationResult) return;

         const headers = [
            'Time_Start',
            'Time_End',
            `Intensity_(${intensityUnit.replace('/', '_per_')})`,
            `Depth_Step_(${depthUnit})`,
            `Cumulative_Depth_(${depthUnit})`
         ];
         const rows = detailedData.map(item => [
             formatTableTime(item.timeStart, totalDurationMinutes),
             formatTableTime(item.timeEnd, totalDurationMinutes),
             item.intensity.toFixed(5),
             item.depthStep.toFixed(5),
             item.cumulativeDepth.toFixed(5)
         ]);

        let csvContent = "data:text/csv;charset=utf-8,";
        // Use correct escape sequence \n for newline
        csvContent += headers.join(",") + "\n";
        rows.forEach(rowArray => {
            let row = rowArray.join(",");
            csvContent += row + "\n";
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);

        // Generate filename
        const stormType = stormInputs.stormType.replace(' ', '');
        const durationValue = String(stormInputs.duration).replace('.', '-');
        const durationUnitString = stormInputs.durationUnits === 'hours' ? 'hr' : 'min';
        const depthValue = String(stormInputs.totalDepth).replace('.', '-');
        const depthUnitString = stormInputs.depthUnits === 'us' ? 'in' : 'mm';
        const filename = `gstorm_hyetograph_${stormType}_${durationValue}${durationUnitString}_${depthValue}${depthUnitString}.csv`;

        link.setAttribute("download", filename);
        document.body.appendChild(link); // Required for Firefox
        link.click();
        document.body.removeChild(link);
    };

    const handleDownloadDat = () => {
        const datString = generateSwmmDatContent(calculationResult, stormInputs);
        const blob = new Blob([datString], { type: 'text/plain;charset=utf-8' });

        // Generate filename
        const depthUnit = stormInputs.depthUnits === 'us' ? 'in' : 'mm';
        const filename = `GStorm_Hyetograph_${stormInputs.stormType}_${stormInputs.totalDepth}${depthUnit}_${stormInputs.duration}${stormInputs.durationUnits}.dat`;

        // Create a link and trigger download
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link); // Required for Firefox
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href); // Clean up
    };

    return (
        <div className="mt-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Detailed Hyetograph Data</h3>
            <div className="flex space-x-2 mb-3">
                <button
                    onClick={handleCopyToClipboard}
                    className={`px-3 py-1 text-sm rounded border transition duration-150 ease-in-out
                        ${copyStatus === 'idle' ? 'bg-gray-200 hover:bg-gray-300 border-gray-300 text-gray-700' : ''}
                        ${copyStatus === 'copied' ? 'bg-green-500 hover:bg-green-600 border-green-600 text-white' : ''}
                        ${copyStatus === 'failed' ? 'bg-red-500 hover:bg-red-600 border-red-600 text-white' : ''}`}
                >
                    {copyStatus === 'copied' ? 'Copied!' : copyStatus === 'failed' ? 'Failed!' : 'Copy Table'}
                </button>
                <button
                    onClick={handleDownloadCsv}
                    className="px-3 py-1 text-sm rounded border bg-blue-500 hover:bg-blue-600 border-blue-600 text-white transition duration-150 ease-in-out"
                >
                    Download CSV
                </button>
                <button
                    onClick={handleDownloadDat}
                    className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 transition duration-150 ease-in-out shadow-sm"
                >
                    Download SWMM .dat
                </button>
            </div>
            {/* Table Container with Scrolling */}
            <div className="overflow-x-auto border border-gray-300 rounded-md max-h-[500px]">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-100 sticky top-0 z-10">
                        <tr>
                            <th scope="col" className="px-3 py-2 text-center font-medium text-gray-600 uppercase tracking-wider">
                                Time Start ({totalDurationMinutes > 120 ? 'H:MM' : 'min'})
                            </th>
                            <th scope="col" className="px-3 py-2 text-center font-medium text-gray-600 uppercase tracking-wider">
                                Time End ({totalDurationMinutes > 120 ? 'H:MM' : 'min'})
                            </th>
                            <th scope="col" className="px-3 py-2 text-right font-medium text-gray-600 uppercase tracking-wider">
                                Intensity ({intensityUnit})
                            </th>
                            <th scope="col" className="px-3 py-2 text-right font-medium text-gray-600 uppercase tracking-wider">
                                Depth/Step ({depthUnit})
                            </th>
                            <th scope="col" className="px-3 py-2 text-right font-medium text-gray-600 uppercase tracking-wider">
                                Cum. Depth ({depthUnit})
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {detailedData.map((item, index) => (
                            <tr key={index} className="hover:bg-gray-50">
                                <td className="px-3 py-1.5 whitespace-nowrap text-center text-gray-700">
                                    {formatTableTime(item.timeStart, totalDurationMinutes)}
                                </td>
                                <td className="px-3 py-1.5 whitespace-nowrap text-center text-gray-700">
                                    {formatTableTime(item.timeEnd, totalDurationMinutes)}
                                </td>
                                <td className="px-3 py-1.5 whitespace-nowrap text-right text-gray-700 font-mono">
                                    {item.intensity.toFixed(5)}
                                </td>
                                <td className="px-3 py-1.5 whitespace-nowrap text-right text-gray-700 font-mono">
                                    {item.depthStep.toFixed(5)}
                                </td>
                                <td className="px-3 py-1.5 whitespace-nowrap text-right text-gray-700 font-mono">
                                    {item.cumulativeDepth.toFixed(5)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default DetailedTable; 