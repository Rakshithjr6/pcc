require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Neometron API proxy endpoint - handles all configuration in backend
app.post('/api/neometron/drug-impact', async (req, res) => {
    try {
        const {
            temperature,
            humidity,
            exposureDuration,
            drugTypes,
            zoneId,
            sensitivityFactor
        } = req.body;

        // Configuration handled in backend - set to true for real API
        // In production, change this to 'true' to use actual Neometron API
        const useRealAPI = true; // Set to true for production with real API

        if (!useRealAPI) {
            // Mock mode - return simulated response
            const mockResponse = generateMockResponse({
                temperature,
                humidity,
                exposureDuration,
                drugTypes,
                zoneId,
                sensitivityFactor
            });
            return res.json(mockResponse);
        }

        // Real API call (production mode)
        const apiKey = process.env.NEOMETRON_API_KEY;
        const apiUrl = process.env.NEOMETRON_API_URL;

        if (!apiKey) {
            return res.status(500).json({ error: 'Neometron API key not configured in .env file' });
        }

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': apiKey
            },
            body: JSON.stringify({
                temperature,
                humidity,
                exposureDuration,
                drugTypes,
                zoneId,
                sensitivityFactor
            })
        });

        if (!response.ok) {
            throw new Error(`API Error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        res.json({
            ...data,
            apiMode: 'real',
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Neometron API Error:', error);
        res.status(500).json({ 
            error: 'Failed to call Neometron API',
            details: error.message 
        });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK',
        timestamp: new Date().toISOString(),
        neometronConfigured: !!process.env.NEOMETRON_API_KEY
    });
});

// Mock response generator
function generateMockResponse({ temperature, humidity, exposureDuration, drugTypes, zoneId, sensitivityFactor }) {
    // Calculate base impact score
    const tempDeviation = Math.max(0, Math.abs(temperature - 5) - 3);
    const humidityDeviation = Math.max(0, Math.abs(humidity - 50) - 10);
    const baseImpact = (tempDeviation * sensitivityFactor * 10) + (humidityDeviation * 2) + (exposureDuration / 60);
    
    // Add some randomness for realistic simulation
    const randomFactor = 0.8 + Math.random() * 0.4;
    const impactScore = Math.round(baseImpact * randomFactor);
    
    // Determine confidence level based on data quality
    const confidenceLevel = 0.7 + Math.random() * 0.3;
    
    // Generate affected drugs with impact levels
    const affectedDrugs = drugTypes.map(drug => {
        const drugImpact = Math.random();
        let impactLevel = 'LOW';
        let recommendation = 'SAFE';
        
        if (drugImpact > 0.7) {
            impactLevel = 'HIGH';
            recommendation = 'QUARANTINE';
        } else if (drugImpact > 0.4) {
            impactLevel = 'MODERATE';
            recommendation = 'MONITOR';
        }
        
        return {
            name: drug,
            impactLevel,
            recommendation,
            confidence: confidenceLevel
        };
    });
    
    // Generate analysis details
    const analysisDetails = {
        temperatureImpact: tempDeviation > 3 ? 'SEVERE' : tempDeviation > 1.5 ? 'MODERATE' : 'LOW',
        humidityImpact: humidityDeviation > 15 ? 'HIGH' : humidityDeviation > 8 ? 'MODERATE' : 'LOW',
        durationImpact: exposureDuration > 180 ? 'HIGH' : exposureDuration > 60 ? 'MODERATE' : 'LOW'
    };
    
    return {
        impactScore,
        confidenceLevel,
        affectedDrugs,
        analysisDetails,
        zoneId,
        timestamp: new Date().toISOString(),
        apiMode: 'mock'
    };
}

// Start server
app.listen(PORT, () => {
    console.log(`Neometron API Proxy Server running on port ${PORT}`);
    console.log(`Neometron API configured: ${!!process.env.NEOMETRON_API_KEY}`);
});
