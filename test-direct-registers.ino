void setup() {
  // Direct register manipulation - bypass Arduino libraries
  // This should definitely work if QEMU is running
  
  // Configure pin 13 (PB5) as output
  DDRB |= (1 << 5);
  
  // Turn on pin 13
  PORTB |= (1 << 5);
}

void loop() {
  // Toggle pin 13 every second
  PORTB ^= (1 << 5);
  
  // Simple delay loop (no Arduino delay() function)
  for (volatile int i = 0; i < 100000; i++) {
    // Busy wait
  }
}
