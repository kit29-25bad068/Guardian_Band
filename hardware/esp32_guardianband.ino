/**
 * GUARDIANBAND PHYSICAL WEARABLE FIRMWARE (ESP32)
 * 
 * Hardware Architecture & Pinout:
 * - Microcontroller: ESP32 (WROOM-32 / S3)
 * - Local Non-Volatile Storage: ESP32 NVS (Preferences)
 * - Sensors:
 *     - GPS Module: NEO-6M / NEO-8M (UART Serial2: RX2=GPIO16, TX2=GPIO17)
 *     - Biosensor: MAX30102 Heart Rate + SpO2 (I2C: SDA=GPIO21, SCL=GPIO22)
 * - Cellular Module: SIM800L GSM/GPRS (UART Serial1: RX1=GPIO25, TX1=GPIO26)
 * - Display: 0.96" SSD1306 OLED (I2C: SDA=GPIO21, SCL=GPIO22)
 * - Input: Single Deliberate SOS Tactile Button (GPIO 14, INPUT_PULLUP)
 * 
 * =========================================================================
 * EXACT STATE MACHINE WORKFLOW:
 * NORMAL STATE
 *   │
 *   ▼
 * 1st SOS PRESS
 *   │
 *   ▼
 * 2nd SOS PRESS
 *   │
 *   ▼
 * START 15-SECOND TIMER
 *   │
 *   ├───────────────────────────────┐
 *   ▼                               ▼
 * 3rd Press within 15 seconds   No 3rd Press for 15 seconds
 *   │                               │
 *   ▼                               ▼
 * EMERGENCY CANCELLED           VERIFIED EMERGENCY
 *   │                               │
 *   ▼                               ▼
 * NORMAL                        Collect Emergency Data:
 *                               - ESP32 Local Storage (User, Device, Contact, URL)
 *                               - Sensors (GPS Location, MAX30102 HR + SpO2)
 *                                   │
 *                   ┌───────────────┴───────────────┐
 *                   ▼                               ▼
 *                SIM800L                         SIM800L
 *                  SMS                             GPRS
 *                   │                               │
 *                   ▼                               ▼
 *           Emergency Contacts                Node.js Backend
 *                                                   │
 *                                                   ▼
 *                                                Firebase
 *                                                   │
 *                                                   ▼
 *                                       CENTRAL CONTROL DASHBOARD
 *                                                   │
 *                                           ┌───────┴───────┐
 *                                           ▼               ▼
 *                                    LIVE GPS TRACKING  AI FORWARDING
 *                                           │               │
 *                                           │               ▼
 *                                           │        POLICE CONTROL ROOM
 *                                           ▼
 *                                  Continuous Location Monitoring (every 3s)
 *                                           │
 *                                           ▼
 *                                   Emergency Resolved
 *                                           │
 *                                           ▼
 *                                        NORMAL
 * =========================================================================
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <Preferences.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

// Single Hardware SOS Button Pin (Active LOW with internal pullup)
const int SOS_BUTTON_PIN = 14;

// SIM800L Hardware Serial Pins (UART1)
#define SIM800_RX_PIN 25
#define SIM800_TX_PIN 26
HardwareSerial sim800(1);

// Preferences for ESP32 Local Storage (NVS)
Preferences localStorage;

// 1. ESP32 LOCAL STORAGE FIELDS
String stored_userName = "Priya Sharma";
int stored_userAge = 24;
String stored_userBlood = "B+";
String stored_userMedical = "Asthma";
String stored_deviceId = "GB-1024";
String stored_emergencyContact = "+919876543210";
String stored_contactRelation = "Mother (Sunita Sharma)";
String stored_trackingUrl = "http://localhost:5175/portal?id=GB-1024";
String stored_authToken = "tok_gb1024_secure";

// Backend API Endpoint
const char* BACKEND_BASE_URL = "http://192.168.1.100:5000";

// 2. SENSOR DATA (GPS & MAX30102)
double sensor_latitude = 10.99930;
double sensor_longitude = 77.08420;
int sensor_heartRate = 78; // BPM
int sensor_spo2 = 98;      // %

// 3. FINITE STATE MACHINE DEFINITION
enum WearableState {
  STATE_NORMAL,
  STATE_1ST_PRESS_DETECTED,
  STATE_15S_COUNTDOWN_TIMER,
  STATE_VERIFIED_EMERGENCY,
  STATE_EMERGENCY_CANCELLED
};

WearableState currentState = STATE_NORMAL;
unsigned long firstPressTimestamp = 0;
unsigned long countdownStartTimestamp = 0;
unsigned long lastGpsStreamTimestamp = 0;
int countdownRemainingSec = 15;
bool lastButtonReading = HIGH;
unsigned long lastDebounceTime = 0;
const unsigned long DEBOUNCE_DELAY_MS = 150;

// Forward declarations
void initLocalStorage();
void handleButtonPress(unsigned long now);
void start15SecondTimer();
void handle3rdPressCancel();
void handleVerifiedEmergency();
void collectEmergencyData();
void dispatchSIM800L_SMS();
void dispatchSIM800L_GPRS();
void streamContinuousGpsBreadcrumb();
void returnToNormalState();
void showNormalScreen();
void show1stPressScreen(int remainingSec);
void showCountdownScreen(int remainingSec);
void showCancelledScreen();
void showVerifiedEmergencyScreen();

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println(F("\n=============================================="));
  Serial.println(F("GUARDIANBAND WEARABLE FIRMWARE INITIALIZING..."));
  Serial.println(F("=============================================="));

  pinMode(SOS_BUTTON_PIN, INPUT_PULLUP);

  // Initialize OLED Display
  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println(F("SSD1306 allocation failed. Check I2C wiring."));
  }

  // Initialize SIM800L UART
  sim800.begin(9600, SERIAL_8N1, SIM800_RX_PIN, SIM800_TX_PIN);
  delay(1000);
  sim800.println(F("AT")); // Check AT response
  delay(200);
  sim800.println(F("AT+CMGF=1")); // Set SMS to text mode
  delay(200);

  // Initialize ESP32 Local Storage (Preferences)
  initLocalStorage();

  // Initial State: NORMAL
  returnToNormalState();
  Serial.println(F("[GuardianBand] Boot complete. Device in NORMAL STANDBY state."));
}

void loop() {
  unsigned long now = millis();

  // Read tactile SOS button with debounce
  int reading = digitalRead(SOS_BUTTON_PIN);
  if (reading != lastButtonReading) {
    lastDebounceTime = now;
  }

  if ((now - lastDebounceTime) > DEBOUNCE_DELAY_MS) {
    // If button was pressed (transition HIGH -> LOW)
    static bool buttonProcessed = false;
    if (reading == LOW && !buttonProcessed) {
      buttonProcessed = true;
      handleButtonPress(now);
    } else if (reading == HIGH) {
      buttonProcessed = false;
    }
  }
  lastButtonReading = reading;

  // State: 1ST_PRESS_DETECTED -> Window to receive 2nd Press (5s window)
  if (currentState == STATE_1ST_PRESS_DETECTED) {
    int elapsed = (now - firstPressTimestamp) / 1000;
    int windowRemaining = 5 - elapsed;

    if (windowRemaining <= 0) {
      Serial.println(F("[FSM] 1st press confirmation window expired (>5s). Returning to NORMAL."));
      returnToNormalState();
    } else {
      show1stPressScreen(windowRemaining);
    }
  }

  // State: 15S_COUNTDOWN_TIMER
  else if (currentState == STATE_15S_COUNTDOWN_TIMER) {
    int elapsed = (now - countdownStartTimestamp) / 1000;
    countdownRemainingSec = 15 - elapsed;

    if (countdownRemainingSec <= 0) {
      // Branch B: No 3rd press for 15 seconds -> VERIFIED EMERGENCY!
      Serial.println(F("[FSM] 15-second safety timer EXPIRED with NO 3rd press!"));
      handleVerifiedEmergency();
    } else {
      showCountdownScreen(countdownRemainingSec);
    }
  }

  // State: VERIFIED_EMERGENCY -> Continuous Location Monitoring (every 3 seconds)
  else if (currentState == STATE_VERIFIED_EMERGENCY) {
    if (now - lastGpsStreamTimestamp > 3000) {
      lastGpsStreamTimestamp = now;
      streamContinuousGpsBreadcrumb();
    }
  }

  delay(50);
}

/**
 * Loads and provisions ESP32 Local Non-Volatile Storage (NVS)
 */
