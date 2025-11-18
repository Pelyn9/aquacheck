#include <WiFi.h>
#include <WiFiManager.h>
#include <HTTPClient.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <DFRobot_PH.h>
#include <EEPROM.h>
#include <math.h>
#include <WiFiClientSecure.h>

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

// ---------------- pH CALIBRATION ----------------
float phSlope = 1.0;
float phOffset = 0.0;

// 2–point pH calibration
void calibratePH(float voltageAtPH7, float voltageAtPH4) {
  phSlope = (7.0 - 4.0) / (voltageAtPH7 - voltageAtPH4);
  phOffset = 7.0 - phSlope * voltageAtPH7;
  Serial.println("✅ pH Calibration Done!");
  Serial.printf("Slope: %.3f | Offset: %.3f\n", phSlope, phOffset);
}

// ---------------- READ TDS FUNCTION ----------------
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

// ---------------- READ TURBIDITY FUNCTION ----------------
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

// ---------------- UPLOAD TO SERVERS ----------------
void uploadToServers() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("⚠️ Wi-Fi not connected, skipping upload...");
    return;
  }

  // Create secure client for HTTPS bypass
  WiFiClientSecure client;
  client.setInsecure();  // 🔥 BYPASS SSL CERTIFICATE CHECK

  HTTPClient http;

  String jsonData = "{\"ph\":" + String(phValue, 2) +
                    ",\"turbidity\":" + String(turbidityValue, 2) +
                    ",\"temperature\":" + String(temperature, 2) +
                    ",\"tds\":" + String(tdsValue, 2) + "}";

  struct ServerTarget {
    const char* name;
    const char* url;
    bool secure;
  };

  ServerTarget servers[] = {
    {"Local Flask", "http://aquacheck.local:5000/upload", false},
    {"Cloud Vercel", "https://aquachecklive.vercel.app/api/upload", true}
  };

  for (auto &target : servers) {

    if (target.secure) {
      http.begin(client, target.url);   // HTTPS 🔥 WITH BYPASS
    } else {
      http.begin(target.url);           // HTTP normal
    }

    http.addHeader("Content-Type", "application/json");
    int code = http.POST(jsonData);

    Serial.printf("🌍 Sent to %s | HTTP %d\n", target.name, code);
    http.end();
  }
}

// ---------------- SETUP ----------------
void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("🔧 AquaCheck System Booting...");

  EEPROM.begin(32);
  sensors.begin();
  ph.begin();

  // ---------------- WIFI CONFIGURATION ----------------
  WiFiManager wm;
  wm.setConfigPortalTimeout(180);

  if (!wm.autoConnect("AquaCheck-Setup", "aquacheck4dmin")) {
    delay(3000);
    ESP.restart();
  }

  Serial.println("✅ Wi-Fi connected!");

  // ---------------- TEMPORARY PH CALIBRATION ----------------
  float voltageAtPH7 = 2.06;
  float voltageAtPH4 = 2.50;
  calibratePH(voltageAtPH7, voltageAtPH4);
}

// ---------------- MAIN LOOP ----------------
void loop() {

  // ---------------- TEMPERATURE ----------------
  sensors.requestTemperatures();
  temperature = sensors.getTempCByIndex(0);
  if (temperature == -127.0 || isnan(temperature)) temperature = 25.0;

  // ---------------- pH ----------------
  int phRaw = analogRead(PH_PIN);

  if (phRaw > 0 && phRaw < 4095) {
    float voltage = phRaw * (3.3 / 4095.0);
    phValue = phSlope * voltage + phOffset;

    if (phValue < 0) phValue = 0;
    if (phValue > 14) phValue = 14;
  } else {
    phValue = 7.0;
  }

  delay(50); // avoid TDS interference

  // ---------------- TDS ----------------
  tdsValue = readTDS();

  // ---------------- TURBIDITY ----------------
  turbidityValue = readTurbidity();

  // ---------------- PRINT ----------------
  Serial.println("-------------------------------------------------");
  Serial.printf("🌡 Temperature: %.2f °C\n", temperature);
  Serial.printf("💧 pH: %.2f\n", phValue);
  Serial.printf("🧂 TDS: %.2f ppm\n", tdsValue);
  Serial.printf("🌫 Turbidity: %.2f NTU\n", turbidityValue);
  Serial.println("-------------------------------------------------\n");

  // ---------------- UPLOAD ----------------
  uploadToServers();

  delay(1000);
}
