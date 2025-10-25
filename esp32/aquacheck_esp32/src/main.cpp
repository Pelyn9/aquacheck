#include <WiFi.h>
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

// ---------------- WIFI CONFIG ----------------
const char* ssid = "HONOR X9b 5G";
const char* password = "charlynmae";
const char* flaskServer = "http://aquacheck.local:5000/upload";

// ---------------- SENSOR OBJECTS ----------------
OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature sensors(&oneWire);
DFRobot_PH ph;

// ---------------- VARIABLES ----------------
float temperature = 25.0;
float tdsValue = 0;
float phValue = 7.0;
float turbidityValue = 0;

// ---------------- READ TDS FUNCTION ----------------
float readTDS(float temp) {
  const int samples = 10;
  float sum = 0;
  for (int i = 0; i < samples; i++) {
    float voltage = analogRead(TDS_PIN) * (3.3 / 4095.0);
    sum += voltage;
    delay(5);
  }

  float avgVoltage = sum / samples;
  float compensation = 1.0 + 0.02 * (temp - 25.0);
  float compensatedVoltage = avgVoltage / compensation;
  float tds = (133.42 * pow(compensatedVoltage, 3)
              - 255.86 * pow(compensatedVoltage, 2)
              + 857.39 * compensatedVoltage) * 0.5;

  if (tds < 0) tds = 0;
  return tds;
}

// ---------------- READ TURBIDITY FUNCTION ----------------
// Accurate NTU formula for DFRobot SEN0189-type sensors
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

  // DFRobot calibration formula
  float turbidity = -1120.4 * sq(avgVoltage) + 5742.3 * avgVoltage - 4352.9;

  if (turbidity < 0) turbidity = 0;  // prevent negative NTU
  return turbidity;
}

// ---------------- UPLOAD TO FLASK SERVER ----------------
void uploadToFlask() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("⚠️ Wi-Fi not connected, skipping upload...");
    return;
  }

  HTTPClient http;
  http.begin(flaskServer);
  http.addHeader("Content-Type", "application/json");

  String jsonData = "{\"ph\":" + String(phValue, 2) +
                    ",\"turbidity\":" + String(turbidityValue, 2) +
                    ",\"temperature\":" + String(temperature, 2) +
                    ",\"tds\":" + String(tdsValue, 2) + "}";

  Serial.println("🌐 Sending JSON: " + jsonData);
  int httpCode = http.POST(jsonData);

  if (httpCode > 0) {
    Serial.println("✅ Sent! HTTP code: " + String(httpCode));
  } else {
    Serial.println("❌ Upload failed: " + String(httpCode));
  }

  http.end();
}

// ---------------- WIFI AUTO RECONNECT ----------------
void ensureWiFiConnected() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("📡 Reconnecting Wi-Fi...");
    WiFi.disconnect();
    WiFi.begin(ssid, password);

    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 20) {
      delay(500);
      Serial.print(".");
      attempts++;
    }

    if (WiFi.status() == WL_CONNECTED) {
      Serial.println("\n✅ Reconnected to Wi-Fi!");
    } else {
      Serial.println("\n❌ Wi-Fi reconnect failed.");
    }
  }
}

// ---------------- SETUP ----------------
void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("🔧 AquaCheck System Booting...");

  EEPROM.begin(32);     // Required for pH sensor calibration
  sensors.begin();
  ph.begin();

  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);

  Serial.print("🔌 Connecting to Wi-Fi");
  int retry = 0;
  while (WiFi.status() != WL_CONNECTED && retry < 40) {
    delay(500);
    Serial.print(".");
    retry++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✅ Wi-Fi Connected!");
    Serial.print("📶 IP Address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\n❌ Failed to connect to Wi-Fi.");
  }

  Serial.println("✅ Initialization complete.\n");
}

// ---------------- MAIN LOOP ----------------
void loop() {
  ensureWiFiConnected();

  // --- TEMPERATURE ---
  sensors.requestTemperatures();
  temperature = sensors.getTempCByIndex(0);
  if (temperature == -127.0 || isnan(temperature)) temperature = 25.0;

  // --- PH SENSOR ---
  int phRaw = analogRead(PH_PIN);
  if (phRaw > 0) {
    phValue = ph.readPH(phRaw, temperature);
    if (isnan(phValue) || phValue < 0 || phValue > 14) phValue = 7.0;
  } else {
    phValue = 7.0;
    Serial.println("⚠️ No valid pH signal detected.");
  }

  // --- TURBIDITY & TDS ---
  turbidityValue = readTurbidity();
  tdsValue = readTDS(temperature);

  // --- SERIAL DISPLAY ---
  Serial.println("-------------------------------------------------");
  Serial.printf("🌡 Temperature: %.2f °C\n", temperature);
  Serial.printf("💧 pH Value: %.2f\n", phValue);
  Serial.printf("🧂 TDS: %.2f ppm\n", tdsValue);
  Serial.printf("🌫 Turbidity: %.2f NTU\n", turbidityValue);
  Serial.println("-------------------------------------------------\n");

  // --- UPLOAD DATA ---
  uploadToFlask();

  delay(1000);
}