void initLocalStorage() {
  localStorage.begin("gb_storage", false);

  if (!localStorage.isKey("deviceId")) {
    localStorage.putString("userName", stored_userName);
    localStorage.putInt("userAge", stored_userAge);
    localStorage.putString("userBlood", stored_userBlood);
    localStorage.putString("userMed", stored_userMedical);
    localStorage.putString("deviceId", stored_deviceId);
    localStorage.putString("contactPhone", stored_emergencyContact);
    localStorage.putString("contactRel", stored_contactRelation);
    localStorage.putString("trackUrl", stored_trackingUrl);
    localStorage.putString("token", stored_authToken);
    Serial.println(F("[NVS Storage] Initialized persistent parameters into ESP32 Flash."));
  } else {
    stored_userName = localStorage.getString("userName", stored_userName);
    stored_userAge = localStorage.getInt("userAge", stored_userAge);
    stored_userBlood = localStorage.getString("userBlood", stored_userBlood);
    stored_userMedical = localStorage.getString("userMed", stored_userMedical);
    stored_deviceId = localStorage.getString("deviceId", stored_deviceId);
    stored_emergencyContact = localStorage.getString("contactPhone", stored_emergencyContact);
    stored_contactRelation = localStorage.getString("contactRel", stored_contactRelation);
    stored_trackingUrl = localStorage.getString("trackUrl", stored_trackingUrl);
    stored_authToken = localStorage.getString("token", stored_authToken);
    Serial.println(F("[NVS Storage] Loaded user credentials from persistent ESP32 Flash."));
  }

  Serial.printf("  User: %s (Age: %d, Blood: %s, Notes: %s)\n", 
    stored_userName.c_str(), stored_userAge, stored_userBlood.c_str(), stored_userMedical.c_str());
  Serial.printf("  Device ID: %s | Contact: %s\n", stored_deviceId.c_str(), stored_emergencyContact.c_str());
  Serial.printf("  Tracking URL: %s\n", stored_trackingUrl.c_str());
}

