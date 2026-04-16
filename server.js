/**
 * Pharmaceutical Cold Chain Monitoring System - Backend Server
 * Features: ML Anomaly Detection, Severity Scoring, Intelligent Alerts, WebSocket
 */

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname)));

// Database setup
const db = new sqlite3.Database('./coldchain.db');

// Initialize database tables
db.serialize(() => {
    // Sensor readings table
    db.run(`CREATE TABLE IF NOT EXISTS sensor_readings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        temperature REAL,
        humidity REAL,
        doors_open BOOLEAN,
        storage_unit_id TEXT DEFAULT 'unit-001'
    )`);

    // Anomaly scores table
    db.run(`CREATE TABLE IF NOT EXISTS anomaly_scores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        reading_id INTEGER,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        anomaly_score REAL,
        is_anomaly BOOLEAN,
        model_type TEXT,
        FOREIGN KEY (reading_id) REFERENCES sensor_readings(id)
    )`);

    // Alerts table
    db.run(`CREATE TABLE IF NOT EXISTS alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        storage_unit_id TEXT,
        temperature REAL,
        humidity REAL,
        severity_score REAL,
        severity_label TEXT,
        anomaly_score REAL,
        duration_minutes REAL,
        message TEXT,
        acknowledged BOOLEAN DEFAULT 0
    )`);

    // Breaches table for tracking
    db.run(`CREATE TABLE IF NOT EXISTS breaches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        start_time DATETIME,
        end_time DATETIME,
        storage_unit_id TEXT,
        breach_type TEXT,
        max_severity REAL,
        duration_minutes REAL
    )`);

    // Evaluation metrics table
    db.run(`CREATE TABLE IF NOT EXISTS evaluation_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        metric_name TEXT,
        metric_value REAL,
        window_size INTEGER
    )`);

    // Model configuration
    db.run(`CREATE TABLE IF NOT EXISTS model_config (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        config_key TEXT UNIQUE,
        config_value REAL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Insert default configuration
    db.run(`INSERT OR IGNORE INTO model_config (config_key, config_value) VALUES 
        ('anomaly_threshold', 0.6),
        ('isolation_forest_trees', 100),
        ('isolation_forest_sample_size', 256),
        ('window_size', 30),
        ('severity_threshold_low', 10),
        ('severity_threshold_medium', 50)`);
});

// ============================================
// ML Anomaly Detection - Isolation Forest
// ============================================

class IsolationForest {
    constructor(numTrees = 100, sampleSize = 256) {
        this.numTrees = numTrees;
        this.sampleSize = sampleSize;
        this.trees = [];
        this.trainingData = [];
    }

    // Train the model on normal data
    train(data) {
        this.trainingData = data;
        this.trees = [];
        
        for (let i = 0; i < this.numTrees; i++) {
            // Sample data
            const sample = this.sample(data, this.sampleSize);
            // Build tree
            const tree = this.buildTree(sample, 0, Math.ceil(Math.log2(this.sampleSize)));
            this.trees.push(tree);
        }
    }

    // Sample random subset
    sample(data, size) {
        const shuffled = [...data].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, Math.min(size, data.length));
    }

    // Build isolation tree
    buildTree(data, currentHeight, heightLimit) {
        if (currentHeight >= heightLimit || data.length <= 1) {
            return { type: 'external', size: data.length };
        }

        const numFeatures = data[0].length;
        const splitFeature = Math.floor(Math.random() * numFeatures);
        
        const values = data.map(d => d[splitFeature]);
        const min = Math.min(...values);
        const max = Math.max(...values);
        
        if (min === max) {
            return { type: 'external', size: data.length };
        }

        const splitValue = min + Math.random() * (max - min);
        
        const left = data.filter(d => d[splitFeature] < splitValue);
        const right = data.filter(d => d[splitFeature] >= splitValue);

        return {
            type: 'internal',
            splitFeature,
            splitValue,
            left: this.buildTree(left, currentHeight + 1, heightLimit),
            right: this.buildTree(right, currentHeight + 1, heightLimit)
        };
    }

    // Calculate anomaly score for a point
    score(point) {
        if (this.trees.length === 0) return 0;
        
        const pathLengths = this.trees.map(tree => this.pathLength(point, tree, 0));
        const avgPathLength = pathLengths.reduce((a, b) => a + b, 0) / pathLengths.length;
        
        // Normalize and convert to anomaly score (0-1)
        const expectedLength = this.c(this.trainingData.length);
        const score = Math.pow(2, -avgPathLength / expectedLength);
        
        return Math.min(1, Math.max(0, score));
    }

    // Path length calculation
    pathLength(point, tree, currentHeight) {
        if (tree.type === 'external') {
            return currentHeight + this.c(tree.size);
        }

        if (point[tree.splitFeature] < tree.splitValue) {
            return this.pathLength(point, tree.left, currentHeight + 1);
        } else {
            return this.pathLength(point, tree.right, currentHeight + 1);
        }
    }

    // Average path length for external nodes
    c(n) {
        if (n <= 1) return 0;
        return 2 * (Math.log(n - 1) + 0.5772156649) - (2 * (n - 1) / n);
    }
}

// ============================================
// Severity Scoring Engine
// ============================================

class SeverityScoringEngine {
    constructor() {
        this.tempSafeRange = { min: 2, max: 8 };
        this.humiditySafeRange = { min: 40, max: 60 };
        this.thresholds = { low: 10, medium: 50 };
    }

    // Calculate severity for temperature breach
    calculateTemperatureSeverity(temp, durationMinutes) {
        if (temp >= this.tempSafeRange.min && temp <= this.tempSafeRange.max) {
            return { score: 0, label: 'Normal' };
        }

        // Magnitude = deviation from nearest safe limit
        let magnitude;
        if (temp < this.tempSafeRange.min) {
            magnitude = this.tempSafeRange.min - temp;
        } else {
            magnitude = temp - this.tempSafeRange.max;
        }

        // Severity Score = Magnitude × Duration
        const score = magnitude * durationMinutes;

        return {
            score: score,
            magnitude: magnitude,
            duration: durationMinutes,
            label: this.getSeverityLabel(score)
        };
    }

    // Calculate severity for humidity breach
    calculateHumiditySeverity(humidity, durationMinutes) {
        if (humidity >= this.humiditySafeRange.min && humidity <= this.humiditySafeRange.max) {
            return { score: 0, label: 'Normal' };
        }

        let magnitude;
        if (humidity < this.humiditySafeRange.min) {
            magnitude = this.humiditySafeRange.min - humidity;
        } else {
            magnitude = humidity - this.humiditySafeRange.max;
        }

        const score = magnitude * durationMinutes;

        return {
            score: score,
            magnitude: magnitude,
            duration: durationMinutes,
            label: this.getSeverityLabel(score)
        };
    }

    // Get severity label based on score
    getSeverityLabel(score) {
        if (score < this.thresholds.low) return 'Low';
        if (score < this.thresholds.medium) return 'Medium';
        return 'Critical';
    }

    // Calculate combined severity
    calculateCombinedSeverity(tempSeverity, humiditySeverity) {
        const combined = tempSeverity.score + humiditySeverity.score;
        return {
            score: combined,
            label: this.getSeverityLabel(combined),
            components: {
                temperature: tempSeverity,
                humidity: humiditySeverity
            }
        };
    }
}

// ============================================
// Intelligent Alert Engine
// ============================================

class IntelligentAlertEngine {
    constructor(db, severityEngine, isolationForest) {
        this.db = db;
        this.severityEngine = severityEngine;
        this.isolationForest = isolationForest;
        this.activeBreaches = new Map();
        this.alertHistory = [];
        this.breachCounter = 0;
    }

    // Process new sensor reading
    async processReading(reading) {
        const { temperature, humidity, timestamp, doors_open, storage_unit_id } = reading;
        
        // Store reading
        const readingId = await this.storeReading(reading);
        
        // Get sliding window of recent readings
        const windowData = await this.getRecentReadings(30);
        
        // Calculate anomaly score
        const anomalyResult = this.calculateAnomaly(windowData, temperature, humidity);
        await this.storeAnomalyScore(readingId, anomalyResult);
        
        // Check for breaches and calculate severity
        const breachStatus = this.checkBreachStatus(storage_unit_id, temperature, humidity, doors_open);
        
        // Generate alert if conditions met
        if (breachStatus.shouldAlert && !doors_open) {
            const severity = this.calculateBreachSeverity(breachStatus);
            const alert = await this.generateAlert(reading, severity, anomalyResult);
            this.broadcastAlert(alert);
        }
        
        return {
            readingId,
            anomalyScore: anomalyResult.score,
            isAnomaly: anomalyResult.isAnomaly,
            breachStatus
        };
    }

    // Store sensor reading
    storeReading(reading) {
        return new Promise((resolve, reject) => {
            const sql = `INSERT INTO sensor_readings (temperature, humidity, doors_open, storage_unit_id) 
                        VALUES (?, ?, ?, ?)`;
            db.run(sql, [reading.temperature, reading.humidity, reading.doors_open, reading.storage_unit_id || 'unit-001'], 
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                });
        });
    }

    // Get recent readings for sliding window
    getRecentReadings(limit) {
        return new Promise((resolve, reject) => {
            const sql = `SELECT * FROM sensor_readings ORDER BY timestamp DESC LIMIT ?`;
            db.all(sql, [limit], (err, rows) => {
                if (err) reject(err);
                else resolve(rows.reverse());
            });
        });
    }

    // Calculate anomaly using Isolation Forest
    calculateAnomaly(windowData, currentTemp, currentHumidity) {
        if (windowData.length < 10) {
            return { score: 0, isAnomaly: false, model: 'insufficient_data' };
        }
        
        // Prepare feature vector: [temperature, humidity, temp_rate_of_change, humidity_rate_of_change]
        const features = windowData.map((row, i) => {
            const tempChange = i > 0 ? row.temperature - windowData[i-1].temperature : 0;
            const humidityChange = i > 0 ? row.humidity - windowData[i-1].humidity : 0;
            return [row.temperature, row.humidity, tempChange, humidityChange];
        });
        
        // Train model if not trained
        if (this.isolationForest.trees.length === 0) {
            this.isolationForest.train(features);
        }
        
        // Calculate current point features
        const lastRow = windowData[windowData.length - 1];
        const tempChange = currentTemp - lastRow.temperature;
        const humidityChange = currentHumidity - lastRow.humidity;
        const currentPoint = [currentTemp, currentHumidity, tempChange, humidityChange];
        
        // Get anomaly score
        const score = this.isolationForest.score(currentPoint);
        const threshold = 0.6; // Configurable threshold
        
        return {
            score: score,
            isAnomaly: score > threshold,
            model: 'isolation_forest',
            threshold: threshold
        };
    }

    // Store anomaly score
    storeAnomalyScore(readingId, anomalyResult) {
        return new Promise((resolve, reject) => {
            const sql = `INSERT INTO anomaly_scores (reading_id, anomaly_score, is_anomaly, model_type) 
                        VALUES (?, ?, ?, ?)`;
            db.run(sql, [readingId, anomalyResult.score, anomalyResult.isAnomaly, anomalyResult.model], 
                (err) => {
                    if (err) reject(err);
                    else resolve();
                });
        });
    }

    // Check breach status
    checkBreachStatus(unitId, temp, humidity, doorsOpen) {
        const tempSafe = temp >= 2 && temp <= 8;
        const humiditySafe = humidity >= 40 && humidity <= 60;
        
        const key = `${unitId}`;
        let breach = this.activeBreaches.get(key);
        
        if (!tempSafe || !humiditySafe) {
            if (!breach) {
                breach = {
                    id: ++this.breachCounter,
                    startTime: new Date(),
                    unitId,
                    maxTemp: temp,
                    minTemp: temp,
                    maxHumidity: humidity,
                    minHumidity: humidity,
                    tempBreaches: !tempSafe,
                    humidityBreaches: !humiditySafe,
                    doorsOpen
                };
                this.activeBreaches.set(key, breach);
            } else {
                // Update breach data
                breach.maxTemp = Math.max(breach.maxTemp, temp);
                breach.minTemp = Math.min(breach.minTemp, temp);
                breach.maxHumidity = Math.max(breach.maxHumidity, humidity);
                breach.minHumidity = Math.min(breach.minHumidity, humidity);
                breach.tempBreaches = breach.tempBreaches || !tempSafe;
                breach.humidityBreaches = breach.humidityBreaches || !humiditySafe;
            }
            
            return {
                isBreaching: true,
                shouldAlert: !doorsOpen, // Don't alert if doors are open
                breach,
                isNewBreach: breach.startTime === new Date()
            };
        } else {
            // Breach ended
            if (breach) {
                breach.endTime = new Date();
                this.storeBreach(breach);
                this.activeBreaches.delete(key);
            }
            
            return {
                isBreaching: false,
                shouldAlert: false,
                breach: null
            };
        }
    }

    // Calculate severity for active breach
    calculateBreachSeverity(breachStatus) {
        const breach = breachStatus.breach;
        const durationMinutes = (new Date() - breach.startTime) / 60000;
        
        const tempSeverity = this.severityEngine.calculateTemperatureSeverity(
            breach.maxTemp > 8 ? breach.maxTemp : breach.minTemp, 
            durationMinutes
        );
        
        const humiditySeverity = this.severityEngine.calculateHumiditySeverity(
            breach.maxHumidity > 60 ? breach.maxHumidity : breach.minHumidity,
            durationMinutes
        );
        
        return this.severityEngine.calculateCombinedSeverity(tempSeverity, humiditySeverity);
    }

    // Generate alert
    async generateAlert(reading, severity, anomalyResult) {
        const breach = this.activeBreaches.get(reading.storage_unit_id || 'unit-001');
        const durationMinutes = breach ? (new Date() - breach.startTime) / 60000 : 0;
        
        const alert = {
            timestamp: new Date().toISOString(),
            storage_unit_id: reading.storage_unit_id || 'unit-001',
            temperature: reading.temperature,
            humidity: reading.humidity,
            severity_score: severity.score,
            severity_label: severity.label,
            anomaly_score: anomalyResult.score,
            duration_minutes: durationMinutes,
            message: this.generateAlertMessage(reading, severity, breach),
            breach_type: this.getBreachType(breach)
        };
        
        // Store alert
        await this.storeAlert(alert);
        this.alertHistory.push(alert);
        
        return alert;
    }

    // Generate alert message
    generateAlertMessage(reading, severity, breach) {
        const parts = [];
        
        if (breach.tempBreaches) {
            if (reading.temperature < 2) {
                parts.push(`Temperature too low: ${reading.temperature.toFixed(1)}°C (below 2°C)`);
            } else {
                parts.push(`Temperature too high: ${reading.temperature.toFixed(1)}°C (above 8°C)`);
            }
        }
        
        if (breach.humidityBreaches) {
            if (reading.humidity < 40) {
                parts.push(`Humidity too low: ${reading.humidity.toFixed(1)}% (below 40%)`);
            } else {
                parts.push(`Humidity too high: ${reading.humidity.toFixed(1)}% (above 60%)`);
            }
        }
        
        parts.push(`Severity: ${severity.label} (Score: ${severity.score.toFixed(1)})`);
        parts.push(`Anomaly Score: ${(reading.anomaly_score * 100).toFixed(1)}%`);
        
        return parts.join('. ');
    }

    // Get breach type
    getBreachType(breach) {
        if (breach.tempBreaches && breach.humidityBreaches) return 'both';
        if (breach.tempBreaches) return 'temperature';
        if (breach.humidityBreaches) return 'humidity';
        return 'unknown';
    }

    // Store alert in database
    storeAlert(alert) {
        return new Promise((resolve, reject) => {
            const sql = `INSERT INTO alerts 
                (storage_unit_id, temperature, humidity, severity_score, severity_label, 
                 anomaly_score, duration_minutes, message) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
            db.run(sql, [
                alert.storage_unit_id, alert.temperature, alert.humidity,
                alert.severity_score, alert.severity_label, alert.anomaly_score,
                alert.duration_minutes, alert.message
            ], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    // Store breach in database
    storeBreach(breach) {
        const duration = (breach.endTime - breach.startTime) / 60000;
        
        const sql = `INSERT INTO breaches 
            (start_time, end_time, storage_unit_id, breach_type, duration_minutes) 
            VALUES (?, ?, ?, ?, ?)`;
        db.run(sql, [
            breach.startTime.toISOString(),
            breach.endTime.toISOString(),
            breach.unitId,
            this.getBreachType(breach),
            duration
        ]);
    }

    // Broadcast alert via WebSocket
    broadcastAlert(alert) {
        const message = JSON.stringify({
            type: 'alert',
            data: alert
        });
        
        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    }

    // Broadcast sensor update
    broadcastSensorUpdate(reading, anomalyResult) {
        const message = JSON.stringify({
            type: 'sensor_update',
            data: {
                ...reading,
                anomaly_score: anomalyResult.score,
                is_anomaly: anomalyResult.isAnomaly
            }
        });
        
        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    }
}

// ============================================
// Evaluation Metrics Tracker
// ============================================

class EvaluationMetricsTracker {
    constructor(db) {
        this.db = db;
        this.metrics = {
            totalReadings: 0,
            truePositives: 0,
            falsePositives: 0,
            falseNegatives: 0,
            trueNegatives: 0
        };
    }

    // Record prediction vs actual
    recordPrediction(predictedAnomaly, actualBreach) {
        this.metrics.totalReadings++;
        
        if (predictedAnomaly && actualBreach) {
            this.metrics.truePositives++;
        } else if (predictedAnomaly && !actualBreach) {
            this.metrics.falsePositives++;
        } else if (!predictedAnomaly && actualBreach) {
            this.metrics.falseNegatives++;
        } else {
            this.metrics.trueNegatives++;
        }
    }

    // Calculate metrics
    calculateMetrics() {
        const tp = this.metrics.truePositives;
        const fp = this.metrics.falsePositives;
        const fn = this.metrics.falseNegatives;
        const tn = this.metrics.trueNegatives;
        const total = this.metrics.totalReadings;
        
        return {
            recall: tp / (tp + fn) || 0,
            precision: tp / (tp + fp) || 0,
            falseAlarmRate: (fp / total * 1000) || 0, // Per 1000 readings
            accuracy: (tp + tn) / total || 0,
            f1Score: (2 * tp) / (2 * tp + fp + fn) || 0,
            totalReadings: total
        };
    }

    // Store metrics
    async storeMetrics() {
        const metrics = this.calculateMetrics();
        const timestamp = new Date().toISOString();
        
        const promises = Object.entries(metrics).map(([key, value]) => {
            return new Promise((resolve, reject) => {
                const sql = `INSERT INTO evaluation_metrics (metric_name, metric_value, window_size) VALUES (?, ?, ?)`;
                this.db.run(sql, [key, value, this.metrics.totalReadings], (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
        });
        
        await Promise.all(promises);
        return metrics;
    }
}

// ============================================
// Initialize Components
// ============================================

const isolationForest = new IsolationForest(100, 256);
const severityEngine = new SeverityScoringEngine();
const alertEngine = new IntelligentAlertEngine(db, severityEngine, isolationForest);
const metricsTracker = new EvaluationMetricsTracker(db);

// ============================================
// API Routes
// ============================================

// Get current sensor data
app.get('/api/sensor/current', (req, res) => {
    const sql = `SELECT * FROM sensor_readings ORDER BY timestamp DESC LIMIT 1`;
    db.get(sql, (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json(row);
        }
    });
});

// Get sensor history
app.get('/api/sensor/history', (req, res) => {
    const limit = parseInt(req.query.limit) || 100;
    const sql = `SELECT * FROM sensor_readings ORDER BY timestamp DESC LIMIT ?`;
    db.all(sql, [limit], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json(rows.reverse());
        }
    });
});

// Get anomaly scores
app.get('/api/anomaly/scores', (req, res) => {
    const limit = parseInt(req.query.limit) || 100;
    const sql = `SELECT a.*, s.temperature, s.humidity 
                 FROM anomaly_scores a 
                 JOIN sensor_readings s ON a.reading_id = s.id 
                 ORDER BY a.timestamp DESC LIMIT ?`;
    db.all(sql, [limit], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json(rows.reverse());
        }
    });
});

// Get alerts
app.get('/api/alerts', (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    const acknowledged = req.query.acknowledged;
    
    let sql = `SELECT * FROM alerts`;
    const params = [];
    
    if (acknowledged !== undefined) {
        sql += ` WHERE acknowledged = ?`;
        params.push(acknowledged === 'true' ? 1 : 0);
    }
    
    sql += ` ORDER BY timestamp DESC LIMIT ?`;
    params.push(limit);
    
    db.all(sql, params, (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json(rows);
        }
    });
});

// Acknowledge alert
app.post('/api/alerts/:id/acknowledge', (req, res) => {
    const sql = `UPDATE alerts SET acknowledged = 1 WHERE id = ?`;
    db.run(sql, [req.params.id], (err) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json({ success: true });
        }
    });
});

