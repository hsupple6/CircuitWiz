// Test code for dynamic GPIO simulation with PWM fading
// This code demonstrates PWM fading on pin 9

void setup() {
  pinMode(9, OUTPUT);    // PWM pin for fading
}

void loop() {
  // Fade in
  for (int brightness = 0; brightness <= 255; brightness++) {
    analogWrite(9, brightness);
    delay(10);
  }
  
  // Fade out
  for (int brightness = 255; brightness >= 0; brightness--) {
    analogWrite(9, brightness);
    delay(10);
  }
}