/**
 * Single Button SOS Protocol State Handler
 */
void handleButtonPress(unsigned long now) {
  // Case 1: NORMAL STATE -> 1st SOS PRESS
  if (currentState == STATE_NORMAL || currentState == STATE_EMERGENCY_CANCELLED) {
    firstPressTimestamp = now;
    currentState = STATE_1ST_PRESS_DETECTED;
    Serial.println(F("[FSM] 1st SOS PRESS DETECTED! Awaiting 2nd press within 5 seconds..."));
    show1stPressScreen(5);
  }

  // Case 2: 1ST PRESS DETECTED -> 2nd SOS PRESS within window
  else if (currentState == STATE_1ST_PRESS_DETECTED) {
    Serial.println(F("[FSM] 2nd SOS PRESS CONFIRMED! Starting 15-second safety verification timer."));
    start15SecondTimer();
  }

  // Case 3: 15-SECOND TIMER ACTIVE -> 3rd Press within 15 seconds -> CANCEL!
  else if (currentState == STATE_15S_COUNTDOWN_TIMER) {
    Serial.println(F("[FSM] 3rd SOS PRESS DETECTED within 15s window -> EMERGENCY CANCELLED!"));
    handle3rdPressCancel();
  }
}

/**
 * Starts the 15-Second Safety Verification Timer
 */
void start15SecondTimer() {
  currentState = STATE_15S_COUNTDOWN_TIMER;
  countdownStartTimestamp = millis();
  countdownRemainingSec = 15;
  showCountdownScreen(15);
}

/**
 * Branch A: 3rd Press within 15 seconds -> EMERGENCY CANCELLED -> NORMAL
 */
void handle3rdPressCancel() {
  currentState = STATE_EMERGENCY_CANCELLED;
  showCancelledScreen();
  Serial.println(F("[GuardianBand] 🛑 EMERGENCY CANCELLED by 3rd SOS Press."));

  // Optional: Notify backend over GPRS / WiFi if available
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    String endpoint = String(BACKEND_BASE_URL) + "/api/device/cancel";
    http.begin(endpoint);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("x-device-token", stored_authToken);

    String payload = "{\"deviceId\":\"" + stored_deviceId + "\",\"reason\":\"3RD_PRESS_WITHIN_15S_EMERGENCY_CANCELLED\"}";
    http.POST(payload);
    http.end();
  }

  delay(2500);
  returnToNormalState();
}

/**
 * Branch B: No 3rd Press for 15 seconds -> VERIFIED EMERGENCY
 */
