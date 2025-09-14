// Test code for PWM debug functionality
// This demonstrates PWM output on pin 13 (D13) which is typically an LED pin
// In CircuitWiz, this will be controlled by the DEBUG button

void setup() {
  // Configure pin 13 as output for PWM
  pinMode(13, OUTPUT);
  
  // Initialize serial communication for debugging
  Serial.begin(9600);
  Serial.println("PWM Debug Test Started");
  Serial.println("Pin D13 configured for PWM output");
}

void loop() {
  // Test different PWM duty cycles
  // 75% duty cycle - this is what the DEBUG button will send
  analogWrite(13, 191); // 191/255 = ~75% duty cycle
  Serial.println("PWM: 75% duty cycle (191/255)");
  delay(2000);
  
  // 50% duty cycle
  analogWrite(13, 128); // 128/255 = 50% duty cycle
  Serial.println("PWM: 50% duty cycle (128/255)");
  delay(2000);
  
  // 25% duty cycle
  analogWrite(13, 64); // 64/255 = ~25% duty cycle
  Serial.println("PWM: 25% duty cycle (64/255)");
  delay(2000);
  
  // 100% duty cycle (full on)
  analogWrite(13, 255); // 255/255 = 100% duty cycle
  Serial.println("PWM: 100% duty cycle (255/255)");
  delay(2000);
  
  // 0% duty cycle (off)
  analogWrite(13, 0); // 0/255 = 0% duty cycle
  Serial.println("PWM: 0% duty cycle (0/255)");
  delay(2000);
}
