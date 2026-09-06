#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

#include <DHT.h>

#include <SPI.h>
#include <LoRa.h>


// ======================================================
// WIFI CONFIGURATION
// ======================================================

const char* ssid = "Subhajit's A22 5g";
const char* password = "gtjm4881";


// ======================================================
// SUPABASE CONFIGURATION
// ======================================================

// IMPORTANT:
// Replace with your actual Supabase REST endpoint

const char* supabaseUrl =
  "https://cmbbddnmshnufozkfdgp.supabase.co/rest/v1/readings";

// Replace with your actual Supabase publishable/anon key

const char* supabaseKey =
  "sb_publishable_kt2xY0R40zeABmyB70s0JA_knkn6Q2E";

// IMPORTANT:
// node_id must be the UUID from your sensor_nodes table

const char* nodeId =
  "babee346-a6f6-4d1a-9454-f3e6bb8e9412";


// ======================================================
// DHT22
// ======================================================

#define DHT_PIN 4
#define DHT_TYPE DHT22

DHT dht(DHT_PIN, DHT_TYPE);


// ======================================================
// FLAME SENSOR
// ======================================================

#define FLAME_PIN 25


// ======================================================
// RAIN SENSOR
// ======================================================

#define RAIN_PIN 32


// ======================================================
// WATER LEVEL SENSOR
// ======================================================

#define WATER_PIN 34


// ======================================================
// MQ-2 SMOKE SENSOR
// ======================================================

#define MQ2_PIN 35


// ======================================================
// HC-SR04 ULTRASONIC SENSOR
// ======================================================

#define TRIG_PIN 5
#define ECHO_PIN 18


// ======================================================
// LoRa Ra-02 SX1278
// ======================================================

#define LORA_SS    15
#define LORA_RST   16
#define LORA_DIO0  17

#define LORA_SCK   14
#define LORA_MISO  19
#define LORA_MOSI  23

#define LORA_FREQ 433E6


// ======================================================
// TIMING
// ======================================================

unsigned long lastSendTime = 0;

const unsigned long SEND_INTERVAL = 5000;


// ======================================================
// WIFI CONNECTION
// ======================================================

void connectWiFi() {

  if (WiFi.status() == WL_CONNECTED) {
    return;
  }

  Serial.println();
  Serial.println("Connecting to WiFi...");

  WiFi.begin(ssid, password);

  int attempts = 0;

  while (
    WiFi.status() != WL_CONNECTED &&
    attempts < 20
  ) {

    delay(500);

    Serial.print(".");

    attempts++;
  }

  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {

    Serial.println("WiFi Connected!");

    Serial.print("IP Address: ");

    Serial.println(WiFi.localIP());

  } else {

    Serial.println("WiFi connection failed.");
  }
}


// ======================================================
// READ HC-SR04 DISTANCE
// ======================================================

float getDistance() {

  digitalWrite(TRIG_PIN, LOW);

  delayMicroseconds(2);

  digitalWrite(TRIG_PIN, HIGH);

  delayMicroseconds(10);

  digitalWrite(TRIG_PIN, LOW);

  long duration =
    pulseIn(
      ECHO_PIN,
      HIGH,
      30000
    );

  if (duration == 0) {

    return -1;
  }

  float distance =
    duration * 0.0343 / 2;

  return distance;
}


// ======================================================
// RAIN LEVEL
// ======================================================

String getRainStatus(int value) {

  if (value >= 3500) {

    return "DRY";

  }

  else if (value >= 2800) {

    return "LIGHT RAIN";

  }

  else if (value >= 2000) {

    return "HEAVY RAIN";

  }

  else {

    return "VERY HEAVY RAIN";
  }
}


// ======================================================
// WATER LEVEL PERCENTAGE
// ======================================================

// Your calibrated full submerged value = approximately 2100

int getWaterPercentage(int rawValue) {

  int percentage =
    map(
      rawValue,
      0,
      2100,
      0,
      100
    );

  percentage =
    constrain(
      percentage,
      0,
      100
    );

  return percentage;
}