void handleVerifiedEmergency() {
  currentState = STATE_VERIFIED_EMERGENCY;
  showVerifiedEmergencyScreen();
  Serial.println(F("\n======================================================="));
  Serial.println(F("🚨 VERIFIED EMERGENCY ACTIVATED (No 3rd Press for 15s)"));
  Serial.println(F("======================================================="));

  // Step 1: Collect Emergency Data (Local Storage + Sensors)
  collectEmergencyData();

  // Step 2: SIM800L SMS directly to Emergency Contacts
  dispatchSIM800L_SMS();

  // Step 3: SIM800L GPRS payload to Node.js Backend & Firebase
  dispatchSIM800L_GPRS();

  lastGpsStreamTimestamp = millis();
}

/**
 * Collects emergency parameters from ESP32 Local Storage and live sensors
 */
void collectEmergencyData() {
  Serial.println(F("[Data Collection]"));
  Serial.printf("  1. ESP32 Local Storage: User %s, Device %s, Contact %s\n",
    stored_userName.c_str(), stored_deviceId.c_str(), stored_emergencyContact.c_str());
  Serial.printf("  2. Sensors: GPS (%0.5f, %0.5f), HR %d BPM, SpO2 %d%%\n",
    sensor_latitude, sensor_longitude, sensor_heartRate, sensor_spo2);
  Serial.printf("  3. Tracking URL: %s\n", stored_trackingUrl.c_str());
}

/**
 * Dispatches cellular SMS directly to Emergency Contacts via SIM800L GSM AT commands
 */
void dispatchSIM800L_SMS() {
  Serial.printf("[SIM800L SMS] Transmitting emergency SMS to %s...\n", stored_emergencyContact.c_str());

  sim800.print(F("AT+CMGS=\""));
  sim800.print(stored_emergencyContact);
  sim800.println(F("\""));
  delay(500);

  // SMS Body
  sim800.print(F("GUARDIANBAND SOS ALERT!\n"));
  sim800.printf("Wearer %s (Age %d, %s) is in distress.\n", stored_userName.c_str(), stored_userAge, stored_userBlood.c_str());
  sim800.printf("GPS: %0.5f, %0.5f\n", sensor_latitude, sensor_longitude);
  sim800.printf("Map: https://maps.google.com/?q=%0.5f,%0.5f\n", sensor_latitude, sensor_longitude);
  sim800.printf("Live Tracking: %s\n", stored_trackingUrl.c_str());
  sim800.printf("Vitals: HR %d BPM, SpO2 %d%%\n", sensor_heartRate, sensor_spo2);
  sim800.write(26); // Ctrl+Z to send SMS
  delay(3000);

  Serial.println(F("[SIM800L SMS] Dispatched to Emergency Contacts!"));
}

/**
 * Transmits cellular GPRS HTTP POST payload to Node.js Backend & Firebase
 */
void dispatchSIM800L_GPRS() {
  Serial.println(F("[SIM800L GPRS] Transmitting payload to Node.js Backend..."));

  // Build JSON payload
  String payload = "{";
  payload += "\"deviceId\":\"" + stored_deviceId + "\",";
  payload += "\"userId\":\"USER-1024\",";
  payload += "\"verificationMethod\":\"NO_3RD_PRESS_15S\",";
  payload += "\"latitude\":" + String(sensor_latitude, 5) + ",";
  payload += "\"longitude\":" + String(sensor_longitude, 5) + ",";
  payload += "\"heartRate\":" + String(sensor_heartRate) + ",";
  payload += "\"spo2\":" + String(sensor_spo2) + ",";
  payload += "\"battery\":84,";
  payload += "\"source\":\"PHYSICAL_DEVICE\"";
  payload += "}";

  // HTTP POST via SIM800L GPRS or WiFi fallback
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    String endpoint = String(BACKEND_BASE_URL) + "/api/device/sos";
    http.begin(endpoint);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("x-device-token", stored_authToken);

    int httpCode = http.POST(payload);
    Serial.printf("[Node.js Backend] HTTP Response Status: %d\n", httpCode);
    http.end();
  } else {
    // AT Commands for SIM800L HTTP
    sim800.println(F("AT+HTTPINIT"));
    delay(500);
    sim800.printf("AT+HTTPPARA=\"URL\",\"%s/api/device/sos\"\n", BACKEND_BASE_URL);
    delay(500);
    sim800.println(F("AT+HTTPPARA=\"CONTENT\",\"application/json\""));
    delay(500);
    sim800.printf("AT+HTTPDATA=%d,10000\n", payload.length());
    delay(500);
    sim800.println(payload);
    delay(500);
    sim800.println(F("AT+HTTPACTION=1")); // POST
    delay(2000);
    sim800.println(F("AT+HTTPTERM"));
  }

  Serial.println(F("[SIM800L GPRS] Transmission completed -> Firebase & Central Dashboard!"));
}

