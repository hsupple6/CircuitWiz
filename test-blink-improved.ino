// Test file to verify the improved emulation
// This should now show different GPIO activity compared to identical outputs

void setup() {
  pinMode(13, OUTPUT);  // LED pin
  pinMode(12, OUTPUT);  // Additional pin for testing
  pinMode(11, OUTPUT);  // Another pin for testing
}

void loop() {
  // Blink LED on pin 13
  digitalWrite(13, HIGH);
  delay(500);
  digitalWrite(13, LOW);
  delay(500);
  
  // Blink pin 12 at different rate
  digitalWrite(12, HIGH);
  delay(200);
  digitalWrite(12, LOW);
  delay(200);
  
  // Blink pin 11 at another rate
  digitalWrite(11, HIGH);
  delay(1000);
  digitalWrite(11, LOW);
  delay(1000);
}
