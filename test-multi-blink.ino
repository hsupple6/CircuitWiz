// Test code for dynamic GPIO simulation with multiple pins
// This code demonstrates multiple LEDs blinking at different rates

void setup() {
  pinMode(13, OUTPUT);   // LED 1
  pinMode(12, OUTPUT);   // LED 2
  pinMode(11, OUTPUT);   // LED 3
}

void loop() {
  // Blink pin 13 (1 second intervals)
  digitalWrite(13, HIGH);
  delay(500);
  digitalWrite(13, LOW);
  delay(500);
  
  // Blink pin 12 (0.5 second intervals)
  digitalWrite(12, HIGH);
  delay(250);
  digitalWrite(12, LOW);
  delay(250);
  
  // Blink pin 11 (0.25 second intervals)
  digitalWrite(11, HIGH);
  delay(125);
  digitalWrite(11, LOW);
  delay(125);
}
