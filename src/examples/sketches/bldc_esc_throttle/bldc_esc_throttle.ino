/**
 * BLDC motor spin example — Arduino Uno → 30A 3S ESC → brushless motor.
 * PWM throttle on D9 ramps up/down to drive the ESC (simulation reads analogWrite).
 */
const int ESC_PWM_PIN = 9;

const int THROTTLE_MIN = 110;
const int THROTTLE_MAX = 200;
const int THROTTLE_IDLE = 110;

void setup() {
  pinMode(ESC_PWM_PIN, OUTPUT);
  analogWrite(ESC_PWM_PIN, THROTTLE_IDLE);
  delay(2000);
}

void loop() {
  for (int t = THROTTLE_MIN; t <= THROTTLE_MAX; t++) {
    analogWrite(ESC_PWM_PIN, t);
    delay(20);
  }
  delay(800);
  for (int t = THROTTLE_MAX; t >= THROTTLE_MIN; t--) {
    analogWrite(ESC_PWM_PIN, t);
    delay(20);
  }
  delay(800);
}
