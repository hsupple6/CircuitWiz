// Test circuit: Arduino UNO + Motor + 5V Battery
// Connections:
// - Arduino VCC to 5V Battery positive
// - Arduino GND to 5V Battery negative  
// - Arduino GND to Motor GND
// - Arduino D13 to Motor PWM
// - 5V Battery positive to Motor VCC

// This code demonstrates PWM control of a motor using pin D13
// In CircuitWiz, use the PWM Test button to send PWM signals

void setup() {
  // Configure pin 13 as PWM output for motor control
  pinMode(13, OUTPUT);
  
  // Initialize serial communication for debugging
  Serial.begin(9600);
  Serial.println("Motor PWM Control Test Started");
  Serial.println("Pin D13 configured for PWM motor control");
}

void loop() {
  // Test different motor speeds using PWM
  // 75% duty cycle - this is what the DEBUG button will send
  analogWrite(13, 191); // 191/255 = ~75% duty cycle
  Serial.println("Motor: 75% speed (191/255 PWM)");
  delay(3000);
  
  // 50% duty cycle
  analogWrite(13, 128); // 128/255 = 50% duty cycle
  Serial.println("Motor: 50% speed (128/255 PWM)");
  delay(3000);
  
  // 25% duty cycle
  analogWrite(13, 64); // 64/255 = ~25% duty cycle
  Serial.println("Motor: 25% speed (64/255 PWM)");
  delay(3000);
  
  // 100% duty cycle (full speed)
  analogWrite(13, 255); // 255/255 = 100% duty cycle
  Serial.println("Motor: 100% speed (255/255 PWM)");
  delay(3000);
  
  // 0% duty cycle (stopped)
  analogWrite(13, 0); // 0/255 = 0% duty cycle
  Serial.println("Motor: 0% speed (0/255 PWM) - STOPPED");
  delay(3000);
}
