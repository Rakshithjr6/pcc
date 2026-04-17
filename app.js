// Pharmaceutical Cold Chain Monitoring System
class ColdChainMonitor {
    constructor() {
        this.currentTemp = 5.0; // Start in safe range
        this.currentHumidity = 50.0; // Start in safe range
        this.isMonitoring = false;
        this.alerts = [];
        this.criticalAlerts = []; // Separate array for critical alerts only
        this.tempHistory = [];
        this.humidityHistory = [];
        this.maxHistoryPoints = 2000; // Increased for historical data
        this.safeRange = { min: 2, max: 8 };
        this.humiditySafeRange = { min: 40, max: 60 };
        this.humidityWarningRange = { min: 35, max: 65 }; // Warning zone outside safe range
        this.updateInterval = null;
        this.uptimeInterval = null;
        this.startTime = Date.now();
        this.lastAlertTime = 0;
        this.lastHumidityAlertTime = 0;
        this.chart = null;
        this.trend = 0; // Current temperature trend
        this.previousTemp = 5.0;
        this.previousHumidity = 50.0;
        this.abnormalChangeThreshold = 2.5; // °Celsius change per 1.5 seconds
        this.abnormalHumidityChangeThreshold = 10; // % change per 1.5 seconds
        
        // Doors state tracking (combined door/window)
        this.doorsOpen = false;
        this.doorChangeInterval = null;
        
        // ML Dashboard components
        this.anomalyScores = [];
        this.anomalyChart = null;
        this.breachTimeline = [];
        this.evaluationMetrics = {
            recall: 0,
            precision: 0,
            falseAlarmRate: 0,
            f1Score: 0
        };
        
        // Zone-Based Drug Impact Analysis
        this.zones = this.initializeZones();
        this.sensorZoneMap = this.initializeSensorZoneMap();
        this.zoneImpactScores = new Map(); // zone_id -> impact_score
        this.impactLogs = [];
        this.currentSensorId = 'unit-001'; // Default sensor ID
        this.sensorRotationInterval = null;
        
        // Neometron API Integration - Configuration handled in backend
        this.neometronConfig = {
            mode: 'mock', // Default to mock mode
            enabled: true  // Always enabled - no UI control needed
        };
        this.apiResults = new Map(); // Cache API results
        this.apiCache = new Map(); // Response cache
        this.apiStatus = 'disconnected';
        
        this.init();
    }

    init() {
        this.generateHistoricalData();
        this.setupChart();
        this.setupAnomalyChart();
        this.bindEvents();
        this.updateDisplay();
        this.startUptimeCounter();
        this.startSensorRotation();
        this.initializeAllZonesWithAPI();
        lucide.createIcons();
    }

    // Zone-Based Drug Impact Analysis Methods
    initializeZones() {
        return [
            // Zone 1: Highly sensitive vaccines
            {
                zoneId: 1,
                zoneName: 'Critical Vaccines',
                drugs: ['mRNA Vaccine', 'COVID-19 Vaccine', 'Influenza Vaccine', 'Hepatitis B Vaccine', 'MMR Vaccine'],
                tempRange: { min: 2, max: 8 },
                sensitivityFactor: 1.5,
                description: 'Highly sensitive biological products requiring strict temperature control'
            },
            // Zone 2: Insulin products
            {
                zoneId: 2,
                zoneName: 'Insulin Products',
                drugs: ['Rapid-acting Insulin', 'Long-acting Insulin', 'Insulin Pens', 'Insulin Pumps'],
                tempRange: { min: 2, max: 8 },
                sensitivityFactor: 1.4,
                description: 'Temperature-sensitive insulin formulations'
            },
            // Zone 3: Antibiotics
            {
                zoneId: 3,
                zoneName: 'Antibiotics',
                drugs: ['Amoxicillin', 'Penicillin', 'Cephalexin', 'Doxycycline', 'Azithromycin'],
                tempRange: { min: 2, max: 8 },
                sensitivityFactor: 1.2,
                description: 'Broad-spectrum antibiotics requiring refrigeration'
            },
            // Zone 4: Biologics
            {
                zoneId: 4,
                zoneName: 'Biologics',
                drugs: ['Monoclonal Antibodies', 'Blood Products', 'Enzymes', 'Hormones'],
                tempRange: { min: 2, max: 8 },
                sensitivityFactor: 1.3,
                description: 'Complex biological molecules with temperature sensitivity'
            },
            // Zone 5: Moderate stability drugs
            {
                zoneId: 5,
                zoneName: 'Moderate Stability',
                drugs: ['Antihistamines', 'Antacids', 'Vitamin Supplements', 'NSAIDs'],
                tempRange: { min: 2, max: 8 },
                sensitivityFactor: 1.0,
                description: 'Drugs with moderate temperature stability requirements'
            },
            // Zone 6: Cardiovascular drugs
            {
                zoneId: 6,
                zoneName: 'Cardiovascular',
                drugs: ['Beta Blockers', 'ACE Inhibitors', 'Statins', 'Anticoagulants'],
                tempRange: { min: 2, max: 8 },
                sensitivityFactor: 1.1,
                description: 'Cardiovascular medications requiring controlled storage'
            },
            // Zone 7: Oncology drugs
            {
                zoneId: 7,
                zoneName: 'Oncology',
                drugs: ['Chemotherapy Agents', 'Targeted Therapy', 'Immunotherapy Drugs'],
                tempRange: { min: 2, max: 8 },
                sensitivityFactor: 1.4,
                description: 'Specialized cancer treatments with high sensitivity'
            },
            // Zone 8: Pediatric medications
            {
                zoneId: 8,
                zoneName: 'Pediatric',
                drugs: ['Pediatric Antibiotics', 'Vitamin D Drops', 'Pediatric Vaccines'],
                tempRange: { min: 2, max: 8 },
                sensitivityFactor: 1.3,
                description: 'Medications specifically for pediatric patients'
            },
            // Zone 9: Emergency medications
            {
                zoneId: 9,
                zoneName: 'Emergency',
                drugs: ['Epinephrine', 'Naloxone', 'Emergency Antidotes', 'Resuscitation Drugs'],
                tempRange: { min: 2, max: 8 },
                sensitivityFactor: 1.2,
                description: 'Life-saving emergency medications'
            },
            // Zone 10: Low sensitivity drugs
            {
                zoneId: 10,
                zoneName: 'Low Sensitivity',
                drugs: ['Tablets', 'Capsules', 'Topical Creams', 'Medical Supplies'],
                tempRange: { min: 2, max: 8 },
                sensitivityFactor: 0.5,
                description: 'Products with lower temperature sensitivity'
            }
        ];
    }

    initializeSensorZoneMap() {
        return new Map([
            ['unit-001', 1],  // Default sensor maps to Zone 1 (Critical Vaccines)
            ['unit-002', 2],  // Sensor 2 maps to Zone 2 (Insulin)
            ['unit-003', 3],  // Sensor 3 maps to Zone 3 (Antibiotics)
            ['unit-004', 4],  // Sensor 4 maps to Zone 4 (Biologics)
            ['unit-005', 5],  // Sensor 5 maps to Zone 5 (Moderate Stability)
            ['unit-006', 6],  // Sensor 6 maps to Zone 6 (Cardiovascular)
            ['unit-007', 7],  // Sensor 7 maps to Zone 7 (Oncology)
            ['unit-008', 8],  // Sensor 8 maps to Zone 8 (Pediatric)
            ['unit-009', 9],  // Sensor 9 maps to Zone 9 (Emergency)
            ['unit-010', 10]  // Sensor 10 maps to Zone 10 (Low Sensitivity)
        ]);
    }