// ======================================================
// SEND DATA TO SUPABASE
// ======================================================

void sendToSupabase(

  float temperature,
  float humidity,

  bool flameDetected,

  int smokeLevel,

  int waterLevel,

  int rainLevel

) {

  if (
    WiFi.status() != WL_CONNECTED
  ) {

    Serial.println(
      "WiFi unavailable. Supabase upload skipped."
    );

    return;
  }


  HTTPClient http;

  http.begin(
    supabaseUrl
  );


  http.addHeader(
    "Content-Type",
    "application/json"
  );

  http.addHeader(
    "apikey",
    supabaseKey
  );

  http.addHeader(
    "Authorization",
    String("Bearer ") +
    supabaseKey
  );

  http.addHeader(
    "Prefer",
    "return=minimal"
  );


  StaticJsonDocument<512> doc;


  doc["node_id"] =
    nodeId;


  doc["temperature"] =
    temperature;


  doc["humidity"] =
    humidity;


  doc["flame_detected"] =
    flameDetected;


  doc["smoke_level"] =
    smokeLevel;


  doc["water_level"] =
    waterLevel;


  doc["rain_level"] =
    rainLevel;


  String payload;


  serializeJson(
    doc,
    payload
  );


  Serial.println();

  Serial.println(
    "Sending to Supabase:"
  );

  Serial.println(
    payload
  );


  int responseCode =
    http.POST(
      payload
    );


  Serial.print(
    "Supabase Response: "
  );

  Serial.println(
    responseCode
  );


  if (
    responseCode > 0
  ) {

    String response =
      http.getString();

    Serial.println(
      response
    );
  }


  http.end();
}


// ======================================================
// SEND DATA VIA LORA
// ======================================================

void sendLoRa(

  float temperature,

  float humidity,

  bool flameDetected,

  int smokeLevel,

  int waterLevel,

  int rainLevel,

  float distance

) {

  Serial.println(
    "Sending LoRa fallback packet..."
  );


  LoRa.beginPacket();


  LoRa.print(
    "NODE:"
  );

  LoRa.print(
    nodeId
  );


  LoRa.print(
    "|T:"
  );

  LoRa.print(
    temperature,
    1
  );


  LoRa.print(
    "|H:"
  );

  LoRa.print(
    humidity,
    1
  );


  LoRa.print(
    "|F:"
  );

  LoRa.print(
    flameDetected
  );


  LoRa.print(
    "|S:"
  );

  LoRa.print(
    smokeLevel
  );


  LoRa.print(
    "|W:"
  );

  LoRa.print(
    waterLevel
  );


  LoRa.print(
    "|R:"
  );

  LoRa.print(
    rainLevel
  );


  LoRa.print(
    "|D:"
  );

  LoRa.print(
    distance,
    1
  );


  LoRa.endPacket();


  Serial.println(
    "LoRa packet transmitted."
  );
}


// ======================================================
// SETUP
// ======================================================

void setup() {

  Serial.begin(
    115200
  );


  delay(
    2000
  );


  Serial.println();

  Serial.println(
    "=================================="
  );

  Serial.println(
    "BHOOMI-NETRA SENSOR NODE STARTING"
  );

  Serial.println(
    "=================================="
  );


  // --------------------------------
  // SENSOR PINS
  // --------------------------------

  pinMode(
    FLAME_PIN,
    INPUT
  );


  pinMode(
    TRIG_PIN,
    OUTPUT
  );


  pinMode(
    ECHO_PIN,
    INPUT
  );


  digitalWrite(
    TRIG_PIN,
    LOW
  );


  analogReadResolution(
    12
  );


  // --------------------------------
  // DHT22
  // --------------------------------

  dht.begin();


  // --------------------------------
  // WIFI
  // --------------------------------

  connectWiFi();


  // --------------------------------
  // LORA
  // --------------------------------

  Serial.println();

  Serial.println(
    "Initializing LoRa..."
  );


  SPI.begin(

    LORA_SCK,

    LORA_MISO,

    LORA_MOSI,

    LORA_SS

  );


  LoRa.setSPI(
    SPI
  );


  LoRa.setPins(

    LORA_SS,

    LORA_RST,

    LORA_DIO0

  );


  if (
    !LoRa.begin(
      LORA_FREQ
    )
  ) {

    Serial.println(
      "LoRa initialization FAILED!"
    );

  }

  else {

    LoRa.setTxPower(
      17
    );


    LoRa.setSpreadingFactor(
      7
    );


    LoRa.setSignalBandwidth(
      125E3
    );


    LoRa.enableCrc();


    Serial.println(
      "LoRa initialized successfully!"
    );
  }


  Serial.println();

  Serial.println(
    "ALL SYSTEMS READY"
  );
}


