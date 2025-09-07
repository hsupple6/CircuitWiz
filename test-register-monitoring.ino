void setup() {
  // Manually set DDRB to configure pin 13 as output
  DDRB = 0x20; // Set bit 5 (pin 13) as output
  
  // Manually set PORTB to turn on pin 13
  PORTB = 0x20; // Set bit 5 (pin 13) HIGH
}

void loop() {
  // Toggle pin 13
  PORTB ^= 0x20; // Toggle bit 5 (pin 13)
  delay(1000);
}
