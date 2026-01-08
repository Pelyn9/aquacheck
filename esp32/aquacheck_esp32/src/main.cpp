#include <WiFi.h>
#include <WiFiManager.h>
#include <HTTPClient.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <math.h>

// ---------------- PIN CONFIGURATION ----------------
#define ONE_WIRE_BUS 14
#define TDS_PIN 33
#define PH_PIN 34        // Note: Logic is simulated, pin is reserved
#define TURBIDITY_PIN 32

// ---------------- SENSOR OBJECTS ----------------
OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature sensors(&oneWire);

// ---------------- GLOBAL VARIABLES ----------------
float temperature = 27.5;
float tdsValue = 0;
float phValue = 8.25;      // Samal Island Baseline
float turbidityValue = 0;

bool allowScanning = true;

// ---------------- SAMAL pH SIMULATOR ----------------
// This generates a smooth, realistic "Sine Wave" movement
// to simulate the natural alkaline state of Samal coastal water.
void simulateSamalPH() {
  unsigned long now = millis();
  
  // Creates a gentle wave between 8.20 and 8.30
  float phWave = sin(now / 5000.0) * 0.05; 
  
  // Adds a tiny "live" vibration (-0.005 to +0.005)
  float phNoise = (random(-5, 6) / 1000.0); 
  
  phValue = 8.25 + phWave + phNoise;
}

// ---------------- READ REAL TDS (Hardware) ----------------
float readTDS() {
  const int samples = 15; // Increased samples for stability
  float sum = 0;
  for (int i = 0; i < samples; i++) {
    int raw = analogRead(TDS_PIN);
    float voltage = raw * (3.3 / 4095.0);
    // Standard Gravity TDS mathematical model
    float tds = (133.42 * pow(voltage, 3) - 255.86 * pow(voltage, 2) + 857.39 * voltage) * 0.5;
    if (tds < 0) tds = 0;
    sum += tds;
    delay(5);
  }
  return sum / samples;
}

// ---------------- READ REAL TURBIDITY (Hardware) ----------------
float readTurbidity() {
  const int samples = 15;
  float sumVoltage = 0;
  for (int i = 0; i < samples; i++) {
    int raw = analogRead(TURBIDITY_PIN);
    float voltage = raw * (3.3 / 4095.0);
    sumVoltage += voltage;
    delay(5);
  }
  float avgVoltage = sumVoltage / samples;
  // Mathematical model for Turbidity (NTU)
  float turbidity = -1120.4 * sq(avgVoltage) + 5742.3 * avgVoltage - 4352.9;
  if (turbidity < 0) turbidity = 0;
  return turbidity;
}

// ---------------- CLOUD DATA UPLOAD ----------------
void uploadToServers() {
  if (!allowScanning || WiFi.status() != WL_CONNECTED) return;

  const char* url = "https://aquachecklive.vercel.app/api/data";
  
  // Construct JSON Payload
  String jsonData = "{\"ph\":" + String(phValue, 2) +
                    ",\"turbidity\":" + String(turbidityValue, 2) +
                    ",\"temperature\":" + String(temperature, 2) +
                    ",\"tds\":" + String(tdsValue, 2) + "}";

  HTTPClient http;
  http.begin(url);
  http.addHeader("Content-Type", "application/json");

  int code = http.POST(jsonData);
  if (code > 0) {
    Serial.printf("[Cloud] Upload Success. Status: %d\n", code);
  } else {
    Serial.printf("[Cloud] Error: %s\n", http.errorToString(code).c_str());
  }
  http.end();
}

// ---------------- DASHBOARD CONTROL COMMAND ----------------
void checkControlCommand() {
  if (WiFi.status() != WL_CONNECTED) return;
  
  HTTPClient http;
  http.begin("https://aquachecklive.vercel.app/api/control");
  int code = http.GET();
  
  if (code == 200) {
    String payload = http.getString();
    // Simple JSON check for "scan":true/false
    allowScanning = (payload.indexOf("\"scan\":true") >= 0);
  }
  http.end();
}

// ---------------- SYSTEM SETUP ----------------
void setup() {
  Serial.begin(115200);
  randomSeed(analogRead(0)); // Initialize random generator
  
  sensors.begin(); // Start Temperature sensor
  
  // WiFiManager: Connects to saved Wi-Fi or starts Access Point "SafeShore"
  WiFiManager wm;
  wm.setConnectTimeout(60);
  if (!wm.autoConnect("SafeShore_AP", "safeshore4dmin")) {
    Serial.println("❌ Connection Failed. Restarting...");
    delay(3000);
    ESP.restart();
  }

  Serial.println("\n✅ SAFESHORE ONLINE");
  Serial.println("Real Sensors: Temp, TDS, Turbidity");
  Serial.println("Simulated Sensor: pH (Samal Baseline)");
}

// ---------------- MAIN MONITORING LOOP ----------------
void loop() {
  // Sync with Dashboard Command
  checkControlCommand();

  // 1. Temperature (REAL SENSOR)
  sensors.requestTemperatures();
  float tempReading = sensors.getTempCByIndex(0);
  if (tempReading > -100 && !isnan(tempReading)) {
    temperature = tempReading;
  }

  // 2. pH (SIMULATED - Moving realtime)
  simulateSamalPH();

  // 3. TDS & Turbidity (REAL SENSORS)
  tdsValue = readTDS();
  turbidityValue = readTurbidity();

  // 4. Output to Serial Monitor
  Serial.println("====================================");
  Serial.printf("📍 STATUS: %s\n", allowScanning ? "SCANNING" : "PAUSED");
  Serial.printf("🌡 REAL TEMP: %.2f C\n", temperature);
  Serial.printf("🧂 REAL TDS:  %.2f ppm\n", tdsValue);
  Serial.printf("🌫 REAL TURB: %.2f NTU\n", turbidityValue);
  Serial.printf("💧 SIM PH:    %.2f (Samal)\n", phValue);
  Serial.println("====================================");

  // 5. Send data to Vercel/Supabase
  uploadToServers();

  delay(1000); // 1-second update for a smooth live dashboard experience
}