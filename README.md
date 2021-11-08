# Midi-Dudes

Midi in, RGB light strip out! Just plug in both a keyboard in via a standard (DIN-5) Midi cable, and an addressable RGB LED strip (SK9822/Dotstar or WS281(X)/Neopixel-based strip) and run the [midiDudes](./midiDudes.ts) script.

https://user-images.githubusercontent.com/6108440/140427911-7cb8871e-7e6d-4ef0-b22c-ec55dec32007.mov

# Guide

![image](https://user-images.githubusercontent.com/6108440/140418469-cc1380da-4db1-4c1d-ac00-28d27b0fece9.png)

## Hardware

I used a Raspberry Pi Zero W for this, but any Pi running Linux should work. The "hat" I made serves 3 simple purposes:

1. Provide 5V to both LED strip and Pi from a single input jack
1. Shift 3V signal from Pi to 5V for LED strip
1. Convert MIDI signal for use as serial in to Raspberry PI GPIO

Technically for number 3, you could use a pre-built hat like [this](https://www.adafruit.com/product/4740) or even an off-the-shelf MIDI-to-USB device, though some modification of the config and code might be required as this guide and code are written specifically to use uart0 on GPIO pin #6.


### Power

I just used a 4A 5V switching supply like [this](https://www.adafruit.com/product/1466).

- Solder a barrel jack like [this](https://www.adafruit.com/product/373) to your board
- Connect the ground and 5V pins to corresponding pins on both Raspberry Pi header and LED strip output

### Level shifter

While you _may_ not need to, a Raspberry Pi's 3V logic should be shifted to 5V in order to work reliably with LED strips.

Refer to:
- For Dotstar, refer to last bullet in Adafruit's [Dotstar guide](https://learn.adafruit.com/adafruit-dotstar-leds/power-and-connections)
- For Neopixels, [Neopixel guide](https://learn.adafruit.com/neopixels-on-raspberry-pi/raspberry-pi-wiring)
- Or for more general info about level shifters, their [level shifter guide](https://learn.adafruit.com/neopixel-levelshifter)

- Slap one of [these](https://www.adafruit.com/product/1787) in your board
- Wire up to LED strip outputs and Raspberry Pi header as described in above guides (for Dotstar strips, use MOSI and SCLK pins for data and clock respectively, for Neopixels, use GPIO18 as described in guides)

### MIDI Signal

I used [this](https://www.samplerbox.org/article/midiinwithrpi) guide exactly and it worked like a charm. I pray this page remains up forever. There are some useful comments about getting it to work on various Pis like Raspberry Pi Zero Ws.

The directives I added to /boot/config.txt are also here in [config.txt](./config.txt)