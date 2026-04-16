/**
 * Pharmaceutical Cold Chain Monitoring System - Enhanced Frontend
 * Features: ML Anomaly Detection, Severity Scoring, WebSocket Integration
 */

class EnhancedColdChainMonitor {
    constructor() {
        this.currentTemp = 5.0;
        this.currentHumidity = 50.0;
        this.isMonitoring = false;
        this.alerts = [];
        this.criticalAlerts = [];
        this.tempHistory = [];
        this.humidityHistory = [];
        this.anomalyScores = [];
        this.maxHistoryPoints = 50;
        this.safeRange = { min: 2, max: 8 };
        this.humiditySafeRange = { min: 40, max: 60 };
        this.humidityWarningRange = { min: 35, max: 65 };
        this.updateInterval = null;
        this.uptimeInterval = null;
        this.startTime = Date.now();
        this.lastAlertTime = 0;
        this.chart = null;
        this.anomalyChart = null;
        this.doorsOpen = false;
        this.doorChangeInterval = null;
        
        // WebSocket
        this.ws = null;
        this.wsConnected = false;
        
        // Backend API URL
        this.apiBase = window.location.origin;
        
        this.init();
    }

    async init() {
        this.setupCharts();
        this.bindEvents();
        this.updateDisplay();
        this.startUptimeCounter();
        this.connectWebSocket();
        this.loadInitialData();
        lucide.createIcons();
    }

    // ============================================
    // WebSocket Connection
    // ============================================
    
    connectWebSocket() {
        const wsUrl = window.location.origin.replace(/^http/, 'ws');
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
            console.log('WebSocket connected');
            this.wsConnected = true;
            this.updateConnectionStatus(true);
        };
        
        this.ws.onmessage = (event) => {
            const message = JSON.parse(event.data);
            this.handleWebSocketMessage(message);
        };
        
