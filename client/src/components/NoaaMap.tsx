import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import L, { LatLngExpression } from 'leaflet';

// Fix Leaflet's default icon path issue with bundlers like Vite/Webpack
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;

L.Icon.Default.mergeOptions({
    iconRetinaUrl: iconRetinaUrl,
    iconUrl: iconUrl,
    shadowUrl: shadowUrl,
});
// End icon fix

interface NoaaMapProps {
    initialCenter?: LatLngExpression;
    initialZoom?: number;
    selectedLatLon: L.LatLng | null;
    onMapClick: (latlng: L.LatLng) => void;
    statusMessage: string;
}

// Component to handle map click events
function MapClickHandler({ onMapClick }: { onMapClick: (latlng: L.LatLng) => void }) {
    useMapEvents({
        click(e) {
            onMapClick(e.latlng);
        },
    });
    return null;
}

// Child component to get map instance and handle effects
interface MapEffectProps {
    selectedLatLon: L.LatLng | null;
}
function MapEffects({ selectedLatLon }: MapEffectProps) {
    const map = useMap();

    // Invalidate size effect
    useEffect(() => {
        const timer = setTimeout(() => {
            map.invalidateSize();
        }, 100);
        return () => clearTimeout(timer);
    }, [map]);

    // Fly to selected location effect
     useEffect(() => {
        if (selectedLatLon) {
            map.flyTo(selectedLatLon, map.getZoom());
        }
    }, [selectedLatLon, map]);

    return null; // This component does not render anything visual
}

const NoaaMap: React.FC<NoaaMapProps> = ({ initialCenter = [39.8283, -98.5795], initialZoom = 4, selectedLatLon, onMapClick, statusMessage }) => {

    return (
        <div className="mb-4">
            <p className="text-sm text-gray-600 mb-2">{statusMessage}</p>
            <div id="noaa-map-container" className="h-[350px] w-full border border-gray-300 rounded z-0">
                <MapContainer
                    center={initialCenter}
                    zoom={initialZoom}
                    scrollWheelZoom={true}
                    style={{ height: '100%', width: '100%' }}
                    // Remove whenReady/whenCreated
                >
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <MapClickHandler onMapClick={onMapClick} />
                    {/* Use the new MapEffects component */}
                    <MapEffects selectedLatLon={selectedLatLon} />
                    {selectedLatLon && (
                        <Marker position={selectedLatLon}>
                            <Popup>
                                Lat: {selectedLatLon.lat.toFixed(4)}<br />Lon: {selectedLatLon.lng.toFixed(4)}
                            </Popup>
                        </Marker>
                    )}
                </MapContainer>
            </div>
        </div>
    );
};

export default NoaaMap; 