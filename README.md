# Midi-Dudes

Midi in, RGB light strip out! Just plug in both a keyboard in via a standard (DIN-5) Midi cable, and an addressable RGB LED strip (SK9822/Dotstar or WS281(X)/Neopixel-based strip) and run the [midiDudes](./midiDudes.ts) script.

https://user-images.githubusercontent.com/6108440/140427911-7cb8871e-7e6d-4ef0-b22c-ec55dec32007.mov

# Guide

![image](https://user-images.githubusercontent.com/6108440/140418469-cc1380da-4db1-4c1d-ac00-28d27b0fece9.png)

I used a Raspberry Pi Zero W for this, but any Pi running Linux should work. The only building really required for this project is the circuit to convert the Midi to serial using an optocoupler, though incorporating a level-shifter and power delivery to the LED strip into the same circuit board is easy and probably the most convenient way to do it.