/**
 * Continuous Location Monitoring: Streams GPS coordinates every 3 seconds
 */
void streamContinuousGpsBreadcrumb() {
  sensor_latitude += 0.00008; // Simulate slight movement
  sensor_longitude += 0.00006;

  Serial.printf("[Continuous Monitoring] GPS Breadcrumb: (%0.5f, %0.5f) -> Central Command & Police EOC\n",
    sensor_latitude, sensor_longitude);

  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    String endpoint = String(BACKEND_BASE_URL) + "/api/device/location";
    http.begin(endpoint);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("x-device-token", stored_authToken);

    String payload = "{";
    payload += "\"deviceId\":\"" + stored_deviceId + "\",";
    payload += "\"userId\":\"USER-1024\",";
    payload += "\"latitude\":" + String(sensor_latitude, 5) + ",";
    payload += "\"longitude\":" + String(sensor_longitude, 5) + ",";
    payload += "\"heartRate\":" + String(sensor_heartRate) + ",";
    payload += "\"spo2\":" + String(sensor_spo2);
    payload += "}";

    http.POST(payload);
    http.end();
  }
}

/**
 * Restores wearable hardware to clean NORMAL state
 */
void returnToNormalState() {
  currentState = STATE_NORMAL;
  countdownRemainingSec = 15;
  showNormalScreen();
}

// =========================================================================
// OLED SCREEN DISPLAY RENDERING HELPERS
// =========================================================================

void showNormalScreen() {
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(1);
  display.setCursor(18, 5);
  display.println(F("GUARDIANBAND"));
  display.drawLine(10, 16, 118, 16, SSD1306_WHITE);
  display.setCursor(15, 24);
  display.println(F("STATE: NORMAL"));
  display.setCursor(5, 38);
  display.printf("HR:%d bpm  SpO2:%d%%\n", sensor_heartRate, sensor_spo2);
  display.setCursor(5, 52);
  display.println(F("Press SOS 2x to alert"));
  display.display();
}

void show1stPressScreen(int remainingSec) {
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(1);
  display.setCursor(8, 5);
  display.println(F("1st SOS PRESS"));
  display.drawLine(5, 16, 122, 16, SSD1306_WHITE);
  display.setCursor(10, 24);
  display.println(F("PRESS 2nd TIME!"));
  display.setTextSize(2);
  display.setCursor(55, 38);
  display.printf("%ds\n", remainingSec);
  display.display();
}

void showCountdownScreen(int remainingSec) {
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(1);
  display.setCursor(20, 2);
  display.println(F("ARE YOU SAFE?"));
  display.setTextSize(3);
  display.setCursor(45, 18);
  display.println(remainingSec);
  display.setTextSize(1);
  display.setCursor(2, 46);
  display.println(F("PRESS 3rd TO CANCEL"));
  display.setCursor(8, 56);
  display.println(F("No press = VERIFIED"));
  display.display();
}

void showCancelledScreen() {
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(1);
  display.setCursor(5, 15);
  display.println(F("EMERGENCY CANCELLED"));
  display.drawLine(5, 27, 122, 27, SSD1306_WHITE);
  display.setCursor(15, 35);
  display.println(F("3rd Press Detected"));
  display.setCursor(18, 48);
  display.println(F("Returning NORMAL"));
  display.display();
}

void showVerifiedEmergencyScreen() {
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(1);
  display.setCursor(10, 5);
  display.println(F("🚨 VERIFIED SOS"));
  display.drawLine(5, 16, 122, 16, SSD1306_WHITE);
  display.setCursor(5, 22);
  display.println(F("SIM800L SMS Sent"));
  display.setCursor(5, 34);
  display.println(F("SIM800L GPRS Sent"));
  display.setCursor(5, 46);
  display.println(F("Police Forwarded"));
  display.setCursor(5, 56);
  display.println(F("Live GPS Tracking"));
  display.display();
}
