#include <WiFi.h>
#include <WiFiManager.h>   // ✅ Use this instead of AutoConnect
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

// ---------------- SERVER CONFIG ----------------
const char* localServer = "http://aquacheck.local:5000/upload";  // 🏠 Local Flask
const char* cloudServer = "https://aquachecklive.vercel.app/api/upload";  // ☁️ Online version

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
  float turbidity = -1120.4 * sq(avgVoltage) + 5742.3 * avgVoltage - 4352.9;
  if (turbidity < 0) turbidity = 0;
  return turbidity;
}

// ---------------- UPLOAD TO BOTH SERVERS ----------------
void uploadToServers() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("⚠️ Wi-Fi not connected, skipping upload...");
    return;
  }

  HTTPClient http;
  String jsonData = "{\"ph\":" + String(phValue, 2) +
                    ",\"turbidity\":" + String(turbidityValue, 2) +
                    ",\"temperature\":" + String(temperature, 2) +
                    ",\"tds\":" + String(tdsValue, 2) + "}";

  struct ServerTarget {
    const char* name;
    const char* url;
  };

  ServerTarget servers[] = {
    {"Local Flask", localServer},
    {"Cloud Vercel", cloudServer}
  };

  for (auto &target : servers) {
    http.begin(target.url);
    http.addHeader("Content-Type", "application/json");

    Serial.println("🌐 Sending to " + String(target.name) + ": " + target.url);
    int httpCode = http.POST(jsonData);

    if (httpCode > 0) {
      Serial.printf("✅ %s response: %d\n", target.name, httpCode);
    } else {
      Serial.printf("❌ %s failed (code: %d)\n", target.name, httpCode);
    }

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
  wm.setConfigPortalTimeout(180);  // portal active for 3 mins if no connect

  // Custom AP name and password
  if (!wm.autoConnect("AquaCheck-Setup", "aquacheck4dmin")) {
    Serial.println("⚠️ Failed to connect or timeout — restarting...");
    delay(3000);
    ESP.restart();
  }

  Serial.println("✅ Wi-Fi connected!");
  Serial.print("📶 IP Address: ");
  Serial.println(WiFi.localIP());
  Serial.println("✅ Initialization complete.\n");
}

// ---------------- MAIN LOOP ----------------
void loop() {
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

  // --- UPLOAD DATA (Local + Online) ---
  uploadToServers();

  // --- AUTO SCAN INTERVAL ---
  delay(1000); // 🕒 Set Auto Scan Interval (change this if needed)
}