        this.ws.onclose = () => {
            console.log('WebSocket disconnected');
            this.wsConnected = false;
            this.updateConnectionStatus(false);
            // Reconnect after 5 seconds
            setTimeout(() => this.connectWebSocket(), 5000);
        };
        
        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
    }
    
    handleWebSocketMessage(message) {
        switch(message.type) {
            case 'alert':
                this.handleRealTimeAlert(message.data);
                break;
            case 'sensor_update':
                this.handleSensorUpdate(message.data);
                break;
            case 'initial':
                this.handleInitialData(message.data);
                break;
        }
    }
    
    handleRealTimeAlert(alert) {
        this.addAlertToPanel(alert);
        this.showToastNotification(alert);
        this.updateUnackedCount();
    }
    
    handleSensorUpdate(data) {
        // Update current values
        this.currentTemp = data.temperature;
        this.currentHumidity = data.humidity;
        
        // Add to history
        this.tempHistory.push({
            temp: data.temperature,
            humidity: data.humidity,
            anomaly_score: data.anomaly_score,
            timestamp: new Date()
        });
        
        if (this.tempHistory.length > this.maxHistoryPoints) {
            this.tempHistory.shift();
        }
        
        // Add anomaly score
        this.anomalyScores.push({
            score: data.anomaly_score,
            isAnomaly: data.is_anomaly,
            timestamp: new Date()
        });
        
        if (this.anomalyScores.length > this.maxHistoryPoints) {
            this.anomalyScores.shift();
        }
        
        this.updateDisplay();
        this.updateCharts();
    }
    
    handleInitialData(data) {
        console.log('Initial data received:', data);
    }
    
    updateConnectionStatus(connected) {
        const statusEl = document.getElementById('connectionStatus');
        if (connected) {
            statusEl.innerHTML = '<div class="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div><span class="text-sm text-gray-600">Connected</span>';
        } else {
            statusEl.innerHTML = '<div class="w-3 h-3 bg-red-500 rounded-full"></div><span class="text-sm text-gray-600">Disconnected</span>';
        }
    }

    // ============================================
    // API Integration
    // ============================================
    
    async loadInitialData() {
        try {
            // Load recent sensor history
            const response = await fetch(`${this.apiBase}/api/sensor/history?limit=50`);
            const history = await response.json();
            
            // Load anomaly scores
            const anomalyResponse = await fetch(`${this.apiBase}/api/anomaly/scores?limit=50`);
            const anomalyData = await anomalyResponse.json();
            
            // Load alerts
            const alertsResponse = await fetch(`${this.apiBase}/api/alerts?limit=20`);
            const alerts = await alertsResponse.json();
            
            // Load metrics
            const metricsResponse = await fetch(`${this.apiBase}/api/metrics`);
            const metrics = await metricsResponse.json();
            
            // Process and display data
            this.processHistoryData(history, anomalyData);
            this.renderAlertPanel(alerts);
            this.updateMetricsDisplay(metrics);
            this.loadBreaches();
            
        } catch (error) {
            console.error('Error loading initial data:', error);
        }
    }
    
    processHistoryData(history, anomalyData) {
        // Merge sensor data with anomaly scores
        this.tempHistory = history.map((reading, i) => ({
            temp: reading.temperature,
            humidity: reading.humidity,
            anomaly_score: anomalyData[i]?.anomaly_score || 0,
            timestamp: new Date(reading.timestamp)
        }));
        
        this.anomalyScores = anomalyData.map(score => ({
            score: score.anomaly_score,
            isAnomaly: score.is_anomaly,
            timestamp: new Date(score.timestamp)
        }));
    }
    
    async loadBreaches() {
        try {
            const response = await fetch(`${this.apiBase}/api/breaches?limit=10`);
            const breaches = await response.json();
            this.renderBreachTimeline(breaches);
        } catch (error) {
            console.error('Error loading breaches:', error);
        }
    }
    
    async sendSensorData(data) {
        try {
            const response = await fetch(`${this.apiBase}/api/sensor/ingest`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            return await response.json();
        } catch (error) {
            console.error('Error sending sensor data:', error);
        }
    }
    
    async acknowledgeAlert(alertId) {
        try {
            await fetch(`${this.apiBase}/api/alerts/${alertId}/acknowledge`, {
                method: 'POST'
            });
            this.updateUnackedCount();
        } catch (error) {
            console.error('Error acknowledging alert:', error);
        }
    }
    
    async updateConfig(key, value) {
        try {
            await fetch(`${this.apiBase}/api/config/${key}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ value })
            });
        } catch (error) {
            console.error('Error updating config:', error);
        }
    }

    // ============================================
    // Sensor Simulation
    // ============================================
    
    simulateSensors() {
        const previousTemp = this.currentTemp;
        const previousHumidity = this.currentHumidity;
        
        // Temperature simulation
        const targetTemp = 5.0 + Math.sin(Date.now() / 5000) * 4;
        const tempRandomInfluence = (Math.random() - 0.5) * 0.8;
        const tempDelta = (targetTemp - this.currentTemp) * 0.3 + tempRandomInfluence;
        this.currentTemp += tempDelta;
        
        // Occasional critical values
        if (Math.random() < 0.05) {
            if (Math.random() < 0.5) {
                this.currentTemp = this.safeRange.min - Math.random() * 2;
            } else {
                this.currentTemp = this.safeRange.max + Math.random() * 2;
            }
        }
        
        this.currentTemp = Math.max(-5, Math.min(15, this.currentTemp));
        
        // Humidity simulation
        const targetHumidity = 50.0 + Math.sin(Date.now() / 4000) * 15;
        const humidityRandomInfluence = (Math.random() - 0.5) * 3;
        const humidityDelta = (targetHumidity - this.currentHumidity) * 0.3 + humidityRandomInfluence;
        this.currentHumidity += humidityDelta;
        
        // Occasional critical humidity
        if (Math.random() < 0.05) {
            if (Math.random() < 0.5) {
                this.currentHumidity = this.humiditySafeRange.min - Math.random() * 10;
            } else {
                this.currentHumidity = this.humiditySafeRange.max + Math.random() * 10;
            }
        }
        
        this.currentHumidity = Math.max(20, Math.min(80, this.currentHumidity));
        
        // Send to backend
        const sensorData = {
            temperature: this.currentTemp,
            humidity: this.currentHumidity,
            doors_open: this.doorsOpen,
            storage_unit_id: 'unit-001',
            timestamp: new Date().toISOString()
        };
        
        this.sendSensorData(sensorData);
        
        // Update display
        this.updateDisplay();
    }

    // ============================================
    // Charts Setup
    // ============================================
    
    setupCharts() {
        this.setupTemperatureChart();
        this.setupAnomalyChart();
    }
    
    setupTemperatureChart() {
        const ctx = document.getElementById('temperatureChart').getContext('2d');
        
        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Temperature (°C)',
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
                    legend: { display: true, position: 'top' }
                },
                scales: {
                    x: {
                        ticks: { display: false },
                        grid: { display: false }
                    },
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: { display: true, text: 'Temperature (°C)' },
                        min: -5,
                        max: 15
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: { display: true, text: 'Humidity (%)' },
                        min: 20,
                        max: 80,
                        grid: { drawOnChartArea: false }
                    }
                }
            }
        });
    }
    
    setupAnomalyChart() {
        const ctx = document.getElementById('anomalyChart').getContext('2d');
        
        this.anomalyChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Anomaly Score',
                    data: [],
                    borderColor: 'rgb(239, 68, 68)',
                    backgroundColor: (context) => {
                        const value = context.raw;
                        if (value > 0.6) return 'rgba(239, 68, 68, 0.3)';
                        if (value > 0.4) return 'rgba(234, 179, 8, 0.3)';
                        return 'rgba(34, 197, 94, 0.1)';
                    },
                    pointBackgroundColor: (context) => {
                        const value = context.raw;
                        if (value > 0.6) return 'rgb(239, 68, 68)';
                        if (value > 0.4) return 'rgb(234, 179, 8)';
                        return 'rgb(34, 197, 94)';
                    },
                    tension: 0.4,
                    fill: true,
                    pointRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    annotation: {
                        annotations: {
                            threshold: {
                                type: 'line',
                                yMin: 0.6,
                                yMax: 0.6,
                                borderColor: 'rgba(239, 68, 68, 0.8)',
                                borderWidth: 2,
                                borderDash: [5, 5],
                                label: {
                                    content: 'Threshold (0.6)',
                                    enabled: true,
                                    position: 'end'
                                }
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: { display: false },
                        grid: { display: false }
                    },
                    y: {
                        min: 0,
                        max: 1,
                        title: { display: true, text: 'Anomaly Score' }
                    }
                }
            }
        });
    }
    
    updateCharts() {
        // Update temperature/humidity chart
        if (!this.chart) return;
        
        const labels = this.tempHistory.map(point => 
            point.timestamp.toLocaleTimeString()
        );
        const tempData = this.tempHistory.map(point => point.temp);
        const humidityData = this.tempHistory.map(point => point.humidity);
        
        this.chart.data.labels = labels;
        this.chart.data.datasets[0].data = tempData;
        this.chart.data.datasets[1].data = humidityData;
        this.chart.update('none');
        
        // Update anomaly chart
        if (!this.anomalyChart) return;
        
        const anomalyLabels = this.anomalyScores.map(point =>
            point.timestamp.toLocaleTimeString()
        );
        const anomalyData = this.anomalyScores.map(point => point.score);
        
        this.anomalyChart.data.labels = anomalyLabels;
        this.anomalyChart.data.datasets[0].data = anomalyData;
        this.anomalyChart.update('none');
    }

    // ============================================
    // Display Updates
    // ============================================
    
    updateDisplay() {
        // Temperature display
        const tempDisplay = document.getElementById('temperatureDisplay');
        tempDisplay.textContent = `${this.currentTemp.toFixed(1)}°Celsius`;
        
        // Humidity display
        const humidityDisplay = document.getElementById('humidityDisplay');
        humidityDisplay.textContent = `${this.currentHumidity.toFixed(1)}%`;
        
        // Temperature status
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
        
        // Humidity status with warning level
        const humidityStatusIndicator = document.getElementById('humidityStatusIndicator');
        const humidityCard = document.getElementById('humidityCard');
        
        const isHumiditySafe = this.currentHumidity >= this.humiditySafeRange.min && this.currentHumidity <= this.humiditySafeRange.max;
        const isHumidityWarning = !isHumiditySafe && 
            (this.currentHumidity >= this.humidityWarningRange.min && this.currentHumidity <= this.humidityWarningRange.max);
        const isHumidityCritical = !isHumiditySafe && !isHumidityWarning;
        
        if (this.doorsOpen) {
            humidityStatusIndicator.className = 'inline-flex items-center px-4 py-2 rounded-full text-sm font-medium bg-gray-100 text-gray-700';
            humidityStatusIndicator.innerHTML = '<div class="w-2 h-2 rounded-full mr-2 bg-gray-500"></div>DOORS OPEN';
            humidityCard.classList.remove('critical-pulse');
        } else if (isHumidityCritical) {
            humidityStatusIndicator.className = 'inline-flex items-center px-4 py-2 rounded-full text-sm font-medium bg-red-100 text-red-700';
            humidityStatusIndicator.innerHTML = '<div class="w-2 h-2 rounded-full mr-2 bg-red-500 animate-pulse"></div>CRITICAL';
            humidityCard.classList.add('critical-pulse');
        } else if (isHumidityWarning) {
            humidityStatusIndicator.className = 'inline-flex items-center px-4 py-2 rounded-full text-sm font-medium bg-yellow-100 text-yellow-700';
            humidityStatusIndicator.innerHTML = '<div class="w-2 h-2 rounded-full mr-2 bg-yellow-500"></div>WARNING';
            humidityCard.classList.remove('critical-pulse');
        } else {
            humidityStatusIndicator.className = 'inline-flex items-center px-4 py-2 rounded-full text-sm font-medium bg-green-100 text-green-700';
            humidityStatusIndicator.innerHTML = '<div class="w-2 h-2 rounded-full mr-2 bg-green-500"></div>NORMAL';
            humidityCard.classList.remove('critical-pulse');
        }
        
        // System status
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
        
        document.getElementById('alertCount').textContent = this.criticalAlerts.length;
        document.getElementById('lastUpdate').textContent = `Last: ${new Date().toLocaleTimeString()}`;
    }
    
    updateMetricsDisplay(metrics) {
        document.getElementById('metricRecall').textContent = (metrics.recall * 100).toFixed(1) + '%';
        document.getElementById('metricPrecision').textContent = (metrics.precision * 100).toFixed(1) + '%';
        document.getElementById('metricFalseAlarm').textContent = metrics.falseAlarmRate.toFixed(1) + '/1000';
        document.getElementById('metricF1').textContent = (metrics.f1Score * 100).toFixed(1) + '%';
        document.getElementById('metricWindowSize').textContent = metrics.totalReadings;
    }

    // ============================================
    // Alert Panel Rendering
    // ============================================
    
    renderAlertPanel(alerts) {
        const panel = document.getElementById('alertPanel');
        
        if (!alerts || alerts.length === 0) {
            panel.innerHTML = '<p class="text-gray-500 text-center py-4">No active alerts</p>';
            return;
        }
        
        panel.innerHTML = alerts.map(alert => {
            const severityColors = {
                'Critical': 'bg-red-100 border-red-300 text-red-800',
                'Medium': 'bg-yellow-100 border-yellow-300 text-yellow-800',
                'Low': 'bg-blue-100 border-blue-300 text-blue-800'
            };
            
            const colorClass = severityColors[alert.severity_label] || 'bg-gray-100 border-gray-300';
            
            return `
                <div class="border rounded-lg p-3 ${colorClass} ${alert.acknowledged ? 'opacity-50' : ''}">
                    <div class="flex justify-between items-start">
                        <div>
                            <span class="font-semibold text-sm">${alert.severity_label} Severity</span>
                            <p class="text-xs mt-1">${alert.message}</p>
                            <p class="text-xs mt-1">Anomaly: ${(alert.anomaly_score * 100).toFixed(1)}%</p>
                        </div>
                        ${!alert.acknowledged ? `
                            <button onclick="monitor.acknowledgeAlert(${alert.id})" 
                                class="text-xs bg-white px-2 py-1 rounded border hover:bg-gray-50">
                                Ack
                            </button>
                        ` : '<span class="text-xs">✓</span>'}
                    </div>
                    <p class="text-xs mt-2 opacity-75">${new Date(alert.timestamp).toLocaleString()}</p>
                </div>
            `;
        }).join('');
        
        this.updateUnackedCount();
    }
    
    addAlertToPanel(alert) {
        const panel = document.getElementById('alertPanel');
        
        // Remove "no alerts" message if exists
        if (panel.querySelector('p.text-center')) {
            panel.innerHTML = '';
        }
        
        const severityColors = {
            'Critical': 'bg-red-100 border-red-300 text-red-800',
            'Medium': 'bg-yellow-100 border-yellow-300 text-yellow-800',
            'Low': 'bg-blue-100 border-blue-300 text-blue-800'
        };
        
        const colorClass = severityColors[alert.severity_label] || 'bg-gray-100 border-gray-300';
        
        const alertHtml = `
            <div class="border rounded-lg p-3 ${colorClass} animate-pulse" id="alert-${alert.id}">
                <div class="flex justify-between items-start">
                    <div>
                        <span class="font-semibold text-sm">${alert.severity_label} Severity</span>
                        <p class="text-xs mt-1">${alert.message}</p>
                        <p class="text-xs mt-1">Anomaly: ${(alert.anomaly_score * 100).toFixed(1)}%</p>
                    </div>
                    <button onclick="monitor.acknowledgeAlert(${alert.id})" 
                        class="text-xs bg-white px-2 py-1 rounded border hover:bg-gray-50">
                        Ack
                    </button>
                </div>
                <p class="text-xs mt-2 opacity-75">${new Date(alert.timestamp).toLocaleString()}</p>
            </div>
        `;
        
        panel.insertAdjacentHTML('afterbegin', alertHtml);
        this.updateUnackedCount();
    }
    
    updateUnackedCount() {
        const unacked = document.querySelectorAll('#alertPanel > div:not(.opacity-50)').length;
        document.getElementById('unackedAlertCount').textContent = unacked;
    }
    
    renderBreachTimeline(breaches) {
        const timeline = document.getElementById('breachTimeline');
        
        if (!breaches || breaches.length === 0) {
            timeline.innerHTML = '<p class="text-gray-500 text-center py-4">No breaches recorded</p>';
            return;
        }
        
        timeline.innerHTML = breaches.map(breach => {
            const breachTypeColors = {
                'temperature': 'bg-orange-100 border-orange-300',
                'humidity': 'bg-blue-100 border-blue-300',
                'both': 'bg-red-100 border-red-300'
            };
            
            const colorClass = breachTypeColors[breach.breach_type] || 'bg-gray-100 border-gray-300';
            const start = new Date(breach.start_time);
            const end = breach.end_time ? new Date(breach.end_time) : new Date();
            const duration = ((end - start) / 60000).toFixed(1);
            
            return `
                <div class="border-l-4 ${colorClass} pl-3 py-2">
                    <div class="flex justify-between items-start">
                        <span class="font-semibold text-sm capitalize">${breach.breach_type} Breach</span>
                        <span class="text-xs">${duration} min</span>
                    </div>
                    <p class="text-xs mt-1">${start.toLocaleString()}</p>
                    ${breach.end_time ? `<p class="text-xs opacity-75">Ended: ${new Date(breach.end_time).toLocaleTimeString()}</p>` : '<p class="text-xs text-red-600 font-semibold">ONGOING</p>'}
                </div>
            `;
        }).join('');
    }

    // ============================================
    // Notifications
    // ============================================
    
    showToastNotification(alert) {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = 'fixed top-4 right-4 z-50 max-w-sm w-full bg-white rounded-lg shadow-lg border-l-4 ' + 
            (alert.severity_label === 'Critical' ? 'border-red-500' : 
             alert.severity_label === 'Medium' ? 'border-yellow-500' : 'border-blue-500') + 
            ' p-4 transform translate-x-full transition-transform duration-300';
        
        notification.innerHTML = `
            <div class="flex items-start">
                <div class="flex-shrink-0">
                    <i data-lucide="alert-triangle" class="w-5 h-5 ${
                        alert.severity_label === 'Critical' ? 'text-red-500' : 
                        alert.severity_label === 'Medium' ? 'text-yellow-500' : 'text-blue-500'
                    }"></i>
                </div>
                <div class="ml-3 w-0 flex-1">
                    <p class="text-sm font-medium text-gray-900">${alert.severity_label} Severity Alert</p>
                    <p class="text-sm text-gray-500 mt-1">${alert.message}</p>
                    <p class="text-xs text-gray-400 mt-1">Anomaly: ${(alert.anomaly_score * 100).toFixed(1)}%</p>
                </div>
                <button class="ml-4 flex-shrink-0 text-gray-400 hover:text-gray-500" onclick="this.parentElement.parentElement.remove()">
                    <i data-lucide="x" class="w-4 h-4"></i>
                </button>
            </div>
        `;
        
        document.body.appendChild(notification);
        lucide.createIcons();
        
        // Animate in
        setTimeout(() => {
            notification.classList.remove('translate-x-full');
        }, 10);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            notification.classList.add('translate-x-full');
            setTimeout(() => notification.remove(), 300);
        }, 5000);
    }

    // ============================================
    // Event Binding
    // ============================================
    
    bindEvents() {
        document.getElementById('toggleMonitoring').addEventListener('click', () => {
            if (this.isMonitoring) {
                this.stopMonitoring();
            } else {
                this.startMonitoring();
            }
        });
        
        document.getElementById('resetAlerts').addEventListener('click', () => {
            if (confirm('Clear all alerts?')) {
                this.resetAlerts();
            }
        });
        
        // Anomaly threshold slider
        const thresholdSlider = document.getElementById('anomalyThreshold');
        const thresholdValue = document.getElementById('anomalyThresholdValue');
        
        thresholdSlider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            thresholdValue.textContent = value.toFixed(2);
        });
        
        thresholdSlider.addEventListener('change', (e) => {
            this.updateConfig('anomaly_threshold', parseFloat(e.target.value));
        });
        
        // Window size selector
        document.getElementById('windowSize').addEventListener('change', (e) => {
            this.updateConfig('window_size', parseInt(e.target.value));
        });
        
        // Retrain model button
        document.getElementById('retrainModel').addEventListener('click', async () => {
            try {
                const response = await fetch(`${this.apiBase}/api/config/retrain`, { method: 'POST' });
                if (response.ok) {
                    alert('Model retraining initiated');
                }
            } catch (error) {
                console.error('Error retraining model:', error);
                alert('Failed to retrain model');
            }
        });
        
        // Export data button
        document.getElementById('exportData').addEventListener('click', () => {
            this.exportData();
        });
    }
    
    async exportData() {
        try {
            const [sensorData, alerts, breaches] = await Promise.all([
                fetch(`${this.apiBase}/api/sensor/history?limit=1000`).then(r => r.json()),
                fetch(`${this.apiBase}/api/alerts?limit=1000`).then(r => r.json()),
                fetch(`${this.apiBase}/api/breaches?limit=1000`).then(r => r.json())
            ]);
            
            const exportObj = {
                exportDate: new Date().toISOString(),
                sensorReadings: sensorData,
                alerts: alerts,
                breaches: breaches
            };
            
            const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `coldchain-export-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error exporting data:', error);
            alert('Failed to export data');
        }
    }
    
    startMonitoring() {
        if (this.isMonitoring) return;
        
        this.isMonitoring = true;
        this.updateInterval = setInterval(() => {
            this.simulateSensors();
        }, 1500);
        
        this.startRandomDoorChanges();
        
        const btn = document.getElementById('toggleMonitoring');
        btn.innerHTML = '<i data-lucide="pause" class="w-4 h-4"></i><span>Stop Monitoring</span>';
        btn.classList.remove('bg-blue-600', 'hover:bg-blue-700');
        btn.classList.add('bg-red-600', 'hover:bg-red-700');
        lucide.createIcons();
    }
    
    stopMonitoring() {
        if (!this.isMonitoring) return;
        
        this.isMonitoring = false;
        clearInterval(this.updateInterval);
        this.stopRandomDoorChanges();
        
        const btn = document.getElementById('toggleMonitoring');
        btn.innerHTML = '<i data-lucide="play" class="w-4 h-4"></i><span>Start Monitoring</span>';
        btn.classList.remove('bg-red-600', 'hover:bg-red-700');
        btn.classList.add('bg-blue-600', 'hover:bg-blue-700');
        lucide.createIcons();
    }
    
    resetAlerts() {
        this.alerts = [];
        this.criticalAlerts = [];
        this.tempHistory = [];
        this.humidityHistory = [];
        this.anomalyScores = [];
        this.updateCharts();
        this.updateDisplay();
    }
    
    startUptimeCounter() {
        this.uptimeInterval = setInterval(() => {
            const uptime = Date.now() - this.startTime;
            const hours = Math.floor(uptime / 3600000);
            const minutes = Math.floor((uptime % 3600000) / 60000);
            const seconds = Math.floor((uptime % 60000) / 1000);
            
            document.getElementById('uptime').textContent = 
                `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }, 1000);
    }
    
    startRandomDoorChanges() {
        this.doorChangeInterval = setInterval(() => {
            if (Math.random() < 0.25) {
                this.simulateDoorEntry();
            }
        }, 8000 + Math.random() * 7000);
    }
    
    simulateDoorEntry() {
        this.doorsOpen = true;
        this.updateDoorsDisplay();
        
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
        
        if (this.doorsOpen) {
            accessToggle.textContent = 'Open';
            accessToggle.className = 'px-3 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium transition-colors';
            accessIcon.setAttribute('data-lucide', 'shield-off');
        } else {
            accessToggle.textContent = 'Closed';
            accessToggle.className = 'px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium transition-colors';
            accessIcon.setAttribute('data-lucide', 'shield-check');
        }
        
        lucide.createIcons();
        this.updateDisplay(); // Update humidity status based on door state
    }
}

// Global instance
let monitor;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    monitor = new EnhancedColdChainMonitor();
    
    // Auto-start after 2 seconds
    setTimeout(() => {
        monitor.startMonitoring();
    }, 2000);
});

// Global close alert function
function closeAlert() {
    const modal = document.getElementById('alertModal');
    const alertContent = document.getElementById('alertContent');
    
    alertContent.classList.remove('scale-100', 'opacity-100');
    alertContent.classList.add('scale-95', 'opacity-0');
    
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 300);
}