// ======================================================
// MAIN LOOP
// ======================================================

void loop() {


  // --------------------------------
  // READ DHT22
  // --------------------------------

  float temperature =
    dht.readTemperature();


  float humidity =
    dht.readHumidity();


  // --------------------------------
  // READ FLAME SENSOR
  // --------------------------------

  int flameValue =
    digitalRead(
      FLAME_PIN
    );


  // Most flame modules output LOW when flame detected

  bool flameDetected =
    (
      flameValue == LOW
    );


  // --------------------------------
  // READ MQ-2
  // --------------------------------

  int smokeLevel =
    analogRead(
      MQ2_PIN
    );


  // --------------------------------
  // READ WATER SENSOR
  // --------------------------------

  int waterRaw =
    analogRead(
      WATER_PIN
    );


  int waterLevel =
    getWaterPercentage(
      waterRaw
    );


  // --------------------------------
  // READ RAIN SENSOR
  // --------------------------------

  int rainLevel =
    analogRead(
      RAIN_PIN
    );


  String rainStatus =
    getRainStatus(
      rainLevel
    );


  // --------------------------------
  // READ HC-SR04
  // --------------------------------

  float distance =
    getDistance();


  // --------------------------------
  // PRINT DATA
  // --------------------------------

  Serial.println();

  Serial.println(
    "------------- SENSOR DATA -------------"
  );


  Serial.print(
    "Temperature: "
  );

  Serial.print(
    temperature
  );

  Serial.println(
    " C"
  );


  Serial.print(
    "Humidity: "
  );

  Serial.print(
    humidity
  );

  Serial.println(
    " %"
  );


  Serial.print(
    "Flame: "
  );

  Serial.println(

    flameDetected
    ? "DETECTED"
    : "SAFE"

  );


  Serial.print(
    "MQ-2 Smoke Raw: "
  );

  Serial.println(
    smokeLevel
  );


  Serial.print(
    "Water Raw: "
  );

  Serial.print(
    waterRaw
  );


  Serial.print(
    " | Water Level: "
  );

  Serial.print(
    waterLevel
  );

  Serial.println(
    " %"
  );


  Serial.print(
    "Rain Raw: "
  );

  Serial.print(
    rainLevel
  );


  Serial.print(
    " | Status: "
  );

  Serial.println(
    rainStatus
  );


  Serial.print(
    "Distance: "
  );

  Serial.print(
    distance
  );

  Serial.println(
    " cm"
  );


  Serial.println(
    "---------------------------------------"
  );


  // --------------------------------
  // SEND EVERY 5 SECONDS
  // --------------------------------

  if (

    millis() -
    lastSendTime
    >=
    SEND_INTERVAL

  ) {


    lastSendTime =
      millis();


    if (
      WiFi.status()
      ==
      WL_CONNECTED
    ) {


      sendToSupabase(

        temperature,

        humidity,

        flameDetected,

        smokeLevel,

        waterLevel,

        rainLevel

      );


    }

    else {


      sendLoRa(

        temperature,

        humidity,

        flameDetected,

        smokeLevel,

        waterLevel,

        rainLevel,

        distance

      );


    }
  }


  delay(
    1000
  );
}