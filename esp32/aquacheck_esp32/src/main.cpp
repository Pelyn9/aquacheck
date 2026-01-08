#include <WiFi.h>
#include <WiFiManager.h>
#include <HTTPClient.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <DFRobot_PH.h>
#include <EEPROM.h>
#include <math.h>

// ---------------- PIN CONFIGURATION ----------------
#define ONE_WIRE_BUS     14
#define TDS_PIN          33
#define PH_PIN           34
#define TURBIDITY_PIN    32

// ---------------- SENSOR OBJECTS ----------------
OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature sensors(&oneWire);
DFRobot_PH ph;

// ---------------- VARIABLES ----------------
float temperature = 25.0;
float tdsValue = 0;
float phValue = 8.2;      // Simulated Samal coastal pH
float turbidityValue = 0;

bool allowScanning = true;

// ---------------- TIMING ----------------
unsigned long lastSend = 0;
const unsigned long interval = 1000; // 1 second

// ---------------- SIMULATED SAMAL pH ----------------
// Coastal Samal waters are alkaline (8.1–8.4)
void generateSamalPH() {
  float variation = random(-20, 21) / 1000.0; // ±0.02
  phValue += variation;

  if (phValue < 8.10) phValue = 8.12;
  if (phValue > 8.40) phValue = 8.38;
}

// ---------------- READ TDS ----------------
float readTDS() {
  const int samples = 10;
  float sum = 0;

  for (int i = 0; i < samples; i++) {
    int raw = analogRead(TDS_PIN);
    float voltage = raw * (3.3 / 4095.0);

    float tds = (133.42 * pow(voltage, 3)
               - 255.86 * pow(voltage, 2)
               + 857.39 * voltage) * 0.5;

    if (tds < 0) tds = 0;
    sum += tds;
    delay(5);
  }
  return sum / samples;
}

// ---------------- READ TURBIDITY ----------------
float readTurbidity() {
  const int samples = 10;
  float sumVoltage = 0;

  for (int i = 0; i < samples; i++) {
    int raw = analogRead(TURBIDITY_PIN);
    float voltage = raw * (3.3 / 4095.0);
    sumVoltage += voltage;
    delay(5);
  }

  float avgVoltage = sumVoltage / samples;
  float turbidity = -1120.4 * sq(avgVoltage)
                    + 5742.3 * avgVoltage
                    - 4352.9;

  if (turbidity < 0) turbidity = 0;
  return turbidity;
}

// ---------------- DASHBOARD CONTROL ----------------
void checkControlCommand() {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  http.begin("https://aquachecklive.vercel.app/api/control");
  int code = http.GET();

  if (code == 200) {
    String payload = http.getString();
    allowScanning = payload.indexOf("\"scan\":true") >= 0;
  }
  http.end();
}

// ---------------- UPLOAD DATA ----------------
void uploadToDashboard() {
  if (!allowScanning || WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  http.begin("https://aquachecklive.vercel.app/api/data");
  http.addHeader("Content-Type", "application/json");

  String json = "{";
  json += "\"ph\":" + String(phValue, 2) + ",";
  json += "\"turbidity\":" + String(turbidityValue, 2) + ",";
  json += "\"temperature\":" + String(temperature, 2) + ",";
  json += "\"tds\":" + String(tdsValue, 2);
  json += "}";

  Serial.println("📤 MIRRORED TO DASHBOARD:");
  Serial.println(json);

  http.POST(json);
  http.end();
}

// ---------------- WIFI MANAGER ----------------
void setupWiFiManager() {
  WiFiManager wm;
  wm.setClass("invert");
  wm.setConfigPortalTimeout(180);

  if (!wm.autoConnect("SafeShore", "safeshore4dmin")) {
    ESP.restart();
  }
}

// ---------------- SETUP ----------------
void setup() {
  Serial.begin(115200);
  randomSeed(analogRead(0));

  EEPROM.begin(32);
  sensors.begin();
  ph.begin();

  setupWiFiManager();
  Serial.println("✅ SafeShore Samal Edition Online");
}

// ---------------- MAIN LOOP ----------------
void loop() {
  if (millis() - lastSend < interval) return;
  lastSend = millis();

  checkControlCommand();

  // 1. REAL TEMPERATURE
  sensors.requestTemperatures();
  temperature = sensors.getTempCByIndex(0);
  if (temperature == -127.0 || isnan(temperature)) temperature = 25.0;

  // 2. SIMULATED pH
  generateSamalPH();

  // 3. REAL TDS & TURBIDITY
  tdsValue = readTDS();
  turbidityValue = readTurbidity();

  // 4. SERIAL OUTPUT (SOURCE OF TRUTH)
  Serial.println("\n--- SAMAL ISLAND SHORE MONITORING ---");
  Serial.printf("🌡 Temperature : %.2f °C\n", temperature);
  Serial.printf("💧 pH           : %.2f (Simulated)\n", phValue);
  Serial.printf("🧂 TDS          : %.2f ppm\n", tdsValue);
  Serial.printf("🌫 Turbidity    : %.2f NTU\n", turbidityValue);
  Serial.println("--------------------------------------");

  // 5. SEND EXACT SAME VALUES
  uploadToDashboard();
}
