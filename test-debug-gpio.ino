void setup() {
  // Only test pin 13 (LED_BUILTIN)
  pinMode(13, OUTPUT);
}

void loop() {
  // Simple on/off cycle for pin 13 only
  digitalWrite(13, HIGH);
  delay(500);
  digitalWrite(13, LOW);
  delay(500);
}