// Get evaluation metrics
app.get('/api/metrics', async (req, res) => {
    const metrics = metricsTracker.calculateMetrics();
    res.json(metrics);
});

// Get model configuration
app.get('/api/config', (req, res) => {
    const sql = `SELECT * FROM model_config`;
    db.all(sql, (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            const config = {};
            rows.forEach(row => {
                config[row.config_key] = row.config_value;
            });
            res.json(config);
        }
    });
});

// Update model configuration
app.put('/api/config/:key', (req, res) => {
    const sql = `INSERT OR REPLACE INTO model_config (config_key, config_value, updated_at) VALUES (?, ?, ?)`;
    db.run(sql, [req.params.key, req.body.value, new Date().toISOString()], (err) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json({ success: true });
        }
    });
});

// Ingest sensor data from frontend
app.post('/api/sensor/ingest', async (req, res) => {
    try {
        const result = await alertEngine.processReading(req.body);
        
        // Track metrics
        metricsTracker.recordPrediction(
            result.isAnomaly,
            result.breachStatus.isBreaching
        );
        
        // Broadcast update
        alertEngine.broadcastSensorUpdate(req.body, result);
        
        res.json(result);
    } catch (error) {
        console.error('Error processing reading:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get breaches
app.get('/api/breaches', (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    const sql = `SELECT * FROM breaches ORDER BY start_time DESC LIMIT ?`;
    db.all(sql, [limit], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json(rows);
        }
    });
});

// ============================================
// WebSocket Handling
// ============================================

wss.on('connection', (ws) => {
    console.log('New WebSocket connection');
    
    // Send initial data
    db.get(`SELECT * FROM sensor_readings ORDER BY timestamp DESC LIMIT 1`, (err, row) => {
        if (!err && row) {
            ws.send(JSON.stringify({ type: 'initial', data: row }));
        }
    });
    
    ws.on('close', () => {
        console.log('WebSocket disconnected');
    });
});

// ============================================
// Start Server
// ============================================

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(`Cold Chain Monitoring Server running on port ${PORT}`);
    console.log(`Dashboard: http://localhost:${PORT}`);
    console.log(`API endpoints available at /api/*`);
});

// Periodic metrics storage
setInterval(async () => {
    const metrics = await metricsTracker.storeMetrics();
    console.log('Metrics stored:', metrics);
}, 60000); // Every minute

// Export for testing
module.exports = { app, server, IsolationForest, SeverityScoringEngine, IntelligentAlertEngine };
