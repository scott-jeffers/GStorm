import React from 'react';
import { CalculationResult } from '../types';

interface SummaryTableProps {
    calculationResult: CalculationResult | null;
}

const SummaryTable: React.FC<SummaryTableProps> = ({ calculationResult }) => {
    if (!calculationResult) {
        return null; // Don't render anything if no results
    }

    const { totalDepthActual, peakIntensity, depthUnit, intensityUnit } = calculationResult;

    return (
        <div className="overflow-x-auto mt-4">
            <table className="min-w-full divide-y divide-gray-200 border border-gray-300">
                <thead className="bg-gray-100">
                    <tr>
                        <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider w-2/5">
                            Parameter
                        </th>
                        <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                            Value
                        </th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    <tr>
                        <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-800">
                            Total Calculated Depth
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600">
                            {totalDepthActual.toFixed(3)} {depthUnit}
                        </td>
                    </tr>
                    <tr>
                        <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-800">
                            Peak Rainfall Intensity
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600">
                            {peakIntensity.toFixed(3)} {intensityUnit}
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
};

export default SummaryTable; 