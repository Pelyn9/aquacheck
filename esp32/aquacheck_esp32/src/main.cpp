#include <WiFi.h>
#include <WiFiManager.h>
#include <HTTPClient.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <DFRobot_PH.h>
#include <EEPROM.h>
#include <math.h>

// ---------------- PIN CONFIGURATION ----------------
#define ONE_WIRE_BUS 14
#define TDS_PIN 33
#define PH_PIN 34
#define TURBIDITY_PIN 32

// ---------------- SENSOR OBJECTS ----------------
OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature sensors(&oneWire);
DFRobot_PH ph;

// ---------------- VARIABLES ----------------
float temperature = 25.0;
float tdsValue = 0;
float phValue = 7.0;
float turbidityValue = 0;

// Scan ON/OFF from dashboard
bool allowScanning = true;

// Last successful upload timestamp
unsigned long lastUploadTime = 0;

// ---------------- pH CALIBRATION ----------------
float phSlope = 1.0;
float phOffset = 0.0;

void calibratePH(float voltageAtPH7, float voltageAtPH4) {
  phSlope = (7.0 - 4.0) / (voltageAtPH7 - voltageAtPH4);
  phOffset = 7.0 - phSlope * voltageAtPH7;
  Serial.println("✅ pH Calibration Done!");
  Serial.printf("Slope: %.3f | Offset: %.3f\n", phSlope, phOffset);
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
  return turbidity < 0 ? 0 : turbidity;
}

// ---------------- CHECK DASHBOARD CONTROL ----------------
void checkControlCommand() {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  http.begin("https://aquachecklive.vercel.app/api/control");
  int code = http.GET();

  if (code == 200) {
    String payload = http.getString();
    Serial.print("📥 Control Response: ");
    Serial.println(payload);

    if (payload.indexOf("\"scan\":true") >= 0) allowScanning = true;
    else if (payload.indexOf("\"scan\":false") >= 0) allowScanning = false;

  } else {
    Serial.printf("⚠️ Failed to fetch control command. HTTP code: %d\n", code);
    allowScanning = false; // failsafe
  }

  http.end();
}

// ---------------- UPLOAD TO VERCEL ----------------
void uploadToVercel() {
  if (!allowScanning) {
    Serial.println("⏸️ Scanning disabled — not uploading.");
    return;
  }
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("⚠️ Wi-Fi not connected — skipping upload.");
    return;
  }

  HTTPClient http;
  http.begin("https://aquachecklive.vercel.app/api/data");
  http.addHeader("Content-Type", "application/json");

  String payload = "{\"ph\":" + String(phValue, 2) +
                   ",\"turbidity\":" + String(turbidityValue, 2) +
                   ",\"temperature\":" + String(temperature, 2) +
                   ",\"tds\":" + String(tdsValue, 2) + "}";

  int code = http.POST(payload);
  String response = http.getString();
  Serial.printf("➡ Upload HTTP %d | Response: %s\n", code, response.c_str());

  if (code == 200) lastUploadTime = millis();

  http.end();
}

// ---------------- WIFI MANAGER ----------------
void setupWiFiManager() {
  WiFiManager wm;
  wm.setClass("invert");
  wm.setConfigPortalTimeout(180);
  Serial.println("📡 Starting WiFiManager...");
  if (!wm.autoConnect("SafeShore", "safeshore4dmin")) {
    Serial.println("❌ WiFiManager Timeout — restarting...");
    delay(2000);
    ESP.restart();
  }
  Serial.println("✅ Wi-Fi connected!");
  Serial.print("📍 IP Address: ");
  Serial.println(WiFi.localIP());
}

// ---------------- SETUP ----------------
void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("🔧 SafeShore Booting...");
  EEPROM.begin(32);
  sensors.begin();
  ph.begin();
  setupWiFiManager();
  calibratePH(2.06, 2.50);
}

// ---------------- MAIN LOOP ----------------
void loop() {
  checkControlCommand();

  if (!allowScanning) {
    delay(500);
    return;
  }

  // Read sensors
  sensors.requestTemperatures();
  temperature = sensors.getTempCByIndex(0);
  if (temperature == -127.0 || isnan(temperature)) temperature = 25.0;

  int phRaw = analogRead(PH_PIN);
  if (phRaw > 0 && phRaw < 4095) {
    float voltage = phRaw * (3.3 / 4095.0);
    phValue = constrain(phSlope * voltage + phOffset, 0, 14);
  } else {
    phValue = 7.0;
  }

  tdsValue = readTDS();
  turbidityValue = readTurbidity();

  // Print readings
  Serial.println("-------------------------------------------------");
  Serial.printf("🌡 Temperature: %.2f °C\n", temperature);
  Serial.printf("💧 pH Value: %.2f\n", phValue);
  Serial.printf("🧂 TDS: %.2f ppm\n", tdsValue);
  Serial.printf("🌫 Turbidity: %.2f NTU\n", turbidityValue);
  Serial.println("-------------------------------------------------\n");

  // Upload to Vercel
  uploadToVercel();

  delay(1000);
}
