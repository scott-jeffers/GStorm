const axios = require('axios');

exports.handler = async (event, context) => {
    // CORS Headers - Adjust origin as needed for local development or specific domains
    const headers = {
        'Access-Control-Allow-Origin': '*', // Or specify your frontend domain: 'https://your-netlify-site.netlify.app'
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
    };

    // Handle CORS preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 204,
            headers,
            body: ''
        };
    }

    // Only allow GET requests
    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method Not Allowed' })
        };
    }

    const { lat, lon } = event.queryStringParameters;

    if (!lat || !lon) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Latitude and Longitude are required query parameters.' })
        };
    }

    // Validate coordinates
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lon);
    if (isNaN(latitude) || isNaN(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Invalid Latitude or Longitude values.' })
        };
    }

    const noaaUrl = `https://hdsc.nws.noaa.gov/cgi-bin/hdsc/new/fe_text_mean.csv?lat=${latitude}&lon=${longitude}&data=depth&units=english&series=pds`;

    console.log(`Fetching NOAA data from: ${noaaUrl}`);

    try {
        const response = await axios.get(noaaUrl, {
            timeout: 15000, // 15 seconds timeout
            headers: {
                'User-Agent': 'GStorm-WebApp/1.0 (Netlify Function Proxy)'
            }
        });

        if (response.status === 200 && response.data && typeof response.data === 'string') {
            if (response.data.includes('Error') || response.data.includes('An error occurred') || response.data.trim() === '') {
                console.warn(`NOAA server returned an error or empty data for lat=${latitude}, lon=${longitude}`);
                let errorBody = JSON.stringify({ error: 'Received an error response or empty data from NOAA server.' });
                let statusCode = 502;
                if (response.data.toLowerCase().includes('no data available')) {
                    errorBody = JSON.stringify({ error: 'No NOAA data available for the selected location.' });
                    statusCode = 404;
                }
                return {
                    statusCode,
                    headers: { ...headers, 'Content-Type': 'application/json' },
                    body: errorBody
                };
            }
            // Send the CSV data directly to the frontend
            return {
                statusCode: 200,
                headers: { ...headers, 'Content-Type': 'text/csv' },
                body: response.data
            };
        } else {
            console.error(`Unexpected response from NOAA: Status=${response.status}, Data type=${typeof response.data}`);
            return {
                statusCode: response.status || 500,
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'Unexpected response received from NOAA server.' })
            };
        }
    } catch (error) {
        console.error('Error fetching or processing NOAA data:', error.message);
        let errorBody = JSON.stringify({ error: 'Failed to fetch data from NOAA server.' });
        let statusCode = 500;

        if (error.code === 'ECONNABORTED') {
            errorBody = JSON.stringify({ error: 'Request to NOAA server timed out.' });
            statusCode = 504; // Gateway Timeout
        } else if (error.response) {
            errorBody = JSON.stringify({ error: `NOAA server responded with status ${error.response.status}.` });
            statusCode = error.response.status;
        } else if (error.request) {
            errorBody = JSON.stringify({ error: 'Could not connect to NOAA server. Please try again later.' });
            statusCode = 503; // Service Unavailable
        }

        return {
            statusCode,
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: errorBody
        };
    }
}; 