    setupAnomalyChart() {
        const ctx = document.getElementById('anomalyChart').getContext('2d');
        
        // Create gradient background for zones
        const gradient = ctx.createLinearGradient(0, 0, 0, 250);
        gradient.addColorStop(0, 'rgba(239, 68, 68, 0.1)');     // Critical zone (top)
        gradient.addColorStop(0.4, 'rgba(239, 68, 68, 0.05)');   // Critical zone boundary
        gradient.addColorStop(0.4, 'rgba(245, 158, 11, 0.05)');  // Warning zone start
        gradient.addColorStop(0.6, 'rgba(245, 158, 11, 0.05)');  // Warning zone end
        gradient.addColorStop(0.6, 'rgba(34, 197, 94, 0.05)');   // Normal zone start
        gradient.addColorStop(1, 'rgba(34, 197, 94, 0.05)');     // Normal zone (bottom)
        
        this.anomalyChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Anomaly Score',
                        data: [],
                        borderColor: 'rgb(59, 130, 246)',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        tension: 0.4,
                        fill: false,
                        borderWidth: 2,
                        pointRadius: 1,
                        pointHoverRadius: 4
                    },
                    {
                        label: 'Critical Threshold',
                        data: [],
                        borderColor: 'rgb(239, 68, 68)',
                        backgroundColor: 'transparent',
                        borderDash: [5, 5],
                        borderWidth: 2,
                        pointRadius: 0,
                        fill: false
                    },
                    {
                        label: 'Warning Threshold',
                        data: [],
                        borderColor: 'rgb(245, 158, 11)',
                        backgroundColor: 'transparent',
                        borderDash: [5, 5],
                        borderWidth: 2,
                        pointRadius: 0,
                        fill: false
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            usePointStyle: true,
                            padding: 10,
                            font: {
                                size: 11
                            }
                        }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: function(context) {
                                if (context.dataset.label.includes('Threshold')) {
                                    return context.dataset.label + ': ' + (context.parsed.y * 100).toFixed(0) + '%';
                                }
                                return 'Anomaly Score: ' + (context.parsed.y * 100).toFixed(1) + '%';
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        display: false
                    },
                    y: {
                        min: 0,
                        max: 1,
                        ticks: {
                            callback: function(value) {
                                return (value * 100).toFixed(0) + '%';
                            },
                            stepSize: 0.2
                        },
                        grid: {
                            color: function(context) {
                                if (context.tick.value === 0.4 || context.tick.value === 0.6) {
                                    return 'rgba(156, 163, 175, 0.3)';
                                }
                                return 'rgba(156, 163, 175, 0.1)';
                            }
                        }
                    }
                },
                interaction: {
                    mode: 'nearest',
                    axis: 'x',
                    intersect: false
                }
            }
        });
    }

    // Generate 3 weeks of historical data
    generateHistoricalData() {
        const now = new Date();
        const threeWeeksAgo = new Date(now.getTime() - (21 * 24 * 60 * 60 * 1000));
        
        let currentTime = new Date(threeWeeksAgo);
        let temp = 5.0;
        let humidity = 50.0;
        let alertId = 1;
        
        // Generate data points every 30 minutes for 3 weeks
        while (currentTime < now) {
            // Simulate realistic temperature variations
            const hourOfDay = currentTime.getHours();
            const dayOfWeek = currentTime.getDay();
            
            // Base temperature with daily cycles
            let baseTemp = 5.0;
            if (hourOfDay >= 6 && hourOfDay <= 18) {
                baseTemp += 1.5; // Warmer during day
            } else {
                baseTemp -= 1.0; // Cooler at night
            }
            
            // Add some randomness and trends
            const randomInfluence = (Math.random() - 0.5) * 2;
            const trendInfluence = Math.sin(currentTime.getTime() / (7 * 24 * 60 * 60 * 1000)) * 0.5;
            
            temp = baseTemp + randomInfluence + trendInfluence;
            
            // Simulate occasional breaches (about 5% of the time)
            if (Math.random() < 0.05) {
                if (Math.random() < 0.5) {
                    temp = this.safeRange.min - Math.random() * 3;
                } else {
                    temp = this.safeRange.max + Math.random() * 3;
                }
                
                // Create alert for this breach
                const alert = {
                    id: alertId++,
                    temperature: temp,
                    humidity: humidity,
                    timestamp: new Date(currentTime),
                    status: 'CRITICAL',
                    sensorType: 'temperature',
                    type: 'HISTORICAL_BREACH'
                };
                this.alerts.push(alert);
                this.criticalAlerts.push(alert);
            }
            
            // Keep within bounds
            temp = Math.max(-5, Math.min(15, temp));
            
            // Humidity simulation
            let baseHumidity = 50.0;
            if (hourOfDay >= 12 && hourOfDay <= 16) {
                baseHumidity += 5; // Higher humidity in afternoon
            }
            
            const humidityRandom = (Math.random() - 0.5) * 10;
            humidity = baseHumidity + humidityRandom;
            humidity = Math.max(30, Math.min(70, humidity));
            
            // Calculate anomaly score (simplified simulation)
            const anomalyScore = this.calculateAnomalyScore(temp, humidity);
            
            // Store data point
            this.tempHistory.push({
                temp: temp,
                humidity: humidity,
                timestamp: new Date(currentTime)
            });
            
            this.humidityHistory.push({
                humidity: humidity,
                timestamp: new Date(currentTime)
            });
            
            // Store anomaly score
            this.anomalyScores.push({
                score: anomalyScore,
                timestamp: new Date(currentTime)
            });
            
            // Move to next time point (30 minutes later)
            currentTime = new Date(currentTime.getTime() + 30 * 60 * 1000);
        }
        
        // Set current values to the most recent
        if (this.tempHistory.length > 0) {
            const lastPoint = this.tempHistory[this.tempHistory.length - 1];
            this.currentTemp = lastPoint.temp;
            this.currentHumidity = lastPoint.humidity;
        }
        
        console.log(`Generated ${this.tempHistory.length} historical data points`);
        console.log(`Created ${this.alerts.length} historical alerts`);
        
        // Update historical status display
        const historicalStatus = document.getElementById('historicalStatus');
        if (historicalStatus) {
            historicalStatus.textContent = `Historical: ${this.tempHistory.length} readings, ${this.alerts.length} alerts`;
        }
        
        // Update alert history display
        this.updateAlertHistory();
        
        // Update chart with historical data
        this.updateChart();
        this.updateAnomalyChart();
        this.updateMlDashboard();
        this.updateBreachTimeline();
        
        // Initialize zone impact dashboard with historical data
        this.initializeZoneImpactFromHistory();
    }

    calculateAnomalyScore(temp, humidity) {
        // Simplified anomaly score calculation
        let score = 0;
        
        // Temperature anomaly
        if (temp < this.safeRange.min || temp > this.safeRange.max) {
            const deviation = Math.max(this.safeRange.min - temp, temp - this.safeRange.max);
            score += Math.min(deviation / 10, 0.5); // Max 0.5 from temperature
        }
        
        // Humidity anomaly
        if (humidity < this.humiditySafeRange.min || humidity > this.humiditySafeRange.max) {
            const deviation = Math.max(this.humiditySafeRange.min - humidity, humidity - this.humiditySafeRange.max);
            score += Math.min(deviation / 20, 0.3); // Max 0.3 from humidity
        }
        
        // Add some randomness for realistic simulation
        score += Math.random() * 0.2;
        
        return Math.min(score, 1.0);
    }

    updateAnomalyChart() {
        if (!this.anomalyChart) return;
        
        // Show only the most recent 50 anomaly scores
        const recentScores = this.anomalyScores.slice(-50);
        const labels = recentScores.map(point => 
            point.timestamp.toLocaleTimeString()
        );
        const scores = recentScores.map(point => point.score);
        
        // Create threshold lines
        const criticalThreshold = new Array(scores.length).fill(0.6);
        const warningThreshold = new Array(scores.length).fill(0.4);
        
        this.anomalyChart.data.labels = labels;
        this.anomalyChart.data.datasets[0].data = scores;
        this.anomalyChart.data.datasets[1].data = criticalThreshold;
        this.anomalyChart.data.datasets[2].data = warningThreshold;
        this.anomalyChart.update('none');
    }

    updateMlDashboard() {
        // Update evaluation metrics with simulated values
        this.evaluationMetrics = {
            recall: 85 + Math.random() * 10, // 85-95%
            precision: 90 + Math.random() * 8, // 90-98%
            falseAlarmRate: Math.random() * 5, // 0-5 per 1000
            f1Score: 82 + Math.random() * 13 // 82-95%
        };
        
        // Update metric displays
        document.getElementById('metricRecall').textContent = this.evaluationMetrics.recall.toFixed(1) + '%';
        document.getElementById('metricPrecision').textContent = this.evaluationMetrics.precision.toFixed(1) + '%';
        document.getElementById('metricFalseAlarm').textContent = this.evaluationMetrics.falseAlarmRate.toFixed(1) + '/1000';
        document.getElementById('metricF1').textContent = this.evaluationMetrics.f1Score.toFixed(1) + '%';
        document.getElementById('metricWindowSize').textContent = this.tempHistory.length;
        
        // Update alert panel
        this.updateAlertPanel();
    }

    updateAlertPanel() {
        const alertPanel = document.getElementById('alertPanel');
        const unackedCount = document.getElementById('unackedAlertCount');
        
        // Get recent critical alerts
        const recentAlerts = this.alerts.filter(a => a.status === 'CRITICAL').slice(-5);
        
        if (recentAlerts.length === 0) {
            alertPanel.innerHTML = '<p class="text-gray-500 text-center py-4">No active alerts</p>';
            unackedCount.textContent = '0';
            return;
        }
        
        unackedCount.textContent = recentAlerts.length;
        
        alertPanel.innerHTML = recentAlerts.map(alert => {
            const severity = alert.temperature < (this.safeRange.min - 1) || alert.temperature > (this.safeRange.max + 1) ? 'Critical' : 'Warning';
            const severityColor = severity === 'Critical' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800';
            
            return `
                <div class="border-l-4 border-red-500 bg-red-50 p-3 rounded">
                    <div class="flex justify-between items-start">
                        <div>
                            <p class="font-semibold text-red-800">${severity} Temperature Alert</p>
                            <p class="text-sm text-red-600">${alert.temperature.toFixed(1)}°C at ${alert.timestamp.toLocaleTimeString()}</p>
                        </div>
                        <span class="px-2 py-1 text-xs font-semibold rounded-full ${severityColor}">${severity}</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    updateBreachTimeline() {
        const breachTimeline = document.getElementById('breachTimeline');
        
        // Get recent breaches from alerts
        const recentBreaches = this.alerts.filter(a => a.status === 'CRITICAL').slice(-10);
        
        if (recentBreaches.length === 0) {
            breachTimeline.innerHTML = '<p class="text-gray-500 text-center py-4">No breaches recorded</p>';
            return;
        }
        
        breachTimeline.innerHTML = recentBreaches.map(breach => {
            const breachType = breach.temperature < this.safeRange.min ? 'Low Temp' : 'High Temp';
            const breachColor = breach.temperature < (this.safeRange.min - 1) || breach.temperature > (this.safeRange.max + 1) ? 'bg-red-100' : 'bg-yellow-100';
            
            return `
                <div class="flex items-center space-x-3 p-2 rounded ${breachColor}">
                    <div class="flex-shrink-0">
                        <i data-lucide="alert-triangle" class="w-4 h-4 text-red-500"></i>
                    </div>
                    <div class="flex-1">
                        <p class="text-sm font-medium text-gray-900">${breachType} Breach</p>
                        <p class="text-xs text-gray-500">${breach.timestamp.toLocaleDateString()} ${breach.timestamp.toLocaleTimeString()}</p>
                    </div>
                    <div class="text-right">
                        <p class="text-sm font-semibold text-red-600">${breach.temperature.toFixed(1)}°C</p>
                    </div>
                </div>
            `;
        }).join('');
        
        // Re-create icons
        lucide.createIcons();
    }

    // Zone-Based Drug Impact Analysis Methods
    calculateExposure(temperature, duration) {
        // Calculate magnitude of deviation from safe range
        let magnitude = 0;
        if (temperature < this.safeRange.min) {
            magnitude = this.safeRange.min - temperature;
        } else if (temperature > this.safeRange.max) {
            magnitude = temperature - this.safeRange.max;
        }
        
        // Exposure = Magnitude × Duration (in minutes)
        const exposure = magnitude * (duration / 60000); // Convert duration from ms to minutes
        return exposure;
    }

    calculateImpactScore(zoneId, exposure, anomalyScore) {
        const zone = this.zones.find(z => z.zoneId === zoneId);
        if (!zone) return 0;
        
        // Impact Score = Exposure × Sensitivity Factor
        const baseImpact = exposure * zone.sensitivityFactor;
        
        // Add anomaly score influence (0-1 scale)
        const anomalyInfluence = anomalyScore * 10; // Scale anomaly score to 0-10
        
        return baseImpact + anomalyInfluence;
    }

    processZoneImpact(temperature, anomalyScore, timestamp) {
        // Get zone ID from sensor mapping
        const zoneId = this.sensorZoneMap.get(this.currentSensorId) || 1;
        
        // Calculate duration since last anomaly (simplified - use 2 minutes for demo)
        const duration = 2 * 60 * 1000; // 2 minutes in milliseconds
        
        // Calculate exposure and impact
        const exposure = this.calculateExposure(temperature, duration);
        const impactScore = this.calculateImpactScore(zoneId, exposure, anomalyScore);
        
        // Update zone impact score
        this.zoneImpactScores.set(zoneId, impactScore);
        
        // Generate quarantine recommendation
        const recommendation = this.generateQuarantineRecommendation(impactScore);
        
        // Log impact
        const impactLog = {
            zoneId,
            zoneName: this.zones.find(z => z.zoneId === zoneId)?.zoneName,
            impactScore,
            exposure,
            temperature,
            anomalyScore,
            timestamp,
            recommendation,
            sensitivityFactor: this.zones.find(z => z.zoneId === zoneId)?.sensitivityFactor
        };
        
        this.impactLogs.unshift(impactLog);
        
        // Keep only recent logs
        if (this.impactLogs.length > 100) {
            this.impactLogs = this.impactLogs.slice(0, 100);
        }
        
        return impactLog;
    }

    generateQuarantineRecommendation(impactScore) {
        if (impactScore > 35) {
            return {
                label: 'QUARANTINE',
                color: 'red',
                reason: 'High impact score detected. Immediate quarantine recommended.',
                action: 'Remove from circulation and inspect all affected products.'
            };
        } else if (impactScore >= 15) {
            return {
                label: 'MONITOR',
                color: 'yellow',
                reason: 'Moderate impact score. Enhanced monitoring required.',
                action: 'Increase monitoring frequency and check product integrity.'
            };
        } else {
            return {
                label: 'SAFE',
                color: 'green',
                reason: 'Low impact score. Products remain safe.',
                action: 'Continue normal operations with standard monitoring.'
            };
        }
    }

    getRankedZones() {
        // Convert Map to array and sort by impact score (descending)
        const zoneImpacts = Array.from(this.zoneImpactScores.entries()).map(([zoneId, impactScore]) => {
            const zone = this.zones.find(z => z.zoneId === zoneId);
            return {
                zoneId,
                zoneName: zone?.zoneName || `Zone ${zoneId}`,
                impactScore,
                drugs: zone?.drugs || [],
                sensitivityFactor: zone?.sensitivityFactor || 1.0,
                recommendation: this.generateQuarantineRecommendation(impactScore)
            };
        });
        
        return zoneImpacts.sort((a, b) => b.impactScore - a.impactScore);
    }

    getMostAffectedZone() {
        const rankedZones = this.getRankedZones();
        return rankedZones.length > 0 ? rankedZones[0] : null;
    }

    getTopAffectedZones(count = 3) {
        return this.getRankedZones().slice(0, count);
    }

    // Neometron API Service Methods
    async callNeometronAPI(zoneId, temperature, humidity, exposureDuration, drugTypes) {
        if (!this.neometronConfig.enabled) return null;
        
        const cacheKey = `${zoneId}-${temperature}-${humidity}-${exposureDuration}`;
        
        // Check cache first
        if (this.apiCache.has(cacheKey)) {
            const cached = this.apiCache.get(cacheKey);
            if (Date.now() - cached.timestamp < 300000) { // 5 minutes cache
                return cached.data;
            }
        }
        
        try {
            let response;
            
            if (this.neometronConfig.mode === 'mock') {
                response = await this.generateMockApiResponse(zoneId, temperature, humidity, exposureDuration, drugTypes);
            } else {
                response = await this.callRealNeometronAPI(zoneId, temperature, humidity, exposureDuration, drugTypes);
            }
            
            // Cache the response
            this.apiCache.set(cacheKey, {
                data: response,
                timestamp: Date.now()
            });
            
            return response;
            
        } catch (error) {
            console.error('Neometron API Error:', error);
            return null;
        }
    }

    async generateMockApiResponse(zoneId, temperature, humidity, exposureDuration, drugTypes) {
        const zone = this.zones.find(z => z.zoneId === zoneId);
        if (!zone) return null;
        
        // Try proxy server first, fallback to client-side mock
        try {
            const requestBody = {
                temperature,
                humidity,
                exposureDuration,
                drugTypes,
                zoneId,
                sensitivityFactor: zone.sensitivityFactor
            };
            
            const response = await fetch('http://localhost:3000/api/neometron/drug-impact', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody),
                timeout: 5000
            });
            
            if (response.ok) {
                const data = await response.json();
                return {
                    ...data,
                    timestamp: new Date().toISOString()
                };
            }
        } catch (error) {
            console.log('Proxy server not available, using client-side mock');
        }
        
        // Client-side mock fallback
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 700));
        
        // Calculate base impact score
        const tempDeviation = Math.max(0, Math.abs(temperature - 5) - 3);
        const humidityDeviation = Math.max(0, Math.abs(humidity - 50) - 10);
        const baseImpact = (tempDeviation * zone.sensitivityFactor * 10) + (humidityDeviation * 2) + (exposureDuration / 60);
        
        // Add some randomness for realistic simulation
        const randomFactor = 0.8 + Math.random() * 0.4;
        const impactScore = Math.round(baseImpact * randomFactor);
        
        // Determine confidence level based on data quality
        const confidenceLevel = 0.85 + Math.random() * 0.15;
        
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

    async callRealNeometronAPI(zoneId, temperature, humidity, exposureDuration, drugTypes) {
        const requestBody = {
            temperature,
            humidity,
            exposureDuration,
            drugTypes,
            zoneId,
            sensitivityFactor: this.zones.find(z => z.zoneId === zoneId)?.sensitivityFactor || 1.0
        };
        
        // Try proxy server first, fallback to client-side mock
        try {
            const response = await fetch('http://localhost:3000/api/neometron/drug-impact', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody),
                timeout: 5000
            });
            
            if (response.ok) {
                const data = await response.json();
                return {
                    ...data,
                    apiMode: 'real',
                    timestamp: new Date().toISOString()
                };
            }
        } catch (error) {
            console.log('Proxy server not available, falling back to mock for real API mode');
        }
        
        // Fallback to mock response when proxy server is not available
        console.warn('Real API not available, using mock response');
        return await this.generateMockApiResponse(zoneId, temperature, humidity, exposureDuration, drugTypes);
    }

    
    processZoneImpactWithAPI(zoneId, temperature, anomalyScore, timestamp) {
        // Get zone information
        const zone = this.zones.find(z => z.zoneId === zoneId);
        if (!zone) return null;
        
        // Calculate exposure duration (simplified)
        const exposureDuration = 2 * 60 * 1000; // 2 minutes in milliseconds
        
        // Calculate local impact score
        const exposure = this.calculateExposure(temperature, exposureDuration);
        const impactScore = this.calculateImpactScore(zoneId, exposure, anomalyScore);
        
        // Update zone impact score
        this.zoneImpactScores.set(zoneId, impactScore);
        
        // Generate quarantine recommendation
        const recommendation = this.generateQuarantineRecommendation(impactScore);
        
        // Create impact log
        const impactLog = {
            zoneId,
            zoneName: zone.zoneName,
            impactScore,
            exposure,
            temperature,
            anomalyScore,
            timestamp,
            recommendation,
            sensitivityFactor: zone.sensitivityFactor,
            drugs: zone.drugs
        };
        
        this.impactLogs.unshift(impactLog);
        
        // Keep only recent logs
        if (this.impactLogs.length > 100) {
            this.impactLogs = this.impactLogs.slice(0, 100);
        }
        
        return impactLog;
    }

    
    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg transform transition-all duration-300 translate-x-full`;
        
        // Set color based on type
        let bgColor = 'bg-blue-500';
        let icon = 'info';
        
        switch (type) {
            case 'success':
                bgColor = 'bg-green-500';
                icon = 'check-circle';
                break;
            case 'error':
                bgColor = 'bg-red-500';
                icon = 'alert-triangle';
                break;
            case 'warning':
                bgColor = 'bg-yellow-500';
                icon = 'alert-circle';
                break;
        }
        
        notification.classList.add(bgColor, 'text-white');
        
        notification.innerHTML = `
            <div class="flex items-center">
                <i data-lucide="${icon}" class="w-5 h-5 mr-2"></i>
                <span>${message}</span>
            </div>
        `;
        
        document.body.appendChild(notification);
        lucide.createIcons();
        
        // Slide in
        setTimeout(() => {
            notification.classList.remove('translate-x-full');
            notification.classList.add('translate-x-0');
        }, 10);
        
        // Auto-remove after 4 seconds
        setTimeout(() => {
            notification.classList.remove('translate-x-0');
            notification.classList.add('translate-x-full');
            setTimeout(() => notification.remove(), 300);
        }, 4000);
    }

    initializeZoneImpactFromHistory() {
        // Process historical alerts to generate initial zone impact data
        const historicalAlerts = this.alerts.filter(a => a.type === 'HISTORICAL_BREACH').slice(0, 10);
        
        historicalAlerts.forEach((alert, index) => {
            // Simulate different zones for historical data
            const zoneId = (index % 10) + 1;
            const anomalyScore = 0.6 + Math.random() * 0.4; // High anomaly scores for historical breaches
            
            // Calculate impact for this historical alert
            const exposure = this.calculateExposure(alert.temperature, 30 * 60 * 1000); // 30 minutes duration
            const impactScore = this.calculateImpactScore(zoneId, exposure, anomalyScore);
            
            // Update zone impact score (accumulate for multiple breaches)
            const currentScore = this.zoneImpactScores.get(zoneId) || 0;
            this.zoneImpactScores.set(zoneId, currentScore + impactScore);
        });
        
        // Update the dashboard with initial data
        this.updateZoneImpactDashboard();
    }

    updateZoneImpactDashboard() {
        // Update zone impact panel
        this.updateZoneImpactPanel();
        
        // Update drug impact table
        this.updateDrugImpactTable();
        
        // Update quarantine recommendation
        this.updateQuarantineRecommendation();
        
        // Update zone impact chart
        this.updateZoneImpactChart();
    }

    updateZoneImpactPanel() {
        const zoneImpactPanel = document.getElementById('zoneImpactPanel');
        if (!zoneImpactPanel) return;
        
        const rankedZones = this.getRankedZones();
        
        if (rankedZones.length === 0) {
            zoneImpactPanel.innerHTML = '<p class="text-gray-500 text-center py-4">No zone impacts detected</p>';
            return;
        }
        
        zoneImpactPanel.innerHTML = rankedZones.map(zone => {
            const recommendationColor = zone.recommendation.color;
            const impactColor = zone.impactScore > 50 ? 'text-red-600' : zone.impactScore >= 20 ? 'text-yellow-600' : 'text-green-600';
            
            // Get API confidence if available
            const latestLog = this.impactLogs.find(log => log.zoneId === zone.zoneId);
            const apiConfidence = latestLog?.apiResponse?.confidenceLevel;
            const apiMode = latestLog?.apiResponse?.apiMode;
            
            return `
                <div class="border-l-4 border-${recommendationColor}-500 bg-${recommendationColor}-50 p-3 rounded mb-2">
                    <div class="flex justify-between items-start">
                        <div class="flex-1">
                            <div class="flex items-center justify-between mb-1">
                                <p class="font-semibold text-gray-900">Zone ${zone.zoneId}: ${zone.zoneName}</p>
                                ${apiConfidence ? `
                                    <span class="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                                        AI: ${(apiConfidence * 100).toFixed(0)}% confidence
                                    </span>
                                ` : ''}
                            </div>
                            <p class="text-sm text-gray-600">Sensitivity: ${zone.sensitivityFactor}x</p>
                            <p class="text-xs text-gray-500 mt-1">Drugs: ${zone.drugs.slice(0, 3).join(', ')}${zone.drugs.length > 3 ? '...' : ''}</p>
                            
                            ${latestLog?.apiResponse?.affectedDrugs ? `
                                <div class="mt-2 text-xs">
                                    <p class="font-medium text-gray-700">API Analysis:</p>
                                    <div class="mt-1 space-y-1">
                                        ${latestLog.apiResponse.affectedDrugs.slice(0, 2).map(drug => `
                                            <div class="flex items-center justify-between">
                                                <span class="text-gray-600">${drug.name}</span>
                                                <span class="px-1 py-0.5 text-xs rounded ${
                                                    drug.impactLevel === 'HIGH' ? 'bg-red-100 text-red-800' :
                                                    drug.impactLevel === 'MODERATE' ? 'bg-yellow-100 text-yellow-800' :
                                                    'bg-green-100 text-green-800'
                                                }">${drug.recommendation}</span>
                                            </div>
                                        `).join('')}
                                    </div>
                                </div>
                            ` : ''}
                        </div>
                        <div class="text-right ml-4">
                            <p class="text-lg font-bold ${impactColor}">${zone.impactScore.toFixed(1)}</p>
                            <span class="px-2 py-1 text-xs font-semibold rounded-full bg-${recommendationColor}-100 text-${recommendationColor}-800">
                                ${zone.recommendation.label}
                            </span>
                            ${apiMode ? `
                                <div class="mt-1 text-xs text-gray-500">
                                    ${apiMode === 'mock' ? 'Mock' : 'Real'} API
                                </div>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    updateDrugImpactTable() {
        const drugImpactTable = document.getElementById('drugImpactTable');
        if (!drugImpactTable) return;
        
        const topZones = this.getTopAffectedZones(5);
        
        if (topZones.length === 0) {
            drugImpactTable.innerHTML = '<p class="text-gray-500 text-center py-4">No drug impacts detected</p>';
            return;
        }
        
        drugImpactTable.innerHTML = topZones.map(zone => {
            const impactColor = zone.impactScore > 50 ? 'text-red-600' : zone.impactScore >= 20 ? 'text-yellow-600' : 'text-green-600';
            
            // Get API data if available
            const latestLog = this.impactLogs.find(log => log.zoneId === zone.zoneId);
            const apiConfidence = latestLog?.apiResponse?.confidenceLevel;
            const apiMode = latestLog?.apiResponse?.apiMode;
            
            return `
                <tr class="hover:bg-gray-50">
                    <td class="px-4 py-3 text-sm font-medium text-gray-900">Zone ${zone.zoneId}</td>
                    <td class="px-4 py-3 text-sm text-gray-900">${zone.zoneName}</td>
                    <td class="px-4 py-3 text-sm text-gray-500">
                        ${zone.drugs.slice(0, 2).join(', ')}${zone.drugs.length > 2 ? ' +' + (zone.drugs.length - 2) + ' more' : ''}
                    </td>
                    <td class="px-4 py-3 text-sm font-semibold ${impactColor}">${zone.impactScore.toFixed(1)}</td>
                    <td class="px-4 py-3 text-sm">
                        <span class="px-2 py-1 text-xs font-semibold rounded-full bg-${zone.recommendation.color}-100 text-${zone.recommendation.color}-800">
                            ${zone.recommendation.label}
                        </span>
                    </td>
                    <td class="px-4 py-3 text-sm text-gray-500">
                        ${apiConfidence ? `
                            <div class="flex items-center">
                                <span class="text-xs font-medium text-blue-600">${(apiConfidence * 100).toFixed(0)}%</span>
                            </div>
                        ` : '<span class="text-xs text-gray-400">No API data</span>'}
                    </td>
                </tr>
            `;
        }).join('');
    }

    updateQuarantineRecommendation() {
        const quarantineDisplay = document.getElementById('quarantineDisplay');
        if (!quarantineDisplay) return;
        
        const mostAffectedZone = this.getMostAffectedZone();
        
        // Check if any zone has critical conditions or is currently being monitored
        const hasCriticalZone = this.zones.some(zone => {
            const zoneImpact = this.zoneImpactScores.get(zone.zoneId);
            return zoneImpact && zoneImpact > 20; // Critical threshold
        });
        
        const isMonitoringActive = this.isMonitoring;
        
        if (!mostAffectedZone && !hasCriticalZone && !isMonitoringActive) {
            quarantineDisplay.innerHTML = `
                <div class="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div class="flex items-center">
                        <i data-lucide="check-circle" class="w-6 h-6 text-green-500 mr-3"></i>
                        <div>
                            <h4 class="text-green-800 font-semibold">All Zones Safe</h4>
                            <p class="text-green-600 text-sm">No quarantine actions required at this time.</p>
                        </div>
                    </div>
                </div>
            `;
            lucide.createIcons();
            return;
        }
        
        const recommendation = mostAffectedZone.recommendation;
        const alertColor = recommendation.color === 'red' ? 'red' : recommendation.color === 'yellow' ? 'yellow' : 'green';
        const alertIcon = recommendation.color === 'red' ? 'alert-triangle' : recommendation.color === 'yellow' ? 'alert-circle' : 'check-circle';
        
        quarantineDisplay.innerHTML = `
            <div class="bg-${alertColor}-50 border border-${alertColor}-200 rounded-lg p-4">
                <div class="flex items-start">
                    <i data-lucide="${alertIcon}" class="w-6 h-6 text-${alertColor}-500 mr-3 mt-1"></i>
                    <div class="flex-1">
                        <h4 class="text-${alertColor}-800 font-semibold">Zone ${mostAffectedZone.zoneId}: ${mostAffectedZone.zoneName}</h4>
                        <p class="text-${alertColor}-600 text-sm font-medium">${recommendation.label}</p>
                        <p class="text-${alertColor}-600 text-sm mt-1">${recommendation.reason}</p>
                        <p class="text-${alertColor}-700 text-xs mt-2 font-medium">Action: ${recommendation.action}</p>
                        <div class="mt-2 text-xs text-${alertColor}-500">
                            Impact Score: ${mostAffectedZone.impactScore.toFixed(1)} | Sensitivity: ${mostAffectedZone.sensitivityFactor}x
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        lucide.createIcons();
    }

    updateZoneImpactChart() {
        const zoneImpactChart = document.getElementById('zoneImpactChart');
        if (!zoneImpactChart) return;
        
        const rankedZones = this.getRankedZones();
        
        if (rankedZones.length === 0) return;
        
        // Create high-resolution bar chart using canvas
        const canvas = zoneImpactChart;
        const ctx = canvas.getContext('2d');
        
        // Set canvas size with device pixel ratio for sharp rendering
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        const width = canvas.width = rect.width * dpr;
        const height = canvas.height = rect.height * dpr;
        
        // Scale context to match device pixel ratio
        ctx.scale(dpr, dpr);
        
        // Set CSS size
        canvas.style.width = rect.width + 'px';
        canvas.style.height = rect.height + 'px';
        
        // Clear canvas
        ctx.clearRect(0, 0, rect.width, rect.height);
        
        // Chart dimensions
        const padding = 50;
        const chartWidth = rect.width - 2 * padding;
        const chartHeight = rect.height - 2 * padding;
        const maxBarWidth = 40; // Further reduced max bar width
        const minBarSpacing = 35; // Increased minimum spacing between bars
        
        // Calculate bar width with proper spacing
        const totalBars = rankedZones.length;
        const availableWidth = chartWidth - (totalBars - 1) * minBarSpacing;
        const barWidth = Math.min(availableWidth / totalBars, maxBarWidth);
        const barSpacing = (chartWidth - barWidth * totalBars) / (totalBars - 1);
        
        // Prepare data
        const maxScore = Math.max(...rankedZones.map(z => z.impactScore), 100);
        
        // Draw grid lines
        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 0.5;
        ctx.setLineDash([2, 2]);
        
        // Horizontal grid lines
        for (let i = 0; i <= 5; i++) {
            const y = padding + (chartHeight / 5) * i;
            ctx.beginPath();
            ctx.moveTo(padding, y);
            ctx.lineTo(padding + chartWidth, y);
            ctx.stroke();
            
            // Y-axis labels
            ctx.fillStyle = '#6b7280';
            ctx.font = '11px system-ui, -apple-system, sans-serif';
            ctx.textAlign = 'right';
            const value = Math.round(maxScore - (maxScore / 5) * i);
            ctx.fillText(value.toString(), padding - 10, y + 4);
        }
        
        ctx.setLineDash([]);
        
        // Draw axes
        ctx.strokeStyle = '#9ca3af';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padding, padding);
        ctx.lineTo(padding, padding + chartHeight);
        ctx.lineTo(padding + chartWidth, padding + chartHeight);
        ctx.stroke();
        
        // Draw bars with enhanced styling
        rankedZones.forEach((zone, index) => {
            const x = padding + index * (barWidth + barSpacing);
            const barHeight = (zone.impactScore / maxScore) * chartHeight;
            const y = padding + chartHeight - barHeight;
            
            // Choose color based on recommendation
            let color = '#10b981'; // green
            let gradientColor1 = '#34d399';
            let gradientColor2 = '#10b981';
            
            if (zone.recommendation.color === 'red') {
                color = '#ef4444';
                gradientColor1 = '#f87171';
                gradientColor2 = '#ef4444';
            } else if (zone.recommendation.color === 'yellow') {
                color = '#f59e0b';
                gradientColor1 = '#fbbf24';
                gradientColor2 = '#f59e0b';
            }
            
            // Create gradient for bars
            const gradient = ctx.createLinearGradient(0, y, 0, y + barHeight);
            gradient.addColorStop(0, gradientColor1);
            gradient.addColorStop(1, gradientColor2);
            
            // Draw bar with rounded corners
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.roundRect(x, y, barWidth, barHeight, [4, 4, 0, 0]);
            ctx.fill();
            
            // Draw bar border
            ctx.strokeStyle = color;
            ctx.lineWidth = 1;
            ctx.stroke();
            
            // Draw value on top of bar
            ctx.fillStyle = '#111827';
            ctx.font = 'bold 13px system-ui, -apple-system, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(zone.impactScore.toFixed(1), x + barWidth / 2, y - 8);
            
            // Draw recommendation badge above bar
            const badgeColors = {
                red: '#dc2626',
                yellow: '#d97706',
                green: '#059669'
            };
            
            ctx.fillStyle = badgeColors[zone.recommendation.color];
            ctx.font = '9px system-ui, -apple-system, sans-serif';
            ctx.fillText(zone.recommendation.label, x + barWidth / 2, y - 22);
        });
        
        // Draw x-axis labels below the chart with better spacing
        rankedZones.forEach((zone, index) => {
            const x = padding + index * (barWidth + barSpacing);
            const labelY = padding + chartHeight + 20;
            const centerX = x + barWidth / 2;
            
            // Calculate maximum text width based on available space
            const maxTextWidth = barWidth + barSpacing - 5;
            
            // Draw zone label
            ctx.fillStyle = '#374151';
            ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
            ctx.textAlign = 'center';
            const zoneLabel = `Zone ${zone.zoneId}`;
            ctx.fillText(zoneLabel, centerX, labelY);
            
            // Draw zone name with smart truncation
            ctx.fillStyle = '#6b7280';
            ctx.font = '9px system-ui, -apple-system, sans-serif';
            let zoneName = zone.zoneName;
            
            // Truncate zone name if it's too wide
            if (ctx.measureText(zoneName).width > maxTextWidth) {
                let truncated = zoneName;
                while (ctx.measureText(truncated + '...').width > maxTextWidth && truncated.length > 0) {
                    truncated = truncated.slice(0, -1);
                }
                zoneName = truncated + '...';
            }
            ctx.fillText(zoneName, centerX, labelY + 12);
            
            // Draw sample drug names with smart truncation
            ctx.fillStyle = '#9ca3af';
            ctx.font = '8px system-ui, -apple-system, sans-serif';
            const sampleDrugs = zone.drugs.slice(0, 2).join(', ');
            let displayDrugs = sampleDrugs;
            
            // Truncate drug names if they're too wide
            if (ctx.measureText(sampleDrugs).width > maxTextWidth) {
                let truncated = sampleDrugs;
                while (ctx.measureText(truncated + '...').width > maxTextWidth && truncated.length > 0) {
                    truncated = truncated.slice(0, -1);
                }
                displayDrugs = truncated + '...';
            }
            ctx.fillText(displayDrugs, centerX, labelY + 24);
        });
        
        // Draw title
        ctx.fillStyle = '#111827';
        ctx.font = 'bold 14px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Zone Impact Analysis', rect.width / 2, 25);
    }

    // Start sensor rotation to test all zones
    startSensorRotation() {
        // Rotate through sensors every 10 seconds for testing (change to 30000 for production)
        this.sensorRotationInterval = setInterval(() => {
            this.rotateSensor();
        }, 10000); // 10 seconds for testing
    }

    rotateSensor() {
        const sensorIds = ['unit-001', 'unit-002', 'unit-003', 'unit-004', 'unit-005', 
                           'unit-006', 'unit-007', 'unit-008', 'unit-009', 'unit-010'];
        const currentIndex = sensorIds.indexOf(this.currentSensorId);
        const nextIndex = (currentIndex + 1) % sensorIds.length;
        this.currentSensorId = sensorIds[nextIndex];
        
        const zoneId = this.sensorZoneMap.get(this.currentSensorId);
        const zone = this.zones.find(z => z.zoneId === zoneId);
        
        console.log(`Rotated to sensor: ${this.currentSensorId} (Zone ${zoneId}: ${zone?.zoneName})`);
        
        // Generate API response for this zone to ensure confidence data is available
        this.generateApiResponseForZone(zoneId);
        
        // Update dashboard to show current zone
        this.updateCurrentZoneDisplay();
    }

    async generateApiResponseForZone(zoneId) {
        const zone = this.zones.find(z => z.zoneId === zoneId);
        if (!zone) return;
        
        try {
            // Generate API response for this zone with current conditions
            const apiResponse = await this.callNeometronAPI(
                zoneId, 
                this.currentTemp, 
                this.currentHumidity, 
                120, // 2 minutes exposure
                zone.drugs
            );
            
            if (apiResponse) {
                // Create or update impact log for this zone with API data
                const existingLog = this.impactLogs.find(log => log.zoneId === zoneId);
                
                if (existingLog && !existingLog.apiResponse) {
                    // Update existing log with API response
                    existingLog.apiResponse = apiResponse;
                    console.log(`Added API response for Zone ${zoneId}: ${(apiResponse.confidenceLevel * 100).toFixed(0)}% confidence`);
                } else if (!existingLog) {
                    // Create new impact log with API data
                    const impactLog = {
                        zoneId,
                        zoneName: zone.zoneName,
                        impactScore: apiResponse.impactScore,
                        exposure: 120000, // 2 minutes in milliseconds
                        temperature: this.currentTemp,
                        anomalyScore: 0.3, // Low anomaly score for routine monitoring
                        timestamp: new Date(),
                        recommendation: this.generateQuarantineRecommendation(apiResponse.impactScore),
                        sensitivityFactor: zone.sensitivityFactor,
                        apiResponse: apiResponse,
                        drugs: zone.drugs
                    };
                    
                    this.impactLogs.unshift(impactLog);
                    
                    // Keep only recent logs
                    if (this.impactLogs.length > 100) {
                        this.impactLogs = this.impactLogs.slice(0, 100);
                    }
                }
                
                // Update zone impact score
                this.zoneImpactScores.set(zoneId, apiResponse.impactScore);
                
                // Refresh the zone impact panel
                this.updateZoneImpactPanel();
            }
        } catch (error) {
            console.error(`Error generating API response for Zone ${zoneId}:`, error);
        }
    }

    // Initialize API responses for all zones
    async initializeAllZonesWithAPI() {
        console.log('Initializing API responses for all zones...');
        
        // Generate API responses for all zones with a small delay between calls
        for (let zoneId = 1; zoneId <= 10; zoneId++) {
            await this.generateApiResponseForZone(zoneId);
            // Small delay to prevent overwhelming the API
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        console.log('All zones initialized with API responses');
        // Update the zone impact panel to show all API data
        this.updateZoneImpactPanel();
    }

    // Manual zone change for testing
    changeToZone(zoneId) {
        // Find sensor for this zone
        for (const [sensorId, mappedZoneId] of this.sensorZoneMap.entries()) {
            if (mappedZoneId === zoneId) {
                this.currentSensorId = sensorId;
                const zone = this.zones.find(z => z.zoneId === zoneId);
                console.log(`Manually changed to sensor: ${this.currentSensorId} (Zone ${zoneId}: ${zone?.zoneName})`);
                this.updateCurrentZoneDisplay();
                break;
            }
        }
    }

    updateCurrentZoneDisplay() {
        const zoneId = this.sensorZoneMap.get(this.currentSensorId);
        const zone = this.zones.find(z => z.zoneId === zoneId);
        
        // Update any existing zone display elements
        const zoneDisplayElement = document.getElementById('currentZoneDisplay');
        if (zoneDisplayElement) {
            zoneDisplayElement.innerHTML = `
                <div class="flex items-center justify-between">
                    <span class="text-sm font-medium text-gray-700">Current Zone:</span>
                    <span class="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                        Zone ${zoneId}: ${zone?.zoneName || 'Unknown'}
                    </span>
                </div>
            `;
        }
    }

    // Faster temperature and humidity simulation with frequent abnormal changes
    simulateTemperature() {
        // Store previous values for change detection
        this.previousTemp = this.currentTemp;
        this.previousHumidity = this.currentHumidity;
        
        // Temperature simulation
        const targetTemp = 5.0 + Math.sin(Date.now() / 5000) * 4; // Faster sinusoidal variation
        const tempRandomInfluence = (Math.random() - 0.5) * 0.8; // Larger random changes
        const tempDelta = (targetTemp - this.currentTemp) * 0.3 + tempRandomInfluence;
        this.currentTemp += tempDelta;
        
        // More frequent abnormal temperature changes (10% chance)
        if (Math.random() < 0.10) {
            // Only generate abnormal changes if doors are closed
            if (!this.doorsOpen) {
                const abnormalTempChange = (Math.random() - 0.5) * 6; // ±3°Celsius sudden change
                this.currentTemp += abnormalTempChange;
                this.reportAbnormalChange(abnormalTempChange, 'temperature');
            }
        }
        
        // Occasionally force critical values for testing (5% chance)
        if (Math.random() < 0.05) {
            if (Math.random() < 0.5) {
                // Force temperature below safe range
                this.currentTemp = this.safeRange.min - Math.random() * 2;
            } else {
                // Force temperature above safe range
                this.currentTemp = this.safeRange.max + Math.random() * 2;
            }
        }
        
        // Keep within realistic bounds
        this.currentTemp = Math.max(-5, Math.min(15, this.currentTemp));
        
        // Humidity simulation
        const targetHumidity = 50.0 + Math.sin(Date.now() / 4000) * 15; // Faster sinusoidal variation
        const humidityRandomInfluence = (Math.random() - 0.5) * 3; // Random changes
        const humidityDelta = (targetHumidity - this.currentHumidity) * 0.3 + humidityRandomInfluence;
        this.currentHumidity += humidityDelta;
        
                
        // Occasionally force critical values for testing (15% chance for humidity)
        if (Math.random() < 0.15) {
            if (Math.random() < 0.5) {
                // Force humidity below safe range
                this.currentHumidity = this.humiditySafeRange.min - Math.random() * 10;
            } else {
                // Force humidity above safe range
                this.currentHumidity = this.humiditySafeRange.max + Math.random() * 10;
            }
        }
        
        // Keep within realistic bounds
        this.currentHumidity = Math.max(20, Math.min(80, this.currentHumidity));
        
        // Detect abnormal changes for temperature only
        const tempChangeAbs = Math.abs(this.currentTemp - this.previousTemp);
        
        if (tempChangeAbs > this.abnormalChangeThreshold && !this.doorsOpen) {
            this.reportAbnormalChange(tempChangeAbs, 'temperature');
        }
        
        // Add timestamp and calculate anomaly score
        const timestamp = new Date();
        const anomalyScore = this.calculateAnomalyScore(this.currentTemp, this.currentHumidity);
        
        this.tempHistory.push({
            temp: this.currentTemp,
            humidity: this.currentHumidity,
            timestamp: timestamp
        });
        
        this.humidityHistory.push({
            humidity: this.currentHumidity,
            timestamp: timestamp
        });
        
        // Store anomaly score
        this.anomalyScores.push({
            score: anomalyScore,
            timestamp: timestamp
        });
        
        // Limit history size
        if (this.tempHistory.length > this.maxHistoryPoints) {
            this.tempHistory.shift();
        }
        
        if (this.humidityHistory.length > this.maxHistoryPoints) {
            this.humidityHistory.shift();
        }
        
        // Limit anomaly scores
        if (this.anomalyScores.length > this.maxHistoryPoints) {
            this.anomalyScores.shift();
        }
        
        this.checkTemperature();
        this.checkHumidity();
        
        // Process zone impact if anomaly detected
        if (anomalyScore > 0.4) {
            const zoneId = this.sensorZoneMap.get(this.currentSensorId) || 1;
            this.processZoneImpactWithAPI(zoneId, this.currentTemp, anomalyScore, new Date());
        }
        
        this.updateDisplay();
        this.updateChart();
        this.updateAnomalyChart();
        this.updateMlDashboard();
        this.updateBreachTimeline();
        this.updateZoneImpactDashboard();
    }

    checkTemperature() {
        const isCritical = this.currentTemp < this.safeRange.min || this.currentTemp > this.safeRange.max;
        const now = Date.now();
        
        // Only trigger alerts if doors are closed
        if (isCritical && (now - this.lastAlertTime) > 10000 && !this.doorsOpen) { // 10 second debounce
            this.triggerAlert('temperature');
            this.lastAlertTime = now;
        }
    }

    checkHumidity() {
        // Only update status, no alerts for humidity
        // Status will be updated in updateDisplay method
    }


    reportAbnormalChange(change, sensorType) {
        let abnormalAlert;
        
        if (sensorType === 'temperature') {
            const fromTemp = this.previousTemp;
            const toTemp = this.currentTemp;
            abnormalAlert = {
                id: Date.now(),
                type: 'ABNORMAL_CHANGE',
                sensorType: 'temperature',
                temperature: this.currentTemp,
                change: change,
                fromTemp: fromTemp,
                toTemp: toTemp,
                timestamp: new Date(),
                message: `Temperature changed from ${fromTemp.toFixed(1)}°Celsius to ${toTemp.toFixed(1)}°Celsius`
            };
        }
        
        // Add to alerts array for history but not to criticalAlerts
        this.alerts.unshift(abnormalAlert);
        this.updateAlertHistory();
        
        // Show notification
        this.showAbnormalNotification(abnormalAlert);
    }

    showAbnormalNotification(alert) {
        const notification = document.createElement('div');
        notification.className = 'fixed top-20 right-4 bg-yellow-500 text-white px-4 py-3 rounded-lg shadow-lg z-40 transform translate-x-full transition-transform duration-300';
        
        const changeMessage = `${alert.fromTemp.toFixed(1)}°Celsius → ${alert.toTemp.toFixed(1)}°Celsius`;
        const title = 'Abnormal Temperature Change Detected';
        
        notification.innerHTML = `
            <div class="flex items-center space-x-3">
                <i data-lucide="alert-circle" class="w-5 h-5"></i>
                <div>
                    <p class="font-semibold">${title}</p>
                    <p class="text-sm">${changeMessage}</p>
                </div>
            </div>
        `;
        
        document.body.appendChild(notification);
        lucide.createIcons();
        
        // Slide in
        setTimeout(() => {
            notification.classList.remove('translate-x-full');
            notification.classList.add('translate-x-0');
        }, 10);
        
        // Auto-remove after 4 seconds
        setTimeout(() => {
            notification.classList.remove('translate-x-0');
            notification.classList.add('translate-x-full');
            setTimeout(() => notification.remove(), 300);
        }, 4000);
    }

    triggerAlert(sensorType) {
        const alert = {
            id: Date.now(),
            temperature: this.currentTemp,
            humidity: this.currentHumidity,
            timestamp: new Date(),
            status: 'CRITICAL',
            sensorType: sensorType // 'temperature' or 'humidity'
        };
        
        // Add to both arrays
        this.alerts.unshift(alert);
        this.criticalAlerts.unshift(alert);
        this.showToast(alert);
        this.updateAlertHistory();
    }

    recordHumidityWarning() {
        const warning = {
            id: Date.now(),
            temperature: this.currentTemp,
            humidity: this.currentHumidity,
            timestamp: new Date(),
            status: 'WARNING',
            sensorType: 'humidity'
        };
        
        // Add to alerts array for history but not to criticalAlerts
        this.alerts.unshift(warning);
        this.updateAlertHistory();
    }


    showToast(alert) {
        const modal = document.getElementById('alertModal');
        const alertContent = document.getElementById('alertContent');
        const alertTemp = document.getElementById('alertTemp');
        const alertTime = document.getElementById('alertTime');
        
        // Update modal content based on sensor type
        if (alert.sensorType === 'humidity') {
            alertTemp.textContent = `${alert.humidity.toFixed(1)}% Humidity`;
        } else {
            alertTemp.textContent = `${alert.temperature.toFixed(1)}°Celsius`;
        }
        alertTime.textContent = alert.timestamp.toLocaleTimeString();
        
        // Update modal title and message based on sensor type
        const modalTitle = modal.querySelector('h3');
        const alertRange = document.getElementById('alertRange');
        const alertMessage = document.getElementById('alertMessage');
        
        if (alert.sensorType === 'humidity') {
            modalTitle.textContent = 'Critical Humidity Warning!';
            alertRange.textContent = 'Safe Range: 40% - 60% Humidity';
            alertMessage.textContent = 'Humidity is outside the safe pharmaceutical range!';
        } else {
            modalTitle.textContent = 'Critical Temperature Warning!';
            alertRange.textContent = 'Safe Range: 2°Celsius - 8°Celsius';
            alertMessage.textContent = 'Temperature is outside the safe pharmaceutical range!';
        }
        
        // Show modal with animation
        modal.classList.remove('hidden');
        setTimeout(() => {
            alertContent.classList.remove('scale-95', 'opacity-0');
            alertContent.classList.add('scale-100', 'opacity-100');
        }, 10);
        
        // Add vibration effect if supported
        if ('vibrate' in navigator) {
            navigator.vibrate([200, 100, 200]);
        }
        
        // Auto-close after 6 seconds
        setTimeout(() => {
            this.closeAlert();
        }, 6000);
    }

    closeAlert() {
        const modal = document.getElementById('alertModal');
        const alertContent = document.getElementById('alertContent');
        
        alertContent.classList.remove('scale-100', 'opacity-100');
        alertContent.classList.add('scale-95', 'opacity-0');
        
        setTimeout(() => {
            modal.classList.add('hidden');
        }, 300);
    }

    updateDisplay() {
        const now = Date.now();
        
        // Update temperature display
        const tempDisplay = document.getElementById('temperatureDisplay');
        tempDisplay.textContent = `${this.currentTemp.toFixed(1)}°Celsius`;
        
        // Update humidity display
        const humidityDisplay = document.getElementById('humidityDisplay');
        humidityDisplay.textContent = `${this.currentHumidity.toFixed(1)}%`;
        
        // Update temperature status indicator
        const statusIndicator = document.getElementById('statusIndicator');
        const temperatureCard = document.getElementById('temperatureCard');
        
        const isTempCritical = this.currentTemp < this.safeRange.min || this.currentTemp > this.safeRange.max;
        
        if (isTempCritical) {
            statusIndicator.className = 'inline-flex items-center px-4 py-2 rounded-full text-sm font-medium bg-red-100 text-red-700';
            statusIndicator.innerHTML = '<div class="w-2 h-2 rounded-full mr-2 bg-red-500 animate-pulse"></div>CRITICAL';
            temperatureCard.classList.add('critical-pulse');
        } else {
            statusIndicator.className = 'inline-flex items-center px-4 py-2 rounded-full text-sm font-medium bg-green-100 text-green-700';
            statusIndicator.innerHTML = '<div class="w-2 h-2 rounded-full mr-2 bg-green-500"></div>NORMAL';
            temperatureCard.classList.remove('critical-pulse');
        }
        
        // Update humidity status indicator
        const humidityStatusIndicator = document.getElementById('humidityStatusIndicator');
        const humidityCard = document.getElementById('humidityCard');
        
        const isHumiditySafe = this.currentHumidity >= this.humiditySafeRange.min && this.currentHumidity <= this.humiditySafeRange.max;
        const isHumidityWarning = !isHumiditySafe && 
            (this.currentHumidity >= this.humidityWarningRange.min && this.currentHumidity <= this.humidityWarningRange.max);
        const isHumidityCritical = !isHumiditySafe && !isHumidityWarning;
        
        // Ignore humidity warnings/critical when doors are open
        if (this.doorsOpen) {
            humidityStatusIndicator.className = 'inline-flex items-center px-4 py-2 rounded-full text-sm font-medium bg-gray-100 text-gray-700';
            humidityStatusIndicator.innerHTML = '<div class="w-2 h-2 rounded-full mr-2 bg-gray-500"></div>DOORS OPEN';
            humidityCard.classList.remove('critical-pulse');
        } else if (isHumidityCritical) {
            humidityStatusIndicator.className = 'inline-flex items-center px-4 py-2 rounded-full text-sm font-medium bg-red-100 text-red-700';
            humidityStatusIndicator.innerHTML = '<div class="w-2 h-2 rounded-full mr-2 bg-red-500 animate-pulse"></div>CRITICAL';
            humidityCard.classList.add('critical-pulse');
            
            // Record humidity alert in history without popup
            if ((now - this.lastHumidityAlertTime) > 10000) { // 10 second debounce
                this.recordHumidityWarning();
                this.lastHumidityAlertTime = now;
            }
        } else if (isHumidityWarning) {
            humidityStatusIndicator.className = 'inline-flex items-center px-4 py-2 rounded-full text-sm font-medium bg-yellow-100 text-yellow-700';
            humidityStatusIndicator.innerHTML = '<div class="w-2 h-2 rounded-full mr-2 bg-yellow-500"></div>WARNING';
            humidityCard.classList.remove('critical-pulse');
            
            // Record humidity warning in alert history without popup
            if ((now - this.lastHumidityAlertTime) > 10000) { // 10 second debounce
                this.recordHumidityWarning();
                this.lastHumidityAlertTime = now;
            }
        } else {
            humidityStatusIndicator.className = 'inline-flex items-center px-4 py-2 rounded-full text-sm font-medium bg-green-100 text-green-700';
            humidityStatusIndicator.innerHTML = '<div class="w-2 h-2 rounded-full mr-2 bg-green-500"></div>NORMAL';
            humidityCard.classList.remove('critical-pulse');
        }
        
        // Update system status
        const systemStatus = document.getElementById('systemStatus');
        const isAnyCritical = isTempCritical || (isHumidityCritical && !this.doorsOpen);
        const isAnyWarning = isHumidityWarning && !this.doorsOpen;
        
        if (isAnyCritical) {
            systemStatus.textContent = 'Critical';
            systemStatus.className = 'text-lg font-bold text-red-600';
        } else if (isAnyWarning) {
            systemStatus.textContent = 'Warning';
            systemStatus.className = 'text-lg font-bold text-yellow-600';
        } else {
            systemStatus.textContent = 'Normal';
            systemStatus.className = 'text-lg font-bold text-green-600';
        }
        
        // Update metrics - only count critical alerts
        document.getElementById('alertCount').textContent = this.criticalAlerts.length;
        document.getElementById('lastUpdate').textContent = `Last: ${new Date().toLocaleTimeString()}`;
    }

    updateAlertHistory() {
        const tbody = document.getElementById('alertHistory');
        
        if (this.alerts.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-4 text-center text-gray-500">No alerts recorded</td></tr>';
            return;
        }
        
        tbody.innerHTML = this.alerts.slice(0, 10).map(alert => {
            const duration = this.calculateDuration(alert.timestamp);
            const isAbnormalChange = alert.type === 'ABNORMAL_CHANGE';
            const isCritical = alert.status === 'CRITICAL';
            const isWarning = alert.status === 'WARNING';
            
            let statusBadge, statusColor, valueDisplay;
            
            if (isAbnormalChange) {
                statusBadge = 'ABNORMAL';
                statusColor = 'bg-yellow-100 text-yellow-800';
                valueDisplay = `${alert.temperature.toFixed(1)}°Celsius (${alert.change > 0 ? '+' : ''}${alert.change.toFixed(1)}°Celsius)`;
            } else if (isCritical) {
                statusBadge = 'CRITICAL';
                statusColor = 'bg-red-100 text-red-800';
                // Show temperature or humidity based on sensor type
                if (alert.sensorType === 'humidity') {
                    valueDisplay = `${alert.humidity.toFixed(1)}% Humidity`;
                } else {
                    valueDisplay = `${alert.temperature.toFixed(1)}°Celsius`;
                }
            } else if (isWarning) {
                statusBadge = 'WARNING';
                statusColor = 'bg-yellow-100 text-yellow-800';
                // Show temperature or humidity based on sensor type
                if (alert.sensorType === 'humidity') {
                    valueDisplay = `${alert.humidity.toFixed(1)}% Humidity`;
                } else {
                    valueDisplay = `${alert.temperature.toFixed(1)}°Celsius`;
                }
            } else {
                statusBadge = 'NORMAL';
                statusColor = 'bg-green-100 text-green-800';
                // Show temperature or humidity based on sensor type
                if (alert.sensorType === 'humidity') {
                    valueDisplay = `${alert.humidity.toFixed(1)}% Humidity`;
                } else {
                    valueDisplay = `${alert.temperature.toFixed(1)}°Celsius`;
                }
            }
            
            let isOutOfRange;
            if (alert.sensorType === 'humidity') {
                isOutOfRange = alert.humidity < this.humiditySafeRange.min || alert.humidity > this.humiditySafeRange.max;
            } else {
                isOutOfRange = alert.temperature < this.safeRange.min || alert.temperature > this.safeRange.max;
            }
            
            return `
                <tr class="hover:bg-gray-50">
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ${alert.timestamp.toLocaleString()}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm">
                        <span class="font-semibold ${isCritical || isOutOfRange ? 'text-red-600' : isAbnormalChange ? 'text-yellow-600' : 'text-gray-900'}">
                            ${valueDisplay}
                        </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColor}">
                            ${statusBadge}
                        </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        ${alert.sensorType === 'humidity' ? 'Humidity' : 'Temperature'}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        ${duration}
                    </td>
                </tr>
            `;
        }).join('');
    }

    calculateDuration(alertTime) {
        const now = new Date();
        const diff = now - alertTime;
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) return `${hours}h ${minutes % 60}m ago`;
        if (minutes > 0) return `${minutes}m ${seconds % 60}s ago`;
        return `${seconds}s ago`;
    }

    setupChart() {
        const ctx = document.getElementById('temperatureChart').getContext('2d');
        
        // Create gradient for temperature
        const tempGradient = ctx.createLinearGradient(0, 0, 0, 250);
        tempGradient.addColorStop(0, 'rgba(239, 68, 68, 0.1)');
        tempGradient.addColorStop(0.2, 'rgba(34, 197, 94, 0.1)');
        tempGradient.addColorStop(0.8, 'rgba(34, 197, 94, 0.1)');
        tempGradient.addColorStop(1, 'rgba(239, 68, 68, 0.1)');
        
        // Temperature and Humidity dual-axis chart
        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Temperature (°Celsius)',
                        data: [],
                        borderColor: 'rgb(59, 130, 246)',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        tension: 0.4,
                        fill: false,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Humidity (%)',
                        data: [],
                        borderColor: 'rgb(34, 197, 94)',
                        backgroundColor: 'rgba(34, 197, 94, 0.1)',
                        tension: 0.4,
                        fill: false,
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    }
                },
                scales: {
                    x: {
                        display: true,
                        ticks: {
                            display: false
                        },
                        grid: {
                            display: false
                        },
                        title: {
                            display: false
                        }
                    },
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                            display: true,
                            text: 'Temperature (°Celsius)'
                        },
                        min: -5,
                        max: 15
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: {
                            display: true,
                            text: 'Humidity (%)'
                        },
                        min: 20,
                        max: 80,
                        grid: {
                            drawOnChartArea: false
                        }
                    }
                }
            }
        });
    }

    updateChart() {
        // Update temperature and humidity chart
        if (!this.chart) return;
        
        // Show only the most recent 50 data points for better visibility
        const recentHistory = this.tempHistory.slice(-50);
        const labels = recentHistory.map(point => 
            point.timestamp.toLocaleTimeString()
        );
        const tempData = recentHistory.map(point => point.temp);
        const humidityData = recentHistory.map(point => point.humidity);
        
        this.chart.data.labels = labels;
        this.chart.data.datasets[0].data = tempData;
        this.chart.data.datasets[1].data = humidityData;
        this.chart.update('none');
    }

    startUptimeCounter() {
        this.uptimeInterval = setInterval(() => {
            const uptime = Date.now() - this.startTime;
            const hours = Math.floor(uptime / 3600000);
            const minutes = Math.floor((uptime % 3600000) / 60000);
            const seconds = Math.floor((uptime % 60000) / 1000);
            
            const uptimeText = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            
            // Update both uptime elements
            const headerUptime = document.getElementById('headerUptime');
            const metricsUptime = document.getElementById('uptime');
            
            if (headerUptime) headerUptime.textContent = uptimeText;
            if (metricsUptime) metricsUptime.textContent = uptimeText;
        }, 1000);
    }

    startMonitoring() {
        if (this.isMonitoring) return;
        
        this.isMonitoring = true;
        this.updateInterval = setInterval(() => {
            this.simulateTemperature();
        }, 1500); // Update every 1.5 seconds
        
        // Start random door changes
        this.startRandomDoorChanges();
        
        // Update button
        const toggleBtn = document.getElementById('toggleMonitoring');
        toggleBtn.innerHTML = '<i data-lucide="pause" class="w-4 h-4"></i><span>Stop Monitoring</span>';
        toggleBtn.classList.remove('bg-blue-600', 'hover:bg-blue-700');
        toggleBtn.classList.add('bg-red-600', 'hover:bg-red-700');
        lucide.createIcons();
    }

    stopMonitoring() {
        if (!this.isMonitoring) return;
        
        this.isMonitoring = false;
        clearInterval(this.updateInterval);
        
        // Stop random door changes
        this.stopRandomDoorChanges();
        
        // Update button
        const toggleBtn = document.getElementById('toggleMonitoring');
        toggleBtn.innerHTML = '<i data-lucide="play" class="w-4 h-4"></i><span>Start Monitoring</span>';
        toggleBtn.classList.remove('bg-red-600', 'hover:bg-red-700');
        toggleBtn.classList.add('bg-blue-600', 'hover:bg-blue-700');
        lucide.createIcons();
    }

    resetAlerts() {
        this.alerts = [];
        this.criticalAlerts = [];
        this.tempHistory = [];
        this.humidityHistory = [];
        this.updateAlertHistory();
        this.updateDisplay();
    }

    bindEvents() {
        document.getElementById('toggleMonitoring').addEventListener('click', () => {
            if (this.isMonitoring) {
                this.stopMonitoring();
            } else {
                this.startMonitoring();
            }
        });

        document.getElementById('resetAlerts').addEventListener('click', () => {
            if (confirm('Are you sure you want to clear all alert history?')) {
                this.resetAlerts();
            }
        });

        
        
        // Remove manual door toggle - doors now change randomly
        // Door status is now controlled automatically
    }

    toggleDoors() {
        this.doorsOpen = !this.doorsOpen;
        this.updateDoorsDisplay();
    }
    
    startRandomDoorChanges() {
        // Simulate people entering/exiting every 8-15 seconds (less frequent)
        this.doorChangeInterval = setInterval(() => {
            // 25% chance someone enters/exits each interval
            if (Math.random() < 0.25) {
                this.simulateDoorEntry();
            }
        }, 8000 + Math.random() * 7000); // Random interval between 8-15 seconds
    }
    
    simulateDoorEntry() {
        // Open the door
        this.doorsOpen = true;
        this.updateDoorsDisplay();
        
        // Auto-close after 2-4 seconds (realistic entry/exit time)
        const closeDelay = 2000 + Math.random() * 2000;
        setTimeout(() => {
            this.doorsOpen = false;
            this.updateDoorsDisplay();
        }, closeDelay);
    }
    
    stopRandomDoorChanges() {
        if (this.doorChangeInterval) {
            clearInterval(this.doorChangeInterval);
            this.doorChangeInterval = null;
        }
    }

    updateDoorsDisplay() {
        const accessToggle = document.getElementById('accessToggle');
        const accessIcon = document.getElementById('accessIcon');

        // Update doors display
        if (this.doorsOpen) {
            accessToggle.textContent = 'Open';
            accessToggle.className = 'px-3 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium transition-colors';
            accessIcon.setAttribute('data-lucide', 'shield-off');
        } else {
            accessToggle.textContent = 'Closed';
            accessToggle.className = 'px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium transition-colors';
            accessIcon.setAttribute('data-lucide', 'shield-check');
        }

        // Re-create icons
        lucide.createIcons();
    }
}

// Global function for button onclick
let globalMonitor = null;

function closeAlert() {
    if (globalMonitor) {
        globalMonitor.closeAlert();
    }
}

// Initialize the monitoring system when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    globalMonitor = new ColdChainMonitor();
    
    // Auto-start monitoring after 2 seconds
    setTimeout(() => {
        globalMonitor.startMonitoring();
    }, 2000);
});
